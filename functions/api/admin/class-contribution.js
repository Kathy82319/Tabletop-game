// functions/api/admin/class-contribution.js
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const [{ results: items }, storeInfo] = await Promise.all([
                db.prepare(
                    `SELECT ga.id, ga.name, ga.icon_url, COALESCE(cc.value, 0) AS value
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

            const statements = [
                db.prepare('UPDATE StoreInfo SET show_class_contribution_on_profile = ? WHERE id = 1')
                    .bind(showOnProfile ? 1 : 0),
                ...items.map(item =>
                    db.prepare(
                        `INSERT INTO ClassContributionDisplay (class_asset_id, value, updated_at)
                         VALUES (?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(class_asset_id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
                    ).bind(item.id, Number(item.value) || 0)
                )
            ];

            await db.batch(statements);

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
