export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = params.id;

    let body = {};
    try {
        body = await request.json();
    } catch { /* reason is optional */ }
    const reason = body.reason || '';

    const g = await env.DB.prepare(
        `SELECT * FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });
    if (g.status !== 'pending_approval') {
        return Response.json({ error: '此揪團不在待審核狀態' }, { status: 400 });
    }

    await env.DB.prepare(
        `UPDATE GroupGatherings SET status = 'failed' WHERE id = ?`
    ).bind(id).run();

    const reasonText = reason ? `\n原因：${reason}` : '';
    const msg = `😔 揪團未通過通知\n\n您發起的揪團「${g.event_date} ${g.start_time}」店家暫時無法接受。${reasonText}\n\n如有疑問請聯繫店家，歡迎再次發起揪團！`;

    context.waitUntil(
        fetch(new URL('/api/send-message', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: g.organizer_user_id, message: msg }),
        }).catch(err => console.error('通知團主失敗:', err))
    );

    return Response.json({ success: true });
}
