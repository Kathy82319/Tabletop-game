// functions/api/update-booking-status.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { bookingId, status } = await context.request.json();

    // --- 【驗證區塊】 ---
    const errors = [];
    if (!bookingId || !Number.isInteger(bookingId)) {
        errors.push('無效的預約 ID。');
    }
    const allowedStatus = ['confirmed', 'checked-in', 'cancelled'];
    if (!status || !allowedStatus.includes(status)) {
        errors.push('無效的狀態值。');
    }

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }
    // --- 【驗證區塊結束】 ---

    const db = context.env.DB;
    
    const stmt = db.prepare('UPDATE Bookings SET status = ? WHERE booking_id = ?');
    const result = await stmt.bind(status, bookingId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到預約 ID: ${bookingId}，無法更新狀態。` }), {
        status: 404
      });
    }

    return new Response(JSON.stringify({ success: true, message: '成功更新預約狀態！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-booking-status API:', error);
    return new Response(JSON.stringify({ error: '更新預約狀態失敗。' }), {
      status: 500,
    });
  }
}