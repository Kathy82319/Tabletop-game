// functions/api/user.js
// ** 引入我們建立的共用工具 **
import { addRowToSheet } from '../_google-sheets-utils.js';

// ** 這段已不再需要，因為邏輯已移至共用工具中 **
// async function syncSingleUserToSheet(env, newUser) { ... }

const CLASS_PERKS = {
    '戰士': '被動技能：購買桌遊享 95 折優惠。',
    '盜賊': '被動技能：租借桌遊享 95 折優惠。',
    '法師': '被動技能：單點宇宙飲品可折抵 5 元。',
    '牧師': '被動技能：預約場地費可額外折扣 5 元。',
};

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    const { userId, displayName, pictureUrl } = await context.request.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), { status: 400 });
    }
    const db = context.env.DB;
    
    let user = await db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId).first();

    const expToNextLevel = 10; // 固定升級級距為 10

    if (user) {
      // 如果是現有使用者
      user.perk = CLASS_PERKS[user.class] || '無特殊優惠';
      return new Response(JSON.stringify({ ...user, expToNextLevel }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } else {
      // 如果是新使用者
      const newUser = {
        user_id: userId,
        line_display_name: displayName || '未提供名稱',
        line_picture_url: pictureUrl || '',
        class: '無',
        level: 1,
        current_exp: 0,
        tag: null // 確保新使用者有 tag 欄位
      };
      await db.prepare(
        'INSERT INTO Users (user_id, line_display_name, line_picture_url, class, level, current_exp) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newUser.user_id, newUser.line_display_name, newUser.line_picture_url, newUser.class, newUser.level, newUser.current_exp).run();
      
      // ** 使用共用工具觸發背景同步 **
      context.waitUntil(
          addRowToSheet(context.env, '使用者列表', { // 您的工作表名稱
              user_id: newUser.user_id,
              line_display_name: newUser.line_display_name,
              line_picture_url: newUser.line_picture_url,
              class: newUser.class,
              level: newUser.level,
              current_exp: newUser.current_exp,
              created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
          }).catch(err => console.error("背景同步新使用者失敗:", err))
      );
      
      newUser.perk = '無特殊優惠';
      return new Response(JSON.stringify({ ...newUser, expToNextLevel }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return new Response(JSON.stringify({ error: '處理使用者資料失敗。'}), { status: 500 });
  }
}