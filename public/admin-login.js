document.addEventListener('DOMContentLoaded', () => {
    
    // --- 【模組名稱：全域變數與 DOM 宣告】 ---
    const mainNav = document.querySelector('.nav-tabs');
    const pages = document.querySelectorAll('.page');

    // 儀表板
    const dashboardGrid = document.getElementById('dashboard-grid');

    // 顧客管理
    const userListTbody = document.getElementById('user-list-tbody');
    const userSearchInput = document.getElementById('user-search-input');
    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const syncD1ToSheetBtn = document.getElementById('sync-d1-to-sheet-btn');
    const userDetailsModal = document.getElementById('user-details-modal'); // 補上這一行
    
    // 庫存管理
    const gameListTbody = document.getElementById('game-list-tbody');
    const gameSearchInput = document.getElementById('game-search-input');
    const editGameModal = document.getElementById('edit-game-modal');
    const editGameForm = document.getElementById('edit-game-form');
    const syncGamesBtn = document.getElementById('sync-games-btn');
    
    // 租借管理
    const rentalListTbody = document.getElementById('rental-list-tbody');
    const rentalStatusFilter = document.getElementById('rental-status-filter');
    const rentalSearchInput = document.getElementById('rental-search-input');
    const createRentalModal = document.getElementById('create-rental-modal');
    const createRentalForm = document.getElementById('create-rental-form');
    const editRentalModal = document.getElementById('edit-rental-modal');
    const editRentalForm = document.getElementById('edit-rental-form');
    const sortDueDateBtn = document.getElementById('sort-due-date');
    
    // 訂位管理
    const bookingListTbody = document.getElementById('booking-list-tbody');
    const manageBookingDatesBtn = document.getElementById('manage-booking-dates-btn');
    const bookingSettingsModal = document.getElementById('booking-settings-modal'); 
    const cancelBookingModal = document.getElementById('cancel-booking-modal');
    let bookingDatepicker = null; 
    let disabledDates = [];
    
    // 經驗紀錄
    const expHistoryTbody = document.getElementById('exp-history-tbody');
    const expUserFilterInput = document.getElementById('exp-user-filter-input');

    // 情報管理
    const newsListTbody = document.getElementById('news-list-tbody');
    const addNewsBtn = document.getElementById('add-news-btn');
    const editNewsModal = document.getElementById('edit-news-modal');
    const editNewsForm = document.getElementById('edit-news-form');
    const modalNewsTitle = document.getElementById('modal-news-title');
    const deleteNewsBtn = document.getElementById('delete-news-btn');
    
    // 訊息草稿
    const draftListTbody = document.getElementById('draft-list-tbody');
    const addDraftBtn = document.getElementById('add-draft-btn');
    const editDraftModal = document.getElementById('edit-draft-modal');
    const editDraftForm = document.getElementById('edit-draft-form');
    const modalDraftTitle = document.getElementById('modal-draft-title');

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
    const scanStatusMessage = document.querySelector('#scan-status-container');


    // --- 全域狀態變數 ---
    let allUsers = [], allGames = [], allBookings = [], allNews = [], allExpHistory = [], allRentals = [], allDrafts = [];
    let classPerks = {};
    let html5QrCode = null;
    let currentEditingNewsId = null;
    let currentEditingDraftId = null;
    let selectedRentalUser = null;
    let selectedRentalGames = []; 
    let dueDateSortOrder = 'asc'; 
    let sortableGames = null; // 新增：用於拖曳排序

    // --- 【模組名稱：手動全量同步】 ---
    const fullSyncRentalsBtn = document.getElementById('full-sync-rentals-btn');
    if (fullSyncRentalsBtn) {
        fullSyncRentalsBtn.addEventListener('click', async () => {
            if (!confirm('確定要用目前資料庫 (D1) 的「所有」租借紀錄，去完整覆蓋 Google Sheet 上的資料嗎？\n\n這個操作應用於修正歷史資料差異，執行需要一點時間。')) return;

            try {
                fullSyncRentalsBtn.textContent = '同步中...';
                fullSyncRentalsBtn.disabled = true;
                // 我們呼叫您之前就有的 sync-rentals API
                const response = await fetch('/api/admin/sync-rentals', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) { throw new Error(result.details || '同步失敗'); }
                alert(result.message || '同步成功！');
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                fullSyncRentalsBtn.textContent = '手動完整同步至 Sheet';
                fullSyncRentalsBtn.disabled = false;
            }
        });
    }

    //--- 【模組名稱：手動同步訂位紀錄】 ---
    const fullSyncBookingsBtn = document.getElementById('full-sync-bookings-btn');
    if (fullSyncBookingsBtn) {
        fullSyncBookingsBtn.addEventListener('click', async () => {
            if (!confirm('確定要用目前資料庫 (D1) 的「所有」訂位紀錄，去完整覆蓋 Google Sheet 上的「預約紀錄」工作表嗎？')) return;

            try {
                fullSyncBookingsBtn.textContent = '同步中...';
                fullSyncBookingsBtn.disabled = true;
                const response = await fetch('/api/admin/sync-bookings-to-sheet', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) { throw new Error(result.details || '同步失敗'); }
                alert(result.message || '同步成功！');
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                fullSyncBookingsBtn.textContent = '手動同步至 Sheet';
                fullSyncBookingsBtn.disabled = false;
            }
        });
    }

        // 關閉事件監聽(放在任意位置)
        if (editRentalModal) {
        editRentalModal.querySelector('.modal-close').addEventListener('click', () => editRentalModal.style.display = 'none');
        editRentalModal.querySelector('.btn-cancel').addEventListener('click', () => editRentalModal.style.display = 'none');
        }
        if (userDetailsModal) {
        userDetailsModal.querySelector('.modal-close').addEventListener('click', () => userDetailsModal.style.display = 'none');
        }    

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

        const pageLoader = {
            'dashboard': fetchDashboardStats,
            'users': fetchAllUsers,
            'inventory': fetchAllGames,
            'bookings': () => fetchAllBookings('today'),
            'exp-history': fetchAllExpHistory,
            'scan': startScanner,
            'news': fetchAllNews,
            'store-info': fetchStoreInfo,
            'rentals': fetchAllRentals,
            'drafts': fetchAllDrafts
        };
        
        if (pageLoader[pageId]) {
            pageLoader[pageId]();
        }
    }

    mainNav.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const pageId = event.target.getAttribute('href').substring(1);
            showPage(pageId);
        }
    });

    // =================================================================
    // 儀表板模組
    // =================================================================
    async function fetchDashboardStats() {
        try {
            const response = await fetch('/api/admin/dashboard-stats');
            if (!response.ok) throw new Error('無法獲取儀表板數據');
            const stats = await response.json();
            
            document.getElementById('stat-today-guests').textContent = stats.today_total_guests || 0;
            document.getElementById('stat-outstanding-rentals').textContent = stats.outstanding_rentals_count || 0;
            document.getElementById('stat-due-today').textContent = stats.due_today_rentals_count || 0;

            // ** 需求 4 修改：綁定點擊事件 **
            if(dashboardGrid) {
                dashboardGrid.addEventListener('click', (e) => {
                    const card = e.target.closest('.stat-card');
                    if (!card) return;

                    const target = card.dataset.target;
                    if (target === 'bookings') {
                        showPage('bookings');
                        // 自動點擊 '今日預約' 篩選器
                        document.querySelector('#booking-status-filter button[data-filter="today"]').click();
                    } else if (target === 'rentals-rented') {
                        showPage('rentals');
                        // 自動點擊 '租借中' 篩選器
                        document.querySelector('#rental-status-filter button[data-filter="rented"]').click();
                    } else if (target === 'rentals-due-today') {
                        showPage('rentals');
                        // 自動點擊 '今日到期' 篩選器
                        document.querySelector('#rental-status-filter button[data-filter="due_today"]').click();
                    }
                });
            }

        } catch (error) {
            console.error('獲取儀表板數據失敗:', error);
            if(dashboardGrid) dashboardGrid.innerHTML = `<p style="color:red;">讀取數據失敗</p>`;
        }
    }
    // =================================================================
    // 顧客管理模組
    // =================================================================
    function renderUserList(users) {
        if (!userListTbody) return;
        userListTbody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.user_id;
            row.style.cursor = 'pointer';
            
            const displayName = user.nickname ? `${user.line_display_name} (${user.nickname})` : user.line_display_name;
            
            row.innerHTML = `
                <td class="compound-cell" style="text-align: left;">
                    <div class="main-info">${displayName || 'N/A'}</div>
                    <div class="sub-info">${user.user_id}</div>
                </td>
                <td>${user.level}</td>
                <td>${user.current_exp} / 10</td>
                <td>${user.class || '無'}</td>
                <td><span class="tag-display">${user.tag || '無'}</span></td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit">編輯</button>
                </td>
            `;
            userListTbody.appendChild(row);
        });
    }

    async function fetchAllUsers() {
        if (allUsers.length > 0) return;
        try {
            const response = await fetch('/api/get-users');
            if (!response.ok) throw new Error('無法獲取使用者列表');
            allUsers = await response.json();
            renderUserList(allUsers);
        } catch (error) { console.error('獲取使用者列表失敗:', error); }
    }
    
    if (syncD1ToSheetBtn) {
        syncD1ToSheetBtn.addEventListener('click', async () => {
             if (!confirm('確定要用目前資料庫 (D1) 的所有使用者資料，完整覆蓋 Google Sheet 上的「使用者列表」嗎？\n\n這個操作通常用於手動備份。')) return;
            try {
                syncD1ToSheetBtn.textContent = '同步中...';
                syncD1ToSheetBtn.disabled = true;
                const response = await fetch('/api/sync-d1-to-sheet', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) { throw new Error(result.details || '同步失敗'); }
                alert(result.message || '同步成功！');
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                syncD1ToSheetBtn.textContent = '同步至 Google Sheet';
                syncD1ToSheetBtn.disabled = false;
            }
        });
    }

    if(userSearchInput){
        userSearchInput.addEventListener('input', () => {
            const searchTerm = userSearchInput.value.toLowerCase().trim();
            const filteredUsers = searchTerm 
                ? allUsers.filter(user => 
                    (user.line_display_name || '').toLowerCase().includes(searchTerm) ||
                    (user.nickname || '').toLowerCase().includes(searchTerm)
                  ) 
                : allUsers;
            renderUserList(filteredUsers);
        });
    }

    function openEditUserModal(userId) {
        const user = allUsers.find(u => u.user_id === userId);
        if (!user) return;
        document.getElementById('modal-user-title').textContent = `編輯：${user.line_display_name}`;
        document.getElementById('edit-user-id').value = user.user_id;
        document.getElementById('edit-level-input').value = user.level;
        document.getElementById('edit-exp-input').value = user.current_exp;
        const classSelect = document.getElementById('edit-class-select');
        const otherClassInput = document.getElementById('edit-class-other-input');
        const perkSelect = document.getElementById('edit-perk-select');
        const otherPerkInput = document.getElementById('edit-perk-other-input');
        const tagSelect = document.getElementById('edit-tag-select');
        const otherTagInput = document.getElementById('edit-tag-other-input');
        classSelect.innerHTML = '';
        perkSelect.innerHTML = '';
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
        classSelect.appendChild(new Option('其他 (自訂)', 'other'));
        perkSelect.appendChild(new Option('其他 (自訂)', 'other'));
        if (classPerks[user.class]) {
            classSelect.value = user.class;
            otherClassInput.style.display = 'none';
        } else {
            classSelect.value = 'other';
            otherClassInput.style.display = 'block';
            otherClassInput.value = user.class || '';
        }
        const standardPerks = Object.values(classPerks);
        if (standardPerks.includes(user.perk)) {
            perkSelect.value = user.perk;
            otherPerkInput.style.display = 'none';
        } else {
            perkSelect.value = 'other';
            otherPerkInput.style.display = 'block';
            otherPerkInput.value = user.perk || '';
        }
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

    if(document.getElementById('edit-class-select')) {
        document.getElementById('edit-class-select').addEventListener('change', (e) => {
            const otherClassInput = document.getElementById('edit-class-other-input');
            const perkSelect = document.getElementById('edit-perk-select');
            const otherPerkInput = document.getElementById('edit-perk-other-input');
            if (e.target.value === 'other') {
                otherClassInput.style.display = 'block';
                perkSelect.value = 'other';
                otherPerkInput.style.display = 'block';
            } else {
                otherClassInput.style.display = 'none';
                perkSelect.value = classPerks[e.target.value];
                otherPerkInput.style.display = 'none';
            }
        });
    }
    
    if(document.getElementById('edit-perk-select')){
        document.getElementById('edit-perk-select').addEventListener('change', (e) => {
            document.getElementById('edit-perk-other-input').style.display = (e.target.value === 'other') ? 'block' : 'none';
        });
    }

    if(document.getElementById('edit-tag-select')){
        document.getElementById('edit-tag-select').addEventListener('change', (e) => {
            document.getElementById('edit-tag-other-input').style.display = (e.target.value === 'other') ? 'block' : 'none';
        });
    }

    if(editUserModal){
        editUserModal.querySelector('.modal-close').addEventListener('click', () => editUserModal.style.display = 'none');
        editUserModal.querySelector('.btn-cancel').addEventListener('click', () => editUserModal.style.display = 'none');
    }

    if(editUserForm) {
        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-user-id').value;
            let newClass = document.getElementById('edit-class-select').value;
            if (newClass === 'other') newClass = document.getElementById('edit-class-other-input').value.trim();
            let newPerk = document.getElementById('edit-perk-select').value;
            if (newPerk === 'other') newPerk = document.getElementById('edit-perk-other-input').value.trim();
            let newTag = document.getElementById('edit-tag-select').value;
            if (newTag === 'other') newTag = document.getElementById('edit-tag-other-input').value.trim();
            const updatedData = {
                userId: userId,
                level: document.getElementById('edit-level-input').value,
                current_exp: document.getElementById('edit-exp-input').value,
                tag: newTag,
                user_class: newClass,
                perk: newPerk
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
                renderUserList(allUsers);
                editUserModal.style.display = 'none';
            } catch (error) { alert(`錯誤：${error.message}`); }
        });
    }

    if(userListTbody) {
        userListTbody.addEventListener('click', async (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row || !row.dataset.userId) return;

            const userId = row.dataset.userId;
            
            if (target.classList.contains('btn-edit')) {
                openEditUserModal(userId);
            } else {
                openUserDetailsModal(userId);
            }
        });
    }
    
async function openUserDetailsModal(userId) {
        console.log("CRM 檢查點 A: 已進入 openUserDetailsModal 函式，收到的 userId 是:", userId);

        if (!userId) {
            console.error("CRM 流程中斷：傳入的 userId 是空的！");
            return;
        }
        if (!userDetailsModal) {
            console.error("CRM 流程中斷：在 JS 檔案頂部找不到 userDetailsModal 變數！請檢查 HTML 的 id 是否為 'user-details-modal'。");
            return;
        }
        console.log("CRM 檢查點 B: userId 和 userDetailsModal 變數都存在。");

        const contentContainer = userDetailsModal.querySelector('#user-details-content');
        if (!contentContainer) {
            console.error("CRM 流程中斷：在彈出視窗中找不到 id 為 'user-details-content' 的元素！");
            return;
        }
        console.log("CRM 檢查點 C: 成功找到 contentContainer，準備顯示 Modal。");

        contentContainer.innerHTML = '<p>讀取中...</p>';
        userDetailsModal.style.display = 'flex';
        console.log("CRM 檢查點 D: 已將 Modal 的 display 設為 'flex'，準備呼叫後端 API...");

        try {
            const response = await fetch(`/api/admin/user-details?userId=${userId}`);
            console.log("CRM 檢查點 E: 後端 API 回應狀態碼:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API 請求失敗: ${errorText}`);
            }
            const data = await response.json();
            console.log("CRM 檢查點 F: 成功獲取並解析 API 資料:", data);
            renderUserDetails(data);
        } catch (error) {
            console.error("CRM 執行錯誤:", error);
            contentContainer.innerHTML = `<p style="color:red;">載入資料時發生錯誤：${error.message}</p>`;
        }
    }

function renderUserDetails(data) {
    const { profile, bookings, rentals, exp_history } = data;
    const contentContainer = userDetailsModal.querySelector('#user-details-content');
    if (!contentContainer) return;
    
    const displayName = profile.nickname || profile.line_display_name;
    document.getElementById('user-details-title').textContent = `顧客資料：${displayName}`;

    // ** 需求 2 修改：在 profile-summary 中增加手機和職業福利 **
    contentContainer.innerHTML = `
        <div class="details-grid">
            <div class="profile-summary">
                <img src="${profile.line_picture_url || 'placeholder.jpg'}" alt="Profile Picture">
                <h4>${displayName}</h4>
                <p>姓名: ${profile.real_name || '未設定'}</p>
                <p>電話: ${profile.phone || '未設定'}</p> <p>等級: ${profile.level} (${profile.current_exp}/10 EXP)</p>
                <p>職業: ${profile.class}</p>
                <p>福利: ${profile.perk || '無'}</p> <p>標籤: ${profile.tag || '無'}</p>
            </div>
            <div class="profile-details">
                <div class="details-tabs">
                    <button class="details-tab active" data-target="tab-rentals">租借紀錄</button>
                    <button class="details-tab" data-target="tab-bookings">預約紀錄</button>
                    <button class="details-tab" data-target="tab-exp">經驗值紀錄</button>
                </div>
                <div id="tab-rentals" class="details-tab-content active">
                    ${renderHistoryTable(rentals, ['rental_date', 'game_name', 'status'], { rental_date: '租借日', game_name: '遊戲', status: '狀態' })}
                </div>
                <div id="tab-bookings" class="details-tab-content">
                    ${renderHistoryTable(bookings, ['booking_date', 'num_of_people', 'status'], { booking_date: '預約日', num_of_people: '人數', status: '狀態' })}
                </div>
                <div id="tab-exp" class="details-tab-content">
                    ${renderHistoryTable(exp_history, ['created_at', 'reason', 'exp_added'], { created_at: '日期', reason: '原因', exp_added: '經驗' })}
                </div>
            </div>
        </div>
        <div class="message-sender">
            <h4>發送 LINE 訊息</h4>
            <div class="form-group">
                <label for="message-draft-select">選擇訊息草稿</label>
                <select id="message-draft-select"><option value="">-- 手動輸入或選擇草稿 --</option></select>
            </div>
            <div class="form-group">
                <label for="direct-message-content">訊息內容</label>
                <textarea id="direct-message-content" rows="4"></textarea>
            </div>
            <div class="form-actions">
                <button id="send-direct-message-btn" class="action-btn btn-save" data-userid="${profile.user_id}">確認發送</button>
            </div>
        </div>
    `;

    const tabsContainer = contentContainer.querySelector('.details-tabs');
    const contentsContainer = contentContainer.querySelector('.profile-details');
    tabsContainer.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            tabsContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            contentsContainer.querySelector('.details-tab-content.active').classList.remove('active');
            contentsContainer.querySelector(`#${e.target.dataset.target}`).classList.add('active');
        }
    });
    
    loadAndBindMessageDrafts(profile.user_id);
}
    
function renderHistoryTable(items, columns, headers) {
    if (!items || items.length === 0) return '<p>無相關紀錄</p>';
    let head = '<tr>' + Object.values(headers).map(h => `<th>${h}</th>`).join('') + '</tr>';
    let body = items.map(item => '<tr>' + columns.map(col => {
        let value = item[col];
        if (col === 'created_at' || col === 'rental_date' || col === 'booking_date') {
            value = new Date(value).toLocaleDateString();
        }
        // 【新增】狀態中文化邏輯
        if (col === 'status') {
            switch(value) {
                case 'confirmed': value = '預約成功'; break;
                case 'checked-in': value = '已報到'; break;
                case 'cancelled': value = '已取消'; break;
                case 'rented': value = '租借中'; break;
                case 'returned': value = '已歸還'; break;
                case 'overdue': value = '<span style="color:var(--danger-color); font-weight:bold;">逾期</span>'; break; // 【新增這一行】
            }
        }
        return `<td>${value}</td>`;
    }).join('') + '</tr>').join('');
    return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

    // =================================================================
    // 訊息草稿模組
    // =================================================================
    async function fetchAllDrafts() {
        if (allDrafts.length > 0) {
            renderDraftList(allDrafts);
            return;
        }
        try {
            const response = await fetch('/api/admin/message-drafts');
            if (!response.ok) throw new Error('無法獲取訊息草稿');
            allDrafts = await response.json();
            renderDraftList(allDrafts);
        } catch (error) {
            console.error('獲取訊息草稿失敗:', error);
            if(draftListTbody) draftListTbody.innerHTML = '<tr><td colspan="3">讀取失敗</td></tr>';
        }
    }

    function renderDraftList(drafts) {
        if (!draftListTbody) return;
        draftListTbody.innerHTML = '';
        drafts.forEach(draft => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${draft.title}</td>
                <td>${draft.content.substring(0, 50)}...</td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-draftid="${draft.draft_id}">編輯</button>
                    <button class="action-btn btn-delete-draft" data-draftid="${draft.draft_id}" style="background-color: var(--danger-color);">刪除</button>
                </td>
            `;
            draftListTbody.appendChild(row);
        });
    }

    function openEditDraftModal(draft = null) {
        if (!editDraftForm) return;
        editDraftForm.reset();
        currentEditingDraftId = draft ? draft.draft_id : null;
        if (modalDraftTitle) modalDraftTitle.textContent = draft ? '編輯訊息草稿' : '新增訊息草稿';

        if (draft) {
            document.getElementById('edit-draft-id').value = draft.draft_id;
            document.getElementById('edit-draft-title').value = draft.title;
            document.getElementById('edit-draft-content').value = draft.content;
        }
        
        if (editDraftModal) editDraftModal.style.display = 'flex';
    }

    if (addDraftBtn) {
        addDraftBtn.addEventListener('click', () => openEditDraftModal());
    }
    if (editDraftModal) {
        editDraftModal.querySelector('.modal-close').addEventListener('click', () => editDraftModal.style.display = 'none');
        editDraftModal.querySelector('.btn-cancel').addEventListener('click', () => editDraftModal.style.display = 'none');
    }

    if (editDraftForm) {
        editDraftForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const draftData = {
                draft_id: currentEditingDraftId,
                title: document.getElementById('edit-draft-title').value,
                content: document.getElementById('edit-draft-content').value,
            };

            const isUpdating = !!currentEditingDraftId;
            const url = '/api/admin/message-drafts';
            const method = isUpdating ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(draftData)
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '儲存失敗');
                }
                alert('草稿儲存成功！');
                editDraftModal.style.display = 'none';
                allDrafts = [];
                await fetchAllDrafts();
            } catch (error) {
                alert(`錯誤： ${error.message}`);
            }
        });
    }

    if (draftListTbody) {
        draftListTbody.addEventListener('click', async (e) => {
            const target = e.target;
            const draftId = target.dataset.draftid;
            if (!draftId) return;

            if (target.classList.contains('btn-edit')) {
                const draft = allDrafts.find(d => d.draft_id == draftId);
                openEditDraftModal(draft);
            } else if (target.classList.contains('btn-delete-draft')) {
                if (confirm('確定要刪除這則草稿嗎？')) {
                    try {
                        const response = await fetch('/api/admin/message-drafts', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ draft_id: Number(draftId) })
                        });
                        if (!response.ok) throw new Error('刪除失敗');
                        alert('刪除成功！');
                        allDrafts = allDrafts.filter(d => d.draft_id != draftId);
                        renderDraftList(allDrafts);
                    } catch (error) {
                        alert(`錯誤：${error.message}`);
                    }
                }
            }
        });
    }

    async function loadAndBindMessageDrafts(userId) {
        const select = document.getElementById('message-draft-select');
        const content = document.getElementById('direct-message-content');
        const sendBtn = document.getElementById('send-direct-message-btn');
        if (!select || !content || !sendBtn) return;

        await fetchAllDrafts();
        select.innerHTML = '<option value="">-- 手動輸入或選擇草稿 --</option>';
        allDrafts.forEach(draft => {
            const option = document.createElement('option');
            option.value = draft.content;
            option.textContent = draft.title;
            select.appendChild(option);
        });

        select.onchange = () => { content.value = select.value; };

        sendBtn.onclick = async () => {
            const message = content.value.trim();
            if (!message) { alert('訊息內容不可為空！'); return; }
            if (!confirm(`確定要發送以下訊息給該顧客嗎？\n\n${message}`)) return;
            
            sendBtn.textContent = '傳送中...';
            sendBtn.disabled = true;
            try {
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, message })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || '傳送失敗');
                }
                alert('訊息傳送成功！');
                content.value = '';
            } catch (error) {
                alert(`傳送失敗：${error.message}`);
            } finally {
                sendBtn.textContent = '確認發送';
                sendBtn.disabled = false;
            }
        };
    }


// =================================================================
// 庫存管理模組
// =================================================================

function applyGameFiltersAndRender() {
    if (!allGames) return;

    // 1. 關鍵字搜尋
    const searchTerm = gameSearchInput.value.toLowerCase().trim();
    let filteredGames = searchTerm
        ? allGames.filter(game => (game.name || '').toLowerCase().includes(searchTerm))
        : [...allGames];

    // 2. 庫存量篩選
    const stockFilterEl = document.querySelector('#inventory-stock-filter .active');
    if (stockFilterEl) {
        const stockFilter = stockFilterEl.dataset.filter;
        if (stockFilter === 'in_stock') {
            filteredGames = filteredGames.filter(game => Number(game.for_rent_stock) > 0);
        } else if (stockFilter === 'out_of_stock') {
            filteredGames = filteredGames.filter(game => Number(game.for_rent_stock) <= 0);
        }
    }

    // 3. 上架狀態篩選
    const visibilityFilterEl = document.querySelector('#inventory-visibility-filter .active');
    if(visibilityFilterEl) {
        const visibilityFilter = visibilityFilterEl.dataset.filter;
        if (visibilityFilter === 'visible') {
            filteredGames = filteredGames.filter(game => game.is_visible === 1);
        } else if (visibilityFilter === 'hidden') {
            filteredGames = filteredGames.filter(game => game.is_visible !== 1);
        }
    }
    
    renderGameList(filteredGames);
}

function renderGameList(games) {
    if (!gameListTbody) return;
    gameListTbody.innerHTML = '';
    games.forEach(game => {
        const row = document.createElement('tr');
        row.className = 'draggable-row'; // 用於拖曳
        row.dataset.gameId = game.game_id; // 綁定 ID
        
        const isVisible = game.is_visible === 1;
        const tagsHtml = (game.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(tag => `<span style="background:#eee; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${tag}</span>`).join(' ');

        // **【修改處】** 在 actions-cell 中重新加入 "出借" 按鈕
row.innerHTML = `
    <td>${game.display_order || 'N/A'}</td>
    <td class="compound-cell" style="text-align: left;">
        <div class="main-info">${game.name}</div>
        <div class="sub-info">ID: ${game.game_id}</div>
        <div class="sub-info" style="margin-top: 5px;">${tagsHtml}</div>
    </td>
    <td>${game.total_stock}</td>
    <td>${game.for_rent_stock}</td>
    <td class="compound-cell">
        <div class="main-info">$${game.sale_price}</div>
        <div class="sub-info">租金: $${game.rent_price}</div>
    </td>
    <td>${isVisible ? '是' : '否'}</td>
    <td class="actions-cell">
        <div style="display: flex; gap: 5px; justify-content: center;">
            <button class="action-btn btn-rent" data-gameid="${game.game_id}" style="background-color: #007bff;">出借</button>
            <button class="action-btn btn-edit-game" data-gameid="${game.game_id}" style="background-color: #ffc107; color: #000;">編輯</button>
        </div>
    </td>
`;
        gameListTbody.appendChild(row);
    });
}

async function fetchAllGames() {
    try {
        const response = await fetch('/api/get-boardgames'); // API 已被修改為按 display_order 排序
        if (!response.ok) throw new Error('從資料庫獲取桌遊列表失敗');
        allGames = await response.json();
        applyGameFiltersAndRender();
        initializeGameDragAndDrop(); // 渲染後初始化拖曳功能
    } catch (error) { 
        console.error('獲取桌遊列表失敗:', error);
        if(gameListTbody) gameListTbody.innerHTML = `<tr><td colspan="7" style="color: red;">讀取資料失敗</td></tr>`;
    }
}

function initializeGameDragAndDrop() {
    if (sortableGames) {
        sortableGames.destroy(); // 如果已存在，先銷毀舊的實例
    }
    if (gameListTbody) {
        sortableGames = new Sortable(gameListTbody, {
            animation: 150,
            handle: '.draggable-row',
            onEnd: async (evt) => {
                const orderedIds = Array.from(gameListTbody.children).map(row => row.dataset.gameId);
                
                // 立即更新前端視覺排序
                allGames.sort((a, b) => orderedIds.indexOf(a.game_id) - orderedIds.indexOf(b.game_id));
                applyGameFiltersAndRender();

                try {
                    const response = await fetch('/api/admin/update-boardgame-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderedGameIds: orderedIds })
                    });
                    if (!response.ok) {
                        throw new Error('儲存順序失敗，請刷新頁面重試。');
                    }
                    // 重新從後端獲取一次資料，確保 display_order 是最新的
                    await fetchAllGames(); 
                } catch (error) {
                    alert(error.message);
                    // 如果失敗，可以選擇重新載入以還原
                    await fetchAllGames(); 
                }
            }
        });
    }
}

if (gameSearchInput) {
    gameSearchInput.addEventListener('input', applyGameFiltersAndRender);
}
    
const inventoryStockFilter = document.getElementById('inventory-stock-filter');
if (inventoryStockFilter) {
    inventoryStockFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            inventoryStockFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            applyGameFiltersAndRender();
        }
    });
}

const inventoryVisibilityFilter = document.getElementById('inventory-visibility-filter');
if (inventoryVisibilityFilter) {
    inventoryVisibilityFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            inventoryVisibilityFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            applyGameFiltersAndRender();
        }
    });
}

if (syncGamesBtn) {
    syncGamesBtn.addEventListener('click', async () => {
        if (!confirm('確定要從 Google Sheet 同步所有桌遊資料到資料庫嗎？\n\n這將會用 Sheet 上的資料覆蓋現有資料。')) return;

        try {
            syncGamesBtn.textContent = '同步中...';
            syncGamesBtn.disabled = true;
            const response = await fetch('/api/get-boardgames', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.details || '同步失敗');
            }
            alert(result.message || '同步成功！');
            await fetchAllGames(); // 同步後重新載入
        } catch (error) {
            alert(`錯誤：${error.message}`);
        } finally {
            syncGamesBtn.textContent = '同步至資料庫';
            syncGamesBtn.disabled = false;
        }
    });
}


if (gameListTbody) {
    gameListTbody.addEventListener('click', (e) => {
        const target = e.target;
        // **【修改處】** 直接從被點擊的按鈕上獲取 gameid
        const gameId = target.dataset.gameid; 
        if (!gameId) return; // 如果點擊的不是帶有 data-gameid 的元素，就忽略

        // 判斷點擊的是哪個按鈕並執行對應函式
        if (target.classList.contains('btn-edit-game')) {
            openEditGameModal(gameId);
        } else if (target.classList.contains('btn-rent')) {
            openCreateRentalModal(gameId);
        }
    });
}

function openEditGameModal(gameId) {
    const game = allGames.find(g => g.game_id == gameId);
    if (!game) return alert('找不到遊戲資料');

    if(editGameForm) editGameForm.reset();
    document.getElementById('modal-game-title').textContent = `編輯：${game.name}`;
    
    // 填入所有欄位的資料
    document.getElementById('edit-game-id').value = game.game_id;
    document.getElementById('edit-game-id-display').value = game.game_id;
    document.getElementById('edit-game-name').value = game.name;
    document.getElementById('edit-game-tags').value = game.tags || '';
    document.getElementById('edit-game-image').value = game.image_url || '';
    document.getElementById('edit-game-desc').value = game.description || '';
    document.getElementById('edit-min-players').value = game.min_players || 1;
    document.getElementById('edit-max-players').value = game.max_players || 1;
    document.getElementById('edit-difficulty').value = game.difficulty || '普通';
    document.getElementById('edit-total-stock').value = game.total_stock || 0;
    document.getElementById('edit-for-rent-stock').value = game.for_rent_stock || 0;
    document.getElementById('edit-sale-price').value = game.sale_price || 0;
    document.getElementById('edit-rent-price').value = game.rent_price || 0;
    document.getElementById('edit-deposit').value = game.deposit || 0;
    document.getElementById('edit-late-fee').value = game.late_fee_per_day || 50;
    document.getElementById('edit-is-visible').checked = game.is_visible === 1;
    
    if(editGameModal) editGameModal.style.display = 'flex';
}

if(editGameModal) {
    editGameModal.querySelector('.modal-close').addEventListener('click', () => editGameModal.style.display = 'none');
    editGameModal.querySelector('.btn-cancel').addEventListener('click', () => editGameModal.style.display = 'none');

    if(editGameForm) {
        editGameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 收集所有欄位的資料
            const updatedData = {
                gameId: document.getElementById('edit-game-id').value,
                name: document.getElementById('edit-game-name').value,
                tags: document.getElementById('edit-game-tags').value,
                image_url: document.getElementById('edit-game-image').value,
                description: document.getElementById('edit-game-desc').value,
                min_players: document.getElementById('edit-min-players').value,
                max_players: document.getElementById('edit-max-players').value,
                difficulty: document.getElementById('edit-difficulty').value,
                total_stock: document.getElementById('edit-total-stock').value,
                for_rent_stock: document.getElementById('edit-for-rent-stock').value,
                sale_price: document.getElementById('edit-sale-price').value,
                rent_price: document.getElementById('edit-rent-price').value,
                deposit: document.getElementById('edit-deposit').value,
                late_fee_per_day: document.getElementById('edit-late-fee').value,
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
                
                // 直接更新前端快取的資料
                const gameIndex = allGames.findIndex(g => g.game_id === updatedData.gameId);
                if (gameIndex !== -1) {
                    allGames[gameIndex] = { ...allGames[gameIndex], ...updatedData, is_visible: updatedData.is_visible ? 1 : 0 };
                }
                
                applyGameFiltersAndRender(); // 重新渲染列表
                editGameModal.style.display = 'none';
                alert('更新成功！');
            } catch (error) {
                alert(`錯誤：${error.message}`);
            }
        });
    }
}


// =================================================================
// 桌遊租借模組
// =================================================================
async function applyRentalFiltersAndRender() {
    if (!rentalSearchInput) return;
    const keyword = rentalSearchInput.value.toLowerCase().trim();
    let status = 'all';
    if (rentalStatusFilter) {
        const activeFilter = rentalStatusFilter.querySelector('.active');
        if(activeFilter) status = activeFilter.dataset.filter;
    }

    let url = '/api/admin/get-all-rentals';
    if (status !== 'all') {
        url += `?status=${status}`;
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('無法獲取租借列表');
        allRentals = await response.json();

        // 在前端進行關鍵字篩選
        const filteredRentals = !keyword ? allRentals : allRentals.filter(rental => 
                                 (rental.game_name || '').toLowerCase().includes(keyword) ||
                                 (rental.nickname || rental.line_display_name || '').toLowerCase().includes(keyword)
                             );
        
        sortRentals(); // 在渲染前先進行排序
        renderRentalList(filteredRentals);

    } catch (error) { 
        console.error('獲取租借列表失敗:', error); 
    }
}

function sortRentals() {
    allRentals.sort((a, b) => {
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        if (dueDateSortOrder === 'asc') {
            return dateA - dateB;
        } else {
            return dateB - dateA;
        }
    });
    // 更新排序按鈕的視覺狀態
    if(sortDueDateBtn) {
        sortDueDateBtn.classList.remove('asc', 'desc');
        sortDueDateBtn.classList.add(dueDateSortOrder);
    }
}

function renderRentalList(rentals) {
    if (!rentalListTbody) return;
    rentalListTbody.innerHTML = '';
    rentals.forEach(rental => {
        const row = document.createElement('tr');
        const userName = rental.nickname || rental.line_display_name || '未知用戶';
        let statusBadge = '';
        switch(rental.derived_status) {
            case 'overdue':
                statusBadge = '<span style="background-color: var(--danger-color); color: #fff; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">逾期未歸還</span>';
                break;
            case 'rented':
                statusBadge = '<span style="background-color: #ffc107; color: #000; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">租借中</span>';
                break;
            case 'returned':
                statusBadge = '<span style="background-color: #28a745; color: #fff; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">已歸還</span>';
                break;
            default:
                statusBadge = `<span>${rental.status}</span>`;
        }
        row.innerHTML = `
            <td>${statusBadge}</td>
            <td>${rental.game_name}</td>
            <td>${userName}</td>
            <td>${rental.due_date}</td>
            <td class="actions-cell" style="display: flex; gap: 5px; justify-content: center;">
                <button class="action-btn btn-edit-rental" data-rentalid="${rental.rental_id}" style="background-color:#007bff;">管理</button>
                <button class="action-btn btn-return" data-rentalid="${rental.rental_id}" style="background-color:#17a2b8;" ${rental.status === 'returned' ? 'disabled' : ''}>歸還</button>
            </td>
        `;
        rentalListTbody.appendChild(row);
    });
}

function fetchAllRentals() {
    applyRentalFiltersAndRender();
}

if (rentalStatusFilter) {
    rentalStatusFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            rentalStatusFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            applyRentalFiltersAndRender();
        }
    });
}

if(rentalSearchInput) {
    rentalSearchInput.addEventListener('input', applyRentalFiltersAndRender);
}

if (sortDueDateBtn) {
    sortDueDateBtn.addEventListener('click', () => {
        dueDateSortOrder = dueDateSortOrder === 'asc' ? 'desc' : 'asc';
        const keyword = rentalSearchInput.value.toLowerCase().trim();
        const filteredRentals = !keyword ? allRentals : allRentals.filter(rental => 
            (rental.game_name || '').toLowerCase().includes(keyword) ||
            (rental.nickname || rental.line_display_name || '').toLowerCase().includes(keyword)
        );
        sortRentals();
        renderRentalList(filteredRentals); 
    });
}

if (rentalListTbody) {
    rentalListTbody.addEventListener('click', async (e) => {
        const target = e.target;
        const rentalId = target.dataset.rentalid;
        if (!rentalId) return;

        if (target.classList.contains('btn-edit-rental')) {
            openEditRentalModal(rentalId);
            return;
        }

        if (target.classList.contains('btn-return')) {
            const rental = allRentals.find(r => r.rental_id == rentalId);
            if (!rental) return;

            if (confirm(`確定要將《${rental.game_name}》標記為已歸還嗎？`)) {
                try {
                    const response = await fetch('/api/admin/update-rental-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rentalId: Number(rentalId),
                            status: 'returned'
                        })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || '歸還失敗');
                    alert('歸還成功！');

                    await applyRentalFiltersAndRender();
                    if (allGames.length > 0) await fetchAllGames();

                } catch (error) {
                    alert(`錯誤：${error.message}`);
                }
            }
        }
    });
}

function openEditRentalModal(rentalId) {
    const rental = allRentals.find(r => r.rental_id == rentalId);
    if (!rental) return alert('找不到該筆租借紀錄');

    document.getElementById('edit-rental-id').value = rental.rental_id;
    document.getElementById('modal-rental-title').textContent = `管理租借：${rental.game_name}`;
    
    const autoCalculatedFee = rental.overdue_days > 0 ? rental.overdue_days * (rental.late_fee_per_day || 50) : 0;
    document.getElementById('calculated-late-fee-display').value = `$ ${autoCalculatedFee}`;

    document.getElementById('edit-rental-due-date').value = rental.due_date;
    
    document.getElementById('edit-rental-override-fee').value = rental.late_fee_override ?? '';

    flatpickr("#edit-rental-due-date", { dateFormat: "Y-m-d" });

    if(rental && rental.user_id) {
        loadAndBindRentalMessageDrafts(rental.user_id);
    }

    editRentalModal.style.display = 'flex';
}

async function loadAndBindRentalMessageDrafts(userId) {
    const select = document.getElementById('rental-message-draft-select');
    const content = document.getElementById('rental-direct-message-content');
    const sendBtn = document.getElementById('rental-send-direct-message-btn');
    if (!select || !content || !sendBtn) return;

    await fetchAllDrafts(); 
    select.innerHTML = '<option value="">-- 手動輸入或選擇草稿 --</option>';
    allDrafts.forEach(draft => {
        const option = document.createElement('option');
        option.value = draft.content;
        option.textContent = draft.title;
        select.appendChild(option);
    });

    select.onchange = () => { 
        content.value = select.value;
    };
    
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.onclick = async () => {
        const message = content.value.trim();
        if (!message) { alert('訊息內容不可為空！'); return; }
        if (!confirm(`確定要發送以下訊息給該顧客嗎？\n\n${message}`)) return;
        
        newSendBtn.textContent = '傳送中...';
        newSendBtn.disabled = true;
        try {
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || '傳送失敗');
            }
            alert('訊息傳送成功！');
            content.value = '';
            select.value = '';
        } catch (error) {
            alert(`傳送失敗：${error.message}`);
        } finally {
            newSendBtn.textContent = '確認發送';
            newSendBtn.disabled = false;
        }
    };
}

if (editRentalForm) {
    editRentalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rentalId = document.getElementById('edit-rental-id').value;
        const updatedData = {
            rentalId: Number(rentalId),
            dueDate: document.getElementById('edit-rental-due-date').value,
            lateFeeOverride: document.getElementById('edit-rental-override-fee').value
        };

        try {
            const response = await fetch('/api/admin/update-rental-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');

            alert('更新成功！');
            editRentalModal.style.display = 'none';
            await applyRentalFiltersAndRender();

        } catch (error) {
            alert(`錯誤： ${error.message}`);
        }
    });
}

async function openCreateRentalModal(gameId) {
    const statusDiv = document.getElementById('rental-modal-status');
    if(statusDiv) statusDiv.textContent = ''; 

    if (allUsers.length === 0) {
        if(statusDiv) statusDiv.textContent = '正在載入會員列表，請稍候...';
        try {
            await fetchAllUsers();
            if(statusDiv) statusDiv.textContent = '會員列表載入完成！';
            setTimeout(() => { if(statusDiv) statusDiv.textContent = ''; }, 2000);
        } catch (error) {
            alert('會員列表載入失敗，無法建立租借紀錄。');
            if(statusDiv) statusDiv.textContent = '';
            return;
        }
    }

    if (createRentalForm) createRentalForm.reset();
    selectedRentalUser = null;
    selectedRentalGames = []; 

    const game = allGames.find(g => g.game_id == gameId);
    if (game) {
        selectedRentalGames.push(game); 
    }
    
    updateSelectedGamesDisplay();

    const userSelect = document.getElementById('rental-user-select');
    if(userSelect) userSelect.style.display = 'none';

    // 【修改處】自動帶入預設金額
    document.getElementById('rental-rent-price').value = game ? (game.rent_price || 0) : 0;
    document.getElementById('rental-deposit').value = game ? (game.deposit || 0) : 0;
    document.getElementById('rental-late-fee').value = game ? (game.late_fee_per_day || 50) : 50;

    const today = new Date();
    today.setDate(today.getDate() + 3);
    document.getElementById('rental-due-date').value = today.toISOString().split('T')[0];

    if(createRentalModal) createRentalModal.style.display = 'flex';
}
    
function updateSelectedGamesDisplay() {
    const container = document.getElementById('rental-games-container');
    const searchInput = document.getElementById('rental-game-search');
    if(!container || !searchInput) return;

    [...container.children].forEach(child => {
        if (child.id !== 'rental-game-search') {
            container.removeChild(child);
        }
    });

    selectedRentalGames.forEach(game => {
        const chip = document.createElement('span');
        chip.className = 'game-tag-chip';
        chip.textContent = game.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button'; 
        removeBtn.className = 'remove-game-tag';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            selectedRentalGames = selectedRentalGames.filter(g => g.game_id !== game.game_id);
            updateSelectedGamesDisplay();
        };
        
        chip.appendChild(removeBtn);
        container.insertBefore(chip, searchInput); 
    });
}

if(createRentalModal) {
    const rentalUserSearch = document.getElementById('rental-user-search');
    const rentalUserSelect = document.getElementById('rental-user-select');
    const gameSearchInput = document.getElementById('rental-game-search');
    const gameSearchResults = document.getElementById('game-search-results');

    createRentalModal.querySelector('.modal-close').addEventListener('click', () => createRentalModal.style.display = 'none');
    createRentalModal.querySelector('.btn-cancel').addEventListener('click', () => createRentalModal.style.display = 'none');
    
    if (rentalUserSearch) {
        rentalUserSearch.addEventListener('input', () => {
            const searchTerm = rentalUserSearch.value.toLowerCase().trim();
            if (searchTerm.length < 2) {
                if(rentalUserSelect) rentalUserSelect.style.display = 'none';
                return;
            }
            // ** 需求 2 修改：增加 real_name 到搜尋條件 **
            const filteredUsers = allUsers.filter(user => 
                (user.line_display_name || '').toLowerCase().includes(searchTerm) ||
                (user.nickname || '').toLowerCase().includes(searchTerm) ||
                (user.user_id || '').toLowerCase().includes(searchTerm) ||
                (user.real_name || '').toLowerCase().includes(searchTerm) // 新增此行
            );
            
            if(rentalUserSelect) {
                rentalUserSelect.innerHTML = '<option value="">-- 請選擇會員 --</option>';
                filteredUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.user_id;
                    const displayName = user.nickname || user.line_display_name;
                    // 在選項中也顯示真實姓名，方便辨識
                    const realNameDisplay = user.real_name ? ` [${user.real_name}]` : '';
                    option.textContent = `${displayName}${realNameDisplay} (${user.user_id.substring(0, 10)}...)`;
                    rentalUserSelect.appendChild(option);
                });
                rentalUserSelect.style.display = 'block';
            }
        });
    }
    
    if (rentalUserSelect) {
        rentalUserSelect.addEventListener('change', () => {
            selectedRentalUser = allUsers.find(u => u.user_id === rentalUserSelect.value);
            if (selectedRentalUser) {
                const nameInput = document.getElementById('rental-contact-name');
                const phoneInput = document.getElementById('rental-contact-phone');
                if(nameInput) nameInput.value = selectedRentalUser.nickname || selectedRentalUser.line_display_name || '';
                if(phoneInput) phoneInput.value = selectedRentalUser.phone || '';
            }
        });
    }

    if(gameSearchInput && gameSearchResults) {
        gameSearchInput.addEventListener('input', () => {
            const searchTerm = gameSearchInput.value.toLowerCase().trim();
            if (searchTerm.length < 1) {
                gameSearchResults.style.display = 'none';
                return;
            }
            
            const filteredGames = allGames.filter(game => 
                game.name.toLowerCase().includes(searchTerm) &&
                !selectedRentalGames.some(sg => sg.game_id === game.game_id)
            );

            gameSearchResults.innerHTML = '';
            if (filteredGames.length > 0) {
                filteredGames.slice(0, 5).forEach(game => {
                    const li = document.createElement('li');
                    li.textContent = `${game.name} (庫存: ${game.for_rent_stock})`;
                    li.onclick = () => {
                        selectedRentalGames.push(game);
                        updateSelectedGamesDisplay();
                        gameSearchInput.value = '';
                        gameSearchResults.style.display = 'none';
                    };
                    gameSearchResults.appendChild(li);
                });
                gameSearchResults.style.display = 'block';
            } else {
                gameSearchResults.style.display = 'none';
            }
        });
    }

if (createRentalForm) {
    createRentalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedRentalUser) {
            alert('請務必搜尋並選擇一位租借會員！');
            return;
        }
        if (selectedRentalGames.length === 0) {
            alert('請至少選擇一個租借品項！');
            return;
        }

        // 【修改處】讀取表單上的客製化金額
        const rentalData = {
            userId: selectedRentalUser.user_id,
            gameIds: selectedRentalGames.map(g => g.game_id),
            dueDate: document.getElementById('rental-due-date').value,
            name: document.getElementById('rental-contact-name').value,
            phone: document.getElementById('rental-contact-phone').value,
            rentPrice: document.getElementById('rental-rent-price').value,
            deposit: document.getElementById('rental-deposit').value,
            lateFeePerDay: document.getElementById('rental-late-fee').value
        };

        if (!rentalData.name || !rentalData.phone) {
            alert('租借人姓名與電話為必填欄位！');
            return;
        }

            const gameNames = selectedRentalGames.map(g => g.name).join('\n- ');
            const confirmationMessage = `請確認租借資訊：\n\n` +
                `會員：${selectedRentalUser.nickname || selectedRentalUser.line_display_name}\n` +
                `遊戲：\n- ${gameNames}\n` +
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
                
                rentalData.gameIds.forEach(gameId => {
                    const rentedGame = allGames.find(g => g.game_id === gameId);
                    if(rentedGame) {
                        rentedGame.for_rent_stock = Number(rentedGame.for_rent_stock) - 1;
                    }
                });
                applyGameFiltersAndRender();
                
                await fetchAllRentals();
                showPage('rentals');
            } catch (error) {
                alert(`錯誤：${error.message}`);
            }
        });
    }
}
    
flatpickr("#rental-due-date", { dateFormat: "Y-m-d", minDate: "today" });


    // =================================================================
    // 訂位管理模組
    // =================================================================
    function renderBookingList(bookings) {
        if (!bookingListTbody) return;
        bookingListTbody.innerHTML = '';
        if (bookings.length === 0) {
            bookingListTbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">找不到符合條件的預約。</td></tr>';
            return;
        }
        bookings.forEach(booking => {
            const row = document.createElement('tr');
            let statusText = '未知';
            if (booking.status === 'confirmed') statusText = '預約成功';
            if (booking.status === 'checked-in') statusText = '已報到';
            if (booking.status === 'cancelled') statusText = '已取消';

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
                <td>${statusText}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-check-in" data-bookingid="${booking.booking_id}" style="background-color: #28a745;" ${booking.status !== 'confirmed' ? 'disabled' : ''}>報到</button>
                    <button class="action-btn btn-cancel-booking" data-bookingid="${booking.booking_id}" style="background-color: var(--danger-color);" ${booking.status === 'cancelled' ? 'disabled' : ''}>取消</button>
                </td>
            `;
            bookingListTbody.appendChild(row);
        });
    }

    async function fetchAllBookings(status = 'today') {
        try {
            const response = await fetch(`/api/get-bookings?status=${status}`);
            if (!response.ok) throw new Error('無法獲取預約列表');
            allBookings = await response.json();
            renderBookingList(allBookings);
        } catch (error) { 
            console.error('獲取預約列表失敗:', error); 
            if(bookingListTbody) bookingListTbody.innerHTML = '<tr><td colspan="5" style="color: red; text-align: center;">讀取預約失敗</td></tr>';
        }
    }
    
    const bookingStatusFilter = document.getElementById('booking-status-filter');
    if (bookingStatusFilter) {
        bookingStatusFilter.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                bookingStatusFilter.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                const status = e.target.dataset.filter;
                fetchAllBookings(status);
            }
        });
    }
    
    async function initializeBookingSettings() {
        if (bookingDatepicker) return; // 如果已初始化，則不再執行

        try {
            const response = await fetch('/api/admin/booking-settings');
            if (!response.ok) throw new Error('無法獲取公休日設定');
            disabledDates = await response.json();

            bookingDatepicker = flatpickr("#booking-datepicker-admin-container", {
                inline: true,
                mode: "multiple",
                dateFormat: "Y-m-d",
                defaultDate: disabledDates
            });
        } catch (error) {
            console.error("初始化公休日設定失敗:", error);
            alert("初始化公休日設定失敗，請檢查 API。");
        }
    }

    async function saveBookingSettings() {
        const saveBtn = document.getElementById('save-booking-settings-btn');
        if (!bookingDatepicker || !saveBtn) return;
        
        saveBtn.textContent = '儲存中...';
        saveBtn.disabled = true;

        try {
            const newDisabledDates = bookingDatepicker.selectedDates.map(d => bookingDatepicker.formatDate(d, "Y-m-d"));
            
            // 找出需要新增和刪除的日期
            const datesToAdd = newDisabledDates.filter(d => !disabledDates.includes(d));
            const datesToRemove = disabledDates.filter(d => !newDisabledDates.includes(d));

            // 建立所有需要執行的 API 請求
            const promises = [];
            datesToAdd.forEach(date => {
                promises.push(fetch('/api/admin/booking-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, action: 'add' })
                }));
            });
            datesToRemove.forEach(date => {
                promises.push(fetch('/api/admin/booking-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, action: 'remove' })
                }));
            });

            // 等待所有請求完成
            await Promise.all(promises);

            // 成功後，更新本地的日期列表
            disabledDates = newDisabledDates;
            alert('公休日設定已成功儲存！');
            if (bookingSettingsModal) bookingSettingsModal.style.display = 'none';

        } catch (error) {
            console.error("儲存公休日設定失敗:", error);
            alert("儲存失敗，請再試一次。");
        } finally {
            saveBtn.textContent = '儲存設定';
            saveBtn.disabled = false;
        }
    }

    if(manageBookingDatesBtn) {
        manageBookingDatesBtn.addEventListener('click', () => {
            initializeBookingSettings(); // 確保日曆已初始化
            if (bookingSettingsModal) {
                bookingSettingsModal.style.display = 'flex';
            }
        });
    }

    if(bookingSettingsModal) {
        bookingSettingsModal.querySelector('.modal-close').addEventListener('click', () => bookingSettingsModal.style.display = 'none');
        bookingSettingsModal.querySelector('.btn-cancel').addEventListener('click', () => bookingSettingsModal.style.display = 'none');
        // 綁定新的儲存按鈕事件
        const saveBtn = bookingSettingsModal.querySelector('#save-booking-settings-btn');
        if(saveBtn) saveBtn.addEventListener('click', saveBookingSettings);
    }

// REPLACE THIS EVENT LISTENER
if(bookingListTbody){
    bookingListTbody.addEventListener('click', async (event) => {
        const target = event.target;
        const bookingId = target.dataset.bookingid;
        if (!bookingId) return;

        const handleStatusUpdate = async (id, newStatus, confirmMsg, successMsg, errorMsg) => {
            const booking = allBookings.find(b => b.booking_id == id);
            if (!booking) return;
            if (confirm(confirmMsg)) {
                 try {
                    const response = await fetch('/api/update-booking-status', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId: Number(id), status: newStatus })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || errorMsg);
                    alert(successMsg);
                    booking.status = newStatus;
                    renderBookingList(allBookings);
                } catch (error) { alert(`錯誤：${error.message}`); }
            }
        };

        if (target.classList.contains('btn-check-in')) {
            const booking = allBookings.find(b => b.booking_id == bookingId);
            await handleStatusUpdate(bookingId, 'checked-in', 
                `確定要將 ${booking.booking_date} ${booking.contact_name} 的預約標示為「已報到」嗎？`,
                '報到成功！', '報到失敗');
        }
        
        // ** 需求 3 修改：取消按鈕的邏輯 **
        if (target.classList.contains('btn-cancel-booking')) {
            const booking = allBookings.find(b => b.booking_id == bookingId);
            openCancelBookingModal(booking);
        }
    });
}

// ADD THESE TWO ITEMS

// ** 需求 3 新增：打開取消預約視窗的函式 **
async function openCancelBookingModal(booking) {
    if (!booking || !cancelBookingModal) return;

    document.getElementById('cancel-booking-info').textContent = `${booking.booking_date} ${booking.contact_name}`;
    
    const select = document.getElementById('cancel-message-draft-select');
    const content = document.getElementById('cancel-direct-message-content');
    const confirmBtn = document.getElementById('confirm-cancel-booking-btn');

    content.value = ''; // 清空
    await fetchAllDrafts(); // 確保草稿已載入
    select.innerHTML = '<option value="">-- 不發送通知或手動輸入 --</option>';
    allDrafts.forEach(draft => {
        const option = document.createElement('option');
        option.value = draft.content;
        option.textContent = draft.title;
        select.appendChild(option);
    });

    select.onchange = () => { content.value = select.value; };

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = async () => {
        const message = content.value.trim();
        const shouldSendMessage = message.length > 0;

        if (!confirm(`確定要取消此預約嗎？${shouldSendMessage ? '\n\n並發送通知訊息。' : ''}`)) return;

        try {
            newConfirmBtn.textContent = '處理中...';
            newConfirmBtn.disabled = true;

            if (shouldSendMessage) {
                const msgResponse = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: booking.user_id, message: message })
                });
                 if (!msgResponse.ok) console.error("發送 LINE 通知失敗");
            }

            const statusResponse = await fetch('/api/update-booking-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: Number(booking.booking_id), status: 'cancelled' })
            });

            if (!statusResponse.ok) throw new Error('更新預約狀態失敗');

            alert('預約已成功取消！');
            booking.status = 'cancelled';
            renderBookingList(allBookings);
            cancelBookingModal.style.display = 'none';

        } catch (error) {
            alert(`操作失敗：${error.message}`);
        } finally {
            newConfirmBtn.textContent = '確認取消';
            newConfirmBtn.disabled = false;
        }
    };

    cancelBookingModal.style.display = 'flex';
}

// ** 需求 3 新增：為取消視窗加上關閉按鈕事件 **
if(cancelBookingModal) {
    cancelBookingModal.querySelector('.modal-close').addEventListener('click', () => cancelBookingModal.style.display = 'none');
}

    // =================================================================
    // 掃碼加點模組
    // =================================================================
    function onScanSuccess(decodedText, decodedResult) {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                if(qrReaderElement) qrReaderElement.style.display = 'none';
                if(scanResultSection) scanResultSection.style.display = 'block';
                if(userIdDisplay) userIdDisplay.value = decodedText;
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
        if(scanResultSection) scanResultSection.style.display = 'none';
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
            if(customReasonInput) customReasonInput.style.display = (reasonSelect.value === 'other') ? 'block' : 'none';
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
                if(expInput) expInput.value = '';
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
    // 經驗紀錄模組
    // =================================================================
// public/admin-login.js

async function fetchAllExpHistory() {
    try {
        // 【修改這裡】將網址對應到新的檔案名稱
        const response = await fetch('/api/admin/exp-history-list');

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
        if(!newsListTbody) return;
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
        if(editNewsForm) editNewsForm.reset();
        currentEditingNewsId = news ? news.id : null;
        if(modalNewsTitle) modalNewsTitle.textContent = news ? '編輯情報' : '新增情報';
        
        if (news) {
            document.getElementById('edit-news-id').value = news.id;
            document.getElementById('edit-news-title').value = news.title;
            document.getElementById('edit-news-category').value = news.category;
            document.getElementById('edit-news-date').value = news.published_date;
            document.getElementById('edit-news-image').value = news.image_url;
            document.getElementById('edit-news-content').value = news.content;
            document.getElementById('edit-news-published').checked = !!news.is_published;
            if(deleteNewsBtn) deleteNewsBtn.style.display = 'inline-block';
        } else {
            if(deleteNewsBtn) deleteNewsBtn.style.display = 'none';
        }
        
        if(editNewsModal) editNewsModal.style.display = 'flex';
    }

    if(addNewsBtn) addNewsBtn.addEventListener('click', () => openEditNewsModal());
    if(editNewsModal) {
        editNewsModal.querySelector('.modal-close').addEventListener('click', () => editNewsModal.style.display = 'none');
        editNewsModal.querySelector('.btn-cancel').addEventListener('click', () => editNewsModal.style.display = 'none');
    }
    
    if(newsListTbody) {
        newsListTbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-edit')) {
                const newsId = e.target.dataset.newsId;
                const newsItem = allNews.find(n => n.id == newsId);
                openEditNewsModal(newsItem);
            }
        });
    }

    if(editNewsForm) {
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
                if(editNewsModal) editNewsModal.style.display = 'none';
                await fetchAllNews();
            } catch (error) { alert(`錯誤：${error.message}`); }
        });
    }
    
    if(deleteNewsBtn) {
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
                if(editNewsModal) editNewsModal.style.display = 'none';
                await fetchAllNews();
            } catch (error) { alert(`錯誤：${error.message}`); }
        });
    }

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

    if(storeInfoForm) {
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
    }

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
        showPage('dashboard'); // 預設顯示儀表板
    }
    
    initialize();

});

