// functions/api/get-boardgames.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// ========= Google Sheets 工具函式 =========
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

// ========= 主要的請求處理邏輯 =========
export async function onRequest(context) {
  const { request, env } = context;
  const { DB } = env;

  // --- 處理 GET 請求 (讀取 D1 資料庫的桌遊列表) ---
  if (request.method === 'GET') {
    try {
      // ** 關鍵：現在 GET 請求統一從 D1 資料庫讀取，確保資料來源一致 **
      const stmt = DB.prepare(
        'SELECT * FROM BoardGames ORDER BY game_id ASC' // 讀取所有欄位
      );
      const { results } = await stmt.all();
      return new Response(JSON.stringify(results || []), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in get-boardgames (GET):', error);
      return new Response(JSON.stringify({ error: '獲取桌遊列表失敗。' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // --- 處理 POST 請求 (從 Google Sheet 同步到 D1 資料庫) ---
  if (request.method === 'POST') {
    try {
        // 1. 連接並讀取 Google Sheet
        const accessToken = await getAccessToken(env);
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(env.GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['BoardGames'];
        if (!sheet) throw new Error('在 Google Sheets 中找不到名為 "BoardGames" 的工作表。');
        
        const rows = await sheet.getRows();
        if (rows.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Google Sheet 中沒有資料可同步。' }), { status: 200 });
        }

        // 2. 準備 D1 資料庫的 "UPSERT" 指令
        const stmt = DB.prepare(
            `INSERT INTO BoardGames (game_id, name, description, tags, min_players, max_players, difficulty, image_url, total_stock, for_sale_stock, for_rent_stock, sale_price, rent_price, is_visible, rental_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(game_id) DO UPDATE SET
                name = excluded.name, description = excluded.description, tags = excluded.tags,
                min_players = excluded.min_players, max_players = excluded.max_players, difficulty = excluded.difficulty,
                image_url = excluded.image_url, total_stock = excluded.total_stock, for_sale_stock = excluded.for_sale_stock,
                for_rent_stock = excluded.for_rent_stock, sale_price = excluded.sale_price, rent_price = excluded.rent_price,
                is_visible = excluded.is_visible, rental_type = excluded.rental_type`
        );

        // 3. 將每一行 Sheet 資料綁定到指令中
        const operations = rows.map(row => {
            const rowData = row.toObject();
            return stmt.bind(
                rowData.game_id, rowData.name, rowData.description, rowData.tags,
                rowData.min_players, rowData.max_players, rowData.difficulty,
                rowData.image_url, rowData.total_stock, rowData.for_sale_stock,
                rowData.for_rent_stock, rowData.sale_price, rowData.rent_price,
                rowData.is_visible, rowData.rental_type
            );
        });

        // 4. 批次執行所有資料庫操作
        await DB.batch(operations);

        return new Response(JSON.stringify({ success: true, message: `成功從 Google Sheet 同步了 ${rows.length} 筆桌遊資料。` }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in get-boardgames (POST):', error);
        return new Response(JSON.stringify({ error: '同步失敗。', details: error.message }), { status: 500 });
    }
  }

  // 如果不是 GET 或 POST，回傳錯誤
  return new Response('Invalid request method.', { status: 405 });
}