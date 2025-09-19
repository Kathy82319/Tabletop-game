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

// START: 新增 updateRowInSheet 函式
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
// END: 新增 updateRowInSheet 函式


export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, gameId, dueDate, deposit, lateFeePerDay, name, phone } = await context.request.json();

    if (!userId || !gameId || !dueDate || !name || !phone) {
      return new Response(JSON.stringify({ error: '缺少必要的租借資訊 (會員/遊戲/日期/姓名/電話)。' }), { status: 400 });
    }

    const db = context.env.DB;

    const game = await db.prepare('SELECT name, for_rent_stock FROM BoardGames WHERE game_id = ?').bind(gameId).first();
    if (!game) {
        return new Response(JSON.stringify({ error: '找不到指定的遊戲。' }), { status: 404 });
    }
    if (game.for_rent_stock <= 0) {
        return new Response(JSON.stringify({ error: `《${game.name}》目前已無可租借庫存。` }), { status: 409 });
    }
    
    const batch = [
      db.prepare(
        'INSERT INTO Rentals (user_id, game_id, due_date, deposit, late_fee_per_day, name, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(userId, gameId, dueDate, deposit, lateFeePerDay, name, phone),
      db.prepare(
        'UPDATE BoardGames SET for_rent_stock = for_rent_stock - 1 WHERE game_id = ?'
      ).bind(gameId)
    ];

    await db.batch(batch);
    
    const newRental = await db.prepare('SELECT * FROM Rentals ORDER BY rental_id DESC LIMIT 1').first();

    const rentalDate = new Date(newRental.rental_date);
    const rentalDateStr = rentalDate.toISOString().split('T')[0];
    const rentalDuration = Math.round((new Date(dueDate) - rentalDate) / (1000 * 60 * 60 * 24));

    const message = `姓名：${name}\n` +
                    `電話：${phone}\n` +
                    `日期：${rentalDateStr}\n` +
                    `租借時間：${rentalDuration}天\n` +
                    `歸還日期：${dueDate}\n` +
                    `租借遊戲：${game.name}\n\n` +
                    `租借規則：桌遊租借注意事項：\n1.收取遊戲定價之押金，於歸還桌遊時退還押金。\n2.內容物需現場自行依照說明書或配件表清點，並確認能正常使用，若歸還時有缺少或損毀，將不退還押金。\n3.最短租期為3天，租借當日即算第一天。\n4.逾期歸還，每逾期一天從押金扣50元。\n` +
                    `如上面資訊沒有問題，請回覆「ok」並視為同意租借規則\n`+
                    `感謝您的預約！`;

    context.waitUntil(
        fetch(new URL('/api/send-message', context.request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message })
        }).catch(err => console.error("背景發送租借通知失敗:", err))
    );
    
    context.waitUntil(
        addRowToSheet(context.env, 'Rentals', newRental)
        .catch(err => console.error("背景同步新增租借紀錄失敗:", err))
    );

    // START: 新增背景任務，同步更新 BoardGames 工作表的庫存
    const updatedStock = {
        for_rent_stock: game.for_rent_stock - 1
    };
    context.waitUntil(
        updateRowInSheet(context.env, 'BoardGames', 'game_id', gameId, updatedStock)
        .catch(err => console.error(`背景同步桌遊庫存失敗 (GameID: ${gameId}):`, err))
    );
    // END: 新增背景任務

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