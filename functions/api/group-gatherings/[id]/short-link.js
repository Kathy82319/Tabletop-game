// 取得（或第一次點分享時建立）某個揪團的短網址，避免分享連結又長又醜。
// 同一個揪團重複呼叫會拿回同一組短碼，不會每點一次分享就多一筆。
export async function onRequestGet(context) {
    const { env, params } = context;
    const id = params.id;

    const g = await env.DB.prepare(`SELECT share_token FROM GroupGatherings WHERE id = ?`).bind(id).first();
    if (!g) return Response.json({ error: '找不到此揪團' }, { status: 404 });

    const targetUrl = `https://tabletop-game.pages.dev/#gather-share@${g.share_token}`;

    const existing = await env.DB.prepare(`SELECT code FROM ShortLinks WHERE target_url = ?`).bind(targetUrl).first();
    if (existing) {
        return Response.json({ url: `https://tabletop-game.pages.dev/s/${existing.code}` });
    }

    // 6 碼英數短碼，去掉容易看錯的 0/O/1/l/I；衝突機率極低，但還是重試幾次保險
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomCode = () => {
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    };

    let code = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = randomCode();
        const clash = await env.DB.prepare(`SELECT 1 FROM ShortLinks WHERE code = ?`).bind(candidate).first();
        if (!clash) { code = candidate; break; }
    }
    if (!code) return Response.json({ error: '短網址產生失敗，請稍後再試' }, { status: 500 });

    await env.DB.prepare(`INSERT INTO ShortLinks (code, target_url) VALUES (?, ?)`).bind(code, targetUrl).run();

    return Response.json({ url: `https://tabletop-game.pages.dev/s/${code}` });
}
