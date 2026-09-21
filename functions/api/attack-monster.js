// functions/api/attack-monster.js
// 公會討伐戰：會員消耗一次攻擊機會，對目前的共用怪物造成隨機傷害（依職業攻擊力區間），
// 傷害直接寫進 ContributionHistory，讓職業公會排行（月結算）自動反映打怪的戰果。
import { verifyLiffUser } from './_lib/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const profile = await verifyLiffUser(request);
    if (!profile) {
        return Response.json({ error: '未登入或驗證失敗。' }, { status: 401 });
    }

    const db = env.DB;

    const user = await db.prepare(
        'SELECT user_id, class, available_attacks FROM Users WHERE user_id = ?'
    ).bind(profile.userId).first();

    if (!user) return Response.json({ error: '找不到會員資料。' }, { status: 404 });
    if (!user.class || user.class === '無') {
        return Response.json({ error: '尚未設定職業，無法攻擊。' }, { status: 400 });
    }
    if (!user.available_attacks || user.available_attacks <= 0) {
        return Response.json({ error: '目前沒有可用的攻擊次數，消費或入場累積經驗值後再來吧！' }, { status: 400 });
    }

    const classAsset = await db.prepare(
        `SELECT attack_min, attack_max FROM GameAssets WHERE type = 'class' AND name = ?`
    ).bind(user.class).first();

    // 沒有設定攻擊力區間的職業，先給一個保底範圍，避免整個功能因為忘記設定而壞掉
    const rawMin = (classAsset && classAsset.attack_min) || 5;
    const rawMax = (classAsset && classAsset.attack_max) || 15;
    const lo = Math.min(rawMin, rawMax);
    const hi = Math.max(rawMin, rawMax);
    const damage = Math.floor(Math.random() * (hi - lo + 1)) + lo;

    const monster = await db.prepare(
        `SELECT * FROM MonsterState WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
    ).first();
    if (!monster) {
        return Response.json({ error: '目前沒有怪物，請聯絡店家設定。' }, { status: 500 });
    }

    const newHp = Math.max(0, monster.current_hp - damage);
    const defeated = newHp === 0;

    const operations = [
        db.prepare('UPDATE Users SET available_attacks = available_attacks - 1 WHERE user_id = ?').bind(profile.userId),
        db.prepare('UPDATE MonsterState SET current_hp = ? WHERE id = ?').bind(newHp, monster.id),
        db.prepare('INSERT INTO ContributionHistory (user_id, class_name, contribution_value) VALUES (?, ?, ?)')
          .bind(profile.userId, user.class, damage),
    ];

    if (defeated) {
        operations.push(
            db.prepare('UPDATE MonsterState SET is_active = 0, defeated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(monster.id)
        );
        // 新怪物先沿用同樣的血量上限，之後可以再到後臺職業管理旁邊調整難度
        operations.push(
            db.prepare('INSERT INTO MonsterState (name, max_hp, current_hp, is_active) VALUES (?, ?, ?, 1)')
              .bind(monster.name, monster.max_hp, monster.max_hp)
        );
    }

    await db.batch(operations);

    return Response.json({
        success: true,
        damage,
        monsterName: monster.name,
        monsterMaxHp: monster.max_hp,
        monsterHpBefore: monster.current_hp,
        monsterHpAfter: newHp,
        defeated,
        remainingAttacks: user.available_attacks - 1,
    });
}
