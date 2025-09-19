// functions/api/my-bookings.js

export async function onRequest(context) {
  try {
    // 從請求的 URL 中獲取 userId 參數，例如 /api/my-bookings?userId=U123...
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID 參數。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // 查詢該使用者所有「預約日期」大於或等於「今天」的預約
    // 並按照預約日期排序
    const stmt = db.prepare(
      `SELECT *, 
        CASE 
          WHEN status = 'confirmed' THEN '預約成功'
          WHEN status = 'checked-in' THEN '已報到'
          WHEN status = 'cancelled' THEN '已取消'
          ELSE '處理中'
        END as status_text
       FROM Bookings 
       WHERE user_id = ? 
       AND booking_date >= date('now', 'localtime')
       ORDER BY booking_date ASC, time_slot ASC`
    );
    const { results } = await stmt.bind(userId).all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error)
  {
    console.error('Error in my-bookings API:', error);
    return new Response(JSON.stringify({ error: '查詢個人預約紀錄失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}