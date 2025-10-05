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
            const errorBody = await response.json();
            console.error("LINE API Error:", JSON.stringify(errorBody, null, 2));
            throw new Error(`LINE API responded with status ${response.status}: ${errorBody.message}`);
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {

        console.error("Error sending LINE message:", error);
        return new Response(JSON.stringify({ error: '發送訊息失敗。', details: error.message }), { status: 500 });
    }
}