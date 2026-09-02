// functions/api/admin/class-contribution-monthly.js
// 儀表板「職業公會排行分佈」：預設一律即時從 ContributionHistory 加總，掃碼加點存完就會自動反映，
// 不用手動按任何按鈕。管理者在儀表板改的數字只是「除錯/調整平衡」用的位移量——
// 存的不是最終數字本身，而是「這個班別這個月要在即時加總上再加減多少」，這樣之後新加點還是會繼續往上累加，
// 不會被凍結在調整當下的快照。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const url   = new URL(request.url);
            const now   = new Date();
            const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const month = url.searchParams.get('month') || defaultMonth;

            const [{ results: classes }, { results: autoTotals }, { results: adjustments }] = await Promise.all([
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

            const autoMap = Object.fromEntries((autoTotals || []).map(r => [r.class_name, r.total]));
            const adjMap  = Object.fromEntries((adjustments || []).map(r => [r.class_asset_id, r.value]));

            const items = (classes || []).map(c => {
                const auto = autoMap[c.name] || 0;
                const adjustment = adjMap[c.id] || 0;
                return {
                    id: c.id,
                    name: c.name,
                    value: auto + adjustment,
                    isAdjusted: !!adjustment
                };
            });

            return Response.json({ month, items });
        }

        if (request.method === 'POST') {
            const { month, items } = await request.json();
            if (!month || !Array.isArray(items)) {
                return Response.json({ error: '資料格式錯誤' }, { status: 400 });
            }

            const [{ results: classes }, { results: autoTotals }] = await Promise.all([
                db.prepare(`SELECT id, name FROM GameAssets WHERE type = 'class'`).all(),
                db.prepare(
                    `SELECT class_name, SUM(contribution_value) AS total
                     FROM ContributionHistory
                     WHERE strftime('%Y-%m', created_at, '+8 hours') = ?
                     GROUP BY class_name`
                ).bind(month).all()
            ]);
            const nameById = Object.fromEntries((classes || []).map(c => [c.id, c.name]));
            const autoMap  = Object.fromEntries((autoTotals || []).map(r => [r.class_name, r.total]));

            // 把使用者在畫面上輸入的「最終想要顯示的數字」換算成要疊加在即時加總上的位移量再存起來
            const statements = items.map(item => {
                const auto = autoMap[nameById[item.id]] || 0;
                const adjustment = (Number(item.value) || 0) - auto;
                return db.prepare(
                    `INSERT INTO ClassContributionMonthly (year_month, class_asset_id, value, updated_at)
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(year_month, class_asset_id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
                ).bind(month, item.id, adjustment);
            });
            if (statements.length > 0) await db.batch(statements);

            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
