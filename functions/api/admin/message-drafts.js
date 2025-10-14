// functions/api/admin/message-drafts.js

export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const { results } = await db.prepare("SELECT * FROM MessageDrafts ORDER BY created_at DESC").all();
            return new Response(JSON.stringify(results || []), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        if (request.method === 'POST') {
            const { title, content } = await request.json();
            if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
                return new Response(JSON.stringify({ error: '標題為必填，且長度不可超過 100 字。' }), { status: 400 });
            }
            if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 1000) {
                return new Response(JSON.stringify({ error: '內容為必填，且長度不可超過 1000 字。' }), { status: 400 });
            }

            const result = await db.prepare("INSERT INTO MessageDrafts (title, content) VALUES (?, ?) RETURNING *")
                                   .bind(title, content).first();

            return new Response(JSON.stringify(result), { status: 201 });
        }

        if (request.method === 'PUT') {
            const { draft_id, title, content } = await request.json();
            if (!draft_id || !Number.isInteger(draft_id)) {
                 return new Response(JSON.stringify({ error: '無效的草稿 ID。' }), { status: 400 });
            }
            if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
                return new Response(JSON.stringify({ error: '標題為必填，且長度不可超過 100 字。' }), { status: 400 });
            }
            if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 1000) {
                return new Response(JSON.stringify({ error: '內容為必填，且長度不可超過 1000 字。' }), { status: 400 });
            }

            await db.prepare("UPDATE MessageDrafts SET title = ?, content = ? WHERE draft_id = ?")
                    .bind(title, content, draft_id).run();

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        if (request.method === 'DELETE') {
            const { draft_id } = await request.json();
            if (!draft_id || !Number.isInteger(draft_id)) {
                return new Response(JSON.stringify({ error: '缺少有效的草稿 ID。' }), { status: 400 });
            }

            await db.prepare("DELETE FROM MessageDrafts WHERE draft_id = ?").bind(draft_id).run();

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response('無效的請求方法。', { status: 405 });

    } catch (error) {
        console.error('訊息草稿 API 錯誤:', error);
        return new Response(JSON.stringify({ error: '處理草稿時發生錯誤。', details: error.message }), { status: 500 });
    }
}