// functions/api/admin/exp-history-list.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const db = context.env.DB;

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

  } catch (error) {
    console.error('Error in exp-history-list API:', error);
    return new Response(JSON.stringify({ error: '獲取經驗紀錄失敗。', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
