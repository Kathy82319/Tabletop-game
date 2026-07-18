// 成員在看過編輯提醒彈窗後，標記該揪團的編輯紀錄為已讀
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

    const latest = await env.DB.prepare(
        `SELECT MAX(id) as max_id FROM GroupGatheringEditHistory WHERE gathering_id = ?`
    ).bind(id).first();

    await env.DB.prepare(
        `UPDATE GroupGatheringMembers SET last_seen_edit_id = ? WHERE gathering_id = ? AND user_id = ?`
    ).bind(latest?.max_id || 0, id, profile.userId).run();

    return Response.json({ success: true });
}
