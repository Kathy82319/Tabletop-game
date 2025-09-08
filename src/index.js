// 處理 API 請求的函式
const handleApiRequest = async (request, env) => {
    const url = new URL(request.url);

    // API 路由: /api/user
    if (url.pathname === '/api/user') {
        // 只允許 POST 請求
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        try {
            const body = await request.json();
            const userId = body.userId;

            if (!userId) {
                return new Response('User ID is required', { status: 400 });
            }

            // 從 D1 資料庫查詢
            const db = env.DB;
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
    }
    
    return new Response('API endpoint not found', { status: 404 });
};


// Cloudflare Pages 的主要進入點
export const onRequest = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);

    // 如果是 API 請求 (路徑以 /api/ 開頭)，就交給 handleApiRequest 處理
    if (url.pathname.startsWith('/api/')) {
        return handleApiRequest(request, env);
    }

    // 如果不是 API 請求，就讓 Pages 正常提供靜態檔案 (HTML/CSS/JS)
    // 這裡需要回傳 context.next() 來繼續處理靜態檔案
    return context.next();
};