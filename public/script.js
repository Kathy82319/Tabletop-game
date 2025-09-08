document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "2008076323-GN1e7naW"; // 請確保這裡是你自己的 LIFF ID
    
    liff.init({
        liffId: myLiffId
    }).then(() => {
        console.log("LIFF 初始化成功");
        
        // 檢查使用者是否登入
        if (!liff.isLoggedIn()) {
            // 如果沒登入，就引導使用者登入
            liff.login();
        } else {
            // 如果已登入，就去取得使用者資料
            fetchUserProfile();
        }

    }).catch((err) => {
        console.error("LIFF 初始化失敗", err);
    });

    // --- 新增的函式：取得並顯示使用者資料 ---
    function fetchUserProfile() {
        liff.getProfile().then(profile => {
            console.log("成功取得 Profile:", profile);
            alert("我的 User ID 是：" + profile.userId); 
            
            // 將資料顯示在畫面上
            document.getElementById('display-name').textContent = profile.displayName;
            document.getElementById('status-message').textContent = profile.statusMessage || ''; // 狀態消息可能不存在
            
            const profilePicture = document.getElementById('profile-picture');
            if (profile.pictureUrl) {
                profilePicture.src = profile.pictureUrl;
            } else {
                // 如果使用者沒有頭像，可以給一個預設圖片
                profilePicture.src = 'default-avatar.png'; 
            }

        }).catch((err) => {
            console.error("取得 Profile 失敗", err);
        });
    }

    // --- Tab Bar 頁面切換邏輯 (維持不變) ---
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
    
    // 預設顯示第一個頁面
    showPage('page-home');
});