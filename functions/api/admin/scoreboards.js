export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'GET') {
        const url    = new URL(request.url);
        const detail = url.searchParams.get('session_id');

        if (detail) {
            // 單場詳細：玩家 + 事件
            const session = await env.DB.prepare(
                `SELECT session_id, game_name, owner_line_id, created_at FROM ScoreboardSessions WHERE session_id = ?`
            ).bind(detail).first();
            if (!session) return Response.json({ error: '找不到此記分板' }, { status: 404 });

            const { results: players } = await env.DB.prepare(
                `SELECT player_id, nickname, score, joined_at FROM ScoreboardPlayers WHERE session_id = ? ORDER BY joined_at ASC`
            ).bind(detail).all();

            const { results: events } = await env.DB.prepare(
                `SELECT event_type, nickname, delta, new_score, created_at FROM ScoreboardEvents WHERE session_id = ? ORDER BY created_at DESC LIMIT 200`
            ).bind(detail).all();

            return Response.json({ session, players, events });
        }

        // 全部記分板列表
        const { results } = await env.DB.prepare(`
            SELECT
                s.session_id,
                s.game_name,
                s.owner_line_id,
                u.line_display_name AS owner_name,
                s.created_at,
                COUNT(p.player_id) AS player_count
            FROM ScoreboardSessions s
            LEFT JOIN ScoreboardPlayers p ON p.session_id = s.session_id
            LEFT JOIN Users u ON u.user_id = s.owner_line_id
            GROUP BY s.session_id
            ORDER BY s.created_at DESC
        `).all();

        return Response.json(results || []);
    }

    if (request.method === 'DELETE') {
        let body;
        try { body = await request.json(); } catch {
            return Response.json({ error: '無效格式' }, { status: 400 });
        }
        const { session_id } = body;
        if (!session_id) return Response.json({ error: '缺少 session_id' }, { status: 400 });

        await env.DB.batch([
            env.DB.prepare(`DELETE FROM ScoreboardEvents  WHERE session_id = ?`).bind(session_id),
            env.DB.prepare(`DELETE FROM ScoreboardPlayers WHERE session_id = ?`).bind(session_id),
            env.DB.prepare(`DELETE FROM ScoreboardSessions WHERE session_id = ?`).bind(session_id),
        ]);

        return Response.json({ ok: true });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
