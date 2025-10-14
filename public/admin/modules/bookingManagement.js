// public/admin/modules/bookingManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let allBookings = []; // 用於列表視圖
let calendarBookings = []; // 用於行事曆視圖
let currentView = 'list';
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
        allBookings = await api.getBookings(statusFilter);
        renderBookingList(allBookings);
    } catch (error) {
        bookingListTbody.innerHTML = `<tr><td colspan="5" style="color:red;">載入失敗: ${error.message}</td></tr>`;
    }
}


// --- 【新增】行事曆相關功能 ---

/**
 * 渲染行事曆
 * @param {Date} date - 要顯示的月份所在的日期物件
 */
function renderCalendar(date) {
    if (!calendarGrid || !calendarMonthYear) return;

    calendarMonthYear.textContent = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;

    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 for Sunday, 1 for Monday...

    calendarGrid.innerHTML = '';

    // Add weekday headers
    ['日', '一', '二', '三', '四', '五', '六'].forEach(day => {
        calendarGrid.innerHTML += `<div class="calendar-weekday">${day}</div>`;
    });

    // Add empty cells for days before the 1st
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarGrid.innerHTML += `<div class="calendar-day day-other-month"></div>`;
    }

    // Add day cells for the current month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        dayCell.innerHTML = `<div class="day-number">${day}</div>`;
        
        // Find bookings for this day
        const dayBookings = calendarBookings.filter(b => b.booking_date === dateStr);
        dayBookings.sort((a,b) => a.time_slot.localeCompare(b.time_slot));

        dayBookings.forEach(booking => {
            let statusClass = '';
            if (booking.status === 'checked-in') statusClass = 'status-checked-in';
            if (booking.status === 'cancelled') statusClass = 'status-cancelled';

            const bookingEl = document.createElement('div');
            bookingEl.className = `calendar-booking ${statusClass}`;
            bookingEl.innerHTML = `
                <div class="calendar-booking-info">${booking.time_slot} ${booking.contact_name} (${booking.num_of_people})</div>
            `;
            // 這裡可以未來再加入報到/取消按鈕
            dayCell.appendChild(bookingEl);
        });
        calendarGrid.appendChild(dayCell);
    }
}

/**
 * 載入所有未來預約並渲染行事曆
 */
async function loadAndRenderCalendar() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '<p>正在載入預約資料...</p>';
    try {
        // 使用 'all_upcoming' 篩選器來獲取所有未來的預約
        calendarBookings = await api.getBookings('all_upcoming');
        renderCalendar(currentCalendarDate);
    } catch (error) {
        calendarGrid.innerHTML = `<p style="color:red;">載入行事曆失敗: ${error.message}</p>`;
    }
}

/**
 * 切換月份
 * @param {number} direction -1 for previous month, 1 for next month
 */
function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar(currentCalendarDate);
}


/**
 * 切換檢視模式 (列表/行事曆)
 */
function switchView(view) {
    currentView = view;
    if (view === 'calendar') {
        listViewContainer.style.display = 'none';
        calendarViewContainer.style.display = 'block';
        // 【修正】呼叫行事曆載入函式
        loadAndRenderCalendar();
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
        const bookingId = parseInt(target.dataset.bookingId, 10);
        
        if (!bookingId) return;

        if (target.classList.contains('btn-check-in')) {
            try {
                await api.updateBookingStatus(bookingId, 'checked-in');
                ui.toast.success('已更新為「已報到」');
                target.disabled = true;
            } catch (error) {
                ui.toast.error(`操作失敗: ${error.message}`);
            }
        } else if (target.classList.contains('btn-cancel-booking')) {
            const confirmed = await ui.confirm('確定要取消這筆預約嗎？');
            if (confirmed) {
                try {
                    await api.updateBookingStatus(bookingId, 'cancelled');
                    ui.toast.success('預約已取消');
                    target.closest('tr').style.opacity = '0.5';
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

    // 【新增】行事曆月份切換按鈕
    pageElement.querySelector('#calendar-prev-month-btn').addEventListener('click', () => changeMonth(-1));
    pageElement.querySelector('#calendar-next-month-btn').addEventListener('click', () => changeMonth(1));


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


    switchView('list');
    setupEventListeners();
};