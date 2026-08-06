// functions/api/admin/sales-orders.js
// 販售紀錄查詢：回傳合併後的訂單清單，每筆訂單附上明細；也支援刪除訂單（會自動復原對應庫存）
export async function onRequest(context) {
    const db = context.env.DB;

    if (context.request.method === 'GET') {
        try {
            const orders = await db.prepare(
                'SELECT order_id, total_amount, created_at FROM SalesOrders ORDER BY created_at DESC'
            ).all();

            const sales = await db.prepare(
                `SELECT sale_id, order_id, game_id, game_name, quantity, unit_price, discount, total_price
                 FROM Sales WHERE order_id IS NOT NULL ORDER BY sale_id ASC`
            ).all();

            const itemsByOrder = {};
            for (const row of (sales.results || [])) {
                if (!itemsByOrder[row.order_id]) itemsByOrder[row.order_id] = [];
                itemsByOrder[row.order_id].push(row);
            }

            const result = (orders.results || []).map(order => ({
                ...order,
                items: itemsByOrder[order.order_id] || []
            }));

            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Error in sales-orders API:', error);
            return new Response(JSON.stringify({ error: `查詢失敗: ${error.message}` }), { status: 500 });
        }
    }

    if (context.request.method === 'DELETE') {
        try {
            const body = await context.request.json();
            const orderId = Number(body.order_id);
            if (!orderId) {
                return new Response(JSON.stringify({ error: '缺少訂單編號' }), { status: 400 });
            }

            const order = await db.prepare('SELECT order_id FROM SalesOrders WHERE order_id = ?').bind(orderId).first();
            if (!order) {
                return new Response(JSON.stringify({ error: `找不到訂單 #${orderId}` }), { status: 404 });
            }

            const saleRows = await db.prepare(
                'SELECT game_id, quantity FROM Sales WHERE order_id = ? AND game_id IS NOT NULL'
            ).bind(orderId).all();

            const statements = [];
            for (const row of (saleRows.results || [])) {
                const game = await db.prepare(
                    'SELECT total_stock FROM BoardGames WHERE game_id = ?'
                ).bind(row.game_id).first();
                if (!game) continue; // 遊戲已被刪除，庫存無從復原

                const newTotalStock = game.total_stock + row.quantity;
                const isVisible = newTotalStock > 0 ? 1 : 0;
                statements.push(
                    db.prepare(
                        'UPDATE BoardGames SET total_stock = total_stock + ?, for_sale_stock = for_sale_stock + ?, is_visible = ? WHERE game_id = ?'
                    ).bind(row.quantity, row.quantity, isVisible, row.game_id)
                );
            }

            statements.push(db.prepare('DELETE FROM Sales WHERE order_id = ?').bind(orderId));
            statements.push(db.prepare('DELETE FROM SalesOrders WHERE order_id = ?').bind(orderId));

            await db.batch(statements);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Error deleting sales order:', error);
            return new Response(JSON.stringify({ error: `刪除失敗: ${error.message}` }), { status: 500 });
        }
    }

    return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
}
