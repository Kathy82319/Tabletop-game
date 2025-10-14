// public/admin/modules/bookingManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let allBookings = [];
let calendarBookings = [];
let currentView = 'list';
let currentCalendarDate = new Date();
const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];


// DOM 元素
let pageElement, bookingListTbody, calendarViewContainer, listViewContainer,
    calendarGrid, calendarMonthYear, createBookingBtn, manageDatesBtn,
    createBookingModal, createBookingForm;

/**
 * 渲染預約列表
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


// --- 行事曆相關功能 ---

function renderCalendar(date) {
    if (!calendarGrid || !calendarMonthYear) return;

    calendarMonthYear.textContent = `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    calendarGrid.innerHTML = '';
    ['日', '一', '二', '三', '四', '五', '六'].forEach(day => {
        calendarGrid.innerHTML += `<div class="calendar-weekday">${day}</div>`;
    });
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarGrid.innerHTML += `<div class="calendar-day day-other-month"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.innerHTML = `<div class="day-number">${day}</div>`;
        const dayBookings = calendarBookings.filter(b => b.booking_date === dateStr);
        dayBookings.sort((a,b) => a.time_slot.localeCompare(b.time_slot));
        dayBookings.forEach(booking => {
            let statusClass = '';
            if (booking.status === 'checked-in') statusClass = 'status-checked-in';
            if (booking.status === 'cancelled') statusClass = 'status-cancelled';
            const bookingEl = document.createElement('div');
            bookingEl.className = `calendar-booking ${statusClass}`;
            bookingEl.innerHTML = `<div class="calendar-booking-info">${booking.time_slot} ${booking.contact_name} (${booking.num_of_people})</div>`;
            dayCell.appendChild(bookingEl);
        });
        calendarGrid.appendChild(dayCell);
    }
}

async function loadAndRenderCalendar() {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '<p>正在載入預約資料...</p>';
    try {
        calendarBookings = await api.getBookings('all_upcoming');
        renderCalendar(currentCalendarDate);
    } catch (error) {
        calendarGrid.innerHTML = `<p style="color:red;">載入行事曆失敗: ${error.message}</p>`;
    }
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar(currentCalendarDate);
}


// --- 【新增】手動建立預約相關功能 ---

/**
 * 開啟並初始化手動建立預約的視窗
 */
function openCreateBookingModal() {
    if (!createBookingModal || !createBookingForm) return;

    createBookingForm.reset();
    createBookingForm.querySelector('#booking-user-id').value = '';
    
    // 初始化日期選擇器
    flatpickr("#booking-date-input", {
        dateFormat: "Y-m-d",
        minDate: "today",
        defaultDate: new Date()
    });

    // 填充時間選項
    const slotSelect = createBookingForm.querySelector('#booking-slot-select');
    slotSelect.innerHTML = AVAILABLE_TIME_SLOTS.map(slot => `<option>${slot}</option>`).join('');
    
    ui.showModal('#create-booking-modal');
}

/**
 * 處理手動建立預約的表單提交
 */
async function handleCreateBookingFormSubmit(event) {
    event.preventDefault();
    const button = createBookingForm.querySelector('button[type="submit"]');

    const phone = createBookingForm.querySelector('#booking-phone-input').value.trim();
    if (!phone) {
        const confirmed = await ui.confirm('聯絡電話為空，確定要繼續建立預約嗎？');
        if (!confirmed) return;
    }

    const data = {
        userId: createBookingForm.querySelector('#booking-user-id').value || null,
        bookingDate: createBookingForm.querySelector('#booking-date-input').value,
        timeSlot: createBookingForm.querySelector('#booking-slot-select').value,
        contactName: createBookingForm.querySelector('#booking-name-input').value.trim(),
        contactPhone: phone,
        numOfPeople: createBookingForm.querySelector('#booking-people-input').value,
        item: createBookingForm.querySelector('#booking-item-input').value.trim(),
    };

    button.disabled = true;
    button.textContent = '建立中...';
    try {
        const result = await api.createBooking(data);
        ui.toast.success(result.message || '預約已建立！');
        ui.hideModal('#create-booking-modal');
        // 根據目前視圖刷新
        if (currentView === 'list') {
            const activeFilter = pageElement.querySelector('#booking-status-filter .active').dataset.filter;
            loadAndRenderList(activeFilter);
        } else {
            loadAndRenderCalendar();
        }
    } catch (error) {
        ui.toast.error(`建立失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '確認建立';
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

    // 行事曆月份切換按鈕
    pageElement.querySelector('#calendar-prev-month-btn').addEventListener('click', () => changeMonth(-1));
    pageElement.querySelector('#calendar-next-month-btn').addEventListener('click', () => changeMonth(1));

    // --- 【新增】手動預約相關事件 ---
    createBookingBtn.addEventListener('click', openCreateBookingModal);

    const userSearchInput = document.getElementById('booking-user-search');
    const userSearchResults = document.getElementById('booking-user-search-results');

    userSearchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.trim();
        createBookingForm.querySelector('#booking-user-id').value = ''; // 清空已選會員
        if (searchTerm.length < 1) {
            userSearchResults.style.display = 'none';
            return;
        }
        try {
            const users = await api.searchUsers(searchTerm);
            userSearchResults.innerHTML = users.map(u => `<li data-user-id="${u.user_id}" data-name="${u.nickname || u.line_display_name}" data-phone="${u.phone || ''}">${u.nickname || u.line_display_name} (${u.user_id})</li>`).join('');
            userSearchResults.style.display = users.length > 0 ? 'block' : 'none';
        } catch (error) { console.error('搜尋使用者失敗', error); }
    });

    userSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const target = e.target;
            createBookingForm.querySelector('#booking-user-id').value = target.dataset.userId;
            userSearchInput.value = target.dataset.name; // 更新搜尋框文字
            createBookingForm.querySelector('#booking-name-input').value = target.dataset.name;
            createBookingForm.querySelector('#booking-phone-input').value = target.dataset.phone;
            userSearchResults.style.display = 'none';
        }
    });

    createBookingForm.addEventListener('submit', handleCreateBookingFormSubmit);

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
    createBookingModal = document.getElementById('create-booking-modal');
    createBookingForm = document.getElementById('create-booking-form');
    
    if(!pageElement) return;

    switchView('list');
    setupEventListeners();
};