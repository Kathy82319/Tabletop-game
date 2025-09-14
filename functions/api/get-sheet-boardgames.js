// functions/api/get-sheet-boardgames.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// Google Sheets 工具函式
async function getAccessToken(env) {
    const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = env;
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) throw new Error('缺少 Google 服務帳號的環境變數。');
    
    // ** 關鍵點 1：確保這裡是 'RS256' **
    const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
    
    const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
      // ** 關鍵點 2：確保 alg 也是 'RS256' **
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
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        console.error("Google Auth Error:", tokenData);
        // 這個錯誤訊息就是您在瀏覽器中看到的
        throw new Error(`從 Google 取得 access token 失敗: ${tokenData.error_description || tokenData.error}`);
    }
    return tokenData.access_token;
}

// 主要的請求處理邏輯
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Invalid request method.', { status: 405 });
  }

  try {
    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(env.GOOGLE_SHEET_ID, simpleAuth);
    
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['BoardGames'];
    if (!sheet) {
      throw new Error('在 Google Sheets 中找不到名為 "BoardGames" 的工作表。');
    }
    
    const rows = await sheet.getRows();
    const data = rows.map(row => row.toObject());

    return new Response(JSON.stringify(data || []), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-sheet-boardgames (GET from Sheet):', error);
    return new Response(JSON.stringify({ error: '從 Google Sheet 獲取桌遊列表失敗。', details: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}