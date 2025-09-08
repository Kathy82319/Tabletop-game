export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // API 路由: 根據路徑提供不同資料
        if (url.pathname.startsWith('/api/')) {
            
            // 範例：取得使用者資料 (未來會從資料庫來)
            if (url.pathname === '/api/user') {
                const mockUserData = {
                    name: "測試冒險者",
                    class: "聖騎士",
                    level: 15,
                    exp: 1520,
                    expToNextLevel: 2000
                };
                return new Response(JSON.stringify(mockUserData), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // 範例：取得桌遊列表 (未來會從資料庫來)
            if (url.pathname === '/api/games') {
                const mockGames = [
                    { id: 1, name: "卡坦島" },
                    { id: 2, name: "璀璨寶石" }
                ];
                return new Response(JSON.stringify(mockGames), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            return new Response('API endpoint not found', { status: 404 });
        }
        
        // 如果不是 API 請求，Cloudflare Pages 會自動提供 public 資料夾中的靜態檔案
        // 所以這裡不需要特別處理 HTML/CSS/JS 的返回
        // 這個 fetch handler 主要是為了未來的 API 功能
        return new Response('Not a valid API endpoint.', { status: 404 });
    },
};