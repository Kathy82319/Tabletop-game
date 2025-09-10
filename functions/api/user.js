// /functions/api/user.js

// --- 假資料區 ---
// 為了與 add-exp.js 的假資料同步，我們在這裡也使用同樣的資料
const MOCK_USER_DATA = {
    userId: "U1234567890abcdefghijklmnopqrstu",
    class: "初心者", // 新增「職業」欄位
    level: 5,
    exp: 250,
    expToNextLevel: 750, // 5 * 150 = 750
    isNewUser: false
};
// --- 假資料區結束 ---


// /functions/api/user.js
export const onRequestPost = async (context) => {
    const { request, env } = context;
    try {
        const db = env.DB;
        const body = await request.json();
        const userId = body.userId;

        if (!userId) {
            return new Response('User ID is required', { status: 400 });
        }

        const stmt = db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId);
        const { results } = await stmt.all();

        let userData;
        if (results.length > 0) {
            const dbUser = results[0];
            userData = {
                class: dbUser.class,
                level: dbUser.level,
                exp: dbUser.current_exp,
                expToNextLevel: dbUser.level * 150,
                isNewUser: false
            };
        } else {
            // 如果是新使用者，除了回傳預設值，也同時在資料庫建立一筆新紀錄
            const newUserStmt = db.prepare(
                'INSERT INTO Users (user_id, line_display_name) VALUES (?, ?)'
            ).bind(userId, "新來的冒險者"); // 這裡可以從前端拿到 displayName
            await newUserStmt.run();

            userData = {
                class: "無",
                level: 1,
                exp: 0,
                expToNextLevel: 100,
                isNewUser: true
            };
        }

        return new Response(JSON.stringify(userData), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
};

export const onRequest = (context) => {
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    return onRequestPost(context);
};