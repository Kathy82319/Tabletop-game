// public/script.js (極簡測試版)

document.addEventListener('DOMContentLoaded', () => {
    
    console.log("極簡測試腳本已載入。");

    const tabBar = document.getElementById('tab-bar');

    function showPage(pageId) {
        // 找到所有 .page 元素並移除 active class
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 找到目標頁面並加上 active class
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            console.log(`已切換到頁面: ${pageId}`);
        } else {
            console.error(`找不到頁面: ${pageId}`);
        }
    }

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            
            // 移除所有按鈕的 active 狀態
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            // 為被點擊的按鈕加上 active 狀態
            button.classList.add('active');

            // 顯示對應的頁面
            showPage(targetPageId);
        }
    });

    // 預設顯示首頁
    showPage('page-home');
});