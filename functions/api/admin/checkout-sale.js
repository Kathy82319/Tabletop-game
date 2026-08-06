// functions/api/admin/checkout-sale.js
// 批次結帳：一次販售多款遊戲，個別可設定折數，一次扣完所有庫存
export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const rawItems = Array.isArray(body.items) ? body.items : [];
        if (rawItems.length === 0) {
            return new Response(JSON.stringify({ error: '沒有要販售的商品' }), { status: 400 });
        }

        const items = [];
        for (const raw of rawItems) {
            const gameId = Number(raw.gameId);
            const quantity = Number(raw.quantity);
            const discountTenths = (raw.discountTenths === undefined || raw.discountTenths === null || raw.discountTenths === '')
                ? 10 : Number(raw.discountTenths);

            if (!gameId || isNaN(gameId) || gameId <= 0) {
                return new Response(JSON.stringify({ error: '包含無效的遊戲 ID' }), { status: 400 });
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return new Response(JSON.stringify({ error: '數量必須為正整數' }), { status: 400 });
            }
            if (isNaN(discountTenths) || discountTenths <= 0 || discountTenths > 10) {
                return new Response(JSON.stringify({ error: '折數必須介於 1 到 10 之間' }), { status: 400 });
            }
            items.push({ gameId, quantity, discount: discountTenths / 10 });
        }

        const db = context.env.DB;

        // 先逐筆讀取並驗證庫存，任何一款不足就整批擋下、不寫入任何資料
        const shortages = [];
        const lines = [];
        for (const item of items) {
            const game = await db.prepare(
                'SELECT game_id, name, total_stock, for_sale_stock, sale_price FROM BoardGames WHERE game_id = ?'
            ).bind(item.gameId).first();

            if (!game) {
                shortages.push({ gameId: item.gameId, message: `找不到 ID 為 ${item.gameId} 的遊戲` });
                continue;
            }
            if (game.for_sale_stock < item.quantity) {
                shortages.push({
                    gameId: item.gameId,
                    message: `《${game.name}》販售庫存只剩 ${game.for_sale_stock}，無法賣出 ${item.quantity} 件`,
                    availableStock: game.for_sale_stock
                });
                continue;
            }

            const unitPrice = game.sale_price || 0;
            const totalPrice = Math.round(unitPrice * item.quantity * item.discount);
            const newTotalStock = game.total_stock - item.quantity;
            const newForSaleStock = game.for_sale_stock - item.quantity;
            const isVisible = newTotalStock > 0 ? 1 : 0;

            lines.push({
                gameId: item.gameId, name: game.name, quantity: item.quantity, discount: item.discount,
                unitPrice, totalPrice, newTotalStock, newForSaleStock, isVisible
            });
        }

        if (shortages.length > 0) {
            return new Response(JSON.stringify({
                error: shortages.map(s => s.message).join('；'),
                shortages
            }), { status: 400 });
        }

        const totalAmount = lines.reduce((sum, l) => sum + l.totalPrice, 0);

        // D1 batch 內無法取得同批前一筆的 last_row_id，訂單需先單獨寫入取得 order_id
        const orderInsert = await db.prepare(
            'INSERT INTO SalesOrders (total_amount) VALUES (?)'
        ).bind(totalAmount).run();
        const orderId = orderInsert.meta.last_row_id;

        const statements = [];
        lines.forEach(line => {
            statements.push(
                db.prepare('UPDATE BoardGames SET total_stock = ?, for_sale_stock = ?, is_visible = ? WHERE game_id = ?')
                    .bind(line.newTotalStock, line.newForSaleStock, line.isVisible, line.gameId)
            );
            statements.push(
                db.prepare(
                    `INSERT INTO Sales (game_id, game_name, quantity, unit_price, total_price, order_id, discount)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(line.gameId, line.name, line.quantity, line.unitPrice, line.totalPrice, orderId, line.discount)
            );
        });

        await db.batch(statements);

        return new Response(JSON.stringify({
            success: true,
            order_id: orderId,
            total_amount: totalAmount,
            items: lines.map(l => ({
                gameId: l.gameId,
                total_stock: l.newTotalStock,
                for_sale_stock: l.newForSaleStock,
                is_visible: l.isVisible
            })),
            message: `結帳完成，共 ${lines.length} 款商品，總金額 $${totalAmount}`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in checkout-sale API:', error);
        return new Response(JSON.stringify({ error: `結帳失敗: ${error.message}` }), { status: 500 });
    }
}
