// functions/api/admin/use-gold.js
// 每次固定扣 GOLD_SPEND_PER_USE 元，金額不給前端自訂（避免被竄改請求內容亂改金額）
import { buildGoldSpendOps, GOLD_SPEND_PER_USE } from '../_lib/gold.js';

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response('Invalid request method.', { status: 405 });
        }

        const { userId, reason } = await context.request.json();
        if (typeof userId !== 'string' || !userId) {
            return new Response(JSON.stringify({ error: '無效的使用者 ID。' }), { status: 400 });
        }

        const db = context.env.DB;
        let result;
        try {
            result = await buildGoldSpendOps(db, userId, reason && reason.trim() ? reason.trim() : null);
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }

        await db.batch(result.ops);

        return new Response(JSON.stringify({
            success: true,
            message: `已使用 ${GOLD_SPEND_PER_USE} 元，剩餘 ${result.newAmount} 元。`,
            newAmount: result.newAmount,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in use-gold API:', error);
        return new Response(JSON.stringify({ error: '使用金幣失敗，請稍後再試。' }), { status: 500 });
    }
}
