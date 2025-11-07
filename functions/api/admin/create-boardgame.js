// functions/api/admin/create-boardgame.js

// 【修正】移除舊的 generateGameId 相關程式碼

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const db = context.env.DB; // <-- 將 db 宣告移到前面

        // 這裡的驗證邏輯與 update-boardgame-details.js 類似
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return new Response(JSON.stringify({ error: '遊戲名稱為必填。' }), { status: 400 });
        }

        // --- 【▼▼▼ 核心修改：產生新的數字 ID ▼▼▼】 ---
        // 1. 查詢當前最大的 game_id (並確保轉換為整數比較)
        const maxIdResult = await db.prepare("SELECT MAX(CAST(game_id AS INTEGER)) as maxId FROM BoardGames").first();
        
        // 2. 新 ID = 最大 ID + 1。
        // 如果資料庫是空的 (maxId 為 null)，或者最大ID小於383，我們都從 384 開始
        let newGameId = 384;
        if (maxIdResult && maxIdResult.maxId && maxIdResult.maxId >= 383) {
            newGameId = maxIdResult.maxId + 1;
        }
        // --- 【▲▲▲ 核心修改結束 ▲▲▲】 ---

        const for_sale_stock = (Number(body.total_stock) || 0) - (Number(body.for_rent_stock) || 0);

        const stmt = db.prepare(
          `INSERT INTO BoardGames (
             game_id, name, description, image_url, image_url_2, image_url_3, tags,
             min_players, max_players, difficulty,
             total_stock, for_rent_stock, for_sale_stock,
             sale_price, rent_price, deposit, late_fee_per_day,
             is_visible, supplementary_info, display_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)`
        );

        await stmt.bind(
            newGameId, // <-- 使用新的數字 ID
            body.name, body.description || '', body.image_url || '', body.image_url_2 || '', body.image_url_3 || '', body.tags || '',
            Number(body.min_players) || 1, Number(body.max_players) || 4, body.difficulty || '普通',
            Number(body.total_stock) || 0, Number(body.for_rent_stock) || 0, for_sale_stock,
            Number(body.sale_price) || 0, Number(body.rent_price) || 0,
            Number(body.deposit) || 0, Number(body.late_fee_per_day) || 50,
            body.is_visible ? 1 : 0, body.supplementary_info || ''
        ).run();

        return new Response(JSON.stringify({ success: true, gameId: newGameId }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in create-boardgame API:', error);
        return new Response(JSON.stringify({ error: '建立遊戲失敗', details: error.message }), {
            status: 500,
        });
    }
}