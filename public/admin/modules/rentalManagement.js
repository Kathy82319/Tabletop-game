// public/admin/modules/rentalManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let allRentals = [];
let allDrafts = []; // 用於管理租借紀錄時發送訊息

// DOM 元素
let rentalListTbody, rentalSearchInput, rentalStatusFilter,
    editRentalModal, editRentalForm, sortDueDateBtn;

/**
 * 根據狀態給予不同的 CSS Class
 * @param {string} status - 租借狀態 (rented, overdue, returned)
 * @returns {string} 對應的 class 名稱
 */
function getStatusClass(status) {
    switch (status) {
        case 'overdue': return 'status-overdue';
        case 'due_today': return 'status-due-today';
        case 'rented': return 'status-rented';
        case 'returned': return 'status-returned';
        default: return '';
    }
}

/**
 * 渲染租借列表到表格中
 * @param {Array} rentals - 要渲染的租借物件陣列
 */
function renderRentalList(rentals) {
    if (!rentalListTbody) return;

    rentalListTbody.innerHTML = '';
    if (rentals.length === 0) {
        rentalListTbody.innerHTML = '<tr><td colspan="6">找不到符合條件的租借紀錄。</td></tr>';
        return;
    }

    rentals.forEach(rental => {
        const row = rentalListTbody.insertRow();
        const statusText = {
            'rented': '租借中',
            'overdue': '已逾期',
            'due_today': '今日到期',
            'returned': '已歸還'
        }[rental.derived_status] || rental.status;
        
        const lateFeeText = rental.calculated_late_fee > 0 ? `<div class="sub-info" style="color: var(--danger-color);">逾期費用: $${rental.calculated_late_fee}</div>` : '';

        row.innerHTML = `
            <td>
                <span class="status-badge ${getStatusClass(rental.derived_status)}">${statusText}</span>
                ${lateFeeText}
            </td>
            <td>${rental.game_name || '遊戲資料遺失'}</td>
            <td class="compound-cell">
                <div class="main-info">${rental.nickname || rental.line_display_name}</div>
                <div class="sub-info">${rental.user_id}</div>
            </td>
            <td>${rental.due_date}</td>
            <td>${rental.return_date || '尚未歸還'}</td>
            <td class="actions-cell">
                <button class="action-btn btn-return-rental" data-rental-id="${rental.rental_id}" style="background-color: var(--success-color);" ${rental.status === 'returned' ? 'disabled' : ''}>歸還</button>
                <button class="action-btn btn-manage-rental" data-rental-id="${rental.rental_id}" style="background-color: var(--info-color);">管理</button>
            </td>
        `;
    });
}

/**
 * 根據目前的篩選和排序條件，重新渲染列表
 */
function applyFiltersAndRender() {
    const searchTerm = rentalSearchInput.value.toLowerCase().trim();
    const statusFilter = rentalStatusFilter.querySelector('.active').dataset.filter;

    let filteredRentals = allRentals;

    // 狀態篩選
    if (statusFilter !== 'all') {
        filteredRentals = filteredRentals.filter(r => r.derived_status === statusFilter);
    }

    // 關鍵字搜尋
    if (searchTerm) {
        filteredRentals = filteredRentals.filter(r =>
            (r.game_name || '').toLowerCase().includes(searchTerm) ||
            (r.nickname || '').toLowerCase().includes(searchTerm) ||
            (r.line_display_name || '').toLowerCase().includes(searchTerm)
        );
    }
    
    renderRentalList(filteredRentals);
}


/**
 * 開啟並填充管理租借紀錄的彈出視窗
 * @param {number} rentalId - 租借紀錄 ID
 */
function openEditRentalModal(rentalId) {
    const rental = allRentals.find(r => r.rental_id === rentalId);
    if (!rental) {
        return ui.toast.error('找不到該筆租借紀錄');
    }

    editRentalModal.querySelector('#modal-rental-title').textContent = `管理：${rental.game_name}`;
    editRentalForm.querySelector('#edit-rental-id').value = rentalId;
    editRentalForm.querySelector('#calculated-late-fee-display').value = `$${rental.calculated_late_fee}`;
    editRentalForm.querySelector('#edit-rental-due-date').value = rental.due_date;
    editRentalForm.querySelector('#edit-rental-override-fee').value = rental.late_fee_override || '';

    // 初始化 flatpickr
    flatpickr(editRentalForm.querySelector('#edit-rental-due-date'), {
        dateFormat: "Y-m-d",
        defaultDate: rental.due_date
    });
    
    // 綁定訊息發送功能
    bindMessageSender(rental.user_id, rental.game_name);

    ui.showModal('#edit-rental-modal');
}

/**
 * 為管理視窗內的訊息發送器載入草稿並綁定事件
 * @param {string} userId - 接收訊息的使用者 ID
 * @param {string} gameName - 遊戲名稱，用於預設訊息
 */
async function bindMessageSender(userId, gameName) {
    const select = editRentalModal.querySelector('#rental-message-draft-select');
    const content = editRentalModal.querySelector('#rental-direct-message-content');
    const sendBtn = editRentalModal.querySelector('#rental-send-direct-message-btn');

    if (allDrafts.length === 0) {
        try {
            allDrafts = await api.getMessageDrafts();
        } catch (error) {
            ui.toast.error('載入訊息草稿失敗');
        }
    }

    select.innerHTML = '<option value="">-- 手動輸入或選擇草稿 --</option>';
    allDrafts.forEach(d => select.add(new Option(d.title, d.content)));

    select.onchange = () => { content.value = select.value; };
    content.value = `您好，提醒您租借的桌遊《${gameName}》相關事宜：`;

    sendBtn.onclick = async () => {
        const message = content.value.trim();
        if (!message) return ui.toast.error('訊息內容不可為空');
        if (!userId) return ui.toast.error('此顧客無 LINE User ID，無法發送訊息');
        
        const confirmed = await ui.confirm('確定要發送此訊息嗎？');
        if (!confirmed) return;

        try {
            sendBtn.disabled = true;
            await api.sendMessage(userId, message);
            ui.toast.success('訊息發送成功！');
        } catch (error) {
            ui.toast.error(`發送失敗: ${error.message}`);
        } finally {
            sendBtn.disabled = false;
        }
    };
}


/**
 * 處理管理租借紀錄表單的提交
 * @param {Event} event - 表單提交事件
 */
async function handleEditRentalFormSubmit(event) {
    event.preventDefault();
    const rentalId = parseInt(editRentalForm.querySelector('#edit-rental-id').value, 10);
    const dueDate = editRentalForm.querySelector('#edit-rental-due-date').value;
    const lateFeeOverride = editRentalForm.querySelector('#edit-rental-override-fee').value;

    const button = editRentalForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
        await api.updateRentalDetails({ rentalId, dueDate, lateFeeOverride });
        ui.toast.success('租借紀錄更新成功！');
        ui.hideModal('#edit-rental-modal');
        init(); // 重新載入所有資料
    } catch (error) {
        ui.toast.error(`更新失敗: ${error.message}`);
    } finally {
        button.disabled = false;
    }
}


/**
 * 綁定此頁面所有需要一次性設定的事件監聽器
 */
function setupEventListeners() {
    const page = document.getElementById('page-rentals');
    if (page.dataset.initialized) return;

    rentalSearchInput.addEventListener('input', applyFiltersAndRender);

    rentalStatusFilter.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            rentalStatusFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            const status = e.target.dataset.filter;
            init(status); // 傳入狀態以重新從 API 獲取資料
        }
    });

    rentalListTbody.addEventListener('click', async e => {
        const target = e.target;
        if (target.classList.contains('btn-return-rental')) {
            const rentalId = parseInt(target.dataset.rentalId, 10);
            const confirmed = await ui.confirm('確定要將此遊戲標記為「已歸還」嗎？庫存將會補回。');
            if (confirmed) {
                try {
                    await api.updateRentalStatus(rentalId, 'returned');
                    ui.toast.success('狀態已更新為「已歸還」！');
                    init(); // 重新載入
                } catch (error) {
                    ui.toast.error(`操作失敗: ${error.message}`);
                }
            }
        } else if (target.classList.contains('btn-manage-rental')) {
            const rentalId = parseInt(target.dataset.rentalId, 10);
            openEditRentalModal(rentalId);
        }
    });
    
    editRentalForm.addEventListener('submit', handleEditRentalFormSubmit);

    page.dataset.initialized = 'true';
}


/**
 * 模組初始化函式
 * @param {string} status - 要篩選的狀態
 */
export const init = async (status = 'all') => {
    const page = document.getElementById('page-rentals');
    
    // 獲取 DOM 元素
    rentalListTbody = page.querySelector('#rental-list-tbody');
    rentalSearchInput = page.querySelector('#rental-search-input');
    rentalStatusFilter = page.querySelector('#rental-status-filter');
    sortDueDateBtn = page.querySelector('#sort-due-date');
    editRentalModal = document.getElementById('edit-rental-modal');
    editRentalForm = document.getElementById('edit-rental-form');

    if (!rentalListTbody) return;
    
    rentalListTbody.innerHTML = '<tr><td colspan="6">正在載入租借紀錄...</td></tr>';

    try {
        allRentals = await api.getAllRentals(status);
        applyFiltersAndRender();
        setupEventListeners();
    } catch (error) {
        console.error('載入租借紀錄失敗:', error);
        rentalListTbody.innerHTML = `<tr><td colspan="6" style="color: red;">讀取失敗: ${error.message}</td></tr>`;
    }
};