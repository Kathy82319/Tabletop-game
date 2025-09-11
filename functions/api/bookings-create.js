// functions/api/bookings-create.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, bookingDate, timeSlot, numOfPeople, bookingPreference } = await context.request.json();
    
    if (!userId || !bookingDate || !timeSlot || !numOfPeople || numOfPeople <= 0) {
      return new Response(JSON.stringify({ error: '所有预约栏位皆为必填。' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ===== 店家设定 =====
    const TOTAL_TABLES = 5;
    const PEOPLE_PER_TABLE = 4;
    // ====================

    // 1. 根据人数计算需要占用的桌数
    const tablesNeeded = Math.ceil(numOfPeople / PEOPLE_PER_TABLE);

    const db = context.env.DB;

    // 2. 在写入前，再次进行一次“原子性”检查，查询该时段当前已预订的总桌数
    const checkStmt = db.prepare(
      "SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND time_slot = ? AND status = 'confirmed'"
    );
    const currentBooking = await checkStmt.bind(bookingDate, timeSlot).first();
    const tablesAlreadyBooked = currentBooking.total_tables_booked || 0;

    // 3. 检查加上本次预约後是否会超过总桌数
    if ((tablesAlreadyBooked + tablesNeeded) > TOTAL_TABLES) {
      return new Response(JSON.stringify({ error: `该时段座位不足，仅剩 ${TOTAL_TABLES - tablesAlreadyBooked} 桌。` }), {
        status: 409, // 409 Conflict
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 4. 插入新的预约纪录
    const insertStmt = db.prepare(
      'INSERT INTO Bookings (user_id, booking_date, time_slot, num_of_people, tables_occupied, booking_preference) VALUES (?, ?, ?, ?, ?, ?)'
    );
    await insertStmt.bind(userId, bookingDate, timeSlot, numOfPeople, tablesNeeded, bookingPreference || '未指定').run();

    return new Response(JSON.stringify({ success: true, message: '预约成功！' }), {
      status: 201, // 201 Created
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立预约失败。' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}