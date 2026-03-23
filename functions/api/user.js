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
      // 1. 更新使用者的 LINE 顯示名稱與頭像
      const stmt = db.prepare('UPDATE Users SET line_display_name = ?, line_picture_url = ? WHERE user_id = ?');
      await stmt.bind(displayName, pictureUrl, userId).run();
      user = await db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId).first();
      
      // 2. 拉取該會員的多筆裝備、技能、稱號與成就
      const { results: assets } = await db.prepare(`
          SELECT ga.type, ga.name, ua.custom_description, ga.description as default_desc, ga.icon_url
          FROM UserAssets ua
          JOIN GameAssets ga ON ua.asset_id = ga.id
          WHERE ua.user_id = ?
      `).bind(userId).all();
      
      user.user_assets = assets || [];

      return new Response(JSON.stringify({ ...user, expToNextLevel }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } else {
      // 處理新會員註冊
      const newUser = {
        user_id: userId, line_display_name: displayName || '未提供名稱', line_picture_url: pictureUrl || '',
        real_name: '', class: '無', level: 1, current_exp: 0, tag: null, perk: '無特殊優惠',
        user_assets: [] // 新會員預設沒有任何裝備與技能
      };
      
      const activityMessage = `新會員加入: ${newUser.line_display_name}`;
      await db.batch([
          db.prepare('INSERT INTO Users (user_id, line_display_name, line_picture_url, real_name, class, level, current_exp, perk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(newUser.user_id, newUser.line_display_name, newUser.line_picture_url, newUser.real_name, newUser.class, newUser.level, newUser.current_exp, newUser.perk),
          db.prepare('INSERT INTO Activities (message, is_read) VALUES (?, 0)').bind(activityMessage)
      ]);
      
      return new Response(JSON.stringify({ ...newUser, expToNextLevel }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return new Response(JSON.stringify({ error: '處理使用者資料失敗。'}), { status: 500 });
  }
}