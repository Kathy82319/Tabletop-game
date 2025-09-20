// functions/api/admin/update-rental-details.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // 【修改】只接收 rentalId 和 dueDate
    const { rentalId, dueDate } = await context.request.json();

    if (!rentalId || !dueDate) {
      return new Response(JSON.stringify({ error: '缺少租借 ID 或應還日期。' }), { status: 400 });
    }

    const db = context.env.DB;

    const stmt = db.prepare(`UPDATE Rentals SET due_date = ? WHERE rental_id = ?`);
    const result = await stmt.bind(dueDate, rentalId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到租借 ID: ${rentalId}，無法更新。` }), { status: 404 });
    }
    // 【新增】觸發背景同步任務，更新 Google Sheet
    const dataToSync = { due_date: dueDate };
    context.waitUntil(
        updateRowInSheet(context.env, 'Rentals', 'rental_id', rentalId, dataToSync)
        .catch(err => console.error("背景同步應還日期失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '成功更新應還日期！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    return new Response(JSON.stringify({ success: true, message: '成功更新應還日期！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-rental-details API:', error);
    return new Response(JSON.stringify({ error: '更新租借資訊失敗。' }), { status: 500 });
  }
}