// functions/api/admin/activities.js
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const showAll = url.searchParams.get('all') === '1';
            const query = showAll
                ? "SELECT * FROM Activities ORDER BY created_at DESC LIMIT 80"
                : "SELECT * FROM Activities WHERE is_read = 0 ORDER BY created_at DESC";
            const { results } = await db.prepare(query).all();
            return new Response(JSON.stringify(results || []), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (request.method === 'POST') {
            const { activity_id } = await request.json();
            if (!activity_id || typeof activity_id !== 'number') {
                return new Response(JSON.stringify({ error: '無效的 activity_id' }), { status: 400 });
            }
            await db.prepare("UPDATE Activities SET is_read = 1 WHERE activity_id = ?").bind(activity_id).run();
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (request.method === 'DELETE') {
            await db.prepare("UPDATE Activities SET is_read = 1 WHERE is_read = 0").run();
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response('無效的請求方法', { status: 405 });
    } catch (error) {
        console.error('Error in activities API:', error);
        return new Response(JSON.stringify({ error: '處理動態消息時發生錯誤', details: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
