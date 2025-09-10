import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// 這個 handler 函式適用於 Vercel 或類似的 Serverless 平台
export default async function handler(req, res) {
  try {
    // 從環境變數讀取憑證和 Sheet ID
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 處理換行符
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

    // 載入試算表資訊
    await doc.loadInfo();

    // 透過名稱選取工作表
    const sheet = doc.sheetsByTitle['BoardGames'];
    if (!sheet) {
      return res.status(404).json({ error: 'Worksheet with title "BoardGames" not found.' });
    }

    // 讀取工作表中的所有行
    const rows = await sheet.getRows();

    // 將每一行的資料轉換為簡單的 JSON 物件
    // row.get(header) 可以取得該行對應標題欄位的值
    const data = rows.map(row => {
      const rowData = {};
      // sheet.headerValues 就是試算表第一列的標題
      sheet.headerValues.forEach(header => {
        rowData[header] = row.get(header);
      });
      return rowData;
    });

    // 回傳成功的 JSON 響應
    res.status(200).json(data);

  } catch (error) {
    console.error('Error accessing spreadsheet:', error);
    // 回傳錯誤訊息
    res.status(500).json({ error: 'Failed to access spreadsheet data.', details: error.message });
  }
}