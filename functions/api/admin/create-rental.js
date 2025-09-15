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

    // 【修改 #3】 接收新的 name 和 phone 欄位
    const { userId, gameId, dueDate, deposit, lateFeePerDay, name, phone } = await context.request.json();

    if (!userId || !gameId || !dueDate || !name || !phone) {
      return new Response(JSON.stringify({ error: '缺少必要的租借資訊 (會員/遊戲/日期/姓名/電話)。' }), { status: 400 });
    }

    const db = context.env.DB;

    // --- 【新增 #2】 庫存 -1 ---
    const game = await db.prepare('SELECT name, for_rent_stock FROM BoardGames WHERE game_id = ?').bind(gameId).first();
    if (!game) {
        return new Response(JSON.stringify({ error: '找不到指定的遊戲。' }), { status: 404 });
    }
    if (game.for_rent_stock <= 0) {
        return new Response(JSON.stringify({ error: `《${game.name}》目前已無可租借庫存。` }), { status: 409 });
    }
    // --- 庫存檢查結束 ---
    
    // 使用資料庫 Transaction 確保兩項操作都成功
    const batch = [
      // 【修改 #3】 新增租借紀錄，包含 name 和 phone
      db.prepare(
        'INSERT INTO Rentals (user_id, game_id, due_date, deposit, late_fee_per_day, name, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(userId, gameId, dueDate, deposit, lateFeePerDay, name, phone),
      // 【修改 #2】 更新桌遊庫存
      db.prepare(
        'UPDATE BoardGames SET for_rent_stock = for_rent_stock - 1 WHERE game_id = ?'
      ).bind(gameId)
    ];

    await db.batch(batch);
    
    // 重新獲取剛才新增的紀錄，以便同步到 Google Sheet
    const newRental = await db.prepare('SELECT * FROM Rentals ORDER BY rental_id DESC LIMIT 1').first();


    // 【修改 #5】 更新 LINE 通知訊息格式
    const rentalDate = new Date(newRental.rental_date);
    const rentalDateStr = rentalDate.toISOString().split('T')[0];
    const rentalDuration = Math.round((new Date(dueDate) - rentalDate) / (1000 * 60 * 60 * 24));

    const message = `姓名：${name}\n` +
                    `電話：${phone}\n` +
                    `日期：${rentalDateStr}\n` +
                    `租借時間：${rentalDuration}天\n` +
                    `歸還日期：${dueDate}\n` +
                    `租借遊戲：${game.name}\n\n` +
                    `如上面資訊沒有問題，請回覆「ok」\n`+
                    `感謝您的預約！`;

    // 觸發 LINE 通知 (保持不變)
    context.waitUntil(
        fetch(new URL('/api/send-message', context.request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message })
        }).catch(err => console.error("背景發送租借通知失敗:", err))
    );
    
    // 【修改 #1】 觸發 Google Sheet 同步 (保持不變，但會同步新欄位)
    context.waitUntil(
        addRowToSheet(context.env, 'Rentals', newRental)
        .catch(err => console.error("背景同步新增租借紀錄失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '租借紀錄已建立，庫存已更新！' }), {
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