import { verifyLiffUser } from '../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;

    const profile = await verifyLiffUser(request);
    if (!profile) {
        return Response.json({ error: '未登入或驗證失敗。' }, { status: 401 });
    }
    const line_user_id = profile.userId;

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
