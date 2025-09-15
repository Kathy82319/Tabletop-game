// functions/api/my-rental-history.js
export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    // 使用 LEFT JOIN 來同時獲取遊戲名稱
    const stmt = db.prepare(`
      SELECT 
        r.*,
        b.name as game_name,
        b.image_url as game_image_url
      FROM Rentals AS r
      LEFT JOIN BoardGames AS b ON r.game_id = b.game_id
      WHERE r.user_id = ?
      ORDER BY r.rental_date DESC
    `);
    
    const { results } = await stmt.bind(userId).all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in my-rental-history API:', error);
    return new Response(JSON.stringify({ error: '查詢租借紀錄失敗。' }), {
      status: 500,
    });
  }
}