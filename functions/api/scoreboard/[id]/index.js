export async function onRequestGet(context) {
    const { env, params } = context;
    const session_id = params.id;

    const session = await env.DB.prepare(
        `SELECT session_id, game_name, owner_line_id, created_at FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();

    if (!session) {
        return Response.json({ error: '找不到此記分板' }, { status: 404 });
    }

    const { results: players } = await env.DB.prepare(
        `SELECT player_id, nickname, score, joined_at FROM ScoreboardPlayers WHERE session_id = ? ORDER BY score DESC`
    ).bind(session_id).all();

    return Response.json({ session, players });
}
