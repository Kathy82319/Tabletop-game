// functions/api/add-exp.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

async function syncSingleExpToSheet(env, expData) {
    try {
        console.log('背景任務：開始同步單筆經驗值紀錄...');
        const {
          GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID,
          EXP_HISTORY_SHEET_NAME 
        } = env;

        if (!EXP_HISTORY_SHEET_NAME) {
            throw new Error('背景同步(Exp)失敗：缺少 EXP_HISTORY_SHEET_NAME 環境變數。');
        }

        const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
        const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
          .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
          .setAudience('https://oauth2.googleapis.com/token')
          .setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
          .setIssuedAt()
          .setExpirationTime('1h')
          .sign(privateKey);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
        });
        if (!tokenResponse.ok) throw new Error('背景同步(Exp)：從 Google 取得 access token 失敗。');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[EXP_HISTORY_SHEET_NAME];
        if (!sheet) throw new Error(`背景同步(Exp)：找不到名為 "${EXP_HISTORY_SHEET_NAME}" 的工作表。`);

        await sheet.addRow({
            user_id: expData.userId,
            exp_added: expData.expValue, 
            reason: expData.reason,
            staff_id: null,
            created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        });

        console.log('背景任務：單筆經驗值紀錄同步成功！');

    } catch (error) {
        console.error('背景同步單筆經驗值失敗:', error);
    }
}

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { userId, expValue, reason } = await context.request.json();

    if (!userId || typeof expValue !== 'number' || expValue <= 0) {
      return new Response(JSON.stringify({ error: '無效的使用者 ID 或經驗值。' }), { status: 400 });
    }

    const db = context.env.DB;
    const userStmt = db.prepare('SELECT level, current_exp FROM Users WHERE user_id = ?');
    let user = await userStmt.bind(userId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: `找不到使用者 ID: ${userId}` }), { status: 404 });
    }

    let currentLevel = user.level;
    let currentExp = user.current_exp + expValue;

    // ** 關鍵修正：將升級門檻固定為 10 **
    const requiredExp = 10;
    while (currentExp >= requiredExp) {
      currentExp -= requiredExp; // 減去固定的升級經驗
      currentLevel += 1;          // 等級 +1
      // ** 關鍵修正：不再重新計算 requiredExp **
    }

    await db.batch([
      db.prepare('UPDATE Users SET level = ?, current_exp = ? WHERE user_id = ?').bind(currentLevel, currentExp, userId),
      db.prepare('INSERT INTO ExpHistory (user_id, exp_added, reason) VALUES (?, ?, ?)').bind(userId, expValue, reason || '未提供原因')
    ]);
    
    context.waitUntil(syncSingleExpToSheet(context.env, { userId, expValue, reason }));
    
    return new Response(JSON.stringify({ 
        success: true, 
        message: `成功新增 ${expValue} 點經驗值。`,
        newLevel: currentLevel,
        newExp: currentExp
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in add-exp API:', error);
    return new Response(JSON.stringify({ error: '伺服器內部錯誤，新增經驗值失敗。'}), { status: 500 });
  }
}