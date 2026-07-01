// 由 cron-job.org 每天台灣時間 00:00 觸發
// Header: X-Cron-Secret: <CRON_SECRET env var>
export async function onRequestPost(context) {
    const { request, env } = context;

    const secret = request.headers.get('X-Cron-Secret');
    if (!secret || secret !== env.CRON_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 找出已過截止時間但仍在 open/closed 狀態的揪團
    const expired = await env.DB.prepare(
        `SELECT id, organizer_user_id, organizer_name, event_date, start_time
         FROM GroupGatherings
         WHERE status IN ('open', 'closed') AND deadline <= ?`
    ).bind(now).all();

    if (expired.results.length === 0) {
        return Response.json({ success: true, expired: 0 });
    }

    const ids = expired.results.map(g => g.id);
    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(
        `UPDATE GroupGatherings SET status = 'failed' WHERE id IN (${placeholders})`
    ).bind(...ids).run();

    // 發 LINE 通知給各團主
    const notifyPromises = expired.results.map(g =>
        fetch(new URL('/api/send-message', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: g.organizer_user_id,
                message: `😔 揪團流標通知\n\n您發起的揪團「${g.event_date} ${g.start_time}」已超過截止時間，未能成功提交店家審核，已自動流標。\n\n感謝您的參與，歡迎再次發起揪團！`,
            }),
        }).catch(err => console.error(`發送流標通知給 ${g.organizer_user_id} 失敗:`, err))
    );

    // 通知所有 pending 成員
    const memberNotifyPromises = expired.results.map(async g => {
        const members = await env.DB.prepare(
            `SELECT user_id FROM GroupGatheringMembers WHERE gathering_id = ? AND status = 'pending'`
        ).bind(g.id).all();
        return Promise.all(members.results.map(m =>
            fetch(new URL('/api/send-message', request.url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: m.user_id,
                    message: `😔 揪團流標通知\n\n您報名的揪團「${g.event_date} ${g.start_time}」已超過截止時間自動流標。\n\n期待下次再一起玩桌遊！`,
                }),
            }).catch(err => console.error(`發送流標通知給成員 ${m.user_id} 失敗:`, err))
        ));
    });

    await Promise.all([...notifyPromises, ...memberNotifyPromises]);

    return Response.json({ success: true, expired: ids.length });
}
