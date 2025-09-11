// public/admin-login.js

document.addEventListener('DOMContentLoaded', () => {
    const qrReaderElement = document.getElementById('qr-reader');
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

    // 監聽下拉選單的變化
    reasonSelect.addEventListener('change', () => {
        if (reasonSelect.value === 'other') {
            customReasonInput.style.display = 'block';
        } else {
            customReasonInput.style.display = 'none';
        }
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
    
    syncBtn.addEventListener('click', async () => {
    if (!confirm('確定要將所有經驗值紀錄同步到 Google Sheet 嗎？這將會覆蓋現有內容。')) {
        return;
    }

    try {
        syncStatus.textContent = '正在同步中，請稍候...';
        syncStatus.className = '';
        syncBtn.disabled = true;

        const response = await fetch('/api/sync-history', { method: 'POST' });
        const result = await response.json();

        if (!response.ok) throw new Error(result.details || '同步失敗');

        syncStatus.textContent = result.message || '同步成功！';
        syncStatus.className = 'success';

    } catch (error) {
        syncStatus.textContent = `同步失敗：${error.message}`;
        syncStatus.className = 'error';
    } finally {
        syncBtn.disabled = false;
    }
});

startScanner();
});