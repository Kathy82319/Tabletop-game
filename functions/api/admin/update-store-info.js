// functions/api/admin/update-store-info.js

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

async function updateRowInSheet(env, sheetName, matchColumn, matchValue, updateData) { /* ... */ }

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { address, phone, opening_hours, description } = await context.request.json();
    if (!address || !phone || !opening_hours || !description) {
      return new Response(JSON.stringify({ error: '所有欄位皆為必填。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    const stmt = db.prepare(
      'UPDATE StoreInfo SET address = ?, phone = ?, opening_hours = ?, description = ? WHERE id = 1'
    );
    await stmt.bind(address, phone, opening_hours, description).run();

    // ** 關鍵改動：觸發背景同步任務 **
    const infoDataToSync = { address, phone, opening_hours, description };
    context.waitUntil(
        updateRowInSheet(context.env, context.env.STORE_INFO_SHEET_NAME, 'id', 1, infoDataToSync)
        .catch(err => console.error("背景同步更新店家資訊失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '成功更新店家資訊！' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-store-info API:', error);
    return new Response(JSON.stringify({ error: '更新店家資訊失敗。' }), { status: 500 });
  }
}