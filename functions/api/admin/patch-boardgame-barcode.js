// functions/api/admin/patch-boardgame-barcode.js
export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const { gameId } = body;

        if (!gameId) {
            return new Response(JSON.stringify({ error: '缺少遊戲 ID' }), { status: 400 });
        }

        const barcode = body.barcode ? String(body.barcode).trim() : null;
        const db = context.env.DB;

        if (barcode) {
            const dup = await db.prepare('SELECT game_id FROM BoardGames WHERE barcode = ? AND game_id != ?').bind(barcode, gameId).first();
            if (dup) {
                return new Response(JSON.stringify({ error: `此條碼已被「${dup.game_id}」使用，請確認條碼是否重複。` }), { status: 400 });
            }
        }

        const result = await db.prepare('UPDATE BoardGames SET barcode = ? WHERE game_id = ?').bind(barcode, gameId).run();

        if (result.meta.changes === 0) {
            return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${gameId}` }), { status: 404 });
        }

        return new Response(JSON.stringify({ success: true, barcode }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: '更新失敗', details: error.message }), { status: 500 });
    }
}
