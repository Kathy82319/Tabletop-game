// functions/api/admin/booking-settings.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    if (request.method === 'GET') {
      const { results } = await db.prepare("SELECT disabled_date FROM BookingSettings").all();
      const disabledDates = results.map(row => row.disabled_date);
      return new Response(JSON.stringify(disabledDates || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      const { date, action } = await request.json();
      if (!date || !action) {
        return new Response(JSON.stringify({ error: '缺少日期或操作類型。' }), { status: 400 });
      }

      if (action === 'add') {
        await db.prepare("INSERT OR IGNORE INTO BookingSettings (disabled_date) VALUES (?)").bind(date).run();
      } else if (action === 'remove') {
        await db.prepare("DELETE FROM BookingSettings WHERE disabled_date = ?").bind(date).run();
      } else {
        return new Response(JSON.stringify({ error: '無效的操作類型。' }), { status: 400 });
      }
      
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response('Invalid request method.', { status: 405 });

  } catch (error) {
    console.error('Error in booking-settings API:', error);
    return new Response(JSON.stringify({ error: '更新預約設定失敗。' }), { status: 500 });
  }
}