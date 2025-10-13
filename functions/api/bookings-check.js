// functions/api/bookings-check.js

async function getEnabledDates(db) {
    try {
        const { results } = await db.prepare("SELECT disabled_date FROM BookingSettings").all();
        return results.map(row => row.disabled_date);
    } catch (error) {
        console.error("讀取可預約日期失敗:", error);
        return [];
    }
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const db = context.env.DB;
    const DEFAULT_LIMIT = 4; // **核心修改：直接定義預設上限**

    if (url.searchParams.has('month-init')) {
        const enabledDates = await getEnabledDates(db);
        return new Response(JSON.stringify({ enabledDates }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (!date) {
      return new Response(JSON.stringify({ error: '缺少日期參數。' }), { status: 400 });
    }
    
    const stmt = db.prepare(
      "SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND (status = 'confirmed' OR status = 'checked-in')"
    );
    const result = await stmt.bind(date).first();
    const tablesBooked = result ? (result.total_tables_booked || 0) : 0;
    const tablesAvailable = DEFAULT_LIMIT - tablesBooked;
    
    return new Response(JSON.stringify({
        date: date,
        limit: DEFAULT_LIMIT,
        booked: tablesBooked,
        available: tablesAvailable > 0 ? tablesAvailable : 0
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in bookings-check API:', error);
    return new Response(JSON.stringify({ error: '查詢預約狀況失敗。' }), { status: 500 });
  }
}