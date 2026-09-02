// functions/api/admin/class-contribution-monthly.js
// 儀表板「職業公會排行分佈」的月結算：預設自動帶入該月從 ContributionHistory 算出的實際貢獻度，
// 管理者可以手動調整後儲存；儲存過的月份之後仍可隨時回來再改，沒有鎖定機制。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const url   = new URL(request.url);
            const now   = new Date();
            const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const month = url.searchParams.get('month') || defaultMonth;
            // live=1：忽略之前儲存過的數字，一律回傳目前 ContributionHistory 即時算出的實際貢獻度
            // （儲存過的月份預設會一直顯示儲存當下的快照，不會自動跟著之後新增的加點變動）
            const live  = url.searchParams.get('live') === '1';

            const [{ results: classes }, { results: autoTotals }, { results: saved }] = await Promise.all([
                db.prepare(`SELECT id, name FROM GameAssets WHERE type = 'class' ORDER BY display_order, id`).all(),
                // created_at 是 UTC，換算成台灣時間（+8 小時）後再取月份，避免月初/月底的紀錄被算到錯的月份
                db.prepare(
                    `SELECT class_name, SUM(contribution_value) AS total
                     FROM ContributionHistory
                     WHERE strftime('%Y-%m', created_at, '+8 hours') = ?
                     GROUP BY class_name`
                ).bind(month).all(),
                db.prepare(`SELECT class_asset_id, value FROM ClassContributionMonthly WHERE year_month = ?`).bind(month).all()
            ]);

            const autoMap  = Object.fromEntries((autoTotals || []).map(r => [r.class_name, r.total]));
            const savedMap = Object.fromEntries((saved || []).map(r => [r.class_asset_id, r.value]));

            const items = (classes || []).map(c => ({
                id: c.id,
                name: c.name,
                value: (!live && savedMap[c.id] !== undefined) ? savedMap[c.id] : (autoMap[c.name] || 0),
                isAdjusted: !live && savedMap[c.id] !== undefined
            }));

            return Response.json({ month, items });
        }

        if (request.method === 'POST') {
            const { month, items } = await request.json();
            if (!month || !Array.isArray(items)) {
                return Response.json({ error: '資料格式錯誤' }, { status: 400 });
            }

            const statements = items.map(item =>
                db.prepare(
                    `INSERT INTO ClassContributionMonthly (year_month, class_asset_id, value, updated_at)
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(year_month, class_asset_id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
                ).bind(month, item.id, Number(item.value) || 0)
            );
            if (statements.length > 0) await db.batch(statements);

            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
