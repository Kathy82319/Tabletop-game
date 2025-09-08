// 這個檔案現在只處理 /api/user 的 POST 請求
export const onRequestPost = async (context) => {
    const { request, env } = context;

    try {
        const db = env.DB; // 取得綁定的 D1 資料庫
        const body = await request.json();
        const userId = body.userId;

        if (!userId) {
            return new Response('User ID is required', { status: 400 });
        }

        // 準備 SQL 查詢語句
        const stmt = db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId);
        const { results } = await stmt.all();

        let userData;
        if (results.length > 0) {
            const dbUser = results[0];
            userData = {
                level: dbUser.level,
                exp: dbUser.current_exp,
                expToNextLevel: dbUser.level * 150,
                isNewUser: false
            };
        } else {
            userData = {
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

// 你也可以定義 onRequestGet, onRequestPut 等來處理不同的請求方法
// 為了安全，如果不是 POST，我們可以回傳一個錯誤
export const onRequest = (context) => {
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    // 如果是 POST，onRequestPost 會被自動呼叫，所以這裡可以不用做事
    // 但為了保險起見，我們明確地呼叫它
    return onRequestPost(context);
}