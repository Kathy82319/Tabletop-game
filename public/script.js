document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "2008076323-GN1e7naW"; // 你的 LIFF ID

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                fetchUserProfile();
                fetchGames(); // 呼叫取得桌遊列表
            }
        })
        .catch((err) => { console.error("LIFF 初始化失敗", err); });
        
    function fetchUserProfile() {
        liff.getProfile().then(profile => {
            document.getElementById('display-name').textContent = profile.displayName;
            document.getElementById('status-message').textContent = profile.statusMessage || '';
            const profilePicture = document.getElementById('profile-picture');
            if (profile.pictureUrl) {
                profilePicture.src = profile.pictureUrl;
            }

            fetchGameData(profile.userId); // 呼叫 fetchGameData 來取得會員遊戲資料

            const qrcodeElement = document.getElementById('qrcode');
            qrcodeElement.innerHTML = '';
            new QRCode(qrcodeElement, {
                text: profile.userId,
                width: 200,
                height: 200,
            });
        }).catch((err) => {
            console.error("取得 Profile 失敗", err);
        });
    }

    async function fetchGameData(userId) {
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId }),
            });
            if (!response.ok) { throw new Error('無法取得會員遊戲資料'); }
            const gameData = await response.json();
            document.getElementById('user-class').textContent = gameData.class;
            document.getElementById('user-level').textContent = gameData.level;
            document.getElementById('user-exp').textContent = `${gameData.exp} / ${gameData.expToNextLevel}`;
        } catch (error) {
            console.error('呼叫會員 API 失敗:', error);
        }
    }

    async function fetchGames() {
        try {
            const response = await fetch('/api/games');
            if (!response.ok) { throw new Error('無法取得桌遊資料'); }
            const games = await response.json();
            const container = document.getElementById('game-list-container');
            container.innerHTML = ''; 

            if (games.length === 0) {
                container.innerHTML = '<p>目前店內沒有可顯示的桌遊。</p>';
                return;
            }

            games.forEach(game => {
                const card = document.createElement('div');
                card.className = 'game-card';
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