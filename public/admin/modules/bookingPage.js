// public/admin/modules/bookingPage.js
// 「訂位管理」分頁：訂位總表／營業日曆用子分頁切換，各自邏輯沿用原本的模組。
import { init as initBookings } from './bookingManagement.js';
import { init as initBookingHours } from './bookingHours.js';

function setupSubTabs() {
    const page = document.getElementById('page-bookings');
    if (!page || page.dataset.subTabsInitialized) return;
    page.dataset.subTabsInitialized = 'true';

    const subTabs = page.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        btn.onclick = () => {
            subTabs.forEach(b => b.classList.remove('active'));
            page.querySelectorAll('.sub-view-container').forEach(div => div.style.display = 'none');
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).style.display = 'block';
        };
    });
}

export const init = async (context, param) => {
    setupSubTabs();
    await initBookings(context, param);
    await initBookingHours();
};
