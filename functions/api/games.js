// 這個檔案負責處理 /api/games 的 GET 請求
export const onRequestGet = async (context) => {
    const { env } = context;
    try {
        const db = env.DB;

        // 查詢所有 is_visible 為 TRUE 的桌遊
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