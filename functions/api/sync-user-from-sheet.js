// functions/api/sync-user-from-sheet.js
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
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`從 Google 取得 access token 失敗: ${tokenData.error_description || tokenData.error}`);
    return tokenData.access_token;
}

async function getSheet(env, sheetName) {
    const { GOOGLE_SHEET_ID } = env;
    if (!GOOGLE_SHEET_ID) throw new Error('缺少 GOOGLE_SHEET_ID 環境變數。');

    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);

    return sheet;
}
// --- 結束整合 Google Sheets 工具 ---

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response('Invalid request method.', { status: 405 });
        }

        const { userId } = await context.request.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), { status: 400 });
        }

        const db = context.env.DB;
        
        const sheet = await getSheet(context.env, '使用者列表');
        const rows = await sheet.getRows();
        
        const userRowFromSheet = rows.find(row => row.get('user_id') === userId);

        if (!userRowFromSheet) {
            return new Response(JSON.stringify({ error: `在 Google Sheet 中找不到使用者 ID: ${userId}` }), { status: 404 });
        }
        
        // ** START: 關鍵修正 - 為所有可能為空的欄位提供預設值 **
        const userData = {
            line_display_name: userRowFromSheet.get('line_display_name') || '未提供名稱',
            nickname: userRowFromSheet.get('nickname') || '',
            phone: userRowFromSheet.get('phone') || '',
            class: userRowFromSheet.get('class') || '無',
            level: Number(userRowFromSheet.get('level')) || 1,
            current_exp: Number(userRowFromSheet.get('current_exp')) || 0,
            tag: userRowFromSheet.get('tag') || ''
        };
        // ** END: 關鍵修正 **

        const stmt = db.prepare(
            `UPDATE Users SET line_display_name = ?, nickname = ?, phone = ?, class = ?, 
                level = ?, current_exp = ?, tag = ? WHERE user_id = ?`
        );
        await stmt.bind(
            userData.line_display_name, userData.nickname, userData.phone, userData.class,
            userData.level, userData.current_exp, userData.tag, userId
        ).run();

        return new Response(JSON.stringify({ success: true, message: '成功從 Google Sheet 同步單筆使用者資料！' }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in sync-user-from-sheet API:', error);
        return new Response(JSON.stringify({ error: '同步失敗。', details: error.message }), {
            status: 500
        });
    }
}