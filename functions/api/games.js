import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// Cloudflare Pages 的原生 onRequest 處理器
export async function onRequest(context) {
  try {
    // 從 context.env 取得環境變數
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID
    } = context.env;

    // 1. 手動建立並簽署 JWT (取代 google-auth-library)
    // ----------------------------------------------------
    const privateKey = await jose.importPKCS8(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
    
    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setAudience('https://oauth2.googleapis.com/token')
      .setSubject(GOOGLE_SERVICE_ACCOUNT_EMAIL)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setClaim('scope', 'https://www.googleapis.com/auth/spreadsheets')
      .sign(privateKey);

    // 2. 使用簽署好的 JWT 換取 Access Token
    // ----------------------------------------
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    
    if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.json();
        throw new Error(`Failed to fetch access token: ${errorBody.error_description}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // 3. 使用 Access Token 操作 Google Spreadsheet
    // ---------------------------------------------
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID);
    
    // 使用原始 access token，不再需要 JWT client
    doc.useRawAccessToken(accessToken);

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['BoardGames'];
    
    if (!sheet) {
      throw new Error('Worksheet with title "BoardGames" not found.');
    }

    const rows = await sheet.getRows();
    const data = rows.map(row => {
      const rowData = {};
      sheet.headerValues.forEach(header => {
        rowData[header] = row.get(header);
      });
      return rowData;
    });

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in games API:', error);
    const errorResponse = { error: 'Failed to access spreadsheet data.', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}