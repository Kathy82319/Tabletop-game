export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const body = await context.request.json();
    // 【修改】解構新增 skill, skill_description, equipment
    const { userId, level, current_exp, tag, user_class, perk, notes, skill, skill_description, equipment } = body;

    if (!userId) return new Response(JSON.stringify({ error: '無效的使用者 ID。' }), { status: 400 });

    const db = context.env.DB;

    // 【修改】SQL 語句加入新欄位
    const stmt = db.prepare(`
        UPDATE Users 
        SET level = ?, current_exp = ?, tag = ?, class = ?, perk = ?, notes = ?,
            skill = ?, skill_description = ?, equipment = ?
        WHERE user_id = ?
    `);
    
    await stmt.bind(
        Number(level) || 1, 
        Number(current_exp) || 0, 
        tag, 
        user_class, 
        perk, 
        notes || '',
        skill || '', 
        skill_description || '', 
        equipment || '',
        userId
    ).run();

    return new Response(JSON.stringify({ success: true, message: '成功更新使用者資料！' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: '更新資料失敗。' }), { status: 500 });
  }
}