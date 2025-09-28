// functions/api/get-bookings.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { request, env } = context;
    const db = env.DB;
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    let query = "SELECT * FROM Bookings";
    const queryParams = [];
    const conditions = [];

    if (statusFilter) {
        // 【核心修正】新增對 'all_upcoming' 的處理
        if (statusFilter === 'all_upcoming') {
            conditions.push("booking_date >= date('now', 'localtime')");
        } else if (statusFilter === 'today') {
            conditions.push("booking_date = date('now', 'localtime')");
            conditions.push("status IN ('confirmed', 'checked-in')");
        } else {
            conditions.push("status = ?");
            queryParams.push(statusFilter);
        }
    } else {
        // 預設情況（例如從 LIFF 前端直接呼叫時）保持不變
        conditions.push("booking_date >= date('now', 'localtime')");
        conditions.push("status = 'confirmed'");
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }
    
    query += " ORDER BY booking_date DESC, time_slot ASC";

    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-bookings API:', error);
    return new Response(JSON.stringify({ error: '獲取預約列表失敗。', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}