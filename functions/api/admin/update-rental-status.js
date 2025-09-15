// functions/api/admin/update-rental-status.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// --- 內建 Google Sheets 工具 (用於背景同步) ---
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
async function updateRowInSheet(env, sheetName, matchColumn, matchValue, updateData) {
    const { GOOGLE_SHEET_ID } = env;
    if (!GOOGLE_SHEET_ID) throw new Error('缺少 GOOGLE_SHEET_ID 環境變數。');
    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(row => row.get(matchColumn) == matchValue);
    if (rowToUpdate) {
        rowToUpdate.assign(updateData);
        await rowToUpdate.save();
    } else {
        console.warn(`在工作表 "${sheetName}" 中找不到 ${matchColumn} 為 "${matchValue}" 的資料列，無法更新。`);
    }
}
// --- 內建 Google Sheets 工具結束 ---

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { rentalId, status } = await context.request.json();
    if (!rentalId || !status) {
      return new Response(JSON.stringify({ error: '缺少租借 ID 或狀態。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    // 準備更新的資料
    const updateValues = {
        status: status,
        return_date: status === 'returned' ? new Date().toISOString().split('T')[0] : null
    };
    
    const stmt = db.prepare('UPDATE Rentals SET status = ?, return_date = ? WHERE rental_id = ?');
    const result = await stmt.bind(updateValues.status, updateValues.return_date, rentalId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到租借 ID: ${rentalId}，無法更新狀態。` }), {
        status: 404
      });
    }

    // 觸發背景任務，將狀態變動同步到 Google Sheet
    context.waitUntil(
        updateRowInSheet(
            context.env, 
            'Rentals', // 您的工作表名稱
            'rental_id',       // 用來匹配的欄位
            rentalId,          // 要匹配的值
            { status: updateValues.status, return_date: updateValues.return_date }
        ).catch(err => console.error("背景同步租借狀態失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '成功更新租借狀態！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-rental-status API:', error);
    return new Response(JSON.stringify({ error: '更新租借狀態失敗。' }), {
      status: 500,
    });
  }
}