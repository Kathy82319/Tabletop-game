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
        `SELECT status FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此糾團' }, { status: 404 });
    if (!['open', 'closed'].includes(g.status)) {
        return Response.json({ error: '此糾團已無法退出' }, { status: 400 });
    }

    await env.DB.prepare(
        `DELETE FROM GroupGatheringMembers WHERE gathering_id = ? AND user_id = ?`
    ).bind(id, profile.userId).run();

    // 若糾團因為退出而低於上限，重新開放報名
    if (g.status === 'closed') {
        await env.DB.prepare(
            `UPDATE GroupGatherings SET status = 'open' WHERE id = ?`
        ).bind(id).run();
    }

    return Response.json({ success: true });
}
