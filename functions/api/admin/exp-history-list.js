// functions/api/admin/exp-history-list.js
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    if (request.method === 'GET') {
      const stmt = db.prepare(`
        SELECT
          eh.history_id,
          eh.user_id,
          u.line_display_name,
          u.nickname,
          eh.exp_added,
          eh.reason,
          eh.created_at
        FROM ExpHistory AS eh
        LEFT JOIN Users AS u ON eh.user_id = u.user_id
        ORDER BY eh.created_at DESC
      `);
      const { results } = await stmt.all();
      return new Response(JSON.stringify(results || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'PUT') {
      const { history_id, reason, exp_added } = await request.json();
      if (!history_id) return new Response(JSON.stringify({ error: '缺少 history_id' }), { status: 400 });
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0)
        return new Response(JSON.stringify({ error: '原因不可為空' }), { status: 400 });
      const exp = Number(exp_added);
      if (isNaN(exp) || exp <= 0)
        return new Response(JSON.stringify({ error: '經驗值必須為正整數' }), { status: 400 });

      await db.prepare('UPDATE ExpHistory SET reason = ?, exp_added = ? WHERE history_id = ?')
              .bind(reason.trim(), exp, history_id).run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      const { history_id } = await request.json();
      if (!history_id) return new Response(JSON.stringify({ error: '缺少 history_id' }), { status: 400 });

      const record = await db.prepare('SELECT user_id, exp_added FROM ExpHistory WHERE history_id = ?').bind(history_id).first();
      if (!record) return new Response(JSON.stringify({ error: '找不到紀錄' }), { status: 404 });

      const user = await db.prepare('SELECT level, current_exp FROM Users WHERE user_id = ?').bind(record.user_id).first();
      if (!user) return new Response(JSON.stringify({ error: '找不到使用者' }), { status: 404 });

      const totalExp = Math.max(0, (user.level - 1) * 10 + user.current_exp - record.exp_added);
      const newLevel = 1 + Math.floor(totalExp / 10);
      const newCurrentExp = totalExp % 10;

      await db.batch([
        db.prepare('DELETE FROM ExpHistory WHERE history_id = ?').bind(history_id),
        db.prepare('UPDATE Users SET level = ?, current_exp = ? WHERE user_id = ?').bind(newLevel, newCurrentExp, record.user_id)
      ]);

      return new Response(JSON.stringify({ success: true, newLevel, newCurrentExp }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Invalid request method.', { status: 405 });

  } catch (error) {
    console.error('Error in exp-history-list API:', error);
    return new Response(JSON.stringify({ error: '操作失敗', details: error.message }), { status: 500 });
  }
}
