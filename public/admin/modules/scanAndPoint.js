// public/admin/modules/scanAndPoint.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let html5QrCode = null;

/**
 * 停止掃描器
 */
function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("停止掃描失敗", err));
    }
}

/**
 * 開始掃描
 */
function startScanner() {
    const qrReader = document.getElementById('qr-reader');
    const scanResultContainer = document.getElementById('scan-result');
    const userIdDisplay = document.getElementById('user-id-display');

    if (!qrReader) return;
    
    qrReader.style.display = 'block';
    scanResultContainer.style.display = 'none';

    html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        stopScanner();
        userIdDisplay.value = decodedText;
        qrReader.style.display = 'none';
        scanResultContainer.style.display = 'block';
    };

    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            console.error("無法啟動掃描器", err);
            qrReader.innerHTML = `<p style="color:red;">無法啟動相機，請確認授權並刷新頁面。</p>`;
        });
}

/**
 * 處理新增經驗值的表單提交
 */
async function handleSubmitExp() {
    const userId = document.getElementById('user-id-display').value;
    const reasonSelect = document.getElementById('reason-select');
    const customReasonInput = document.getElementById('custom-reason-input');
    const expInput = document.getElementById('exp-input');
    const statusContainer = document.getElementById('scan-status-container');

    if (!userId) {
        return ui.toast.error('請先掃描顧客的 QR Code！');
    }

    let reason = reasonSelect.value;
    if (reason === 'other') {
        reason = customReasonInput.value.trim();
    }
    const expValue = parseInt(expInput.value, 10);

    if (!reason) {
        return ui.toast.error('請選擇或輸入原因！');
    }
    if (isNaN(expValue) || expValue <= 0) {
        return ui.toast.error('請輸入有效的經驗值點數！');
    }
    
    const button = document.getElementById('submit-exp-btn');
    button.disabled = true;
    button.textContent = '新增中...';
    statusContainer.textContent = '';

    try {
        const result = await api.addPoints({ userId, expValue, reason });
        ui.toast.success(result.message || '成功新增經驗值！');
        // 重置表單
        expInput.value = '';
        customReasonInput.value = '';
        reasonSelect.value = '消費回饋';
        customReasonInput.style.display = 'none';
        startScanner(); // 自動開始下一次掃描
    } catch (error) {
        ui.toast.error(`新增失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '確認新增';
    }
}

/**
 * 綁定事件監聽器
 */
function setupEventListeners() {
    const page = document.getElementById('page-scan');
    if (page.dataset.initialized) return;

    const reasonSelect = document.getElementById('reason-select');
    const customReasonInput = document.getElementById('custom-reason-input');

    reasonSelect.addEventListener('change', () => {
        customReasonInput.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
    });

    document.getElementById('submit-exp-btn').addEventListener('click', handleSubmitExp);
    document.getElementById('rescan-btn').addEventListener('click', startScanner);
    
    page.dataset.initialized = 'true';
}

/**
 * 模組初始化函式
 */
export const init = async () => {
    const page = document.getElementById('page-scan');
    if (!page) return;

    setupEventListeners();
    startScanner();

    // 處理頁面切換時的掃描器生命週期
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!page.classList.contains('active')) {
                    stopScanner();
                }
            }
        }
    });

    observer.observe(page, { attributes: true });
};