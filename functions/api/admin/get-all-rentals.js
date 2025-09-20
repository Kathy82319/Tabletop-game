// functions/api/admin/get-all-rentals.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { request, env } = context;
    const db = env.DB;
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    let query = `
      SELECT
        r.rental_id, r.rental_date, r.due_date, r.return_date, r.status,
        r.late_fee_per_day, r.late_fee_paid, -- 假設您已新增 late_fee_paid 欄位
        u.line_display_name, u.nickname,
        b.name as game_name
      FROM Rentals AS r
      LEFT JOIN Users AS u ON r.user_id = u.user_id
      LEFT JOIN BoardGames AS b ON r.game_id = b.game_id
    `;

    const queryParams = [];

    // ** 關鍵修改：將 'overdue' 作為一個特殊的篩選條件 **
    if (statusFilter && statusFilter !== 'overdue') {
        query += " WHERE r.status = ?";
        queryParams.push(statusFilter);
    }

    query += ` ORDER BY r.due_date ASC`;

    const stmt = db.prepare(query).bind(...queryParams);
    let { results } = await stmt.all();

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 將今天的時間設為午夜，方便比較

    // ** 關鍵修改：動態計算狀態 **
    results = results.map(rental => {
        const dueDate = new Date(rental.due_date);
        // 如果狀態是 'rented' 且應還日期早於今天，就視為 'overdue'
        if (rental.status === 'rented' && dueDate < today) {
            return { ...rental, derived_status: 'overdue' };
        }
        return { ...rental, derived_status: rental.status };
    });

    // 如果篩選 'overdue'，則在這裡過濾
    if (statusFilter === 'overdue') {
        results = results.filter(r => r.derived_status === 'overdue');
    }

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-all-rentals API:', error);
    return new Response(JSON.stringify({ error: '獲取所有租借紀錄失敗。', details: error.message }), {
      status: 500,
    });
  }
}