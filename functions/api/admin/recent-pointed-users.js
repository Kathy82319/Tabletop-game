// functions/api/admin/recent-pointed-users.js
export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid method.', { status: 405 });
    }

    const db = context.env.DB;
    const { results } = await db.prepare(`
      SELECT eh.user_id, u.nickname, u.line_display_name, MAX(eh.created_at) AS last_added
      FROM ExpHistory eh
      LEFT JOIN Users u ON eh.user_id = u.user_id
      GROUP BY eh.user_id
      ORDER BY last_added DESC
      LIMIT 15
    `).all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
