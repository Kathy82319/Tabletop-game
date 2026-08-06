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

        // 逐筆讀取商品資料；只有「找不到這款遊戲」才整批擋下，庫存不足不擋單，允許庫存變負數並事後通知
        const notFound = [];
        const lines = [];
        for (const item of items) {
            const game = await db.prepare(
                'SELECT game_id, name, total_stock, for_sale_stock, sale_price FROM BoardGames WHERE game_id = ?'
            ).bind(item.gameId).first();

            if (!game) {
                notFound.push(`找不到 ID 為 ${item.gameId} 的遊戲`);
                continue;
            }

            const unitPrice = game.sale_price || 0;
            const totalPrice = Math.round(unitPrice * item.quantity * item.discount);
            const newTotalStock = game.total_stock - item.quantity;
            const newForSaleStock = game.for_sale_stock - item.quantity;
            const isVisible = newTotalStock > 0 ? 1 : 0;
            const shortage = game.for_sale_stock < item.quantity;

            lines.push({
                gameId: item.gameId, name: game.name, quantity: item.quantity, discount: item.discount,
                unitPrice, totalPrice, newTotalStock, newForSaleStock, isVisible,
                shortage, availableStock: game.for_sale_stock
            });
        }

        if (notFound.length > 0) {
            return new Response(JSON.stringify({ error: notFound.join('；') }), { status: 400 });
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

        const warnings = [];
        lines.filter(l => l.shortage).forEach(line => {
            const message = `⚠️ 結帳訂單 #${orderId}：《${line.name}》庫存不足（賣出 ${line.quantity} 件，當時僅剩 ${line.availableStock} 件），目前庫存已變為 ${line.newForSaleStock}，請確認`;
            warnings.push(message);
            statements.push(
                db.prepare('INSERT INTO Activities (message, is_read) VALUES (?, 0)').bind(message)
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
            warnings,
            message: `結帳完成，共 ${lines.length} 款商品，總金額 $${totalAmount}`
                + (warnings.length > 0 ? `（${warnings.length} 款商品庫存不足，已通知儀表板）` : '')
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in checkout-sale API:', error);
        return new Response(JSON.stringify({ error: `結帳失敗: ${error.message}` }), { status: 500 });
    }
}
