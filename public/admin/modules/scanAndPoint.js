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
 * 顯示手動輸入介面並更新按鈕狀態
 */
function showManualInputInterface() {
    const qrReader = document.getElementById('qr-reader');
    const scanResultContainer = document.getElementById('scan-result');
    const userIdDisplay = document.getElementById('user-id-display');
    const submitBtn = document.getElementById('submit-exp-btn');
    const rescanBtn = document.getElementById('rescan-btn');

    qrReader.style.display = 'none';
    scanResultContainer.style.display = 'block';
    
    // 清空 user ID，讓使用者重新選擇或輸入
    userIdDisplay.value = ''; 
    document.getElementById('scan-user-search').value = '';

    rescanBtn.textContent = '重新掃描 (或手動輸入)';
    submitBtn.disabled = true; // 預設禁用，直到選中用戶
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
    qrReader.innerHTML = ''; // 清空可能存在的錯誤訊息

    // 重新建立掃描器實例
    html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        stopScanner();
        userIdDisplay.value = decodedText;
        qrReader.style.display = 'none';
        scanResultContainer.style.display = 'block';
        document.getElementById('submit-exp-btn').disabled = false; // 掃碼成功啟用送出
    };

    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            console.error("無法啟動掃描器", err);
            
            // 【核心修正點 1】如果找不到裝置，強制切換到手動輸入介面
            if (err.includes('NotFoundError')) {
                qrReader.innerHTML = `<p style="color:red; text-align:center;">
                                        ⚠ 無法啟動相機（未找到設備）。請使用手動搜尋功能。
                                      </p>`;
                showManualInputInterface();
            } else {
                 qrReader.innerHTML = `<p style="color:red; text-align:center;">
                                        無法啟動相機，請確認授權並刷新頁面。<br>錯誤: ${err.message || '未知錯誤'}
                                      </p>`;
            }
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
        return ui.toast.error('請先掃描或選取顧客！');
    }
// ... (此處省略不變的邏輯)
// ... (scanAndPoint.js:45 - 86 行)
    let reason = reasonSelect.value;
    if (reason === 'other') {
        reason = customReasonInput.value.trim();
    }
    const expValue = parseInt(expInput.value, 2);

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
        expInput.value = '2'; // 修正：重置 exp 值為 2
        customReasonInput.value = '';
        reasonSelect.value = '消費回饋';
        customReasonInput.style.display = 'none';
        startScanner(); // 自動開始下一次掃描/初始化
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
    const userIdDisplay = document.getElementById('user-id-display'); // 新增

    reasonSelect.addEventListener('change', () => {
        customReasonInput.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
    });

    document.getElementById('submit-exp-btn').addEventListener('click', handleSubmitExp);
    
    // 【核心修正點 2】 rescan 按鈕點擊時，強制切換到手動模式
    document.getElementById('rescan-btn').addEventListener('click', () => {
        stopScanner();
        showManualInputInterface();
    });

    // 【新增】手動搜尋會員的事件監聽 (修正邏輯，當 user-id-display 有值時，啟用 submit 按鈕)
    const userSearchInput = document.getElementById('scan-user-search');
    const userSearchResults = document.getElementById('scan-user-search-results');
    const submitExpBtn = document.getElementById('submit-exp-btn');

    // 監聽 User ID 欄位變動，決定是否啟用送出按鈕
    const observer = new MutationObserver(() => {
        submitExpBtn.disabled = !userIdDisplay.value;
    });
    observer.observe(userIdDisplay, { attributes: true, childList: true, subtree: true, characterData: true });

    userSearchInput.addEventListener('input', async () => {
        const searchTerm = userSearchInput.value.trim();
        userIdDisplay.value = ''; // 搜尋時先清空 ID
        submitExpBtn.disabled = true; 
        
        if (searchTerm.length < 1) {
            userSearchResults.style.display = 'none';
            return;
        }
        try {
            const users = await api.searchUsers(searchTerm);
            userSearchResults.innerHTML = users.map(u => 
                `<li data-user-id="${u.user_id}">${u.nickname || u.line_display_name} (${u.user_id})</li>`
            ).join('');
            userSearchResults.style.display = users.length > 0 ? 'block' : 'none';
        } catch (error) {
            console.error('搜尋使用者失敗', error);
        }
    });

    userSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            // ... (原本的邏輯不變)
            stopScanner(); // 停止掃描器
            userIdDisplay.value = e.target.dataset.userId; // 帶入 User ID
            userSearchInput.value = e.target.textContent; // 讓輸入框顯示選中的人名
            document.getElementById('qr-reader').style.display = 'none'; // 隱藏掃描區域
            document.getElementById('scan-result').style.display = 'block'; // 顯示結果區域
            userSearchResults.style.display = 'none'; // 隱藏搜尋結果
            submitExpBtn.disabled = false; // 啟用送出按鈕
        }
    });
        
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

    // 處理頁面切換時的掃描器生命週期 (此處邏輯不變)
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