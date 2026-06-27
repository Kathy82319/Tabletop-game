export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const line_user_id = url.searchParams.get('line_user_id');

    if (!line_user_id) {
        return Response.json({ error: '缺少 line_user_id' }, { status: 400 });
    }

    // 找出此玩家參與過的所有對局（含建立者身份）
    const { results } = await env.DB.prepare(`
        SELECT
            s.session_id,
            s.game_name,
            s.created_at,
            p.nickname,
            p.score,
            (SELECT COUNT(*) FROM ScoreboardPlayers WHERE session_id = s.session_id) AS player_count,
            (s.owner_line_id = ?) AS is_owner
        FROM ScoreboardPlayers p
        JOIN ScoreboardSessions s ON p.session_id = s.session_id
        WHERE p.line_user_id = ?
        ORDER BY s.created_at DESC
        LIMIT 50
    `).bind(line_user_id, line_user_id).all();

    return Response.json({ history: results });
}
