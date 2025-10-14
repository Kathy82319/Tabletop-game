// functions/api/admin/batch-update-games.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { gameIds, isVisible } = await context.request.json();

    if (!Array.isArray(gameIds) || gameIds.length === 0 || typeof isVisible !== 'boolean') {
      return new Response(JSON.stringify({ error: '缺少必要的參數或格式不正確' }), { status: 400 });
    }

    const db = context.env.DB;

    const stmt = db.prepare('UPDATE BoardGames SET is_visible = ? WHERE game_id = ?');
    const operations = gameIds.map(gameId => stmt.bind(isVisible ? 1 : 0, gameId));

    await db.batch(operations);

    return new Response(JSON.stringify({ success: true, message: `成功更新 ${gameIds.length} 個項目` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-update-games API:', error);
    return new Response(JSON.stringify({ error: '批次更新狀態失敗', details: error.message }), { status: 500 });
  }
}