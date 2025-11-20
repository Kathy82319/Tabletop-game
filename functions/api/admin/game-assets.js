export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        // GET: 獲取所有資源設定
        if (request.method === 'GET') {
            const { results } = await db.prepare("SELECT * FROM GameAssets ORDER BY type, display_order, id").all();
            return new Response(JSON.stringify(results || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST: 新增或更新資源
        if (request.method === 'POST') {
            const { id, type, name, description } = await request.json();
            
            if (!type || !name) {
                return new Response(JSON.stringify({ error: '類型與名稱為必填' }), { status: 400 });
            }

            if (id) {
                // 更新
                await db.prepare("UPDATE GameAssets SET type = ?, name = ?, description = ? WHERE id = ?")
                        .bind(type, name, description || '', id).run();
            } else {
                // 新增
                await db.prepare("INSERT INTO GameAssets (type, name, description) VALUES (?, ?, ?)")
                        .bind(type, name, description || '').run();
            }
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        // DELETE: 刪除資源
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