// functions/api/user.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// --- Google Sheets 工具函式 (保持不變) ---
async function getAccessToken(env) {
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = env;
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) throw new Error('缺少 Google 服務帳號的環境變數。');
    
    const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
    const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setAudience('https://oauth2.googleapis.com/token').setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setIssuedAt().setExpirationTime('1h').sign(privateKey);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type-jwt-bearer', assertion: jwt }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`從 Google 取得 access token 失敗: ${tokenData.error_description || tokenData.error}`);
    return tokenData.access_token;
}

async function addRowToSheet(env, sheetName, rowData) {
    const { GOOGLE_SHEET_ID } = env;
    if (!GOOGLE_SHEET_ID) throw new Error('缺少 GOOGLE_SHEET_ID 環境變數。');

    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);

    await sheet.addRow(rowData);
}
// --- 結束整合 Google Sheets 工具 ---

// ** START: 關鍵修正 - 新增職業福利對照表 **
const CLASS_PERKS = {
    '戰士': '購買桌遊95折',
    '盜賊': '租借遊戲95折',
    '法師': '單點飲料折抵5元',
    '牧師': '預約額外折扣5元',
    '無': '無特殊優惠'
};
// ** END: 關鍵修正 **

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
    
    // ** START: 關鍵修正 - 動態獲取職業設定 **
    // 建立一個絕對 URL 來呼叫同一個 Worker 裡的其他端點
    const perksUrl = new URL(context.request.url);
    perksUrl.pathname = '/api/get-class-perks';
    const perksResponse = await fetch(perksUrl.toString());
    const CLASS_PERKS = await perksResponse.json();
    // ** END: 關鍵修正 **
    
    let user = await db.prepare('SELECT * FROM Users WHERE user_id = ?').bind(userId).first();

    const expToNextLevel = 10;

    if (user) {
      // 使用從 API 獲取的動態職業設定
      user.perk = CLASS_PERKS[user.class] || user.perk || '無特殊優惠';
      return new Response(JSON.stringify({ ...user, expToNextLevel }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } else {

      const newUser = {
        user_id: userId, line_display_name: displayName || '未提供名稱',
        line_picture_url: pictureUrl || '', class: '無', level: 1, current_exp: 0, tag: null
      };
      await db.prepare(
        'INSERT INTO Users (user_id, line_display_name, line_picture_url, class, level, current_exp) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newUser.user_id, newUser.line_display_name, newUser.line_picture_url, newUser.class, newUser.level, newUser.current_exp).run();
      
      context.waitUntil(
          addRowToSheet(context.env, '使用者列表', {
              user_id: newUser.user_id, line_display_name: newUser.line_display_name,
              line_picture_url: newUser.line_picture_url, class: newUser.class,
              level: newUser.level, current_exp: newUser.current_exp,
              created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
          }).catch(err => console.error("背景同步新使用者失敗:", err))
      );
      
      // ** START: 關鍵修正 - 新使用者也要有福利 **
      newUser.perk = '無特殊優惠';
      // ** END: 關鍵修正 **
      return new Response(JSON.stringify({ ...newUser, expToNextLevel }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return new Response(JSON.stringify({ error: '處理使用者資料失敗。'}), { status: 500 });
  }
}