// public/admin/modules/expHistory.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allExpHistory = [];
let filteredHistory = [];
let allContribHistory = [];
let filteredContribHistory = [];

// ── 渲染 ─────────────────────────────────────────────────────────────────────

function renderExpHistory(list) {
    const tbody = document.getElementById('exp-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">沒有符合條件的紀錄。</td></tr>';
        return;
    }

    list.forEach(record => {
        const row = tbody.insertRow();
        const displayName = record.nickname || record.line_display_name || '未知使用者';
        row.innerHTML = `
            <td class="compound-cell" style="text-align:left;">
                <div class="main-info">${displayName}</div>
                <div class="sub-info">${record.user_id}</div>
            </td>
            <td>${new Date(record.created_at).toLocaleString()}</td>
            <td>${record.reason}</td>
            <td>${record.exp_added}</td>
            <td>
                <button class="action-btn btn-delete-exp"
                    data-id="${record.history_id}"
                    style="background:var(--danger-color);color:#fff;padding:4px 10px;">刪除</button>
            </td>
        `;
    });
}

// ── 篩選 ─────────────────────────────────────────────────────────────────────

function applyFilterAndRender() {
    const userTerm = document.getElementById('exp-user-filter-input').value.toLowerCase().trim();
    const dateStart = document.getElementById('exp-date-start').value;
    const dateEnd = document.getElementById('exp-date-end').value;
    const minExp = parseInt(document.getElementById('exp-min-exp').value, 10);

    filteredHistory = allExpHistory.filter(record => {
        if (userTerm) {
            const match = (record.line_display_name || '').toLowerCase().includes(userTerm) ||
                          (record.nickname || '').toLowerCase().includes(userTerm) ||
                          (record.user_id || '').toLowerCase().includes(userTerm);
            if (!match) return false;
        }
        if (dateStart && new Date(record.created_at) < new Date(dateStart)) return false;
        if (dateEnd) {
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            if (new Date(record.created_at) > end) return false;
        }
        if (!isNaN(minExp) && minExp > 0 && record.exp_added < minExp) return false;
        return true;
    });

    renderExpHistory(filteredHistory);
}

function clearFilters() {
    document.getElementById('exp-user-filter-input').value = '';
    document.getElementById('exp-date-start').value = '';
    document.getElementById('exp-date-end').value = '';
    document.getElementById('exp-min-exp').value = '';
    filteredHistory = [...allExpHistory];
    renderExpHistory(filteredHistory);
}

// ── 貢獻度紀錄 ───────────────────────────────────────────────────────────────

function renderContribHistory(list) {
    const tbody = document.getElementById('contrib-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">沒有符合條件的紀錄。</td></tr>';
        return;
    }

    list.forEach(record => {
        const row = tbody.insertRow();
        const displayName = record.nickname || record.line_display_name || '未知使用者';
        row.innerHTML = `
            <td class="compound-cell" style="text-align:left;">
                <div class="main-info">${displayName}</div>
                <div class="sub-info">${record.user_id}</div>
            </td>
            <td>${new Date(record.created_at).toLocaleString()}</td>
            <td>${record.class_name}</td>
            <td>${record.contribution_value}</td>
            <td>
                <button class="action-btn btn-delete-contrib"
                    data-id="${record.id}"
                    style="background:var(--danger-color);color:#fff;padding:4px 10px;">刪除</button>
            </td>
        `;
    });
}

function applyContribFilterAndRender() {
    const userTerm = document.getElementById('contrib-user-filter-input').value.toLowerCase().trim();
    const classFilter = document.getElementById('contrib-class-filter').value;

    filteredContribHistory = allContribHistory.filter(record => {
        if (userTerm) {
            const match = (record.line_display_name || '').toLowerCase().includes(userTerm) ||
                          (record.nickname || '').toLowerCase().includes(userTerm) ||
                          (record.user_id || '').toLowerCase().includes(userTerm);
            if (!match) return false;
        }
        if (classFilter && record.class_name !== classFilter) return false;
        return true;
    });

    renderContribHistory(filteredContribHistory);
}

function clearContribFilters() {
    document.getElementById('contrib-user-filter-input').value = '';
    document.getElementById('contrib-class-filter').value = '';
    filteredContribHistory = [...allContribHistory];
    renderContribHistory(filteredContribHistory);
}

function populateClassFilter(data) {
    const select = document.getElementById('contrib-class-filter');
    const classes = [...new Set(data.map(r => r.class_name))].sort();
    select.innerHTML = '<option value="">所有職業</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}

async function loadContribHistory() {
    const tbody = document.getElementById('contrib-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">正在載入...</td></tr>';
    try {
        allContribHistory = await api.getContributionHistory();
        filteredContribHistory = [...allContribHistory];
        populateClassFilter(allContribHistory);
        renderContribHistory(filteredContribHistory);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">載入失敗: ${e.message}</td></tr>`;
    }
}

async function handleDeleteContrib(contribId) {
    if (!confirm('確定要刪除這筆貢獻度紀錄嗎？')) return;
    try {
        await api.deleteContributionRecord(contribId);
        ui.toast.success('已刪除');
        allContribHistory = await api.getContributionHistory();
        populateClassFilter(allContribHistory);
        applyContribFilterAndRender();
    } catch (e) {
        ui.toast.error('刪除失敗：' + e.message);
    }
}

// ── 分頁切換 ──────────────────────────────────────────────────────────────────

function setupTabSwitching() {
    let contribLoaded = false;

    document.querySelectorAll('.exp-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.exp-tab-btn').forEach(b => {
                b.style.color = 'var(--text-light)';
                b.style.borderBottomColor = 'transparent';
                b.style.fontWeight = 'normal';
                b.classList.remove('active');
            });
            btn.style.color = 'var(--primary-color)';
            btn.style.borderBottomColor = 'var(--primary-color)';
            btn.style.fontWeight = 'bold';
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            document.getElementById('exp-tab-content').style.display = tab === 'exp' ? '' : 'none';
            document.getElementById('contribution-tab-content').style.display = tab === 'contribution' ? '' : 'none';

            if (tab === 'contribution' && !contribLoaded) {
                contribLoaded = true;
                loadContribHistory();
            }
        });
    });
}

// ── 刪除 ─────────────────────────────────────────────────────────────────────

async function handleDeleteRecord(historyId) {
    if (!confirm('確定要刪除這筆紀錄嗎？\n刪除後將自動反扣使用者的 EXP 並重新計算等級。')) return;
    try {
        const result = await api.deleteExpRecord(historyId);
        const lvlMsg = result.newLevel !== undefined ? `（等級更新為 Lv.${result.newLevel}）` : '';
        ui.toast.success('已刪除，EXP 已自動調整' + lvlMsg);
        allExpHistory = await api.getExpHistory();
        applyFilterAndRender();
    } catch (e) {
        ui.toast.error('刪除失敗：' + e.message);
    }
}

// ── 事件綁定 ──────────────────────────────────────────────────────────────────

function setupEventListeners() {
    const page = document.getElementById('page-exp-history');
    if (page.dataset.initialized) return;

    document.getElementById('exp-user-filter-input').addEventListener('input', applyFilterAndRender);
    document.getElementById('exp-date-start').addEventListener('change', applyFilterAndRender);
    document.getElementById('exp-date-end').addEventListener('change', applyFilterAndRender);
    document.getElementById('exp-min-exp').addEventListener('input', applyFilterAndRender);
    document.getElementById('exp-clear-filter-btn').addEventListener('click', clearFilters);

    document.getElementById('exp-history-tbody').addEventListener('click', e => {
        const deleteBtn = e.target.closest('.btn-delete-exp');
        if (deleteBtn) handleDeleteRecord(deleteBtn.dataset.id);
    });

    document.getElementById('contrib-user-filter-input').addEventListener('input', applyContribFilterAndRender);
    document.getElementById('contrib-class-filter').addEventListener('change', applyContribFilterAndRender);
    document.getElementById('contrib-clear-filter-btn').addEventListener('click', clearContribFilters);

    document.getElementById('contrib-history-tbody').addEventListener('click', e => {
        const deleteBtn = e.target.closest('.btn-delete-contrib');
        if (deleteBtn) handleDeleteContrib(deleteBtn.dataset.id);
    });

    setupTabSwitching();

    page.dataset.initialized = 'true';
}

// ── Init ─────────────────────────────────────────────────────────────────────

export const init = async () => {
    const tbody = document.getElementById('exp-history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5">正在載入經驗紀錄...</td></tr>';
    try {
        allExpHistory = await api.getExpHistory();
        filteredHistory = [...allExpHistory];
        renderExpHistory(filteredHistory);
        setupEventListeners();
    } catch (e) {
        console.error('載入經驗紀錄失敗:', e);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">載入失敗: ${e.message}</td></tr>`;
    }
};
