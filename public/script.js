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
        const response = await fetch('/api/games'); // 確認你的 API 路徑是否正確
        if (!response.ok) {
            throw new Error('無法取得桌遊資料');
        }
        const games = await response.json();
        
        console.log('從 API 收到的資料:', games); // 這行可以保留，方便未來除錯

        const container = document.getElementById('game-list-container');
        // 清空原本 "正在載入..." 的訊息
        container.innerHTML = ''; 

        // 遍歷每一筆遊戲資料
        games.forEach(game => {
            // 如果 is_visible 不是 TRUE，就跳過這筆資料不顯示
            if (game.is_visible !== 'TRUE') {
                return;
            }

            // 建立卡片的整體容器
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';

            // 建立圖片
            const img = document.createElement('img');
            img.src = game.image_url; // 使用 "image_url" 欄位
            img.alt = game.name;      // 使用 "name" 欄位
            img.className = 'game-image';

            // 建立卡片內容的容器
            const infoContainer = document.createElement('div');
            infoContainer.className = 'game-info';

            // 建立標題
            const title = document.createElement('h3');
            title.className = 'game-title';
            title.textContent = game.name; // 使用 "name" 欄位

            // 建立描述
            const description = document.createElement('p');
            description.className = 'game-description';
            description.textContent = game.description; // 使用 "description" 欄位

            // 建立遊戲細節的容器 (人數、難度等)
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'game-details';
            detailsContainer.innerHTML = `
                <span>👥 ${game.min_players}-${game.max_players} 人</span>
                <span>⭐ 難度: ${game.difficulty}</span>
            `;

            // 按照順序將所有元素組合起來
            infoContainer.appendChild(title);
            infoContainer.appendChild(description);
            infoContainer.appendChild(detailsContainer);

            gameCard.appendChild(img);
            gameCard.appendChild(infoContainer);

            // 將完成的卡片加到頁面上
            container.appendChild(gameCard);
        });

    } catch (error) {
        console.error('呼叫桌遊 API 失敗:', error);
        const container = document.getElementById('game-list-container');
        container.innerHTML = '<p style="color: red;">讀取桌遊資料失敗。</p>';
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