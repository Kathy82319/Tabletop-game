export async function onRequestPost(context) {
    const { request, env, params } = context;
    const session_id = params.id;

    const session = await env.DB.prepare(
        `SELECT session_id FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();

    if (!session) {
        return Response.json({ error: '找不到此記分板' }, { status: 404 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { nickname, line_user_id } = body;
    if (!nickname) {
        return Response.json({ error: '請輸入暱稱' }, { status: 400 });
    }

    // 同一個 LINE user 在同一局只能加入一次
    if (line_user_id) {
        const existing = await env.DB.prepare(
            `SELECT player_id FROM ScoreboardPlayers WHERE session_id = ? AND line_user_id = ?`
        ).bind(session_id, line_user_id).first();

        if (existing) {
            return Response.json({ player_id: existing.player_id, already_joined: true });
        }
    }

    const result = await env.DB.prepare(
        `INSERT INTO ScoreboardPlayers (session_id, line_user_id, nickname, score) VALUES (?, ?, ?, 0)`
    ).bind(session_id, line_user_id || null, nickname.trim()).run();

    return Response.json({ player_id: result.meta.last_row_id });
}
