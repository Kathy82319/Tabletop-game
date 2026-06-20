// functions/api/admin/game-assets.js
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const { results } = await db.prepare("SELECT * FROM GameAssets ORDER BY type, display_order, id").all();
            return new Response(JSON.stringify(results || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
            const { id, type, name, description, icon_url } = await request.json();
            
            if (!type || !name) {
                return new Response(JSON.stringify({ error: '類型與名稱為必填' }), { status: 400 });
            }

            if (id) {
                await db.prepare("UPDATE GameAssets SET type = ?, name = ?, description = ?, icon_url = ? WHERE id = ?")
                        .bind(type, name, description || '', icon_url || null, id).run();
            } else {
                await db.prepare("INSERT INTO GameAssets (type, name, description, icon_url) VALUES (?, ?, ?, ?)")
                        .bind(type, name, description || '', icon_url || null).run();
            }
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (request.method === 'DELETE') {
            const { id } = await request.json();
            await db.prepare("DELETE FROM GameAssets WHERE id = ?").bind(id).run();
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
