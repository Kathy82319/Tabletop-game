// functions/api/get-boardgames.js

export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const stmt = db.prepare(`
                SELECT bg.*,
                    (SELECT group_concat(barcode, ',') FROM BoardGameBarcodes WHERE game_id = bg.game_id) AS extra_barcodes
                FROM BoardGames bg
                ORDER BY bg.display_order ASC, bg.name ASC
            `);
            const { results } = await stmt.all();
            return new Response(JSON.stringify(results || []), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response('Invalid request method.', { status: 405 });

    } catch (error) {
        console.error(`Error in get-boardgames API (Method: ${request.method}):`, error);
        return new Response(JSON.stringify({ error: '獲取桌遊列表失敗。' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
