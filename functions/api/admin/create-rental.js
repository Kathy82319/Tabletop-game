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
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type-jwt-bearer', assertion: jwt }),
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

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // 【修改處】接收客製化金額: rentPrice, deposit, lateFeePerDay
    const { 
        userId, gameIds, dueDate, name, phone,
        rentPrice, deposit, lateFeePerDay 
    } = await context.request.json();

    if (!userId || !gameIds || !Array.isArray(gameIds) || gameIds.length === 0 || !dueDate || !name || !phone) {
      return new Response(JSON.stringify({ error: '缺少必要的租借資訊 (會員/遊戲/日期/姓名/電話)。' }), { status: 400 });
    }

    const db = context.env.DB;
    const allGameNames = [];
    const dbOperations = [];
    
    for (const gameId of gameIds) {
        const game = await db.prepare('SELECT name, for_rent_stock FROM BoardGames WHERE game_id = ?').bind(gameId).first();
        if (!game) throw new Error(`找不到 ID 為 ${gameId} 的遊戲。`);
        if (game.for_rent_stock <= 0) throw new Error(`《${game.name}》目前已無可租借庫存。`);
        
        allGameNames.push(game.name);

        // **【核心修正處】** 調整 INSERT 的欄位順序與數量，使其與 bind 的參數完全對應
        const insertStmt = db.prepare(
            `INSERT INTO Rentals (user_id, game_id, due_date, name, phone, rent_price, deposit, late_fee_per_day) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        
        dbOperations.push(insertStmt.bind(
            userId, 
            gameId, 
            dueDate, 
            name, 
            phone, 
            Number(rentPrice) || 0, 
            Number(deposit) || 0, 
            Number(lateFeePerDay) || 50
        ));
        
        const updateStmt = db.prepare('UPDATE BoardGames SET for_rent_stock = for_rent_stock - 1 WHERE game_id = ?');
        dbOperations.push(updateStmt.bind(gameId));
    }
    
    // ** 步驟 2: 執行資料庫批次操作 **
    const results = await db.batch(dbOperations);
    
    // 從 results 中提取出所有新生成的 rental_id
    results.forEach(result => {
        if (result.results && result.results.length > 0 && result.results[0].rental_id) {
            createdRentalIds.push(result.results[0].rental_id);
        }
    });

    // ** 需求 1 (補充) 修改：組合包含所有遊戲的訊息 **
    const rentalDateStr = new Date().toISOString().split('T')[0];
    const rentalDuration = Math.round((new Date(dueDate) - new Date(rentalDateStr)) / (1000 * 60 * 60 * 24));

    const message = `姓名：${name}\n` +
                    `電話：${phone}\n` +
                    `日期：${rentalDateStr}\n` +
                    `租借時間：${rentalDuration}天\n` +
                    `歸還日期：${dueDate}\n` +
                    `租借遊戲：\n- ${allGameNames.join('\n- ')}\n\n` + // 條列所有遊戲
                    `租借規則：桌遊租借注意事項：\n1.收取遊戲定價之押金，於歸還桌遊時退還押金。\n2.內容物需現場自行依照說明書或配件表清點，並確認能正常使用，若歸還時有缺少或損毀，將不退還押金。\n3.最短租期為3天，租借當日即算第一天。\n4.逾期歸還，每逾期一天從押金扣50元。\n` +
                    `如上面資訊沒有問題，請回覆「ok」並視為同意租借規則\n`+
                    `感謝您的預約！`;

    // ** 步驟 4: 觸發所有背景任務 **
    context.waitUntil((async () => {
        try {
            // 任務 A: 發送 LINE 訊息
            const sendMessageUrl = new URL('/api/send-message', context.request.url);
            await fetch(sendMessageUrl.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message })
            });

            // 任務 B: 逐筆同步租借紀錄到 Google Sheet
            for (const rentalId of createdRentalIds) {
                const newRental = await db.prepare('SELECT * FROM Rentals WHERE rental_id = ?').bind(rentalId).first();
                if (newRental) {
                    await addRowToSheet(context.env, '桌遊租借者', newRental);
                }
            }
            
            // 任務 C: 逐筆更新遊戲庫存到 Google Sheet
            const sheetName = context.env.BOARDGAMES_SHEET_NAME;
            if (!sheetName) throw new Error("缺少 BOARDGAMES_SHEET_NAME 環境變數");
            
            for (const gameId of gameIds) {
                 const game = await db.prepare('SELECT for_rent_stock FROM BoardGames WHERE game_id = ?').bind(gameId).first();
                 if (game) {
                    await updateRowInSheet(context.env, sheetName, 'game_id', gameId, { for_rent_stock: game.for_rent_stock });
                 }
            }
        } catch (err) {
            console.error("背景同步任務失敗:", err);
        }
    })());

    return new Response(JSON.stringify({ success: true, message: '租借紀錄已建立，庫存已更新！' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-rental API:', error);
    return new Response(JSON.stringify({ error: `建立租借紀錄失敗: ${error.message}` }), {
      status: 500,
    });
  }
}