// public/admin/modules/expHistory.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態，快取所有紀錄
let allExpHistory = [];

/**
 * 渲染經驗紀錄列表
 * @param {Array} historyList 要顯示的紀錄
 */
function renderExpHistory(historyList) {
    const tbody = document.getElementById('exp-history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (historyList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">沒有符合條件的紀錄。</td></tr>';
        return;
    }

    historyList.forEach(record => {
        const row = tbody.insertRow();
        const displayName = record.nickname || record.line_display_name || '未知使用者';
        
        row.innerHTML = `
            <td class="compound-cell" style="text-align: left;">
                <div class="main-info">${displayName}</div>
                <div class="sub-info">${record.user_id}</div>
            </td>
            <td>${new Date(record.created_at).toLocaleString()}</td>
            <td>${record.reason}</td>
            <td>${record.exp_added}</td>
        `;
    });
}

/**
 * 根據搜尋條件篩選並重新渲染列表
 */
function applyFilterAndRender() {
    const searchInput = document.getElementById('exp-user-filter-input');
    const searchTerm = searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        renderExpHistory(allExpHistory);
        return;
    }

    const filtered = allExpHistory.filter(record => 
        (record.line_display_name && record.line_display_name.toLowerCase().includes(searchTerm)) ||
        (record.nickname && record.nickname.toLowerCase().includes(searchTerm)) ||
        (record.user_id && record.user_id.toLowerCase().includes(searchTerm))
    );

    renderExpHistory(filtered);
}

/**
 * 綁定事件監聽器
 */
function setupEventListeners() {
    const page = document.getElementById('page-exp-history');
    if (page.dataset.initialized) return;

    const searchInput = document.getElementById('exp-user-filter-input');
    searchInput.addEventListener('input', applyFilterAndRender);

    page.dataset.initialized = 'true';
}

/**
 * 模組初始化函式
 */
export const init = async (context, param) => {
    const page = document.getElementById('page-exp-history');
    const tbody = document.getElementById('exp-history-tbody');
    if (!page || !tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4">正在載入經驗紀錄...</td></tr>';

    try {
        // 呼叫 API 取得所有經驗紀錄
        allExpHistory = await api.getExpHistory();
        renderExpHistory(allExpHistory);
        setupEventListeners();
    } catch (error) {
        console.error('載入經驗紀錄失敗:', error);
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">載入失敗: ${error.message}</td></tr>`;
    }
};