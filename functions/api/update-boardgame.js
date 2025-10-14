// functions/api/update-boardgame.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { gameId, total_stock, is_visible, rental_type } = await context.request.json();

    if (!gameId) {
      return new Response(JSON.stringify({ error: '缺少遊戲 ID。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    const stmt = db.prepare(
      'UPDATE BoardGames SET total_stock = ?, is_visible = ?, rental_type = ? WHERE game_id = ?'
    );
    const result = await stmt.bind(total_stock, is_visible, rental_type, gameId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${gameId}，無法更新。` }), {
        status: 404
      });
    }

    return new Response(JSON.stringify({ success: true, message: '成功更新桌遊資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-boardgame API:', error);
    return new Response(JSON.stringify({ error: '更新桌遊資訊失敗。' }), {
      status: 500,
    });
  }
}