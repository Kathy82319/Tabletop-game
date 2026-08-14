// public/admin/modules/rentalManagement.js (最新修正版)
import { api } from '../api.js';
import { ui } from '../ui.js';

let allRentals = [];
let allDrafts = [];
let allGames = [];
let selectedRentalGames = new Map();
let rentalSearchChips = [];

let rentalListTbody, rentalSearchInput, rentalStatusFilter,
    editRentalModal, editRentalForm, sortDueDateBtn,
    createRentalModal, createRentalForm;

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 遊戲可能有多組條碼（主要條碼 + BoardGameBarcodes 額外條碼，以逗號字串回傳），統一展開成陣列供比對
function gameBarcodes(game) {
    const extra = (game.extra_barcodes || '').split(',').map(b => b.trim()).filter(Boolean);
    return [...new Set([game.barcode, ...extra].map(b => (b || '').trim()).filter(Boolean))];
}

function rentalMatchesTerm(rental, term) {
    const t = term.toLowerCase();
    return (rental.game_name || '').toLowerCase().includes(t) ||
           (rental.nickname || '').toLowerCase().includes(t) ||
           (rental.line_display_name || '').toLowerCase().includes(t) ||
           (rental.barcode || '').toLowerCase().includes(t);
}

function renderRentalSearchChips() {
    const container = document.getElementById('rental-search-container');
    if (!container || !rentalSearchInput) return;
    container.querySelectorAll('.search-chip').forEach(c => c.remove());
    rentalSearchChips.forEach(chip => {
        const el = document.createElement('span');
        el.className = 'search-chip';
        el.innerHTML = `${escapeHtml(chip)}<button type="button" class="chip-remove" data-chip="${escapeHtml(chip)}">&times;</button>`;
        container.insertBefore(el, rentalSearchInput);
    });
}

function addRentalSearchChip(term) {
    const normalized = term.trim();
    if (!normalized || rentalSearchChips.includes(normalized)) return;
    rentalSearchChips.push(normalized);
    renderRentalSearchChips();
    applyFiltersAndRender();
}

function removeRentalSearchChip(term) {
    rentalSearchChips = rentalSearchChips.filter(c => c !== term);
    renderRentalSearchChips();
    applyFiltersAndRender();
}

function getStatusClass(status) {
    switch (status) {
        case 'overdue': return 'status-overdue';
        case 'due_today': return 'status-due-today';
        case 'rented': return 'status-rented';
        case 'returned': return 'status-returned';
        default: return '';
    }
}
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
        const displayName = rental.nickname || rental.line_display_name || '散客';
        const subInfo = rental.user_id ? `<div class="sub-info">${rental.user_id}</div>` : '';
        const lateFeeText = rental.calculated_late_fee > 0 ? `<div class="sub-info" style="color: var(--danger-color);">逾期費用: $${rental.calculated_late_fee}</div>` : '';
        
        row.innerHTML = `
            <td><span class="status-badge ${getStatusClass(rental.derived_status)}">${statusText}</span>${lateFeeText}</td>
            <td class="compound-cell"><div class="main-info">${escapeHtml(rental.game_name || '遊戲資料遺失')}</div>${rental.barcode ? `<div class="sub-info">條碼: ${escapeHtml(rental.barcode)}</div>` : ''}</td>
            <td class="compound-cell"><div class="main-info">${displayName}</div>${subInfo}</td>
            <td>${rental.due_date}</td>
            <td>${rental.return_date || '尚未歸還'}</td>
            <td class="actions-cell">
                ${rental.status === 'returned' ? '' : `<button class="action-btn btn-return-rental" data-rental-id="${rental.rental_id}" style="background-color: var(--success-color);">歸還</button>`}
                <button class="action-btn btn-manage-rental" data-rental-id="${rental.rental_id}" style="background-color: var(--info-color);">管理</button>
            </td>
        `;
    });
}
function applyFiltersAndRender() {
    const inputText = rentalSearchInput.value.trim();
    const allTerms = [...rentalSearchChips, ...(inputText ? [inputText] : [])];
    const statusFilter = rentalStatusFilter.querySelector('.active').dataset.filter;

    let filteredRentals = allRentals;
    if (statusFilter !== 'all') {
        if (statusFilter === 'rented') {
            filteredRentals = allRentals.filter(r => ['rented', 'due_today', 'overdue'].includes(r.derived_status));
        } else {
            filteredRentals = allRentals.filter(r => r.derived_status === statusFilter);
        }
    }

    if (allTerms.length > 0) {
        filteredRentals = filteredRentals.filter(r =>
            allTerms.every(term => rentalMatchesTerm(r, term))
        );
    }
    renderRentalList(filteredRentals);
}

export async function openCreateRentalModal(initialGameId) {
    createRentalModal = document.getElementById('create-rental-modal');
    createRentalForm = document.getElementById('create-rental-form');
    if (!createRentalModal || !createRentalForm) {
        return ui.toast.error("HTML 結構錯誤：找不到 create-rental-modal。");
    }
    if (allGames.length === 0) {
        try {
            allGames = await api.getProducts();
        } catch (e) {
            return ui.toast.error('無法載入遊戲列表，無法開啟租借視窗。');
        }
    }
    createRentalForm.reset();
    createRentalForm.querySelector('#rental-user-id').value = '';
    selectedRentalGames.clear();
    document.getElementById('rental-games-container').innerHTML = '';
    document.getElementById('game-search-results').style.display = 'none';
    document.getElementById('user-search-results').style.display = 'none';
    
    if (initialGameId) {
        const game = allGames.find(g => g.game_id == initialGameId);
        if (game) {
            addGameToSelection(game);
        } else {
            console.error(`無法在 allGames 中自動帶入 ID 為 ${initialGameId} 的遊戲。`);
        }
    }
    
    flatpickr("#rental-due-date", {
        dateFormat: "Y-m-d",
        minDate: "today",
        defaultDate: new Date().fp_incr(2)
    });
    
    ui.showModal('#create-rental-modal');
}

function handleRentalGameBarcodeScan(rawValue) {
    const value = rawValue.trim();
    if (!value) return;

    const game = allGames.find(g => gameBarcodes(g).includes(value));
    if (!game) {
        ui.toast.error('掃描不到符合的商品條碼');
        return;
    }
    if (!(Number(game.for_rent_stock) > 0)) {
        ui.toast.error(`《${game.name}》目前沒有可租借庫存`);
        return;
    }
    addGameToSelection(game);
}

function addGameToSelection(game) {
    if (selectedRentalGames.has(game.game_id)) {
        ui.toast.info(`《${game.name}》已在租借清單中。`);
        return;
    }
    selectedRentalGames.set(game.game_id, game);
    const container = document.getElementById('rental-games-container');
    const tag = document.createElement('div');
    tag.className = 'selected-game-tag';
    tag.dataset.gameId = game.game_id;

    const inputStyle = 'width: 55px; padding: 2px 4px; border-radius: 4px; border: none; outline: none; color: #333; font-size: 0.85rem;';
    tag.innerHTML = `
        <span>${escapeHtml(game.name)}</span>
        <span class="tag-field-label">租金</span>
        <input type="number" class="game-rent-price-input" title="租金" style="${inputStyle}" min="0" value="${Number(game.rent_price) || 0}">
        <span class="tag-field-label">押金</span>
        <input type="number" class="game-deposit-input" title="押金" style="${inputStyle}" min="0" value="${Number(game.deposit) || 0}">
        <span class="tag-field-label">重量(g)</span>
        <input type="number" class="game-weight-input" title="重量(g)" style="${inputStyle}" min="0" required>
        <button type="button" class="remove-game-btn">&times;</button>
    `;

    container.appendChild(tag);
    document.getElementById('rental-game-search').value = '';
    document.getElementById('game-search-results').style.display = 'none';
    updateRentalPrice();
}

function updateRentalTotals() {
    let totalRent = 0, totalDeposit = 0;
    document.querySelectorAll('#rental-games-container .selected-game-tag').forEach(tag => {
        totalRent += Number(tag.querySelector('.game-rent-price-input')?.value) || 0;
        totalDeposit += Number(tag.querySelector('.game-deposit-input')?.value) || 0;
    });
    document.getElementById('rental-rent-price').value = totalRent;
    document.getElementById('rental-deposit').value = totalDeposit;
}

function updateRentalPrice() {
    updateRentalTotals();
    let maxLateFee = 50;
    selectedRentalGames.forEach(game => {
        if ((Number(game.late_fee_per_day) || 0) > maxLateFee) {
            maxLateFee = Number(game.late_fee_per_day);
        }
    });
    document.getElementById('rental-late-fee').value = maxLateFee;
}

async function handleCreateRentalFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');

    const phone = form.querySelector('#rental-contact-phone').value.trim();
    if (!phone) {
        const confirmed = await ui.confirm('聯絡電話為空，確定要繼續建立租借紀錄嗎？');
        if (!confirmed) return;
    }

    const gamesData = [];
    const gameElements = form.querySelectorAll('.selected-game-tag');
    gameElements.forEach(el => {
        gamesData.push({
            gameId: el.dataset.gameId,
            weight: el.querySelector('.game-weight-input').value,
            rentPrice: el.querySelector('.game-rent-price-input').value,
            deposit: el.querySelector('.game-deposit-input').value
        });
    });

    const data = {
        userId: form.querySelector('#rental-user-id').value || null,
        games: gamesData, // 每款遊戲各自帶自己的租金／押金，方便個別給優惠
        dueDate: form.querySelector('#rental-due-date').value,
        name: form.querySelector('#rental-contact-name').value.trim(),
        phone: phone,
        lateFeePerDay: form.querySelector('#rental-late-fee').value,
    };
    
    if (data.games.length === 0) return ui.toast.error('請至少選擇一款遊戲。');
    if (!data.name) return ui.toast.error('租借人姓名為必填。');

    button.disabled = true;
    button.textContent = '建立中...';
    try {
        const result = await api.createRental(data);
        ui.toast.success(result.message || '租借紀錄已建立！');
        ui.hideModal('#create-rental-modal');
        
        const currentStatus = rentalStatusFilter?.querySelector('.active')?.dataset.filter || 'all';
        init(null, currentStatus);
    } catch (error) {
        ui.toast.error(`建立失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '確認租借';
    }
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

    flatpickr(editRentalForm.querySelector('#edit-rental-due-date'), {
        dateFormat: "Y-m-d",
        defaultDate: rental.due_date
    });
    
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
        } catch (error) { ui.toast.error('載入訊息草稿失敗'); }
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

    const currentStatus = rentalStatusFilter?.querySelector('.active')?.dataset.filter || 'all';
    init(null, currentStatus); 
} catch (error) {
        ui.toast.error(`更新失敗: ${error.message}`);
    } finally {
        button.disabled = false;
    }
}


/**
 * 【核心修改】將建立租借視窗的事件監聽獨立成一個函式
 * 這個函式將由 app.js 在啟動時呼叫
 */
export function initializeCreateRentalModalEventListeners() {
    createRentalModal = document.getElementById('create-rental-modal');
    createRentalForm = document.getElementById('create-rental-form');
    if (!createRentalModal || !createRentalForm) return;

    const gameSearchInput = document.getElementById('rental-game-search');
    const gameSearchResults = document.getElementById('game-search-results');
    const userSearchInput = document.getElementById('rental-user-search');
    const userSearchResults = document.getElementById('user-search-results');

    // 同一個欄位同時支援「掃描槍掃條碼」與「打字搜尋名稱」：Enter 時先試條碼完全比對，
    // 比對不到但篩選結果剛好只有一筆時，也直接視為選定該款遊戲
    gameSearchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const value = gameSearchInput.value.trim();
        if (!value) return;

        const byBarcode = allGames.find(g => gameBarcodes(g).includes(value));
        if (byBarcode) {
            handleRentalGameBarcodeScan(value);
            gameSearchInput.value = '';
            gameSearchResults.style.display = 'none';
            return;
        }

        const term = value.toLowerCase();
        const results = allGames.filter(g => g.name.toLowerCase().includes(term) && g.for_rent_stock > 0);
        if (results.length === 1) {
            addGameToSelection(results[0]);
        }
    });

    document.getElementById('rental-games-container')?.addEventListener('input', (e) => {
        if (e.target.classList.contains('game-rent-price-input') || e.target.classList.contains('game-deposit-input')) {
            updateRentalTotals();
        }
    });

    gameSearchInput.addEventListener('input', () => {
        const term = gameSearchInput.value.toLowerCase();
        if (term.length < 1) {
            gameSearchResults.style.display = 'none';
            return;
        }
        if (allGames.length === 0) return;
        const results = allGames.filter(g => g.name.toLowerCase().includes(term) && g.for_rent_stock > 0);
        gameSearchResults.innerHTML = results.map(g => `<li data-game-id="${g.game_id}">${g.name} (庫存: ${g.for_rent_stock})</li>`).join('');
        gameSearchResults.style.display = results.length > 0 ? 'block' : 'none';
    });

    gameSearchResults.addEventListener('click', async (e) => {
        if (e.target.tagName === 'LI') {
            if (allGames.length === 0) {
                try {
                    allGames = await api.getProducts();
                } catch (err) {
                    ui.toast.error('無法獲取遊戲列表！');
                    return;
                }
            }
            
            const gameId = e.target.dataset.gameId;
    
            const game = allGames.find(g => g.game_id == gameId);
            
            if (game) {
                addGameToSelection(game);
            } else {
                console.error("錯誤：在 allGames 陣列中找不到 ID 為 " + gameId + " 的遊戲。");
                ui.toast.error("找不到該遊戲的詳細資料，請重試。");
            }
        }
    });

    document.getElementById('rental-games-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-game-btn')) {
            const tag = e.target.closest('.selected-game-tag');
            selectedRentalGames.delete(tag.dataset.gameId);
            tag.remove();
            updateRentalPrice();
        }
    });

    userSearchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.trim();
        createRentalForm.querySelector('#rental-user-id').value = '';
        
        if (searchTerm.length < 1) {
            userSearchResults.style.display = 'none';
            return;
        }
        try {
            const users = await api.searchUsers(searchTerm);
            userSearchResults.innerHTML = users.map(u => `<li data-user-id="${escapeHtml(u.user_id)}" data-name="${escapeHtml(u.nickname || u.line_display_name)}" data-phone="${escapeHtml(u.phone || '')}">${escapeHtml(u.nickname || u.line_display_name)} (${escapeHtml(u.user_id)})</li>`).join('');
            userSearchResults.style.display = users.length > 0 ? 'block' : 'none';
        } catch (error) { console.error('搜尋使用者失敗', error); }
    });
    
    userSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const target = e.target;
            createRentalForm.querySelector('#rental-user-id').value = target.dataset.userId;
            createRentalForm.querySelector('#rental-user-search').value = target.dataset.name;
            createRentalForm.querySelector('#rental-contact-name').value = target.dataset.name;
            createRentalForm.querySelector('#rental-contact-phone').value = target.dataset.phone;
            userSearchResults.style.display = 'none';
        }
    });

    createRentalForm.addEventListener('submit', handleCreateRentalFormSubmit);
}
 
  
/**
 * 綁定此頁面所有需要一次性設定的事件監聽器
 */
function setupEventListeners() {
    const page = document.getElementById('page-rentals');
    if (page.dataset.initialized) return;

    rentalSearchInput.addEventListener('input', applyFiltersAndRender);

    rentalSearchInput.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && rentalSearchInput.value.trim()) {
            e.preventDefault();
            addRentalSearchChip(rentalSearchInput.value.trim());
            rentalSearchInput.value = '';
        } else if (e.key === 'Backspace' && rentalSearchInput.value === '' && rentalSearchChips.length > 0) {
            removeRentalSearchChip(rentalSearchChips[rentalSearchChips.length - 1]);
        }
    });

    document.getElementById('rental-search-container')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-remove')) {
            removeRentalSearchChip(e.target.dataset.chip);
        } else {
            rentalSearchInput.focus();
        }
    });

rentalStatusFilter.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {

            const status = e.target.dataset.filter;
            if (status === 'all') {
                window.location.hash = '#rentals';
            } else {
                window.location.hash = `#rentals@${status}`;
            }
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
        await init(null, rentalStatusFilter.querySelector('.active').dataset.filter);
    } catch (error) {
                    ui.toast.error(`操作失敗: ${error.message}`);
                }
            }
        } else if (target.classList.contains('btn-manage-rental')) {
            const rentalId = parseInt(target.dataset.rentalId, 10);
            openEditRentalModal(rentalId);
        }
    });
    
    const gameSearchInput = document.getElementById('rental-game-search');
    const gameSearchResults = document.getElementById('game-search-results');
    
    gameSearchInput.addEventListener('input', () => {
        const term = gameSearchInput.value.toLowerCase();
        if (term.length < 1) {
            gameSearchResults.style.display = 'none';
            return;
        }
        const results = allGames.filter(g => g.name.toLowerCase().includes(term) && g.for_rent_stock > 0);
        gameSearchResults.innerHTML = results.map(g => `<li data-game-id="${g.game_id}">${g.name} (庫存: ${g.for_rent_stock})</li>`).join('');
        gameSearchResults.style.display = results.length > 0 ? 'block' : 'none';
    });

    gameSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const game = allGames.find(g => g.game_id === e.target.dataset.gameId);
            if (game) addGameToSelection(game);
        }
    });

    document.getElementById('rental-games-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-game-btn')) {
            const tag = e.target.closest('.selected-game-tag');
            selectedRentalGames.delete(tag.dataset.gameId);
            tag.remove();
            updateRentalPrice();
        }
    });

    const userSearchInput = document.getElementById('rental-user-search');
    const userSearchResults = document.getElementById('user-search-results');

    userSearchInput.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.trim();
        createRentalForm.querySelector('#rental-user-id').value = '';
        
        if (searchTerm.length < 1) {
            userSearchResults.style.display = 'none';
            return;
        }
        try {
            const users = await api.searchUsers(searchTerm);
            userSearchResults.innerHTML = users.map(u => `<li data-user-id="${escapeHtml(u.user_id)}" data-name="${escapeHtml(u.nickname || u.line_display_name)}" data-phone="${escapeHtml(u.phone || '')}">${escapeHtml(u.nickname || u.line_display_name)} (${escapeHtml(u.user_id)})</li>`).join('');
            userSearchResults.style.display = users.length > 0 ? 'block' : 'none';
        } catch (error) { console.error('搜尋使用者失敗', error); }
    });
    
    userSearchResults.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const target = e.target;
            createRentalForm.querySelector('#rental-user-id').value = target.dataset.userId;
            createRentalForm.querySelector('#rental-user-search').value = ''; // 清空搜尋框
            createRentalForm.querySelector('#rental-contact-name').value = target.dataset.name;
            createRentalForm.querySelector('#rental-contact-phone').value = target.dataset.phone;
            userSearchResults.style.display = 'none';
        }
    });

    createRentalForm.addEventListener('submit', handleCreateRentalFormSubmit);
    editRentalForm.addEventListener('submit', handleEditRentalFormSubmit);

    page.dataset.initialized = 'true';
}

export const init = async (context, initialStatus) => {
    const page = document.getElementById('page-rentals');
    rentalListTbody = page.querySelector('#rental-list-tbody');
    rentalSearchInput = page.querySelector('#rental-search-input');
    rentalStatusFilter = page.querySelector('#rental-status-filter');
    editRentalModal = document.getElementById('edit-rental-modal');
    editRentalForm = document.getElementById('edit-rental-form');

    if (!rentalListTbody) return;
    
    const status = initialStatus || 'all';

    if (rentalStatusFilter) {
        rentalStatusFilter.querySelector('.active')?.classList.remove('active');
        const newActiveButton = rentalStatusFilter.querySelector(`button[data-filter="${status}"]`);
        if (newActiveButton) {
            newActiveButton.classList.add('active');
        }
    }
    
    rentalListTbody.innerHTML = '<tr><td colspan="6">正在載入租借紀錄...</td></tr>';
    try {
        allRentals = await api.getAllRentals(status);
        allRentals.sort((a, b) => b.rental_id - a.rental_id);
        renderRentalSearchChips();
        applyFiltersAndRender();
        setupEventListeners();
    } catch (error) {
        console.error('載入租借紀錄失敗:', error);
        rentalListTbody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    }
};
