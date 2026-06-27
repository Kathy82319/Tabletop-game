// functions/api/admin/patch-boardgame-stock.js
export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const { gameId, total_stock, for_sale_stock, for_rent_stock, sale_price, rent_price, deposit } = body;

        if (!gameId) {
            return new Response(JSON.stringify({ error: '缺少遊戲 ID' }), { status: 400 });
        }

        const fields = { total_stock, for_sale_stock, for_rent_stock, sale_price, rent_price, deposit };
        for (const [key, val] of Object.entries(fields)) {
            const n = Number(val);
            if (isNaN(n) || !Number.isInteger(n) || n < 0) {
                return new Response(JSON.stringify({ error: `${key} 必須為非負整數` }), { status: 400 });
            }
        }

        const totalN = Number(total_stock);
        const saleN = Number(for_sale_stock);
        const rentN = Number(for_rent_stock);

        if (saleN + rentN > totalN) {
            return new Response(JSON.stringify({
                error: `販售庫存 (${saleN}) + 租借庫存 (${rentN}) 不可超過總庫存 (${totalN})`
            }), { status: 400 });
        }

        const is_visible = totalN > 0 ? 1 : 0;
        const db = context.env.DB;

        const result = await db.prepare(`
            UPDATE BoardGames SET
                total_stock = ?, for_sale_stock = ?, for_rent_stock = ?,
                sale_price = ?, rent_price = ?, deposit = ?,
                is_visible = ?
            WHERE game_id = ?
        `).bind(
            totalN, saleN, rentN,
            Number(sale_price), Number(rent_price), Number(deposit),
            is_visible,
            gameId
        ).run();

        if (result.meta.changes === 0) {
            return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${gameId}` }), { status: 404 });
        }

        return new Response(JSON.stringify({ success: true, is_visible }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: '更新失敗', details: error.message }), { status: 500 });
    }
}
