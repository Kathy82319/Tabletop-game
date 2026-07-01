// 糾團功能前台邏輯
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

    // ---- 狀態對應 ----
    const STATUS_LABEL = {
        open: '報名中',
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

    function formatDeadline(dt) {
        if (!dt) return '';
        const d = new Date(dt.replace(' ', 'T'));
        return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function renderGameTags(games) {
        if (!games || games.length === 0) return '<span style="color:var(--color-text-secondary);">未指定</span>';
        return games.map(g => {
            const tags = [];
            if (g.has_played) tags.push('<span class="gg-tag gg-tag-played">有玩過</span>');
            if (g.beginner_friendly) tags.push('<span class="gg-tag gg-tag-beginner">適合新手</span>');
            return `<div class="gg-game-row"><strong>${g.name}</strong>${tags.join('')}</div>`;
        }).join('');
    }

    function renderGatherCard(g, showMyStatus = false) {
        const statusLabel = STATUS_LABEL[g.status] || g.status;
        const statusClass = STATUS_CLASS[g.status] || '';
        const maxText = g.max_participants ? `${g.member_count || 0} / ${g.max_participants}` : `${g.member_count || 0} 人`;
        const myBadge = showMyStatus && g.my_status && g.my_status !== 'organizer'
            ? `<span class="gg-my-badge">${g.my_status === 'approved' ? '已通過' : g.my_status === 'rejected' ? '未通過' : '已報名'}</span>` : '';
        const organizerBadge = showMyStatus && g.my_status === 'organizer'
            ? '<span class="gg-my-badge gg-badge-organizer">我是團主</span>' : '';

        return `
        <div class="gg-card" data-id="${g.id}">
            <div class="gg-card-header">
                <div>
                    <span class="gg-status-badge ${statusClass}">${statusLabel}</span>
                    ${myBadge}${organizerBadge}
                </div>
                <span class="gg-organizer">${g.organizer_name}</span>
            </div>
            <div class="gg-card-date">📅 ${g.event_date} ${g.start_time}–${g.end_time}</div>
            <div class="gg-card-games">${g.games.map(gm => gm.name).join(' · ')}</div>
            <div class="gg-card-footer">
                <span>👥 ${maxText}</span>
                <span>截止：${formatDeadline(g.deadline)}</span>
            </div>
        </div>`;
    }

    // ---- 主列表 ----
    async function loadList() {
        const container = document.getElementById('gather-list-container');
        if (!container) return;
        try {
            const res = await fetch('/api/group-gatherings/list');
            const list = await res.json();
            if (!Array.isArray(list) || list.length === 0) {
                container.innerHTML = '<p class="gg-empty">目前沒有開放中的糾團，來發起第一個吧！</p>';
                return;
            }
            container.innerHTML = list.map(g => renderGatherCard(g)).join('');
        } catch {
            container.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗，請稍後再試</p>';
        }
    }

    // ---- 詳情頁 ----
    async function showDetail(id) {
        const mainView = document.getElementById('gather-main-view');
        const detailView = document.getElementById('gather-detail-view');
        const content = document.getElementById('gather-detail-content');
        if (!detailView) return;

        content.innerHTML = '<p style="text-align:center; padding:20px;">載入中...</p>';
        mainView.style.display = 'none';
        detailView.style.display = 'block';

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
            const isFull = hasMemberLimit && memberCount >= g.max_participants;

            const shareUrl = `${location.origin}${location.pathname}#gather-share@${g.share_token}`;

            const membersHtml = (g.members || []).filter(m => m.status !== 'rejected').map(m =>
                `<div class="gg-member-row">
                    <span>👤 ${m.display_name}</span>
                    ${isOrganizer && !hasMemberLimit && (isOpen || isClosed)
                        ? `<input type="checkbox" class="gg-member-check" data-uid="${m.user_id}" ${m.status === 'approved' ? 'checked' : ''}>`
                        : `<span class="gg-member-status">${m.status === 'approved' ? '✓' : ''}</span>`}
                </div>`
            ).join('') || '<p style="color:var(--color-text-secondary);">尚無成員報名</p>';

            let actionsHtml = '';
            if (isOrganizer) {
                if ((isOpen || isClosed) && !isPending) {
                    if (!hasMemberLimit) {
                        actionsHtml += `<button class="cta-button" id="gg-select-members-btn">確認參加名單</button>`;
                    }
                    actionsHtml += `<button class="cta-button" id="gg-submit-btn" style="margin-top:8px;">提交給店家確認</button>`;
                    actionsHtml += `<button class="cta-button" id="gg-cancel-btn" style="margin-top:8px; background:#c0392b;">解散糾團</button>`;
                }
            } else {
                if ((isOpen || isClosed) && beforeDeadline && !isFull && !alreadyJoined && getLiffToken()) {
                    actionsHtml += `<button class="cta-button" id="gg-join-btn">立即報名</button>`;
                } else if (alreadyJoined && (isOpen || isClosed)) {
                    actionsHtml += `<button class="cta-button" id="gg-leave-btn" style="background: var(--color-text-secondary);">取消報名</button>`;
                }
            }

            actionsHtml += `<button class="cta-button" id="gg-share-btn" style="margin-top:8px; background: var(--color-text-secondary);">📤 分享糾團連結</button>`;

            content.innerHTML = `
                <div class="gg-detail">
                    <div class="gg-detail-header">
                        <span class="gg-status-badge ${STATUS_CLASS[g.status] || ''}">${STATUS_LABEL[g.status] || g.status}</span>
                        <h2>${g.organizer_name} 的糾團</h2>
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
                        <span>${hasMemberLimit ? `${memberCount} / ${g.max_participants} 人` : `${memberCount} 人（不限）`}</span>
                    </div>
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">🎲 遊戲</span>
                        <div>${renderGameTags(g.games)}</div>
                    </div>
                    ${g.note ? `<div class="gg-detail-section"><span class="gg-detail-label">📝 備註</span><p>${g.note}</p></div>` : ''}
                    <div class="gg-detail-section">
                        <span class="gg-detail-label">成員列表</span>
                        <div id="gg-members-list">${membersHtml}</div>
                    </div>
                    <div class="gg-actions">${actionsHtml}</div>
                    <p id="gg-action-status" class="form-status"></p>
                </div>`;

            bindDetailActions(g, id);
        } catch {
            content.innerHTML = '<p style="color:red;">載入失敗，請稍後再試</p>';
        }
    }

    function bindDetailActions(g, id) {
        const statusEl = document.getElementById('gg-action-status');
        const setStatus = (msg, isError = false) => {
            if (!statusEl) return;
            statusEl.textContent = msg;
            statusEl.style.color = isError ? '#e74c3c' : '#27ae60';
        };

        const joinBtn = document.getElementById('gg-join-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', async () => {
                joinBtn.disabled = true;
                joinBtn.textContent = '報名中...';
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/join`, {
                        method: 'POST',
                        headers: authHeaders(),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '報名失敗');
                    setStatus('報名成功！');
                    setTimeout(() => showDetail(id), 1000);
                } catch (err) {
                    setStatus(err.message, true);
                    joinBtn.disabled = false;
                    joinBtn.textContent = '立即報名';
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
                if (!confirm('確定要解散此糾團嗎？所有成員將收到通知。')) return;
                cancelBtn.disabled = true;
                try {
                    const res = await fetch(`/api/group-gatherings/${id}/cancel`, {
                        method: 'POST',
                        headers: authHeaders(),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '解散失敗');
                    setStatus('已解散糾團');
                    setTimeout(() => backToMain(), 1500);
                } catch (err) {
                    setStatus(err.message, true);
                    cancelBtn.disabled = false;
                }
            });
        }

        const shareBtn = document.getElementById('gg-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const shareUrl = `${location.origin}${location.pathname}#gather-share@${g.share_token}`;
                if (navigator.share) {
                    navigator.share({ title: `${g.organizer_name} 的糾團`, url: shareUrl });
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl).then(() => setStatus('連結已複製！'));
                } else {
                    prompt('複製此連結分享：', shareUrl);
                }
            });
        }
    }

    // ---- 我的糾團 ----
    async function showMyGatherings() {
        const mainView = document.getElementById('gather-main-view');
        const myView = document.getElementById('gather-my-view');
        if (!myView) return;

        mainView.style.display = 'none';
        myView.style.display = 'block';

        const organizedEl = document.getElementById('gather-my-organized-container');
        const joinedEl = document.getElementById('gather-my-joined-container');
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

            organizedEl.innerHTML = organized.length === 0
                ? '<p class="gg-empty">尚未發起過糾團</p>'
                : organized.map(g => renderGatherCard(g, true)).join('');

            joinedEl.innerHTML = joined.length === 0
                ? '<p class="gg-empty">尚未報名過糾團</p>'
                : joined.map(g => renderGatherCard(g, true)).join('');
        } catch {
            organizedEl.innerHTML = '<p class="gg-empty" style="color:red;">載入失敗</p>';
            joinedEl.innerHTML = '';
        }
    }

    // ---- 建立糾團 ----
    function showCreateForm() {
        document.getElementById('gather-main-view').style.display = 'none';
        document.getElementById('gather-create-view').style.display = 'block';
    }

    function initCreateForm() {
        const form = document.getElementById('gather-create-form');
        if (!form || form.dataset.l) return;
        form.dataset.l = '1';

        const addGameBtn = document.getElementById('gc-add-game-btn');
        if (addGameBtn) {
            addGameBtn.addEventListener('click', () => {
                const container = document.getElementById('gc-games-container');
                if (container.children.length >= 3) {
                    alert('最多只能新增 3 款遊戲');
                    return;
                }
                const slot = document.createElement('div');
                slot.className = 'gc-game-slot';
                slot.innerHTML = `
                    <input type="text" class="gc-game-name" placeholder="遊戲名稱">
                    <label class="gc-game-tag-label"><input type="checkbox" class="gc-game-played"> 有玩過</label>
                    <label class="gc-game-tag-label"><input type="checkbox" class="gc-game-beginner"> 適合新手</label>
                    <button type="button" class="gc-remove-game-btn">✕</button>`;
                slot.querySelector('.gc-remove-game-btn').addEventListener('click', () => slot.remove());
                container.appendChild(slot);
            });
        }

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
        const allTimes = [
            '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
            '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30',
            '20:00','20:30','21:00'
        ];
        const startTimeEl = document.getElementById('gc-start-time');
        const endTimeEl = document.getElementById('gc-end-time');
        function updateEndTimeOptions() {
            const start = startTimeEl?.value;
            const currentEnd = endTimeEl?.value;
            if (!endTimeEl) return;
            endTimeEl.innerHTML = '<option value="">請選擇結束時間</option>';
            allTimes.forEach(t => {
                if (!start || t > start) {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    if (t === currentEnd) opt.selected = true;
                    endTimeEl.appendChild(opt);
                }
            });
        }
        if (startTimeEl) startTimeEl.addEventListener('change', updateEndTimeOptions);
        updateEndTimeOptions();

        // 截止日期最大值：不能晚於活動日期
        const gcDateEl = document.getElementById('gc-date');
        const gcDeadlineDateEl = document.getElementById('gc-deadline-date');
        if (gcDateEl) {
            gcDateEl.addEventListener('change', () => {
                const eventDate = gcDateEl.value;
                if (gcDeadlineDateEl) {
                    if (eventDate) {
                        const dayBefore = new Date(eventDate);
                        dayBefore.setDate(dayBefore.getDate() - 1);
                        const maxDate = dayBefore.toISOString().split('T')[0];
                        gcDeadlineDateEl.max = maxDate;
                        if (gcDeadlineDateEl.value >= eventDate) gcDeadlineDateEl.value = '';
                    } else {
                        gcDeadlineDateEl.max = '';
                    }
                }
            });
        }

        form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const statusEl = document.getElementById('gather-create-status');
                statusEl.textContent = '';

                if (!getLiffToken()) {
                    statusEl.textContent = '請先登入 LINE 才能發起糾團';
                    statusEl.style.color = '#e74c3c';
                    return;
                }

                const gameSlots = document.querySelectorAll('#gc-games-container .gc-game-slot');
                const games = Array.from(gameSlots)
                    .map(slot => ({
                        name: slot.querySelector('.gc-game-name')?.value.trim() || '',
                        has_played: slot.querySelector('.gc-game-played')?.checked || false,
                        beginner_friendly: slot.querySelector('.gc-game-beginner')?.checked || false,
                    }))
                    .filter(g => g.name);

                if (games.length === 0) {
                    statusEl.textContent = '請至少填寫一款遊戲名稱';
                    statusEl.style.color = '#e74c3c';
                    return;
                }

                const eventDate = document.getElementById('gc-date').value;
                const startTime = document.getElementById('gc-start-time').value;
                const endTime = document.getElementById('gc-end-time').value;
                const deadlineDate = document.getElementById('gc-deadline-date').value;
                const deadlineHour = document.getElementById('gc-deadline-hour').value;

                if (endTime && startTime && endTime <= startTime) {
                    statusEl.textContent = '預計結束時間必須晚於開始時間';
                    statusEl.style.color = '#e74c3c';
                    return;
                }
                if (deadlineDate >= eventDate) {
                    statusEl.textContent = '報名截止日期不能與活動日期相同或更晚';
                    statusEl.style.color = '#e74c3c';
                    return;
                }

                const hasLimit = document.querySelector('.gather-limit-btn.active')?.dataset.limit === 'yes';
                const maxPart = hasLimit ? parseInt(document.getElementById('gc-max-participants').value) : null;

                const payload = {
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

                    statusEl.textContent = '糾團發布成功！';
                    statusEl.style.color = '#27ae60';
                    form.reset();
                    setTimeout(() => {
                        backToMain();
                        loadList();
                    }, 1500);
                } catch (err) {
                    statusEl.textContent = err.message;
                    statusEl.style.color = '#e74c3c';
                    submitBtn.disabled = false;
                    submitBtn.textContent = '發布糾團';
                }
            });
    }

    // ---- 分享連結進入 ----
    async function handleShareLink(token) {
        const mainView = document.getElementById('gather-main-view');
        const detailView = document.getElementById('gather-detail-view');
        const content = document.getElementById('gather-detail-content');
        if (!detailView || !content) return;

        mainView.style.display = 'none';
        detailView.style.display = 'block';
        content.innerHTML = '<p style="text-align:center; padding:20px;">載入中...</p>';

        try {
            const res = await fetch(`/api/group-gatherings/share/${token}`);
            const g = await res.json();
            if (!res.ok) {
                content.innerHTML = `<p style="color:red;">${g.error || '找不到此糾團'}</p>`;
                return;
            }
            showDetail(g.id);
        } catch {
            content.innerHTML = '<p style="color:red;">載入失敗，請稍後再試</p>';
        }
    }

    // ---- 返回主畫面 ----
    function backToMain() {
        const views = ['gather-create-view', 'gather-my-view', 'gather-detail-view'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const main = document.getElementById('gather-main-view');
        if (main) main.style.display = 'block';
    }

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
                    const scope = tabBtn.closest('.booking-tab-bar')?.parentElement;
                    if (!scope) return;
                    scope.querySelectorAll('.booking-tab-btn').forEach(b => b.classList.remove('active'));
                    scope.querySelectorAll('.booking-tab-content').forEach(c => c.classList.remove('active'));
                    tabBtn.classList.add('active');
                    scope.querySelector(`#${tabBtn.dataset.tab}`)?.classList.add('active');
                    const titleEl = document.getElementById('booking-page-title');
                    if (titleEl) titleEl.textContent = tabBtn.dataset.tab === 'booking-tab-gather' ? '揪團桌遊' : '場地預約';
                    if (tabBtn.dataset.tab === 'booking-tab-gather') { backToMain(); loadList(); }
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
        bindOnce('gather-create-btn', showCreateForm);
        bindOnce('gather-my-btn', showMyGatherings);

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

    return { init };
})();

// 等待 booking 頁面初始化後再掛載
// script.js 的 initializeBookingPage 執行後，糾團 tab 才存在於 DOM
document.addEventListener('gather-page-ready', () => {
    GatherModule.init();
});
