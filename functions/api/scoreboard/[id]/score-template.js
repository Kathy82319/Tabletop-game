// 專屬計分表格：一次設定某位玩家「各計分欄位」的最終數字（覆蓋，不是累加），
// 並自動把所有欄位加總寫回 ScoreboardPlayers.score，讓排行榜/歷史紀錄等既有功能不用改
export async function onRequestPatch(context) {
    const { request, env, params } = context;
    const session_id = params.id;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { player_id, owner_line_id, category_scores } = body;
    if (player_id === undefined || !owner_line_id || typeof category_scores !== 'object' || category_scores === null) {
        return Response.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const entries = Object.entries(category_scores);
    let total = 0;
    for (const [, value] of entries) {
        const n = Number(value);
        if (!Number.isFinite(n)) {
            return Response.json({ error: '分數必須是有效的數字' }, { status: 400 });
        }
        total += n;
    }

    const session = await env.DB.prepare(
        `SELECT owner_line_id FROM ScoreboardSessions WHERE session_id = ?`
    ).bind(session_id).first();

    if (!session) return Response.json({ error: '找不到此記分板' }, { status: 404 });
    if (session.owner_line_id !== owner_line_id) {
        return Response.json({ error: '只有建立者可以修改分數' }, { status: 403 });
    }

    const player = await env.DB.prepare(
        `SELECT player_id, nickname, score FROM ScoreboardPlayers WHERE player_id = ? AND session_id = ?`
    ).bind(player_id, session_id).first();

    if (!player) return Response.json({ error: '找不到此玩家' }, { status: 404 });

    const new_score = total;
    const delta = new_score - (player.score || 0);
    const categoryScoresJson = JSON.stringify(category_scores);

    await env.DB.prepare(
        `UPDATE ScoreboardPlayers SET score = ?, category_scores = ? WHERE player_id = ?`
    ).bind(new_score, categoryScoresJson, player_id).run();

    await env.DB.prepare(
        `INSERT INTO ScoreboardEvents (session_id, event_type, nickname, delta, new_score) VALUES (?, 'score', ?, ?, ?)`
    ).bind(session_id, player.nickname, delta, new_score).run();

    return Response.json({ player_id, new_score, category_scores });
}
