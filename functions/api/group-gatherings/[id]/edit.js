// 團主編輯揪團內容，並記錄變更歷史
const FIELD_LABELS = {
    name: '揪團名稱',
    event_date: '活動日期',
    start_time: '開始時間',
    end_time: '結束時間',
    deadline: '報名截止',
    max_participants: '人數上限',
    note: '備註',
    games: '遊戲',
};

function formatValue(field, value) {
    if (field === 'max_participants') return value ? `${value} 人` : '不限';
    if (field === 'games') return (value || []).map(g => g.name).join('、') || '（無）';
    if (field === 'note') return value || '（無）';
    return value ?? '（無）';
}

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
        return Response.json({ error: '此揪團目前狀態無法編輯' }, { status: 400 });
    }

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
    if (end_time <= start_time) {
        return Response.json({ error: '結束時間必須晚於開始時間' }, { status: 400 });
    }
    if (deadline >= `${event_date} 00:00:00`) {
        return Response.json({ error: '報名截止時間必須早於活動日期' }, { status: 400 });
    }

    const newValues = {
        name: name.trim().substring(0, 20),
        event_date,
        start_time,
        end_time,
        max_participants: max_participants || null,
        games,
        note: note || null,
        deadline,
    };
    const oldValues = {
        name: g.name,
        event_date: g.event_date,
        start_time: g.start_time,
        end_time: g.end_time,
        max_participants: g.max_participants,
        games: JSON.parse(g.games || '[]'),
        note: g.note,
        deadline: g.deadline,
    };

    const changes = [];
    for (const field of Object.keys(FIELD_LABELS)) {
        const oldSerialized = JSON.stringify(oldValues[field]);
        const newSerialized = JSON.stringify(newValues[field]);
        if (oldSerialized !== newSerialized) {
            changes.push({
                field,
                label: FIELD_LABELS[field],
                old: formatValue(field, oldValues[field]),
                new: formatValue(field, newValues[field]),
            });
        }
    }

    if (changes.length === 0) {
        return Response.json({ success: true, changed: false });
    }

    await env.DB.prepare(
        `UPDATE GroupGatherings SET name = ?, event_date = ?, start_time = ?, end_time = ?, max_participants = ?, games = ?, note = ?, deadline = ? WHERE id = ?`
    ).bind(
        newValues.name,
        newValues.event_date,
        newValues.start_time,
        newValues.end_time,
        newValues.max_participants,
        JSON.stringify(newValues.games),
        newValues.note,
        newValues.deadline,
        id
    ).run();

    await env.DB.prepare(
        `INSERT INTO GroupGatheringEditHistory (gathering_id, changes) VALUES (?, ?)`
    ).bind(id, JSON.stringify(changes)).run();

    return Response.json({ success: true, changed: true });
}
