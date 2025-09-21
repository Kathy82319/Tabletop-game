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
        r.late_fee_override, -- 讀取新的覆寫欄位
        u.line_display_name, u.nickname,
        b.name as game_name,
        b.late_fee_per_day
      FROM Rentals AS r
      LEFT JOIN Users AS u ON r.user_id = u.user_id
      LEFT JOIN BoardGames AS b ON r.game_id = b.game_id
    `;

    const queryParams = [];
    if (statusFilter && statusFilter !== 'overdue') {
        query += " WHERE r.status = ?";
        queryParams.push(statusFilter);
    }
    query += ` ORDER BY r.due_date ASC`;

    const stmt = db.prepare(query).bind(...queryParams);
    let { results } = await stmt.all();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    results = results.map(rental => {
        const dueDate = new Date(rental.due_date);
        let derived_status = rental.status;
        let overdue_days = 0;
        let calculated_late_fee = 0;

        if (rental.status === 'rented' && dueDate < today) {
            derived_status = 'overdue';
            const diffTime = Math.abs(today - dueDate);
            overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        // 逾期金額計算邏輯
        if (rental.late_fee_override !== null && rental.late_fee_override !== undefined) {
            // 如果有手動覆寫的值，就直接使用它
            calculated_late_fee = rental.late_fee_override;
        } else if (overdue_days > 0) {
            // 否則，才進行自動計算
            calculated_late_fee = overdue_days * (rental.late_fee_per_day || 50);
        }

        return { ...rental, derived_status, overdue_days, calculated_late_fee };
    });

    if (statusFilter === 'overdue') {
        results = results.filter(r => r.derived_status === 'overdue');
    }

    return new Response(JSON.stringify(results || []), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-all-rentals API:', error);
    return new Response(JSON.stringify({ error: '獲取所有租借紀錄失敗。', details: error.message }), { status: 500 });
  }
}