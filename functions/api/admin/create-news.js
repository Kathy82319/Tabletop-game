// functions/api/admin/create-news.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { title, category, published_date, image_url, content, is_published } = await context.request.json();

    if (!title || !category || !published_date) {
      return new Response(JSON.stringify({ error: '標題、分類和發布日期為必填欄位。' }), {
        status: 400,
      });
    }

    const db = context.env.DB;
    
    const stmt = db.prepare(
      'INSERT INTO News (title, category, published_date, image_url, content, is_published) VALUES (?, ?, ?, ?, ?, ?)'
    );
    await stmt.bind(title, category, published_date, image_url || '', content || '', is_published ? 1 : 0).run();

    // 此處亦可加入同步到 Google Sheet 的背景任務
    
    return new Response(JSON.stringify({ success: true, message: '情報新增成功！' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-news API:', error);
    return new Response(JSON.stringify({ error: '新增情報失敗。' }), { status: 500 });
  }
}