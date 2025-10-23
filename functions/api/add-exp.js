// functions/api/add-exp.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    const { userId, expValue, reason } = await context.request.json();

    // --- 【驗證區塊】 --- (不變)
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
    // 【修改 1】查詢時加入 perk_claimed_level 和 nickname/line_display_name
    const userStmt = db.prepare('SELECT level, current_exp, perk_claimed_level, nickname, line_display_name FROM Users WHERE user_id = ?');
    let user = await userStmt.bind(userId).first();
    if (!user) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}` }), { status: 404 });
    }

    // --- 等級計算邏輯 (不變) ---
    let originalLevel = user.level; // 記下原始等級
    let perkClaimedLevel = user.perk_claimed_level || 0; // 取得已領取福利等級
    let currentLevel = user.level;
    let currentExp = user.current_exp + exp;
    const requiredExp = 10;
    while (currentExp >= requiredExp) {
      currentExp -= requiredExp;
      currentLevel += 1;
    }
    // --- 等級計算結束 ---

    const operations = [];

    // 1. 更新使用者等級和經驗值
    operations.push(
      db.prepare('UPDATE Users SET level = ?, current_exp = ? WHERE user_id = ?').bind(currentLevel, currentExp, userId)
    );

    // 2. 新增經驗值歷史紀錄
    operations.push(
      db.prepare('INSERT INTO ExpHistory (user_id, exp_added, reason) VALUES (?, ?, ?)').bind(userId, exp, reason)
    );

    // 【修改 2】檢查是否升級且未領取福利，如果是，則新增 Activity 通知
    if (currentLevel > originalLevel && currentLevel > perkClaimedLevel) {
        const userName = user.nickname || user.line_display_name || userId.substring(0, 6); // 取得用戶名稱顯示用
        const activityMessage = `${userName} 已升級至 LV ${currentLevel}！請記得提供升級福利。`;
        operations.push(
            // 插入未讀 (0) 的活動通知
            db.prepare('INSERT INTO Activities (message, is_read) VALUES (?, 0)').bind(activityMessage)
        );
    }

    // --- 批次執行所有資料庫操作 ---
    await db.batch(operations);

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