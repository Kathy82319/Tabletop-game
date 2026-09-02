// public/admin/modules/dashboard.js
import { api } from '../api.js';
import { ui } from '../ui.js';

const renderStats = (stats) => {
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    updateText('stat-today-guests', stats.today_total_guests ?? 0);
    updateText('stat-outstanding-rentals', stats.outstanding_rentals_count ?? 0);
    updateText('stat-due-today', stats.due_today_rentals_count ?? 0);
    updateText('stat-pending-gatherings', stats.pending_gatherings_count ?? 0);
    updateText('stat-new-members', stats.new_members_this_month ?? 0);
    updateText('stat-total-members', `共 ${stats.total_members ?? 0} 位會員`);
};

// ---- 動態類別判斷 ----
function getActivityCategory(message) {
    if (/預約/.test(message)) return { label: '預約', cls: 'badge-booking' };
    if (/租借|歸還/.test(message)) return { label: '租借', cls: 'badge-rental' };
    if (/揪團/.test(message)) return { label: '揪團', cls: 'badge-gathering' };
    if (/會員|新顧客|加入/.test(message)) return { label: '會員', cls: 'badge-member' };
    return { label: '系統', cls: 'badge-system' };
}

// ---- 動態列表渲染 ----
let currentTab = 'unread';

async function renderActivityFeed() {
    const container = document.getElementById('activity-feed-container');
    const badge = document.getElementById('activity-count-badge');
    if (!container) return;

    container.innerHTML = '<div style="padding:1.5rem; text-align:center; color:var(--text-light); font-size:0.88rem;">載入中...</div>';

    try {
        const options = {
            timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric',
            day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
        };

        const [unreadData, allData] = await Promise.all([
            api.getActivities(),
            currentTab === 'all' ? api.getAllActivities() : Promise.resolve(null),
        ]);

        const unreadCount = unreadData?.length || 0;
        if (unreadCount > 0) {
            badge.textContent = `${unreadCount} 則未讀`;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }

        const data = currentTab === 'all' ? (allData || []) : (unreadData || []);

        if (data.length === 0) {
            container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-light); font-size:0.88rem;">${currentTab === 'unread' ? '沒有未讀的動態消息' : '尚無動態紀錄'}</div>`;
            return;
        }

        container.innerHTML = data.map(act => {
            const cat = getActivityCategory(act.message);
            const time = new Date(act.created_at).toLocaleString('zh-TW', options);
            const isRead = act.is_read === 1;
            return `
            <div class="activity-item${isRead ? ' is-read' : ''}" data-id="${act.activity_id}">
                <div class="activity-item-body">
                    <p>${act.message}</p>
                    <small>${time}</small>
                </div>
                <span class="activity-badge ${cat.cls}">${cat.label}</span>
                ${!isRead ? `<button class="activity-mark-btn" data-id="${act.activity_id}">已讀</button>` : ''}
            </div>`;
        }).join('');

        container.querySelectorAll('.activity-mark-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = Number(e.currentTarget.dataset.id);
                try {
                    btn.disabled = true;
                    await api.markActivityAsRead(id);
                    await renderActivityFeed();
                } catch {
                    btn.disabled = false;
                    ui.toast.error('標示已讀失敗');
                }
            });
        });

    } catch (error) {
        container.innerHTML = `<div style="padding:1rem; color:var(--danger-color); font-size:0.88rem;">載入動態失敗: ${error.message}</div>`;
    }
}

// ---- 貢獻度圖表（按月結算，可手動調整）----
let contributionChartInstance = null;
let currentContributionItems = [];

function currentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function renderContributionChart(items) {
    const canvas = document.getElementById('contribution-chart');
    const emptyMsg = document.getElementById('contribution-chart-empty');
    if (!canvas) return;

    const data = (items || []).filter(d => d.value > 0);
    if (data.length === 0) {
        canvas.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (contributionChartInstance) { contributionChartInstance.destroy(); contributionChartInstance = null; }
        return;
    }
    canvas.style.display = 'block';
    if (emptyMsg) emptyMsg.style.display = 'none';

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const labels = data.map(d => d.name);
    const values = data.map(d => d.value);
    const percentages = data.map(d => ((d.value / total) * 100).toFixed(1));

    const colors = [
        '#4e79a7','#f28e2b','#e15759','#76b7b2',
        '#59a14f','#edc948','#b07aa1','#ff9da7'
    ];

    if (contributionChartInstance) contributionChartInstance.destroy();

    contributionChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '貢獻度',
                data: values,
                backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.parsed.y} 點（佔 ${percentages[ctx.dataIndex]}%）`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 }, grace: '15%' },
                x: { ticks: { font: { size: 13 } } }
            }
        },
        plugins: [{
            id: 'percentageLabels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, i) => {
                    chart.getDatasetMeta(i).data.forEach((bar, idx) => {
                        ctx.fillStyle = '#444';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${percentages[idx]}%`, bar.x, bar.y - 6);
                    });
                });
            }
        }]
    });
}

function renderContributionMonthTable(items) {
    const tbody = document.getElementById('contribution-month-tbody');
    if (!tbody) return;
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#888;">尚無職業資料，請先至「顧客管理 → 會員制度設定 → 職業管理」新增職業。</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td><input type="number" class="contribution-month-value" data-id="${item.id}" value="${item.value}" style="width:100px; box-sizing:border-box;"></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.contribution-month-value').forEach(input => {
        input.addEventListener('input', () => {
            const id = Number(input.dataset.id);
            const item = currentContributionItems.find(i => i.id === id);
            if (item) item.value = Number(input.value) || 0;
            renderContributionChart(currentContributionItems);
        });
    });
}

async function loadContributionMonth(month, live = false) {
    const monthInput = document.getElementById('contribution-month-select');
    if (monthInput) monthInput.value = month;

    try {
        const data = await api.getClassContributionMonth(month, live);
        currentContributionItems = data.items || [];
        renderContributionMonthTable(currentContributionItems);
        renderContributionChart(currentContributionItems);
    } catch (error) {
        console.error('貢獻度圖表載入失敗', error);
    }
}

// ---- 事件綁定 ----
const setupEventListeners = () => {
    const dashboardGrid = document.getElementById('dashboard-grid');
    if (dashboardGrid && !dashboardGrid.dataset.listenerAttached) {
        dashboardGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.stat-card');
            if (!card || !card.dataset.target) return;
            const target = card.dataset.target;
            if (target === 'bookings') window.location.hash = '#bookings';
            else if (target === 'rentals-rented') window.location.hash = '#rentals@rented';
            else if (target === 'rentals-due-today') window.location.hash = '#rentals@due_today';
            else if (target === 'group-gatherings') window.location.hash = '#group-gatherings';
        });
        dashboardGrid.dataset.listenerAttached = 'true';
    }

    // 分頁切換
    document.querySelectorAll('.activity-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.activity-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            renderActivityFeed();
        });
    });

    // 全部已讀
    const markAllBtn = document.getElementById('btn-mark-all-read');
    if (markAllBtn && !markAllBtn.dataset.listenerAttached) {
        markAllBtn.addEventListener('click', async () => {
            try {
                markAllBtn.disabled = true;
                await api.markAllActivitiesAsRead();
                await renderActivityFeed();
                ui.toast.success('已全部標示為已讀');
            } catch {
                ui.toast.error('操作失敗');
            } finally {
                markAllBtn.disabled = false;
            }
        });
        markAllBtn.dataset.listenerAttached = 'true';
    }

    // 職業公會排行：切換月份 / 儲存本月結算
    const monthInput = document.getElementById('contribution-month-select');
    if (monthInput && !monthInput.dataset.listenerAttached) {
        monthInput.addEventListener('change', () => {
            if (monthInput.value) loadContributionMonth(monthInput.value);
        });
        monthInput.dataset.listenerAttached = 'true';
    }

    const refreshMonthBtn = document.getElementById('btn-refresh-contribution-month');
    if (refreshMonthBtn && !refreshMonthBtn.dataset.listenerAttached) {
        refreshMonthBtn.addEventListener('click', async () => {
            const month = monthInput?.value || currentYearMonth();
            refreshMonthBtn.disabled = true;
            try {
                await loadContributionMonth(month, true);
                ui.toast.success('已重新帶入目前的即時貢獻度，記得按「儲存本月結算」才會留住這次的數字');
            } catch {
                ui.toast.error('重新載入失敗');
            } finally {
                refreshMonthBtn.disabled = false;
            }
        });
        refreshMonthBtn.dataset.listenerAttached = 'true';
    }

    const saveMonthBtn = document.getElementById('btn-save-contribution-month');
    if (saveMonthBtn && !saveMonthBtn.dataset.listenerAttached) {
        saveMonthBtn.addEventListener('click', async () => {
            const month = monthInput?.value || currentYearMonth();
            saveMonthBtn.disabled = true;
            try {
                const items = currentContributionItems.map(i => ({ id: i.id, value: i.value }));
                await api.saveClassContributionMonth({ month, items });
                ui.toast.success(`已儲存 ${month} 的職業公會排行`);
            } catch {
                ui.toast.error('儲存失敗');
            } finally {
                saveMonthBtn.disabled = false;
            }
        });
        saveMonthBtn.dataset.listenerAttached = 'true';
    }
};

export const init = async (context, param) => {
    const page = document.getElementById('page-dashboard');
    if (!page) return;

    const guestsEl = document.getElementById('stat-today-guests');
    if (guestsEl) guestsEl.textContent = '...';

    // 重置分頁狀態到未讀
    currentTab = 'unread';
    document.querySelectorAll('.activity-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'unread');
    });

    try {
        const stats = await api.getDashboardStats();
        renderStats(stats);
        await Promise.all([
            loadContributionMonth(document.getElementById('contribution-month-select')?.value || currentYearMonth()),
            renderActivityFeed(),
        ]);
        setupEventListeners();
    } catch (error) {
        console.error('獲取儀表板數據失敗:', error);
        if (guestsEl) {
            guestsEl.textContent = '讀取失敗';
            guestsEl.style.color = 'var(--danger-color)';
        }
    }
};
