// functions/api/admin/contribution-history.js
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    if (request.method === 'GET') {
      const { results } = await db.prepare(`
        SELECT
          ch.contribution_id,
          ch.user_id,
          u.line_display_name,
          u.nickname,
          ch.class_name,
          ch.contribution_value,
          ch.created_at
        FROM ContributionHistory AS ch
        LEFT JOIN Users AS u ON ch.user_id = u.user_id
        ORDER BY ch.created_at DESC
      `).all();

      return new Response(JSON.stringify(results || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'DELETE') {
      const { contribution_id } = await request.json();
      if (!contribution_id)
        return new Response(JSON.stringify({ error: '缺少 contribution_id' }), { status: 400 });

      await db.prepare('DELETE FROM ContributionHistory WHERE contribution_id = ?')
              .bind(contribution_id).run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Invalid request method.', { status: 405 });

  } catch (error) {
    console.error('Error in contribution-history API:', error);
    return new Response(JSON.stringify({ error: '操作失敗', details: error.message }), { status: 500 });
  }
}
