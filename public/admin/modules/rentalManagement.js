// public/admin/modules/rentalManagement.js (最新修正版 - 2025-11-08)
// 【核心修正】此版本強制將 game_id 視為「數字 (Number)」處理，以匹配你的資料庫。
// 【快取修正】強制重新載入 allGames，解決 Stale Cache 問題。
import { api } from '../api.js';
import { ui } from '../ui.js';

let allRentals = [];
let allDrafts = [];
let allGames = []; // 這個變數是問題點，我們將強制更新它
let selectedRentalGames = new Map();

let rentalListTbody, rentalSearchInput, rentalStatusFilter,
    editRentalModal, editRentalForm, sortDueDateBtn,
    createRentalModal, createRentalForm;

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
            <td>${rental.game_name || '遊戲資料遺失'}</td>
            <td class="compound-cell"><div class="main-info">${displayName}</div>${subInfo}</td>
            <td>${rental.due_date}</td>
            <td>${rental.return_date || '尚未歸還'}</td>
            <td class="actions-cell">
                <button class="action-btn btn-return-rental" data-rental-id="${rental.rental_id}" style="background-color: var(--success-color);" ${rental.status === 'returned' ? 'disabled' : ''}>歸還</button>
                <button class="action-btn btn-manage-rental" data-rental-id="${rental.rental_id}" style="background-color: var(--info-color);">管理</button>
            </td>
        `;
    });
}
function applyFiltersAndRender() {
    if (!rentalSearchInput || !rentalStatusFilter) return; // 防呆
    
    const searchTerm = rentalSearchInput.value.toLowerCase().trim();
    const statusFilter = rentalStatusFilter.querySelector('.active').dataset.filter;
    let filteredRentals = allRentals;
    if (statusFilter !== 'all') {
        
        if (statusFilter === 'rented') {
            // "租借中" 應該包含所有未歸還的 (租借中、今日到期、已逾期)
            const activeRentalStates = ['rented', 'due_today', 'overdue'];
            filteredRentals = allRentals.filter(r => activeRentalStates.includes(r.derived_status));
        } else {
            filteredRentals = allRentals.filter(r => r.derived_status === statusFilter);
        }
    }

    if (searchTerm) {
        filteredRentals = filteredRentals.filter(r =>
            (r.game_name || '').toLowerCase().includes(searchTerm) ||
            (r.nickname || '').toLowerCase().includes(searchTerm) ||
            (r.line_display_name || '').toLowerCase().includes(searchTerm)
        );
    }
    renderRentalList(filteredRentals);
}
// --- 建立租借相關功能 ---

export async function openCreateRentalModal(initialGameId) {
    createRentalModal = document.getElementById('create-rental-modal');
    createRentalForm = document.getElementById('create-rental-form');
    if (!createRentalModal || !createRentalForm) {
        return ui.toast.error("HTML 結構錯誤：找不到 create-rental-modal。");
    }

    // 【!! 核心修正 1：移除 if (allGames.length === 0) 檢查，強制重新載入 !!】
    try {
        allGames = await api.getProducts();
    } catch (e) {
        return ui.toast.error('無法載入遊戲列表，無法開啟租借視窗。');
    }
    
    createRentalForm.reset();
    createRentalForm.querySelector('#rental-user-id').value = '';
    selectedRentalGames.clear();
    document.getElementById('rental-games-container').innerHTML = '';
    document.getElementById('game-search-results').style.display = 'none';
    document.getElementById('user-search-results').style.display = 'none';
    
    if (initialGameId) {
        // 【!! 核心修正 1 !!】 (此為舊修正，保留)
        // 比較時，兩邊都轉為數字
        const game = allGames.find(g => Number(g.game_id) == Number(initialGameId));
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

function addGameToSelection(game) {
    // 【!! 核心修正 2 !!】 (此為舊修正，保留)
    // 強制轉為數字
    const gameIdNum = Number(game.game_id);

    if (selectedRentalGames.has(gameIdNum)) { // 使用數字 key 檢查
        ui.toast.info(`《${game.name}》已在租借清單中。`);
        return;
    }
    selectedRentalGames.set(gameIdNum, game); // 使用數字 key 儲存
    
    const container = document.getElementById('rental-games-container');
    const tag = document.createElement('div');
    tag.className = 'selected-game-tag';
    tag.dataset.gameId = gameIdNum; // data- 屬性會自動轉為字串，但我們刪除時會再轉回來
    tag.innerHTML = `<span>${game.name}</span><button type="button" class="remove-game-btn">&times;</button>`;
    container.appendChild(tag);
    document.getElementById('rental-game-search').value = '';
    document.getElementById('game-search-results').style.display = 'none';
    updateRentalPrice();
}

function updateRentalPrice() {
    let totalRent = 0, totalDeposit = 0, maxLateFee = 50;
    selectedRentalGames.forEach(game => {
        totalRent += Number(game.rent_price) || 0;
        totalDeposit += Number(game.deposit) || 0;
        if ((Number(game.late_fee_per_day) || 0) > maxLateFee) {
            maxLateFee = Number(game.late_fee_per_day);
        }
    });
    document.getElementById('rental-rent-price').value = totalRent;
    document.getElementById('rental-deposit').value = totalDeposit;
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

    const data = {
        userId: form.querySelector('#rental-user-id').value || null,
        gameIds: [...selectedRentalGames.keys()], // 這裡會是數字 [383]
        dueDate: form.querySelector('#rental-due-date').value,
        name: form.querySelector('#rental-contact-name').value.trim(),
        phone: phone,
        rentPrice: form.querySelector('#rental-rent-price').value,
        deposit: form.querySelector('#rental-deposit').value,
        lateFeePerDay: form.querySelector('#rental-late-fee').value,
    };
    
    if (data.gameIds.length === 0) return ui.toast.error('請至少選擇一款遊戲。');
    if (!data.name) return ui.toast.error('租借人姓名為必填。');

    button.disabled = true;
    button.textContent = '建立中...';
    try {
        const result = await api.createRental(data);
        ui.toast.success(result.message || '租借紀錄已建立！');
        ui.hideModal('#create-rental-modal');
        // 傳遞目前選擇的 filter 重新整理
        const activeFilter = rentalStatusFilter ? rentalStatusFilter.querySelector('.active').dataset.filter : 'all';
        init(null, activeFilter); 
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
        // 傳遞目前選擇的 filter 重新整理
        const activeFilter = rentalStatusFilter ? rentalStatusFilter.querySelector('.active').dataset.filter : 'all';
        init(null, activeFilter);
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
            
            const gameId = e.target.dataset.gameId; // 這是字串 "383"
    
            // 【!! 核心修正 3 !!】 (此為舊修正，保留)
            // 比較時，兩邊都轉為數字
            const game = allGames.find(g => Number(g.game_id) === Number(gameId));
            
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
            // 【!! 核心修正 4 !!】 (此為舊修正，保留)
            // 刪除時，也使用數字 key
            selectedRentalGames.delete(Number(tag.dataset.gameId)); 
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
            userSearchResults.innerHTML = users.map(u => `<li data-user-id="${u.user_id}" data-name="${u.nickname || u.line_display_name}" data-phone="${u.phone || ''}">${u.nickname || u.line_display_name} (${u.user_id})</li>`).join('');
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
                    // 傳遞目前選擇的 filter 重新整理
                    const activeFilter = rentalStatusFilter ? rentalStatusFilter.querySelector('.active').dataset.filter : 'all';
                    await init(null, activeFilter);
                } catch (error) {
                    ui.toast.error(`操作失敗: ${error.message}`);
                }
            }
        } else if (target.classList.contains('btn-manage-rental')) {
            const rentalId = parseInt(target.dataset.rentalId, 10);
            openEditRentalModal(rentalId);
        }
    });
    
    // --- 建立租借視窗的事件監聽 ---
    // 這部分邏輯已由 initializeCreateRentalModalEventListeners 處理
    // 但為避免 app.js 呼叫順序問題，我們保留一個檢查
    // (如果 init 比 app.js 的 initialize... 早執行，這些還是需要的)
    
    const gameSearchInput = document.getElementById('rental-game-search');
    const gameSearchResults = document.getElementById('game-search-results');
    
    if (gameSearchInput) {
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
    }

    if (gameSearchResults) {
        gameSearchResults.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                // 【!! 核心修正 5 !!】 (此為舊修正，保留)
                const gameId = e.target.dataset.gameId;
                const game = allGames.find(g => Number(g.game_id) === Number(gameId));
                if (game) addGameToSelection(game);
            }
        });
    }

    const rentalGamesContainer = document.getElementById('rental-games-container');
    if (rentalGamesContainer) {
        rentalGamesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-game-btn')) {
                const tag = e.target.closest('.selected-game-tag');
                // 【!! 核心修正 6 !!】 (此為舊修正，保留)
                selectedRentalGames.delete(Number(tag.dataset.gameId));
                tag.remove();
                updateRentalPrice();
            }
        });
    }

    const userSearchInput = document.getElementById('rental-user-search');
    const userSearchResults = document.getElementById('user-search-results');

    if (userSearchInput) {
        userSearchInput.addEventListener('input', async (e) => {
            const searchTerm = e.target.value.trim();
            if (createRentalForm) createRentalForm.querySelector('#rental-user-id').value = '';
            
            if (searchTerm.length < 1) {
                if (userSearchResults) userSearchResults.style.display = 'none';
                return;
            }
            try {
                const users = await api.searchUsers(searchTerm);
                if (userSearchResults) {
                    userSearchResults.innerHTML = users.map(u => `<li data-user-id="${u.user_id}" data-name="${u.nickname || u.line_display_name}" data-phone="${u.phone || ''}">${u.nickname || u.line_display_name} (${u.user_id})</li>`).join('');
                    userSearchResults.style.display = users.length > 0 ? 'block' : 'none';
                }
            } catch (error) { console.error('搜尋使用者失敗', error); }
        });
    }
    
    if (userSearchResults) {
        userSearchResults.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const target = e.target;
                if (createRentalForm) {
                    createRentalForm.querySelector('#rental-user-id').value = target.dataset.userId;
                    createRentalForm.querySelector('#rental-user-search').value = ''; // 清空搜尋框
                    createRentalForm.querySelector('#rental-contact-name').value = target.dataset.name;
                    createRentalForm.querySelector('#rental-contact-phone').value = target.dataset.phone;
                }
                userSearchResults.style.display = 'none';
            }
        });
    }

    if (createRentalForm) createRentalForm.addEventListener('submit', handleCreateRentalFormSubmit);
    if (editRentalForm) editRentalForm.addEventListener('submit', handleEditRentalFormSubmit);

    page.dataset.initialized = 'true';
}

export const init = async (context, initialStatus) => {
    const page = document.getElementById('page-rentals');
    rentalListTbody = page.querySelector('#rental-list-tbody');
    rentalSearchInput = page.querySelector('#rental-search-input');
    rentalStatusFilter = page.querySelector('#rental-status-filter');
    editRentalModal = document.getElementById('edit-rental-modal');
    editRentalForm = document.getElementById('edit-rental-form');
    
    // 確保 createRentalModal 和 createRentalForm 也被賦值
    createRentalModal = document.getElementById('create-rental-modal');
    createRentalForm = document.getElementById('create-rental-form');

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
        // 【!! 核心修正 2：修改 Promise.all，強制重新載入 allGames !!】
        const [rentals, games] = await Promise.all([
            api.getAllRentals(status),
            api.getProducts() // 強制重新獲取
        ]);
        
        allRentals = rentals;
        allGames = games; // 覆蓋舊的快取

        applyFiltersAndRender();
        setupEventListeners();
    } catch (error) {
        console.error('載入租借紀錄失敗:', error);
        rentalListTbody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    }
};