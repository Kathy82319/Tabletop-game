// functions/api/admin/update-boardgame-details.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    
    const body = await context.request.json();
    
    // --- 【驗證區塊】 ---
    const errors = [];
    if (!body.gameId) errors.push('缺少遊戲 ID。');
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
        errors.push('遊戲名稱為必填，且長度不可超過 100 字。');
    }

    const numberFields = {
        min_players: { min: 1, max: 100 }, max_players: { min: 1, max: 100 },
        total_stock: { min: 0, max: 999 }, for_rent_stock: { min: 0, max: 999 },
        sale_price: { min: 0, max: 99999 }, rent_price: { min: 0, max: 99999 },
        deposit: { min: 0, max: 99999 }, late_fee_per_day: { min: 0, max: 9999 }
    };

    for (const field in numberFields) {
        const value = Number(body[field]);
        const limits = numberFields[field];
        if (isNaN(value) || !Number.isInteger(value) || value < limits.min || value > limits.max) {
            errors.push(`欄位 ${field} 必須是 ${limits.min} 到 ${limits.max} 之間的整數。`);
        }
    }
    
    if (Number(body.for_rent_stock) > Number(body.total_stock)) {
        errors.push('可租借庫存不能大於總庫存。');
    }
    
    const allowedDifficulties = ['簡單', '普通', '困難', '專家'];
    if (!allowedDifficulties.includes(body.difficulty)) {
        errors.push('無效的難度設定。');
    }

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }
    // --- 【驗證區塊結束】 ---
  
    const db = context.env.DB;
    
    const stmt = db.prepare(
      `UPDATE BoardGames SET
         name = ?, description = ?, image_url = ?, image_url_2 = ?, image_url_3 = ?, tags = ?,
         min_players = ?, max_players = ?, difficulty = ?,
         total_stock = ?, for_rent_stock = ?, for_sale_stock = ?,
         sale_price = ?, rent_price = ?, deposit = ?, late_fee_per_day = ?,
         is_visible = ?, supplementary_info = ?
       WHERE game_id = ?`
    );
    const for_sale_stock = (Number(body.total_stock) || 0) - (Number(body.for_rent_stock) || 0);

    const result = await stmt.bind(
        body.name, body.description || '', body.image_url || '', body.image_url_2 || '', body.image_url_3 || '', body.tags || '',
        Number(body.min_players), Number(body.max_players), body.difficulty,
        Number(body.total_stock), Number(body.for_rent_stock), for_sale_stock,
        Number(body.sale_price), Number(body.rent_price),
        Number(body.deposit), Number(body.late_fee_per_day),
        body.is_visible ? 1 : 0, body.supplementary_info || '',
        body.gameId
    ).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${body.gameId}，無法更新。` }), { status: 404 });
    }
    
    return new Response(JSON.stringify({ success: true, message: '成功更新桌遊詳細資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-boardgame-details API:', error);
    return new Response(JSON.stringify({ error: '更新桌遊資訊失敗。', details: error.message }), { status: 500 });
  }
}