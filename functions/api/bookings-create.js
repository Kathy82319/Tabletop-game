// functions/api/bookings-create.js
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
    const tablesNeeded = Math.ceil(numOfPeople / PEOPLE_PER_TABLE);
    const db = context.env.DB;
    
    const activityMessage = `收到新的預約: ${contactName} 預約了 ${bookingDate} ${timeSlot}，共 ${numOfPeople} 人。`;

    await db.batch([
        db.prepare('INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(userId, contactName, contactPhone, bookingDate, timeSlot, numOfPeople, tablesNeeded, 'confirmed'),
        // 【修正】確保 Activities 插入包含 is_read 欄位
        db.prepare('INSERT INTO Activities (message, is_read) VALUES (?, 0)').bind(activityMessage)
    ]);
    
    const message = `🎉 預約成功！\n\n` + `姓名：${contactName}\n電話：${contactPhone}\n` + `日期：${bookingDate}\n時段：${timeSlot}\n` + `人數：${numOfPeople} 人 \n\n` + `感謝您的預約，我們到時見！`;

    return new Response(JSON.stringify({ success: true, message: '預約成功！', confirmationMessage: message }), { status: 201 });
  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立預約失敗。', details: error.message }), { status: 500 });
  }
}