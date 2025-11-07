// functions/api/admin/migrate-random-to-numeric.js
// !!注意!! 這是高風險操作，執行完一次後請立即刪除此檔案

// ----------------------------------------------------
// 【CORS 修正】輔助函式：回傳 CORS 標頭
// ----------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 允許所有來源 (在 admin-panel.html 中執行 fetch)
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // 允許 POST 和 OPTIONS
  'Access-Control-Allow-Headers': 'Content-Type', // 允許 'Content-Type' 標頭
};

// ----------------------------------------------------
// 移轉邏輯函式 (原本的 onRequest)
// ----------------------------------------------------
async function handleMigrationRequest(context) {
  // 增加一個簡單的密碼保護，防止被意外觸發
  const { password } = await context.request.json();
  // *** 警告：請將 'YOUR_SECRET_PASSWORD' 改成一個你自己的臨時密碼 ***
  if (password !== '55688') { 
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const db = context.env.DB;
    
    // 步驟 1：找出目前最大的「純數字」ID
    const result = await db.prepare(
      "SELECT MAX(CAST(game_id AS INTEGER)) as max_id FROM BoardGames WHERE game_id GLOB '[0-9]*' AND game_id NOT LIKE '%[^0-9]%'"
    ).first();
    
    let nextNumericId = (result?.max_id || 0) + 1;

    // 步驟 2：找出所有「非數字」(亂碼) 的 ID
    const { results: gamesToMigrate } = await db.prepare(
      "SELECT game_id FROM BoardGames WHERE game_id NOT GLOB '[0-9]*' OR game_id LIKE '%[^0-9]%'"
    ).all();

    if (!gamesToMigrate || gamesToMigrate.length === 0) {
      return new Response(JSON.stringify({ success: true, message: '資料庫中沒有需要轉移的亂碼 ID。' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const idMap = new Map();
    const operations = [];
    let report = '轉移報告 (舊 ID -> 新 ID)：\n';

    // 步驟 3：為每一個亂碼 ID 準備更新操作
    for (const game of gamesToMigrate) {
      const oldRandomId = game.game_id;
      const newNumericIdStr = String(nextNumericId); // 確保儲存為字串

      idMap.set(oldRandomId, newNumericIdStr);
      report += `${oldRandomId} -> ${newNumericIdStr}\n`;

      operations.push(
        db.prepare("UPDATE BoardGames SET game_id = ?2 WHERE game_id = ?1")
          .bind(oldRandomId, newNumericIdStr)
      );
      
      operations.push(
        db.prepare("UPDATE Rentals SET game_id = ?2 WHERE game_id = ?1")
          .bind(oldRandomId, newNumericIdStr)
      );
      
      nextNumericId++; // 準備下一個數字
    }

    // 步驟 4：在一個事務中執行所有更新
    await db.batch(operations);

    return new Response(JSON.stringify({ success: true, message: `成功轉移 ${idMap.size} 筆亂碼 ID。`, report }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('ID 轉移失敗:', error);
    return new Response(JSON.stringify({ error: '轉移過程中發生嚴重錯誤', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// ----------------------------------------------------
// 主 onRequest 處理函式 (處理 CORS)
// ----------------------------------------------------
export async function onRequest(context) {
  // 【CORS 修正】處理 preflight OPTIONS 請求
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204, // No Content
      headers: corsHeaders,
    });
  }

  // 處理 POST 請求 (原本的邏輯)
  if (context.request.method === 'POST') {
    return await handleMigrationRequest(context);
  }

  // 拒絕 POST 和 OPTIONS 以外的所有請求
  return new Response('Method Not Allowed', { status: 405 });
}