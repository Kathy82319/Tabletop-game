// functions/api/update-user-profile.js
import { verifyLiffUser } from './_lib/auth.js';

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const profile = await verifyLiffUser(context.request);
    if (!profile) {
      return new Response(JSON.stringify({ error: '未登入或驗證失敗。' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = profile.userId;
    const displayName = profile.displayName;
    const pictureUrl = profile.pictureUrl || '';

    const body = await context.request.json();
    const { realName, nickname, phone, email, preferredGames } = body;

    const errors = [];
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.length > 50) {
        errors.push('暱稱為必填，且長度不可超過 50 字。');
    }
    if (!phone || !/^\d{10}$/.test(phone)) {
        errors.push('請輸入有效的 10 碼手機號碼。');
    }
    if (realName && (typeof realName !== 'string' || realName.length > 50)) {
        errors.push('真實姓名長度不可超過 50 字。');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('請輸入有效的電子信箱格式。');
    }

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
        });
    }

    const db = context.env.DB;
    
    const preferredGamesString = Array.isArray(preferredGames) ? preferredGames.join(',') : preferredGames || '未提供';

    const stmt = db.prepare(
      'UPDATE Users SET real_name = ?, nickname = ?, phone = ?, email = ?, preferred_games = ?, line_display_name = ?, line_picture_url = ? WHERE user_id = ?'
    );
    const result = await stmt.bind(
        realName || '',
        nickname, 
        phone, 
        email || '',
        preferredGamesString,
        displayName,
        pictureUrl,
        userId
    ).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}，無法更新資料。` }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: '成功更新冒險者登錄資料！' 
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-user-profile API:', error);
    const errorResponse = { error: '伺服器內部錯誤，更新資料失敗。' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
