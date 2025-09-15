// functions/api/admin/create-rental.js

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
    if (!sheetName) {
        console.error('背景同步失敗：缺少工作表名稱的環境變數。');
        return;
    }
    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(env.GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);
    await sheet.addRow(rowData);
}

async function getAccessToken(env) { /* ... */ }
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

    const { userId, gameId, dueDate, deposit, lateFeePerDay } = await context.request.json();

    if (!userId || !gameId || !dueDate || deposit === undefined || lateFeePerDay === undefined) {
      return new Response(JSON.stringify({ error: '缺少必要的租借資訊。' }), { status: 400 });
    }

    const db = context.env.DB;

    // 1. 新增租借紀錄到 D1，並使用 RETURNING 獲取新紀錄的 ID
    const stmt = db.prepare(
      'INSERT INTO Rentals (user_id, game_id, due_date, deposit, late_fee_per_day) VALUES (?, ?, ?, ?, ?) RETURNING *'
    );
    const newRental = await stmt.bind(userId, gameId, dueDate, deposit, lateFeePerDay).first();


    // 2. 準備發送給使用者的通知訊息
    const game = await db.prepare('SELECT name FROM BoardGames WHERE game_id = ?').bind(gameId).first();
    const gameName = game ? game.name : '未知遊戲';

    const message = `📦 桌遊租借成功！\n\n` +
                    `遊戲名稱：${gameName}\n` +
                    `押金：$${deposit}\n` +
                    `預計歸還日：${dueDate}\n\n` +
                    `請務必在此日期前歸還，感謝您的租借！`;

    // 3. 觸發一個背景任務去發送 LINE 訊息
    context.waitUntil(
        fetch(new URL('/api/send-message', context.request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message })
        }).catch(err => console.error("背景發送租借通知失敗:", err))
    );
    
    // 4. **【新增】** 觸發背景任務將此筆紀錄同步到 Google Sheet
    context.waitUntil(
        addRowToSheet(context.env, 'Rentals', newRental)
        .catch(err => console.error("背景同步新增租借紀錄失敗:", err))
    );


    return new Response(JSON.stringify({ success: true, message: '租借紀錄已建立，並已通知使用者！' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-rental API:', error);
    return new Response(JSON.stringify({ error: '建立租借紀錄失敗。', details: error.message }), {
      status: 500,
    });
  }
}