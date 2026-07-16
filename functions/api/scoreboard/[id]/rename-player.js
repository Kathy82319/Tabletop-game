export async function onRequestPatch(context) {
    const { request, env, params } = context;
    const session_id = params.id;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { player_id, nickname, requester_line_id } = body;
    const trimmed = (nickname || '').trim();
    if (player_id === undefined || !trimmed || !requester_line_id) {
        return Response.json({ error: '缺少必要欄位' }, { status: 400 });
    }
    if (trimmed.length > 20) {
        return Response.json({ error: '暱稱過長' }, { status: 400 });
    }

    const session = await env.DB.prepare(
        `SELECT owner_line_id FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();
    if (!session) return Response.json({ error: '找不到此記分板' }, { status: 404 });

    const player = await env.DB.prepare(
        `SELECT player_id, line_user_id FROM ScoreboardPlayers WHERE player_id = ? AND session_id = ?`
    ).bind(player_id, session_id).first();
    if (!player) return Response.json({ error: '找不到此玩家' }, { status: 404 });

    const isOwner = requester_line_id === session.owner_line_id;
    const isSelf  = requester_line_id === player.line_user_id;
    if (!isOwner && !isSelf) {
        return Response.json({ error: '只有建立者或玩家本人可以修改暱稱' }, { status: 403 });
    }

    await env.DB.prepare(
        `UPDATE ScoreboardPlayers SET nickname = ? WHERE player_id = ?`
    ).bind(trimmed, player_id).run();

    return Response.json({ player_id, nickname: trimmed });
}
