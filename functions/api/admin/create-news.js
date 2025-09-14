// functions/api/admin/create-news.js
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
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`從 Google 取得 access token 失敗: ${tokenData.error_description || tokenData.error}`);
    return tokenData.access_token;
}

async function addRowToSheet(env, sheetName, rowData) {
    if (!sheetName) {
        console.error('背景同步失敗：缺少工作表名稱的環境變數。');
        return;
    }
    const accessToken = await getAccessToken(env);
    const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
    const doc = new GoogleSpreadsheet(env.GOOGLE_SHEET_ID, simpleAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`在 Google Sheets 中找不到名為 "${sheetName}" 的工作表。`);
    await sheet.addRow(rowData);
}

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const { title, category, published_date, image_url, content, is_published } = await context.request.json();

    if (!title || !category || !published_date) {
      return new Response(JSON.stringify({ error: '標題、分類和發布日期為必填欄位。' }), { status: 400 });
    }

    const db = context.env.DB;
    
    // ** 關鍵改動：使用 `returning('id')` 來獲取新增資料的 ID **
    const stmt = db.prepare(
      'INSERT INTO News (title, category, published_date, image_url, content, is_published) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
    );
    const result = await stmt.bind(title, category, published_date, image_url || '', content || '', is_published ? 1 : 0).first();

    // ** 關鍵改動：觸發背景同步任務 **
    const newsDataToSync = {
        id: result.id,
        title, category, published_date, image_url, content,
        is_published: is_published ? 'TRUE' : 'FALSE',
        created_at: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    };
    context.waitUntil(
        addRowToSheet(context.env, context.env.NEWS_SHEET_NAME, newsDataToSync)
        .catch(err => console.error("背景同步新增情報失敗:", err))
    );
    
    return new Response(JSON.stringify({ success: true, message: '情報新增成功！' }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-news API:', error);
    return new Response(JSON.stringify({ error: '新增情報失敗。' }), { status: 500 });
  }
}