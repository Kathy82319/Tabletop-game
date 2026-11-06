// functions/api/get-users.js
import { GOLD_ASSET_ID, resolveGoldAmount } from '../_lib/gold.js';

export async function onRequest(context) {
  try {
    if (context.request.method !== 'GET') {
      return new Response('Invalid request method.', { status: 405 });
    }

    const db = context.env.DB;

    const stmt = db.prepare(
      `SELECT u.user_id, u.line_display_name, u.nickname, u.real_name, u.phone, u.level, u.current_exp, u.tag, u.class, u.perk, u.notes,
              (SELECT GROUP_CONCAT(ga.name, '、') FROM UserAssets ua JOIN GameAssets ga ON ga.id = ua.asset_id WHERE ua.user_id = u.user_id AND ga.type = 'skill') AS skill_names,
              (SELECT GROUP_CONCAT(ga.name, '、') FROM UserAssets ua JOIN GameAssets ga ON ga.id = ua.asset_id WHERE ua.user_id = u.user_id AND ga.type = 'equipment') AS equipment_names,
              (SELECT ua.gold_balance FROM UserAssets ua WHERE ua.user_id = u.user_id AND ua.asset_id = ${GOLD_ASSET_ID}) AS gold_balance_raw,
              (SELECT ua.custom_description FROM UserAssets ua WHERE ua.user_id = u.user_id AND ua.asset_id = ${GOLD_ASSET_ID}) AS gold_custom_desc
         FROM Users u ORDER BY u.created_at DESC`
    );
    const { results } = await stmt.all();

    const users = (results || []).map(({ gold_balance_raw, gold_custom_desc, ...user }) => {
      const hasGoldAsset = gold_balance_raw !== null || gold_custom_desc !== null;
      return {
        ...user,
        gold_balance: hasGoldAsset
          ? resolveGoldAmount({ gold_balance: gold_balance_raw, custom_description: gold_custom_desc, default_desc: null })
          : null,
      };
    });

    return new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-users API:', error);
    return new Response(JSON.stringify({ error: '獲取使用者列表失敗。' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
