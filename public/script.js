document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "2008076323-GN1e7naW"; // 請確保這裡是你自己的 LIFF ID
    
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

    // --- 偵錯專用版本 ---
async function fetchGameData(userId) {
    try {
        console.log("正在向 /api/user 發出 POST 請求...");
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId }),
        });

        // 取得後端回傳的原始文字內容
        const responseText = await response.text();
        console.log("收到後端回應:", responseText);

        // 用 alert 顯示收到的所有情報，這樣我們在手機上也能清楚看到
        alert("來自後端的偵錯情報：\n" + responseText);

    } catch (error) {
        console.error('呼叫後端 API 失敗:', error);
        alert('呼叫後端 API 失敗: ' + error.toString());
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