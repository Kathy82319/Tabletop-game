// functions/api/my-rental-history.js
export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId');
    const filter = url.searchParams.get('filter') || 'current'; // 預設為 'current'

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;

    // ** 步驟 1: 獲取該使用者的所有租借紀錄 **
    const stmt = db.prepare(`
      SELECT
        r.rental_id, r.user_id, r.game_id, r.rental_date, r.due_date,
        r.return_date, r.deposit, r.status,
        b.name as game_name,
        b.image_url as game_image_url,
        b.late_fee_per_day
      FROM Rentals AS r
      LEFT JOIN BoardGames AS b ON r.game_id = b.game_id
      WHERE r.user_id = ?
      ORDER BY r.rental_date DESC
    `);

    let { results } = await stmt.bind(userId).all();

    if (!results) {
        return new Response(JSON.stringify([]), {
             status: 200, headers: { 'Content-Type': 'application/json' },
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ** 步驟 2: 為每一筆紀錄加上逾期計算 **
    const allProcessedRentals = results.map(rental => {
        const dueDate = new Date(rental.due_date);
        let overdue_days = 0;
        let calculated_late_fee = 0;

        if (rental.status === 'rented' && dueDate < today) {
            const diffTime = Math.abs(today - dueDate);
            overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            calculated_late_fee = overdue_days * (rental.late_fee_per_day || 50);
        }
        return { ...rental, overdue_days, calculated_late_fee };
    });

    // ** 步驟 3: 根據 filter 參數篩選出最終要回傳的結果 **
    let finalResults;
    if (filter === 'current') {
        // 目前紀錄 = 租借中 且 未逾期
        finalResults = allProcessedRentals.filter(r => r.status === 'rented' && r.overdue_days === 0);
    } else { // filter === 'past'
        // 過往紀錄 = 已歸還 或 已逾期
        finalResults = allProcessedRentals.filter(r => r.status === 'returned' || r.overdue_days > 0);
    }

    return new Response(JSON.stringify(finalResults), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in my-rental-history API:', error);
    return new Response(JSON.stringify({ error: '查詢個人租借紀錄失敗。' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}