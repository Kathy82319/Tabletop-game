// functions/api/admin/create-boardgame.js

// 【修正】移除舊的 generateGameId 相關程式碼

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const db = context.env.DB; // <-- 將 db 宣告移到前面

        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return new Response(JSON.stringify({ error: '遊戲名稱為必填。' }), { status: 400 });
        }

        const maxIdResult = await db.prepare("SELECT MAX(CAST(game_id AS INTEGER)) as maxId FROM BoardGames").first();
        
        let newGameId = 384;
        if (maxIdResult && maxIdResult.maxId && maxIdResult.maxId >= 383) {
            newGameId = maxIdResult.maxId + 1;
        }

        const total_stock = Number(body.total_stock) || 0;
        const for_rent_stock = Number(body.for_rent_stock) || 0;
        const for_sale_stock = Number(body.for_sale_stock) || 0;

        if (for_sale_stock + for_rent_stock > total_stock) {
            return new Response(JSON.stringify({ error: `販售庫存 + 租借庫存不可超過總庫存。` }), { status: 400 });
        }

        const is_visible = total_stock > 0 ? 1 : 0;

        const stmt = db.prepare(
          `INSERT INTO BoardGames (
             game_id, name, description, image_url, image_url_2, image_url_3, tags,
             min_players, max_players, difficulty, play_time,
             total_stock, for_rent_stock, for_sale_stock,
             sale_price, rent_price, deposit, late_fee_per_day,
             is_visible, supplementary_info, display_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)`
        );

        await stmt.bind(
            newGameId,
            body.name, body.description || '', body.image_url || '', body.image_url_2 || '', body.image_url_3 || '', body.tags || '',
            Number(body.min_players) || 1, Number(body.max_players) || 4, body.difficulty || '普通',
            body.play_time || '30~90分鐘',
            total_stock, for_rent_stock, for_sale_stock,
            Number(body.sale_price) || 0, Number(body.rent_price) || 0,
            Number(body.deposit) || 0, Number(body.late_fee_per_day) || 50,
            is_visible, body.supplementary_info || ''
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
