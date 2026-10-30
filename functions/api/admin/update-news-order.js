// functions/api/admin/update-news-order.js
// 情報拖曳排序：只有勾選「置頂顯示」的情報才會真的被拉到客人端最前面，
// 這裡存的 pin_order 是「多筆置頂時彼此的前後順序」，跟桌遊庫存的拖曳排序走同一套做法。
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { orderedNewsIds } = await context.request.json();

    if (!Array.isArray(orderedNewsIds)) {
      return new Response(JSON.stringify({ error: '無效的資料格式，需要一個 ID 陣列。' }), { status: 400 });
    }

    const db = context.env.DB;

    const operations = orderedNewsIds.map((newsId, index) => {
      const newOrder = index + 1;
      return db.prepare('UPDATE News SET pin_order = ? WHERE id = ?')
               .bind(newOrder, newsId);
    });

    await db.batch(operations);

    return new Response(JSON.stringify({ success: true, message: '成功更新情報順序！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-news-order API:', error);
    return new Response(JSON.stringify({ error: '更新順序失敗。' }), {
      status: 500,
    });
  }
}
