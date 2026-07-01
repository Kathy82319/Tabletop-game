export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending_approval';

    const gatherings = await env.DB.prepare(
        `SELECT g.id, g.organizer_user_id, g.organizer_name, g.event_date, g.start_time, g.end_time,
                g.max_participants, g.games, g.note, g.deadline, g.status, g.share_token, g.created_at,
                COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
         FROM GroupGatherings g
         LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
         WHERE g.status = ?
         GROUP BY g.id
         ORDER BY g.created_at DESC`
    ).bind(status).all();

    const result = gatherings.results.map(g => ({
        ...g,
        games: JSON.parse(g.games || '[]'),
    }));

    return Response.json(result);
}
