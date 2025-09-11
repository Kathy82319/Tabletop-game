// functions/cron-sync-users.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

async function runUserSync(env) {
    // ... (這段核心邏輯與上面 sync-users.js 中的 runUserSync 函式完全相同)
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID, USERS_SHEET_NAME, DB } = env;
    if (!USERS_SHEET_NAME) throw new Error('Missing USERS_SHEET_NAME env var.');
    const { results } = await DB.prepare('SELECT * FROM Users ORDER BY created_at DESC').all();
    if (!results || results.length === 0) { console.log('Cron Sync Users: No users to sync.'); return; }
    const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
    const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' }).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL).setAudience('https://oauth2.googleapis.com/token').setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL).setIssuedAt().setExpirationTime('1h').sign(privateKey);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }), });
    if (!tokenResponse.ok) throw new Error('Cron Sync Users: Failed to fetch access token.');
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[USERS_SHEET_NAME];
    if (!sheet) throw new Error(`Cron Sync Users: Cannot find sheet named "${USERS_SHEET_NAME}".`);
    await sheet.clear();
    await sheet.setHeaderRow(['user_id', 'line_display_name', 'line_picture_url', 'class', 'level', 'current_exp', 'created_at']);
    await sheet.addRows(results);
    console.log(`Cron Sync Users: Successfully synced ${results.length} user records.`);
}

// Cloudflare Cron Triggers 專用的匯出格式
export default {
  async scheduled(controller, env, ctx) {
    console.log('Cron job for syncing users is running...');
    ctx.waitUntil(runUserSync(env));
  },
};