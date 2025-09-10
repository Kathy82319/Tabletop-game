// /functions/api/add-exp.js

// --- 假資料區 ---
// 在真實情況下，這些資料會從 D1 資料庫讀取
// 目前我們用這個假資料來模擬一位玩家的狀態
const MOCK_USER_DATA = {
    userId: "U1234567890abcdefghijklmnopqrstu",
    class: "無",
    level: 5,
    current_exp: 250,
};

// 等級提升所需經驗值的計算公式
const calculateExpToNextLevel = (level) => {
    // 這裡我們用一個簡單的公式：每級所需經驗值 = 當前等級 * 150
    // 例如 Lv.5 -> Lv.6 需要 5 * 150 = 750 EXP
    return level * 150;
};
// --- 假資料區結束 ---

export const onRequestPost = async (context) => {
    const { request, env } = context;
    try {
        const db = env.DB;
        const body = await request.json();
        const { userId, amount } = body;

        if (!userId || typeof amount !== 'number' || amount <= 0) {
            return new Response('User ID and a positive amount are required', { status: 400 });
        }

        // 從資料庫取得使用者目前的資料
        const userStmt = db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId);
        const userResult = await userStmt.first();

        if (!userResult) {
            return new Response('User not found', { status: 404 });
        }

        let user = { ...userResult };
        const originalLevel = user.level;
        const expGained = Math.floor(amount);
        user.current_exp += expGained;

        let leveledUp = false;
        let expToNextLevel = calculateExpToNextLevel(user.level);

        while (user.current_exp >= expToNextLevel) {
            leveledUp = true;
            user.level += 1;
            user.current_exp -= expToNextLevel;
            expToNextLevel = calculateExpToNextLevel(user.level);
        }

        // 將更新後的資料寫回資料庫
        const updateStmt = db.prepare(
            'UPDATE Users SET level = ?, current_exp = ? WHERE user_id = ?'
        ).bind(user.level, user.current_exp, userId);
        await updateStmt.run();

        const responsePayload = {
            success: true,
            message: `成功為 ${userId} 新增 ${expGained} 點經驗值。`,
            leveledUp: leveledUp,
            originalLevel: originalLevel,
            newLevel: user.level,
            newExp: user.current_exp,
            expToNextLevel: expToNextLevel,
        };

        return new Response(JSON.stringify(responsePayload), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Add EXP Error:", error);
        return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
};

export const onRequest = (context) => {
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    return onRequestPost(context);
};