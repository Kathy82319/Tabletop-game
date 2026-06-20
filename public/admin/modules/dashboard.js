// public/admin/modules/dashboard.js
import { api } from '../api.js';
import { ui } from '../ui.js';

const renderStats = (stats) => {
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    updateText('stat-today-guests', stats.today_total_guests || 0);
    updateText('stat-outstanding-rentals', stats.outstanding_rentals_count || 0);
    updateText('stat-due-today', stats.due_today_rentals_count || 0);
};

async function loadAndRenderActivities() {
    const container = document.getElementById('activity-feed-container');
    const badge = document.getElementById('activity-count-badge');
    if (!container || !badge) return;

    try {
        const activities = await api.getActivities(); 
        const options = {
            timeZone: 'Asia/Taipei',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };

            if (activities && activities.length > 0) {
            badge.textContent = `${activities.length} 則未讀`;
            badge.style.display = 'inline-block';
            container.innerHTML = activities.map(act => {
                const localizedTime = new Date(act.created_at).toLocaleString('zh-TW', options);
                
                return `
                <div class="activity-item" data-id="${act.activity_id}" style="...">
                    <div style="flex-grow: 1;">
                        <p style="margin: 0; font-weight: 500;">${act.message}</p>
                        <small style="color: var(--text-light);">${localizedTime}</small>
                    </div>
                </div>
                `
            }).join('');

            container.querySelectorAll('.mark-activity-read').forEach(checkbox => {
                checkbox.addEventListener('change', async (e) => {
                    const item = e.target.closest('.activity-item');
                    const activityId = Number(item.dataset.id);
                    if (e.target.checked) {
                        try {
                            e.target.disabled = true;
                            await api.markActivityAsRead(activityId); 
                            item.style.opacity = '0.3';
                            ui.toast.success('已標示為已讀');
                        } catch (error) {
                            ui.toast.error(`標示已讀失敗: ${error.message}`);
                            e.target.checked = false;
                            e.target.disabled = false;
                        }
                    }
                });
            });
        } else {
            badge.style.display = 'none';
            container.innerHTML = '<p style="text-align: center; color: var(--text-light);">沒有未讀的動態消息</p>';
        }
    } catch (error) {
        container.innerHTML = `<p style="color: var(--danger-color);">載入動態失敗: ${error.message}</p>`;
    }
}

const setupEventListeners = () => {
    const dashboardGrid = document.getElementById('dashboard-grid');
    if (dashboardGrid && !dashboardGrid.dataset.listenerAttached) {
        dashboardGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.stat-card');
            if (!card || !card.dataset.target) return;

            const target = card.dataset.target;
            if (target === 'bookings') {
                window.location.hash = '#bookings';
            } else if (target === 'rentals-rented') {
                window.location.hash = '#rentals@rented'; // <-- NEW
            } else if (target === 'rentals-due-today') {
                window.location.hash = '#rentals@due_today'; // <-- NEW
            }
        });
        dashboardGrid.dataset.listenerAttached = 'true';
    }
};

export const init = async (context, param) => {
    const page = document.getElementById('page-dashboard');
    if (!page) return;

    const guestsEl = document.getElementById('stat-today-guests');
    if (guestsEl) guestsEl.textContent = '讀取中...';

    try {
        const stats = await api.getDashboardStats();
        renderStats(stats);
        await loadAndRenderActivities(); // 確保動態在數據之後載入
        setupEventListeners();
    } catch (error) {
        console.error('獲取儀表板數據失敗:', error);
        if (guestsEl) {
            guestsEl.textContent = '讀取失敗';
            guestsEl.style.color = 'var(--danger-color)';
        }
    }
};
