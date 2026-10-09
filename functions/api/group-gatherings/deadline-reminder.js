// 由 cron-worker 定時觸發：報名截止前 30 分鐘內，若揪團已經有人報名、但團主還沒送出店家審核，
// 就提醒團主確認團員並記得送出，避免團主忘記、時間到了直接流標。
// Header: X-Cron-Secret: <CRON_SECRET env var>
import { sendLinePush } from '../_lib/line.js';
import { nowTaiwanString, taiwanStringPlusMinutes } from '../_lib/time.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const secret = request.headers.get('X-Cron-Secret');
    if (!secret || secret !== env.CRON_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = nowTaiwanString();
    const in30min = taiwanStringPlusMinutes(30);

    // 還沒送出審核（open/closed）、截止時間落在「現在～30 分鐘後」之間、還沒發過這封提醒
    const candidates = await env.DB.prepare(
        `SELECT id, organizer_user_id, organizer_name, event_date, start_time, deadline
         FROM GroupGatherings
         WHERE status IN ('open', 'closed')
           AND deadline > ?
           AND deadline <= ?
           AND deadline_reminder_sent = 0`
    ).bind(now, in30min).all();

    if (candidates.results.length === 0) {
        return Response.json({ success: true, reminded: 0 });
    }

    const toRemind = [];
    for (const g of candidates.results) {
        const memberCount = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM GroupGatheringMembers WHERE gathering_id = ? AND status != 'rejected'`
        ).bind(g.id).first();
        // 完全沒人報名的揪團不用提醒，反正到時間就直接流標，提醒了團主也送不出去
        if (memberCount.c > 0) toRemind.push(g);
    }

    if (toRemind.length === 0) {
        return Response.json({ success: true, reminded: 0 });
    }

    const ids = toRemind.map(g => g.id);
    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(
        `UPDATE GroupGatherings SET deadline_reminder_sent = 1 WHERE id IN (${placeholders})`
    ).bind(...ids).run();

    await Promise.all(toRemind.map(g =>
        sendLinePush(env, g.organizer_user_id,
            `⏰ 揪團截止提醒\n\n您發起的揪團「${g.event_date} ${g.start_time}」再過 30 分鐘就要截止報名了，目前已經有人報名囉！\n\n記得去確認團員名單，準備好的話就送出給店家審核，不然時間一到會自動流標喔。`
        ).catch(err => console.error(`發送截止提醒給 ${g.organizer_user_id} 失敗:`, err))
    ));

    return Response.json({ success: true, reminded: ids.length });
}
