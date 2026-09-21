// functions/api/admin/monster-templates.js
// 「公會討伐戰」怪物池：固定兩個插槽（1、2），怪物被打死後會自動換成另一個插槽的怪物上場，
// 讓團主可以預先設定好兩隻怪物交錯輪流，不用在怪物剛被打死的當下立刻手動更新。
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        if (request.method === 'GET') {
            const [{ results: templates }, active] = await Promise.all([
                db.prepare('SELECT slot, name, image_url, max_hp FROM MonsterTemplates ORDER BY slot').all(),
                db.prepare('SELECT template_slot FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1').first(),
            ]);
            return Response.json({
                templates: templates || [],
                activeSlot: active?.template_slot || null,
            });
        }

        if (request.method === 'POST') {
            const { templates } = await request.json();

            if (!Array.isArray(templates) || templates.length === 0) {
                return Response.json({ error: '資料格式錯誤' }, { status: 400 });
            }

            for (const t of templates) {
                if (t.slot !== 1 && t.slot !== 2) {
                    return Response.json({ error: '無效的怪物插槽' }, { status: 400 });
                }
                if (!t.name || typeof t.name !== 'string') {
                    return Response.json({ error: '請輸入怪物名稱' }, { status: 400 });
                }
                const maxHp = Number(t.max_hp);
                if (isNaN(maxHp) || maxHp <= 0) {
                    return Response.json({ error: '血量上限必須是正整數' }, { status: 400 });
                }
            }

            const statements = templates.map(t =>
                db.prepare(
                    `INSERT INTO MonsterTemplates (slot, name, image_url, max_hp) VALUES (?, ?, ?, ?)
                     ON CONFLICT(slot) DO UPDATE SET name = excluded.name, image_url = excluded.image_url, max_hp = excluded.max_hp`
                ).bind(t.slot, t.name, t.image_url || null, Number(t.max_hp))
            );

            // 如果改到的插槽正是目前正在上場的那隻，直接同步套用到現在的怪物身上（血量超過新上限就夾到上限）
            const active = await db.prepare(
                `SELECT id, current_hp, template_slot FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
            ).first();
            if (active && active.template_slot) {
                const matched = templates.find(t => t.slot === active.template_slot);
                if (matched) {
                    const maxHp = Number(matched.max_hp);
                    const clampedHp = Math.min(active.current_hp, maxHp);
                    statements.push(
                        db.prepare('UPDATE MonsterState SET name = ?, image_url = ?, max_hp = ?, current_hp = ? WHERE id = ?')
                          .bind(matched.name, matched.image_url || null, maxHp, clampedHp, active.id)
                    );
                }
            }

            await db.batch(statements);

            return Response.json({ success: true });
        }

        return new Response('Invalid method', { status: 405 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
