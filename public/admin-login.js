// public/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // 獲取頁面上的所有重要元素
    const qrReaderElement = document.getElementById('qr-reader');
    const scanResultSection = document.getElementById('scan-result');
    const userIdDisplay = document.getElementById('user-id-display');
    const amountInput = document.getElementById('amount-input');
    const submitBtn = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');
    const rescanBtn = document.getElementById('rescan-btn');

    let scannedUserId = null; // 用來儲存掃描到的 userId

    // 初始化 QR Code 掃描器
    const html5QrCode = new Html5Qrcode("qr-reader");

    // 掃描成功後的回呼函式
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        // decodedText 就是 QR Code 中包含的 userId
        console.log(`掃描成功: ${decodedText}`);
        
        // 停止掃描
        html5QrCode.stop().then(() => {
            qrReaderElement.style.display = 'none'; // 隱藏掃描器畫面
            scanResultSection.style.display = 'block'; // 顯示結果與輸入區塊
            
            scannedUserId = decodedText;
            userIdDisplay.value = decodedText; // 將 userId 顯示在輸入框中
            statusMessage.textContent = '掃描成功！請輸入消費金額。';
            statusMessage.className = 'success';
        }).catch(err => {
            console.error("停止掃描失敗", err);
        });
    };

    // 掃描器設定
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // 啟動掃描器
    function startScanner() {
        qrReaderElement.style.display = 'block';
        scanResultSection.style.display = 'none';
        statusMessage.textContent = '請將顧客的 QR Code 對準掃描框';
        statusMessage.className = '';
        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch(err => {
                console.error("無法啟動掃描器", err);
                statusMessage.textContent = '無法啟動相機，請檢查權限。';
                statusMessage.className = 'error';
            });
    }

    // 頁面載入後立即啟動掃描
    startScanner();

    // 監聽 "確認新增經驗值" 按鈕的點擊事件
    submitBtn.addEventListener('click', async () => {
        const amount = Number(amountInput.value);

        // 基本的前端驗證
        if (!scannedUserId || !amount || amount <= 0) {
            statusMessage.textContent = '錯誤：請確認 User ID 已掃描且金額大於 0。';
            statusMessage.className = 'error';
            return;
        }

        try {
            statusMessage.textContent = '正在處理中...';
            statusMessage.className = '';
            submitBtn.disabled = true; // 防止重複點擊

            // 發送 POST 請求到後端 API
            const response = await fetch('/api/add-exp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: scannedUserId,
                    amount: amount,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                // 如果 API 回傳錯誤 (如 400, 404, 500)
                throw new Error(result.error || '未知錯誤');
            }
            
            // 處理成功
            statusMessage.textContent = `成功！已為顧客新增 ${Math.floor(amount)} 點經驗值。`;
            statusMessage.className = 'success';
            amountInput.value = ''; // 清空金額輸入框

        } catch (error) {
            console.error('新增經驗值失敗:', error);
            statusMessage.textContent = `新增失敗: ${error.message}`;
            statusMessage.className = 'error';
        } finally {
            submitBtn.disabled = false; // 恢復按鈕
        }
    });

    // 監聽 "重新掃描" 按鈕
    rescanBtn.addEventListener('click', () => {
        scannedUserId = null;
        userIdDisplay.value = '';
        amountInput.value = '';
        startScanner();
    });
});