export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;

    const g = await env.DB.prepare(
        `SELECT * FROM GroupGatherings WHERE id = ?`
    ).bind(id).first();

    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });

    const members = await env.DB.prepare(
        `SELECT id, user_id, display_name, line_name, joined_at, status
         FROM GroupGatheringMembers
         WHERE gathering_id = ?
         ORDER BY joined_at ASC`
    ).bind(id).all();

    return Response.json({
        ...g,
        games: JSON.parse(g.games || '[]'),
        members: members.results,
    });
}

// 後臺直接刪除整個揪團（含成員名單、編輯紀錄），用於清掉重複/測試/誤建的揪團，跟一般使用者的「取消」是不同的動作，永久刪除、不能復原
export async function onRequestDelete(context) {
    const { env, params } = context;
    const id = params.id;

    const g = await env.DB.prepare(`SELECT id FROM GroupGatherings WHERE id = ?`).bind(id).first();
    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });

    await env.DB.batch([
        env.DB.prepare(`DELETE FROM GroupGatheringEditHistory WHERE gathering_id = ?`).bind(id),
        env.DB.prepare(`DELETE FROM GroupGatheringMembers WHERE gathering_id = ?`).bind(id),
        env.DB.prepare(`DELETE FROM GroupGatherings WHERE id = ?`).bind(id),
    ]);

    return Response.json({ success: true });
}
