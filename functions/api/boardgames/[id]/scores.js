import { verifyLiffUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const game_id = params.id;

    // 只要求「已登入本 LIFF App」，不限定查自己的分數，讓大家能互相看到彼此的成績
    const profile = await verifyLiffUser(request);
    if (!profile) {
        return Response.json({ error: '未登入或驗證失敗。' }, { status: 401 });
    }

    // 只顯示最高分前 5 名，同分則以最近登入的分數優先，避免玩家分數太低而不想被公開看到
    const { results } = await env.DB.prepare(`
        SELECT p.nickname, p.score, s.created_at
        FROM ScoreboardPlayers p
        JOIN ScoreboardSessions s ON s.session_id = p.session_id
        WHERE s.game_id = ?
        ORDER BY p.score DESC, s.created_at DESC
        LIMIT 5
    `).bind(game_id).all();

    return Response.json({ records: results || [] });
}
