// functions/api/admin/update-news.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { id, title, category, published_date, image_url, content, is_published } = await context.request.json();

    if (!id || !title || !category || !published_date) {
      return new Response(JSON.stringify({ error: 'ID、標題、分類和發布日期為必填。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    const stmt = db.prepare(
      'UPDATE News SET title = ?, category = ?, published_date = ?, image_url = ?, content = ?, is_published = ? WHERE id = ?'
    );
    const result = await stmt.bind(title, category, published_date, image_url || '', content || '', is_published ? 1 : 0, id).run();

    if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: `找不到 ID 為 ${id} 的情報。` }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true, message: '情報更新成功！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-news API:', error);
    return new Response(JSON.stringify({ error: '更新情報失敗。' }), { status: 500 });
  }
}