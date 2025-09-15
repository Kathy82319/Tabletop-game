// public/admin-login.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素宣告 ---
    const mainNav = document.querySelector('.nav-tabs');
    const pages = document.querySelectorAll('.page');
    const expHistoryTbody = document.getElementById('exp-history-tbody');
    const expUserFilter = document.getElementById('exp-user-filter');
    const userListTbody = document.getElementById('user-list-tbody');
    const userSearchInput = document.getElementById('user-search-input');
    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const syncD1ToSheetBtn = document.getElementById('sync-d1-to-sheet-btn');
    const editGameModal = document.getElementById('edit-game-modal');
    const editGameForm = document.getElementById('edit-game-form');

    // 庫存管理
    const gameListTbody = document.getElementById('game-list-tbody');
    const gameSearchInput = document.getElementById('game-search-input');
    const editGameModal = document.getElementById('edit-game-modal');

    // 訂位管理
    const bookingListTbody = document.getElementById('booking-list-tbody');

    // **【修正處】** 新增所有租借管理頁面會用到的元素宣告
    const rentalListTbody = document.getElementById('rental-list-tbody');
    const createRentalModal = document.getElementById('create-rental-modal');
    const createRentalForm = document.getElementById('create-rental-form');
    const syncRentalsBtn = document.getElementById('sync-rentals-btn');
    const rentalStatusFilter = document.getElementById('rental-status-filter');
    const rentalSearchInput = document.getElementById('rental-search-input');

    // 情報管理
    const newsListTbody = document.getElementById('news-list-tbody');
    const addNewsBtn = document.getElementById('add-news-btn');
    const editNewsModal = document.getElementById('edit-news-modal');
    const editNewsForm = document.getElementById('edit-news-form');
    const modalNewsTitle = document.getElementById('modal-news-title');
    const deleteNewsBtn = document.getElementById('delete-news-btn');
    
    // 店家資訊
    const storeInfoForm = document.getElementById('store-info-form');

    // 掃碼加點
    const qrReaderElement = document.getElementById('qr-reader');
    const scanResultSection = document.getElementById('scan-result');
    const userIdDisplay = document.getElementById('user-id-display');
    const reasonSelect = document.getElementById('reason-select');
    const customReasonInput = document.getElementById('custom-reason-input');
    const expInput = document.getElementById('exp-input');
    const submitExpBtn = document.getElementById('submit-exp-btn');
    const rescanBtn = document.getElementById('rescan-btn');
    const scanStatusMessage = document.getElementById('scan-status-message');

    // --- 全域狀態變數 ---
    let allUsers = [], allGames = [], allRentals = [], allBookings = [], allExpHistory = [], allNews = [];
    let classPerks = {};
    let gameFilters = { visibility: 'all' };
    let rentalFilters = { status: 'all', keyword: '' };
    let html5QrCode = null;
    let currentEditingNewsId = null;
    let selectedRentalUser = null;

    // ---- 頁面切換邏輯 ----
    function showPage(pageId) {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("停止掃描器失敗", err));
        }
        pages.forEach(page => page.classList.remove('active'));
        const pageElement = document.getElementById(`page-${pageId}`);
        if(pageElement) pageElement.classList.add('active');

        document.querySelectorAll('.nav-tabs a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) link.classList.add('active');
        });

        if (pageId === 'users' && allUsers.length === 0) fetchAllUsers();
        if (pageId === 'inventory') fetchAllGames();
        if (pageId === 'bookings' && allBookings.length === 0) fetchAllBookings();
        if (pageId === 'exp-history' && allExpHistory.length === 0) initializeExpHistoryPage();
        if (pageId === 'scan') startScanner();
        if (pageId === 'news' && allNews.length === 0) fetchAllNews();
        if (pageId === 'store-info') fetchStoreInfo();
        if (pageId === 'rentals' && allRentals.length === 0) fetchAllRentals();
    }

    mainNav.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const pageId = event.target.getAttribute('href').substring(1);
            showPage(pageId);
        }
    });


    // =================================================================
    // 顧客管理模組
    // =================================================================
    function renderUserList(users) {
        if (!userListTbody) return;
        userListTbody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.user_id;
            // ** START: 關鍵修正 - 顯示職業 **
            row.innerHTML = `
                <td style="text-align: left; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${user.line_display_name || 'N/A'}</td>
                <td>${user.level}</td>
                <td>${user.current_exp} / 10</td>
                <td>${user.class || '無'}</td>
                <td><span class="tag-display">${user.tag || '無'}</span></td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-userid="${user.user_id}">編輯</button>
                    <button class="action-btn btn-sync" data-userid="${user.user_id}">同步</button>
                </td>
            `;
            // ** END: 關鍵修正 **
            userListTbody.appendChild(row);
        });
    }

    async function fetchAllUsers() {
        try {
            const response = await fetch('/api/get-users');
            if (!response.ok) throw new Error('無法獲取使用者列表');
            allUsers = await response.json();
            renderUserList(allUsers);
        } catch (error) { console.error('獲取使用者列表失敗:', error); }
    }

    // 按鈕的事件監聽器 (獨立區塊)
    if (syncD1ToSheetBtn) {
        syncD1ToSheetBtn.addEventListener('click', async () => {
            if (!confirm('確定要用目前資料庫 (D1) 的所有使用者資料，完整覆蓋 Google Sheet 上的「使用者列表」嗎？\n\n這個操作通常用於手動備份。')) return;
            
            try {
                syncD1ToSheetBtn.textContent = '同步中...';
                syncD1ToSheetBtn.disabled = true;
                
                const response = await fetch('/api/sync-d1-to-sheet', { method: 'POST' });
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.details || '同步失敗');
                }
                
                alert(result.message || '同步成功！');

            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                syncD1ToSheetBtn.textContent = '同步至 Google Sheet';
                syncD1ToSheetBtn.disabled = false;
            }
        });
    }

    // 搜尋框的事件監聽器 (獨立區塊，從上面移出來)
    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.toLowerCase().trim();
        const filteredUsers = searchTerm ? allUsers.filter(user => (user.line_display_name || '').toLowerCase().includes(searchTerm)) : allUsers;
        renderUserList(filteredUsers);
    });

 // ** START: 關鍵修正 - 全面重構編輯 Modal 邏輯 **
    function openEditUserModal(userId) {
        const user = allUsers.find(u => u.user_id === userId);
        if (!user) return;

        // 填充基本資料
        document.getElementById('modal-user-title').textContent = `編輯：${user.line_display_name}`;
        document.getElementById('edit-user-id').value = user.user_id;
        document.getElementById('edit-level-input').value = user.level;
        document.getElementById('edit-exp-input').value = user.current_exp;

        // 獲取所有表單元素
        const classSelect = document.getElementById('edit-class-select');
        const otherClassInput = document.getElementById('edit-class-other-input');
        const perkSelect = document.getElementById('edit-perk-select');
        const otherPerkInput = document.getElementById('edit-perk-other-input');
        const tagSelect = document.getElementById('edit-tag-select');
        const otherTagInput = document.getElementById('edit-tag-other-input');

        // --- 動態填充職業和福利下拉選單 ---
        classSelect.innerHTML = '';
        perkSelect.innerHTML = '';
        
        // 根據 classPerks 物件建立選項
        for (const className in classPerks) {
            const classOption = document.createElement('option');
            classOption.value = className;
            classOption.textContent = className;
            classSelect.appendChild(classOption);

            const perkOption = document.createElement('option');
            perkOption.value = classPerks[className];
            perkOption.textContent = classPerks[className];
            perkSelect.appendChild(perkOption);
        }

        // 為兩個下拉選單都加上 "其他" 選項
        classSelect.appendChild(new Option('其他 (自訂)', 'other'));
        perkSelect.appendChild(new Option('其他 (自訂)', 'other'));

        // --- 設定表單的預設值 ---
        
        // 1. 設定職業 (Class)
        if (classPerks[user.class]) { // 如果是標準職業
            classSelect.value = user.class;
            otherClassInput.style.display = 'none';
        } else { // 如果是自訂或其他
            classSelect.value = 'other';
            otherClassInput.style.display = 'block';
            otherClassInput.value = user.class || '';
        }

        // 2. 設定福利 (Perk)
        const standardPerks = Object.values(classPerks);
        if (standardPerks.includes(user.perk)) { // 如果是標準福利
            perkSelect.value = user.perk;
            otherPerkInput.style.display = 'none';
        } else { // 如果是自訂福利
            perkSelect.value = 'other';
            otherPerkInput.style.display = 'block';
            otherPerkInput.value = user.perk || '';
        }

        // 3. 設定標籤 (Tag) - 邏輯不變
        const standardTags = ["", "會員", "員工", "特殊"];
        if (user.tag && !standardTags.includes(user.tag)) {
            tagSelect.value = 'other';
            otherTagInput.style.display = 'block';
            otherTagInput.value = user.tag;
        } else {
            tagSelect.value = user.tag || '';
            otherTagInput.style.display = 'none';
            otherTagInput.value = '';
        }

        editUserModal.style.display = 'flex';
    }

    // --- 設定下拉選單連動和 "其他" 輸入框的顯示邏輯 ---
    document.getElementById('edit-class-select').addEventListener('change', (e) => {
        const otherClassInput = document.getElementById('edit-class-other-input');
        const perkSelect = document.getElementById('edit-perk-select');
        const otherPerkInput = document.getElementById('edit-perk-other-input');
        
        if (e.target.value === 'other') {
            otherClassInput.style.display = 'block';
            perkSelect.value = 'other'; // 選了自訂職業，福利也應該是自訂
            otherPerkInput.style.display = 'block';
        } else {
            otherClassInput.style.display = 'none';
            perkSelect.value = classPerks[e.target.value]; // 自動選擇對應的福利
            otherPerkInput.style.display = 'none';
        }
    });

    document.getElementById('edit-perk-select').addEventListener('change', (e) => {
        document.getElementById('edit-perk-other-input').style.display = (e.target.value === 'other') ? 'block' : 'none';
    });
    
    document.getElementById('edit-tag-select').addEventListener('change', (e) => {
        document.getElementById('edit-tag-other-input').style.display = (e.target.value === 'other') ? 'block' : 'none';
    });

    editUserModal.querySelector('.modal-close').addEventListener('click', () => editUserModal.style.display = 'none');
    editUserModal.querySelector('.btn-cancel').addEventListener('click', () => editUserModal.style.display = 'none');

    // --- 更新表單提交邏輯 ---
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        
        // 獲取職業值
        let newClass = document.getElementById('edit-class-select').value;
        if (newClass === 'other') newClass = document.getElementById('edit-class-other-input').value.trim();

        // 獲取福利值
        let newPerk = document.getElementById('edit-perk-select').value;
        if (newPerk === 'other') newPerk = document.getElementById('edit-perk-other-input').value.trim();
        
        // 獲取標籤值
        let newTag = document.getElementById('edit-tag-select').value;
        if (newTag === 'other') newTag = document.getElementById('edit-tag-other-input').value.trim();

        const updatedData = {
            userId: userId,
            level: document.getElementById('edit-level-input').value,
            current_exp: document.getElementById('edit-exp-input').value,
            tag: newTag,
            user_class: newClass,
            perk: newPerk // 新增 perk
        };

        try {
            const response = await fetch('/api/update-user-details', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');
            
            const user = allUsers.find(u => u.user_id === userId);
            if (user) {
                user.level = updatedData.level;
                user.current_exp = updatedData.current_exp;
                user.tag = updatedData.tag;
                user.class = updatedData.user_class;
                user.perk = updatedData.perk;
            }
            
            renderUserList(allUsers); // 直接渲染 allUsers 即可
            editUserModal.style.display = 'none';

        } catch (error) { alert(`錯誤：${error.message}`); }
    });
    // ** END: 關鍵修正 **

    userListTbody.addEventListener('click', async (event) => {
        const target = event.target;
        const userId = target.dataset.userid;
        if (!userId) return;
        
        if (target.classList.contains('btn-edit')) {
            openEditUserModal(userId);
        }
        
        if (target.classList.contains('btn-sync')) {
            // ** START: 關鍵修正 - 加入強烈警告 **
            if (!confirm(`警告：此操作將使用 Google Sheet 的資料覆蓋此使用者 (${userId}) 在資料庫中的資料。\n\n僅在確認資料庫資料異常時使用。\n\n確定要繼續嗎？`)) return;
            // ** END: 關鍵修正 **
            
            try {
                target.textContent = '還原中...';
                target.disabled = true;
                const response = await fetch('/api/sync-user-from-sheet', { // API 端點不變
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error || '還原失敗');
                alert('還原成功！將重新整理列表資料。');
                await fetchAllUsers(); // 重新獲取資料以更新畫面
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                target.textContent = '同步';
                target.disabled = false;
            }
        }
    });

    // =================================================================
    // 庫存管理模組
    // =================================================================
    function applyGameFiltersAndRender() {
        if (!allGames) return;
        const searchTerm = gameSearchInput.value.toLowerCase().trim();
        // 移除 is_visible 的篩選
        let filteredGames = allGames.filter(game => 
            (game.name || '').toLowerCase().includes(searchTerm)
        );
        renderGameList(filteredGames);
    }

    function renderGameList(games) {
        if (!gameListTbody) return;
        gameListTbody.innerHTML = '';
        games.forEach(game => {
            const row = document.createElement('tr');
            const isVisible = game.is_visible === 1 || String(game.is_visible).toUpperCase() === 'TRUE';
            row.innerHTML = `
                <td class="compound-cell">
                    <div class="main-info">${game.name}</div>
                    <div class="sub-info">ID: ${game.game_id}</div>
                </td>
                <td>${game.for_rent_stock}</td>
                <td>${isVisible ? '是' : '否'}</td>
                <td class="actions-cell" style="display: flex; gap: 5px; justify-content: center;">
                    <button class="action-btn btn-rent" data-gameid="${game.game_id}" style="background-color: #007bff;">出借</button>
                    <button class="action-btn btn-edit-game" data-gameid="${game.game_id}" style="background-color: #ffc107; color: #000;">編輯</button>
                </td>
            `;
            gameListTbody.appendChild(row);
        });
    }


    async function fetchAllGames() {
        try {
            const response = await fetch('/api/get-sheet-boardgames');
            if (!response.ok) throw new Error('從 Sheet 獲取桌遊列表失敗');
            allGames = await response.json();
            applyGameFiltersAndRender();
        } catch (error) { 
            console.error('獲取桌遊列表失敗:', error);
            if(gameListTbody) gameListTbody.innerHTML = `<tr><td colspan="4" style="color: red;">讀取資料失敗</td></tr>`;
        }
    }

    // 【修正 #3】 確保事件監聽器只被建立一次
    if (gameSearchInput) {
        gameSearchInput.addEventListener('input', applyGameFiltersAndRender);
    }
    
    if (gameListTbody) {
        gameListTbody.addEventListener('click', (e) => {
            const target = e.target;
            const gameId = target.dataset.gameid;
            if (!gameId) return;

            if (target.classList.contains('btn-rent')) {
                openCreateRentalModal(gameId);
            }
            if (target.classList.contains('btn-edit-game')) {
                openEditGameModal(gameId);
            }
        });
    }

// 輔助函式，用於設定篩選按鈕的通用邏輯
function setupFilterButtons(filterContainer, filterKey) {
    if (!filterContainer) return;
    filterContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const currentActive = filterContainer.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            e.target.classList.add('active');
            gameFilters[filterKey] = e.target.dataset.filter;
            applyGameFiltersAndRender();
        }
    });
    }
    setupFilterButtons(visibilityFilter, 'visibility');
    // ** START: 關鍵修正 - 移除對 rentalTypeFilter 的事件綁定 **
    // setupFilterButtons(rentalTypeFilter, 'rentalType');
    // ** END: 關鍵修正 **

    // 【新增 #4】 新增 openEditGameModal 和相關邏輯
    function openEditGameModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) return alert('找不到遊戲資料');

        editGameForm.reset();
        document.getElementById('modal-game-title').textContent = `編輯：${game.name}`;
        document.getElementById('edit-game-id').value = game.game_id;
        document.getElementById('edit-for-rent-stock').value = game.for_rent_stock || 0;
        document.getElementById('edit-sale-price').value = game.sale_price || 0;
        document.getElementById('edit-rent-price').value = game.rent_price || 0;
        document.getElementById('edit-is-visible').checked = game.is_visible === 1 || String(game.is_visible).toUpperCase() === 'TRUE';
        
        editGameModal.style.display = 'flex';
    }
    
    editGameModal.querySelector('.modal-close').addEventListener('click', () => editGameModal.style.display = 'none');
    editGameModal.querySelector('.btn-cancel').addEventListener('click', () => editGameModal.style.display = 'none');

    editGameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const gameId = document.getElementById('edit-game-id').value;
        
        const updatedData = {
            gameId: gameId,
            for_rent_stock: document.getElementById('edit-for-rent-stock').value,
            sale_price: document.getElementById('edit-sale-price').value,
            rent_price: document.getElementById('edit-rent-price').value,
            is_visible: document.getElementById('edit-is-visible').checked
        };

        try {
            const response = await fetch('/api/admin/update-boardgame-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');
            
            // 更新本地資料
            const game = allGames.find(g => g.game_id === gameId);
            if (game) {
                game.for_rent_stock = updatedData.for_rent_stock;
                game.sale_price = updatedData.sale_price;
                game.rent_price = updatedData.rent_price;
                game.is_visible = updatedData.is_visible ? 1 : 0;
            }
            
            applyGameFiltersAndRender();
            editGameModal.style.display = 'none';
            alert('更新成功！');

        } catch (error) {
            alert(`錯誤：${error.message}`);
        }
    });


// =================================================================
// 桌遊租借模組
// =================================================================
    function applyRentalFiltersAndRender() {
        if (!allRentals) return;
        const keyword = rentalSearchInput.value.toLowerCase().trim();
        let filteredRentals = allRentals.filter(rental => {
            // **【修正 #2】** 篩選邏輯，rented 代表未歸還
            const statusMatch = rentalFilters.status === 'all' || rental.status === rentalFilters.status;
            const keywordMatch = !keyword || 
                                 (rental.game_name || '').toLowerCase().includes(keyword) ||
                                 (rental.nickname || rental.line_display_name || '').toLowerCase().includes(keyword);
            return statusMatch && keywordMatch;
        });
        renderRentalList(filteredRentals);
    }

    function renderRentalList(rentals) {
        if (!rentalListTbody) return;
        rentalListTbody.innerHTML = '';
        rentals.forEach(rental => {
            const row = document.createElement('tr');
            const userName = rental.nickname || rental.line_display_name || '未知用戶';
            let statusBadge = '';
            switch(rental.status) {
                case 'rented': statusBadge = '<span style="background-color: #ffc107; color: #000; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">租借中</span>'; break;
                case 'returned': statusBadge = '<span style="background-color: #28a745; color: #fff; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">已歸還</span>'; break;
                default: statusBadge = `<span>${rental.status}</span>`;
            }
            row.innerHTML = `
                <td>${statusBadge}</td>
                <td>${rental.game_name}</td>
                <td>${userName}</td>
                <td>${rental.due_date}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-return" data-rentalid="${rental.rental_id}" style="background-color:#17a2b8;" ${rental.status === 'returned' ? 'disabled' : ''}>歸還</button>
                </td>
            `;
            rentalListTbody.appendChild(row);
        });
    }

    async function fetchAllRentals() {
        try {
            const response = await fetch('/api/admin/get-all-rentals');
            if (!response.ok) throw new Error('無法獲取租借列表');
            allRentals = await response.json();
            applyRentalFiltersAndRender();
        } catch (error) { console.error('獲取租借列表失敗:', error); }
    }

        // 【修正 #3】 確保事件監聽器只被建立一次
    if (rentalStatusFilter) {
        rentalStatusFilter.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                rentalStatusFilter.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                rentalFilters.status = e.target.dataset.filter;
                applyRentalFiltersAndRender();
            }
        });
    }

    if(rentalSearchInput) {
        rentalSearchInput.addEventListener('input', () => {
            rentalFilters.keyword = rentalSearchInput.value;
            applyRentalFiltersAndRender();
        });
    }

    if (rentalListTbody) {
        rentalListTbody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-return')) {
                // ... (歸還按鈕的邏輯不變) ...
            }
        });
    }

    function openCreateRentalModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) { alert('找不到遊戲資料！'); return; }
        createRentalForm.reset();
        selectedRentalUser = null;
        document.getElementById('rental-user-select').style.display = 'none';
        document.getElementById('rental-game-id').value = game.game_id;
        document.getElementById('rental-game-name').value = game.name;
        document.getElementById('rental-deposit').value = game.deposit || 0;
        document.getElementById('rental-late-fee').value = game.late_fee_per_day || 50;
        const today = new Date();
        today.setDate(today.getDate() + 3);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('rental-due-date').value = `${year}-${month}-${day}`;
        createRentalModal.style.display = 'flex';
    }

    const rentalUserSearch = document.getElementById('rental-user-search');
    const rentalUserSelect = document.getElementById('rental-user-select');
    rentalUserSearch.addEventListener('input', () => {
        const searchTerm = rentalUserSearch.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            rentalUserSelect.style.display = 'none';
            return;
        }
        const filteredUsers = allUsers.filter(user => 
            (user.line_display_name || '').toLowerCase().includes(searchTerm) ||
            (user.nickname || '').toLowerCase().includes(searchTerm) ||
            (user.user_id || '').toLowerCase().includes(searchTerm) // 新增 LINE ID 搜尋
        );
        
        rentalUserSelect.innerHTML = '<option value="">-- 請選擇會員 --</option>';
        filteredUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.user_id;
            // 優先顯示綽號，其次是 LINE 名稱
            const displayName = user.nickname || user.line_display_name;
            option.textContent = `${displayName} (${user.user_id.substring(0, 10)}...)`;
            rentalUserSelect.appendChild(option);
        });
        rentalUserSelect.style.display = 'block';
    });

    // 【修改 #3】 當選擇使用者時，自動帶入姓名和電話
    rentalUserSelect.addEventListener('change', () => {
        selectedRentalUser = allUsers.find(u => u.user_id === rentalUserSelect.value);
        if (selectedRentalUser) {
            document.getElementById('rental-contact-name').value = selectedRentalUser.nickname || selectedRentalUser.line_display_name || '';
            document.getElementById('rental-contact-phone').value = selectedRentalUser.phone || '';
        }
    });


    // 【修改 #3】 更新 createRentalForm 的送出邏輯
    createRentalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedRentalUser) {
            alert('請務必搜尋並選擇一位租借會員！');
            return;
        }

        const rentalData = {
            userId: selectedRentalUser.user_id,
            gameId: document.getElementById('rental-game-id').value,
            dueDate: document.getElementById('rental-due-date').value,
            deposit: Number(document.getElementById('rental-deposit').value),
            lateFeePerDay: Number(document.getElementById('rental-late-fee').value),
            // 新增欄位
            name: document.getElementById('rental-contact-name').value,
            phone: document.getElementById('rental-contact-phone').value
        };

        if (!rentalData.name || !rentalData.phone) {
            alert('租借人姓名與電話為必填欄位！');
            return;
        }

        const confirmationMessage = `請確認租借資訊：\n\n` +
            `會員：${selectedRentalUser.nickname || selectedRentalUser.line_display_name}\n` +
            `遊戲：${document.getElementById('rental-game-name').value}\n` +
            `租借人：${rentalData.name}\n` +
            `電話：${rentalData.phone}\n` +
            `歸還日：${rentalData.dueDate}`;

        if (!confirm(confirmationMessage)) return;
        
        try {
            const response = await fetch('/api/admin/create-rental', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rentalData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '建立失敗');
            alert('租借成功！');
            createRentalModal.style.display = 'none';
            // 手動更新本地遊戲庫存並重新渲染
            const rentedGame = allGames.find(g => g.game_id === rentalData.gameId);
            if(rentedGame) rentedGame.for_rent_stock--;
            applyGameFiltersAndRender();
            
            fetchAllRentals(); // 刷新租借列表
            showPage('rentals'); // 切換到租借頁面
        } catch (error) {
            alert(`錯誤：${error.message}`);
        }
    });

    // 【修正 #3】 確保日曆功能被初始化
    flatpickr("#rental-due-date", { dateFormat: "Y-m-d", minDate: "today" });
    // =================================================================
    // 訂位管理模組
    // =================================================================
    function renderBookingList(bookings) {
        if (!bookingListTbody) return;
        bookingListTbody.innerHTML = '';
        if (bookings.length === 0) {
            bookingListTbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">目前沒有即將到來的預約。</td></tr>';
            return;
        }
        bookings.forEach(booking => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="compound-cell">
                    <div class="main-info">${booking.booking_date}</div>
                    <div class="sub-info">${booking.time_slot}</div>
                </td>
                <td class="compound-cell">
                    <div class="main-info">${booking.contact_name}</div>
                    <div class="sub-info">${booking.contact_phone}</div>
                </td>
                <td>${booking.num_of_people}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-cancel-booking" data-bookingid="${booking.booking_id}" style="background-color: var(--danger-color);">取消預約</button>
                </td>
            `;
            bookingListTbody.appendChild(row);
        });
    }

    async function fetchAllBookings() {
        try {
            const response = await fetch('/api/get-bookings');
            if (!response.ok) throw new Error('無法獲取預約列表');
            allBookings = await response.json();
            renderBookingList(allBookings);
        } catch (error) { console.error('獲取預約列表失敗:', error); }
    }

    bookingListTbody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('btn-cancel-booking')) {
            const bookingId = event.target.dataset.bookingid;
            const booking = allBookings.find(b => b.booking_id == bookingId);
            if (!booking) return;
            if (confirm(`確定要取消 ${booking.booking_date} ${booking.contact_name} 的預約嗎？`)) {
                try {
                    const response = await fetch('/api/update-booking-status', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId: Number(bookingId), status: 'cancelled' })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || '取消預約失敗');
                    alert('預約已成功取消！');
                    allBookings = allBookings.filter(b => b.booking_id != bookingId);
                    renderBookingList(allBookings);
                } catch (error) { alert(`錯誤：${error.message}`); }
            }
        }
    });

    // =================================================================
    // 掃碼加點模組
    // =================================================================
    function onScanSuccess(decodedText, decodedResult) {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                qrReaderElement.style.display = 'none';
                scanResultSection.style.display = 'block';
                userIdDisplay.value = decodedText;
                if(scanStatusMessage) {
                    scanStatusMessage.textContent = '掃描成功！請輸入點數。';
                    scanStatusMessage.className = 'success';
                }
            }).catch(err => console.error("停止掃描失敗", err));
        }
    }

    function startScanner() {
        if (!qrReaderElement) return;
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.log("掃描器已停止"));
        }
        
        html5QrCode = new Html5Qrcode("qr-reader");
        qrReaderElement.style.display = 'block';
        scanResultSection.style.display = 'none';
        if(scanStatusMessage) {
            scanStatusMessage.textContent = '請將顧客的 QR Code 對準掃描框';
            scanStatusMessage.className = '';
        }
        if(expInput) expInput.value = '';
        if(reasonSelect) reasonSelect.value = '消費回饋';
        if(customReasonInput) customReasonInput.style.display = 'none';

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .catch(err => {
                console.error("無法啟動掃描器", err);
                if(scanStatusMessage) scanStatusMessage.textContent = '無法啟動相機，請檢查權限。';
            });
    }
    
    if (reasonSelect) {
        reasonSelect.addEventListener('change', () => {
            customReasonInput.style.display = (reasonSelect.value === 'other') ? 'block' : 'none';
        });
    }

    if (rescanBtn) {
        rescanBtn.addEventListener('click', startScanner);
    }

    if (submitExpBtn) {
        submitExpBtn.addEventListener('click', async () => {
            const userId = userIdDisplay.value;
            const expValue = Number(expInput.value);
            let reason = reasonSelect.value;
            if (reason === 'other') reason = customReasonInput.value.trim();
            if (!userId || !expValue || expValue <= 0 || !reason) {
                if(scanStatusMessage) {
                    scanStatusMessage.textContent = '錯誤：所有欄位皆為必填。';
                    scanStatusMessage.className = 'error';
                }
                return;
            }
            try {
                if(scanStatusMessage) {
                    scanStatusMessage.textContent = '正在處理中...';
                    scanStatusMessage.className = '';
                }
                submitExpBtn.disabled = true;
                const response = await fetch('/api/add-exp', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, expValue, reason }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || '未知錯誤');
                if(scanStatusMessage) {
                    scanStatusMessage.textContent = `成功為 ${userId.substring(0, 10)}... 新增 ${expValue} 點經驗！`;
                    scanStatusMessage.className = 'success';
                }
                expInput.value = '';
            } catch (error) {
                if(scanStatusMessage) {
                    scanStatusMessage.textContent = `新增失敗: ${error.message}`;
                    scanStatusMessage.className = 'error';
                }
            } finally {
                submitExpBtn.disabled = false;
            }
        });
    }

    // =================================================================
    // ** 全新 ** 經驗紀錄模組
    // =================================================================
    async function initializeExpHistoryPage() {
        try {
            const response = await fetch('/api/admin/get-exp-history');
            if (!response.ok) throw new Error('無法獲取經驗紀錄');
            allExpHistory = await response.json();
            renderExpHistoryList(allExpHistory);
        } catch (error) {
            console.error('獲取經驗紀錄失敗:', error);
            if (expHistoryTbody) expHistoryTbody.innerHTML = `<tr><td colspan="4" style="color:red;">讀取紀錄失敗</td></tr>`;
        }
    }

    function renderExpHistoryList(records) {
        if (!expHistoryTbody) return;
        expHistoryTbody.innerHTML = '';
        if (records.length === 0) {
            expHistoryTbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">找不到符合條件的紀錄。</td></tr>`;
            return;
        }
        records.forEach(record => {
            const row = document.createElement('tr');
            const displayName = record.nickname || record.line_display_name || '未知使用者';
            const date = new Date(record.created_at).toLocaleString('sv').replace(' ', '\n');
            const expClass = record.exp_added > 0 ? 'exp-gain' : 'exp-loss';
            const expSign = record.exp_added > 0 ? '+' : '';

            row.innerHTML = `
                <td class="compound-cell">
                    <div class="main-info">${displayName}</div>
                    <div class="sub-info">${record.user_id}</div>
                </td>
                <td style="white-space: pre-wrap;">${date}</td>
                <td>${record.reason}</td>
                <td class="${expClass}" style="font-weight:bold;">${expSign}${record.exp_added}</td>
            `;
            expHistoryTbody.appendChild(row);
        });
    }

    const expUserFilterInput = document.getElementById('exp-user-filter-input');
    if (expUserFilterInput) {
        expUserFilterInput.addEventListener('input', () => {
            const searchTerm = expUserFilterInput.value.toLowerCase().trim();
            if (!searchTerm) {
                renderExpHistoryList(allExpHistory);
                return;
            }
            const filteredRecords = allExpHistory.filter(record => {
                const displayName = record.nickname || record.line_display_name || '';
                const userId = record.user_id || '';
                return displayName.toLowerCase().includes(searchTerm) || userId.toLowerCase().includes(searchTerm);
            });
            renderExpHistoryList(filteredRecords);
        });
    }

    // =================================================================
    // 情報管理模組
    // =================================================================
    function renderNewsList(newsItems) {
        newsListTbody.innerHTML = '';
        newsItems.forEach(news => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${news.title}</td>
                <td>${news.category}</td>
                <td>${news.published_date}</td>
                <td>${news.is_published ? '已發布' : '草稿'}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-news-id="${news.id}">編輯</button>
                </td>
            `;
            newsListTbody.appendChild(row);
        });
    }

    async function fetchAllNews() {
        try {
            const response = await fetch('/api/admin/get-all-news');
            if (!response.ok) throw new Error('無法獲取情報列表');
            allNews = await response.json();
            renderNewsList(allNews);
        } catch (error) { console.error('獲取情報列表失敗:', error); }
    }

    function openEditNewsModal(news = null) {
        editNewsForm.reset();
        currentEditingNewsId = news ? news.id : null;
        modalNewsTitle.textContent = news ? '編輯情報' : '新增情報';
        
        if (news) {
            document.getElementById('edit-news-id').value = news.id;
            document.getElementById('edit-news-title').value = news.title;
            document.getElementById('edit-news-category').value = news.category;
            document.getElementById('edit-news-date').value = news.published_date;
            document.getElementById('edit-news-image').value = news.image_url;
            document.getElementById('edit-news-content').value = news.content;
            document.getElementById('edit-news-published').checked = !!news.is_published;
            deleteNewsBtn.style.display = 'inline-block';
        } else {
            deleteNewsBtn.style.display = 'none';
        }
        
        editNewsModal.style.display = 'flex';
    }

    addNewsBtn.addEventListener('click', () => openEditNewsModal());
    editNewsModal.querySelector('.modal-close').addEventListener('click', () => editNewsModal.style.display = 'none');
    editNewsModal.querySelector('.btn-cancel').addEventListener('click', () => editNewsModal.style.display = 'none');
    
    newsListTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit')) {
            const newsId = e.target.dataset.newsId;
            const newsItem = allNews.find(n => n.id == newsId);
            openEditNewsModal(newsItem);
        }
    });

    editNewsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            id: currentEditingNewsId,
            title: document.getElementById('edit-news-title').value,
            category: document.getElementById('edit-news-category').value,
            published_date: document.getElementById('edit-news-date').value,
            image_url: document.getElementById('edit-news-image').value,
            content: document.getElementById('edit-news-content').value,
            is_published: document.getElementById('edit-news-published').checked
        };

        const url = currentEditingNewsId ? '/api/admin/update-news' : '/api/admin/create-news';
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '儲存失敗');
            alert('儲存成功！');
            editNewsModal.style.display = 'none';
            await fetchAllNews();
        } catch (error) { alert(`錯誤：${error.message}`); }
    });
    
    deleteNewsBtn.addEventListener('click', async () => {
        if (!currentEditingNewsId || !confirm('確定要刪除這則情報嗎？此操作無法復原。')) return;
        try {
            const response = await fetch('/api/admin/delete-news', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentEditingNewsId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '刪除失敗');
            alert('刪除成功！');
            editNewsModal.style.display = 'none';
            await fetchAllNews();
        } catch (error) { alert(`錯誤：${error.message}`); }
    });

    flatpickr("#edit-news-date", { dateFormat: "Y-m-d" });

    // =================================================================
    // 店家資訊管理模組
    // =================================================================
    async function fetchStoreInfo() {
        try {
            const response = await fetch('/api/get-store-info');
            if (!response.ok) throw new Error('無法載入店家資訊');
            const info = await response.json();
            document.getElementById('info-address').value = info.address;
            document.getElementById('info-phone').value = info.phone;
            document.getElementById('info-hours').value = info.opening_hours;
            document.getElementById('info-desc').value = info.description;
        } catch (error) { alert(`錯誤：${error.message}`); }
    }

    storeInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            address: document.getElementById('info-address').value,
            phone: document.getElementById('info-phone').value,
            opening_hours: document.getElementById('info-hours').value,
            description: document.getElementById('info-desc').value
        };
        try {
            const response = await fetch('/api/admin/update-store-info', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');
            alert('更新成功！');
        } catch (error) { alert(`錯誤：${error.message}`); }
    });

    // ---- 初始化 ----
    async function initialize() {
        try {
            const response = await fetch('/api/get-class-perks');
            if (!response.ok) throw new Error('無法獲取職業設定');
            classPerks = await response.json();
        } catch (error) {
            console.error('初始化職業設定失敗:', error);
            alert(`警告：無法從 Google Sheet 獲取職業設定。`);
        }
        await fetchAllUsers(); // 初始載入顧客列表
        showPage('users');
    }
    
    initialize();

});