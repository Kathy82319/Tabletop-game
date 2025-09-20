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
    
    // 訂位管理
    const bookingListTbody = document.getElementById('booking-list-tbody');
    const manageBookingDatesBtn = document.getElementById('manage-booking-dates-btn');
    const bookingSettingsModal = document.getElementById('booking-settings-modal'); 
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

        contentContainer.innerHTML = `
            <div class="details-grid">
                <div class="profile-summary">
                    <img src="${profile.line_picture_url || 'placeholder.jpg'}" alt="Profile Picture">
                    <h4>${displayName}</h4>
                    <p>姓名: ${profile.real_name || '未設定'}</p>
                    <p>等級: ${profile.level} (${profile.current_exp}/10 EXP)</p>
                    <p>職業: ${profile.class}</p>
                    <p>標籤: ${profile.tag || '無'}</p>
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
            return `<td>${value}</td>`;
        }).join('') + '</tr>').join('');
        return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
    }

    if (userDetailsModal) {
        userDetailsModal.querySelector('.modal-close').addEventListener('click', () => userDetailsModal.style.display = 'none');
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
        const stockFilter = document.querySelector('#inventory-stock-filter .active').dataset.filter;
        if (stockFilter === 'in_stock') {
            filteredGames = filteredGames.filter(game => Number(game.for_rent_stock) > 0);
        } else if (stockFilter === 'out_of_stock') {
            filteredGames = filteredGames.filter(game => Number(game.for_rent_stock) <= 0);
        }

        // 3. 上架狀態篩選
        const visibilityFilter = document.querySelector('#inventory-visibility-filter .active').dataset.filter;
        if (visibilityFilter === 'visible') {
            filteredGames = filteredGames.filter(game => game.is_visible === 1 || String(game.is_visible).toUpperCase() === 'TRUE');
        } else if (visibilityFilter === 'hidden') {
            filteredGames = filteredGames.filter(game => !(game.is_visible === 1 || String(game.is_visible).toUpperCase() === 'TRUE'));
        }
        
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
    
    if (gameSearchInput) {
        gameSearchInput.addEventListener('input', applyGameFiltersAndRender);
    }
    
    // 為新的篩選按鈕群組加上事件監聽
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
                await fetchAllGames();
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

    function openEditGameModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) return alert('找不到遊戲資料');

        if(editGameForm) editGameForm.reset();
        document.getElementById('modal-game-title').textContent = `編輯：${game.name}`;
        document.getElementById('edit-game-id').value = game.game_id;
        document.getElementById('edit-for-rent-stock').value = game.for_rent_stock || 0;
        document.getElementById('edit-sale-price').value = game.sale_price || 0;
        document.getElementById('edit-rent-price').value = game.rent_price || 0;
        document.getElementById('edit-is-visible').checked = game.is_visible === 1 || String(game.is_visible).toUpperCase() === 'TRUE';
        
        if(editGameModal) editGameModal.style.display = 'flex';
    }

    if(editGameModal) {
        editGameModal.querySelector('.modal-close').addEventListener('click', () => editGameModal.style.display = 'none');
        editGameModal.querySelector('.btn-cancel').addEventListener('click', () => editGameModal.style.display = 'none');

        if(editGameForm) {
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
                    
                    const game = allGames.find(g => g.game_id === gameId);
                    if (game) {
                        Object.assign(game, updatedData, { is_visible: updatedData.is_visible ? 1 : 0 });
                    }
                    
                    applyGameFiltersAndRender();
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

        // 呼叫更新後的 API
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
            renderRentalList(filteredRentals);
        } catch (error) { 
            console.error('獲取租借列表失敗:', error); 
        }
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

    // 簡化 fetchAllRentals，因為篩選函式會自己去 fetch
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

    if (rentalListTbody) {
        rentalListTbody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-return')) {
                const rentalId = e.target.dataset.rentalid;
                const rental = allRentals.find(r => r.rental_id == rentalId);
                if (!rental) return;
                
                if (confirm(`確定要將《${rental.game_name}》標記為已歸還嗎？`)) {
                    try {
                        const response = await fetch('/api/admin/update-rental-status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rentalId: Number(rentalId), status: 'returned' })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || '歸還失敗');
                        alert('歸還成功！');
                        
                        // 刷新列表以顯示最新狀態
                        await applyRentalFiltersAndRender();
                        // 同時也刷新庫存頁面的資料，如果它已經被載入
                        if (allGames.length > 0) {
                            await fetchAllGames();
                        }

                    } catch (error) {
                        alert(`錯誤：${error.message}`);
                    }
                }
            }
        });
    }


    function openCreateRentalModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) { alert('找不到遊戲資料！'); return; }
        if (createRentalForm) createRentalForm.reset();
        selectedRentalUser = null;
        
        const userSelect = document.getElementById('rental-user-select');
        if(userSelect) userSelect.style.display = 'none';

        document.getElementById('rental-game-id').value = game.game_id;
        document.getElementById('rental-game-name').value = game.name;
        document.getElementById('rental-deposit').value = game.deposit || 0;
        document.getElementById('rental-late-fee').value = game.late_fee_per_day || 50;
        
        const today = new Date();
        today.setDate(today.getDate() + 3);
        document.getElementById('rental-due-date').value = today.toISOString().split('T')[0];

        if(createRentalModal) createRentalModal.style.display = 'flex';
    }
    
    if(createRentalModal) {
        const rentalUserSearch = document.getElementById('rental-user-search');
        const rentalUserSelect = document.getElementById('rental-user-select');

        createRentalModal.querySelector('.modal-close').addEventListener('click', () => createRentalModal.style.display = 'none');
        createRentalModal.querySelector('.btn-cancel').addEventListener('click', () => createRentalModal.style.display = 'none');
        
        if (rentalUserSearch) {
            rentalUserSearch.addEventListener('input', () => {
                const searchTerm = rentalUserSearch.value.toLowerCase().trim();
                if (searchTerm.length < 2) {
                    if(rentalUserSelect) rentalUserSelect.style.display = 'none';
                    return;
                }
                const filteredUsers = allUsers.filter(user => 
                    (user.line_display_name || '').toLowerCase().includes(searchTerm) ||
                    (user.nickname || '').toLowerCase().includes(searchTerm) ||
                    (user.user_id || '').toLowerCase().includes(searchTerm)
                );
                
                if(rentalUserSelect) {
                    rentalUserSelect.innerHTML = '<option value="">-- 請選擇會員 --</option>';
                    filteredUsers.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.user_id;
                        const displayName = user.nickname || user.line_display_name;
                        option.textContent = `${displayName} (${user.user_id.substring(0, 10)}...)`;
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

        if (createRentalForm) {
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
                    
                    // START: 修正前端畫面同步
                    const rentedGame = allGames.find(g => g.game_id === rentalData.gameId);
                    if(rentedGame) {
                        rentedGame.for_rent_stock = Number(rentedGame.for_rent_stock) - 1;
                    }
                    applyGameFiltersAndRender();
                    // END: 修正前端畫面同步
                    
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
                        // 直接從前端更新列表，避免重新 API 請求
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
            
            if (target.classList.contains('btn-cancel-booking')) {
                const booking = allBookings.find(b => b.booking_id == bookingId);
                await handleStatusUpdate(bookingId, 'cancelled', 
                    `確定要取消 ${booking.booking_date} ${booking.contact_name} 的預約嗎？`,
                    '預約已成功取消！', '取消預約失敗');
            }
        });
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
    async function fetchAllExpHistory() {
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