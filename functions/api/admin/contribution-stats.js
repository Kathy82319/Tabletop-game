// functions/api/admin/contribution-stats.js

export async function onRequest(context) {
    try {
        if (context.request.method !== 'GET') {
            return new Response('Invalid method', { status: 405 });
        }
        const db = context.env.DB;
        const { results } = await db.prepare(
            `SELECT class_name, SUM(contribution_value) AS total
             FROM ContributionHistory
             GROUP BY class_name
             ORDER BY total DESC`
        ).all();
        return new Response(JSON.stringify(results || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
