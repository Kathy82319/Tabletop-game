// functions/api/user.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
    }
    const { userId, displayName, pictureUrl } = await context.request.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), { status: 400 });
    }
    const db = context.env.DB;
    
    let user = await db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId).first();
    const expToNextLevel = 10;

    if (user) {
      const stmt = db.prepare('UPDATE Users SET line_display_name = ?, line_picture_url = ? WHERE user_id = ?');
      await stmt.bind(displayName, pictureUrl, userId).run();
      user = await db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId).first();
      return new Response(JSON.stringify({ ...user, expToNextLevel }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } else {
      const newUser = {
        user_id: userId, line_display_name: displayName || '未提供名稱', line_picture_url: pictureUrl || '',
        real_name: '', class: '無', level: 1, current_exp: 0, tag: null, perk: '無特殊優惠'
      };
      
      // 新增動態到 Activities 表
      const activityMessage = `新會員加入: ${newUser.line_display_name}`;
    await db.batch([
        db.prepare('INSERT INTO Users (user_id, line_display_name, line_picture_url, real_name, class, level, current_exp, perk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(newUser.user_id, newUser.line_display_name, newUser.line_picture_url, newUser.real_name, newUser.class, newUser.level, newUser.current_exp, newUser.perk),
        // 【修正】確保 Activities 插入包含 is_read 欄位
        db.prepare('INSERT INTO Activities (message, is_read) VALUES (?, 0)').bind(activityMessage)
    ]);
      
      return new Response(JSON.stringify({ ...newUser, expToNextLevel }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return new Response(JSON.stringify({ error: '處理使用者資料失敗。'}), { status: 500 });
  }
}