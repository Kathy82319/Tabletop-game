// 揪團功能前台邏輯
// 依賴 window.userProfile（由 script.js 在 liff.init 後設定）

const GatherModule = (() => {
    // 取得 LIFF access token 用於 API 身份驗證
    function getLiffToken() {
        if (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) {
            return liff.getAccessToken();
        }
        return null;
    }

    function authHeaders() {
        const token = getLiffToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['X-LIFF-Token'] = token;
        return headers;
    }

    // 使用者輸入（揪團名稱/備註/暱稱等）在插入 innerHTML 前必須跳脫，避免儲存型 XSS
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---- 狀態對應 ----
    const STATUS_LABEL = {
        open: '揪團中',
        closed: '報名截止',
        pending_approval: '等待店家審核',
        approved: '已成團',
        failed: '已流標',
        cancelled: '已解散',
    };
    const STATUS_CLASS = {
        open: 'gg-status-open',
        closed: 'gg-status-closed',
        pending_approval: 'gg-status-pending',
        approved: 'gg-status-approved',
        failed: 'gg-status-failed',
        cancelled: 'gg-status-failed',
    };

    // 店家自己開的團，「揪團中」標籤改顯示「店家開團」
    function getStatusLabel(g) {
        if (g.status === 'open' && g.is_store_organizer) return '店家開團';
        return STATUS_LABEL[g.status] || g.status;
    }

    function formatDeadline(dt) {
        if (!dt) return '';
        const d = new Date(dt.replace(' ', 'T'));
        return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    let countdownInterval = null;
    let allGatherings = [];
    let filterDateFrom = '';
    let filterDateTo   = '';
    let filterGame = '';
    let filterBeginner = false;
    let calYear = 0, calMonth = 0, calPickerOpen = false;
    function startCountdownTimer() {
        function tick() {
            document.querySelectorAll('.gg-countdown[data-deadline]').forEach(el => {
                const deadline = new Date(el.dataset.deadline.replace(' ', 'T'));
                const diff = deadline - Date.now();
                if (diff <= 0) {
                    const card = el.closest('.gg-card');
                    const listContainer = document.getElementById('gather-list-container');
                    if (card && listContainer && listContainer.contains(card)) {
                        card.remove();
                        if (listContainer.querySelectorAll('.gg-card').length === 0) {
                            listContainer.innerHTML = '<p class="gg-empty">目前沒有開放中的揪團，來發起第一個吧！</p>';
                        }
                    }
                    return;
                }
                const days = Math.floor(diff / 86400000);
                const hours = Math.floor((diff % 86400000) / 3600000);
                const mins = Math.floor((diff % 3600000) / 60000);
                if (days > 0) el.textContent = `剩 ${days} 天`;
                else if (hours > 0) el.textContent = `剩 ${hours} 小時`;
                else el.textContent = `剩 ${mins} 分鐘`;
            });
        }
        tick();
        if (!countdownInterval) countdownInterval = setInterval(tick, 60000);
    }

    function renderGameTags(games) {
        if (!games || games.length === 0) return '<span style="color:var(--color-text-secondary);">未指定</span>';
        return games.map(g => {
            const tags = [];
            if (g.has_played) tags.push('<span class="gg-tag gg-tag-played">有玩過</span>');
            if (g.beginner_friendly) tags.push('<span class="gg-tag gg-tag-beginner">適合新手</span>');
            return `<div class="gg-game-row"><strong>${escapeHtml(g.name)}</strong>${tags.join('')}</div>`;
        }).join('');
    }

    function renderGatherCard(g, showMyStatus = false) {
        const statusLabel = getStatusLabel(g);
        const statusClass = STATUS_CLASS[g.status] || '';
        const maxText = g.max_participants ? `${(g.member_count || 0) + 1} / ${g.max_participants}` : `${(g.member_count || 0) + 1} 人`;
        const myBadge = showMyStatus && g.my_status && g.my_status !== 'organizer'
            ? `<span class="gg-my-badge">${g.my_status === 'approved' ? '已通過' : g.my_status === 'rejected' ? '未通過' : '已報名'}</span>` : '';
        const organizerBadge = showMyStatus && g.my_status === 'organizer'
            ? '<span class="gg-my-badge gg-badge-organizer">我是團主</span>' : '';

        return `
        <div class="gg-card" data-id="${g.id}">
            <div class="gg-card-top">
                <div class="gg-card-main">
                    ${g.name ? `<div class="gg-card-name">${escapeHtml(g.name)}</div>` : ''}
                    <div class="gg-card-info">
                        <div class="gg-card-row"><span class="gg-card-label">活動日期：</span>${g.event_date}</div>
                        <div class="gg-card-row"><span class="gg-card-label">時間：</span>${g.start_time}–${g.end_time}</div>
                        <div class="gg-card-row"><span class="gg-card-label">遊戲：</span><span class="gg-card-games">${g.games.map(gm => escapeHtml(gm.name)).join('、')}</span></div>
                    </div>
                </div>
                <div class="gg-card-aside">
                    <span class="gg-status-badge ${statusClass}">${statusLabel}</span>
                    ${myBadge}${organizerBadge}
                    <span class="gg-card-count">👥 ${maxText}</span>
                </div>
            </div>
            <div class="gg-card-deadline">截止 ${formatDeadline(g.deadline)}<span class="gg-countdown" data-deadline="${g.deadline}"></span></div>
        </div>`;
    }

    // ---- 主列表 ----
    function applyFilters() {
        const container = document.getElementById('gather-list-container');
        if (!container) return;
        let filtered = allGatherings;
        if (filterDateFrom) filtered = filtered.filter(g => g.event_date >= filterDateFrom);
        if (filterDateTo)   filtered = filtered.filter(g => g.event_date <= filterDateTo);
        if (filterGame) filtered = filtered.filter(g => g.games.some(gm => gm.name.includes(filterGame)));
        if (filterBeginner) filtered = filtered.filter(g => g.games.some(gm => gm.beginner_friendly));
        if (filtered.length === 0) {
            container.innerHTML = '<p class="gg-empty">沒有符合條件的揪團</p>';
            return;
        }
        container.innerHTML = filtered.map(g => renderGatherCard(g)).join('');
        startCountdownTimer();
    }

    // ---- 日期區間選擇器 ----
    function updateDateBtn() {
        const btn = document.getElementById('gg-filter-date-btn');
        if (!btn) return;
        if (!filterDateFrom && !filterDateTo) {
            btn.textContent = '日期';
            btn.classList.remove('active');
        } else {
            const fmt = s => s ? s.slice(5).replace('-', '/') : '?';
            btn.textContent = (filterDateFrom && filterDateTo && filterDateFrom !== filterDateTo)
                ? `${fmt(filterDateFrom)}～${fmt(filterDateTo)}`
                : fmt(filterDateFrom || filterDateTo);
            btn.classList.add('active');
        }
    }

    function renderCal() {
        const cal = document.getElementById('gg-date-picker-cal');
        if (!cal) return;
        const mn = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        const firstDow = new Date(calYear, calMonth, 1).getDay();
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        let html = `<div class="gg-cal-header">
            <button class="gg-cal-nav" data-dir="-1">◀</button>
            <span>${calYear}年 ${mn[calMonth]}</span>
            <button class="gg-cal-nav" data-dir="1">▶</button>
        </div><div class="gg-cal-grid">
        <span class="gg-cal-dow">日</span><span class="gg-cal-dow">一</span>
        <span class="gg-cal-dow">二</span><span class="gg-cal-dow">三</span>
        <span class="gg-cal-dow">四</span><span class="gg-cal-dow">五</span>
        <span class="gg-cal-dow">六</span>`;
        for (let i = 0; i < firstDow; i++) html += '<span></span>';
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            let cls = 'gg-cal-day';
            if (ds === filterDateFrom) cls += ' gg-cal-start';
            if (ds === filterDateTo)   cls += ' gg-cal-end';
            if (filterDateFrom && filterDateTo && ds > filterDateFrom && ds < filterDateTo) cls += ' gg-cal-range';
            html += `<button class="${cls}" data-date="${ds}">${d}</button>`;
        }
        html += `</div>`;
        if (filterDateFrom || filterDateTo) {
            html += `<div class="gg-cal-footer"><button class="gg-cal-clear">清除日期</button></div>`;
        }
        cal.innerHTML = html;

        cal.querySelectorAll('.gg-cal-nav').forEach(b => {
            b.addEventListener('click', () => {
                calMonth += parseInt(b.dataset.dir);
                if (calMonth < 0)  { calMonth = 11; calYear--; }
                if (calMonth > 11) { calMonth = 0;  calYear++; }
                renderCal();
            });
        });
        cal.querySelectorAll('.gg-cal-day').forEach(b => {
            b.addEventListener('click', () => {
                const date = b.dataset.date;
                if (!filterDateFrom || (filterDateFrom && filterDateTo)) {
                    filterDateFrom = date;
                    filterDateTo = '';
                } else {
                    if (date < filterDateFrom) { filterDateTo = filterDateFrom; filterDateFrom = date; }
                    else { filterDateTo = date; }
                }
                updateDateBtn();
                renderCal();
                applyFilters();
                if (filterDateFrom && filterDateTo) {
                    setTimeout(() => {
                        calPickerOpen = false;
                        const c = document.getElementById('gg-date-picker-cal');
                        if (c) c.hidden = true;
                    }, 150);
                }
            });
        });
        const clrBtn = cal.querySelector('.gg-cal-clear');
        if (clrBtn) {
            clrBtn.addEventListener('click', () => {
                filterDateFrom = '';
                filterDateTo = '';
                updateDateBtn();
                renderCal();
                applyFilters();
            });
        }
    }

    function initDatePicker() {
        const btn = document.getElementById('gg-filter-date-btn');
        const cal = document.getElementById('gg-date-picker-cal');
        if (!btn || !cal || btn.dataset.l) return;
        btn.dataset.l = '1';
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        btn.addEventListener('click', e => {
            e.stopPropagation();
            calPickerOpen = !calPickerOpen;
            if (calPickerOpen) { renderCal(); cal.hidden = false; }
            else { cal.hidden = true; }
        });
        document.addEventListener('click', () => {
            if (calPickerOpen) { calPickerOpen = false; cal.hidden = true; }
        });
        cal.addEventListener('click', e => e.stopPropagation());
    }

    async function loadList() {
        const container = document.getElementById('gather-list-container');
        if (!container) return;
        try {
            const res = await fetch('/api/group-gatherings/list');
            const list = await res.json();
            allGatherings = Array.isArray(list) ? list : [];
            if (allGatherings.length === 0) {
                container.innerHTML = '<p class="gg-empty">目前沒有開放中的揪團，來發起第一個吧！</p>';
                return;
            }
            applyFilters();
        } catch {
            container.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗，請稍後再試</p>';
        }
    }

    // ---- 詳情頁 ----
    async function showDetail(id) {
        const overlay = document.getElementById('gg-modal-overlay');
        const content = document.getElementById('gg-modal-content');
        if (!overlay) return;

        content.innerHTML = '<p style="text-align:center; padding:20px;">載入中...</p>';
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        try {
            const res = await fetch(`/api/group-gatherings/${id}`, {
                headers: authHeaders(),
            });
            const g = await res.json();
            if (!res.ok) {
                content.innerHTML = `<p style="color:red;">${g.error || '載入失敗'}</p>`;
                return;
            }

            const isOrganizer = g.my_status === 'organizer';
            const isOpen = g.status === 'open';
            const isClosed = g.status === 'closed';
            const isPending = g.status === 'pending_approval';
            const alreadyJoined = g.my_status && g.my_status !== 'organizer';
            const now = new Date();
            const deadline = new Date(g.deadline.replace(' ', 'T'));
            const beforeDeadline = now < deadline;
            const hasMemberLimit = !!g.max_participants;
            const memberCount = (g.members || []).filter(m => m.status !== 'rejected').length;
            const isFull = hasMemberLimit && memberCount >= g.max_participants - 1;

            const shareUrl = `${location.origin}${location.pathname}#gather-share@${g.share_token}`;

            const allNonRejected = (g.members || []).filter(m => m.status !== 'rejected');
            const pendingMembers = allNonRejected.filter(m => m.status === 'pending');
            const showWaitlist = isOrganizer && !hasMemberLimit && isPending && pendingMembers.length > 0;

            const membersToShow = (!hasMemberLimit && (isOpen || isClosed))
                ? allNonRejected  // 無上限開放中：所有人都看到全部報名者（團主有勾選框）
                : hasMemberLimit
                    ? allNonRejected  // 有上限：加入即確認，顯示全部非拒絕
                    : allNonRejected.filter(m => m.status === 'approved'); // 其他狀態：只顯示已確認

            const membersHtml = membersToShow.map(m =>
                `<div class="gg-member-row">
                    <span>👤 ${escapeHtml(m.display_name)}</span>
                    ${isOrganizer && !hasMemberLimit && (isOpen || isClosed)
                        ? `<input type="checkbox" class="gg-member-check" data-uid="${m.user_id}" ${m.status === 'approved' ? 'checked' : ''}>`
                        : `<span class="gg-member-status">${m.status === 'approved' ? '✓' : ''}</span>`}
                </div>`
            ).join('') || '<span style="color:var(--color-text-secondary);">尚無成員報名</span>';

            const waitlistHtml = showWaitlist
                ? pendingMembers.map(m =>
                    `<div class="gg-member-row">
                        <span>👤 ${escapeHtml(m.display_name)}</span>
                        <button class="gg-approve-member-btn" data-uid="${m.user_id}" style="font-size:0.8rem;padding:4px 10px;">補位</button>
                    </div>`
                ).join('')
                : '';

            let actionsHtml = '';
            if (isOrganizer) {
                if (isOpen || isClosed) {
                    if (!hasMemberLimit) {
                        actionsHtml += `<button class="cta-button" id="gg-select-members-btn">確認參加名單</button>`;
                    }
                    actionsHtml += `<button class="cta-button" id="gg-submit-btn" style="margin-top:8px;">提交給店家確認</button>`;
                    actionsHtml += `<button class="cta-button" id="gg-cancel-btn" style="margin-top:8px; background:#c0392b;">解散揪團</button>`;
                } else if (isPending) {
                    actionsHtml += `<button class="cta-button" id="gg-reopen-btn" style="background: var(--color-text-secondary); margin-top:8px;">重新開放報名</button>`;
                    actionsHtml += `<button class="cta-button" id="gg-cancel-btn" style="margin-top:8px; background:#c0392b;">解散揪團</button>`;
                }
            } else {
                if ((isOpen || isClosed) && beforeDeadline && !isFull && !alreadyJoined && getLiffToken()) {
                    actionsHtml += `
                        <button class="cta-button" id="gg-join-btn">立即報名</button>
                        <div id="gg-nickname-form" style="display:none; margin-top:10px;">
                            <input type="text" id="gg-nickname-input" maxlength="20" placeholder="請輸入您的暱稱（最多20字）"
                                style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--color-frame-gold);border-radius:var(--border-radius);background:rgba(255,255,255,0.6);font-size:0.95rem;margin-bottom:8px;">
                            <div style="display:flex;gap:8px;">
                                <button class="cta-button" id="gg-confirm-join-btn" style="flex:2;">確認報名</button>
                                <button class="cta-button" id="gg-cancel-join-btn" style="flex:1;background:var(--color-text-secondary);">取消</button>
                            </div>
                        </div>`;
                } else if (alreadyJoined && (isOpen || isClosed)) {
                    actionsHtml += `<button class="cta-button" id="gg-leave-btn" style="background: var(--color-text-secondary);">取消報名</button>`;
                }
            }

            const canEdit = isOrganizer && (isOpen || isClosed);
            const hasHistory = (g.edit_history || []).length > 0;

            let iconActionsHtml = '';
            if (canEdit) {
                iconActionsHtml += `<button class="gg-icon-chip" id="gg-edit-btn">✏️<span>編輯</span></button>`;
            }
            if (g.status !== 'cancelled') {
                iconActionsHtml += `<button class="gg-icon-chip" id="gg-share-btn">🔗<span>分享</span></button>`;
            }

            content.innerHTML = `
                <div class="gg-detail">
                    <div class="gg-detail-header">
                        <span class="gg-status-badge ${STATUS_CLASS[g.status] || ''}">${getStatusLabel(g)}</span>
                        <h2>${g.name ? escapeHtml(g.name) : (escapeHtml(g.organizer_name) + ' 的揪團')}</h2>
                        ${iconActionsHtml ? `<div class="gg-icon-actions">${iconActionsHtml}</div>` : ''}
                    </div>
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">📅 時間</span>
                        <span>${g.event_date} ${g.start_time}–${g.end_time}</span>
                    </div>
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">⏰ 截止報名</span>
                        <span>${formatDeadline(g.deadline)}</span>
                    </div>
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">👥 人數</span>
                        <span>${hasMemberLimit ? `${memberCount + 1} / ${g.max_participants} 人` : `${memberCount + 1} 人（不限）`}</span>
                    </div>
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">🎲 遊戲</span>
                        <div>${renderGameTags(g.games)}</div>
                    </div>
                    ${g.note ? `<div class="gg-detail-section"><span class="gg-detail-label">📝 備註</span><span class="gg-detail-note">${escapeHtml(g.note)}</span></div>` : ''}
                    ${isOrganizer && !hasMemberLimit && (isOpen || isClosed) ? `
                    <div class="gather-limit-hint" style="margin-bottom:12px;">
                        📋 無人數上限模式：請勾選您想帶去的成員，未勾選的人將列為候補。確認名單後點「確認參加名單」，再提交給店家審核。店家審核過之後將會自動婉拒未勾選的參與者。
                    </div>` : ''}
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">成員列表</span>
                        <div id="gg-members-list">${membersHtml}</div>
                    </div>
                    ${showWaitlist ? `<div class="gg-detail-section">
                        <span class="gg-detail-label">候補名單</span>
                        <div id="gg-waitlist">${waitlistHtml}</div>
                    </div>` : ''}
                    <div class="gg-actions">${actionsHtml}</div>
                    <p id="gg-action-status" class="form-status"></p>
                </div>`;

            const historyBtn = document.getElementById('gg-modal-history');
            if (historyBtn) {
                historyBtn.style.display = hasHistory ? '' : 'none';
                historyBtn.onclick = () => showEditHistory(g, id);
            }

            bindDetailActions(g, id);
        } catch {
            content.innerHTML = '<p style="color:red;">載入失敗，請稍後再試</p>';
        }
    }

    // ---- 編輯紀錄 ----
    function showEditHistory(g, id) {
        const historyBtn = document.getElementById('gg-modal-history');
        if (historyBtn) historyBtn.style.display = 'none';
        const content = document.getElementById('gg-modal-content');
        if (!content) return;
        const list = g.edit_history || [];
        content.innerHTML = `
            <div class="gg-detail">
                <div class="gg-detail-header">
                    <h2>編輯紀錄</h2>
                </div>
                ${list.length === 0 ? '<p class="gg-empty">尚無編輯紀錄</p>' : list.map(h => `
                    <div class="gg-history-entry">
                        <div class="gg-history-time">${formatDeadline(h.edited_at)}</div>
                        ${h.changes.map(c => `
                            <div class="gg-history-change">
                                <span class="gg-history-field">${escapeHtml(c.label)}</span>
                                <span class="gg-history-old">${escapeHtml(c.old)}</span>
                                <span class="gg-history-arrow">→</span>
                                <span class="gg-history-new">${escapeHtml(c.new)}</span>
                            </div>`).join('')}
                    </div>`).join('')}
                <button class="cta-button" id="gg-history-back-btn" style="margin-top:16px; background: var(--color-text-secondary);">← 返回</button>
            </div>`;
        document.getElementById('gg-history-back-btn')?.addEventListener('click', () => showDetail(id));
    }

    // ---- 編輯揪團 ----
    function showEditForm(g, id) {
        const historyBtn = document.getElementById('gg-modal-history');
        if (historyBtn) historyBtn.style.display = 'none';
        const content = document.getElementById('gg-modal-content');
        if (!content) return;

        const [deadlineDatePart, deadlineTimePart] = (g.deadline || '').split(' ');
        const deadlineHourPart = (deadlineTimePart || '').substring(0, 2);
        const hasLimit = !!g.max_participants;
        const startOptions = GATHER_TIME_SLOTS.map(t =>
            `<option value="${t}" ${t === g.start_time ? 'selected' : ''}>${t}</option>`).join('');
        const deadlineHourOptions = ['08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23']
            .map(h => `<option value="${h}" ${h === deadlineHourPart ? 'selected' : ''}>${h}:00</option>`).join('');
        const gameList = (g.games && g.games.length ? g.games : [{}]);

        content.innerHTML = `
            <div class="gg-detail">
                <div class="gg-detail-header"><h2>編輯揪團</h2></div>
                <form id="ge-form">
                    <div class="input-group">
                        <label>揪團名稱</label>
                        <input type="text" id="ge-name" maxlength="20" required value="${escapeHtml(g.name || '')}">
                    </div>
                    <div class="input-group">
                        <label>活動日期</label>
                        <input type="date" id="ge-date" required value="${g.event_date}">
                    </div>
                    <div class="input-group">
                        <label>開始 / 預計結束時間</label>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <select id="ge-start-time" required class="gc-select" style="flex:1;">
                                <option value="">請選擇開始時間</option>${startOptions}
                            </select>
                            <span>–</span>
                            <select id="ge-end-time" required class="gc-select" style="flex:1;"></select>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>報名截止時間</label>
                        <div class="gc-deadline-row">
                            <input type="date" id="ge-deadline-date" required value="${deadlineDatePart || ''}">
                            <select id="ge-deadline-hour" required class="gc-select">
                                <option value="">時</option>${deadlineHourOptions}
                            </select>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>人數上限</label>
                        <div class="gather-limit-row">
                            <button type="button" class="gather-limit-btn ge-limit-btn ${hasLimit ? 'active' : ''}" data-limit="yes">有限制</button>
                            <button type="button" class="gather-limit-btn ge-limit-btn ${hasLimit ? '' : 'active'}" data-limit="no">不限制</button>
                        </div>
                        <input type="number" id="ge-max-participants" min="1" max="50" placeholder="最多幾人（含團主）"
                            style="margin-top:8px; display:${hasLimit ? 'block' : 'none'};" value="${g.max_participants || ''}">
                    </div>
                    <div class="input-group">
                        <label>遊戲選擇（最多 3 款）</label>
                        <div id="ge-games-container">
                            ${gameList.map(game => `<div class="gc-game-slot">${gameSlotHtml(game)}</div>`).join('')}
                        </div>
                        <button type="button" id="ge-add-game-btn" class="gather-add-game-btn">＋ 新增遊戲</button>
                    </div>
                    <div class="input-group">
                        <label>說明備註</label>
                        <textarea id="ge-note" rows="3" placeholder="有什麼想讓大家知道的嗎？">${escapeHtml(g.note || '')}</textarea>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:16px;">
                        <button type="submit" class="cta-button" style="flex:2;">儲存變更</button>
                        <button type="button" id="ge-cancel-btn" class="cta-button" style="flex:1; background:var(--color-text-secondary);">取消</button>
                    </div>
                </form>
                <p id="ge-status" class="form-status"></p>
            </div>`;

        const gamesContainer = document.getElementById('ge-games-container');
        const addGameBtn = document.getElementById('ge-add-game-btn');
        bindAddGameBtn(addGameBtn, gamesContainer);
        gamesContainer.querySelectorAll('.gc-remove-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.gc-game-slot').remove();
                addGameBtn.style.display = gamesContainer.children.length >= 3 ? 'none' : '';
            });
        });

        const startTimeEl = document.getElementById('ge-start-time');
        const endTimeEl = document.getElementById('ge-end-time');
        bindEndTimeFilter(startTimeEl, endTimeEl);
        if (g.end_time) endTimeEl.value = g.end_time;

        const dateEl = document.getElementById('ge-date');
        const deadlineDateEl = document.getElementById('ge-deadline-date');
        bindDeadlineDateConstraints(dateEl, deadlineDateEl);

        const limitBtns = content.querySelectorAll('.ge-limit-btn');
        limitBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                limitBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('ge-max-participants').style.display = btn.dataset.limit === 'yes' ? 'block' : 'none';
            });
        });

        document.getElementById('ge-cancel-btn').addEventListener('click', () => showDetail(id));

        document.getElementById('ge-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusEl = document.getElementById('ge-status');
            statusEl.textContent = '';

            const games = collectGames(gamesContainer);
            const eventDate = dateEl.value;
            const startTime = startTimeEl.value;
            const endTime = endTimeEl.value;
            const deadlineDate = deadlineDateEl.value;
            const deadlineHour = document.getElementById('ge-deadline-hour').value;

            const check = validateGatherFields({ eventDate, startTime, endTime, deadlineDate, deadlineHour, games });
            if (check.error) {
                statusEl.textContent = check.error;
                statusEl.style.color = '#e74c3c';
                return;
            }

            const hasLimitNow = content.querySelector('.ge-limit-btn.active')?.dataset.limit === 'yes';
            const maxPart = hasLimitNow ? parseInt(document.getElementById('ge-max-participants').value) : null;

            const payload = {
                name: document.getElementById('ge-name').value.trim(),
                event_date: eventDate,
                start_time: startTime,
                end_time: endTime,
                deadline: `${deadlineDate} ${deadlineHour}:00:00`,
                max_participants: maxPart || null,
                games,
                note: document.getElementById('ge-note').value.trim() || null,
            };

            const submitBtn = e.target.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '儲存中...';

            try {
                const res = await fetch(`/api/group-gatherings/${id}/edit`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '儲存失敗');
                statusEl.textContent = '已儲存變更！';
                statusEl.style.color = '#27ae60';
                setTimeout(() => showDetail(id), 1000);
            } catch (err) {
                statusEl.textContent = err.message;
                statusEl.style.color = '#e74c3c';
                submitBtn.disabled = false;
                submitBtn.textContent = '儲存變更';
            }
        });
    }

    function bindDetailActions(g, id) {
        const statusEl = document.getElementById('gg-action-status');
        const setStatus = (msg, isError = false) => {
            if (!statusEl) return;
            statusEl.textContent = msg;
            statusEl.style.color = isError ? '#e74c3c' : '#27ae60';
        };

        const shareBtn = document.getElementById('gg-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const shareUrl = `${location.origin}${location.pathname}#gather-share@${g.share_token}`;
                if (navigator.share) {
                    navigator.share({ title: `${g.organizer_name} 的揪團`, url: shareUrl });
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl).then(() => setStatus('連結已複製！'));
                } else {
                    prompt('複製此連結分享：', shareUrl);
                }
            });
        }

        const editBtn = document.getElementById('gg-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => showEditForm(g, id));
        }

        const joinBtn = document.getElementById('gg-join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                const nicknameForm = document.getElementById('gg-nickname-form');
                const nicknameInput = document.getElementById('gg-nickname-input');
                if (nicknameInput && window.userProfile?.displayName) {
                    nicknameInput.value = window.userProfile.displayName;
                }
                joinBtn.style.display = 'none';
                if (nicknameForm) nicknameForm.style.display = 'block';
            });
        }

        const cancelJoinBtn = document.getElementById('gg-cancel-join-btn');
        if (cancelJoinBtn) {
            cancelJoinBtn.addEventListener('click', () => {
                document.getElementById('gg-nickname-form').style.display = 'none';
                if (joinBtn) joinBtn.style.display = 'block';
            });
        }

        const confirmJoinBtn = document.getElementById('gg-confirm-join-btn');
        if (confirmJoinBtn) {
            confirmJoinBtn.addEventListener('click', async () => {
                const nickname = document.getElementById('gg-nickname-input')?.value.trim();
                if (!nickname) { setStatus('請輸入暱稱', true); return; }
                confirmJoinBtn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/join`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ display_name: nickname }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '報名失敗');
                    setStatus('報名成功！');
                    setTimeout(() => showDetail(id), 1000);
                } catch (err) {
                    setStatus(err.message, true);
                    confirmJoinBtn.disabled = false;
                }
            });
        }

        const leaveBtn = document.getElementById('gg-leave-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', async () => {
                if (!confirm('確定要取消報名嗎？')) return;
                leaveBtn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/leave`, {
                        method: 'POST',
                        headers: authHeaders(),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '取消失敗');
                    setStatus('已取消報名');
                    setTimeout(() => showDetail(id), 1000);
                } catch (err) {
                    setStatus(err.message, true);
                    leaveBtn.disabled = false;
                }
            });
        }

        const selectBtn = document.getElementById('gg-select-members-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', async () => {
                const checks = document.querySelectorAll('.gg-member-check');
                const approved = Array.from(checks).filter(c => c.checked).map(c => c.dataset.uid);
                if (approved.length === 0) {
                    setStatus('請至少選擇一位成員', true);
                    return;
                }
                selectBtn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/select-members`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ approved_member_ids: approved }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '篩選失敗');
                    setStatus('名單已更新！');
                    setTimeout(() => showDetail(id), 1000);
                } catch (err) {
                    setStatus(err.message, true);
                    selectBtn.disabled = false;
                }
            });
        }

        const submitBtn = document.getElementById('gg-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                if (!confirm('確定要提交給店家確認嗎？')) return;
                submitBtn.disabled = true;
                submitBtn.textContent = '提交中...';
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/submit`, {
                        method: 'POST',
                        headers: authHeaders(),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '提交失敗');
                    setStatus('已提交！等待店家審核。');
                    setTimeout(() => showDetail(id), 1500);
                } catch (err) {
                    setStatus(err.message, true);
                    submitBtn.disabled = false;
                    submitBtn.textContent = '提交給店家確認';
                }
            });
        }

        const cancelBtn = document.getElementById('gg-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', async () => {
                if (!confirm('確定要解散此揪團嗎？所有成員將收到通知。')) return;
                cancelBtn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/cancel`, {
                        method: 'POST',
                        headers: authHeaders(),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '解散失敗');
                    setStatus('已解散揪團');
                    setTimeout(() => backToMain(), 1500);
                } catch (err) {
                    setStatus(err.message, true);
                    cancelBtn.disabled = false;
                }
            });
        }

        const reopenBtn = document.getElementById('gg-reopen-btn');
        if (reopenBtn) {
            reopenBtn.addEventListener('click', async () => {
                if (!confirm('確定要重新開放報名嗎？揪團狀態將回到「報名中」。')) return;
                reopenBtn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/reopen`, {
                        method: 'POST',
                        headers: authHeaders(),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '操作失敗');
                    setStatus('已重新開放報名');
                    setTimeout(() => showDetail(id), 1000);
                } catch (err) {
                    setStatus(err.message, true);
                    reopenBtn.disabled = false;
                }
            });
        }

        const waitlistEl = document.getElementById('gg-waitlist');
        if (waitlistEl) {
            waitlistEl.addEventListener('click', async (e) => {
                const btn = e.target.closest('.gg-approve-member-btn');
                if (!btn) return;
                const uid = btn.dataset.uid;
                btn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/approve-member`, {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify({ user_id: uid }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '補位失敗');
                    setStatus('已批准補位');
                    setTimeout(() => showDetail(id), 800);
                } catch (err) {
                    setStatus(err.message, true);
                    btn.disabled = false;
                }
            });
        }

    }

    // ---- 我的揪團 ----
    function isGatheringPast(g) {
        if (g.status === 'failed' || g.status === 'cancelled') return true;
        if (g.status === 'approved') {
            const today = new Date().toISOString().slice(0, 10);
            return g.event_date < today;
        }
        return false;
    }

    function renderMySection(activeEl, pastToggleEl, pastContainerEl, list, emptyMsg) {
        const active = list.filter(g => !isGatheringPast(g));
        const past   = list.filter(g =>  isGatheringPast(g));

        activeEl.innerHTML = active.length === 0
            ? `<p class="gg-empty">${emptyMsg}</p>`
            : active.map(g => renderGatherCard(g, true)).join('');

        if (!pastToggleEl || !pastContainerEl) return;

        if (past.length > 0) {
            pastToggleEl.style.display = 'block';
            pastContainerEl.innerHTML = past.map(g => renderGatherCard(g, true)).join('');
            if (!pastToggleEl.dataset.l) {
                pastToggleEl.dataset.l = '1';
                pastToggleEl.addEventListener('click', () => {
                    const open = pastContainerEl.style.display === 'flex';
                    pastContainerEl.style.display = open ? 'none' : 'flex';
                    pastToggleEl.textContent = open ? '顯示過往揪團 ▾' : '收起過往揪團 ▴';
                });
            }
        } else {
            pastToggleEl.style.display = 'none';
            pastContainerEl.style.display = 'none';
        }
    }

    async function showMyGatherings() {
        const mainView = document.getElementById('gather-main-view');
        const myView = document.getElementById('gather-my-view');
        if (!mainView || !myView) return;

        mainView.style.display = 'none';
        myView.style.display = 'block';

        const organizedEl        = document.getElementById('gather-my-organized-container');
        const joinedEl           = document.getElementById('gather-my-joined-container');
        const pastOrgToggle      = document.getElementById('gg-my-past-organized-toggle');
        const pastOrgContainer   = document.getElementById('gg-my-past-organized-container');
        const pastJoinToggle     = document.getElementById('gg-my-past-joined-toggle');
        const pastJoinContainer  = document.getElementById('gg-my-past-joined-container');

        organizedEl.innerHTML = '<p style="text-align:center;">載入中...</p>';
        joinedEl.innerHTML = '<p style="text-align:center;">載入中...</p>';

        try {
            const res = await fetch('/api/group-gatherings/my', { headers: authHeaders() });
            if (!res.ok) {
                organizedEl.innerHTML = '<p class="gg-empty">請先登入</p>';
                joinedEl.innerHTML = '';
                return;
            }
            const { organized, joined } = await res.json();

            renderMySection(organizedEl, pastOrgToggle, pastOrgContainer, organized, '尚未發起過揪團');
            renderMySection(joinedEl, pastJoinToggle, pastJoinContainer, joined, '尚未報名過揪團');
        } catch {
            organizedEl.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗</p>';
            joinedEl.innerHTML = '';
        }
    }

    // ---- 揪團表單共用工具（建立/編輯共用）----
    const GATHER_TIME_SLOTS = [
        '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
        '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30',
        '20:00','20:30','21:00','21:30','22:00'
    ];

    function gameSlotHtml(game = {}) {
        return `
            <input type="text" class="gc-game-name" placeholder="遊戲名稱" value="${escapeHtml(game.name || '')}">
            <label class="gc-game-tag-label"><input type="checkbox" class="gc-game-played" ${game.has_played ? 'checked' : ''}> 有玩過</label>
            <label class="gc-game-tag-label"><input type="checkbox" class="gc-game-beginner" ${game.beginner_friendly ? 'checked' : ''}> 適合新手</label>
            <button type="button" class="gc-remove-game-btn">✕</button>`;
    }

    function collectGames(containerEl) {
        return Array.from(containerEl.querySelectorAll('.gc-game-slot'))
            .map(slot => ({
                name: slot.querySelector('.gc-game-name')?.value.trim() || '',
                has_played: slot.querySelector('.gc-game-played')?.checked || false,
                beginner_friendly: slot.querySelector('.gc-game-beginner')?.checked || false,
            }))
            .filter(g => g.name);
    }

    function bindAddGameBtn(addBtn, containerEl) {
        function syncAddBtn() {
            addBtn.style.display = containerEl.children.length >= 3 ? 'none' : '';
        }
        addBtn.addEventListener('click', () => {
            if (containerEl.children.length >= 3) return;
            const slot = document.createElement('div');
            slot.className = 'gc-game-slot';
            slot.innerHTML = gameSlotHtml();
            slot.querySelector('.gc-remove-game-btn').addEventListener('click', () => {
                slot.remove();
                syncAddBtn();
            });
            containerEl.appendChild(slot);
            syncAddBtn();
        });
        syncAddBtn();
    }

    function bindEndTimeFilter(startTimeEl, endTimeEl) {
        function update() {
            const start = startTimeEl?.value;
            const currentEnd = endTimeEl?.value;
            if (!endTimeEl) return;
            endTimeEl.innerHTML = '<option value="">請選擇結束時間</option>';
            GATHER_TIME_SLOTS.forEach(t => {
                if (!start || t > start) {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    if (t === currentEnd) opt.selected = true;
                    endTimeEl.appendChild(opt);
                }
            });
        }
        if (startTimeEl) startTimeEl.addEventListener('change', update);
        update();
    }

    function bindDeadlineDateConstraints(dateEl, deadlineDateEl) {
        const today = new Date().toISOString().split('T')[0];
        dateEl.min = today;
        deadlineDateEl.min = today;
        function syncMax() {
            const eventDate = dateEl.value;
            if (eventDate) {
                const dayBefore = new Date(eventDate);
                dayBefore.setDate(dayBefore.getDate() - 1);
                deadlineDateEl.max = dayBefore.toISOString().split('T')[0];
                if (deadlineDateEl.value >= eventDate) deadlineDateEl.value = '';
            } else {
                deadlineDateEl.max = '';
            }
        }
        dateEl.addEventListener('change', syncMax);
        syncMax();
    }

    function validateGatherFields({ eventDate, startTime, endTime, deadlineDate, deadlineHour, games }) {
        if (games.length === 0) return { error: '請至少填寫一款遊戲名稱' };
        if (endTime && startTime && endTime <= startTime) return { error: '預計結束時間必須晚於開始時間' };
        const deadlineDateTime = new Date(`${deadlineDate}T${deadlineHour}:00:00`);
        if (deadlineDateTime <= new Date()) return { error: '報名截止時間不能早於現在' };
        if (deadlineDate >= eventDate) return { error: '報名截止日期不能與活動日期相同或更晚' };
        return { ok: true };
    }

    // ---- 建立揪團 ----
    function showCreateForm() {
        document.getElementById('gather-main-view').style.display = 'none';
        document.getElementById('gather-create-view').style.display = 'block';

        // 每次重新打開發起揪團表單，都要清掉上一次送出殘留的狀態（成功訊息、被鎖住的送出按鈕），
        // 否則連續發起第二個揪團時，畫面還停在上次的「揪團發布成功！」、送出按鈕也還是鎖住的，點了沒反應
        const statusEl = document.getElementById('gather-create-status');
        if (statusEl) statusEl.textContent = '';
        const submitBtn = document.getElementById('gather-create-form')?.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '發布揪團';
        }
    }

    function initCreateForm() {
        const form = document.getElementById('gather-create-form');
        if (!form || form.dataset.l) return;
        form.dataset.l = '1';

        const addGameBtn = document.getElementById('gc-add-game-btn');
        const gamesContainer = document.getElementById('gc-games-container');
        if (addGameBtn && gamesContainer) bindAddGameBtn(addGameBtn, gamesContainer);

        const limitBtns = document.querySelectorAll('.gather-limit-btn');
        limitBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                limitBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const maxInput = document.getElementById('gc-max-participants');
                maxInput.style.display = btn.dataset.limit === 'yes' ? 'block' : 'none';
            });
        });

        // 結束時間動態過濾：只顯示晚於開始時間的選項
        const startTimeEl = document.getElementById('gc-start-time');
        const endTimeEl = document.getElementById('gc-end-time');
        bindEndTimeFilter(startTimeEl, endTimeEl);

        // 活動日期 / 截止日期不能選過去，且截止日期不能晚於活動日期
        const gcDateEl = document.getElementById('gc-date');
        const gcDeadlineDateEl = document.getElementById('gc-deadline-date');
        if (gcDateEl && gcDeadlineDateEl) bindDeadlineDateConstraints(gcDateEl, gcDeadlineDateEl);

        form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const statusEl = document.getElementById('gather-create-status');
                statusEl.textContent = '';

                if (!getLiffToken()) {
                    statusEl.textContent = '請先登入 LINE 才能發起揪團';
                    statusEl.style.color = '#e74c3c';
                    return;
                }

                const games = collectGames(gamesContainer);
                const eventDate = document.getElementById('gc-date').value;
                const startTime = document.getElementById('gc-start-time').value;
                const endTime = document.getElementById('gc-end-time').value;
                const deadlineDate = document.getElementById('gc-deadline-date').value;
                const deadlineHour = document.getElementById('gc-deadline-hour').value;

                const check = validateGatherFields({ eventDate, startTime, endTime, deadlineDate, deadlineHour, games });
                if (check.error) {
                    statusEl.textContent = check.error;
                    statusEl.style.color = '#e74c3c';
                    return;
                }

                const hasLimit = document.querySelector('.gather-limit-btn.active')?.dataset.limit === 'yes';
                const maxPart = hasLimit ? parseInt(document.getElementById('gc-max-participants').value) : null;

                const payload = {
                    name: document.getElementById('gc-name').value.trim(),
                    event_date: eventDate,
                    start_time: startTime,
                    end_time: endTime,
                    deadline: `${deadlineDate} ${deadlineHour}:00:00`,
                    max_participants: maxPart || null,
                    games,
                    note: document.getElementById('gc-note').value.trim() || null,
                };

                const submitBtn = form.querySelector('[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = '發布中...';

                try {
                    const res = await fetch('/api/group-gatherings/create', {
                        method: 'POST',
                        headers: authHeaders(),
                        body: JSON.stringify(payload),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '發布失敗');

                    statusEl.textContent = '揪團發布成功！';
                    statusEl.style.color = '#27ae60';
                    form.reset();
                    submitBtn.disabled = false;
                    submitBtn.textContent = '發布揪團';
                    setTimeout(() => setGatherSubView('gather-main'), 1500);
                } catch (err) {
                    statusEl.textContent = err.message;
                    statusEl.style.color = '#e74c3c';
                    submitBtn.disabled = false;
                    submitBtn.textContent = '發布揪團';
                }
            });
    }

    // ---- 分享連結進入 ----
    async function handleShareLink(token) {
        try {
            const res = await fetch(`/api/group-gatherings/share/${token}`);
            const g = await res.json();
            if (!res.ok) throw new Error(g.error || '找不到此揪團');
            showDetail(g.id);
        } catch (err) {
            const overlay = document.getElementById('gg-modal-overlay');
            const content = document.getElementById('gg-modal-content');
            if (overlay && content) {
                content.innerHTML = `<p style="color:red;">${err.message}</p>`;
                overlay.style.display = 'flex';
            }
        }
    }

    // ---- 彈窗關閉 ----
    function closeModal() {
        const overlay = document.getElementById('gg-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    // ---- 返回主畫面 ----
    function backToMain() {
        closeModal();
        const views = ['gather-create-view', 'gather-my-view'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const main = document.getElementById('gather-main-view');
        if (main) main.style.display = 'block';
    }

    function activateBookingTab(tabId) {
        const scope = document.querySelector('.booking-tab-bar')?.parentElement;
        if (!scope) return;
        scope.querySelectorAll('.booking-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        scope.querySelectorAll('.booking-tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
        const titleEl = document.getElementById('booking-page-title');
        if (titleEl) titleEl.textContent = tabId === 'booking-tab-gather' ? '桌遊揪團' : '場地預約';
    }

    // 統一管理「場地預約／揪團桌遊」分頁切換，以及揪團分頁內的子畫面（列表／我的揪團／發起揪團），
    // 並同步瀏覽器歷史紀錄，讓手機返回鍵可以照原路一步步返回，而不是直接跳出 App。
    function setGatherSubView(view, push = true) {
        if (view === 'reserve') {
            activateBookingTab('booking-tab-reserve');
            window.initBookingDatepicker?.();
        } else {
            activateBookingTab('booking-tab-gather');
            if (view === 'gather-my') {
                showMyGatherings();
            } else if (view === 'gather-create') {
                showCreateForm();
            } else {
                backToMain();
                loadList();
            }
        }
        if (push) history.pushState({ gatherSubView: view }, '', location.href);
    }

    window.addEventListener('popstate', e => {
        // 只有「明確帶有 gatherSubView 記錄」的歷史紀錄才由這裡處理分頁切換。
        // 場地預約流程（選日期/時段等）是靠 hash 切換頁面，那些歷史紀錄不會有 gatherSubView，
        // 之前預設一律跳回「gather-main」，導致預約流程中任何一次 popstate 都會被誤判成要跳回揪團分頁。
        if (e.state && e.state.gatherSubView) {
            setGatherSubView(e.state.gatherSubView, false);
        }
    });

    // ---- 初始化（在 booking 頁面載入時呼叫）----
    let delegationSetup = false;
    function init() {
        // document 層級的事件委派只需設定一次（跨 DOM 重建存活）
        if (!delegationSetup) {
            delegationSetup = true;

            document.addEventListener('click', e => {
                // 分頁切換
                const tabBtn = e.target.closest('.booking-tab-btn');
                if (tabBtn) {
                    setGatherSubView(tabBtn.dataset.tab === 'booking-tab-gather' ? 'gather-main' : 'reserve');
                }

                // 彈窗關閉（點背景或 ✕ 按鈕）
                if (e.target.id === 'gg-modal-overlay' || e.target.id === 'gg-modal-close') {
                    closeModal();
                }

                // 揪團卡片點擊
                const card = e.target.closest('.gg-card[data-id]');
                if (card) {
                    const activeTab = document.querySelector('.booking-tab-content.active');
                    if (activeTab && activeTab.id === 'booking-tab-gather') {
                        showDetail(card.dataset.id);
                    }
                }
            });
        }

        // 綁定按鈕：用 data-l 防止 DOM 未重建時重複綁定
        const bindOnce = (id, handler) => {
            const el = document.getElementById(id);
            if (el && !el.dataset.l) { el.dataset.l = '1'; el.addEventListener('click', handler); }
        };
        bindOnce('gather-create-btn', () => setGatherSubView('gather-create'));
        bindOnce('gather-my-btn', () => setGatherSubView('gather-my'));

        const pastToggle = document.getElementById('gg-past-toggle');
        const pastContainer = document.getElementById('gg-past-container');
        if (pastToggle && pastContainer && !pastToggle.dataset.l) {
            pastToggle.dataset.l = '1';
            let pastLoaded = false;
            let pastOpen = false;
            pastToggle.addEventListener('click', async () => {
                pastOpen = !pastOpen;
                pastContainer.style.display = pastOpen ? 'flex' : 'none';
                pastToggle.textContent = pastOpen ? '收起過往揪團 ▴' : '顯示過往揪團 ▾';
                if (pastOpen && !pastLoaded) {
                    pastContainer.innerHTML = '<p class="gg-empty">載入中...</p>';
                    try {
                        const res = await fetch('/api/group-gatherings/list?past=1');
                        const list = await res.json();
                        pastLoaded = true;
                        if (!Array.isArray(list) || list.length === 0) {
                            pastContainer.innerHTML = '<p class="gg-empty">目前沒有過往揪團記錄</p>';
                        } else {
                            pastContainer.innerHTML = list.map(g => renderGatherCard(g)).join('');
                        }
                    } catch {
                        pastContainer.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗</p>';
                    }
                }
            });
        }

        initDatePicker();
        const gameInput = document.getElementById('gg-filter-game');
        if (gameInput && !gameInput.dataset.l) {
            gameInput.dataset.l = '1';
            gameInput.addEventListener('input', () => { filterGame = gameInput.value.trim(); applyFilters(); });
        }
        const beginnerBtn = document.getElementById('gg-filter-beginner');
        if (beginnerBtn && !beginnerBtn.dataset.l) {
            beginnerBtn.dataset.l = '1';
            beginnerBtn.addEventListener('click', () => {
                filterBeginner = !filterBeginner;
                beginnerBtn.classList.toggle('active', filterBeginner);
                applyFilters();
            });
        }

        initCreateForm();

        // 只在揪團桌遊 tab 可見時才載入列表
        if (document.getElementById('booking-tab-gather')?.classList.contains('active')) {
            loadList();
        }

        // 處理分享連結 hash
        const hash = location.hash.substring(1);
        if (hash.startsWith('gather-share@')) {
            const token = hash.split('@')[1];
            const ac = document.getElementById('app-content');
            ac.querySelectorAll('.booking-tab-btn').forEach(b => b.classList.remove('active'));
            ac.querySelectorAll('.booking-tab-content').forEach(c => c.classList.remove('active'));
            ac.querySelector('[data-tab="booking-tab-gather"]')?.classList.add('active');
            ac.querySelector('#booking-tab-gather')?.classList.add('active');
            handleShareLink(token);
        }
    }

    async function renderMyPage(organizedEl, joinedEl) {
        if (!organizedEl || !joinedEl) return;
        organizedEl.innerHTML = '<p style="text-align:center;">載入中...</p>';
        joinedEl.innerHTML    = '<p style="text-align:center;">載入中...</p>';

        let organized = [], joined = [];
        try {
            const res = await fetch('/api/group-gatherings/my', { headers: authHeaders() });
            if (!res.ok) throw new Error('auth');
            const data = await res.json();
            organized = data.organized || [];
            joined    = data.joined    || [];
        } catch (err) {
            const msg = err.message === 'auth'
                ? '<p class="gg-empty">請先登入</p>'
                : '<p class="gg-empty" style="color:red;">載入失敗</p>';
            organizedEl.innerHTML = msg;
            joinedEl.innerHTML    = msg;
            return;
        }

        const pastOrgToggle     = document.getElementById('my-gatherings-past-organized-toggle');
        const pastOrgContainer  = document.getElementById('my-gatherings-past-organized-container');
        const pastJoinToggle    = document.getElementById('my-gatherings-past-joined-toggle');
        const pastJoinContainer = document.getElementById('my-gatherings-past-joined-container');

        try {
            renderMySection(organizedEl, pastOrgToggle, pastOrgContainer, organized, '尚未發起過揪團');
        } catch {
            organizedEl.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗</p>';
        }
        try {
            renderMySection(joinedEl, pastJoinToggle, pastJoinContainer, joined, '尚未報名過揪團');
        } catch {
            joinedEl.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗</p>';
        }
        startCountdownTimer();
    }

    // ---- 未讀編輯提醒彈窗 ----
    async function checkUnreadEdits() {
        if (!getLiffToken()) return;
        try {
            const res = await fetch('/api/group-gatherings/unread-edits', { headers: authHeaders() });
            if (!res.ok) return;
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) showUnreadEditPopup(list);
        } catch {}
    }

    function showUnreadEditPopup(list) {
        const overlay = document.createElement('div');
        overlay.id = 'gg-unread-edit-overlay';
        overlay.innerHTML = `
            <div id="gg-unread-edit-card">
                <h3>⏰ 你參加的揪團有更新</h3>
                ${list.map(item => `
                    <div class="gg-history-entry">
                        <div class="gg-history-time">${escapeHtml(item.name || (item.organizer_name + ' 的揪團'))}（${item.event_date} ${item.start_time}）</div>
                        ${item.edits.map(ed => ed.changes.map(c => `
                            <div class="gg-history-change">
                                <span class="gg-history-field">${escapeHtml(c.label)}</span>
                                <span class="gg-history-old">${escapeHtml(c.old)}</span>
                                <span class="gg-history-arrow">→</span>
                                <span class="gg-history-new">${escapeHtml(c.new)}</span>
                            </div>`).join('')).join('')}
                    </div>`).join('')}
                <button class="cta-button" id="gg-unread-edit-close-btn" style="margin-top:16px; width:100%;">知道了</button>
            </div>`;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        document.getElementById('gg-unread-edit-close-btn').addEventListener('click', async () => {
            overlay.remove();
            document.body.style.overflow = '';
            await Promise.all(list.map(item =>
                fetch(`/api/group-gatherings/${item.gathering_id}/mark-edits-seen`, {
                    method: 'POST',
                    headers: authHeaders(),
                }).catch(() => {})
            ));
        });
    }

    return { init, renderMyPage, showDetail, checkUnreadEdits };
})();

// 等待 booking 頁面初始化後再掛載
// script.js 的 initializeBookingPage 執行後，揪團 tab 才存在於 DOM
document.addEventListener('gather-page-ready', () => {
    GatherModule.init();
});
