// functions/api/update-user-profile.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, nickname, phone, preferredGames } = await context.request.json();

    if (!userId || !nickname || !phone) {
      return new Response(JSON.stringify({ error: '使用者 ID、暱稱和電話為必填欄位。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // 準備更新指令
    const stmt = db.prepare(
      'UPDATE Users SET nickname = ?, phone = ?, preferred_games = ? WHERE user_id = ?'
    );
    const result = await stmt.bind(nickname, phone, preferredGames || '未提供', userId).run();
    
    // 檢查是否有成功更新到資料
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}，無法更新資料。` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: '成功更新冒險者登錄資料！' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-user-profile API:', error);
    const errorResponse = { error: '伺服器內部錯誤，更新資料失敗。', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}