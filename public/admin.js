// public/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // 請確認這裡是你「店家後台跳轉頁」的 LIFF ID
    const myLiffId = "2008076323-nOREG9x4"; 

    // 真正的登入頁面網址
    const loginPageUrl = "https://tabletop-game.pages.dev/admin-login.html";

    // 獲取頁面元素
    const messageElement = document.getElementById('message');
    const openButton = document.getElementById('open-browser-btn');

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 跳轉頁初始化成功");
            
            // 初始化成功後，更新提示文字並顯示按鈕
            messageElement.textContent = '請點擊下方按鈕以繼續登入流程。';
            openButton.style.display = 'block';

            // 為按鈕加上點擊事件監聽器
            openButton.addEventListener('click', () => {
                if (liff.isInClient()) {
                    // 如果在 LINE App 內，使用 liff.openWindow 強制用外部瀏覽器開啟
                    liff.openWindow({
                        url: loginPageUrl,
                        external: true // 這個參數是關鍵！
                    });
                } else {
                    // 如果不在 LINE 內（例如在普通瀏覽器打開了這個跳轉頁），直接導向
                    window.location.href = loginPageUrl;
                }
            });
        })
        .catch((err) => {
            console.error("LIFF 跳轉頁初始化失敗", err);
            // 即使初始化失敗，也顯示按鈕並嘗試用傳統方式導向
            messageElement.textContent = 'LIFF 初始化失敗，請點擊下方按鈕手動嘗試。';
            openButton.style.display = 'block';
            openButton.addEventListener('click', () => {
                window.open(loginPageUrl, '_blank');
            });
        });
});