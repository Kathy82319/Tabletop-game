// 鎖定計分表格：只有團主能鎖，鎖定後永久生效，沒有解鎖 API（使用者明確要求不做解鎖）
export async function onRequestPatch(context) {
    const { request, env, params } = context;
    const session_id = params.id;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { owner_line_id } = body;
    if (!owner_line_id) {
        return Response.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const session = await env.DB.prepare(
        `SELECT owner_line_id, locked FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();

    if (!session) return Response.json({ error: '找不到此記分板' }, { status: 404 });
    if (session.owner_line_id !== owner_line_id) {
        return Response.json({ error: '只有建立者可以鎖定計分' }, { status: 403 });
    }
    if (session.locked) {
        return Response.json({ error: '計分已經鎖定過了' }, { status: 400 });
    }

    await env.DB.prepare(
        `UPDATE ScoreboardSessions SET locked = 1 WHERE session_id = ?`
    ).bind(session_id).run();

    return Response.json({ success: true });
}
