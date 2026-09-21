// functions/api/admin/monster-state.js
// 後臺管理「公會討伐戰」目前這隻怪物的名稱／圖片／血量
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const monster = await db.prepare(
                `SELECT id, name, image_url, max_hp, current_hp FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
            ).first();
            return Response.json(monster || null);
        }

        if (request.method === 'POST') {
            const { name, image_url, max_hp, current_hp } = await request.json();

            if (!name || typeof name !== 'string') {
                return Response.json({ error: '請輸入怪物名稱' }, { status: 400 });
            }
            const maxHp = Number(max_hp);
            const currentHp = Number(current_hp);
            if (isNaN(maxHp) || maxHp <= 0) {
                return Response.json({ error: '血量上限必須是正整數' }, { status: 400 });
            }
            if (isNaN(currentHp) || currentHp < 0 || currentHp > maxHp) {
                return Response.json({ error: '目前血量必須介於 0 到血量上限之間' }, { status: 400 });
            }

            const monster = await db.prepare(
                `SELECT id FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
            ).first();

            if (monster) {
                await db.prepare(
                    `UPDATE MonsterState SET name = ?, image_url = ?, max_hp = ?, current_hp = ? WHERE id = ?`
                ).bind(name, image_url || null, maxHp, currentHp, monster.id).run();
            } else {
                await db.prepare(
                    `INSERT INTO MonsterState (name, image_url, max_hp, current_hp, is_active) VALUES (?, ?, ?, ?, 1)`
                ).bind(name, image_url || null, maxHp, currentHp).run();
            }

            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
