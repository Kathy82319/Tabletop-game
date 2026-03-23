// functions/api/admin/game-assets.js
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        // GET: 獲取所有資源設定
        if (request.method === 'GET') {
            // 由於原先的語法中含有 display_order，我們保留它
            const { results } = await db.prepare("SELECT * FROM GameAssets ORDER BY type, display_order, id").all();
            return new Response(JSON.stringify(results || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // POST: 新增或更新資源
        if (request.method === 'POST') {
            // 【修改】解構出 icon_url
            const { id, type, name, description, icon_url } = await request.json();
            
            if (!type || !name) {
                return new Response(JSON.stringify({ error: '類型與名稱為必填' }), { status: 400 });
            }

            if (id) {
                // 【修改】更新時包含 icon_url
                await db.prepare("UPDATE GameAssets SET type = ?, name = ?, description = ?, icon_url = ? WHERE id = ?")
                        .bind(type, name, description || '', icon_url || null, id).run();
            } else {
                // 【修改】新增時包含 icon_url
                await db.prepare("INSERT INTO GameAssets (type, name, description, icon_url) VALUES (?, ?, ?, ?)")
                        .bind(type, name, description || '', icon_url || null).run();
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