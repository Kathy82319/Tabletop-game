// public/admin-login.js

document.addEventListener('DOMContentLoaded', () => {
    const qrReaderElement = document.getElementById('qr-reader');
    const syncBookingsBtn = document.getElementById('sync-bookings-btn');
    const importUsersBtn = document.getElementById('import-users-btn');
    const syncBtn = document.getElementById('sync-btn');
    const syncStatus = document.getElementById('sync-status');
    const scanResultSection = document.getElementById('scan-result');
    const userIdDisplay = document.getElementById('user-id-display');
    const reasonSelect = document.getElementById('reason-select');
    const customReasonInput = document.getElementById('custom-reason-input');
    const expInput = document.getElementById('exp-input');
    const submitBtn = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');
    const rescanBtn = document.getElementById('rescan-btn');

    let scannedUserId = null;
    const html5QrCode = new Html5Qrcode("qr-reader");

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        console.log(`掃描成功: ${decodedText}`);
        html5QrCode.stop().then(() => {
            qrReaderElement.style.display = 'none';
            scanResultSection.style.display = 'block';
            scannedUserId = decodedText;
            userIdDisplay.value = decodedText;
            statusMessage.textContent = '掃描成功！請選擇原因並輸入點數。';
            statusMessage.className = 'success';
        }).catch(err => console.error("停止掃描失敗", err));
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

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

    reasonSelect.addEventListener('change', () => {
        customReasonInput.style.display = (reasonSelect.value === 'other') ? 'block' : 'none';
    });

    submitBtn.addEventListener('click', async () => {
        const expValue = Number(expInput.value);
        let reason = reasonSelect.value;
        if (reason === 'other') {
            reason = customReasonInput.value.trim();
        }

        if (!scannedUserId || !expValue || expValue <= 0 || !reason) {
            statusMessage.textContent = '錯誤：所有欄位皆為必填。';
            statusMessage.className = 'error';
            return;
        }

        try {
            statusMessage.textContent = '正在處理中...';
            statusMessage.className = '';
            submitBtn.disabled = true;

            const response = await fetch('/api/add-exp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: scannedUserId,
                    expValue: expValue,
                    reason: reason,
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '未知錯誤');
            
            statusMessage.textContent = `成功！`;
            statusMessage.className = 'success';
            expInput.value = '';
            customReasonInput.value = '';
            reasonSelect.value = '消費回饋';
            customReasonInput.style.display = 'none';

        } catch (error) {
            console.error('新增經驗值失敗:', error);
            statusMessage.textContent = `新增失敗: ${error.message}`;
            statusMessage.className = 'error';
        } finally {
            submitBtn.disabled = false;
        }
    });

    rescanBtn.addEventListener('click', () => {
        scannedUserId = null;
        userIdDisplay.value = '';
        expInput.value = '';
        customReasonInput.value = '';
        reasonSelect.value = '消費回饋';
        customReasonInput.style.display = 'none';
        startScanner();
    });
    
    // ** 關鍵修正：優化後的通用同步處理函式 **
    async function handleSync(button, statusElement, apiUrl, confirmMessage, actionName) {
        if (!confirm(confirmMessage)) {
            return;
        }
    
        // 1. 立即更新 UI 狀態並禁用按鈕
        statusElement.textContent = `正在${actionName}中，請稍候...`;
        statusElement.className = '';
        button.disabled = true;
    
        try {
            const response = await fetch(apiUrl, { method: 'POST' });
            
            // 2. 解析後端回傳的 JSON
            const result = await response.json();
    
            // 3. 根據後端回傳的 HTTP 狀態碼來判斷成功或失敗
            if (!response.ok) {
                // 如果是失敗狀態 (4xx, 5xx), 拋出後端提供的詳細錯誤
                throw new Error(result.details || result.error || `未知的${actionName}錯誤`);
            }
    
            // 4. 如果是成功狀態 (2xx), 顯示成功訊息
            statusElement.textContent = result.message || `${actionName}成功！`;
            statusElement.className = 'success';
    
        } catch (error) {
            // 5. 捕捉所有錯誤 (包括網路錯誤和後端拋出的錯誤)
            statusElement.textContent = `${actionName}失敗：${error.message}`;
            statusElement.className = 'error';
        } finally {
            // 6. 無論成功或失敗，最後都重新啟用按鈕
            button.disabled = false;
        }
    }
    
    syncBtn.addEventListener('click', () => handleSync(
        syncBtn, syncStatus, '/api/sync-history', 
        '確定要將所有經驗值紀錄同步到 Google Sheet 嗎？這將會覆蓋現有內容。', '同步經驗值紀錄'
    ));
    
    syncBookingsBtn.addEventListener('click', () => handleSync(
        syncBookingsBtn, syncStatus, '/api/sync-bookings',
        '確定要將所有預約紀錄同步到 Google Sheet 嗎？這將會覆蓋現有內容。', '同步預約紀錄'
    ));
    
    importUsersBtn.addEventListener('click', () => handleSync(
        importUsersBtn, syncStatus, '/api/import-users',
        '確定要從 Google Sheet 匯入所有使用者資料嗎？這將會覆蓋資料庫中現有的使用者資訊。', '匯入使用者資料'
    ));

    startScanner();
});