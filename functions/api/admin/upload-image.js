// functions/api/admin/upload-image.js
export async function onRequestPost(context) {
    const { request, env } = context;

    const ok  = (data)  => new Response(JSON.stringify(data),  { status: 200, headers: { 'Content-Type': 'application/json' } });
    const err = (msg, status) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || typeof file.arrayBuffer !== 'function') {
            return err('未收到檔案', 400);
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return err('僅支援 JPG、PNG、WebP、GIF 格式', 400);
        }

        if (file.size > 5 * 1024 * 1024) {
            return err('檔案大小不能超過 5MB', 400);
        }

        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        const ext = extMap[file.type] || 'jpg';
        const key = 'games/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

        const buffer = await file.arrayBuffer();
        await env.ASSETS.put(key, buffer, {
            httpMetadata: { contentType: file.type }
        });

        return ok({ url: 'https://pub-f37fbf2e23fb45e9a3705973776f12e4.r2.dev/' + key });

    } catch (e) {
        return err('上傳失敗：' + e.message, 500);
    }
}
