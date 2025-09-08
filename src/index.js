成功取得後端遊戲資料export default {
    async fetch(request, env, ctx) {
        // env.DB 就是我們在第三步綁定的 D1 資料庫
        const db = env.DB;
        const url = new URL(request.url);

        if (url.pathname === '/api/user') {
            if (request.method !== 'POST') {
                return new Response('Method Not Allowed', { status: 405 });
            }

            try {
                const body = await request.json();
                const userId = body.userId;

                if (!userId) {
                    return new Response('User ID is required', { status: 400 });
                }

                // 準備 SQL 查詢語句，使用 ? 來防止 SQL Injection 攻擊
                const stmt = db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId);
                const { results } = await stmt.all();

                let userData;

                if (results.length > 0) {
                    // 如果在資料庫中找到使用者
                    const dbUser = results[0];
                    userData = {
                        level: dbUser.level,
                        exp: dbUser.current_exp,
                        // 這裡可以根據等級計算升級所需經驗值，暫時寫死
                        expToNextLevel: dbUser.level * 150, 
                        isNewUser: false
                    };
                } else {
                    // 如果是新使用者，回傳預設值
                    // 未來的步驟會在這裡執行 INSERT 來建立新使用者
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
                return new Response('Internal Server Error', { status: 500 });
            }
        }
        
        return new Response('Not a valid API endpoint.', { status: 404 });
    },
};