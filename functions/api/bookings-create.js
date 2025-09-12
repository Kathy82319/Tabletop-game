// functions/api/bookings-create.js

// 將上面 bookings-check.js 的 getDailyBookingLimit 整個輔助函式複製到這裡
async function getDailyBookingLimit(env, date) {
    // ... (與上面 bookings-check.js 中完全相同的 getDailyBookingLimit 函式)
}

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    const { userId, bookingDate, timeSlot, numOfPeople, contactName, contactPhone } = await context.request.json();
    if (!userId || !bookingDate || !timeSlot || !numOfPeople || numOfPeople <= 0 || !contactName || !contactPhone) {
      return new Response(JSON.stringify({ error: '所有預約欄位皆為必填。' }), { status: 400 });
    }
    
    const PEOPLE_PER_TABLE = 4;
    // ** 關鍵改動 1：計算本次預約需要的桌數 **
    const tablesNeeded = Math.ceil(numOfPeople / PEOPLE_PER_TABLE);

    const db = context.env.DB;
    const dailyLimit = await getDailyBookingLimit(context.env, bookingDate);
    
    // ** 關鍵改動 2：檢查剩餘桌數是否足夠 **
    const checkStmt = db.prepare("SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND status = 'confirmed'");
    const currentBooking = await checkStmt.bind(bookingDate).first();
    const tablesAlreadyBooked = currentBooking.total_tables_booked || 0;

    if ((tablesAlreadyBooked + tablesNeeded) > dailyLimit) {
      return new Response(JSON.stringify({ error: `抱歉，${bookingDate} 當日剩餘桌數不足以容納您的預約。` }), { status: 409 });
    }
    
    // ** 關鍵改動 3：將計算出的桌數插入資料庫 **
    const insertStmt = db.prepare(
      'INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    await insertStmt.bind(userId, contactName, contactPhone, bookingDate, timeSlot, numOfPeople, tablesNeeded).run();

    const message = `🎉 預約成功！\n\n` + `姓名：${contactName}\n電話：${contactPhone}\n` + `日期：${bookingDate}\n時段：${timeSlot}\n` + `人數：${numOfPeople} 人 (預計 ${tablesNeeded} 桌)\n\n` + `感謝您的預約，我們到時見！`;

    return new Response(JSON.stringify({ success: true, message: '預約成功！', confirmationMessage: message }), { status: 201 });
  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立預約失敗。' }), { status: 500 });
  }
}