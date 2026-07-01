// 團主提交糾團給店家審核
export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = params.id;

    const liffToken = request.headers.get('X-LIFF-Token');
    if (!liffToken) {
        return Response.json({ error: '未登入' }, { status: 401 });
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${liffToken}` },
    });
    if (!profileRes.ok) {
        return Response.json({ error: '驗證失敗' }, { status: 401 });
    }
    const profile = await profileRes.json();

    const g = await env.DB.prepare(
        `SELECT * FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此糾團' }, { status: 404 });
    if (g.organizer_user_id !== profile.userId) return Response.json({ error: '僅團主可操作' }, { status: 403 });
    if (!['open', 'closed'].includes(g.status)) {
        return Response.json({ error: '此糾團狀態不允許提交' }, { status: 400 });
    }

    const memberCount = await env.DB.prepare(
        `SELECT COUNT(*) as c FROM GroupGatheringMembers WHERE gathering_id = ? AND status != 'rejected'`
    ).bind(id).first();

    if (memberCount.c === 0) {
        return Response.json({ error: '尚無任何成員報名，無法提交' }, { status: 400 });
    }

    await env.DB.prepare(
        `UPDATE GroupGatherings SET status = 'pending_approval' WHERE id = ?`
    ).bind(id).run();

    // 通知管理員有新糾團待審核
    const storeInfo = await env.DB.prepare(
        `SELECT booking_notify_user_id FROM StoreInfo WHERE id = 1`
    ).first();

    if (storeInfo?.booking_notify_user_id) {
        context.waitUntil(
            fetch(new URL('/api/send-message', request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: storeInfo.booking_notify_user_id,
                    message: `🔔 新糾團審核通知\n\n${g.organizer_name} 發起的糾團需要審核：\n日期：${g.event_date} ${g.start_time}–${g.end_time}\n人數：${memberCount.c} 人\n\n請至後台「糾團管理」審核。`,
                }),
            }).catch(err => console.error('通知管理員失敗:', err))
        );
    }

    return Response.json({ success: true });
}
