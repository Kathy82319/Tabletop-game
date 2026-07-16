// functions/api/bookings-create.js
import { sendLinePush } from './_lib/line.js';
import { verifyLiffUser } from './_lib/auth.js';

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const profile = await verifyLiffUser(context.request);
    if (!profile) {
      return new Response(JSON.stringify({ error: '未登入或驗證失敗。' }), { status: 401 });
    }
    const userId = profile.userId;

    const { bookingDate, timeSlot, numOfPeople, contactName, contactPhone } = await context.request.json();
    if (!bookingDate || !timeSlot || !numOfPeople || numOfPeople <= 0 || !contactName || !contactPhone) {
      return new Response(JSON.stringify({ error: '所有預約欄位皆為必填。' }), { status: 400 });
    }

    const PEOPLE_PER_TABLE = 4;
    const tablesNeeded = Math.ceil(numOfPeople / PEOPLE_PER_TABLE);
    const db = context.env.DB;
    
    const activityMessage = `收到新的預約: ${contactName} 預約了 ${bookingDate} ${timeSlot}，共 ${numOfPeople} 人。`;

    const storeInfo = await db.prepare("SELECT booking_notify_user_id FROM StoreInfo WHERE id = 1").first();
    const adminUserId = storeInfo?.booking_notify_user_id;

    const adminNotificationMessage = `🔔 新訂位通知 🔔\n` + 
                                     `姓名: ${contactName}\n` + 
                                     `日期: ${bookingDate}\n` + 
                                     `時段: ${timeSlot}\n` + 
                                     `人數: ${numOfPeople} 人\n` + 
                                     `電話: ${contactPhone}\n` +
                                     `-- 請至後台確認 --`;

    await db.batch([
        db.prepare('INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(userId, contactName, contactPhone, bookingDate, timeSlot, numOfPeople, tablesNeeded, 'confirmed'),
        db.prepare('INSERT INTO Activities (message) VALUES (?)').bind(activityMessage)
    ]);
    
    if (adminUserId) {
        context.waitUntil(
            sendLinePush(context.env, adminUserId, adminNotificationMessage)
                .catch(err => console.error("背景發送給管理員的 LINE 訊息失敗:", err))
        );
    }

    const confirmationMessage = `🎉 預約成功！\n\n` + `姓名：${contactName}\n電話：${contactPhone}\n` + `日期：${bookingDate}\n時段：${timeSlot}\n` + `人數：${numOfPeople} 人 \n\n` + `感謝您的預約，我們到時見！`;
    context.waitUntil(
        sendLinePush(context.env, userId, confirmationMessage)
            .catch(err => console.error("背景發送預約確認訊息失敗:", err))
    );

    return new Response(JSON.stringify({ success: true, message: '預約成功！' }), { status: 201 });
  } catch (error) {
    console.error('Error in bookings-create API:', error);
    return new Response(JSON.stringify({ error: '建立預約失敗。' }), { status: 500 });
  }
}
