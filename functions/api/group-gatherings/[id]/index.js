import { STORE_ORGANIZER_USER_ID } from '../../_lib/constants.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const id = params.id;

    // 主查詢、成員列表、編輯紀錄、LINE 身分驗證彼此不互相依賴，平行處理以縮短總等待時間
    // （LINE 個人資料 API 是外部呼叫，通常比 D1 查詢慢很多，平行後總時間約等於它一次的時間）
    const liffToken = request.headers.get('X-LIFF-Token');
    const [g, members, editHistory, profileRes] = await Promise.all([
        env.DB.prepare(
            `SELECT g.*, COUNT(CASE WHEN m.status != 'rejected' THEN 1 END) as member_count
             FROM GroupGatherings g
             LEFT JOIN GroupGatheringMembers m ON g.id = m.gathering_id
             WHERE g.id = ?
             GROUP BY g.id`
        ).bind(id).first(),
        env.DB.prepare(
            `SELECT id, user_id, display_name, line_name, joined_at, status
             FROM GroupGatheringMembers
             WHERE gathering_id = ?
             ORDER BY joined_at ASC`
        ).bind(id).all(),
        env.DB.prepare(
            `SELECT id, edited_at, changes FROM GroupGatheringEditHistory
             WHERE gathering_id = ? ORDER BY id DESC`
        ).bind(id).all(),
        liffToken
            ? fetch('https://api.line.me/v2/profile', { headers: { Authorization: `Bearer ${liffToken}` } }).catch(() => null)
            : Promise.resolve(null),
    ]);

    if (!g) {
        return Response.json({ error: '找不到此揪團' }, { status: 404 });
    }

    // 判斷目前登入者身分（非必要，前端也可處理）
    let myStatus = null;
    if (profileRes && profileRes.ok) {
        const profile = await profileRes.json();
        const me = members.results.find(m => m.user_id === profile.userId);
        myStatus = me ? me.status : null;
        if (g.organizer_user_id === profile.userId) myStatus = 'organizer';
    }

    // 這支端點不需登入即可查看（分享連結用），真實 LINE user_id 只給團主本人（管理成員時需要）
    const isOrganizer = myStatus === 'organizer';
    const { organizer_user_id, ...publicG } = g;
    const publicMembers = members.results.map(m =>
        isOrganizer ? m : { ...m, user_id: undefined }
    );

    return Response.json({
        ...publicG,
        games: JSON.parse(g.games || '[]'),
        members: publicMembers,
        my_status: myStatus,
        is_store_organizer: organizer_user_id === STORE_ORGANIZER_USER_ID,
        edit_history: editHistory.results.map(h => ({
            edited_at: h.edited_at,
            changes: JSON.parse(h.changes),
        })),
    });
}
