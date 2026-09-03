import { api } from '../api.js';
import { ui } from '../ui.js';

const STATUS_LABEL = {
    open: '揪團中',
    closed: '截止/已滿',
    pending_approval: '待審核',
    approved: '已成團',
    failed: '已流標',
    cancelled: '已解散',
};

let pageElement;
let currentFilter = 'pending_approval';
let currentList = [];
let sortByEventTime = false; // false = 依建立時間新到舊（後端預設順序）；true = 依活動時間近到遠

// 揪團的名稱/備註/暱稱皆為使用者輸入，插入 innerHTML 前必須跳脫，避免儲存型 XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderGameTags(games) {
    if (!games || games.length === 0) return '—';
    return games.map(g => {
        const tags = [];
        if (g.has_played) tags.push('<span class="admin-gg-tag">徵有玩過的</span>');
        if (g.beginner_friendly) tags.push('<span class="admin-gg-tag admin-gg-tag-beginner">適合新手</span>');
        return `${escapeHtml(g.name)}${tags.join('')}`;
    }).join(' / ');
}

async function loadGatherings(status) {
    const tbody = pageElement.querySelector('#gg-admin-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">載入中...</td></tr>';

    try {
        currentList = await api.getGroupGatherings(status);
        renderGatheringsTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">載入失敗: ${err.message}</td></tr>`;
    }
}

function renderGatheringsTable() {
    const tbody = pageElement.querySelector('#gg-admin-tbody');
    if (!tbody) return;

    if (currentList.length === 0) {
        const label = currentFilter.split(',').map(s => STATUS_LABEL[s.trim()] || s).join('／');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">沒有「${label}」的揪團</td></tr>`;
        return;
    }

    const list = sortByEventTime
        ? [...currentList].sort((a, b) => `${a.event_date} ${a.start_time}`.localeCompare(`${b.event_date} ${b.start_time}`))
        : currentList;

    tbody.innerHTML = list.map(g => `
        <tr>
            <td>${g.id}</td>
            <td>${escapeHtml(g.organizer_name)}</td>
            <td>${g.event_date}<br>${g.start_time}–${g.end_time}</td>
            <td>${g.max_participants ? `${g.member_count + 1} / ${g.max_participants}` : `${g.member_count + 1} 人`}</td>
            <td class="admin-gg-games-cell">${renderGameTags(g.games)}</td>
            <td><span class="admin-gg-status-badge gg-s-${g.status}">${STATUS_LABEL[g.status] || g.status}</span></td>
            <td class="actions-cell">
                <button class="action-btn btn-gg-view" data-id="${g.id}" style="background:var(--info-color);">詳情</button>
                ${g.status === 'pending_approval' ? `
                <button class="action-btn btn-gg-approve" data-id="${g.id}" style="background:var(--success-color);">同意</button>
                <button class="action-btn btn-gg-reject"  data-id="${g.id}" style="background:var(--danger-color);">拒絕</button>
                ` : ''}
                <button class="action-btn btn-gg-delete" data-id="${g.id}" data-name="${escapeHtml(g.organizer_name)}" style="background:var(--danger-color);">刪除</button>
            </td>
        </tr>`).join('');
}

async function showDetail(id) {
    const modal = pageElement.querySelector('#gg-detail-modal');
    const content = pageElement.querySelector('#gg-detail-content');
    if (!modal || !content) return;

    content.innerHTML = '<p style="text-align:center;">載入中...</p>';
    modal.style.display = 'flex';

    try {
        const g = await api.getGroupGatheringDetail(id);
        const members = g.members || [];
        const approvedCount = members.filter(m => m.status !== 'rejected').length;

        content.innerHTML = `
            <h3 style="margin-top:0;">${escapeHtml(g.organizer_name)} 的揪團 #${g.id}</h3>
            <table class="gg-detail-table">
                <tr><td>狀態</td><td>${STATUS_LABEL[g.status] || g.status}</td></tr>
                <tr><td>日期時間</td><td>${g.event_date} ${g.start_time}–${g.end_time}</td></tr>
                <tr><td>截止時間</td><td>${g.deadline}</td></tr>
                <tr><td>人數限制</td><td>${g.max_participants ? `${approvedCount + 1} / ${g.max_participants}` : `${approvedCount + 1} 人（不限）`}</td></tr>
                <tr><td>遊戲</td><td>${renderGameTags(g.games)}</td></tr>
                ${g.note ? `<tr><td>備註</td><td>${escapeHtml(g.note)}</td></tr>` : ''}
            </table>
            <h4>報名成員（${approvedCount} 人）</h4>
            <div class="gg-member-list">
                ${members.length === 0 ? '<p>尚無成員</p>' : members.map(m => `
                    <div class="gg-member-item">
                        <div>
                            <span style="font-weight:600;">${escapeHtml(m.display_name)}</span>
                            <span style="font-size:0.8rem; color:#666; margin-left:6px;">(${escapeHtml(m.line_name) || '—'} · ${escapeHtml(m.user_id)})</span>
                        </div>
                        <span class="gg-member-badge ${m.status === 'approved' ? 'badge-approved' : m.status === 'rejected' ? 'badge-rejected' : ''}">${m.status === 'approved' ? '通過' : m.status === 'rejected' ? '未通過' : '待定'}</span>
                    </div>`).join('')}
            </div>
            `;
    } catch (err) {
        content.innerHTML = `<p style="color:red;">載入失敗: ${err.message}</p>`;
    }
}

async function approveGathering(id) {
    if (!confirm(`確定要同意揪團 #${id} 並自動建立預約嗎？`)) return;
    try {
        await api.approveGroupGathering(id);
        ui.toast.success('已同意成團，預約已自動建立並通知成員！');
        closeModal();
        loadGatherings(currentFilter);
    } catch (err) {
        ui.toast.error(`操作失敗: ${err.message}`);
    }
}

async function rejectGathering(id) {
    const reason = prompt('拒絕原因（選填，將發送給團主）：') ?? null;
    if (reason === null) return; // 按取消
    try {
        await api.rejectGroupGathering(id, reason);
        ui.toast.success('已拒絕並通知團主');
        closeModal();
        loadGatherings(currentFilter);
    } catch (err) {
        ui.toast.error(`操作失敗: ${err.message}`);
    }
}

async function deleteGathering(id, name) {
    if (!confirm(`確定要永久刪除「${name}」的揪團 #${id} 嗎？\n此操作無法復原，包含成員名單、編輯紀錄都會一併刪除。`)) return;
    try {
        await api.deleteGroupGathering(id);
        ui.toast.success('已刪除揪團');
        closeModal();
        loadGatherings(currentFilter);
    } catch (err) {
        ui.toast.error(`刪除失敗: ${err.message}`);
    }
}

function closeModal() {
    const modal = pageElement.querySelector('#gg-detail-modal');
    if (modal) modal.style.display = 'none';
}

export async function init() {
    pageElement = document.getElementById('page-group-gatherings');
    if (!pageElement) return;

    pageElement.innerHTML = `
        <div class="page-header">
            <h2>揪團管理</h2>
        </div>
        <div class="sub-nav-tabs" id="gg-filter-tabs">
            <button class="sub-tab-btn active" data-status="pending_approval">待審核</button>
            <button class="sub-tab-btn" data-status="approved">已成團</button>
            <button class="sub-tab-btn" data-status="open,closed">揪團中</button>
            <button class="sub-tab-btn" data-status="failed,cancelled">已流標／解散</button>
        </div>
        <div class="table-container" style="overflow-x:auto;">
            <table class="data-table">
                <thead><tr>
                    <th>#</th><th>團主</th><th id="gg-sort-event-time" style="cursor:pointer; user-select:none;" title="點擊依活動時間排序">活動時間 <span id="gg-sort-event-time-icon">↕</span></th><th>人數</th><th>遊戲</th><th>狀態</th><th>操作</th>
                </tr></thead>
                <tbody id="gg-admin-tbody"></tbody>
            </table>
        </div>

        <!-- 詳情 Modal -->
        <div id="gg-detail-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
            <div style="background:#fff; border-radius:8px; padding:24px; max-width:520px; width:90%; max-height:80vh; overflow-y:auto; position:relative;">
                <button id="gg-modal-close" style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:1.3rem; cursor:pointer;">✕</button>
                <div id="gg-detail-content"></div>
            </div>
        </div>`;

    // 篩選分頁切換
    pageElement.querySelector('#gg-filter-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.sub-tab-btn');
        if (!btn) return;
        pageElement.querySelectorAll('#gg-filter-tabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.status;
        sortByEventTime = false;
        pageElement.querySelector('#gg-sort-event-time-icon').textContent = '↕';
        loadGatherings(currentFilter);
    });

    // 點擊「活動時間」欄位標題：切換成依活動時間由近到遠排序（不用重新打 API）
    pageElement.querySelector('#gg-sort-event-time').addEventListener('click', () => {
        sortByEventTime = !sortByEventTime;
        pageElement.querySelector('#gg-sort-event-time-icon').textContent = sortByEventTime ? '▲' : '↕';
        renderGatheringsTable();
    });

    // 表格操作按鈕
    pageElement.querySelector('#gg-admin-tbody').addEventListener('click', async e => {
        const btn = e.target.closest('[class*="btn-gg-"]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-gg-view'))    await showDetail(id);
        if (btn.classList.contains('btn-gg-approve')) await approveGathering(id);
        if (btn.classList.contains('btn-gg-reject'))  await rejectGathering(id);
        if (btn.classList.contains('btn-gg-delete'))  await deleteGathering(id, btn.dataset.name);
    });

    pageElement.querySelector('#gg-modal-close').addEventListener('click', closeModal);

    loadGatherings(currentFilter);
}
