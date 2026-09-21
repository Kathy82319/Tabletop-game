// functions/api/admin/class-contribution.js
// 「職業工會排行」：數值預設一律即時從 ContributionHistory 加總（掃碼加點的貢獻度紀錄、打怪傷害都算在內），
// 不用手動更新。這裡的數值欄位是給團主除錯/調整平衡用——改完按「儲存變更」存的不是最終數字本身，
// 而是「要在即時加總上再加減多少」，這樣之後新增的貢獻度還是會繼續往上累加，不會被凍結在調整當下的快照。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const [{ results: items }, storeInfo] = await Promise.all([
                db.prepare(
                    `SELECT ga.id, ga.name, ga.icon_url,
                            COALESCE((SELECT SUM(ch.contribution_value) FROM ContributionHistory ch WHERE ch.class_name = ga.name), 0)
                              + COALESCE(cc.value, 0) AS value,
                            COALESCE(cc.is_visible, 1) AS is_visible
                     FROM GameAssets ga
                     LEFT JOIN ClassContributionDisplay cc ON cc.class_asset_id = ga.id
                     WHERE ga.type = 'class'
                     ORDER BY ga.display_order, ga.id`
                ).all(),
                db.prepare('SELECT show_class_contribution_on_profile FROM StoreInfo WHERE id = 1').first()
            ]);

            return new Response(JSON.stringify({
                showOnProfile: !!(storeInfo && storeInfo.show_class_contribution_on_profile),
                items: items || []
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
            const { showOnProfile, items } = await request.json();

            if (!Array.isArray(items)) {
                return new Response(JSON.stringify({ error: '資料格式錯誤' }), { status: 400 });
            }

            const [{ results: classes }, { results: sums }] = await Promise.all([
                db.prepare(`SELECT id, name FROM GameAssets WHERE type = 'class'`).all(),
                db.prepare(`SELECT class_name, SUM(contribution_value) AS total FROM ContributionHistory GROUP BY class_name`).all()
            ]);
            const nameById = Object.fromEntries((classes || []).map(c => [c.id, c.name]));
            const sumMap = Object.fromEntries((sums || []).map(r => [r.class_name, r.total]));

            const statements = [
                db.prepare('UPDATE StoreInfo SET show_class_contribution_on_profile = ? WHERE id = 1')
                    .bind(showOnProfile ? 1 : 0),
                // 把畫面上輸入的「最終想要顯示的數字」換算成要疊加在即時加總上的位移量再存起來
                ...items.map(item => {
                    const auto = sumMap[nameById[item.id]] || 0;
                    const adjustment = (Number(item.value) || 0) - auto;
                    return db.prepare(
                        `INSERT INTO ClassContributionDisplay (class_asset_id, value, is_visible, updated_at)
                         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(class_asset_id) DO UPDATE SET value = excluded.value, is_visible = excluded.is_visible, updated_at = CURRENT_TIMESTAMP`
                    ).bind(item.id, adjustment, item.isVisible ? 1 : 0);
                })
            ];

            await db.batch(statements);

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
