// functions/api/admin/create-boardgame.js

// 【修正】移除 nanoid import，改用內建函式
const generateGameId = () => {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return id;
};

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();

        // 這裡的驗證邏輯與 update-boardgame-details.js 類似
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            return new Response(JSON.stringify({ error: '遊戲名稱為必填。' }), { status: 400 });
        }

        const db = context.env.DB;

        const newGameId = generateGameId(); // <-- 使用新的內建函式
        const for_sale_stock = (Number(body.total_stock) || 0) - (Number(body.for_rent_stock) || 0);

        const stmt = db.prepare(
          `INSERT INTO BoardGames (
             game_id, name, description, image_url, image_url_2, image_url_3, tags,
             min_players, max_players, difficulty,
             total_stock, for_rent_stock, for_sale_stock,
             sale_price, rent_price, deposit, late_fee_per_day,
             is_visible, supplementary_info, display_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)`
        );

        await stmt.bind(
            newGameId,
            body.name, body.description || '', body.image_url || '', body.image_url_2 || '', body.image_url_3 || '', body.tags || '',
            Number(body.min_players) || 1, Number(body.max_players) || 4, body.difficulty || '普通',
            Number(body.total_stock) || 0, Number(body.for_rent_stock) || 0, for_sale_stock,
            Number(body.sale_price) || 0, Number(body.rent_price) || 0,
            Number(body.deposit) || 0, Number(body.late_fee_per_day) || 50,
            body.is_visible ? 1 : 0, body.supplementary_info || ''
        ).run();

        return new Response(JSON.stringify({ success: true, gameId: newGameId }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in create-boardgame API:', error);
        return new Response(JSON.stringify({ error: '建立遊戲失敗', details: error.message }), {
            status: 500,
        });
    }
}