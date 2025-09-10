// functions/api/add-exp.js

export async function onRequest(context) {
  try {
    // 1. 檢查請求方法是否為 POST
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // 2. 解析傳入的 JSON 資料
    const { userId, amount } = await context.request.json();

    // 3. 驗證資料是否齊全且正確
    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({ error: '無效的使用者 ID 或金額。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. 計算要增加的經驗值 (目前規則 1 元 = 1 EXP)
    const expToAdd = Math.floor(amount);

    // 5. 準備並執行 D1 資料庫更新指令
    const db = context.env.DB;
    const stmt = db.prepare(
      'UPDATE Users SET current_exp = current_exp + ? WHERE user_id = ?'
    );
    const result = await stmt.bind(expToAdd, userId).run();

    // 6. 檢查是否有成功更新到資料
    if (result.meta.changes === 0) {
      // 如果 a.meta.changes 為 0，代表 WHERE user_id = ? 條件沒有找到任何匹配的紀錄
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 7. 回傳成功訊息
    return new Response(JSON.stringify({ 
        success: true, 
        message: `成功為使用者 ${userId} 新增 ${expToAdd} 點經驗值。` 
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