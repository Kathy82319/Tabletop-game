// functions/api/get-store-info.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const db = context.env.DB;
    // 注意：不可用 SELECT *，booking_notify_user_id 是店家內部通知用的 LINE userId，不應公開給訪客
    const info = await db.prepare(
      `SELECT id, name, address, phone, opening_hours, description,
              booking_button_text, booking_promo_text, booking_announcement_text
       FROM StoreInfo WHERE id = 1`
    ).first();

    if (!info) {
      return new Response(JSON.stringify({ error: '找不到店家資訊。' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(info), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-store-info API:', error);
    return new Response(JSON.stringify({ error: '獲取店家資訊失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
