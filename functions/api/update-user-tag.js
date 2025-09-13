// functions/api/update-user-tag.js
import { updateRowInSheet } from '../utils/google-sheets-utils.js';

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, tag } = await context.request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    // 1. 更新 D1 資料庫
    const stmt = db.prepare('UPDATE Users SET tag = ? WHERE user_id = ?');
    const result = await stmt.bind(tag, userId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}，無法更新標籤。` }), {
        status: 404
      });
    }

    // 2. 觸發背景任務，將變動同步到 Google Sheet
    context.waitUntil(
        updateRowInSheet(
            context.env, 
            '使用者列表',  // 您的工作表名稱
            'user_id',     // 用來匹配的欄位
            userId,        // 要匹配的值
            { tag: tag }   // 要更新的資料
        ).catch(err => console.error("背景同步使用者標籤失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '成功更新使用者標籤！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-user-tag API:', error);
    return new Response(JSON.stringify({ error: '更新標籤失敗。' }), {
      status: 500,
    });
  }
}