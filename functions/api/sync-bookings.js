// functions/api/sync-bookings.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

async function runBookingSync(env) {
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID,
      BOOKINGS_SHEET_NAME, // 我們新加的變數
      DB
    } = env;

    if (!BOOKINGS_SHEET_NAME) throw new Error('Missing BOOKINGS_SHEET_NAME environment variable.');
    
    // 從 D1 讀取所有預約資料
    const { results } = await DB.prepare('SELECT * FROM Bookings ORDER BY created_at DESC').all();

    if (!results || results.length === 0) {
        return { success: true, message: '資料庫中沒有預約紀錄可同步。' };
    }

    // 驗證並連接到 Google Sheets
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
    if (!tokenResponse.ok) throw new Error('Failed to fetch access token from Google.');
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);

    // 寫入資料到 Google Sheets
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[BOOKINGS_SHEET_NAME];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${BOOKINGS_SHEET_NAME}" 的工作表。`);

    await sheet.clear();
    // 確保標題列與你的 D1 資料庫欄位完全對應
    await sheet.setHeaderRow(['booking_id', 'user_id', 'booking_date', 'time_slot', 'table_number', 'num_of_people', 'status', 'created_at']);
    await sheet.addRows(results);

    return { success: true, message: `成功同步了 ${results.length} 筆預約紀錄。` };
}

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '僅允許 POST 請求' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
        }
        const result = await runBookingSync(context.env);
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        console.error('Error in sync-bookings API:', error);
        return new Response(JSON.stringify({ error: '同步失敗。', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}