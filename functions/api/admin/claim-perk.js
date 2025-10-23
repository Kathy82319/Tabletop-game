// functions/api/admin/claim-perk.js

export async function onRequest(context) {
  try {
    // 限制 POST 請求
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { userId } = await context.request.json();

    // --- 驗證 ---
    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: '缺少有效的使用者 ID' }), { status: 400 });
    }
    // --- 驗證結束 ---

    const db = context.env.DB;

    // 更新 perk_claimed_level 為使用者目前的 level
    // 使用 subquery (SELECT level ...) 來確保是用最新的等級更新
    const stmt = db.prepare(
      'UPDATE Users SET perk_claimed_level = (SELECT level FROM Users WHERE user_id = ?) WHERE user_id = ?'
    );
    const result = await stmt.bind(userId, userId).run();

    if (result.meta.changes === 0) {
        // 找不到使用者或更新失敗
        return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId} 或無法更新狀態` }), { status: 404 });
    }

    // (可選) 標記相關 Activity 為已讀 - 這裡用簡單的 LIKE 匹配訊息，您可能需要更精確的方式
    const userNameSubQuery = "(SELECT COALESCE(nickname, line_display_name) FROM Users WHERE user_id = ?)";
    const likePattern = `%${userNameSubQuery}%已升級%請記得提供%`;
    const markReadStmt = db.prepare(
        `UPDATE Activities SET is_read = 1 WHERE message LIKE ? AND is_read = 0`
    );
    // 我們可以非同步執行這個，不影響主要流程
    context.waitUntil(markReadStmt.bind(userId, likePattern).run().catch(err => console.error("標記升級通知已讀失敗:", err)));


    return new Response(JSON.stringify({ success: true, message: '已成功標記福利已領取！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in claim-perk API:', error);
    return new Response(JSON.stringify({ error: '標記福利時發生錯誤', details: error.message }), { status: 500 });
  }
}