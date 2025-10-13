// functions/api/admin/update-rental-details.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const body = await context.request.json();
    const { rentalId, dueDate, lateFeeOverride } = body;

    // --- 【驗證區塊】 ---
    const errors = [];
    if (!rentalId || !Number.isInteger(rentalId)) {
        errors.push('缺少有效的租借 ID。');
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        errors.push('無效的歸還日期格式。');
    }
    const feeOverrideNum = Number(lateFeeOverride);
    if (lateFeeOverride !== undefined && lateFeeOverride !== null && lateFeeOverride !== '' && (isNaN(feeOverrideNum) || feeOverrideNum < 0)) {
        errors.push('手動覆寫金額必須是有效的非負數。');
    }

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }
    // --- 【驗證區塊結束】 ---

    const db = context.env.DB;
    const updates = [];
    const params = [];

    if (dueDate) {
        updates.push("due_date = ?");
        params.push(dueDate);
    }

    if (lateFeeOverride !== undefined) {
        updates.push("late_fee_override = ?");
        const valueToSet = (lateFeeOverride === '' || lateFeeOverride === null) ? null : feeOverrideNum;
        params.push(valueToSet);
    }

    if (updates.length === 0) {
        return new Response(JSON.stringify({ success: true, message: '沒有提供任何要更新的資料。' }), { status: 200 });
    }

    params.push(rentalId);

    const stmt = db.prepare(`UPDATE Rentals SET ${updates.join(', ')} WHERE rental_id = ?`);
    const result = await stmt.bind(...params).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到租借 ID: ${rentalId}，無法更新。` }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true, message: '成功更新租借資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-rental-details API:', error);
    return new Response(JSON.stringify({ error: '更新租借資訊失敗。' }), { status: 500 });
  }
}