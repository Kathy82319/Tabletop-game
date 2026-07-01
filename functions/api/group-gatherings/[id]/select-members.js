// 無人數上限時，團主手動篩選哪些成員「通過」
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
    if (g.organizer_user_id !== profile.userId) return Response.json({ error: '僅團主可操作' }, { status: 403 });
    if (!['open', 'closed'].includes(g.status)) {
        return Response.json({ error: '此揪團狀態不允許篩選成員' }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { approved_member_ids } = body;
    if (!Array.isArray(approved_member_ids)) {
        return Response.json({ error: '缺少 approved_member_ids' }, { status: 400 });
    }

    const allMembers = await env.DB.prepare(
        `SELECT id, user_id FROM GroupGatheringMembers WHERE gathering_id = ?`
    ).bind(id).all();

    const updates = allMembers.results.map(m => {
        const status = approved_member_ids.includes(m.user_id) ? 'approved' : 'rejected';
        return env.DB.prepare(
            `UPDATE GroupGatheringMembers SET status = ? WHERE id = ?`
        ).bind(status, m.id);
    });

    await env.DB.batch(updates);

    return Response.json({ success: true });
}
