// public/admin/modules/scanAndPoint.js

import { api } from '../api.js';
import { ui } from '../ui.js';

let html5QrCode = null;
let cachedClasses = [];

// ── 常用顧客（localStorage）──────────────────────────────────────────────────

const PINNED_KEY = 'scan_pinned_users';

function getPinned() {
    try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; }
}
function savePinned(list) {
    localStorage.setItem(PINNED_KEY, JSON.stringify(list));
}
function isPinned(userId) {
    return getPinned().some(u => u.user_id === userId);
}
function togglePin(userId, name) {
    let list = getPinned();
    if (isPinned(userId)) {
        list = list.filter(u => u.user_id !== userId);
    } else {
        list.unshift({ user_id: userId, name });
    }
    savePinned(list);
    renderPinnedList();
    updatePinBtn(userId);
}

function renderPinnedList() {
    const ul = document.getElementById('scan-pinned-list');
    if (!ul) return;
    const list = getPinned();
    if (list.length === 0) {
        ul.innerHTML = '<li class="quick-empty">尚無常用顧客</li>';
        return;
    }
    ul.innerHTML = list.map(u => `
        <li data-user-id="${u.user_id}" data-name="${u.name}" class="quick-user-item">
            <span class="quick-user-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.name}</span>
            <button class="quick-unpin-btn" data-user-id="${u.user_id}" title="取消釘選">✕</button>
        </li>
    `).join('');
}

async function loadRecentList() {
    const ul = document.getElementById('scan-recent-list');
    if (!ul) return;
    try {
        const users = await api.getRecentPointedUsers();
        if (!users.length) {
            ul.innerHTML = '<li class="quick-empty">尚無紀錄</li>';
            return;
        }
        ul.innerHTML = users.map(u => {
            const name = u.nickname || u.line_display_name || u.user_id;
            return `<li data-user-id="${u.user_id}" data-name="${name}" class="quick-user-item">${name}</li>`;
        }).join('');
    } catch {
        ul.innerHTML = '<li class="quick-empty">載入失敗</li>';
    }
}

function updatePinBtn(userId) {
    const btn = document.getElementById('scan-pin-btn');
    if (!btn) return;
    const pinned = isPinned(userId);
    btn.textContent = pinned ? '★ 已釘選' : '☆ 釘選';
    btn.style.color = pinned ? '#f28e2b' : 'var(--text-light)';
}

function setupQuickPanelEvents() {
    const handler = (e) => {
        const unpinBtn = e.target.closest('.quick-unpin-btn');
        if (unpinBtn) {
            e.stopPropagation();
            const userId = unpinBtn.dataset.userId;
            const list = getPinned().filter(u => u.user_id !== userId);
            savePinned(list);
            renderPinnedList();
            updatePinBtn(userId);
            return;
        }
        const item = e.target.closest('.quick-user-item');
        if (item) {
            const userId = item.dataset.userId;
            const name = item.dataset.name;
            stopScanner();
            document.getElementById('user-id-display').value = userId;
            document.getElementById('scan-user-search').value = name;
            document.getElementById('qr-reader').style.display = 'none';
            document.getElementById('scan-result').style.display = 'block';
            document.getElementById('submit-exp-btn').disabled = false;
            loadScanUserPanel(userId);
        }
    };

    document.getElementById('scan-pinned-list')?.addEventListener('click', handler);
    document.getElementById('scan-recent-list')?.addEventListener('click', handler);
}

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
        panel.addEventListener('click', (e) => {
            const pinBtn = e.target.closest('#scan-pin-btn');
            if (pinBtn) togglePin(pinBtn.dataset.userId, pinBtn.dataset.name);
        }, { once: true });
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

    const pinned = isPinned(profile.user_id);
    panel.innerHTML = `
        <div style="text-align:center;margin-bottom:12px;position:relative;">
            <button id="scan-pin-btn" data-user-id="${profile.user_id}" data-name="${displayName}"
                style="position:absolute;top:0;right:0;background:none;border:none;cursor:pointer;font-size:0.82rem;color:${pinned ? '#f28e2b' : 'var(--text-light)'};">
                ${pinned ? '★ 已釘選' : '☆ 釘選'}
            </button>
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
        const contribMsg = (contributionClass && contributionValue > 0)
            ? `　貢獻值 +${contributionValue}（${contributionClass}）`
            : '';
        ui.toast.success((result.message || `成功新增 ${expValue} 點經驗值。`) + contribMsg);
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
        
    setupQuickPanelEvents();
    page.dataset.initialized = 'true';
}

/**
 * 模組初始化函式
 */
export const init = async (context, param) => {
    const page = document.getElementById('page-scan');
    if (!page) return;

    setupEventListeners();
    renderPinnedList();
    loadRecentList();
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
