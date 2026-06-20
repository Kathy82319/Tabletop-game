// functions/api/admin/upload-image.js
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return Response.json({ error: '未收到檔案' }, { status: 400 });
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return Response.json({ error: '僅支援 JPG、PNG、WebP、GIF 格式' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return Response.json({ error: '檔案大小不能超過 5MB' }, { status: 400 });
        }

        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        const ext = extMap[file.type] || 'jpg';
        const key = `games/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const buffer = await file.arrayBuffer();
        await env.ASSETS.put(key, buffer, {
            httpMetadata: { contentType: file.type }
        });

        const url = `https://pub-f37fbf2e23fb45e9a3705973776f12e4.r2.dev/${key}`;
        return Response.json({ url });

    } catch (err) {
        return Response.json({ error: '上傳失敗：' + err.message }, { status: 500 });
    }
}
