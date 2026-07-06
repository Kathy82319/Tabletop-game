// 共用的 LINE 推播工具，供各 API 內部直接呼叫，避免對外暴露可代發任意訊息的端點
export async function sendLinePush(env, userId, message) {
    const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!userId || !message || !accessToken) return;

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

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`LINE API responded with status ${response.status}: ${errorBody.message || ''}`);
    }
}
