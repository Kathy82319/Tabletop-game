// functions/api/admin/get-all-rentals.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { request, env } = context;
    const db = env.DB;
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status'); // 獲取 URL 中的 status 參數

    // 基本查詢語句，使用 LEFT JOIN 來串連三個資料表
    let query = `
      SELECT 
        r.rental_id,
        r.rental_date,
        r.due_date,
        r.return_date,
        r.status,
        u.line_display_name,
        u.nickname,
        b.name as game_name
      FROM Rentals AS r
      LEFT JOIN Users AS u ON r.user_id = u.user_id
      LEFT JOIN BoardGames AS b ON r.game_id = b.game_id
    `;
    
    const queryParams = [];

    // 如果有 status 篩選條件，就加入 WHERE 子句
    if (statusFilter) {
        query += " WHERE r.status = ?";
        queryParams.push(statusFilter);
    }
    
    // 排序方式：優先顯示租借中，然後按預計歸還日排序
    query += `
      ORDER BY 
        CASE r.status
          WHEN 'rented' THEN 1
          WHEN 'returned' THEN 2
          ELSE 3
        END,
        r.due_date ASC
    `;
    
    const stmt = db.prepare(query).bind(...queryParams);
    const { results } = await stmt.all();

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