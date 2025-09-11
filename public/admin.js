// public/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================
    // !! 請務必將這裡的 LIFF ID 換成你剛剛建立的「店家後台跳轉頁」的 LIFF ID !!
    // ==========================================================
    const myLiffId = "2008076323-nOREG9x4"; 

    // 定義真正的登入頁面網址
    const loginPageUrl = "https://tabletop-game.pages.dev/admin-login.html";

    // 初始化 LIFF
    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 跳轉頁初始化成功");

            // 檢查 LIFF 是否在 LINE App 內開啟
            if (!liff.isInClient()) {
                // 如果不在 LINE 內，直接導向登入頁
                window.location.href = loginPageUrl;
            } else {
                // 如果在 LINE 內，使用 liff.openWindow 強制用外部瀏覽器開啟
                liff.openWindow({
                    url: loginPageUrl,
                    external: true // 這個參數是關鍵！
                });
            }
        })
        .catch((err) => {
            console.error("LIFF 跳轉頁初始化失敗", err);
            // 即使初始化失敗，也嘗試用傳統方式導向，確保流程能繼續
            window.location.href = loginPageUrl;
        });
});