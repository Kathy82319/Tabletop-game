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

        await db.batch([
            db.prepare(
                'UPDATE BoardGames SET total_stock = ?, for_sale_stock = ?, is_visible = ? WHERE game_id = ?'
            ).bind(newTotalStock, newForSaleStock, isVisible, gameId),
            db.prepare(
                `INSERT INTO Sales (game_id, game_name, quantity, unit_price, total_price)
                 VALUES (?, ?, ?, ?, ?)`
            ).bind(gameId, game.name, quantity, game.sale_price || 0, totalPrice)
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
