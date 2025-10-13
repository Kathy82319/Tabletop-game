// functions/api/admin/batch-delete-games.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { gameIds } = await context.request.json();

    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return new Response(JSON.stringify({ error: '缺少有效的遊戲 ID 列表。' }), { status: 400 });
    }

    const db = context.env.DB;

    const stmt = db.prepare('DELETE FROM BoardGames WHERE game_id = ?');
    const operations = gameIds.map(gameId => stmt.bind(gameId));

    await db.batch(operations);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `成功刪除 ${gameIds.length} 個項目。` 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-delete-games API:', error);
    return new Response(JSON.stringify({ error: '刪除遊戲時發生錯誤', details: error.message }), { status: 500 });
  }
}