// functions/api/get-bookings.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const db = context.env.DB;
    
    // 查詢 D1 的 Bookings 資料表
    // 條件：預約日期大於等於今天，且狀態為 'confirmed'
    // 排序：按預約日期和時段升序排列
    const stmt = db.prepare(
      `SELECT * FROM Bookings 
       WHERE booking_date >= date('now', 'localtime') AND status = 'confirmed'
       ORDER BY booking_date ASC, time_slot ASC`
    );
    const { results } = await stmt.all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-bookings API:', error);
    return new Response(JSON.stringify({ error: '獲取預約列表失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}