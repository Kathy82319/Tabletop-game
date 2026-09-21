// functions/api/admin/monster-state.js
// 後臺查看「目前上場中」的怪物，並可微調牠目前的血量（除錯/調整平衡用）。
// 名稱、圖片、血量上限改到怪物池（monster-templates.js）設定，被打死後會自動換池子裡的另一隻上場。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const monster = await db.prepare(
                `SELECT id, name, image_url, max_hp, current_hp, template_slot FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
            ).first();
            return Response.json(monster || null);
        }

        if (request.method === 'POST') {
            const { current_hp } = await request.json();

            const monster = await db.prepare(
                `SELECT id, max_hp FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
            ).first();
            if (!monster) {
                return Response.json({ error: '目前沒有上場中的怪物' }, { status: 404 });
            }

            const hp = Number(current_hp);
            if (isNaN(hp) || hp < 0 || hp > monster.max_hp) {
                return Response.json({ error: '目前血量必須介於 0 到血量上限之間' }, { status: 400 });
            }

            await db.prepare('UPDATE MonsterState SET current_hp = ? WHERE id = ?').bind(hp, monster.id).run();

            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
