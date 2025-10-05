// functions/api/send-message.js

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response('Invalid request method.', { status: 405 });
        }

        const { userId, message } = await context.request.json();
        const accessToken = context.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!userId || !message || !accessToken) {
            return new Response(JSON.stringify({ error: '缺少必要參數 (userId, message, or accessToken)。' }), { status: 400 });
        }

        // 【核心修正開始】
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: 'text', text: message }],
            }),
        });

        // 檢查來自 LINE API 的回應狀態
        if (!response.ok) {
            // 如果 LINE 回傳錯誤，讀取錯誤內容並拋出
            const errorBody = await response.json();
            console.error("LINE API Error:", JSON.stringify(errorBody, null, 2));
            throw new Error(`LINE API responded with status ${response.status}: ${errorBody.message}`);
        }
        // 【核心修正結束】

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        // 現在如果 LINE API 出錯，這個 catch 區塊就會被觸發
        console.error("Error sending LINE message:", error);
        return new Response(JSON.stringify({ error: '發送訊息失敗。', details: error.message }), { status: 500 });
    }
}