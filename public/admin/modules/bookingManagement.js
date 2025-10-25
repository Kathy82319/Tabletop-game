// public/admin/modules/bookingManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let allBookings = [];
let calendarBookings = [];
let currentView = 'list';
let currentCalendarDate = new Date();
const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
let flatpickrInstance_admin = null;
let initialEnabledDates = [];

// DOM 元素
let pageElement, bookingListTbody, calendarViewContainer, listViewContainer,
    calendarGrid, calendarMonthYear, createBookingBtn, manageDatesBtn,
    createBookingModal, createBookingForm, bookingSettingsModal;

/**
 * 渲染預約列表
 * @param {Array} bookings - 要顯示的預約陣列
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
        const statusText = { 'confirmed': '預約成功', 'checked-in': '已報到', 'cancelled': '已取消' }[booking.status] || '未知';
        
        // 讓客戶欄位可點擊，並添加 data attribute
        row.innerHTML = `
            <td>${booking.booking_date}<br>${booking.time_slot}</td>
            <td class="compound-cell clickable-cell" data-booking-id="${booking.booking_id}" style="cursor: pointer; text-decoration: underline; color: var(--primary-color);">
                <div class="main-info">${booking.contact_name}</div>
                <div class="sub-info">${booking.user_id || '現場客'}</div>
            </td>
            <td>${booking.num_of_people}</td>
            <td>${statusText}</td>
            <td class="actions-cell">
                <button class="action-btn btn-check-in" data-booking-id="${booking.booking_id}" style="background-color: var(--success-color);" ${booking.status !== 'confirmed' ? 'disabled' : ''}>報到</button>
                <button class="action-btn btn-cancel-booking" data-booking-id="${booking.booking_id}" style="background-color: var(--danger-color);" ${booking.status === 'cancelled' ? 'disabled' : ''}>取消</button>
            </td>`;
    });
}

/**
 * 載入並渲染列表視圖的資料
 * @param {string} statusFilter - 狀態篩選器
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

/**
 * 渲染行事曆
 * @param {Date} date - 要顯示的月份
 */
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
        dayBookings.sort((a, b) => a.time_slot.localeCompare(b.time_slot));

        dayBookings.forEach(booking => {
            let statusClass = '';
            if (booking.status === 'checked-in') statusClass = 'status-checked-in';
            if (booking.status === 'cancelled') statusClass = 'status-cancelled';
            const bookingEl = document.createElement('div');
            bookingEl.className = `calendar-booking ${statusClass}`;
            bookingEl.dataset.bookingId = booking.booking_id;
            bookingEl.style.cursor = 'pointer';
            bookingEl.innerHTML = `
                <div class="calendar-booking-info">${booking.time_slot} ${booking.contact_name} (${booking.num_of_people})</div>
                <button class="calendar-cancel-btn" data-booking-id="${booking.booking_id}" title="取消預約" ${booking.status !== 'confirmed' ? 'style="display:none;"' : ''}>&times;</button>
            `;
            dayCell.appendChild(bookingEl);
        });
        calendarGrid.appendChild(dayCell);
    }
}

/**
 * 載入並渲染行事曆視圖的資料
 */
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

/**
 * 切換月份
 * @param {number} direction - 1 為下個月, -1 為上個月
 */
function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar(currentCalendarDate);
}

/**
 * 開啟並初始化管理公休日的視窗
 */
async function openManageDatesModal() {
    try {
        initialEnabledDates = await api.getBookingSettings();
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
    const year = flatpickrInstance_admin.currentYear;
    const month = flatpickrInstance_admin.currentMonth;

    const confirmed = await ui.confirm(`確定要將 ${year} 年 ${month + 1} 月的所有日期都設定為可預約嗎？`);
    if (!confirmed) return;

    try {
        await api.saveBookingSettings({ action: 'open_month', year, month });
        ui.toast.success(`${month + 1} 月已全部開放！`);
        const updatedDates = await api.getBookingSettings();
        initialEnabledDates = updatedDates;
        flatpickrInstance_admin.setDate(updatedDates, true);
    } catch (error) {
        ui.toast.error(`操作失敗: ${error.message}`);
    }
}

/**
 * 開啟手動建立預約的視窗
 */
function openCreateBookingModal() {
    if (!createBookingModal || !createBookingForm) return;
    createBookingForm.reset();
    createBookingForm.querySelector('#booking-user-id').value = '';
    flatpickr("#booking-date-input", { dateFormat: "Y-m-d", minDate: "today", defaultDate: new Date() });
    const slotSelect = createBookingForm.querySelector('#booking-slot-select');
    slotSelect.innerHTML = AVAILABLE_TIME_SLOTS.map(slot => `<option>${slot}</option>`).join('');
    ui.showModal('#create-booking-modal');
}

/**
 * 處理手動建立預約的表單提交
 * @param {Event} event - 表單提交事件
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
 * 切換列表與行事曆視圖
 * @param {string} view - 'list' 或 'calendar'
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
 * 開啟訂位詳細資訊視窗
 * @param {number} bookingId - 預約 ID
 */
async function openBookingDetailsModal(bookingId) {
    const modal = document.getElementById('booking-details-modal');
    const contentEl = document.getElementById('booking-details-content');
    if (!modal || !contentEl) return;

    contentEl.innerHTML = '<p>正在載入詳細資訊...</p>';
    ui.showModal('#booking-details-modal');

    const booking = allBookings.find(b => b.booking_id === bookingId) || calendarBookings.find(b => b.booking_id === bookingId);
    if (!booking) {
        contentEl.innerHTML = '<p style="color:red;">找不到該筆預約資料。</p>';
        return;
    }
    
    let userHtml = '<div class="profile-summary"><h4>散客 (無會員資料)</h4></div>';
    
    if (booking.user_id) {
        try {
            const userDetails = await api.getUserDetails(booking.user_id);
            const profile = userDetails.profile;
            const displayName = profile.nickname || profile.line_display_name;
            userHtml = `
                <div class="profile-summary">
                    <img src="/api/admin/get-avatar?userId=${profile.user_id}" alt="Avatar">
                    <h4>${displayName}</h4>
                    <p><strong>姓名:</strong> ${profile.real_name || '未設定'}</p>
                    <p><strong>電話:</strong> ${profile.phone || '未設定'}</p>
                    <hr>
                    <p><strong>等級:</strong> ${profile.level} (${profile.current_exp}/10 EXP)</p>
                    <p><strong>職業:</strong> ${profile.class}</p>
                    <p><strong>標籤:</strong> ${profile.tag}</p>
                    ${profile.notes ? `<div class="crm-notes-section" style="margin-top: 1rem; padding: 0.8rem; background-color: #fffbe6; border-radius: 6px; border: 1px solid #ffe58f; max-height: 5em; overflow-y: auto;"><strong>備註:</strong><p style="white-space: pre-wrap; margin: 0;">${profile.notes}</p></div>` : ''}
                </div>`;
        } catch (error) {
            userHtml = `<div class="profile-summary"><h4>會員資料載入失敗</h4><p style="color:red;">${error.message}</p></div>`;
        }
    }

    const bookingHtml = `
        <div class="profile-details">
             <h4>預約內容</h4>
             <p><strong>預約 ID:</strong> ${booking.booking_id}</p>
             <p><strong>預約時間:</strong> ${booking.booking_date} ${booking.time_slot}</p>
             <p><strong>聯絡姓名:</strong> ${booking.contact_name}</p>
             <p><strong>聯絡電話:</strong> ${booking.contact_phone || '未提供'}</p>
             <p><strong>預約人數:</strong> ${booking.num_of_people} 人</p>
             <p><strong>狀態:</strong> ${booking.status}</p>
        </div>
    `;

    contentEl.innerHTML = `<div class="details-grid">${userHtml}${bookingHtml}</div>`;
}

/**
 * 綁定所有事件監聽器
 */
function setupEventListeners() {
    if (pageElement.dataset.initialized) return;

    pageElement.querySelector('#booking-status-filter').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { pageElement.querySelector('#booking-status-filter .active')?.classList.remove('active'); e.target.classList.add('active'); loadAndRenderList(e.target.dataset.filter); } });
    
    bookingListTbody.addEventListener('click', async e => {
        const checkInBtn = e.target.closest('.btn-check-in');
        const cancelBtn = e.target.closest('.btn-cancel-booking');
        const detailsCell = e.target.closest('.clickable-cell');

        if (checkInBtn) {
            const bookingId = parseInt(checkInBtn.dataset.bookingId, 10);
            try { await api.updateBookingStatus(bookingId, 'checked-in'); ui.toast.success('已更新為「已報到」'); checkInBtn.disabled = true; } catch (error) { ui.toast.error(`操作失敗: ${error.message}`); }
        } else if (cancelBtn) {
            const bookingId = parseInt(cancelBtn.dataset.bookingId, 10);
            const confirmed = await ui.confirm('確定要取消這筆預約嗎？'); 
            if (confirmed) { try { await api.updateBookingStatus(bookingId, 'cancelled'); ui.toast.success('預約已取消'); cancelBtn.closest('tr').style.opacity = '0.5'; cancelBtn.disabled = true; } catch (error) { ui.toast.error(`操作失敗: ${error.message}`); } }
        } else if (detailsCell) {
            const bookingId = parseInt(detailsCell.dataset.bookingId, 10);
            openBookingDetailsModal(bookingId);
        }
    });

    calendarGrid.addEventListener('click', async e => {
        const cancelBtn = e.target.closest('.calendar-cancel-btn');
        const bookingEl = e.target.closest('.calendar-booking');
        
        if (cancelBtn) {
            e.stopPropagation();
            const bookingId = parseInt(cancelBtn.dataset.bookingId, 10);
            const confirmed = await ui.confirm('確定要取消這筆預約嗎？');
            if (confirmed) {
                try {
                    await api.updateBookingStatus(bookingId, 'cancelled');
                    ui.toast.success('預約已取消');
                    loadAndRenderCalendar();
                } catch (error) { ui.toast.error(`操作失敗: ${error.message}`); }
            }
        } else if (bookingEl) {
            const bookingId = parseInt(bookingEl.dataset.bookingId, 10);
            openBookingDetailsModal(bookingId);
        }
    });

    pageElement.querySelector('#switch-to-calendar-view-btn').addEventListener('click', () => {
        const btn = pageElement.querySelector('#switch-to-calendar-view-btn');
        if (currentView === 'list') { switchView('calendar'); btn.textContent = '切換至列表'; }
        else { switchView('list'); btn.textContent = '切換至行事曆'; }
    });
    pageElement.querySelector('#calendar-prev-month-btn').addEventListener('click', () => changeMonth(-1));
    pageElement.querySelector('#calendar-next-month-btn').addEventListener('click', () => changeMonth(1));

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

    manageDatesBtn.addEventListener('click', openManageDatesModal);
    document.getElementById('save-booking-settings-btn').addEventListener('click', handleSaveBookingSettings);
    document.getElementById('open-month-btn').addEventListener('click', handleOpenMonth);

    pageElement.dataset.initialized = 'true';
}

/**
 * 模組初始化函式
 */
export const init = async (context, param) => {
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