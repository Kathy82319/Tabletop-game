// functions/api/admin/update-rental-details.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { rentalId, dueDate, lateFeePaid } = await context.request.json();

    if (!rentalId) {
      return new Response(JSON.stringify({ error: '缺少租借 ID。' }), { status: 400 });
    }

    const db = context.env.DB;

    // 準備要更新的欄位
    const updates = [];
    const params = [];

    if (dueDate) {
        updates.push("due_date = ?");
        params.push(dueDate);
    }
    if (lateFeePaid !== undefined && lateFeePaid !== null) {
        updates.push("late_fee_paid = ?");
        params.push(Number(lateFeePaid));
    }

    if (updates.length === 0) {
        return new Response(JSON.stringify({ error: '沒有提供任何要更新的資料。' }), { status: 400 });
    }

    params.push(rentalId); // 最後一個參數是 WHERE 條件用的 ID

    const stmt = db.prepare(`UPDATE Rentals SET ${updates.join(', ')} WHERE rental_id = ?`);
    const result = await stmt.bind(...params).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到租借 ID: ${rentalId}，無法更新。` }), { status: 404 });
    }

    // 您也可以在此處加入背景同步到 Google Sheet 的邏輯

    return new Response(JSON.stringify({ success: true, message: '成功更新租借資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-rental-details API:', error);
    return new Response(JSON.stringify({ error: '更新租借資訊失敗。' }), { status: 500 });
  }
}