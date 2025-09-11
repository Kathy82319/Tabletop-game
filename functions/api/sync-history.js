// functions/api/sync-history.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// 這是可重複使用的核心同步邏輯
async function runSync(env) {
    // 1. 取得所有需要的環境變數
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID,
      EXP_HISTORY_SHEET_NAME, // 我們新加的變數
      DB // D1 資料庫
    } = env;

    if (!EXP_HISTORY_SHEET_NAME) {
        throw new Error('Missing EXP_HISTORY_SHEET_NAME environment variable.');
    }
    
    // 2. 從 D1 資料庫讀取所有歷史紀錄
    const stmt = DB.prepare('SELECT * FROM ExpHistory ORDER BY created_at DESC');
    const { results } = await stmt.all();

    if (!results || results.length === 0) {
        console.log('No new history to sync.');
        return { success: true, message: '資料庫中沒有歷史紀錄可同步。' };
    }

    // 3. 驗證並連接到 Google Sheets (這段邏輯和 games.js 相同)
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
    if (!tokenResponse.ok) throw new Error('Failed to fetch access token from Google.');
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);

    // 4. 寫入資料到 Google Sheets
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[EXP_HISTORY_SHEET_NAME];
    if (!sheet) {
        throw new Error(`在 Google Sheets 中找不到名為 "${EXP_HISTORY_SHEET_NAME}" 的工作表。`);
    }

    await sheet.clear(); // 清空舊資料
    await sheet.setHeaderRow(['history_id', 'user_id', 'exp_added', 'reason', 'staff_id', 'created_at']); // 寫入標題列
    await sheet.addRows(results); // 將從 D1 讀取到的所有資料一次性加入

    return { success: true, message: `成功同步了 ${results.length} 筆紀錄。` };
}


// 這是 API 端點的處理器
export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response('Invalid request method.', { status: 405 });
        }
        
        const result = await runSync(context.env);
        
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in sync-history API:', error);
        const errorResponse = { error: '同步失敗。', details: error.message };
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}