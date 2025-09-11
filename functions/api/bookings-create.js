// functions/api/bookings-create.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { 
        userId, bookingDate, timeSlot, numOfPeople, 
        bookingPreference, contactName, contactPhone 
    } = await context.request.json();
    
    if (!userId || !bookingDate || !timeSlot || !numOfPeople || numOfPeople <= 0 || !contactName || !contactPhone) {
      return new Response(JSON.stringify({ error: '所有預約欄位皆為必填。' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const TOTAL_TABLES = 5;
    const PEOPLE_PER_TABLE = 4;
    const tablesNeeded = Math.ceil(numOfPeople / PEOPLE_PER_TABLE);

    const db = context.env.DB;

    const checkStmt = db.prepare(
      "SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND time_slot = ? AND status = 'confirmed'"
    );
    const currentBooking = await checkStmt.bind(bookingDate, timeSlot).first();
    const tablesAlreadyBooked = currentBooking.total_tables_booked || 0;

    if ((tablesAlreadyBooked + tablesNeeded) > TOTAL_TABLES) {
      return new Response(JSON.stringify({ error: `該時段座位不足，僅剩 ${TOTAL_TABLES - tablesAlreadyBooked} 桌。` }), {
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ** 關鍵修正：調整 INSERT 語句中的欄位順序以匹配新的資料表結構 **
    const insertStmt = db.prepare(
      'INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied, booking_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    await insertStmt.bind(
        userId, contactName, contactPhone, 
        bookingDate, timeSlot, numOfPeople, tablesNeeded, 
        bookingPreference
    ).run();

    const message = `🎉 預約成功！\n\n` +
                    `姓名：${contactName}\n` +
                    `電話：${contactPhone}\n` +
                    `日期：${bookingDate}\n` +
                    `時段：${timeSlot}\n` +
                    `人數：${numOfPeople} 人\n\n` +
                    `感謝您的預約，我們到時見！`;

    return new Response(JSON.stringify({ 
        success: true, 
        message: '預約成功！',
        confirmationMessage: message
    }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立預約失敗。' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}