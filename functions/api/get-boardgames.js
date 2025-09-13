// functions/api/get-boardgames.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const db = context.env.DB;
    
    // 從 D1 的 BoardGames 資料表查詢所有遊戲資料
    const stmt = db.prepare(
      'SELECT game_id, name, total_stock, is_visible, rental_type FROM BoardGames ORDER BY game_id ASC'
    );
    const { results } = await stmt.all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-boardgames API:', error);
    return new Response(JSON.stringify({ error: '獲取桌遊列表失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}