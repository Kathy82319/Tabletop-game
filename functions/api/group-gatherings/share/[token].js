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

    return Response.json({
        ...g,
        games: JSON.parse(g.games || '[]'),
    });
}
