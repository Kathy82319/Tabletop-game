// functions/api/sync-users.js

// 確保這兩行 import 存在於檔案最上方
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// 核心同步邏輯
async function runUserSync(env) {
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID,
      USERS_SHEET_NAME, // 我們新增的環境變數
      DB
    } = env;

    // 增加對所有必要環境變數的檢查
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID || !USERS_SHEET_NAME) {
        throw new Error('一個或多個必要的 Google Sheets 環境變數未設定。');
    }
    
    // 從 D1 讀取所有使用者資料
    const { results } = await DB.prepare('SELECT * FROM Users ORDER BY created_at DESC').all();

    if (!results || results.length === 0) {
        return { success: true, message: '資料庫中沒有使用者可同步。' };
    }

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
    if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.json();
        throw new Error(`從 Google 取得 access token 失敗: ${errorBody.error_description}`);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);

    // 寫入資料到 Google Sheets
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[USERS_SHEET_NAME];
    if (!sheet) {
        throw new Error(`在 Google Sheets 中找不到名為 "${USERS_SHEET_NAME}" 的工作表。`);
    }

    await sheet.clear(); // 清空舊資料
    // 確保標題列與你的 CSV 和資料庫欄位完全對應
    await sheet.setHeaderRow(['user_id', 'line_display_name', 'line_picture_url', 'class', 'level', 'current_exp', 'created_at']);
    await sheet.addRows(results); // 將資料寫入

    return { success: true, message: `成功同步了 ${results.length} 筆使用者資料。` };
}

// API 端點的處理器
export async function onRequest(context) {
    try {
        // 只允許 POST 方法
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '僅允許 POST 請求' }), {
                status: 405, headers: { 'Content-Type': 'application/json' }
            });
        }
        // 執行同步
        const result = await runUserSync(context.env);
        return new Response(JSON.stringify(result), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error in sync-users API:', error.stack);
        return new Response(JSON.stringify({ error: '同步失敗。', details: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}