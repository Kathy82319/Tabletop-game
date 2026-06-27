export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const session_id = params.id;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { player_id, owner_line_id } = body;
    if (!player_id || !owner_line_id) {
        return Response.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const session = await env.DB.prepare(
        `SELECT owner_line_id FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();

    if (!session) return Response.json({ error: '找不到此記分板' }, { status: 404 });
    if (session.owner_line_id !== owner_line_id) {
        return Response.json({ error: '只有建立者可以移除玩家' }, { status: 403 });
    }

    const { results: remaining } = await env.DB.prepare(
        `SELECT player_id FROM ScoreboardPlayers WHERE session_id = ?`
    ).bind(session_id).all();

    if (remaining.length <= 1) {
        return Response.json({ error: '至少需要保留 1 位玩家' }, { status: 400 });
    }

    await env.DB.prepare(
        `DELETE FROM ScoreboardPlayers WHERE player_id = ? AND session_id = ?`
    ).bind(player_id, session_id).run();

    return Response.json({ ok: true });
}
