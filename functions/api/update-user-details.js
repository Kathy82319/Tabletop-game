// functions/api/update-user-details.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// --- Google Sheets 工具函式 ---
async function getAccessToken(env) {
    // ** START: 關鍵修正 - 增加詳細的認證日誌 **
    console.log("[Auth] 開始 getAccessToken 流程");

    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = env;

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) throw new Error('環境變數 GOOGLE_SERVICE_ACCOUNT_EMAIL 未設定或為空。');
    if (!GOOGLE_PRIVATE_KEY) throw new Error('環境變數 GOOGLE_PRIVATE_KEY 未設定或為空。');
    
    // 檢查 Email 格式是否正確
    console.log(`[Auth] 讀取到的服務帳號 Email: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL.endsWith('gserviceaccount.com')) {
        console.warn("[Auth] 警告：服務帳號 Email 格式看起來不正確。");
    }

    // 檢查私鑰是否包含標準的開頭和結尾
    if (!GOOGLE_PRIVATE_KEY.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error("[Auth] 錯誤：私鑰內容不完整，缺少 '-----BEGIN PRIVATE KEY-----'");
    }

    // 將 Cloudflare 環境變數中的 \\n 替換為實際的換行符 \n
    const formattedPrivateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    console.log("[Auth] 準備使用 jose.importPKCS8 匯入私鑰");
    const privateKey = await jose.importPKCS8(formattedPrivateKey, 'RS256');
    console.log("[Auth] 私鑰匯入成功");

    const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setAudience('https://oauth2.googleapis.com/token')
      .setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    console.log("[Auth] JWT 簽署成功");

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type-jwt-bearer',
        assertion: jwt
      }),
    });
    console.log(`[Auth] 已向 Google 發送 Token 請求，回應狀態: ${tokenResponse.status}`);

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        console.error("[Auth] 從 Google 獲取 Access Token 失敗，詳細錯誤:", tokenData);
        throw new Error(`從 Google 取得 access token 失敗: ${tokenData.error_description || tokenData.error}`);
    }
    
    console.log("[Auth] 成功獲取 Access Token");
    return tokenData.access_token;
    // ** END: 關鍵修正 **
}

// ** START: 關鍵修正 - 強化 updateRowInSheet 函式 **
async function updateRowInSheet(env, sheetName, matchColumn, matchValue, updateData) {
    const { GOOGLE_SHEET_ID } = env;
    if (!GOOGLE_SHEET_ID) throw new Error('缺少 GOOGLE_SHEET_ID 環境變數。');

    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);

    // 預先載入儲存格資料，這對後續的 .save() 很重要
    await sheet.loadCells();
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(row => row.get(matchColumn) == matchValue);

    if (rowToUpdate) {
        console.log(`[背景任務] 找到要更新的列 (User: ${matchValue})，準備寫入新資料...`);
        // 使用 .assign() 方法一次性更新所有欄位，比 .set() 更穩定
        rowToUpdate.assign(updateData);
        // 呼叫 save() 將變更寫回 Google Sheet
        await rowToUpdate.save();
        console.log(`[背景任務] 成功更新 Google Sheet 中的使用者: ${matchValue}`);
    } else {
        console.warn(`[背景任務] 在工作表 "${sheetName}" 中找不到 ${matchColumn} 為 "${matchValue}" 的資料列，無法更新。`);
    }
}
// ** END: 關鍵修正 **

// --- 主要 API 邏輯 (保持不變) ---
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, level, current_exp, tag, user_class, perk } = await context.request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    console.log(`[API] 正在更新 D1 資料庫中的使用者: ${userId}`);
    const stmt = db.prepare('UPDATE Users SET level = ?, current_exp = ?, tag = ?, class = ?, perk = ? WHERE user_id = ?');
    const result = await stmt.bind(Number(level) || 1, Number(current_exp) || 0, tag, user_class, perk, userId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `在 D1 中找不到使用者 ID: ${userId}，無法更新資料。` }), {
        status: 404
      });
    }

    console.log(`[API] 已觸發背景任務，將更新 Google Sheet 中的使用者: ${userId}`);
    const dataToSync = {
        level: level,
        current_exp: current_exp,
        tag: tag,
        class: user_class,
        perk: perk
    };
    
    context.waitUntil(
        updateRowInSheet(context.env, '使用者列表', 'user_id', userId, dataToSync)
        .catch(err => console.error(`背景同步 Google Sheet 失敗 (使用者: ${userId}):`, err))
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