// functions/api/admin/get-avatar.js

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const db = env.DB;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      // 如果沒有 userId，回傳一個 400 錯誤
      return new Response('Missing userId parameter', { status: 400 });
    }

    // 從資料庫中只選取圖片 URL 欄位
    const user = await db.prepare("SELECT line_picture_url FROM Users WHERE user_id = ?").bind(userId).first();

    const imageUrl = user?.line_picture_url;

    // 檢查 URL 是否有效
    if (imageUrl && imageUrl.startsWith('http')) {
      // 使用 fetch 從後端去請求 LINE 的圖片
      const imageResponse = await fetch(imageUrl);

      // 如果成功獲取圖片，就將圖片回傳給前端
      if (imageResponse.ok) {
        return new Response(imageResponse.body, {
          headers: {
            'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400' // 快取一天
          },
        });
      }
    }

    // 如果以上步驟失敗 (找不到使用者、URL無效、或圖片下載失敗)，就回傳預設的 SVG 圖示
    const placeholderAvatar = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#E0E0E0"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    
    return new Response(placeholderAvatar, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400' // 快取一天
      },
    });

  } catch (error) {
    console.error('Error in get-avatar API:', error);
    return new Response('Error fetching avatar', { status: 500 });
  }
}