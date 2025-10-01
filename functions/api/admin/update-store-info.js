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

// functions/api/admin/update-store-info.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const body = await context.request.json();
    const { 
        address, phone, opening_hours, description,
        booking_button_main, booking_button_sub, booking_promo_text, booking_notice_text 
    } = body;

    // --- 【驗證區塊】 ---
    const errors = [];
    if (!address || typeof address !== 'string' || address.trim().length === 0 || address.length > 200) {
        errors.push('地址為必填，且長度不可超過 200 字。');
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0 || phone.length > 50) {
        errors.push('電話為必填，且長度不可超過 50 字。');
    }
    if (!opening_hours || typeof opening_hours !== 'string' || opening_hours.trim().length === 0 || opening_hours.length > 500) {
        errors.push('營業時間為必填，且長度不可超過 500 字。');
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0 || description.length > 2000) {
        errors.push('公會介紹為必填，且長度不可超過 2000 字。');
    }
    // 【** 新增的驗證 **】
    if (!booking_button_main || booking_button_main.length > 100) errors.push('預約按鈕主標題不可為空，且長度不可超過 100 字。');
    if (!booking_button_sub || booking_button_sub.length > 200) errors.push('預約按鈕副標題不可為空，且長度不可超過 200 字。');
    if (!booking_promo_text || booking_promo_text.length > 200) errors.push('優惠文字不可為空，且長度不可超過 200 字。');
    if (!booking_notice_text || booking_notice_text.length > 200) errors.push('注意事項文字不可為空，且長度不可超過 200 字。');

    if (errors.length > 0) {
        return new Response(JSON.stringify({ error: errors.join(' ') }), { status: 400 });
    }
    // --- 【驗證區塊結束】 ---

    const db = context.env.DB;
    
    // 【** 更新 SQL 指令以包含新欄位 **】
    const stmt = db.prepare(
      `UPDATE StoreInfo SET 
         address = ?, phone = ?, opening_hours = ?, description = ?,
         booking_button_main = ?, booking_button_sub = ?, booking_promo_text = ?, booking_notice_text = ?
       WHERE id = 1`
    );
    await stmt.bind(
        address, phone, opening_hours, description,
        booking_button_main, booking_button_sub, booking_promo_text, booking_notice_text
    ).run();

    // 背景同步至 Google Sheet 的邏輯可以保持不變或自行擴充
    // context.waitUntil(...)

    return new Response(JSON.stringify({ success: true, message: '成功更新店家資訊！' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-store-info API:', error);
    return new Response(JSON.stringify({ error: '更新店家資訊失敗。' }), { status: 500 });
  }
}