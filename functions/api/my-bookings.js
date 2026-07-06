// functions/api/my-bookings.js
import { verifyLiffUser } from './_lib/auth.js';

export async function onRequest(context) {
  try {
    const profile = await verifyLiffUser(context.request);
    if (!profile) {
      return new Response(JSON.stringify({ error: '未登入或驗證失敗。' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = profile.userId;

    const url = new URL(context.request.url);
    const filter = url.searchParams.get('filter') || 'current'; // 預設為 'current'

    const db = context.env.DB;
    
    const condition = filter === 'current' 
      ? "booking_date >= date('now', 'localtime') AND status = 'confirmed'" 
      : "booking_date < date('now', 'localtime') OR status IN ('checked-in', 'cancelled')";
    
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
       AND (${condition})
       ORDER BY booking_date DESC, time_slot DESC`
    );
    const { results } = await stmt.bind(userId).all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in my-bookings API:', error);
    return new Response(JSON.stringify({ error: '查詢個人預約紀錄失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
