// functions/api/admin/gold-ledger.js
// 「使用金幣」彈窗裡的「最近異動紀錄」用這支查，方便確認有沒有誤觸
export async function onRequest(context) {
    try {
        if (context.request.method !== 'GET') {
            return new Response('Invalid request method.', { status: 405 });
        }

        const url = new URL(context.request.url);
        const userId = url.searchParams.get('userId');
        if (!userId) {
            return new Response(JSON.stringify({ error: '缺少 userId。' }), { status: 400 });
        }

        const db = context.env.DB;
        const { results } = await db.prepare(
            'SELECT change_amount, balance_after, reason, created_at FROM GoldLedger WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
        ).bind(userId).all();

        return new Response(JSON.stringify(results || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in gold-ledger API:', error);
        return new Response(JSON.stringify({ error: '查詢金幣紀錄失敗。' }), { status: 500 });
    }
}
