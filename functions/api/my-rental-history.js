// functions/api/my-rental-history.js
export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;

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
      ORDER BY CASE r.status WHEN 'rented' THEN 1 ELSE 2 END, r.rental_date DESC
    `);

    const { results } = await stmt.bind(userId).all();

    // 【關鍵修正】確保即使 results 是 null 或 undefined 也不會出錯
    if (!results) {
        return new Response(JSON.stringify([]), {
             status: 200, headers: { 'Content-Type': 'application/json' },
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 使用 .map 產生一個包含計算結果的"新"陣列
    const processedResults = results.map(rental => {
        const dueDate = new Date(rental.due_date);
        let overdue_days = 0;
        let calculated_late_fee = 0;

        if (rental.status === 'rented' && dueDate < today) {
            const diffTime = Math.abs(today - dueDate);
            overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            calculated_late_fee = overdue_days * (rental.late_fee_per_day || 50);
        }
        // 回傳一個包含原始資料和新計算欄位的新物件
        return { ...rental, overdue_days, calculated_late_fee };
    });

    return new Response(JSON.stringify(processedResults), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in my-rental-history API:', error);
    return new Response(JSON.stringify({ error: '查詢個人租借紀錄失敗。' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}