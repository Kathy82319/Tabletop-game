// functions/_middleware.js

// 這是一個輔助函式，用來解析 Cookie 字串
function parseCookie(cookieString) {
    const cookies = {};
    if (cookieString) {
        cookieString.split(';').forEach(cookie => {
            const parts = cookie.match(/(.*?)=(.*)$/)
            if(parts) {
               cookies[parts[1].trim()] = (parts[2] || '').trim();
            }
        });
    }
    return cookies;
}


export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/admin-panel.html')) {
    const cookie = request.headers.get('Cookie') || '';
    const cookies = parseCookie(cookie);
    const token = cookies.AuthToken;

    if (!token) {
      const loginUrl = new URL('/admin-login.html', url);
      return Response.redirect(loginUrl.toString(), 302);
    }
    
  }

  return await next();
}
