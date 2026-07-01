// 團主在 pending_approval 狀態手動補位候補成員
export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = params.id;

    const liffToken = request.headers.get('X-LIFF-Token');
    if (!liffToken) return Response.json({ error: '未登入' }, { status: 401 });

    const profileRes = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${liffToken}` },
    });
    if (!profileRes.ok) return Response.json({ error: '驗證失敗' }, { status: 401 });
    const profile = await profileRes.json();

    const g = await env.DB.prepare(
        `SELECT * FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });
    if (g.organizer_user_id !== profile.userId) return Response.json({ error: '僅團主可操作' }, { status: 403 });
    if (g.status !== 'pending_approval') {
        return Response.json({ error: '此揪團不在待審核狀態' }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { user_id } = body;
    if (!user_id) return Response.json({ error: '缺少 user_id' }, { status: 400 });

    const member = await env.DB.prepare(
        `SELECT id FROM GroupGatheringMembers WHERE gathering_id = ? AND user_id = ? AND status = 'pending'`
    ).bind(id, user_id).first();

    if (!member) return Response.json({ error: '找不到此候補成員' }, { status: 404 });

    await env.DB.prepare(
        `UPDATE GroupGatheringMembers SET status = 'approved' WHERE id = ?`
    ).bind(member.id).run();

    return Response.json({ success: true });
}
