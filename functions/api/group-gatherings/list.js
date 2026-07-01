export async function onRequestGet(context) {
    const { env } = context;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const gatherings = await env.DB.prepare(
        `SELECT g.id, g.organizer_name, g.event_date, g.start_time, g.end_time,
                g.max_participants, g.games, g.note, g.deadline, g.status, g.share_token,
                COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
         FROM GroupGatherings g
         LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
         WHERE g.status = 'open' AND g.deadline > ?
         GROUP BY g.id
         ORDER BY g.event_date ASC, g.start_time ASC`
    ).bind(now).all();

    const result = gatherings.results.map(g => ({
        ...g,
        games: JSON.parse(g.games || '[]'),
    }));

    return Response.json(result);
}
