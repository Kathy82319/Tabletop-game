// functions/api/user.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

async function syncSingleUserToSheet(env, newUser) {
    try {
        console.log('背景任務：開始同步新使用者資料...');
        const {
          GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID,
          USERS_SHEET_NAME
        } = env;

        const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
        const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
          .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
          .setAudience('https://oauth2.googleapis.com/token')
          .setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(privateKey);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth-grant-type:jwt-bearer', assertion: jwt }),
        });
        if (!tokenResponse.ok) throw new Error('背景同步(User)：從 Google 取得 access token 失敗。');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[USERS_SHEET_NAME];
        if (!sheet) throw new Error(`背景同步(User)：找不到名為 "${USERS_SHEET_NAME}" 的工作表。`);

        await sheet.addRow({
            user_id: newUser.user_id,
            line_display_name: newUser.line_display_name,
            line_picture_url: newUser.line_picture_url,
            class: newUser.class,
            level: newUser.level,
            current_exp: newUser.current_exp,
            created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        });
        console.log(`背景任務：新使用者 ${newUser.user_id} 資料同步成功！`);
    } catch (error) {
        console.error('背景同步新使用者失敗:', error);
    }
}

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

    // ** 關鍵修正：將下一級所需經驗固定為 10，確保前端顯示正確 **
    const expToNextLevel = 10;

    if (user) {
      // 如果是現有使用者
      user.perk = CLASS_PERKS[user.class] || '無特殊優惠';
      return new Response(JSON.stringify({ ...user, expToNextLevel }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } else {
      // 如果是新使用者
      const newUser = {
        user_id: userId, line_display_name: displayName || '未提供名稱',
        line_picture_url: pictureUrl || '', class: '無', level: 1, current_exp: 0
      };
      await db.prepare(
        'INSERT INTO Users (user_id, line_display_name, line_picture_url, class, level, current_exp) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newUser.user_id, newUser.line_display_name, newUser.line_picture_url, newUser.class, newUser.level, newUser.current_exp).run();
      
      context.waitUntil(syncSingleUserToSheet(context.env, newUser));
      
      newUser.perk = '無特殊優惠';
      return new Response(JSON.stringify({ ...newUser, expToNextLevel }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return new Response(JSON.stringify({ error: '處理使用者資料失敗。'}), { status: 500 });
  }
}