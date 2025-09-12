// functions/api/user.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// =================================================================
// 核心邏輯：將「單筆」新使用者資料非同步同步到 Google Sheet
// =================================================================
async function syncSingleUserToSheet(env, newUser) {
    try {
        console.log('背景任務：開始同步新使用者資料...');
        const {
          GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID,
          USERS_SHEET_NAME // 我們之前為手動同步建立的環境變數
        } = env;

        // 驗證並連接到 Google Sheets
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
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
        });
        if (!tokenResponse.ok) throw new Error('背景同步(User)：從 Google 取得 access token 失敗。');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[USERS_SHEET_NAME];
        if (!sheet) throw new Error(`背景同步(User)：找不到名為 "${USERS_SHEET_NAME}" 的工作表。`);

        // 使用 addRow 新增一行資料
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

// ** 新增：定義職業與優惠的對應關係 **
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

    if (user) {
      // 如果是現有使用者
      const expToNextLevel = user.level * 10;
      // ** 關鍵改動：根據職業，加上優惠說明 **
      user.perk = CLASS_PERKS[user.class] || '無特殊優惠';
      
      return new Response(JSON.stringify({ ...user, expToNextLevel }), { status: 200 });

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
      
      const expToNextLevel = newUser.level * 10;
      // ** 關鍵改動：新使用者也加上優惠說明 **
      newUser.perk = '無特殊優惠';

      return new Response(JSON.stringify({ ...newUser, expToNextLevel }), { status: 201 });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return new Response(JSON.stringify({ error: '處理使用者資料失敗。'}), { status: 500 });
  }
}

// =================================================================
// 主要 API 處理器
// =================================================================
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, displayName, pictureUrl } = await context.request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // 1. 嘗試從資料庫中尋找使用者
    let stmt = db.prepare('SELECT * FROM Users WHERE user_id = ?');
    let user = await stmt.bind(userId).first();

    // 2. 檢查使用者是否存在
    if (user) {
      // 如果使用者已存在，直接回傳他的資料
      // 我們也需要為現有使用者計算升級經驗值
      const expToNextLevel = 100 * Math.pow(user.level, 1.5);
      return new Response(JSON.stringify({
          ...user,
          expToNextLevel: Math.floor(expToNextLevel)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // 3. 如果使用者不存在，建立新會員
      const newUser = {
        user_id: userId,
        line_display_name: displayName || '未提供名稱',
        line_picture_url: pictureUrl || '',
        class: '無',
        level: 1,
        current_exp: 0
      };

      stmt = db.prepare(
        'INSERT INTO Users (user_id, line_display_name, line_picture_url, class, level, current_exp) VALUES (?, ?, ?, ?, ?, ?)'
      );
      await stmt.bind(
        newUser.user_id, newUser.line_display_name, newUser.line_picture_url,
        newUser.class, newUser.level, newUser.current_exp
      ).run();

      // ** 關鍵改動：觸發背景同步任務 **
      context.waitUntil(syncSingleUserToSheet(context.env, newUser));

      // 4. 立即回傳剛建立的新會員資料給前端
      const expToNextLevel = 100 * Math.pow(newUser.level, 1.5);
      
      return new Response(JSON.stringify({
        ...newUser,
        expToNextLevel: Math.floor(expToNextLevel)
      }), {
        status: 201, // 201 Created
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in user API:', error);
    const errorResponse = { error: '伺服器內部錯誤，處理使用者資料失敗。', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}