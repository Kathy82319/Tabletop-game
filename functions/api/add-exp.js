// functions/api/add-exp.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    const { userId, expValue, reason } = await context.request.json();

    // --- 【驗證區塊】 ---
    if (!userId || typeof userId !== 'string') {
        return new Response(JSON.stringify({ error: '無效的使用者 ID。' }), { status: 400 });
    }
    const exp = Number(expValue);
    if (isNaN(exp) || !Number.isInteger(exp) || exp <= 0 || exp > 1000) {
        return new Response(JSON.stringify({ error: '經驗值必須是 1 到 1000 之間的正整數。' }), { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 100) {
        return new Response(JSON.stringify({ error: '原因為必填，且長度不可超過 100 字。' }), { status: 400 });
    }
    // --- 【驗證區塊結束】 ---
    
    const db = context.env.DB;
    const userStmt = db.prepare('SELECT level, current_exp FROM Users WHERE user_id = ?');
    let user = await userStmt.bind(userId).first();
    if (!user) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}` }), { status: 404 });
    }
    let currentLevel = user.level;
    let currentExp = user.current_exp + exp;
    const requiredExp = 10;
    while (currentExp >= requiredExp) {
      currentExp -= requiredExp;
      currentLevel += 1;
    }
    await db.batch([
      db.prepare('UPDATE Users SET level = ?, current_exp = ? WHERE user_id = ?').bind(currentLevel, currentExp, userId),
      db.prepare('INSERT INTO ExpHistory (user_id, exp_added, reason) VALUES (?, ?, ?)').bind(userId, exp, reason)
    ]);
    
    return new Response(JSON.stringify({ 
        success: true, 
        message: `成功新增 ${exp} 點經驗值。`,
        newLevel: currentLevel,
        newExp: currentExp
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in add-exp API:', error);
    return new Response(JSON.stringify({ error: '伺服器內部錯誤，新增經驗值失敗。'}), { status: 500 });
  }
}