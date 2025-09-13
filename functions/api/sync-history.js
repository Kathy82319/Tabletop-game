// functions/api/sync-history.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

async function runSync(env) {
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID,
      EXP_HISTORY_SHEET_NAME,
      DB
    } = env;

    if (!EXP_HISTORY_SHEET_NAME) {
        throw new Error('缺少 EXP_HISTORY_SHEET_NAME 環境變數。');
    }
    
    const { results } = await DB.prepare('SELECT * FROM ExpHistory ORDER BY created_at DESC').all();

    if (!results || results.length === 0) {
        return { success: true, message: '資料庫中沒有歷史紀錄可同步。' };
    }

    // --- 獨立的 Token 獲取邏輯，帶有詳細錯誤處理 ---
    let accessToken;
    try {
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
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth-grant-type-jwt-bearer', assertion: jwt }),
        });
        
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            // 如果請求失敗，拋出從 Google API 收到的具體錯誤描述
            throw new Error(tokenData.error_description || '從 Google 取得 access token 時發生未知錯誤。');
        }
        accessToken = tokenData.access_token;
    } catch (e) {
        console.error("獲取 Access Token 失敗:", e);
        // 重新拋出一個更清晰的錯誤，以便上層捕捉
        throw new Error(`從 Google 取得 access token 失敗: ${e.message}`);
    }
    
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[EXP_HISTORY_SHEET_NAME];
    if (!sheet) {
        throw new Error(`在 Google Sheets 中找不到名為 "${EXP_HISTORY_SHEET_NAME}" 的工作表。`);
    }

    await sheet.clear();
    await sheet.setHeaderRow(['history_id', 'user_id', 'exp_added', 'reason', 'staff_id', 'created_at']);
    await sheet.addRows(results);

    return { success: true, message: `成功同步了 ${results.length} 筆紀錄。` };
}

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '僅允許 POST 請求', details: '請求方法錯誤' }), { status: 405 });
        }
        
        const result = await runSync(context.env);
        
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in sync-history API:', error);
        const errorResponse = { 
            error: '同步失敗。', 
            details: error.message // 直接使用我們在 runSync 中拋出的、更清晰的錯誤訊息
        };
        
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}