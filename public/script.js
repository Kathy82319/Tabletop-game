document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "2008076323-GN1e7naW"; // 你的 LIFF ID
    
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

    // 正式版本：呼叫後端 API 並更新畫面
    async function fetchGameData(userId) {
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId }),
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const gameData = await response.json();
            console.log("成功取得後端遊戲資料:", gameData);

            // 更新畫面上的遊戲資料
            document.getElementById('user-class').textContent = gameData.class; // 【新增】更新職業
            document.getElementById('user-level').textContent = gameData.level;
            document.getElementById('user-exp').textContent = `${gameData.exp} / ${gameData.expToNextLevel}`;

        } catch (error) {
            console.error('呼叫後端 API 失敗:', error);
            document.getElementById('user-class').textContent = '讀取失敗'; // 【新增】更新職業
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