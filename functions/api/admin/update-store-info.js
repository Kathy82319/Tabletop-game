// functions/api/admin/update-store-info.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { address, phone, opening_hours, description } = await context.request.json();

    if (!address || !phone || !opening_hours || !description) {
      return new Response(JSON.stringify({ error: '所有欄位皆為必填。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    const stmt = db.prepare(
      'UPDATE StoreInfo SET address = ?, phone = ?, opening_hours = ?, description = ? WHERE id = 1'
    );
    await stmt.bind(address, phone, opening_hours, description).run();

    // 注意：店家資訊較少變動，此處暫不加入同步到 Google Sheet 的背景任務，若有需要可比照其他 API 加入。

    return new Response(JSON.stringify({ success: true, message: '成功更新店家資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-store-info API:', error);
    return new Response(JSON.stringify({ error: '更新店家資訊失敗。' }), {
      status: 500,
    });
  }
}