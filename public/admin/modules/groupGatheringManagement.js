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

function renderGameTags(games) {
    if (!games || games.length === 0) return '—';
    return games.map(g => {
        const tags = [];
        if (g.has_played) tags.push('<span class="admin-gg-tag">有玩過</span>');
        if (g.beginner_friendly) tags.push('<span class="admin-gg-tag admin-gg-tag-beginner">適合新手</span>');
        return `${g.name}${tags.join('')}`;
    }).join(' / ');
}

async function loadGatherings(status) {
    const tbody = pageElement.querySelector('#gg-admin-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">載入中...</td></tr>';

    try {
        const list = await api.getGroupGatherings(status);
        if (list.length === 0) {
            const label = status.split(',').map(s => STATUS_LABEL[s.trim()] || s).join('／');
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">沒有「${label}」的揪團</td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(g => `
            <tr>
                <td>${g.id}</td>
                <td>${g.organizer_name}</td>
                <td>${g.event_date}<br>${g.start_time}–${g.end_time}</td>
                <td>${g.member_count + 1} 人</td>
                <td class="admin-gg-games-cell">${renderGameTags(g.games)}</td>
                <td><span class="admin-gg-status-badge gg-s-${g.status}">${STATUS_LABEL[g.status] || g.status}</span></td>
                <td class="actions-cell">
                    <button class="action-btn btn-gg-view" data-id="${g.id}" style="background:var(--info-color);">詳情</button>
                    ${g.status === 'pending_approval' ? `
                    <button class="action-btn btn-gg-approve" data-id="${g.id}" style="background:var(--success-color);">同意</button>
                    <button class="action-btn btn-gg-reject"  data-id="${g.id}" style="background:var(--danger-color);">拒絕</button>
                    ` : ''}
                </td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">載入失敗: ${err.message}</td></tr>`;
    }
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
            <h3 style="margin-top:0;">${g.organizer_name} 的揪團 #${g.id}</h3>
            <table class="gg-detail-table">
                <tr><td>狀態</td><td>${STATUS_LABEL[g.status] || g.status}</td></tr>
                <tr><td>日期時間</td><td>${g.event_date} ${g.start_time}–${g.end_time}</td></tr>
                <tr><td>截止時間</td><td>${g.deadline}</td></tr>
                <tr><td>人數限制</td><td>${g.max_participants ? `${approvedCount} / ${g.max_participants}` : `${approvedCount} 人（不限）`}</td></tr>
                <tr><td>遊戲</td><td>${renderGameTags(g.games)}</td></tr>
                ${g.note ? `<tr><td>備註</td><td>${g.note}</td></tr>` : ''}
            </table>
            <h4>報名成員（${approvedCount} 人）</h4>
            <div class="gg-member-list">
                ${members.length === 0 ? '<p>尚無成員</p>' : members.map(m => `
                    <div class="gg-member-item">
                        <div>
                            <span style="font-weight:600;">${m.display_name}</span>
                            <span style="font-size:0.8rem; color:#666; margin-left:6px;">(${m.line_name || '—'} · ${m.user_id})</span>
                        </div>
                        <span class="gg-member-badge ${m.status === 'approved' ? 'badge-approved' : m.status === 'rejected' ? 'badge-rejected' : ''}">${m.status === 'approved' ? '通過' : m.status === 'rejected' ? '未通過' : '待定'}</span>
                    </div>`).join('')}
            </div>
            ${g.status === 'pending_approval' ? `
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button class="action-btn btn-gg-approve" data-id="${g.id}" style="background:var(--success-color); flex:1;">✓ 同意成團</button>
                <button class="action-btn btn-gg-reject"  data-id="${g.id}" style="background:var(--danger-color); flex:1;">✕ 拒絕</button>
            </div>` : ''}`;
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
            <button class="sub-tab-btn" data-status="open">揪團中</button>
            <button class="sub-tab-btn" data-status="closed">已滿員</button>
            <button class="sub-tab-btn" data-status="failed,cancelled">已流標／解散</button>
        </div>
        <div class="table-container" style="overflow-x:auto;">
            <table class="data-table">
                <thead><tr>
                    <th>#</th><th>團主</th><th>活動時間</th><th>人數</th><th>遊戲</th><th>狀態</th><th>操作</th>
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
        loadGatherings(currentFilter);
    });

    // 表格操作按鈕
    pageElement.querySelector('#gg-admin-tbody').addEventListener('click', async e => {
        const btn = e.target.closest('[class*="btn-gg-"]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-gg-view'))    await showDetail(id);
        if (btn.classList.contains('btn-gg-approve')) await approveGathering(id);
        if (btn.classList.contains('btn-gg-reject'))  await rejectGathering(id);
    });

    // Modal 內按鈕（approve / reject）
    pageElement.querySelector('#gg-detail-modal').addEventListener('click', async e => {
        const btn = e.target.closest('[class*="btn-gg-"]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('btn-gg-approve')) await approveGathering(id);
        if (btn.classList.contains('btn-gg-reject'))  await rejectGathering(id);
    });

    pageElement.querySelector('#gg-modal-close').addEventListener('click', closeModal);

    loadGatherings(currentFilter);
}
