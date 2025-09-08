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


// 正式版本：處理 /api/user 的 POST 請求並回傳假資料
export const onRequestPost = async (context) => {
    const { request } = context;
    
    try {
        const body = await request.json();
        const userId = body.userId;

        if (!userId) {
            return new Response('User ID is required', { status: 400 });
        }

        // 注意：這裡不再查詢資料庫，而是直接回傳上面定義好的假資料
        // 這樣可以確保前端拿到的資料，和我們用 add-exp 測試的資料來源一致
        return new Response(JSON.stringify(MOCK_USER_DATA), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
};

// 為了安全，如果不是 POST，我們回傳一個錯誤
export const onRequest = (context) => {
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    return onRequestPost(context);
}