// functions/api/get-class-contribution.js
export async function onRequest(context) {
    const { request, env } = context;

    try {
        if (request.method !== 'GET') {
            return new Response('Invalid method', { status: 405 });
        }

        const db = env.DB;

        const [{ results: items }, storeInfo] = await Promise.all([
            db.prepare(
                `SELECT ga.id, ga.name, ga.icon_url, cc.value AS value
                 FROM GameAssets ga
                 JOIN ClassContributionDisplay cc ON cc.class_asset_id = ga.id
                 WHERE ga.type = 'class' AND cc.is_visible = 1
                 ORDER BY ga.display_order, ga.id`
            ).all(),
            db.prepare('SELECT show_class_contribution_on_profile FROM StoreInfo WHERE id = 1').first()
        ]);

        return new Response(JSON.stringify({
            showOnProfile: !!(storeInfo && storeInfo.show_class_contribution_on_profile),
            items: items || []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
