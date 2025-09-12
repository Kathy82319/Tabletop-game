// functions/api/update-user-profile.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

/**
 * 核心邏輯：將單筆使用者個人資料的更新，非同步地同步到 Google Sheet
 * @param {object} env - Cloudflare 環境變數
 * @param {object} userData - 包含使用者資料的物件 { userId, nickname, phone, preferredGames }
 */
async function syncProfileUpdateToSheet(env, userData) {
    try {
        console.log(`背景任務：開始同步使用者 ${userData.userId} 的個人資料...`);
        const {
          GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID,
          USERS_SHEET_NAME // 確保此環境變數已在 Cloudflare 設定
        } = env;

        if (!USERS_SHEET_NAME) {
            console.error('背景同步(Profile Update)失敗：缺少 USERS_SHEET_NAME 環境變數。');
            return;
        }

        // 1. 驗證並連接到 Google Sheets (這段邏輯與其他檔案相同)
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

        // 2. 找到需要更新的那一列
        const rows = await sheet.getRows();
        const userRow = rows.find(row => row.get('user_id') === userData.userId);

        if (userRow) {
            // 3. 更新指定欄位的資料
            userRow.set('nickname', userData.nickname);
            userRow.set('phone', userData.phone);
            userRow.set('preferred_games', userData.preferredGames);
            
            // 4. 儲存變更
            await userRow.save();
            console.log(`背景任務：成功更新使用者 ${userData.userId} 在 Google Sheet 的資料。`);
        } else {
            console.warn(`背景任務：在 Google Sheet 中找不到 user_id 為 ${userData.userId} 的使用者，無法更新。`);
        }

    } catch (error) {
        console.error('背景同步使用者個人資料失敗:', error);
    }
}


// 主要的 API 請求處理器
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
    
    // 更新 D1 資料庫 (這部分不變)
    const stmt = db.prepare(
      'UPDATE Users SET nickname = ?, phone = ?, preferred_games = ? WHERE user_id = ?'
    );
    const result = await stmt.bind(nickname, phone, preferredGames || '未提供', userId).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}，無法更新資料。` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ** 關鍵改動：觸發背景同步任務 **
    const userDataToSync = {
        userId: userId,
        nickname: nickname,
        phone: phone,
        preferredGames: preferredGames || '未提供'
    };
    context.waitUntil(syncProfileUpdateToSheet(context.env, userDataToSync));

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