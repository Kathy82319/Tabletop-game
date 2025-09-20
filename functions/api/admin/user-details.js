// functions/api/admin/user-details.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { request, env } = context;
    const db = env.DB;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少 user_id 參數。' }), { status: 400 });
    }

    // 1. 查詢使用者基本資料
    const userProfile = await db.prepare("SELECT * FROM Users WHERE user_id = ?").bind(userId).first();
    if (!userProfile) {
        return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}` }), { status: 404 });
    }

    // 2. 查詢該使用者的預約紀錄
    const bookingsStmt = db.prepare("SELECT * FROM Bookings WHERE user_id = ? ORDER BY booking_date DESC");
    const { results: bookingHistory } = await bookingsStmt.bind(userId).all();

    // 3. 查詢該使用者的租借紀錄 (並加入遊戲名稱)
    const rentalsStmt = db.prepare(`
        SELECT r.*, b.name as game_name 
        FROM Rentals AS r
        LEFT JOIN BoardGames as b ON r.game_id = b.game_id
        WHERE r.user_id = ? 
        ORDER BY r.rental_date DESC
    `);
    const { results: rentalHistory } = await rentalsStmt.bind(userId).all();

    // 4. 查詢該使用者的經驗值紀錄
    const expStmt = db.prepare("SELECT * FROM ExpHistory WHERE user_id = ? ORDER BY created_at DESC");
    const { results: expHistory } = await expStmt.bind(userId).all();

    // 組合所有資訊成一個物件
    const userDetails = {
      profile: userProfile,
      bookings: bookingHistory || [],
      rentals: rentalHistory || [],
      exp_history: expHistory || [],
    };

    return new Response(JSON.stringify(userDetails), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in user-details API:', error);
    return new Response(JSON.stringify({ error: '獲取使用者詳細資料失敗。', details: error.message }), {
      status: 500,
    });
  }
}