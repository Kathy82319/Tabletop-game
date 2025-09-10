import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export const onRequestGet = async (context) => {
    try {
        // 從 context.env 讀取你在 Cloudflare 後台設定的環境變數
        const {
            SHEET_ID,
            GOOGLE_CLIENT_EMAIL,
            GOOGLE_PRIVATE_KEY
        } = context.env;

        if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
            throw new Error("Google Sheets credentials are not set in Cloudflare environment variables.");
        }
        
        // JWT 授權，這是與 Google 驗證的方式
        const serviceAccountAuth = new JWT({
            email: GOOGLE_CLIENT_EMAIL,
            key: GOOGLE_PRIVATE_KEY, // Cloudflare 會自動處理加密過的金鑰
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
            ],
        });

        const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

        await doc.loadInfo(); // 載入試算表資訊
        
        // 假設你的桌遊資料在第一個工作表 (索引值為 0)
        const sheet = doc.sheetsByIndex[1]; 
        
        const rows = await sheet.getRows(); // 取得所有資料行

        // 將每一行轉換成我們想要的 JSON 格式
        // 並且只回傳 is_visible 欄位為 TRUE 的遊戲
        const games = rows.map(row => {
            const rowData = row.toObject();
            if (rowData.is_visible && rowData.is_visible.toUpperCase() === 'TRUE') {
                return {
                    game_id: parseInt(rowData.game_id, 10),
                    name: rowData.name,
                    description: rowData.description,
                    image_url: rowData.image_url,
                    tags: rowData.tags,
                    min_players: parseInt(rowData.min_players, 10),
                    max_players: parseInt(rowData.max_players, 10),
                    difficulty: parseInt(rowData.difficulty, 10),
                    total_stock: parseInt(rowData.total_stock, 10),
                    for_sale_stock: parseInt(rowData.for_sale_stock, 10),
                    for_rent_stock: parseInt(rowData.for_rent_stock, 10),
                };
            }
            return null;
        }).filter(game => game !== null); // 過濾掉為 null 的資料 (也就是 is_visible 不為 TRUE 的)

        return new Response(JSON.stringify(games), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error fetching from Google Sheets:", error);
        return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
};

// 確保此 API 只接收 GET 請求
export const onRequest = (context) => {
    if (context.request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    return onRequestGet(context);
};