// functions/api/admin/update-boardgame-details.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// --- Google Sheets 工具函式 ---
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
// --- Google Sheets 工具函式結束 ---

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }
    
    const requestBody = await context.request.json();
// --- 【新增】伺服器端驗證 ---
if (!requestBody.gameId || typeof requestBody.name !== 'string' || requestBody.name.trim() === '') {
    return new Response(JSON.stringify({ error: '遊戲 ID 與名稱為必填。' }), { status: 400 });
}
if (requestBody.name.length > 100) {
    return new Response(JSON.stringify({ error: '遊戲名稱不可超過 100 字。' }), { status: 400 });
}
const minPlayers = Number(requestBody.min_players);
if (isNaN(minPlayers) || minPlayers < 1 || minPlayers > 100) {
    return new Response(JSON.stringify({ error: '最少人數必須是 1-100 的數字。' }), { status: 400 });
}    
    const { gameId } = requestBody;

    if (!gameId || !requestBody.name) {
      return new Response(JSON.stringify({ error: '缺少遊戲 ID 或名稱。' }), { status: 400 });
    }
 
    const db = context.env.DB;
    
    const stmt = db.prepare(
      `UPDATE BoardGames SET
         name = ?, description = ?, image_url = ?, image_url_2 = ?, image_url_3 = ?, tags = ?,
         min_players = ?, max_players = ?, difficulty = ?,
         total_stock = ?, for_rent_stock = ?, for_sale_stock = ?,
         sale_price = ?, rent_price = ?, deposit = ?, late_fee_per_day = ?,
         is_visible = ?, supplementary_info = ?
       WHERE game_id = ?`
    );
    const for_sale_stock = (Number(requestBody.total_stock) || 0) - (Number(requestBody.for_rent_stock) || 0);

    const result = await stmt.bind(
        requestBody.name, requestBody.description || '', requestBody.image_url || '', requestBody.image_url_2 || '', requestBody.image_url_3 || '', requestBody.tags || '',
        Number(requestBody.min_players) || 1, Number(requestBody.max_players) || 1, requestBody.difficulty || '普通',
        Number(requestBody.total_stock) || 0, Number(requestBody.for_rent_stock) || 0, for_sale_stock,
        Number(requestBody.sale_price) || 0, Number(requestBody.rent_price) || 0,
        Number(requestBody.deposit) || 0, Number(requestBody.late_fee_per_day) || 50,
        requestBody.is_visible ? 1 : 0, requestBody.supplementary_info || '',
        gameId
    ).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${gameId}，無法更新。` }), { status: 404 });
    }

    // 準備要同步到 Sheet 的資料
    const { gameId: id, ...dataToSync } = requestBody; 
    dataToSync.is_visible = dataToSync.is_visible ? 'TRUE' : 'FALSE';
    dataToSync.for_sale_stock = for_sale_stock;


    const sheetName = context.env.BOARDGAMES_SHEET_NAME;
    
    if (!sheetName) {
        console.error("背景同步任務無法啟動: 缺少 `BOARDGAMES_SHEET_NAME` 環境變數。請至 Cloudflare Pages 後台設定。");
    } else {
        console.log(`[背景同步啟動] 準備更新工作表 "${sheetName}" 中 game_id 為 ${gameId} 的資料。`);
        context.waitUntil(
            updateRowInSheet(context.env, sheetName, 'game_id', gameId, dataToSync)
            .catch(err => {
                console.error(`[背景同步失敗] 更新 game_id ${gameId} 時發生嚴重錯誤:`, err);
            })
        );
    }
    return new Response(JSON.stringify({ success: true, message: '成功更新桌遊詳細資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-boardgame-details API:', error);
    return new Response(JSON.stringify({ error: '更新桌遊資訊失敗。', details: error.message }), { status: 500 });
  }
}