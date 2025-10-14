// public/admin/modules/bookingManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let allBookings = [];
let currentView = 'list'; // 'list' or 'calendar'
let currentCalendarDate = new Date();

// DOM 元素
let pageElement, bookingListTbody, calendarViewContainer, listViewContainer,
    calendarGrid, calendarMonthYear, createBookingBtn, manageDatesBtn;

/**
 * 渲染預約列表
 * @param {Array} bookings 要顯示的預約資料
 */
function renderBookingList(bookings) {
    if (!bookingListTbody) return;
    bookingListTbody.innerHTML = '';
    if (bookings.length === 0) {
        bookingListTbody.innerHTML = '<tr><td colspan="5">沒有符合條件的預約紀錄。</td></tr>';
        return;
    }

    bookings.forEach(booking => {
        const row = bookingListTbody.insertRow();
        const statusText = {
            'confirmed': '預約成功',
            'checked-in': '已報到',
            'cancelled': '已取消'
        }[booking.status] || '未知';

        row.innerHTML = `
            <td>${booking.booking_date}<br>${booking.time_slot}</td>
            <td class="compound-cell">
                <div class="main-info">${booking.contact_name}</div>
                <div class="sub-info">${booking.user_id || '現場客'}</div>
            </td>
            <td>${booking.num_of_people}</td>
            <td>${statusText}</td>
            <td class="actions-cell">
                <button class="action-btn btn-check-in" data-booking-id="${booking.booking_id}" style="background-color: var(--success-color);" ${booking.status !== 'confirmed' ? 'disabled' : ''}>報到</button>
                <button class="action-btn btn-cancel-booking" data-booking-id="${booking.booking_id}" style="background-color: var(--danger-color);" ${booking.status === 'cancelled' ? 'disabled' : ''}>取消</button>
            </td>
        `;
    });
}

/**
 * 載入並顯示列表資料
 * @param {string} statusFilter 狀態篩選器
 */
async function loadAndRenderList(statusFilter = 'today') {
    if (!bookingListTbody) return;
    bookingListTbody.innerHTML = '<tr><td colspan="5">正在載入預約資料...</td></tr>';
    try {
        const bookings = await api.getBookings(statusFilter);
        allBookings = bookings;
        renderBookingList(bookings);
    } catch (error) {
        bookingListTbody.innerHTML = `<tr><td colspan="5" style="color:red;">載入失敗: ${error.message}</td></tr>`;
    }
}

/**
 * 切換檢視模式 (列表/行事曆)
 */
function switchView(view) {
    currentView = view;
    if (view === 'calendar') {
        listViewContainer.style.display = 'none';
        calendarViewContainer.style.display = 'block';
        // 載入當月行事曆資料
    } else {
        calendarViewContainer.style.display = 'none';
        listViewContainer.style.display = 'block';
        const activeFilter = pageElement.querySelector('#booking-status-filter .active').dataset.filter;
        loadAndRenderList(activeFilter);
    }
}

/**
 * 綁定事件監聽器
 */
function setupEventListeners() {
    if (pageElement.dataset.initialized) return;

    // 狀態篩選
    pageElement.querySelector('#booking-status-filter').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            pageElement.querySelector('#booking-status-filter .active')?.classList.remove('active');
            e.target.classList.add('active');
            loadAndRenderList(e.target.dataset.filter);
        }
    });

    // 列表操作按鈕
    bookingListTbody.addEventListener('click', async e => {
        const target = e.target;
        // 【關鍵修正】將從 data-* 屬性取得的字串 ID 轉換為數字
        const bookingId = parseInt(target.dataset.bookingId, 10);
        
        // 如果 bookingId 無法被轉換成有效的數字 (例如 NaN)，就直接返回
        if (!bookingId) return;

        if (target.classList.contains('btn-check-in')) {
            try {
                await api.updateBookingStatus(bookingId, 'checked-in');
                ui.toast.success('已更新為「已報到」');
                target.disabled = true; // 直接禁用按鈕避免重複點擊
            } catch (error) {
                ui.toast.error(`操作失敗: ${error.message}`);
            }
        } else if (target.classList.contains('btn-cancel-booking')) {
            const confirmed = await ui.confirm('確定要取消這筆預約嗎？');
            if (confirmed) {
                try {
                    await api.updateBookingStatus(bookingId, 'cancelled');
                    ui.toast.success('預約已取消');
                    target.closest('tr').style.opacity = '0.5'; // 視覺上立即反饋
                    target.disabled = true;
                } catch (error) {
                    ui.toast.error(`操作失敗: ${error.message}`);
                }
            }
        }
    });
    
    // 切換檢視按鈕
    pageElement.querySelector('#switch-to-calendar-view-btn').addEventListener('click', () => {
        const btn = pageElement.querySelector('#switch-to-calendar-view-btn');
        if (currentView === 'list') {
            switchView('calendar');
            btn.textContent = '切換至列表';
        } else {
            switchView('list');
            btn.textContent = '切換至行事曆';
        }
    });

    pageElement.dataset.initialized = 'true';
}

/**
 * 模組初始化函式
 */
export const init = async () => {
    pageElement = document.getElementById('page-bookings');
    bookingListTbody = pageElement.querySelector('#booking-list-tbody');
    listViewContainer = pageElement.querySelector('#list-view-container');
    calendarViewContainer = pageElement.querySelector('#calendar-view-container');
    calendarGrid = pageElement.querySelector('#calendar-grid');
    calendarMonthYear = pageElement.querySelector('#calendar-month-year');
    createBookingBtn = pageElement.querySelector('#create-booking-btn');
    manageDatesBtn = pageElement.querySelector('#manage-booking-dates-btn');
    
    if(!pageElement) return;

    // 預設顯示列表檢視
    switchView('list');
    setupEventListeners();
};