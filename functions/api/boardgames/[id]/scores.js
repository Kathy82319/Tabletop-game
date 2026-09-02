import { verifyLiffUser } from '../../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const game_id = params.id;

    // 只要求「已登入本 LIFF App」，不限定查自己的分數，讓大家能互相看到彼此的成績
    const profile = await verifyLiffUser(request);
    if (!profile) {
        return Response.json({ error: '未登入或驗證失敗。' }, { status: 401 });
    }

    // 預設只看最近 3 個月的紀錄，避免同一個人長期霸榜；?months=0 表示不限時間
    const url = new URL(request.url);
    const monthsParam = url.searchParams.get('months');
    const months = monthsParam === null ? 3 : parseInt(monthsParam, 10) || 0;

    // 只顯示最高分前 5 名，同分則以最近登入的分數優先，避免玩家分數太低而不想被公開看到
    const query = months > 0
        ? `SELECT p.nickname, p.score, s.created_at
           FROM ScoreboardPlayers p
           JOIN ScoreboardSessions s ON s.session_id = p.session_id
           WHERE s.game_id = ? AND s.created_at >= datetime('now', '-' || ? || ' months')
           ORDER BY p.score DESC, s.created_at DESC
           LIMIT 5`
        : `SELECT p.nickname, p.score, s.created_at
           FROM ScoreboardPlayers p
           JOIN ScoreboardSessions s ON s.session_id = p.session_id
           WHERE s.game_id = ?
           ORDER BY p.score DESC, s.created_at DESC
           LIMIT 5`;

    const stmt = months > 0
        ? env.DB.prepare(query).bind(game_id, months)
        : env.DB.prepare(query).bind(game_id);

    const { results } = await stmt.all();

    return Response.json({ records: results || [] });
}
