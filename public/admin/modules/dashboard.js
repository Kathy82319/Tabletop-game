// public/admin/modules/dashboard.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 渲染儀表板的統計數據
const renderStats = (stats) => {
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    updateText('stat-today-guests', stats.today_total_guests || 0);
    updateText('stat-outstanding-rentals', stats.outstanding_rentals_count || 0);
    updateText('stat-due-today', stats.due_today_rentals_count || 0);
};

// 載入並渲染最新動態
async function loadAndRenderActivities() {
    const container = document.getElementById('activity-feed-container');
    const badge = document.getElementById('activity-count-badge');
    if (!container || !badge) return;

    try {
        // 注意：我們還沒有建立這個 API，下一步會建立
        const activities = await api.getActivities(); 

        if (activities && activities.length > 0) {
            badge.textContent = `${activities.length} 則未讀`;
            badge.style.display = 'inline-block';
            container.innerHTML = activities.map(act => `
                <div class="activity-item" data-id="${act.activity_id}" style="padding: 0.8rem 0.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem; opacity: 1; transition: opacity 0.5s ease; text-align: left;">
                    <div style="flex-shrink: 0;">
                        <input type="checkbox" class="mark-activity-read" title="標示為已讀">
                    </div>
                    <div style="flex-grow: 1;">
                        <p style="margin: 0; font-weight: 500;">${act.message}</p>
                        <small style="color: var(--text-light);">${new Date(act.created_at).toLocaleString()}</small>
                    </div>
                </div>
            `).join('');

            // 為核取方塊綁定事件
            container.querySelectorAll('.mark-activity-read').forEach(checkbox => {
                checkbox.addEventListener('change', async (e) => {
                    const item = e.target.closest('.activity-item');
                    const activityId = Number(item.dataset.id);
                    if (e.target.checked) {
                        try {
                            e.target.disabled = true;
                            // 注意：我們還沒有建立這個 API，下一步會建立
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

// 綁定儀表板卡片的點擊跳轉事件
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
                window.location.hash = '#rentals';
                // 我們稍後會在 rentalManagement.js 中實作篩選器邏輯
            } else if (target === 'rentals-due-today') {
                window.location.hash = '#rentals';
            }
        });
        dashboardGrid.dataset.listenerAttached = 'true';
    }
};

// 模組的初始化函式，由 app.js 呼叫
export const init = async () => {
    const page = document.getElementById('page-dashboard');
    if (!page) return;

    // 重置顯示
    const guestsEl = document.getElementById('stat-today-guests');
    if (guestsEl) guestsEl.textContent = '讀取中...';

    try {
        const stats = await api.getDashboardStats();
        renderStats(stats);
        setupEventListeners();
        await loadAndRenderActivities();
    } catch (error) {
        console.error('獲取儀表板數據失敗:', error);
        if (guestsEl) {
            guestsEl.textContent = '讀取失敗';
            guestsEl.style.color = 'var(--danger-color)';
        }
    }
};