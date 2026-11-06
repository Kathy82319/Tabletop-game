// functions/api/checkin.js
// 客人自己掃店內的入場 QR Code 打卡：固定加 2 經驗值，每人每天限一次。
// 特殊活動想額外加點，後台「掃碼加點」的手動流程不受影響，照舊可用。
import { verifyLiffUser } from './_lib/auth.js';
import { nowTaiwanString } from './_lib/time.js';
import { buildGoldLevelUpOps } from './_lib/gold.js';

const CHECKIN_EXP = 2;
const REQUIRED_EXP = 10;

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response('Invalid request method.', { status: 405 });
        }

        const profile = await verifyLiffUser(context.request);
        if (!profile) {
            return new Response(JSON.stringify({ error: '未登入或驗證失敗。' }), { status: 401 });
        }
        const userId = profile.userId;
        const db = context.env.DB;
        const today = nowTaiwanString().substring(0, 10);

        const user = await db.prepare(
            'SELECT level, current_exp FROM Users WHERE user_id = ?'
        ).bind(userId).first();
        if (!user) {
            return new Response(JSON.stringify({ error: '找不到會員資料，請先完整開啟過小程式一次。' }), { status: 404 });
        }

        const originalLevel = user.level;
        let currentLevel = user.level;
        let currentExp = user.current_exp + CHECKIN_EXP;
        while (currentExp >= REQUIRED_EXP) {
            currentExp -= REQUIRED_EXP;
            currentLevel += 1;
        }

        const operations = [
            // 這張表的 (user_id, checkin_date) 是主鍵，當天已打卡過會在這裡撞到衝突而整批失敗，
            // 藉此避免重複打卡，也不怕使用者連點造成的 race condition。
            db.prepare('INSERT INTO DailyCheckIns (user_id, checkin_date) VALUES (?, ?)').bind(userId, today),
            db.prepare('UPDATE Users SET level = ?, current_exp = ?, available_attacks = ? WHERE user_id = ?')
                .bind(currentLevel, currentExp, CHECKIN_EXP, userId),
            db.prepare('INSERT INTO ExpHistory (user_id, exp_added, reason) VALUES (?, ?, ?)')
                .bind(userId, CHECKIN_EXP, '每日入場掃碼'),
        ];

        if (currentLevel > originalLevel) {
            operations.push(...await buildGoldLevelUpOps(db, userId, currentLevel - originalLevel));
        }

        try {
            await db.batch(operations);
        } catch (batchError) {
            return new Response(JSON.stringify({ error: '今天已經掃過了，明天再來繼續冒險吧！', alreadyCheckedIn: true }), { status: 409 });
        }

        return new Response(JSON.stringify({
            success: true,
            message: `開始冒險，獲得 ${CHECKIN_EXP} 點經驗值！`,
            newLevel: currentLevel,
            newExp: currentExp,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error in checkin API:', error);
        return new Response(JSON.stringify({ error: '打卡失敗，請稍後再試。' }), { status: 500 });
    }
}
