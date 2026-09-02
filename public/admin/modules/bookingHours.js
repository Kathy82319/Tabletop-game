// public/admin/modules/bookingHours.js
// 公休日／自訂營業時間管理：預設每天正常營業，只有設定過的「例外」日期才會變成公休或自訂開店/關店時間。
import { api } from '../api.js';
import { ui } from '../ui.js';

let pageElement, calendarGrid, monthYearEl, editModal;
let currentCalendarDate = new Date();
let overridesMap = {}; // { 'YYYY-MM-DD': {is_closed, closed_label, open_time, close_time} }
let editingDate = null;

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function loadOverrides() {
    const list = await api.getBookingDateOverrides();
    overridesMap = {};
    (list || []).forEach(o => { overridesMap[o.date] = o; });
}

function renderCalendar() {
    if (!calendarGrid || !monthYearEl) return;
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    monthYearEl.textContent = `${year} 年 ${month + 1} 月`;

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
        const dateStr = formatDate(year, month, day);
        const override = overridesMap[dateStr];

        let badge = '';
        if (override && override.is_closed) {
            badge = `<div class="bh-day-badge bh-closed">${escapeHtml(override.closed_label || '公休')}</div>`;
        } else if (override && (override.open_time || override.close_time)) {
            const open = override.open_time || '12:00';
            const close = override.close_time || '22:00';
            badge = `<div class="bh-day-badge bh-custom">${open}–${close}</div>`;
        }

        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.dataset.date = dateStr;
        dayCell.innerHTML = `<div class="day-number">${day}</div>${badge}`;
        calendarGrid.appendChild(dayCell);
    }
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

function openEditModal(dateStr) {
    editingDate = dateStr;
    const override = overridesMap[dateStr];

    document.getElementById('bh-edit-title').textContent = `設定 ${dateStr}`;

    let status = 'normal';
    if (override && override.is_closed) status = 'closed';
    else if (override && (override.open_time || override.close_time)) status = 'custom';

    editModal.querySelectorAll('input[name="bh-status"]').forEach(r => { r.checked = (r.value === status); });
    document.getElementById('bh-closed-label').value = (override && override.closed_label) || '公休';
    document.getElementById('bh-open-time').value = (override && override.open_time) || '12:00';
    document.getElementById('bh-close-time').value = (override && override.close_time) || '22:00';

    toggleFieldsByStatus(status);
    ui.showModal('#bh-edit-modal');
}

function toggleFieldsByStatus(status) {
    document.getElementById('bh-closed-label-group').style.display = status === 'closed' ? 'block' : 'none';
    document.getElementById('bh-custom-hours-group').style.display = status === 'custom' ? 'block' : 'none';
}

async function handleSave() {
    if (!editingDate) return;
    const status = editModal.querySelector('input[name="bh-status"]:checked')?.value || 'normal';
    const saveBtn = document.getElementById('bh-save-btn');
    saveBtn.disabled = true;

    try {
        if (status === 'normal') {
            await api.deleteBookingDateOverride(editingDate);
        } else if (status === 'closed') {
            const label = document.getElementById('bh-closed-label').value.trim() || '公休';
            await api.saveBookingDateOverride({ date: editingDate, is_closed: true, closed_label: label });
        } else {
            const openTime = document.getElementById('bh-open-time').value || '12:00';
            const closeTime = document.getElementById('bh-close-time').value || '22:00';
            await api.saveBookingDateOverride({ date: editingDate, is_closed: false, open_time: openTime, close_time: closeTime });
        }
        ui.toast.success('已儲存');
        ui.hideModal('#bh-edit-modal');
        await loadOverrides();
        renderCalendar();
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
    }
}

function setupEventListeners() {
    if (pageElement.dataset.initialized) return;

    document.getElementById('bh-prev-month-btn').addEventListener('click', () => changeMonth(-1));
    document.getElementById('bh-next-month-btn').addEventListener('click', () => changeMonth(1));

    calendarGrid.addEventListener('click', e => {
        const cell = e.target.closest('.calendar-day');
        if (!cell || !cell.dataset.date) return;
        openEditModal(cell.dataset.date);
    });

    editModal.querySelectorAll('input[name="bh-status"]').forEach(r => {
        r.addEventListener('change', () => toggleFieldsByStatus(r.value));
    });

    document.getElementById('bh-save-btn').addEventListener('click', handleSave);

    pageElement.dataset.initialized = 'true';
}

export const init = async () => {
    pageElement = document.getElementById('page-booking-hours');
    if (!pageElement) return;
    calendarGrid = document.getElementById('bh-calendar-grid');
    monthYearEl = document.getElementById('bh-month-year');
    editModal = document.getElementById('bh-edit-modal');

    setupEventListeners();

    try {
        await loadOverrides();
        renderCalendar();
    } catch (error) {
        ui.toast.error(`載入公休日設定失敗: ${error.message}`);
    }
};
