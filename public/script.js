document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "2008076323-GN1e7naW"; // 你的 LIFF ID

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                // 初始化成功後，執行這兩個函式
                fetchUserProfile();
                fetchGames(); // <--- 新增的呼叫
            }
        })
        .catch((err) => { console.error("LIFF 初始化失敗", err); });
        
    function fetchUserProfile() {
        liff.getProfile().then(profile => {
            // 更新 LINE 個人資料
            document.getElementById('display-name').textContent = profile.displayName;
            document.getElementById('status-message').textContent = profile.statusMessage || '';
            const profilePicture = document.getElementById('profile-picture');
            if (profile.pictureUrl) {
                profilePicture.src = profile.pictureUrl;
            }

            // 【新增】產生 QR Code
            // 我們將使用者的 userId 作為 QR Code 的內容
            // 當店家掃描這個 QR Code 時，就能得到這個 userId，進而操作後端
            const qrcodeElement = document.getElementById('qrcode');
            qrcodeElement.innerHTML = ''; // 先清空舊的 QR Code
            new QRCode(qrcodeElement, {
                text: profile.userId,
                width: 200,
                height: 200,
            });
            console.log("QR Code 已產生，內容為:", profile.userId);


            // 呼叫後端取得遊戲資料
            fetchGameData(profile.userId);

        }).catch((err) => {
            console.error("取得 Profile 失敗", err);
        });
    }

// --- 新增的函式：取得並顯示桌遊列表 ---
    async function fetchGames() {
        try {
            const response = await fetch('/api/games'); // 發出 GET 請求
            if (!response.ok) {
                throw new Error('無法取得桌遊資料');
            }
            const games = await response.json();
            const container = document.getElementById('game-list-container');

            // 清空載入中的訊息
            container.innerHTML = ''; 

            // 遍歷每一款遊戲，並建立顯示卡片
            games.forEach(game => {
                const card = document.createElement('div');
                card.className = 'game-card'; // 方便未來用 CSS 美化
                card.innerHTML = `
                    <h3>${game.name}</h3>
                    <p>人數：${game.min_players} - ${game.max_players} 人</p>
                    <p>標籤：${game.tags}</p>
                `;
                container.appendChild(card);
            });

        } catch (error) {
            console.error('呼叫桌遊 API 失敗:', error);
            document.getElementById('game-list-container').innerHTML = '<p>讀取桌遊資料失敗。</p>';
        }
    }

    const tabBar = document.getElementById('tab-bar');
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            showPage(targetPageId);
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        }
    });

    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    }
    
    showPage('page-home');
});