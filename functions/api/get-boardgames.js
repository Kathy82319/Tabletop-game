// functions/api/get-boardgames.js

export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const stmt = db.prepare('SELECT * FROM BoardGames ORDER BY display_order ASC, name ASC');
            const { results } = await stmt.all();
            return new Response(JSON.stringify(results || []), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response('Invalid request method.', { status: 405 });

    } catch (error) {
        console.error(`Error in get-boardgames API (Method: ${request.method}):`, error);
        return new Response(JSON.stringify({ error: '獲取桌遊列表失敗。', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
