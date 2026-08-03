export async function onRequestPatch(context) {
    const { request, env, params } = context;
    const session_id = params.id;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { game_name, owner_line_id } = body;
    const trimmed = (game_name || '').trim();
    if (!trimmed || !owner_line_id) {
        return Response.json({ error: '缺少必要欄位' }, { status: 400 });
    }
    if (trimmed.length > 50) {
        return Response.json({ error: '名稱過長' }, { status: 400 });
    }

    const session = await env.DB.prepare(
        `SELECT owner_line_id FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();
    if (!session) return Response.json({ error: '找不到此記分板' }, { status: 404 });

    if (session.owner_line_id !== owner_line_id) {
        return Response.json({ error: '只有建立者可以修改開團名稱' }, { status: 403 });
    }

    // 只改顯示名稱，game_id（連結的館藏遊戲）維持不變
    await env.DB.prepare(
        `UPDATE ScoreboardSessions SET game_name = ? WHERE session_id = ?`
    ).bind(trimmed, session_id).run();

    return Response.json({ game_name: trimmed });
}
