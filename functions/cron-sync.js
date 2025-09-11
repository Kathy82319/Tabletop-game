// functions/cron-sync.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// 將核心同步邏輯再次貼到這裡，讓排程器可以獨立執行
async function runSync(env) {
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID,
      EXP_HISTORY_SHEET_NAME,
      DB
    } = env;

    if (!EXP_HISTORY_SHEET_NAME) throw new Error('Missing EXP_HISTORY_SHEET_NAME env var.');
    
    const { results } = await DB.prepare('SELECT * FROM ExpHistory ORDER BY created_at DESC').all();

    if (!results || results.length === 0) {
        console.log('Cron Sync: No new history to sync.');
        return;
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
    if (!tokenResponse.ok) throw new Error('Cron Sync: Failed to fetch access token.');
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[EXP_HISTORY_SHEET_NAME];
    if (!sheet) throw new Error(`Cron Sync: Cannot find sheet named "${EXP_HISTORY_SHEET_NAME}".`);

    await sheet.clear();
    await sheet.setHeaderRow(['history_id', 'user_id', 'exp_added', 'reason', 'staff_id', 'created_at']);
    await sheet.addRows(results);

    console.log(`Cron Sync: Successfully synced ${results.length} records.`);
}

// 這是 Cloudflare Cron Triggers 專用的匯出格式
export default {
  async scheduled(controller, env, ctx) {
    console.log('Cron job is running...');
    ctx.waitUntil(runSync(env));
  },
};