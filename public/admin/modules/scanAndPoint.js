// public/admin/modules/scanAndPoint.js

import { api } from '../api.js';
import { ui } from '../ui.js';

let html5QrCode = null;
let cachedClasses = [];

/**
 * 停止掃描器
 */
function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("停止掃描失敗", err));
    }
}

/**
 * 取得職業清單（快取）
 */
async function getClasses() {
    if (cachedClasses.length === 0) {
        try {
            const assets = await api.getGameAssets();
            cachedClasses = assets.filter(a => a.type === 'class').map(a => a.name);
        } catch (e) {
            console.error('載入職業失敗', e);
        }
    }
    return cachedClasses;
}

/**
 * 填充職業下拉選單並自動選取
 */
async function populateClassSelect(selectedClass) {
    const select = document.getElementById('contribution-class-select');
    if (!select) return;
    const classes = await getClasses();
    select.innerHTML = '<option value="">-- 選擇職業 --</option>';
    classes.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === selectedClass) opt.selected = true;
        select.appendChild(opt);
    });
}

/**
 * 載入並渲染左側使用者資料面板
 */
async function loadScanUserPanel(userId) {
    const panel = document.getElementById('scan-user-panel');
    panel.style.display = 'block';
    panel.innerHTML = '<p style="text-align:center;color:#999;">讀取中...</p>';
    try {
        const data = await api.getUserDetails(userId);
        renderScanUserPanel(data);
        populateClassSelect(data.profile.class || '');
    } catch (e) {
        panel.innerHTML = `<p style="color:red;">載入失敗：${e.message}</p>`;
    }
}

function renderScanUserPanel(data) {
    const panel = document.getElementById('scan-user-panel');
    const { profile, exp_history } = data;
    const displayName = profile.nickname || profile.line_display_name;

    const chips = (type) => {
        const items = (profile.user_assets || []).filter(a => a.type === type);
        if (!items.length) return '<span style="color:#aaa">無</span>';
        return items.map(a => {
            const icon = a.icon_url ? `<img src="${a.icon_url}" style="height:1.1em;vertical-align:middle;margin-right:3px;border-radius:2px;">` : '';
            return `<span class="asset-chip">${icon}${a.name}</span>`;
        }).join('');
    };

    const recentExp = (exp_history || []).slice(0, 5).map(e =>
        `<tr><td>${new Date(e.created_at).toLocaleDateString()}</td><td>${e.reason}</td><td style="color:var(--success-color);font-weight:bold;">+${e.exp_added}</td></tr>`
    ).join('');

    panel.innerHTML = `
        <div style="text-align:center;margin-bottom:12px;">
            <img src="/api/admin/get-avatar?userId=${profile.user_id}"
                 style="width:64px;height:64px;border-radius:50%;border:2px solid var(--border-color);object-fit:cover;display:block;margin:0 auto 8px;">
            <strong style="font-size:1.05rem;">${displayName}</strong><br>
            <span class="tag-display">${profile.tag || '無'}</span>
        </div>
        ${profile.notes ? `<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;padding:8px;margin-bottom:10px;white-space:pre-wrap;">${profile.notes}</div>` : ''}
        <table style="width:100%;margin-bottom:10px;">
            <tr><td><strong>姓名</strong></td><td>${profile.real_name || '未設定'}</td></tr>
            <tr><td><strong>電話</strong></td><td>${profile.phone || '未設定'}</td></tr>
            <tr><td><strong>Email</strong></td><td>${profile.email || '未設定'}</td></tr>
            <tr><td><strong>等級</strong></td><td>${profile.level}（${profile.current_exp}/10 EXP）</td></tr>
            <tr><td><strong>職業</strong></td><td>${profile.class || '無'}</td></tr>
        </table>
        <p class="panel-section-title">稱號 / 成就</p>
        <div style="margin-bottom:6px;">${chips('title')} ${chips('achievement')}</div>
        <p class="panel-section-title">技能 / 裝備</p>
        <div style="margin-bottom:10px;">${chips('skill')} ${chips('equipment')}</div>
        ${recentExp ? `
        <p class="panel-section-title">最近經驗紀錄</p>
        <table style="width:100%;">
            <thead><tr><th style="text-align:left;">日期</th><th style="text-align:left;">原因</th><th>EXP</th></tr></thead>
            <tbody>${recentExp}</tbody>
        </table>` : ''}
    `;
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

    html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        stopScanner();
        userIdDisplay.value = decodedText;
        qrReader.style.display = 'none';
        scanResultContainer.style.display = 'block';
        document.getElementById('submit-exp-btn').disabled = false;
        loadScanUserPanel(decodedText);
    };

    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            console.error("無法啟動掃描器", err);
            
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

    const contributionClass = document.getElementById('contribution-class-select')?.value || '';
    const contributionValue = parseInt(document.getElementById('contribution-value-input')?.value, 10) || 0;

    try {
        const result = await api.addPoints({ userId, expValue, reason, contributionClass, contributionValue });
        ui.toast.success(result.message || '成功新增經驗值！');
        expInput.value = '10';
        customReasonInput.value = '';
        reasonSelect.value = '消費回饋';
        customReasonInput.style.display = 'none';
        document.getElementById('contribution-value-input').value = '5';
        startScanner();
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
    
    document.getElementById('rescan-btn').addEventListener('click', () => {
        stopScanner();
        showManualInputInterface();
        const panel = document.getElementById('scan-user-panel');
        panel.style.display = 'none';
        panel.innerHTML = '';
        const classSelect = document.getElementById('contribution-class-select');
        if (classSelect) classSelect.innerHTML = '<option value="">-- 選擇職業 --</option>';
        const contribInput = document.getElementById('contribution-value-input');
        if (contribInput) contribInput.value = '5';
    });

    const userSearchInput = document.getElementById('scan-user-search');
    const userSearchResults = document.getElementById('scan-user-search-results');
    const submitExpBtn = document.getElementById('submit-exp-btn');

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
            stopScanner();
            userIdDisplay.value = e.target.dataset.userId;
            userSearchInput.value = e.target.textContent;
            document.getElementById('qr-reader').style.display = 'none';
            document.getElementById('scan-result').style.display = 'block';
            userSearchResults.style.display = 'none';
            submitExpBtn.disabled = false;
            loadScanUserPanel(e.target.dataset.userId);
        }
    });
        
    page.dataset.initialized = 'true';
}

/**
 * 模組初始化函式
 */
export const init = async (context, param) => {
    const page = document.getElementById('page-scan');
    if (!page) return;

    setupEventListeners();
    startScanner();

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
