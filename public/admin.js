// public/admin.js (偵錯版)

document.addEventListener('DOMContentLoaded', () => {
    const myLiffId = "2008076323-nOREG9x4";
    const loginPageUrl = "https://tabletop-game.pages.dev/admin-login.html";

    const messageElement = document.getElementById('message');
    const openButton = document.getElementById('open-browser-btn');

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 跳轉頁初始化成功");

            // --- 新增的偵錯日誌 ---
            console.log("liff.isInClient():", liff.isInClient());
            console.log("liff.getOS():", liff.getOS());
            console.log("liff.getLineVersion():", liff.getLineVersion());
            // --- 偵錯日誌結束 ---

            messageElement.textContent = '請點擊下方按鈕以繼續登入流程。';
            openButton.style.display = 'block';

            openButton.addEventListener('click', () => {
                console.log("按鈕已被點擊！");
                if (liff.isInClient()) {
                    console.log("正在嘗試呼叫 liff.openWindow...");
                    liff.openWindow({
                        url: loginPageUrl,
                        external: true
                    });
                    console.log("liff.openWindow 已呼叫。");
                } else {
                    console.log("不在 LINE App 內，將直接導向。");
                    window.location.href = loginPageUrl;
                }
            });
        })
        .catch((err) => {
            console.error("LIFF 跳轉頁初始化失敗", err);
            messageElement.textContent = 'LIFF 初始化失敗，請點擊下方按鈕手動嘗試。';
            openButton.style.display = 'block';
            openButton.addEventListener('click', () => {
                window.open(loginPageUrl, '_blank');
            });
        });
});