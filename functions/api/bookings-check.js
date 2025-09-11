// functions/api/bookings-check.js

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');

    if (!date) {
      return new Response(JSON.stringify({ error: '缺少日期参数。' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // ===== 店家设定 =====
    const TOTAL_TABLES = 5;
    // ====================

    const db = context.env.DB;
    // 查询指定日期所有已确认预约，并按时段分组，加总每个时段已占用的桌数
    const stmt = db.prepare(
      `SELECT time_slot, SUM(tables_occupied) as total_tables_booked 
       FROM Bookings 
       WHERE booking_date = ? AND status = 'confirmed' 
       GROUP BY time_slot`
    );
    const { results } = await stmt.bind(date).all();

    // 将查询结果转换成一个方便前端使用的物件
    // 例如：{ "14:00-16:00": 3, "18:00-20:00": 5 }
    const bookedTablesBySlot = {};
    if (results) {
      results.forEach(row => {
        bookedTablesBySlot[row.time_slot] = row.total_tables_booked;
      });
    }

    return new Response(JSON.stringify(bookedTablesBySlot), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in bookings-check API:', error);
    return new Response(JSON.stringify({ error: '查询预约状况失败。' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}