// public/admin/modules/bookingManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let allBookings = [];
let calendarBookings = [];
let currentView = 'list';
let currentCalendarDate = new Date();
const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
let flatpickrInstance_admin = null; // 用於管理公休日的 flatpickr 實例
let initialEnabledDates = []; // 儲存初始的可預約日期

// DOM 元素
let pageElement, bookingListTbody, calendarViewContainer, listViewContainer,
    calendarGrid, calendarMonthYear, createBookingBtn, manageDatesBtn,
    createBookingModal, createBookingForm, bookingSettingsModal;

// --- (renderBookingList, loadAndRenderList, renderCalendar, loadAndRenderCalendar, changeMonth 等函式保持不變) ---
function renderBookingList(bookings) {
    if (!bookingListTbody) return;
    bookingListTbody.innerHTML = '';
    if (bookings.length === 0) {
        bookingListTbody.innerHTML = '<tr><td colspan="5">沒有符合條件的預約紀錄。</td></tr>';
        return;
    }
    bookings.forEach(booking => {
        const row = bookingListTbody.insertRow();
        const statusText = { 'confirmed': '預約成功', 'checked-in': '已報到', 'cancelled': '已取消' }[booking.status] || '未知';
        row.innerHTML = `
            <td>${booking.booking_date}<br>${booking.time_slot}</td>
            <td class="compound-cell"><div class="main-info">${booking.contact_name}</div><div class="sub-info">${booking.user_id || '現場客'}</div></td>
            <td>${booking.num_of_people}</td><td>${statusText}</td>
            <td class="actions-cell">
                <button class="action-btn btn-check-in" data-booking-id="${booking.booking_id}" style="background-color: var(--success-color);" ${booking.status !== 'confirmed' ? 'disabled' : ''}>報到</button>
                <button class="action-btn btn-cancel-booking" data-booking-id="${booking.booking_id}" style="background-color: var(--danger-color);" ${booking.status === 'cancelled' ? 'disabled' : ''}>取消</button>
            </td>`;
    });
}
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
    ['日', '一', '二', '三', '四', '五', '六'].forEach(day => { calendarGrid.innerHTML += `<div class="calendar-weekday">${day}</div>`; });
    for (let i = 0; i < startDayOfWeek; i++) { calendarGrid.innerHTML += `<div class="calendar-day day-other-month"></div>`; }
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


// --- 【新增】管理公休日相關功能 ---

/**
 * 開啟並初始化管理公休日的視窗
 */
async function openManageDatesModal() {
    try {
        initialEnabledDates = await api.getBookingSettings(); // 獲取目前的可預約日
        
        const container = document.getElementById('booking-datepicker-admin-container');
        if (!container) return;

        flatpickrInstance_admin = flatpickr(container, {
            inline: true,
            mode: 'multiple',
            dateFormat: "Y-m-d",
            defaultDate: initialEnabledDates,
        });

        ui.showModal('#booking-settings-modal');
    } catch (error) {
        ui.toast.error(`載入日期設定失敗: ${error.message}`);
    }
}

/**
 * 儲存公休日變更
 */
async function handleSaveBookingSettings() {
    if (!flatpickrInstance_admin) return;

    const button = document.getElementById('save-booking-settings-btn');
    button.disabled = true;
    button.textContent = '儲存中...';

    try {
        const selectedDates = flatpickrInstance_admin.selectedDates.map(d => flatpickr.formatDate(d, "Y-m-d"));
        const initialSet = new Set(initialEnabledDates);
        const selectedSet = new Set(selectedDates);

        const datesToAdd = selectedDates.filter(d => !initialSet.has(d));
        const datesToRemove = initialEnabledDates.filter(d => !selectedSet.has(d));

        const promises = [
            ...datesToAdd.map(date => api.saveBookingSettings({ action: 'add', date })),
            ...datesToRemove.map(date => api.saveBookingSettings({ action: 'remove', date }))
        ];

        await Promise.all(promises);
        ui.toast.success('可預約日期已更新！');
        ui.hideModal('#booking-settings-modal');
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '儲存變更';
    }
}

/**
 * 開啟當前月份的所有日期
 */
async function handleOpenMonth() {
    if (!flatpickrInstance_admin) return;
    
    const currentDate = flatpickrInstance_admin.currentYear;
    const year = flatpickrInstance_admin.currentYear;
    const month = flatpickrInstance_admin.currentMonth;

    const confirmed = await ui.confirm(`確定要將 ${year} 年 ${month + 1} 月的所有日期都設定為可預約嗎？`);
    if (!confirmed) return;

    try {
        await api.saveBookingSettings({ action: 'open_month', year, month }); //
        ui.toast.success(`${month + 1} 月已全部開放！`);
        // 刷新視窗內的行事曆
        const updatedDates = await api.getBookingSettings();
        initialEnabledDates = updatedDates;
        flatpickrInstance_admin.setDate(updatedDates, true);
    } catch (error) {
        ui.toast.error(`操作失敗: ${error.message}`);
    }
}


// --- 手動建立預約相關功能 ---
function openCreateBookingModal() {
    if (!createBookingModal || !createBookingForm) return;
    createBookingForm.reset();
    createBookingForm.querySelector('#booking-user-id').value = '';
    flatpickr("#booking-date-input", { dateFormat: "Y-m-d", minDate: "today", defaultDate: new Date() });
    const slotSelect = createBookingForm.querySelector('#booking-slot-select');
    slotSelect.innerHTML = AVAILABLE_TIME_SLOTS.map(slot => `<option>${slot}</option>`).join('');
    ui.showModal('#create-booking-modal');
}
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

    pageElement.querySelector('#booking-status-filter').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { pageElement.querySelector('#booking-status-filter .active')?.classList.remove('active'); e.target.classList.add('active'); loadAndRenderList(e.target.dataset.filter); } });
    bookingListTbody.addEventListener('click', async e => {
        const target = e.target;
        const bookingId = parseInt(target.dataset.bookingId, 10);
        if (!bookingId) return;
        if (target.classList.contains('btn-check-in')) { try { await api.updateBookingStatus(bookingId, 'checked-in'); ui.toast.success('已更新為「已報到」'); target.disabled = true; } catch (error) { ui.toast.error(`操作失敗: ${error.message}`); } }
        else if (target.classList.contains('btn-cancel-booking')) { const confirmed = await ui.confirm('確定要取消這筆預約嗎？'); if (confirmed) { try { await api.updateBookingStatus(bookingId, 'cancelled'); ui.toast.success('預約已取消'); target.closest('tr').style.opacity = '0.5'; target.disabled = true; } catch (error) { ui.toast.error(`操作失敗: ${error.message}`); } } }
    });
    pageElement.querySelector('#switch-to-calendar-view-btn').addEventListener('click', () => {
        const btn = pageElement.querySelector('#switch-to-calendar-view-btn');
        if (currentView === 'list') { switchView('calendar'); btn.textContent = '切換至列表'; }
        else { switchView('list'); btn.textContent = '切換至行事曆'; }
    });
    pageElement.querySelector('#calendar-prev-month-btn').addEventListener('click', () => changeMonth(-1));
    pageElement.querySelector('#calendar-next-month-btn').addEventListener('click', () => changeMonth(1));

    // --- 手動預約相關事件 ---
    createBookingBtn.addEventListener('click', openCreateBookingModal);
    const userSearchInput = document.getElementById('booking-user-search');
    const userSearchResults = document.getElementById('booking-user-search-results');
    userSearchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.trim();
        createBookingForm.querySelector('#booking-user-id').value = '';
        if (searchTerm.length < 1) { userSearchResults.style.display = 'none'; return; }
        try { const users = await api.searchUsers(searchTerm); userSearchResults.innerHTML = users.map(u => `<li data-user-id="${u.user_id}" data-name="${u.nickname || u.line_display_name}" data-phone="${u.phone || ''}">${u.nickname || u.line_display_name} (${u.user_id})</li>`).join(''); userSearchResults.style.display = users.length > 0 ? 'block' : 'none'; }
        catch (error) { console.error('搜尋使用者失敗', error); }
    });
    userSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const target = e.target;
            createBookingForm.querySelector('#booking-user-id').value = target.dataset.userId;
            userSearchInput.value = target.dataset.name;
            createBookingForm.querySelector('#booking-name-input').value = target.dataset.name;
            createBookingForm.querySelector('#booking-phone-input').value = target.dataset.phone;
            userSearchResults.style.display = 'none';
        }
    });
    createBookingForm.addEventListener('submit', handleCreateBookingFormSubmit);

    // --- 【新增】公休日管理相關事件 ---
    manageDatesBtn.addEventListener('click', openManageDatesModal);
    document.getElementById('save-booking-settings-btn').addEventListener('click', handleSaveBookingSettings);
    document.getElementById('open-month-btn').addEventListener('click', handleOpenMonth);


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
    bookingSettingsModal = document.getElementById('booking-settings-modal');
    
    if(!pageElement) return;

    switchView('list');
    setupEventListeners();
};