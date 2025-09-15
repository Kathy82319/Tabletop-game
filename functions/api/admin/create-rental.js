// functions/api/admin/create-rental.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, gameId, dueDate, deposit, lateFeePerDay } = await context.request.json();

    if (!userId || !gameId || !dueDate || deposit === undefined || lateFeePerDay === undefined) {
      return new Response(JSON.stringify({ error: '缺少必要的租借資訊。' }), { status: 400 });
    }

    const db = context.env.DB;

    // 1. 新增租借紀錄到 D1
    const stmt = db.prepare(
      'INSERT INTO Rentals (user_id, game_id, due_date, deposit, late_fee_per_day) VALUES (?, ?, ?, ?, ?)'
    );
    await stmt.bind(userId, gameId, dueDate, deposit, lateFeePerDay).run();

    // 2. 準備發送給使用者的通知訊息
    const game = await db.prepare('SELECT name FROM BoardGames WHERE game_id = ?').bind(gameId).first();
    const gameName = game ? game.name : '未知遊戲';

    const message = `📦 桌遊租借成功！\n\n` +
                    `遊戲名稱：${gameName}\n` +
                    `押金：$${deposit}\n` +
                    `預計歸還日：${dueDate}\n\n` +
                    `請務必在此日期前歸還，感謝您的租借！`;

    // 3. (可選) 觸發一個背景任務去發送 LINE 訊息
    context.waitUntil(
        fetch(new URL('/api/send-message', context.request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message })
        }).catch(err => console.error("背景發送租借通知失敗:", err))
    );
    
    // 4. (可選) 觸發背景任務將此筆紀錄同步到 Google Sheet
    // (此處省略 addRowToSheet 的實作，您可以從其他檔案複製)


    return new Response(JSON.stringify({ success: true, message: '租借紀錄已建立，並已通知使用者！' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-rental API:', error);
    return new Response(JSON.stringify({ error: '建立租借紀錄失敗。', details: error.message }), {
      status: 500,
    });
  }
}