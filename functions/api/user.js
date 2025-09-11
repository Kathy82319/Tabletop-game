// functions/api/user.js

export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Invalid request method.', { status: 405 });
    }

    // 從前端接收使用者完整的 LINE Profile 資料
    const { userId, displayName, pictureUrl } = await context.request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = context.env.DB;
    
    // 1. 嘗試從資料庫中尋找使用者
    let stmt = db.prepare('SELECT * FROM Users WHERE user_id = ?');
    let user = await stmt.bind(userId).first();

    // 2. 檢查使用者是否存在
    if (user) {
      // 如果使用者已存在，直接回傳他的資料
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // 3. 如果使用者不存在，這就是一位新會員！
      // 準備新會員的預設資料
      const newUser = {
        user_id: userId,
        line_display_name: displayName || '未提供名稱', // 如果沒有名稱，給個預設值
        line_picture_url: pictureUrl || '',
        class: '無', // 預設職業
        level: 1,      // 預設等級
        current_exp: 0 // 預設經驗值
      };

      // 4. 將新會員資料插入到 Users 資料表中
      stmt = db.prepare(
        'INSERT INTO Users (user_id, line_display_name, line_picture_url, class, level, current_exp) VALUES (?, ?, ?, ?, ?, ?)'
      );
      await stmt.bind(
        newUser.user_id,
        newUser.line_display_name,
        newUser.line_picture_url,
        newUser.class,
        newUser.level,
        newUser.current_exp
      ).run();

      // 5. 回傳剛剛建立的新會員資料給前端
      // 這裡我們直接回傳 newUser 物件，因為它就是我們剛存進去的樣子
      // 我們還需要計算升級所需經驗值，這裡先用一個簡單的公式
      const expToNextLevel = 100 * Math.pow(newUser.level, 1.5);
      
      return new Response(JSON.stringify({
        ...newUser,
        expToNextLevel: Math.floor(expToNextLevel) // 回傳給前端顯示
      }), {
        status: 201, // 201 Created，表示成功建立了一筆新資源
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in user API:', error);
    const errorResponse = { error: '伺服器內部錯誤，處理使用者資料失敗。', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}