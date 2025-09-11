// functions/api/bookings-check.js

export async function onRequest(context) {
  try {
    // 從請求的 URL 中獲取日期參數，例如 /api/bookings-check?date=2025-09-12
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');

    if (!date) {
      return new Response(JSON.stringify({ error: '缺少日期參數。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    // 查詢指定日期且狀態為 'confirmed' 的所有預約紀錄
    const stmt = db.prepare(
      "SELECT time_slot, table_number FROM Bookings WHERE booking_date = ? AND status = 'confirmed'"
    );
    const { results } = await stmt.bind(date).all();

    // 回傳查詢結果給前端
    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bookings-check API:', error);
    return new Response(JSON.stringify({ error: '查詢預約狀況失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}