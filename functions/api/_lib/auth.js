// 驗證前端傳來的 LIFF access token，回傳 LINE 官方認證過的使用者資料。
// 絕對不要相信 request body/query 裡由前端自行宣稱的 userId。
export async function verifyLiffUser(request) {
    const token = request.headers.get('X-LIFF-Token');
    if (!token) return null;

    const profileRes = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileRes.ok) return null;

    return await profileRes.json(); // { userId, displayName, pictureUrl }
}
