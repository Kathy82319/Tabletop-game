// functions/api/admin/update-boardgame-details.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    
    const body = await context.request.json();
    
    const errors = [];
    if (!body.gameId) errors.push('缺少遊戲 ID。');
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
        errors.push('遊戲名稱為必填，且長度不可超過 100 字。');
    }

    const numberFields = {
        min_players: { min: 1, max: 100 }, max_players: { min: 1, max: 100 },
        total_stock: { min: 0, max: 999 }, for_sale_stock: { min: 0, max: 999 }, for_rent_stock: { min: 0, max: 999 },
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

    const allowedDifficulties = ['簡單', '普通', '困難', '專家'];
    if (!allowedDifficulties.includes(body.difficulty)) {
        errors.push('無效的難度設定。');
    }

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }
  
    const db = context.env.DB;

    // body.helpCardImages 為幫助卡圖片網址陣列，存成逗號分隔字串
    const helpCardImages = Array.isArray(body.helpCardImages)
        ? body.helpCardImages.map(u => String(u || '').trim()).filter(Boolean).join(',')
        : '';

    // body.barcodes 為條碼陣列（第一筆為主要條碼），也相容舊的單一 body.barcode
    const rawBarcodes = Array.isArray(body.barcodes) ? body.barcodes : (body.barcode ? [body.barcode] : []);
    const barcodes = [...new Set(rawBarcodes.map(b => String(b || '').trim()).filter(Boolean))];
    const primaryBarcode = barcodes[0] || null;
    const extraBarcodes = barcodes.slice(1);

    if (barcodes.length > 0) {
        const placeholders = barcodes.map(() => '?').join(',');
        const dupMain = await db.prepare(
            `SELECT game_id FROM BoardGames WHERE barcode IN (${placeholders}) AND game_id != ?`
        ).bind(...barcodes, body.gameId).first();
        if (dupMain) {
            return new Response(JSON.stringify({ error: `條碼已被「${dupMain.game_id}」使用，請確認條碼是否重複。` }), { status: 400 });
        }
        const dupExtra = await db.prepare(
            `SELECT game_id FROM BoardGameBarcodes WHERE barcode IN (${placeholders}) AND game_id != ?`
        ).bind(...barcodes, body.gameId).first();
        if (dupExtra) {
            return new Response(JSON.stringify({ error: `條碼已被「${dupExtra.game_id}」使用，請確認條碼是否重複。` }), { status: 400 });
        }
    }

    const stmt = db.prepare(
      `UPDATE BoardGames SET
         name = ?, barcode = ?, description = ?, image_url = ?, image_url_2 = ?, image_url_3 = ?, tags = ?,
         min_players = ?, max_players = ?, difficulty = ?, play_time = ?,
         total_stock = ?, for_rent_stock = ?, for_sale_stock = ?,
         sale_price = ?, rent_price = ?, deposit = ?, late_fee_per_day = ?,
         is_visible = ?, supplementary_info = ?, help_card_images = ?
       WHERE game_id = ?`
    );
    const is_visible = Number(body.total_stock) > 0 ? 1 : 0;

    const result = await stmt.bind(
        body.name, primaryBarcode, body.description || '', body.image_url || '', body.image_url_2 || '', body.image_url_3 || '', body.tags || '',
        Number(body.min_players), Number(body.max_players), body.difficulty,
        body.play_time || '30~90分鐘',
        Number(body.total_stock), Number(body.for_rent_stock), Number(body.for_sale_stock) || 0,
        Number(body.sale_price), Number(body.rent_price),
        Number(body.deposit), Number(body.late_fee_per_day),
        is_visible, body.supplementary_info || '', helpCardImages,
        body.gameId
    ).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${body.gameId}，無法更新。` }), { status: 404 });
    }

    const barcodeSyncOps = [db.prepare('DELETE FROM BoardGameBarcodes WHERE game_id = ?').bind(body.gameId)];
    extraBarcodes.forEach(b => {
        barcodeSyncOps.push(db.prepare('INSERT INTO BoardGameBarcodes (game_id, barcode) VALUES (?, ?)').bind(body.gameId, b));
    });
    await db.batch(barcodeSyncOps);

    // body.scoreCategories 為計分欄位名稱陣列；有內容代表這款遊戲有專屬計分表格，空陣列/未提供代表沿用預設 +/- 計分
    const scoreCategories = Array.isArray(body.scoreCategories)
        ? body.scoreCategories.map(c => String(c || '').trim()).filter(Boolean)
        : [];
    if (scoreCategories.length > 0) {
        await db.prepare(
            'INSERT OR REPLACE INTO ScoreTemplates (game_id, categories) VALUES (?, ?)'
        ).bind(body.gameId, JSON.stringify(scoreCategories)).run();
    } else {
        await db.prepare('DELETE FROM ScoreTemplates WHERE game_id = ?').bind(body.gameId).run();
    }

    return new Response(JSON.stringify({ success: true, message: '成功更新桌遊詳細資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-boardgame-details API:', error);
    return new Response(JSON.stringify({ error: '更新桌遊資訊失敗。' }), { status: 500 });
  }
}
