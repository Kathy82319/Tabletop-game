// functions/api/sync-user-from-sheet.js
import { getSheet } from '../_google-sheets-utils.js';

export async function onRequest(context) {
    try {
        if (context.request.method !== 'POST') {
            return new Response('Invalid request method.', { status: 405 });
        }

        const { userId } = await context.request.json();
        if (!userId) {
            return new Response(JSON.stringify({ error: '缺少使用者 ID。' }), { status: 400 });
        }

        const db = context.env.DB;
        
        // 1. 連接到 '使用者列表' 工作表
        const sheet = await getSheet(context.env, '使用者列表');
        const rows = await sheet.getRows();
        
        // 2. 在 Google Sheet 中找到對應的列
        const userRowFromSheet = rows.find(row => row.get('user_id') === userId);

        if (!userRowFromSheet) {
            return new Response(JSON.stringify({ error: `在 Google Sheet 中找不到使用者 ID: ${userId}` }), { status: 404 });
        }
        
        // 3. 準備要更新到 D1 的資料
        const userData = {
            line_display_name: userRowFromSheet.get('line_display_name'),
            nickname: userRowFromSheet.get('nickname'),
            phone: userRowFromSheet.get('phone'),
            class: userRowFromSheet.get('class'),
            level: Number(userRowFromSheet.get('level')) || 1,
            current_exp: Number(userRowFromSheet.get('current_exp')) || 0,
            tag: userRowFromSheet.get('tag')
        };

        // 4. 更新 D1 資料庫
        const stmt = db.prepare(
            `UPDATE Users SET 
                line_display_name = ?, nickname = ?, phone = ?, class = ?, 
                level = ?, current_exp = ?, tag = ? 
             WHERE user_id = ?`
        );
        await stmt.bind(
            userData.line_display_name, userData.nickname, userData.phone, userData.class,
            userData.level, userData.current_exp, userData.tag, userId
        ).run();

        return new Response(JSON.stringify({ success: true, message: '成功從 Google Sheet 同步單筆使用者資料！' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in sync-user-from-sheet API:', error);
        return new Response(JSON.stringify({ error: '同步失敗。', details: error.message }), {
            status: 500
        });
    }
}