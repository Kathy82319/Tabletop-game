// public/admin/modules/dashboard.js
import { api } from '../api.js';
import { ui, parseUtcTimestamp } from '../ui.js';

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// ---- 今日預約名單 ----
const BOOKING_STATUS_LABEL = { confirmed: '預約成功', 'checked-in': '已報到', cancelled: '已取消' };

async function loadTodayBookings() {
    const list = document.getElementById('today-bookings-list');
    if (!list) return;

    try {
        const bookings = await api.getBookings('today');
        if (!bookings || bookings.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:var(--text-light); font-size:0.85rem; margin:0;">今天目前沒有預約。</p>';
            return;
        }

        list.innerHTML = bookings.map(b => {
            const statusLabel = BOOKING_STATUS_LABEL[b.status] || b.status;
            const statusColor = b.status === 'checked-in' ? 'var(--text-light)' : (b.status === 'cancelled' ? 'var(--danger-color)' : 'var(--success-color)');
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-color); ${b.status === 'cancelled' ? 'opacity:0.5;' : ''}">
                    <div>
                        <div style="font-weight:600; font-size:0.9rem;">${escapeHtml(b.contact_name)}</div>
                        <div style="font-size:0.78rem; color:var(--text-light);">${b.time_slot}・${b.num_of_people} 人${b.item ? `・${escapeHtml(b.item)}` : ''}</div>
                    </div>
                    <span style="font-size:0.78rem; font-weight:600; color:${statusColor};">${statusLabel}</span>
                </div>`;
        }).join('');
    } catch (error) {
        list.innerHTML = '<p style="text-align:center; color:var(--danger-color); font-size:0.85rem; margin:0;">載入今日預約失敗。</p>';
    }
}

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
            const time = parseUtcTimestamp(act.created_at).toLocaleString('zh-TW', options);
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
            renderActivityFeed(),
            loadTodayBookings(),
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
