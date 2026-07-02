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

    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });
    if (g.status !== 'open') return Response.json({ error: '此揪團已不開放報名' }, { status: 400 });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (g.deadline <= now) return Response.json({ error: '報名已截止' }, { status: 400 });
    if (g.organizer_user_id === profile.userId) return Response.json({ error: '團主不需要報名' }, { status: 400 });

    const existing = await env.DB.prepare(
        `SELECT id FROM GroupGatheringMembers WHERE gathering_id = ? AND user_id = ?`
    ).bind(id, profile.userId).first();
    if (existing) return Response.json({ error: '您已報名此揪團' }, { status: 400 });

    if (g.max_participants) {
        const count = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM GroupGatheringMembers WHERE gathering_id = ? AND status != 'rejected'`
        ).bind(id).first();
        if (count.c >= g.max_participants - 1) {
            return Response.json({ error: '報名人數已滿' }, { status: 400 });
        }
    }

    let body = {};
    try { body = await request.json(); } catch {}
    const displayName = (body.display_name || '').trim() || profile.displayName;
    const lineName = profile.displayName;

    // 有人數限制的團直接 approved，無限制的團需團主手動篩選所以為 pending
    const joinStatus = g.max_participants ? 'approved' : 'pending';
    await env.DB.prepare(
        `INSERT INTO GroupGatheringMembers (gathering_id, user_id, display_name, line_name, status) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, profile.userId, displayName, lineName, joinStatus).run();

    // 人數已滿時自動關閉報名並通知團主
    if (g.max_participants) {
        const count = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM GroupGatheringMembers WHERE gathering_id = ? AND status != 'rejected'`
        ).bind(id).first();
        if (count.c >= g.max_participants - 1) {
            await env.DB.prepare(
                `UPDATE GroupGatherings SET status = 'closed' WHERE id = ?`
            ).bind(id).run();

            context.waitUntil(
                fetch(new URL('/api/send-message', request.url), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: g.organizer_user_id,
                        message: `🎉 人數已滿通知\n\n您發起的揪團（${g.event_date} ${g.start_time}）報名人數已達上限 ${g.max_participants} 人！\n\n請記得在截止時間前至揪團頁面提交給店家確認。`,
                    }),
                }).catch(err => console.error('通知團主人數已滿失敗:', err))
            );
        }
    }

    return Response.json({ success: true });
}
