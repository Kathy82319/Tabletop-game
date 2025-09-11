// functions/api/bookings-create.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as jose from 'jose';

// =================================================================
// 核心邏輯：將「單筆」預約紀錄同步到 Google Sheet
// =================================================================
async function syncSingleBookingToSheet(env, newBookingData) {
    try {
        console.log('開始在背景同步單筆預約...');
        const {
          GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID,
          BOOKINGS_SHEET_NAME // 我們之前建立的環境變數
        } = env;

        // 驗證並連接到 Google Sheets
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
        if (!tokenResponse.ok) throw new Error('背景同步：從 Google 取得 access token 失敗。');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        const simpleAuth = { getRequestHeaders: () => ({ 'Authorization': `Bearer ${accessToken}` }) };
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, simpleAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[BOOKINGS_SHEET_NAME];
        if (!sheet) throw new Error(`背景同步：在 Google Sheets 中找不到名為 "${BOOKINGS_SHEET_NAME}" 的工作表。`);

        // ** 關鍵改動：不再清空整個工作表，而是只「新增一行」**
        await sheet.addRow({
            // booking_id 和 created_at 由 D1 自動產生，這裡留空
            user_id: newBookingData.userId,
            booking_date: newBookingData.bookingDate,
            time_slot: newBookingData.timeSlot,
            num_of_people: newBookingData.numOfPeople,
            tables_occupied: newBookingData.tablesOccupied,
            booking_preference: newBookingData.bookingPreference,
            contact_name: newBookingData.contactName,
            contact_phone: newBookingData.contactPhone,
            status: 'confirmed'
        });

        console.log('單筆預約紀錄背景同步成功！');

    } catch (error) {
        // 背景任務的錯誤只會顯示在 Cloudflare 的日誌中，不會影響使用者
        console.error('背景同步單筆預約失敗:', error);
    }
}


// =================================================================
// 主要 API 處理器
// =================================================================
export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const bookingRequest = await context.request.json();
    const { userId, bookingDate, timeSlot, numOfPeople, contactName, contactPhone } = bookingRequest;
    
    if (!userId || !bookingDate || !timeSlot || !numOfPeople || numOfPeople <= 0 || !contactName || !contactPhone) {
      return new Response(JSON.stringify({ error: '所有預約欄位皆為必填。' }), { status: 400 });
    }
    
    const TOTAL_TABLES = 5;
    const PEOPLE_PER_TABLE = 4;
    const tablesNeeded = Math.ceil(numOfPeople / PEOPLE_PER_TABLE);

    const db = context.env.DB;

    // 檢查庫存
    const checkStmt = db.prepare( "SELECT SUM(tables_occupied) as total_tables_booked FROM Bookings WHERE booking_date = ? AND time_slot = ? AND status = 'confirmed'");
    const currentBooking = await checkStmt.bind(bookingDate, timeSlot).first();
    const tablesAlreadyBooked = currentBooking.total_tables_booked || 0;

    if ((tablesAlreadyBooked + tablesNeeded) > TOTAL_TABLES) {
      return new Response(JSON.stringify({ error: `該時段座位不足，僅剩 ${TOTAL_TABLES - tablesAlreadyBooked} 桌。` }), { status: 409 });
    }
    
    // 寫入 D1 資料庫
    const insertStmt = db.prepare('INSERT INTO Bookings (user_id, booking_date, time_slot, num_of_people, tables_occupied, booking_preference, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    await insertStmt.bind(userId, bookingDate, timeSlot, numOfPeople, tablesNeeded, bookingRequest.bookingPreference, contactName, contactPhone).run();

    // 準備要回傳給 LINE 的訊息內容
    const message = `🎉 預約成功！\n\n` +
                    `姓名：${contactName}\n電話：${contactPhone}\n` +
                    `日期：${bookingDate}\n時段：${timeSlot}\n` +
                    `人數：${numOfPeople} 人\n\n` +
                    `感謝您的預約，我們到時見！`;

    // ** 關鍵改動：觸發背景同步任務 **
    const dataForSheet = { ...bookingRequest, tablesOccupied: tablesNeeded };
    context.waitUntil(syncSingleBookingToSheet(context.env, dataForSheet));

    // ** 立即回傳成功訊息給使用者 **
    return new Response(JSON.stringify({ 
        success: true, 
        message: '預約成功！',
        confirmationMessage: message
    }), { status: 201 });

  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立預約失敗。' }), { status: 500 });
  }
}