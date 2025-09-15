// functions/api/update-user-details.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// --- Google Sheets 工具函式 (保持不變) ---
async function getAccessToken(env) {
    // ... (此函式內容不變)
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

async function updateRowInSheet(env, sheetName, matchColumn, matchValue, updateData) {
    // ... (此函式內容不變)
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
        for (const key in updateData) {
            rowToUpdate.set(key, updateData[key]);
        }
        await rowToUpdate.save();
    } else {
        console.warn(`在工作表 "${sheetName}" 中找不到 ${matchColumn} 為 "${matchValue}" 的資料列，無法更新。`);
    }
}
// --- 結束 Google Sheets 工具函式 ---

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // ** START: 關鍵修正 - 新增接收 perk 欄位 **
    const { userId, level, current_exp, tag, user_class, perk } = await context.request.json();
    // ** END: 關鍵修正 **

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    // ** START: 關鍵修正 - 新增更新 perk 欄位 **
    const stmt = db.prepare('UPDATE Users SET level = ?, current_exp = ?, tag = ?, class = ?, perk = ? WHERE user_id = ?');
    const result = await stmt.bind(Number(level) || 1, Number(current_exp) || 0, tag, user_class, perk, userId).run();
    // ** END: 關鍵修正 **

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}，無法更新資料。` }), {
        status: 404
      });
    }

    const dataToSync = {
        level: level,
        current_exp: current_exp,
        tag: tag,
        class: user_class,
        // ** START: 關鍵修正 - 同步 perk 至 Google Sheet **
        perk: perk
        // ** END: 關鍵修正 **
    };
    context.waitUntil(
        updateRowInSheet(context.env, '使用者列表', 'user_id', userId, dataToSync)
        .catch(err => console.error("背景同步使用者詳細資料失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '成功更新使用者資料！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-user-details API:', error);
    return new Response(JSON.stringify({ error: '更新資料失敗。' }), {
      status: 500,
    });
  }
}