// public/admin/modules/expHistory.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allExpHistory = [];
let filteredHistory = [];
let allContribHistory = [];
let filteredContribHistory = [];
let wheelRotation = 0;
let wheelSpinning = false;
let wheelAnimId = null;

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
    updateSpinBtn();
}

function clearFilters() {
    document.getElementById('exp-user-filter-input').value = '';
    document.getElementById('exp-date-start').value = '';
    document.getElementById('exp-date-end').value = '';
    document.getElementById('exp-min-exp').value = '';
    filteredHistory = [...allExpHistory];
    renderExpHistory(filteredHistory);
    updateSpinBtn();
}

function updateSpinBtn() {
    const btn = document.getElementById('exp-spin-btn');
    if (!btn) return;
    const count = getUniqueUsers().length;
    btn.disabled = count < 2;
    btn.title = count < 2 ? '需要至少 2 位使用者' : `從 ${count} 位使用者中抽獎`;
}

function getUniqueUsers() {
    const seen = new Set();
    return filteredHistory.filter(r => {
        if (seen.has(r.user_id)) return false;
        seen.add(r.user_id);
        return true;
    });
}

// ── 轉盤 ─────────────────────────────────────────────────────────────────────

const WHEEL_COLORS = [
    '#4e79a7','#f28e2b','#e15759','#76b7b2',
    '#59a14f','#edc948','#b07aa1','#ff9da7',
    '#9c755f','#bab0ac'
];

function drawWheelCanvas(canvas, segments, rotation) {
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 8;
    const arc = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    segments.forEach((seg, i) => {
        const start = rotation + i * arc - Math.PI / 2;
        const end = start + arc;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = `bold ${segments.length > 8 ? 11 : 13}px sans-serif`;
        const label = seg.length > 8 ? seg.substring(0, 7) + '…' : seg;
        ctx.fillText(label, r - 10, 5);
        ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
}

function openWheelModal() {
    const users = getUniqueUsers();
    if (users.length < 2) return;

    const modal = document.getElementById('wheel-draw-modal');
    const canvas = document.getElementById('wheel-draw-canvas');
    const resultEl = document.getElementById('wheel-draw-result');
    const spinBtn = document.getElementById('wheel-draw-spin-btn');
    const nameListEl = document.getElementById('wheel-name-list');
    const winnersSection = document.getElementById('wheel-winners-section');
    const winnersList = document.getElementById('wheel-winners-list');
    const drawCountInput = document.getElementById('wheel-draw-count');

    let remainingSegments = [];
    let winners = [];
    let drawnCount = 0;
    let totalToDraw = 1;

    function renderNameList() {
        nameListEl.innerHTML = [
            ...winners.map(w =>
                `<li style="padding:8px 12px; border-bottom:1px solid #c8e6c9; background:#e8f5e9; color:#2e7d32; font-weight:bold;">🏆 ${w}</li>`
            ),
            ...remainingSegments.map(s =>
                `<li style="padding:8px 12px; border-bottom:1px solid var(--border-color);">${s.name}</li>`
            )
        ].join('');
    }

    function resetDraw() {
        remainingSegments = users.map(u => ({
            name: u.nickname || u.line_display_name || u.user_id,
            userId: u.user_id
        }));
        winners = [];
        drawnCount = 0;
        totalToDraw = 1;
        wheelRotation = 0;
        wheelSpinning = false;
        if (wheelAnimId) cancelAnimationFrame(wheelAnimId);

        resultEl.style.display = 'none';
        winnersSection.style.display = 'none';
        winnersList.textContent = '';
        drawCountInput.disabled = false;
        drawCountInput.max = users.length;
        drawCountInput.value = 1;
        spinBtn.textContent = '🎡 開始抽獎！';
        spinBtn.disabled = false;
        fastBtn.textContent = '⚡ 快轉';

        renderNameList();
        drawWheelCanvas(canvas, remainingSegments.map(s => s.name), 0);
    }

    const fastBtn = document.getElementById('wheel-draw-fast-btn');

    function finishAllAtOnce() {
        if (wheelSpinning) return;

        if (drawnCount > 0 && drawnCount >= totalToDraw) {
            resetDraw();
            return;
        }

        if (drawnCount === 0) {
            totalToDraw = Math.min(
                Math.max(1, parseInt(drawCountInput.value, 10) || 1),
                remainingSegments.length
            );
            drawCountInput.disabled = true;
        }

        const numToDraw = Math.min(totalToDraw - drawnCount, remainingSegments.length);
        for (let i = 0; i < numToDraw; i++) {
            const idx = Math.floor(Math.random() * remainingSegments.length);
            const winner = remainingSegments.splice(idx, 1)[0];
            winners.push(winner.name);
            drawnCount++;
        }

        resultEl.style.display = 'none';
        winnersSection.style.display = 'block';
        winnersList.textContent = winners.join('、');

        renderNameList();
        if (remainingSegments.length > 0) {
            drawWheelCanvas(canvas, remainingSegments.map(s => s.name), 0);
        }

        spinBtn.textContent = '🔄 重新開始';
        spinBtn.disabled = false;
        fastBtn.textContent = '🔄 重新開始';
    }

    resetDraw();
    modal.style.display = 'flex';

    fastBtn.onclick = finishAllAtOnce;

    spinBtn.onclick = () => {
        if (wheelSpinning) return;

        // "重新開始" 狀態
        if (drawnCount > 0 && drawnCount >= totalToDraw) {
            resetDraw();
            return;
        }

        // 第一次點擊：讀取抽取人數
        if (drawnCount === 0) {
            totalToDraw = Math.min(
                Math.max(1, parseInt(drawCountInput.value, 10) || 1),
                remainingSegments.length
            );
            drawCountInput.disabled = true;
        }

        if (remainingSegments.length === 0) return;

        wheelSpinning = true;
        spinBtn.disabled = true;
        resultEl.style.display = 'none';

        const segments = remainingSegments.map(s => s.name);
        const totalSpins = (5 + Math.random() * 5) * 2 * Math.PI;
        const extraAngle = Math.random() * 2 * Math.PI;
        const targetRotation = wheelRotation + totalSpins + extraAngle;
        const duration = 4000;
        const startRot = wheelRotation;
        const startTime = performance.now();
        const easeOut = t => 1 - Math.pow(1 - t, 3);

        const animate = (now) => {
            const t = Math.min((now - startTime) / duration, 1);
            wheelRotation = startRot + (targetRotation - startRot) * easeOut(t);
            drawWheelCanvas(canvas, segments, wheelRotation);

            if (t < 1) {
                wheelAnimId = requestAnimationFrame(animate);
            } else {
                wheelSpinning = false;
                const arc = (2 * Math.PI) / segments.length;
                const idx = Math.floor((((-wheelRotation / arc) % segments.length) + segments.length) % segments.length);
                const winner = remainingSegments[idx];

                drawnCount++;
                winners.push(winner.name);
                remainingSegments.splice(idx, 1);
                wheelRotation = 0;

                resultEl.textContent = totalToDraw > 1
                    ? `🎉 第 ${drawnCount} 位：${winner.name}`
                    : `🎉 抽中：${winner.name}`;
                resultEl.style.display = 'block';

                winnersSection.style.display = 'block';
                winnersList.textContent = winners.join('、');

                renderNameList();
                if (remainingSegments.length > 0) {
                    drawWheelCanvas(canvas, remainingSegments.map(s => s.name), 0);
                }

                if (drawnCount < totalToDraw && remainingSegments.length > 0) {
                    spinBtn.textContent = `▶ 繼續抽第 ${drawnCount + 1} 位`;
                    spinBtn.disabled = false;
                } else {
                    spinBtn.textContent = '🔄 重新開始';
                    spinBtn.disabled = false;
                }
            }
        };

        wheelAnimId = requestAnimationFrame(animate);
    };
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
    document.getElementById('exp-spin-btn').addEventListener('click', openWheelModal);

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

    document.getElementById('wheel-draw-close-btn').addEventListener('click', () => {
        document.getElementById('wheel-draw-modal').style.display = 'none';
        if (wheelAnimId) cancelAnimationFrame(wheelAnimId);
    });

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
        updateSpinBtn();
        setupEventListeners();
    } catch (e) {
        console.error('載入經驗紀錄失敗:', e);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">載入失敗: ${e.message}</td></tr>`;
    }
};
