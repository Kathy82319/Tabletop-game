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
      return new Response(JSON.stringify({ error: '缺少 user_id 參數。' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const userProfile = await db.prepare(
        `SELECT user_id, line_display_name, nickname, real_name, phone, email, 
       preferred_games, class, level, current_exp, tag, perk, notes, created_at,
       skill, skill_description, equipment
        FROM Users WHERE user_id = ?`
    ).bind(userId).first();

    if (!userProfile) {
        return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const bookingsStmt = db.prepare("SELECT * FROM Bookings WHERE user_id = ? ORDER BY booking_date DESC");
    const { results: bookingHistory } = await bookingsStmt.bind(userId).all();

    const rentalsStmt = db.prepare(`
        SELECT r.*, b.name as game_name, b.late_fee_per_day
        FROM Rentals AS r
        LEFT JOIN BoardGames as b ON r.game_id = b.game_id
        WHERE r.user_id = ?
        ORDER BY r.rental_date DESC
    `);
    let { results: rentalHistory } = await rentalsStmt.bind(userId).all();

    if (rentalHistory) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        rentalHistory = rentalHistory.map(rental => {
            const dueDate = new Date(rental.due_date);
            if (rental.status === 'rented' && dueDate < today) {
                return { ...rental, status: 'overdue' };
            }
            return rental;
        });
    }

    const expStmt = db.prepare("SELECT * FROM ExpHistory WHERE user_id = ? ORDER BY created_at DESC");
    const { results: expHistory } = await expStmt.bind(userId).all();

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
    return new Response(JSON.stringify({ error: '獲取使用者詳細資料失敗。', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}