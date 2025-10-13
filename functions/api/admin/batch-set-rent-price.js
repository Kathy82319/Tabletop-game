// functions/api/admin/batch-set-rent-price.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { gameIds, rentPrice } = await context.request.json();
    const priceNum = Number(rentPrice);

    if (!Array.isArray(gameIds) || gameIds.length === 0 || isNaN(priceNum) || priceNum < 0) {
      return new Response(JSON.stringify({ error: '缺少有效參數，或租金不是一個有效的非負數。' }), { status: 400 });
    }

    const db = context.env.DB;

    const stmt = db.prepare('UPDATE BoardGames SET rent_price = ? WHERE game_id = ?');
    const operations = gameIds.map(gameId => stmt.bind(priceNum, gameId));

    await db.batch(operations);

    return new Response(JSON.stringify({ success: true, message: `成功更新 ${gameIds.length} 個項目的租金` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch-set-rent-price API:', error);
    return new Response(JSON.stringify({ error: '批次設定租金失敗', details: error.message }), { status: 500 });
  }
}