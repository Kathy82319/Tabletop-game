// functions/api/update-user-profile.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

async function syncProfileUpdateToSheet(env, userData) {
    try {
        console.log(`背景任務：開始同步使用者 ${userData.userId} 的個人資料...`);
        const {
          GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID,
          USERS_SHEET_NAME
        } = env;

        if (!USERS_SHEET_NAME) {
            console.error('背景同步(Profile Update)失敗：缺少 USERS_SHEET_NAME 環境變數。');
            return;
        }

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

        if (!tokenResponse.ok) throw new Error('背景同步(Profile Update)：從 Google 取得 access token 失敗。');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[USERS_SHEET_NAME];
        if (!sheet) throw new Error(`背景同步(Profile Update)：找不到名為 "${USERS_SHEET_NAME}" 的工作表。`);

        const rows = await sheet.getRows();
        const userRow = rows.find(row => row.get('user_id') === userData.userId);

        if (userRow) {
            // ** 關鍵改動：使用 assign 一次性更新所有需要的欄位 **
            userRow.assign({
                'nickname': userData.nickname,
                'phone': userData.phone,
                'preferred_games': userData.preferredGames,
                'line_display_name': userData.displayName,    // 更新 LINE 名稱
                'line_picture_url': userData.pictureUrl       // 更新 LINE 頭像
            });
            
            await userRow.save();
            console.log(`背景任務：成功更新使用者 ${userData.userId} 在 Google Sheet 的資料。`);
        } else {
            console.warn(`背景任務：在 Google Sheet 中找不到 user_id 為 ${userData.userId} 的使用者，無法更新。`);
        }

    } catch (error) {
        console.error('背景同步使用者個人資料失敗:', error);
    }
}


export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // ** 關鍵改動：接收 displayName 和 pictureUrl **
    const { userId, nickname, phone, preferredGames, displayName, pictureUrl } = await context.request.json();

    if (!userId || !nickname || !phone) {
      return new Response(JSON.stringify({ error: '使用者 ID、暱稱和電話為必填欄位。' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // ** 關鍵改動：更新 D1 資料庫的指令 **
    const stmt = db.prepare(
      'UPDATE Users SET nickname = ?, phone = ?, preferred_games = ?, line_display_name = ?, line_picture_url = ? WHERE user_id = ?'
    );
    const result = await stmt.bind(
        nickname, 
        phone, 
        preferredGames || '未提供', 
        displayName, // 綁定 LINE 名稱
        pictureUrl,  // 綁定 LINE 頭像
        userId
    ).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}，無法更新資料。` }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // ** 關鍵改動：將新資料傳遞給背景同步任務 **
    const userDataToSync = { userId, nickname, phone, preferredGames: preferredGames || '未提供', displayName, pictureUrl };
    context.waitUntil(syncProfileUpdateToSheet(context.env, userDataToSync));

    return new Response(JSON.stringify({ 
        success: true, 
        message: '成功更新冒險者登錄資料！' 
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-user-profile API:', error);
    const errorResponse = { error: '伺服器內部錯誤，更新資料失敗。', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}