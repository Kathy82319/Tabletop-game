export async function onRequestGet(context) {
    const { request, env } = context;

    const liffToken = request.headers.get('X-LIFF-Token');
    if (!liffToken) {
        return Response.json({ error: '未登入' }, { status: 401 });
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${liffToken}` },
    });
    if (!profileRes.ok) {
        return Response.json({ error: '驗證失敗' }, { status: 401 });
    }
    const profile = await profileRes.json();
    const userId = profile.userId;

    const organized = await env.DB.prepare(
        `SELECT g.id, g.organizer_name, g.event_date, g.start_time, g.end_time,
                g.max_participants, g.games, g.note, g.deadline, g.status, g.share_token,
                COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
         FROM GroupGatherings g
         LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
         WHERE g.organizer_user_id = ?
         GROUP BY g.id
         ORDER BY g.created_at DESC`
    ).bind(userId).all();

    const joined = await env.DB.prepare(
        `SELECT g.id, g.organizer_name, g.event_date, g.start_time, g.end_time,
                g.max_participants, g.games, g.note, g.deadline, g.status, g.share_token,
                me.status as my_status,
                COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
         FROM GroupGatheringMembers me
         JOIN GroupGatherings g ON g.id = me.gathering_id
         LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
         WHERE me.user_id = ? AND g.organizer_user_id != ?
         GROUP BY g.id
         ORDER BY g.event_date DESC`
    ).bind(userId, userId).all();

    const parse = list => list.results.map(g => ({ ...g, games: JSON.parse(g.games || '[]') }));

    return Response.json({ organized: parse(organized), joined: parse(joined) });
}
