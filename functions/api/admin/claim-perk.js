// functions/api/admin/claim-perk.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }

    const { userId } = await context.request.json();

    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: '缺少有效的使用者 ID' }), { status: 400 });
    }

    const db = context.env.DB;

    const stmt = db.prepare(
      'UPDATE Users SET perk_claimed_level = (SELECT level FROM Users WHERE user_id = ?) WHERE user_id = ?'
    );
    const result = await stmt.bind(userId, userId).run();

    if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId} 或無法更新狀態` }), { status: 404 });
    }

    const userNameSubQuery = "(SELECT COALESCE(nickname, line_display_name) FROM Users WHERE user_id = ?)";
    const likePattern = `%${userNameSubQuery}%已升級%請記得提供%`;
    const markReadStmt = db.prepare(
        `UPDATE Activities SET is_read = 1 WHERE message LIKE ? AND is_read = 0`
    );
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
