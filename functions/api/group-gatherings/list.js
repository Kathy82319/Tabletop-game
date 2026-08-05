import { STORE_ORGANIZER_USER_ID } from '../_lib/constants.js';
import { nowTaiwanString } from '../_lib/time.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const past = url.searchParams.get('past') === '1';
    const now = nowTaiwanString();

    const query = past
        ? `SELECT g.id, g.organizer_name, g.organizer_user_id, g.name, g.event_date, g.start_time, g.end_time,
                  g.max_participants, g.games, g.note, g.deadline, g.status, g.share_token,
                  COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
           FROM GroupGatherings g
           LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
           WHERE g.status IN ('approved', 'failed', 'cancelled')
           GROUP BY g.id
           ORDER BY g.event_date DESC, g.start_time DESC`
        : `SELECT g.id, g.organizer_name, g.organizer_user_id, g.name, g.event_date, g.start_time, g.end_time,
                  g.max_participants, g.games, g.note, g.deadline, g.status, g.share_token,
                  COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
           FROM GroupGatherings g
           LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
           WHERE g.status IN ('open', 'closed') AND g.deadline > ?
           GROUP BY g.id
           ORDER BY g.event_date ASC, g.start_time ASC`;

    const gatherings = past
        ? await env.DB.prepare(query).all()
        : await env.DB.prepare(query).bind(now).all();

    const result = gatherings.results.map(g => {
        const { organizer_user_id, ...publicG } = g;
        return {
            ...publicG,
            games: JSON.parse(g.games || '[]'),
            is_store_organizer: organizer_user_id === STORE_ORGANIZER_USER_ID,
        };
    });

    return Response.json(result);
}
