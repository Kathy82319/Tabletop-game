// 團主將 pending_approval 狀態的揪團重新開放報名
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

    await env.DB.prepare(
        `UPDATE GroupGatherings SET status = 'open' WHERE id = ?`
    ).bind(id).run();

    return Response.json({ success: true });
}
