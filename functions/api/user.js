// --- 偵錯專用版本 ---
// 這個檔案的目標是回報它收到的請求細節

export const onRequest = async (context) => {
    const { request } = context;

    // 收集所有我們想知道的資訊
    const debugInfo = {
        message: "偵錯成功！後端 Function 已經被執行！",
        url: request.url,
        method: request.method, // 這是最關鍵的資訊！
        headers: Object.fromEntries(request.headers),
    };

    // 以 JSON 格式回傳這些偵錯資訊，並且狀態碼是 200 (成功)
    return new Response(JSON.stringify(debugInfo, null, 2), {
        headers: { 
            'Content-Type': 'application/json',
            // 加上 CORS headers 以防萬一
            'Access-Control-Allow-Origin': '*' 
        },
        status: 200 
    });
};