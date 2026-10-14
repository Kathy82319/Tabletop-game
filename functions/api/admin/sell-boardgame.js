// functions/api/admin/sell-boardgame.js
export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const gameId = Number(body.gameId);
        const quantity = Number(body.quantity) || 1;

        if (!gameId || isNaN(gameId) || gameId <= 0) {
            return new Response(JSON.stringify({ error: '缺少有效的遊戲 ID' }), { status: 400 });
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return new Response(JSON.stringify({ error: '賣出數量必須為正整數' }), { status: 400 });
        }

        const db = context.env.DB;
        const game = await db.prepare(
            'SELECT name, total_stock, for_sale_stock, sale_price FROM BoardGames WHERE game_id = ?'
        ).bind(gameId).first();

        if (!game) {
            return new Response(JSON.stringify({ error: `找不到 ID 為 ${gameId} 的遊戲` }), { status: 404 });
        }
        if (game.for_sale_stock < quantity) {
            return new Response(JSON.stringify({
                error: `《${game.name}》販售庫存只剩 ${game.for_sale_stock}，無法賣出 ${quantity} 件`
            }), { status: 400 });
        }

        const newTotalStock = game.total_stock - quantity;
        const newForSaleStock = game.for_sale_stock - quantity;
        const isVisible = newTotalStock > 0 ? 1 : 0;
        const totalPrice = (game.sale_price || 0) * quantity;

        // 跟批次結帳（checkout-sale.js）用同一套資料結構：先建立一筆訂單再寫明細並掛上 order_id，
        // 不然這筆賣出紀錄的 order_id 會是 NULL，「販售紀錄」的查詢只抓 order_id 不是 NULL 的資料，
        // 快速賣出的東西雖然庫存有正確扣掉，卻永遠不會出現在販售紀錄列表裡。
        const orderInsert = await db.prepare(
            'INSERT INTO SalesOrders (total_amount) VALUES (?)'
        ).bind(totalPrice).run();
        const orderId = orderInsert.meta.last_row_id;

        await db.batch([
            db.prepare(
                'UPDATE BoardGames SET total_stock = ?, for_sale_stock = ?, is_visible = ? WHERE game_id = ?'
            ).bind(newTotalStock, newForSaleStock, isVisible, gameId),
            db.prepare(
                `INSERT INTO Sales (game_id, game_name, quantity, unit_price, total_price, order_id, discount)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(gameId, game.name, quantity, game.sale_price || 0, totalPrice, orderId, 1)
        ]);

        return new Response(JSON.stringify({
            success: true,
            total_stock: newTotalStock,
            for_sale_stock: newForSaleStock,
            is_visible: isVisible,
            message: `已賣出《${game.name}》x${quantity}`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in sell-boardgame API:', error);
        return new Response(JSON.stringify({ error: `賣出失敗: ${error.message}` }), { status: 500 });
    }
}
