export async function onRequestGet(context) {
    const { env, params } = context;
    const token = params.token;

    const g = await env.DB.prepare(
        `SELECT g.*, COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
         FROM GroupGatherings g
         LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
         WHERE g.share_token = ?
         GROUP BY g.id`
    ).bind(token).first();

    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });

    // 此端點無須登入即可查詢，不可外洩團主的真實 LINE user_id
    const { organizer_user_id, ...publicG } = g;

    return Response.json({
        ...publicG,
        games: JSON.parse(g.games || '[]'),
    });
}
