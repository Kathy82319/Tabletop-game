import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// 使用 Cloudflare Pages 的原生 onRequest 處理器
export async function onRequest(context) {
  try {
    // 關鍵改變 1: 從 context.env 取得環境變數，而不是 process.env
    const {
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEET_ID
    } = context.env;

    // 檢查環境變數是否存在
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
      throw new Error("Missing required environment variables.");
    }

    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 處理換行符
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['BoardGames'];
    if (!sheet) {
      const errorResponse = { error: 'Worksheet with title "BoardGames" not found.' };
      return new Response(JSON.stringify(errorResponse), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const rows = await sheet.getRows();
    const data = rows.map(row => {
      const rowData = {};
      sheet.headerValues.forEach(header => {
        rowData[header] = row.get(header);
      });
      return rowData;
    });

    // 關鍵改變 2: 建立並回傳一個標準的 Response 物件
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error accessing spreadsheet:', error);

    const errorResponse = {
      error: 'Failed to access spreadsheet data.',
      details: error.message
    };
    
    // 關鍵改變 3: 在 catch 區塊中也回傳一個標準的 Response 物件
    return new Response(JSON.stringify(errorResponse), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}