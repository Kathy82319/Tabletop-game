export async function onRequestPost(context) {
    const { request, env } = context;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { game_name, owner_line_id } = body;
    if (!game_name || !owner_line_id) {
        return Response.json({ error: '缺少 game_name 或 owner_line_id' }, { status: 400 });
    }

    const session_id = crypto.randomUUID();

    await env.DB.prepare(
        `INSERT INTO ScoreboardSessions (session_id, game_name, owner_line_id) VALUES (?, ?, ?)`
    ).bind(session_id, game_name.trim(), owner_line_id).run();

    return Response.json({ session_id });
}
