// /functions/api/games.js
export const onRequestGet = async (context) => {
    const { env } = context;
    try {
        const db = env.DB;
        // 假設你的 D1 資料庫裡有一個叫做 BoardGames 的資料表
        const stmt = db.prepare('SELECT * FROM BoardGames WHERE is_visible = ?').bind(true);
        const { results } = await stmt.all();

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
};

export const onRequest = (context) => {
    if (context.request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    return onRequestGet(context);
};