// functions/api/add-exp.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // 新的 API 會接收 userId, expValue, 和 reason
    const { userId, expValue, reason } = await context.request.json();

    if (!userId || typeof expValue !== 'number' || expValue <= 0) {
      return new Response(JSON.stringify({ error: '無效的使用者 ID 或經驗值。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // 使用 D1 的 batch 功能來執行一個交易 (Transaction)
    // 確保兩條 SQL 指令要嘛都成功，要嘛都失敗，保證資料一致性
    const updateUserStmt = db.prepare(
      'UPDATE Users SET current_exp = current_exp + ? WHERE user_id = ?'
    );
    const insertHistoryStmt = db.prepare(
      'INSERT INTO ExpHistory (user_id, exp_added, reason) VALUES (?, ?, ?)'
    );

    const batchResult = await db.batch([
      updateUserStmt.bind(expValue, userId),
      insertHistoryStmt.bind(userId, expValue, reason || '未提供原因') // 如果沒有原因，給一個預設值
    ]);

    // 檢查更新是否有成功 (可以透過查詢 batchResult 來做更細緻的檢查)
    // 這裡我們先簡化，假設能執行到這一步就是成功
    
    return new Response(JSON.stringify({ 
        success: true, 
        message: `成功為使用者 ${userId} 新增 ${expValue} 點經驗值。原因：${reason}` 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in add-exp API:', error);
    const errorResponse = { error: '伺服器內部錯誤，新增經驗值失敗。', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}