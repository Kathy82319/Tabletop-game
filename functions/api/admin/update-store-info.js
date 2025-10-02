// functions/api/admin/update-store-info.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const body = await context.request.json();
    // 【** 修改點 1: 重新命名欄位，並移除 booking_notice_text **】
    const { 
        address, phone, opening_hours, description,
        booking_announcement_text, booking_button_text, booking_promo_text 
    } = body;

    // --- 【驗證區塊】 ---
    const errors = [];
    if (!address || typeof address !== 'string' || address.trim().length === 0 || address.length > 200) {
        errors.push('地址為必填，且長度不可超過 200 字。');
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0 || phone.length > 50) {
        errors.push('電話為必填，且長度不可超過 50 字。');
    }
    if (!opening_hours || typeof opening_hours !== 'string' || opening_hours.trim().length === 0 || opening_hours.length > 500) {
        errors.push('營業時間為必填，且長度不可超過 500 字。');
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0 || description.length > 2000) {
        errors.push('公會介紹為必填，且長度不可超過 2000 字。');
    }
    // 【** 修改點 2: 更新驗證邏輯 **】
    if (!booking_announcement_text || booking_announcement_text.length > 500) errors.push('預約頁公告不可為空，且長度不可超過 500 字。');
    if (!booking_button_text || booking_button_text.length > 100) errors.push('預約按鈕文字不可為空，且長度不可超過 100 字。');
    if (!booking_promo_text || booking_promo_text.length > 200) errors.push('優惠文字不可為空，且長度不可超過 200 字。');


    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }
    // --- 【驗證區塊結束】 ---

    const db = context.env.DB;
    
    // 【** 修改點 3: 更新 SQL 指令 **】
    const stmt = db.prepare(
      `UPDATE StoreInfo SET 
         address = ?, phone = ?, opening_hours = ?, description = ?,
         booking_announcement_text = ?, booking_button_text = ?, booking_promo_text = ?
       WHERE id = 1`
    );
    // 注意：我們需要確保資料庫有這些新欄位，如果沒有，需要手動 ALTER TABLE
    // ALTER TABLE StoreInfo ADD COLUMN booking_announcement_text TEXT;
    // ALTER TABLE StoreInfo ADD COLUMN booking_button_text TEXT;
    await stmt.bind(
        address, phone, opening_hours, description,
        booking_announcement_text, booking_button_text, booking_promo_text
    ).run();

    return new Response(JSON.stringify({ success: true, message: '成功更新店家資訊！' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-store-info API:', error);
    return new Response(JSON.stringify({ error: '更新店家資訊失敗。' }), { status: 500 });
  }
}