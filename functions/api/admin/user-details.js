export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });

    const db = env.DB;
    try {
        // 1. 取得基本資料
        const profile = await db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId).first();
        if (!profile) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });

        // 2. 取得多筆動態資產 (關聯 GameAssets 以取得名稱與圖示)
        const { results: assets } = await db.prepare(`
            SELECT ga.type, ga.name, ua.custom_description, ga.description as default_desc, ga.icon_url
            FROM UserAssets ua
            JOIN GameAssets ga ON ua.asset_id = ga.id
            WHERE ua.user_id = ?
        `).bind(userId).all();
        
        profile.user_assets = assets || [];

        // 3. 取得歷史紀錄
        const { results: bookings } = await db.prepare('SELECT * FROM Bookings WHERE user_id = ? ORDER BY booking_date DESC LIMIT 10').bind(userId).all();
        const { results: rentals } = await db.prepare(`
            SELECT Rentals.*, BoardGames.name as game_name 
            FROM Rentals 
            LEFT JOIN BoardGames ON Rentals.game_id = BoardGames.game_id 
            WHERE Rentals.user_id = ? 
            ORDER BY rental_date DESC LIMIT 10
        `).bind(userId).all();
        const { results: exp_history } = await db.prepare('SELECT * FROM ExpHistory WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').bind(userId).all();

        return new Response(JSON.stringify({ profile, bookings, rentals, exp_history }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}