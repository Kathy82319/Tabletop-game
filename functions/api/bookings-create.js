// functions/api/bookings-create.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, bookingDate, timeSlot, tableNumber, numOfPeople } = await context.request.json();

    if (!userId || !bookingDate || !timeSlot || !tableNumber || !numOfPeople) {
      return new Response(JSON.stringify({ error: '所有預約欄位皆為必填。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;

    // 在新增前，再次檢查該時段該桌次是否已被預約，防止重複預約
    const checkStmt = db.prepare(
      "SELECT booking_id FROM Bookings WHERE booking_date = ? AND time_slot = ? AND table_number = ? AND status = 'confirmed'"
    );
    const existingBooking = await checkStmt.bind(bookingDate, timeSlot, tableNumber).first();

    if (existingBooking) {
      return new Response(JSON.stringify({ error: '這個時段已經被預約了，請選擇其他時段。' }), {
        status: 409, // 409 Conflict，表示資源衝突
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 插入新的預約紀錄
    const insertStmt = db.prepare(
      'INSERT INTO Bookings (user_id, booking_date, time_slot, table_number, num_of_people) VALUES (?, ?, ?, ?, ?)'
    );
    await insertStmt.bind(userId, bookingDate, timeSlot, tableNumber, numOfPeople).run();

    return new Response(JSON.stringify({ 
        success: true, 
        message: '預約成功！' 
    }), {
      status: 201, // 201 Created
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立預約失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}