// 回傳目前使用者已報名、且有尚未看過的編輯紀錄的揪團，供 App 開啟時彈窗提醒
export async function onRequestGet(context) {
    const { request, env } = context;

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

    const rows = await env.DB.prepare(
        `SELECT g.id, g.name, g.organizer_name, g.event_date, g.start_time, m.last_seen_edit_id
         FROM GroupGatheringMembers m
         JOIN GroupGatherings g ON g.id = m.gathering_id
         WHERE m.user_id = ? AND m.status != 'rejected'
           AND EXISTS (
               SELECT 1 FROM GroupGatheringEditHistory h
               WHERE h.gathering_id = g.id AND h.id > m.last_seen_edit_id
           )`
    ).bind(profile.userId).all();

    const result = [];
    for (const row of rows.results) {
        const history = await env.DB.prepare(
            `SELECT edited_at, changes FROM GroupGatheringEditHistory
             WHERE gathering_id = ? AND id > ? ORDER BY id ASC`
        ).bind(row.id, row.last_seen_edit_id).all();

        result.push({
            gathering_id: row.id,
            name: row.name,
            organizer_name: row.organizer_name,
            event_date: row.event_date,
            start_time: row.start_time,
            edits: history.results.map(h => ({
                edited_at: h.edited_at,
                changes: JSON.parse(h.changes),
            })),
        });
    }

    return Response.json(result);
}
