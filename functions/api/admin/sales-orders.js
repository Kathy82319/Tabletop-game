// functions/api/admin/sales-orders.js
// 販售紀錄查詢：回傳合併後的訂單清單，每筆訂單附上明細
export async function onRequest(context) {
    try {
        if (context.request.method !== 'GET') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const db = context.env.DB;

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
