// functions/api/admin/monster-templates.js
// 「公會討伐戰」怪物池：可以自由新增／編輯／刪除任意數量的怪物。
// 怪物被打死後，依照清單順序輪到「下一隻」上場，繞一圈後回到第一隻，不用手動更新。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const [{ results: templates }, active] = await Promise.all([
                db.prepare('SELECT id, name, image_url, max_hp, display_order FROM MonsterTemplates ORDER BY display_order, id').all(),
                db.prepare('SELECT template_id FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1').first(),
            ]);
            return Response.json({
                templates: templates || [],
                activeTemplateId: active?.template_id || null,
            });
        }

        if (request.method === 'POST') {
            const { id, name, image_url, max_hp } = await request.json();

            if (!name || typeof name !== 'string') {
                return Response.json({ error: '請輸入怪物名稱' }, { status: 400 });
            }
            const maxHp = Number(max_hp);
            if (isNaN(maxHp) || maxHp <= 0) {
                return Response.json({ error: '血量上限必須是正整數' }, { status: 400 });
            }

            if (id) {
                await db.prepare(
                    `UPDATE MonsterTemplates SET name = ?, image_url = ?, max_hp = ? WHERE id = ?`
                ).bind(name, image_url || null, maxHp, id).run();

                // 如果改到的剛好是目前正在上場的怪物，直接同步套用到現在的怪物身上（血量超過新上限就夾到上限）
                const active = await db.prepare(
                    `SELECT id, current_hp, template_id FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
                ).first();
                if (active && String(active.template_id) === String(id)) {
                    const clampedHp = Math.min(active.current_hp, maxHp);
                    await db.prepare('UPDATE MonsterState SET name = ?, image_url = ?, max_hp = ?, current_hp = ? WHERE id = ?')
                        .bind(name, image_url || null, maxHp, clampedHp, active.id).run();
                }

                return Response.json({ success: true, id: Number(id) });
            }

            const maxOrderRow = await db.prepare('SELECT COALESCE(MAX(display_order), 0) AS maxOrder FROM MonsterTemplates').first();
            const nextOrder = (maxOrderRow?.maxOrder || 0) + 1;
            const result = await db.prepare(
                `INSERT INTO MonsterTemplates (name, image_url, max_hp, display_order) VALUES (?, ?, ?, ?)`
            ).bind(name, image_url || null, maxHp, nextOrder).run();

            // 怪物池從 0 隻新增到第 1 隻時，順便讓牠直接上場，避免怪物池是空的、打怪功能整個壞掉
            const activeMonster = await db.prepare(`SELECT id FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`).first();
            if (!activeMonster) {
                await db.prepare(
                    `INSERT INTO MonsterState (name, image_url, max_hp, current_hp, is_active, template_id) VALUES (?, ?, ?, ?, 1, ?)`
                ).bind(name, image_url || null, maxHp, maxHp, result.meta.last_row_id).run();
            }

            return Response.json({ success: true, id: result.meta.last_row_id });
        }

        if (request.method === 'DELETE') {
            const { id } = await request.json();
            if (!id) return Response.json({ error: '缺少 id' }, { status: 400 });

            await db.prepare('DELETE FROM MonsterTemplates WHERE id = ?').bind(id).run();

            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
