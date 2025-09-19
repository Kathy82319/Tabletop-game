// functions/api/bookings-check.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// 輔助函式：從 Google Sheet 讀取當日特殊設定的預約上限
async function getDailyBookingLimit(env, date) {
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID, SETTINGS_SHEET_NAME } = env;
    const DEFAULT_LIMIT = 4; // 預設上限

    if (!SETTINGS_SHEET_NAME) return DEFAULT_LIMIT;

    try {
        const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
        const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets.readonly' })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
          .setAudience('https://oauth2.googleapis.com/token').setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
          .setIssuedAt().setExpirationTime('1h').sign(privateKey);
        
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
        });
        if (!tokenResponse.ok) throw new Error('Auth failed');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[SETTINGS_SHEET_NAME];
        if (!sheet) return DEFAULT_LIMIT;

        const rows = await sheet.getRows();
        const setting = rows.find(row => row.get('date') === date);
        
        return setting ? Number(setting.get('booking_limit')) : DEFAULT_LIMIT;
    } catch (error) {
        console.error("讀取 Google Sheet 每日設定失敗:", error);
        return DEFAULT_LIMIT; // 如果讀取失敗，回傳預設值以確保系統可用
    }
}

async function getDisabledDates(db) {
    try {
        const { results } = await db.prepare("SELECT disabled_date FROM BookingSettings").all();
        return results.map(row => row.disabled_date);
    } catch (error) {
        console.error("讀取不可預約日期失敗:", error);
        return [];
    }
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const db = context.env.DB;

    // 如果請求是為了獲取整個月份的設定
    if (url.searchParams.has('month-init')) {
        const disabledDates = await getDisabledDates(db);
        return new Response(JSON.stringify({ disabledDates }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 既有的單日查詢邏輯
    if (!date) {
      return new Response(JSON.stringify({ error: '缺少日期參數。' }), { status: 400 });
    }
    const dailyLimit = await getDailyBookingLimit(context.env, date);
    
    const stmt = db.prepare(
      "SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND (status = 'confirmed' OR status = 'checked-in')"
    );
    const result = await stmt.bind(date).first();
    const tablesBooked = result ? (result.total_tables_booked || 0) : 0;
    const tablesAvailable = dailyLimit - tablesBooked;
    
    return new Response(JSON.stringify({
        date: date,
        limit: dailyLimit,
        booked: tablesBooked,
        available: tablesAvailable > 0 ? tablesAvailable : 0
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in bookings-check API:', error);
    return new Response(JSON.stringify({ error: '查詢預約狀況失敗。' }), { status: 500 });
  }
}

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    if (!date) {
      return new Response(JSON.stringify({ error: '缺少日期參數。' }), { status: 400 });
    }
    const dailyLimit = await getDailyBookingLimit(context.env, date);
    const db = context.env.DB;
    
    // ** 關鍵改動：從 COUNT(*) 改為 SUM(tables_occupied) **
    const stmt = db.prepare(
      "SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND status = 'confirmed'"
    );
    const result = await stmt.bind(date).first();
    const tablesBooked = result ? (result.total_tables_booked || 0) : 0;
    const tablesAvailable = dailyLimit - tablesBooked;
    
    return new Response(JSON.stringify({
        date: date,
        limit: dailyLimit,
        booked: tablesBooked,
        available: tablesAvailable > 0 ? tablesAvailable : 0
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in bookings-check API:', error);
    return new Response(JSON.stringify({ error: '查詢預約狀況失敗。' }), { status: 500 });
  }
}