// functions/api/admin/update-rental-status.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// ** Google Sheets 工具函式 **
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


export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // 接收所有欄位的資料
    const { 
        gameId, name, description, image_url, tags, 
        min_players, max_players, difficulty, 
        total_stock, for_rent_stock, 
        sale_price, rent_price, deposit, late_fee_per_day,
        is_visible 
    } = await context.request.json();

    if (!gameId || !name) {
      return new Response(JSON.stringify({ error: '缺少遊戲 ID 或名稱。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    // 1. 更新 D1 資料庫
    const stmt = db.prepare(
      `UPDATE BoardGames SET 
         name = ?, description = ?, image_url = ?, tags = ?, 
         min_players = ?, max_players = ?, difficulty = ?, 
         total_stock = ?, for_rent_stock = ?, 
         sale_price = ?, rent_price = ?, deposit = ?, late_fee_per_day = ?, 
         is_visible = ? 
       WHERE game_id = ?`
    );
    const result = await stmt.bind(
        name, description, image_url, tags,
        Number(min_players) || 1, Number(max_players) || 1, difficulty,
        Number(total_stock) || 0, Number(for_rent_stock) || 0,
        Number(sale_price) || 0, Number(rent_price) || 0,
        Number(deposit) || 0, Number(late_fee_per_day) || 50,
        is_visible ? 1 : 0,
        gameId
    ).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: `找不到遊戲 ID: ${gameId}，無法更新。` }), { status: 404 });
    }

    // 2. 準備要同步到 Google Sheet 的資料
    const dataToSync = {
        name, description, image_url, tags,
        min_players, max_players, difficulty,
        total_stock, for_rent_stock,
        sale_price, rent_price, deposit, late_fee_per_day,
        is_visible: is_visible ? 'TRUE' : 'FALSE'
    };
    
    const sheetName = context.env.BOARDGAMES_SHEET_NAME;
    if (!sheetName) {
        console.error(`背景同步桌遊資訊失敗: 缺少 BOARDGAMES_SHEET_NAME 環境變數`);
    } else {
        context.waitUntil(
            updateRowInSheet(context.env, sheetName, 'game_id', gameId, dataToSync)
            .catch(err => console.error("背景同步桌遊資訊失敗:", err))
        );
    }
    return new Response(JSON.stringify({ success: true, message: '成功更新桌遊詳細資訊！' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-boardgame-details API:', error);
    return new Response(JSON.stringify({ error: '更新桌遊資訊失敗。' }), { status: 500 });
  }
}