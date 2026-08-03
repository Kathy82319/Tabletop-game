import { verifyLiffUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const game_id = params.id;

    // 只要求「已登入本 LIFF App」，不限定查自己的分數，讓大家能互相看到彼此的成績
    const profile = await verifyLiffUser(request);
    if (!profile) {
        return Response.json({ error: '未登入或驗證失敗。' }, { status: 401 });
    }

    const { results } = await env.DB.prepare(`
        SELECT p.nickname, p.score, s.created_at
        FROM ScoreboardPlayers p
        JOIN ScoreboardSessions s ON s.session_id = p.session_id
        WHERE s.game_id = ?
        ORDER BY p.score DESC
        LIMIT 50
    `).bind(game_id).all();

    return Response.json({ records: results || [] });
}
