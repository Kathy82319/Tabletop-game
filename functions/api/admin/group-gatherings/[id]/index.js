export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;

    const g = await env.DB.prepare(
        `SELECT * FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此糾團' }, { status: 404 });

    const members = await env.DB.prepare(
        `SELECT id, user_id, display_name, joined_at, status
         FROM GroupGatheringMembers
         WHERE gathering_id = ?
         ORDER BY joined_at ASC`
    ).bind(id).all();

    return Response.json({
        ...g,
        games: JSON.parse(g.games || '[]'),
        members: members.results,
    });
}
