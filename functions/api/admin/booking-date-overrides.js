// functions/api/admin/booking-date-overrides.js
// 公休日／自訂營業時間管理：預設每天都是正常營業（12:00–22:00），
// 只有在這裡設定「例外」的日期才會變成公休或自訂開店/關店時間，不用像舊版一樣每個月手動開放日期。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const { results } = await db.prepare(
                `SELECT date, is_closed, closed_label, open_time, close_time
                 FROM BookingDateOverrides
                 ORDER BY date ASC`
            ).all();
            return Response.json(results || []);
        }

        if (request.method === 'POST') {
            const { date, is_closed, closed_label, open_time, close_time } = await request.json();
            if (!date) return Response.json({ error: '缺少日期' }, { status: 400 });

            await db.prepare(
                `INSERT INTO BookingDateOverrides (date, is_closed, closed_label, open_time, close_time, updated_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(date) DO UPDATE SET
                    is_closed = excluded.is_closed,
                    closed_label = excluded.closed_label,
                    open_time = excluded.open_time,
                    close_time = excluded.close_time,
                    updated_at = CURRENT_TIMESTAMP`
            ).bind(
                date,
                is_closed ? 1 : 0,
                is_closed ? (closed_label || '公休') : null,
                (!is_closed && open_time) ? open_time : null,
                (!is_closed && close_time) ? close_time : null
            ).run();

            return Response.json({ success: true });
        }

        if (request.method === 'DELETE') {
            const { date } = await request.json();
            if (!date) return Response.json({ error: '缺少日期' }, { status: 400 });

            await db.prepare(`DELETE FROM BookingDateOverrides WHERE date = ?`).bind(date).run();
            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
