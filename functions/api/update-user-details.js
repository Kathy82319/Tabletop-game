export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const body = await context.request.json();
    
    // 【修改】解構出前端新傳來的 user_assets 陣列
    const { userId, level, current_exp, tag, user_class, perk, notes, user_assets } = body;

    if (!userId) return new Response(JSON.stringify({ error: '無效的使用者 ID。' }), { status: 400 });

    const db = context.env.DB;
    const statements = [];

    // 1. 更新 Users 基本資料 (不再更新舊版的單一 skill 與 equipment 欄位)
    statements.push(
        db.prepare(`
            UPDATE Users 
            SET level = ?, current_exp = ?, tag = ?, class = ?, perk = ?, notes = ?
            WHERE user_id = ?
        `).bind(
            Number(level) || 1, 
            Number(current_exp) || 0, 
            tag || '無', 
            user_class || '無', 
            perk || '', 
            notes || '',
            userId
        )
    );

    // 2. 清除該會員在 UserAssets 表中的所有舊關聯資料 (確保不會重複派發)
    statements.push(
        db.prepare(`DELETE FROM UserAssets WHERE user_id = ?`).bind(userId)
    );

    // 3. 處理新的多筆紀錄 (user_assets)
    if (user_assets && Array.isArray(user_assets) && user_assets.length > 0) {
        // 因為前端只傳了名稱，我們需要先從 GameAssets 把對應的 ID 找出來
        const { results: allGameAssets } = await db.prepare(`SELECT id, type, name FROM GameAssets`).all();
        
        for (const asset of user_assets) {
            // 比對出這個項目的真實 ID
            const foundAsset = allGameAssets.find(a => a.type === asset.type && a.name === asset.name);
            if (foundAsset) {
                statements.push(
                    db.prepare(`
                        INSERT INTO UserAssets (user_id, asset_id, custom_description)
                        VALUES (?, ?, ?)
                    `).bind(userId, foundAsset.id, asset.description || '')
                );
            }
        }
    }

    // 4. 使用 db.batch 批次執行所有 SQL，確保寫入的安全與一致性
    await db.batch(statements);

    return new Response(JSON.stringify({ success: true, message: '成功更新使用者資料！' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: '更新資料失敗。' }), { status: 500 });
  }
}