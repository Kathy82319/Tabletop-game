document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "YOUR_LIFF_ID"; // 請確保這裡是你自己的 LIFF ID
    
    liff.init({
        liffId: myLiffId
    }).then(() => {
        console.log("LIFF 初始化成功");
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            fetchUserProfile();
        }
    }).catch((err) => {
        console.error("LIFF 初始化失敗", err);
    });

    function fetchUserProfile() {
        liff.getProfile().then(profile => {
            // 更新畫面上的 LINE Profile
            document.getElementById('display-name').textContent = profile.displayName;
            document.getElementById('status-message').textContent = profile.statusMessage || '';
            const profilePicture = document.getElementById('profile-picture');
            if (profile.pictureUrl) {
                profilePicture.src = profile.pictureUrl;
            }

            // 接著呼叫我們的後端 API
            fetchGameData(profile.userId);

        }).catch((err) => {
            console.error("取得 Profile 失敗", err);
        });
    }

    async function fetchGameData(userId) {
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: userId }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const gameData = await response.json();
            console.log("成功取得後端遊戲資料:", gameData);

            // 將後端回傳的遊戲資料更新到畫面上
            document.getElementById('user-level').textContent = gameData.level;
            document.getElementById('user-exp').textContent = `${gameData.exp} / ${gameData.expToNextLevel}`;

        } catch (error) {
            console.error('呼叫後端 API 失敗:', error);
            document.getElementById('user-level').textContent = '讀取失敗';
            document.getElementById('user-exp').textContent = '讀取失敗';
        }
    }

    const tabBar = document.getElementById('tab-bar');
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            showPage(targetPageId);
            // --- 這裡已經修正 ---
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