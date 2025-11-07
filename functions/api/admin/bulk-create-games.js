// functions/api/admin/bulk-create-games.js

// 【修正】移除舊的 generateGameId 函式

// CSV 欄位中文與資料庫欄位英文的對應表
const headerMapping = {
    "遊戲ID": "game_id", 
    "遊戲名稱": "name", "遊戲介紹": "description", "圖片網址1": "image_url", "圖片網址2": "image_url_2",
    "圖片網址3": "image_url_3", "標籤(逗號分隔)": "tags", "最少人數": "min_players", "最多人數": "max_players",
    "難度": "difficulty", "總庫存": "total_stock", "可租借庫存": "for_rent_stock", "售價": "sale_price",
    "租金": "rent_price", "押金": "deposit", "每日逾期費": "late_fee_per_day", "是否上架(TRUE/FALSE)": "is_visible",
    "補充說明": "supplementary_info"
};

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }
        const { games } = await context.request.json();
        if (!Array.isArray(games) || games.length === 0) {
            return new Response(JSON.stringify({ error: '請提供有效的遊戲資料陣列。' }), { status: 400 });
        }

        const db = context.env.DB;
        const operations = [];
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // --- 【▼▼▼ 核心修改：準備循序 ID ▼▼▼】 ---
        // 1. 查詢當前最大的 game_id
        const maxIdResult = await db.prepare("SELECT MAX(CAST(game_id AS INTEGER)) as maxId FROM BoardGames").first();
        
        // 2. 準備好下一個可用的 ID
        // 邏輯同上，確保至少從 384 開始
        let nextGameId = 384;
         if (maxIdResult && maxIdResult.maxId && maxIdResult.maxId >= 383) {
            nextGameId = maxIdResult.maxId + 1;
        }
        // --- 【▲▲▲ 核心修改結束 ▲▲▲】 ---

        // 準備 UPSERT (存在則更新，不存在則插入) 指令
        const stmt = db.prepare(
            `INSERT INTO BoardGames (
                game_id, name, description, image_url, image_url_2, image_url_3, tags, min_players, max_players, difficulty,
                total_stock, for_rent_stock, for_sale_stock, sale_price, rent_price, deposit, late_fee_per_day, is_visible, supplementary_info, display_order
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999)
             ON CONFLICT(game_id) DO UPDATE SET
               name=excluded.name, description=excluded.description, image_url=excluded.image_url, image_url_2=excluded.image_url_2,
               image_url_3=excluded.image_url_3, tags=excluded.tags, min_players=excluded.min_players, max_players=excluded.max_players,
               difficulty=excluded.difficulty, total_stock=excluded.total_stock, for_rent_stock=excluded.for_rent_stock,
               for_sale_stock=excluded.for_sale_stock, sale_price=excluded.sale_price, rent_price=excluded.rent_price,
               deposit=excluded.deposit, late_fee_per_day=excluded.late_fee_per_day, is_visible=excluded.is_visible,
               supplementary_info=excluded.supplementary_info`
        );

        for (let i = 0; i < games.length; i++) {
            const rawGame = games[i];
            const game = {};
            // 使用 mapping 將中文標頭轉為英文 key
            for (const chiHeader in rawGame) {
                if (headerMapping[chiHeader]) {
                    game[headerMapping[chiHeader]] = rawGame[chiHeader];
                }
            }

            if (!game.name || game.name.trim().length === 0) {
                failCount++;
                errors.push(`第 ${i + 2} 行：缺少遊戲名稱。`);
                continue;
            }

            // --- 【▼▼▼ ID 賦值修改 ▼▼▼】 ---
            let gameIdToUse;
            // 如果 CSV 中提供了 ID (且為數字)，則使用它 (用於更新)
            if (game.game_id && !isNaN(Number(game.game_id)) && Number(game.game_id) > 0) {
                gameIdToUse = Number(game.game_id);
            } else {
                // 否則，使用我們循序產生的新 ID
                gameIdToUse = nextGameId;
                nextGameId++; // 為下一個迴圈準備
            }
            // --- 【▲▲▲ ID 賦值修改結束 ▲▲▲】 ---

            const isVisible = ['TRUE', 'YES', 'Y', '1'].includes((game.is_visible || '').toString().trim().toUpperCase());
            const total_stock = Number(game.total_stock) || 0;
            const for_rent_stock = Number(game.for_rent_stock) || 0;
            const for_sale_stock = total_stock - for_rent_stock;

            operations.push(stmt.bind(
                gameIdToUse, // <-- 使用新的 ID
                game.name.trim(), game.description || null, game.image_url || null, game.image_url_2 || null,
                game.image_url_3 || null, game.tags || null, Number(game.min_players) || 1, Number(game.max_players) || 4, game.difficulty || '普通',
                total_stock, for_rent_stock, for_sale_stock, Number(game.sale_price) || 0, Number(game.rent_price) || 0,
                Number(game.deposit) || 0, Number(game.late_fee_per_day) || 50, isVisible ? 1 : 0, game.supplementary_info || null
            ));
            successCount++;
        }

        if (operations.length > 0) {
            await db.batch(operations);
        }

        let message = `匯入完成！成功處理 ${successCount} 筆資料。`;
        if (failCount > 0) {
            message += `\n失敗 ${failCount} 筆。\n錯誤詳情：\n${errors.slice(0, 5).join('\n')}`;
        }

        return new Response(JSON.stringify({ success: true, message }), { status: 200 });

    } catch (error) {
        console.error('Error in bulk-create-games API:', error);
        return new Response(JSON.stringify({ error: '批量匯入時發生嚴重錯誤', details: error.message }), { status: 500 });
    }
}