export async function onRequestPost(context) {
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
    const organizerUserId = profile.userId;
    const organizerName = profile.displayName;

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { event_date, start_time, end_time, max_participants, games, note, deadline, name } = body;

    if (!event_date || !start_time || !end_time || !deadline || !name) {
        return Response.json({ error: '缺少必填欄位' }, { status: 400 });
    }

    if (!Array.isArray(games) || games.length === 0 || games.length > 3) {
        return Response.json({ error: '請選擇 1 至 3 款遊戲' }, { status: 400 });
    }

    const share_token = crypto.randomUUID();

    await env.DB.prepare(
        `INSERT INTO GroupGatherings (organizer_user_id, organizer_name, name, event_date, start_time, end_time, max_participants, games, note, deadline, share_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        organizerUserId,
        organizerName,
        name.trim().substring(0, 20),
        event_date,
        start_time,
        end_time,
        max_participants || null,
        JSON.stringify(games),
        note || null,
        deadline,
        share_token
    ).run();

    const row = await env.DB.prepare(
        `SELECT id FROM GroupGatherings WHERE share_token = ?`
    ).bind(share_token).first();

    return Response.json({ success: true, id: row.id, share_token }, { status: 201 });
}
