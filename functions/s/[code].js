// 短網址轉址：/s/<code> 查表後 302 轉到真正的揪團分享連結
export async function onRequestGet(context) {
    const { env, params } = context;
    const code = params.code;

    const row = await env.DB.prepare(`SELECT target_url FROM ShortLinks WHERE code = ?`).bind(code).first();
    if (!row) {
        return new Response('找不到這個短網址，可能已經失效。', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    return Response.redirect(row.target_url, 302);
}
