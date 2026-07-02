export async function onRequestGet(context) {
    const { env, params, request } = context;
    const id = params.id;

    const g = await env.DB.prepare(
        `SELECT g.*, COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
         FROM GroupGatherings g
         LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
         WHERE g.id = ?
         GROUP BY g.id`
    ).bind(id).first();

    if (!g) {
        return Response.json({ error: '找不到此揪團' }, { status: 404 });
    }

    const members = await env.DB.prepare(
        `SELECT id, user_id, display_name, line_name, joined_at, status
         FROM GroupGatheringMembers
         WHERE gathering_id = ?
         ORDER BY joined_at ASC`
    ).bind(id).all();

    // 判斷目前登入者身分（非必要，前端也可處理）
    let myStatus = null;
    const liffToken = request.headers.get('X-LIFF-Token');
    if (liffToken) {
        const profileRes = await fetch('https://api.line.me/v2/profile', {
            headers: { Authorization: `Bearer ${liffToken}` },
        }).catch(() => null);
        if (profileRes && profileRes.ok) {
            const profile = await profileRes.json();
            const me = members.results.find(m => m.user_id === profile.userId);
            myStatus = me ? me.status : null;
            if (g.organizer_user_id === profile.userId) myStatus = 'organizer';
        }
    }

    return Response.json({
        ...g,
        games: JSON.parse(g.games || '[]'),
        members: members.results,
        my_status: myStatus,
    });
}
