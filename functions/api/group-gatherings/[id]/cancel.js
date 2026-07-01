// 團主解散糾團
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
    if (['approved', 'failed', 'cancelled'].includes(g.status)) {
        return Response.json({ error: '此糾團無法解散' }, { status: 400 });
    }

    await env.DB.prepare(
        `UPDATE GroupGatherings SET status = 'cancelled' WHERE id = ?`
    ).bind(id).run();

    // 通知所有報名成員
    const members = await env.DB.prepare(
        `SELECT user_id FROM GroupGatheringMembers WHERE gathering_id = ? AND status != 'rejected'`
    ).bind(id).all();

    const notifyPromises = members.results.map(m =>
        fetch(new URL('/api/send-message', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: m.user_id,
                message: `😔 糾團取消通知\n\n您報名的糾團「${g.event_date} ${g.start_time}」已被團主解散。\n\n期待下次再一起玩桌遊！`,
            }),
        }).catch(err => console.error(`通知成員 ${m.user_id} 失敗:`, err))
    );

    context.waitUntil(Promise.all(notifyPromises));

    return Response.json({ success: true });
}
