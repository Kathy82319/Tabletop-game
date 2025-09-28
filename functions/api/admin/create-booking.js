// functions/api/admin/create-booking.js

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '無效的請求方法' }), { status: 405 });
        }

        const body = await context.request.json();
        const {
            userId, bookingDate, timeSlot, contactName,
            contactPhone, numOfPeople, item
        } = body;

        // 後端嚴格驗證
        if (!userId || !bookingDate || !timeSlot || !contactName || !contactPhone || !numOfPeople) {
            return new Response(JSON.stringify({ error: '所有必填欄位皆不可為空' }), { status: 400 });
        }

        const db = context.env.DB;
        const PEOPLE_PER_TABLE = 4; // 您可以根據需求調整每桌人數
        const tablesNeeded = Math.ceil(Number(numOfPeople) / PEOPLE_PER_TABLE);

        // 【核心修正】修正 INSERT 語句，確保欄位與數值數量一致
        const stmt = db.prepare(
            `INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied, booking_preference, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
        );
        
        await stmt.bind(
            userId, 
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