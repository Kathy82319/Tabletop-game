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
    try {
        const body = await context.request.json();
        const { userId, amount } = body;

        if (!userId || typeof amount !== 'number' || amount <= 0) {
            return new Response('User ID and a positive amount are required', { status: 400 });
        }

        // --- 核心邏輯開始 ---
        // 1. 經驗值換算規則 (1元 = 1 EXP)
        const expGained = Math.floor(amount);

        // 2. 取得玩家目前狀態 (使用假資料)
        let user = { ...MOCK_USER_DATA }; // 複製一份假資料來操作，避免影響原始假資料
        
        // 3. 加上新的經驗值
        user.current_exp += expGained;

        // 4. 判斷是否升級 (使用 while 迴圈處理可能一次升多級的情況)
        let leveledUp = false;
        let expToNextLevel = calculateExpToNextLevel(user.level);

        while (user.current_exp >= expToNextLevel) {
            leveledUp = true;
            user.level += 1; // 等級提升！
            user.current_exp -= expToNextLevel; // 扣除升級所需的經驗值
            
            // 更新下一級所需的經驗值
            expToNextLevel = calculateExpToNextLevel(user.level);
        }

        // --- 核心邏輯結束 ---
        
        // 5. 準備回傳給店員後台的資料
        const responsePayload = {
            success: true,
            message: `成功為 ${userId} 新增 ${expGained} 點經驗值。`,
            leveledUp: leveledUp,
            originalLevel: MOCK_USER_DATA.level,
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

// 只允許 POST 方法
export const onRequest = (context) => {
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    return onRequestPost(context);
};