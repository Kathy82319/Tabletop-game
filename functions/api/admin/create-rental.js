// functions/api/admin/create-rental.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const body = await context.request.json();
    // 【修改】將 gameIds 改為接收 games
    const { 
        userId, games, dueDate, name, phone,
        rentPrice, deposit, lateFeePerDay 
    } = body;

    const errors = [];
    if (userId && typeof userId !== 'string') errors.push('無效的會員 ID 格式。');
    // 【修改】驗證 games 陣列
    if (!games || !Array.isArray(games) || games.length === 0) errors.push('必須至少選擇一款租借的遊戲。');
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.push('無效的歸還日期格式。');
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 50) errors.push('租借人姓名為必填，且長度不可超過 50 字。');

    const rentPriceNum = Number(rentPrice);
    const depositNum = Number(deposit);
    const lateFeeNum = Number(lateFeePerDay);

    if (isNaN(rentPriceNum) || rentPriceNum < 0) errors.push('租金必須是有效的非負數。');
    if (isNaN(depositNum) || depositNum < 0) errors.push('押金必須是有效的非負數。');
    if (isNaN(lateFeeNum) || lateFeeNum < 0) errors.push('每日逾期費必須是有效的非負數。');

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }

    const db = context.env.DB;
    const allGameNames = [];
    const dbOperations = [];
    
    // 【修改】迴圈遍歷 games 物件陣列
    for (const item of games) {
        const rawGameId = item.gameId;
        const gameWeight = item.weight || '未填寫'; // 取得公克數
        
        const gameId = Number(rawGameId);
        if (isNaN(gameId) || gameId <= 0) {
            throw new Error(`傳入了無效的遊戲 ID：${rawGameId}`);
        }

        const game = await db.prepare('SELECT name, for_rent_stock FROM BoardGames WHERE game_id = ?').bind(gameId).first();
        if (!game) throw new Error(`找不到 ID 為 ${gameId} 的遊戲。`);
        if (game.for_rent_stock <= 0) throw new Error(`《${game.name}》目前已無可租借庫存。`);
        
        // 【關鍵修改】將重量加入到 LINE 訊息用的陣列中
        allGameNames.push(`${game.name} (重量: ${gameWeight}g)`);

        const insertStmt = db.prepare(
            `INSERT INTO Rentals (user_id, game_id, due_date, name, phone, rent_price, deposit, late_fee_per_day) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        
        dbOperations.push(insertStmt.bind(
            userId || null, 
            gameId,
            dueDate, name, 
            phone || null,
            rentPriceNum, depositNum, lateFeeNum
        ));
        
        const updateStmt = db.prepare('UPDATE BoardGames SET for_rent_stock = for_rent_stock - 1 WHERE game_id = ?');
        dbOperations.push(updateStmt.bind(gameId));
    }
    
    await db.batch(dbOperations);
    
    const rentalDateStr = new Date().toISOString().split('T')[0];
    const rentalDuration = Math.round((new Date(dueDate) - new Date(rentalDateStr)) / (1000 * 60 * 60 * 24)) + 1;
    const message = `🎉 租借資訊確認\n\n` +
                    `姓名：${name}\n電話：${phone}\n` +
                    `日期：${rentalDateStr}\n租借時間：${rentalDuration}天\n` +
                    `歸還日期：${dueDate}\n` +
                    `租借遊戲：\n- ${allGameNames.join('\n- ')}\n\n` +
                    `本次租金：$${rentPriceNum}\n收取押金：$${depositNum}\n\n` +
                    `租借規則：\n` +
                    `1. 收取遊戲押金，於歸還桌遊、確認內容物無誤後退還。\n` +
                    `2. 內容物需現場清點，若歸還時有缺少或損毀，將不退還押金。\n` +
                    `3. 最短租期為3天，租借當日即算第一天。\n` +
                    `4. 逾期歸還，每逾期一天將從押金扣除 ${lateFeeNum} 元。\n\n` +
                    `如上面資訊沒有問題，請回覆「ok」並視為同意租借規則。\n`+
                    `感謝您的預約！`;

    if (userId && message) {
        context.waitUntil(
            fetch(new URL('/api/send-message', context.request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message }),
            }).catch(err => console.error("背景發送 LINE 訊息失敗:", err))
        );
    }
    
    return new Response(JSON.stringify({ success: true, message: '租借紀錄已建立，庫存已更新！' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-rental API:', error);
    return new Response(JSON.stringify({ error: `建立租借紀錄失敗: ${error.message}` }), {
      status: 500,
    });
  }
}