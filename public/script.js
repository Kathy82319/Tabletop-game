document.addEventListener('DOMContentLoaded', () => {
    // --- LIFF 初始化 ---
    // 請記得去 LINE Developers Console 取得你的 LIFF ID 並替換下面的字串
    const myLiffId = "https://liff.line.me/2008076323-GN1e7naW"; 
    
    liff.init({
        liffId: myLiffId
    }).then(() => {
        console.log("LIFF 初始化成功");
        // 如果 App 不是在 LINE App 中打開，可以引導使用者
        if (!liff.isInClient()) {
            // document.body.innerHTML = "請在 LINE App 中打開此頁面";
        }
    }).catch((err) => {
        console.error("LIFF 初始化失敗", err);
    });

    // --- Tab Bar 頁面切換邏輯 ---
    const tabBar = document.getElementById('tab-bar');
    const appContent = document.getElementById('app-content');
    
    // 預設顯示第一個頁面
    showPage('page-home');

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            showPage(targetPageId);
            
            // 更新按鈕的 active 狀態
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        }
    });

    function showPage(pageId) {
        // 隱藏所有頁面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        // 顯示目標頁面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    }
});