// functions/api/monster-status.js
// 公會討伐戰：回傳目前共用怪物的血量，以及這位會員的職業／剩餘攻擊次數。
import { verifyLiffUser } from './_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;

    const profile = await verifyLiffUser(request);
    if (!profile) {
        return Response.json({ error: '未登入或驗證失敗。' }, { status: 401 });
    }

    const db = env.DB;

    const [monster, user] = await Promise.all([
        db.prepare(`SELECT name, max_hp, current_hp FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`).first(),
        db.prepare('SELECT class, available_attacks FROM Users WHERE user_id = ?').bind(profile.userId).first(),
    ]);

    return Response.json({
        monster: monster || null,
        userClass: user?.class || null,
        availableAttacks: user?.available_attacks || 0,
    });
}
