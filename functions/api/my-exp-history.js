// functions/api/my-exp-history.js
import { verifyLiffUser } from './_lib/auth.js';

export async function onRequest(context) {
  try {
    const profile = await verifyLiffUser(context.request);
    if (!profile) {
      return new Response(JSON.stringify({ error: '未登入或驗證失敗。' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = profile.userId;

    const db = context.env.DB;
    
    const stmt = db.prepare(
      `SELECT * FROM ExpHistory 
       WHERE user_id = ? 
       ORDER BY created_at DESC`
    );
    const { results } = await stmt.bind(userId).all();

    return new Response(JSON.stringify(results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in my-exp-history API:', error);
    return new Response(JSON.stringify({ error: '查詢個人經驗紀錄失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
