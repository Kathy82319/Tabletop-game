// functions/api/admin/create-booking.js
//要去資料庫放寬user_id要求必定寫入的條件
export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const {
            userId, // 接收 userId，可能是會員ID，也可能是 null
            bookingDate,
            timeSlot,
            contactName,
            contactPhone,
            numOfPeople,
            item
        } = body;

        // 後端驗證，userId 現在是可選的
        if (!bookingDate || !timeSlot || !contactName || !contactPhone || !numOfPeople) {
            return new Response(JSON.stringify({ error: '除了會員外，所有必填欄位皆不可為空' }), { status: 400 });
        }

        const db = context.env.DB;
        const PEOPLE_PER_TABLE = 4; // 您可以根據需求調整每桌人數
        const tablesNeeded = Math.ceil(Number(numOfPeople) / PEOPLE_PER_TABLE);

        // 【核心修正】修正 INSERT 語句，確保欄位與數值數量完全一致
        // 我們明確指定要插入的 9 個欄位，並提供 8 個變數 + 1 個預設值 'confirmed'
        const stmt = db.prepare(
            `INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied, booking_preference, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
        );
        
        await stmt.bind(
            userId, // 此處的 userId 可以是 null，資料庫會正確處理
            contactName, 
            contactPhone, 
            bookingDate, 
            timeSlot, 
            Number(numOfPeople), 
            tablesNeeded,
            item || null
        ).run();
        
        return new Response(JSON.stringify({ success: true, message: '預約已成功建立' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in admin/create-booking API:', error);
        return new Response(JSON.stringify({ error: '建立預約失敗', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}