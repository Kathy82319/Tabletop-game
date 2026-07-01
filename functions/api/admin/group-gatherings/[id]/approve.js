export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = params.id;

    const g = await env.DB.prepare(
        `SELECT * FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此糾團' }, { status: 404 });
    if (g.status !== 'pending_approval') {
        return Response.json({ error: '此糾團不在待審核狀態' }, { status: 400 });
    }

    const members = await env.DB.prepare(
        `SELECT user_id, display_name FROM GroupGatheringMembers WHERE gathering_id = ? AND status != 'rejected'`
    ).bind(id).all();

    const totalPeople = members.results.length + 1; // +1 for organizer
    const PEOPLE_PER_TABLE = 4;
    const tablesNeeded = Math.ceil(totalPeople / PEOPLE_PER_TABLE);
    const contactName = `${g.organizer_name}的糾團（${totalPeople}人）`;

    const insertResult = await env.DB.prepare(
        `INSERT INTO Bookings (user_id, contact_name, contact_phone, booking_date, time_slot, num_of_people, tables_occupied, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`
    ).bind(
        g.organizer_user_id,
        contactName,
        '',
        g.event_date,
        g.start_time,
        totalPeople,
        tablesNeeded
    ).run();

    const bookingId = insertResult.meta.last_row_id;

    await env.DB.prepare(
        `UPDATE GroupGatherings SET status = 'approved', booking_id = ? WHERE id = ?`
    ).bind(bookingId, id).run();

    // 通知團主
    const organizerMsg = `🎉 糾團成功！\n\n您發起的糾團已獲店家確認！\n📅 ${g.event_date} ${g.start_time}–${g.end_time}\n👥 共 ${totalPeople} 人\n\n期待與您相見！`;

    // 通知所有成員
    const memberMsg = `🎉 糾團成功！\n\n您報名的糾團已獲店家確認！\n📅 ${g.event_date} ${g.start_time}–${g.end_time}\n\n期待與您相見！`;

    const notifyPromises = [
        fetch(new URL('/api/send-message', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: g.organizer_user_id, message: organizerMsg }),
        }).catch(err => console.error('通知團主失敗:', err)),
        ...members.results.map(m =>
            fetch(new URL('/api/send-message', request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: m.user_id, message: memberMsg }),
            }).catch(err => console.error(`通知成員 ${m.user_id} 失敗:`, err))
        ),
    ];

    context.waitUntil(Promise.all(notifyPromises));

    return Response.json({ success: true, booking_id: bookingId });
}
