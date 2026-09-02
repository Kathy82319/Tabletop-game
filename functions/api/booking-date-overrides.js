// functions/api/booking-date-overrides.js
// 給顧客端（訂位頁、揪團發起頁）讀取的公休日／自訂營業時間清單，只回傳今天以後的例外日期。
export async function onRequest(context) {
    const { env } = context;

    try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const { results } = await env.DB.prepare(
            `SELECT date, is_closed, closed_label, open_time, close_time
             FROM BookingDateOverrides
             WHERE date >= ?
             ORDER BY date ASC`
        ).bind(todayStr).all();

        return Response.json(results || []);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
