// public/admin-login.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素宣告 ---
    const mainNav = document.querySelector('.nav-tabs');
    const pages = document.querySelectorAll('.page');
    
    // 顧客管理
    const userListTbody = document.getElementById('user-list-tbody');
    const userSearchInput = document.getElementById('user-search-input');
    const editTagModal = document.getElementById('edit-tag-modal');
    
    // 庫存管理
    const gameListTbody = document.getElementById('game-list-tbody');
    const gameSearchInput = document.getElementById('game-search-input');
    const editGameModal = document.getElementById('edit-game-modal');

    // ** 新增：訂位管理 **
    const bookingListTbody = document.getElementById('booking-list-tbody');

    // --- 全域狀態變數 ---
    let allUsers = [];
    let allGames = [];
    let allBookings = []; // ** 新增 **
    let gameFilters = { visibility: 'all', rentalType: 'all' };

    // ---- 頁面切換邏輯 ----
    function showPage(pageId) {
        pages.forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) targetPage.classList.add('active');

        document.querySelectorAll('.nav-tabs a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) link.classList.add('active');
        });

        // ** 新增：切換到對應頁面時，如果資料為空就自動載入 **
        if (pageId === 'inventory' && allGames.length === 0) fetchAllGames();
        if (pageId === 'bookings' && allBookings.length === 0) fetchAllBookings();
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
            // ** 關鍵修正：移除暱稱，並修改操作按鈕的結構 **
            row.innerHTML = `
                <td>${user.line_display_name || 'N/A'}</td>
                <td>${user.level}</td>
                <td>${user.current_exp} / 10</td>
                <td><span class="tag-display">${user.tag || '無'}</span></td>
                <td class="actions-cell">
                    <button class="action-btn btn-edit" data-userid="${user.user_id}">編輯標籤</button>
                    <button class="action-btn btn-sync" data-userid="${user.user_id}">同步</button>
                </td>
            `;
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

    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.toLowerCase().trim();
        const filteredUsers = searchTerm ? allUsers.filter(user => (user.line_display_name || '').toLowerCase().includes(searchTerm)) : allUsers;
        renderUserList(filteredUsers);
    });
    
    function openEditTagModal(userId) {
        const user = allUsers.find(u => u.user_id === userId);
        if (!user) return;
        
        const modalTitle = document.getElementById('modal-user-title');
        const userIdInput = document.getElementById('edit-user-id');
        const tagSelect = document.getElementById('edit-tag-select');
        const otherInput = document.getElementById('edit-tag-other-input');

        modalTitle.textContent = `編輯標籤：${user.line_display_name}`;
        userIdInput.value = user.user_id;
        
        const standardTags = ["", "會員", "員工", "特殊"];
        if (user.tag && !standardTags.includes(user.tag)) {
            tagSelect.value = 'other';
            otherInput.style.display = 'block';
            otherInput.value = user.tag;
        } else {
            tagSelect.value = user.tag || '';
            otherInput.style.display = 'none';
            otherInput.value = '';
        }
        
        editTagModal.style.display = 'flex';
    }

    editTagModal.querySelector('.modal-close').addEventListener('click', () => editTagModal.style.display = 'none');
    editTagModal.querySelector('.btn-cancel').addEventListener('click', () => editTagModal.style.display = 'none');
    
    document.getElementById('edit-tag-select').addEventListener('change', (e) => {
        const otherInput = document.getElementById('edit-tag-other-input');
        otherInput.style.display = (e.target.value === 'other') ? 'block' : 'none';
    });

    editTagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const tagSelect = document.getElementById('edit-tag-select');
        let newTag = tagSelect.value;

        if (newTag === 'other') {
            newTag = document.getElementById('edit-tag-other-input').value.trim();
        }

        try {
            const response = await fetch('/api/update-user-tag', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, tag: newTag })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');
            
            const user = allUsers.find(u => u.user_id === userId);
            if (user) user.tag = newTag;
            
            // 直接重新渲染，確保資料一致性
            const currentSearch = userSearchInput.value;
            const filteredUsers = currentSearch ? allUsers.filter(u => (u.line_display_name || '').toLowerCase().includes(currentSearch.toLowerCase().trim())) : allUsers;
            renderUserList(filteredUsers);
            
            editTagModal.style.display = 'none';
        } catch (error) { alert(`錯誤：${error.message}`); }
    });

    userListTbody.addEventListener('click', async (event) => {
        const target = event.target;
        const userId = target.dataset.userid;
        if (!userId) return;

        if (target.classList.contains('btn-edit')) openEditTagModal(userId);

        if (target.classList.contains('btn-sync')) {
            if (!confirm(`確定要從 Google Sheet 同步使用者 ${userId} 的資料嗎？D1 資料庫中的該筆紀錄將被覆蓋。`)) return;
            try {
                target.textContent = '同步中...';
                target.disabled = true;
                const response = await fetch('/api/sync-user-from-sheet', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error || '同步失敗');
                alert('同步成功！將重新整理列表資料。');
                await fetchAllUsers();
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
        const searchTerm = gameSearchInput.value.toLowerCase().trim();
        let filteredGames = allGames;

        if (searchTerm) filteredGames = filteredGames.filter(game => (game.name || '').toLowerCase().includes(searchTerm));
        if (gameFilters.visibility !== 'all') filteredGames = filteredGames.filter(game => game.is_visible === gameFilters.visibility);
        if (gameFilters.rentalType !== 'all') filteredGames = filteredGames.filter(game => game.rental_type === gameFilters.rentalType);
        
        renderGameList(filteredGames);
    }
    
    function renderGameList(games) {
        if (!gameListTbody) return;
        gameListTbody.innerHTML = '';
        games.forEach(game => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="game-info">
                    <div class="game-name">${game.name}</div>
                    <div class="game-id">ID: ${game.game_id}</div>
                </td>
                <td>${game.total_stock}</td>
                <td>${game.is_visible === 'TRUE' ? '是' : '否'}</td>
                <td>${game.rental_type || 'N/A'}</td>
                <td><button class="action-btn btn-edit" data-gameid="${game.game_id}">編輯</button></td>
            `;
            gameListTbody.appendChild(row);
        });
    }

    async function fetchAllGames() {
        try {
            const response = await fetch('/api/get-boardgames');
            if (!response.ok) throw new Error('無法獲取桌遊列表');
            allGames = await response.json();
            applyGameFiltersAndRender();
        } catch (error) { console.error('獲取桌遊列表失敗:', error); }
    }

    gameSearchInput.addEventListener('input', applyGameFiltersAndRender);

    function setupFilterButtons(filterContainer, filterKey) {
        filterContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                filterContainer.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                gameFilters[filterKey] = e.target.dataset.filter;
                applyGameFiltersAndRender();
            }
        });
    }
    setupFilterButtons(visibilityFilter, 'visibility');
    setupFilterButtons(rentalTypeFilter, 'rentalType');
    
    function openEditGameModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) return;
        document.getElementById('modal-game-title').textContent = `編輯桌遊：${game.name}`;
        document.getElementById('edit-game-id').value = game.game_id;
        document.getElementById('edit-total-stock').value = game.total_stock;
        document.getElementById('edit-is-visible').value = game.is_visible || 'TRUE';
        document.getElementById('edit-rental-type').value = game.rental_type || '僅供內借';
        editGameModal.style.display = 'flex';
    }

    gameListTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit')) openEditGameModal(e.target.dataset.gameid);
    });

    editGameModal.querySelector('.modal-close').addEventListener('click', () => editGameModal.style.display = 'none');
    editGameModal.querySelector('.btn-cancel').addEventListener('click', () => editGameModal.style.display = 'none');
    
    editGameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const gameId = document.getElementById('edit-game-id').value;
        const formData = {
            gameId: Number(gameId),
            total_stock: Number(document.getElementById('edit-total-stock').value),
            is_visible: document.getElementById('edit-is-visible').value,
            rental_type: document.getElementById('edit-rental-type').value
        };

        try {
            const response = await fetch('/api/update-boardgame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');

            alert('更新成功！');
            editGameModal.style.display = 'none';
            const gameIndex = allGames.findIndex(g => g.game_id == gameId);
            if (gameIndex > -1) {
                // 更新緩存資料時，要用展開語法合併，而不是直接替換
                allGames[gameIndex] = { ...allGames[gameIndex], ...formData };
            }
            applyGameFiltersAndRender(); // 重新渲染列表
        } catch (error) { alert(`錯誤：${error.message}`); }
    });

    // =================================================================
    // ** 新增：訂位管理模組 **
    // =================================================================

    // 渲染預約列表到表格
    function renderBookingList(bookings) {
        if (!bookingListTbody) return;
        bookingListTbody.innerHTML = '';

        if (bookings.length === 0) {
            bookingListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">目前沒有即將到來的預約。</td></tr>';
            return;
        }

        bookings.forEach(booking => {
            const row = document.createElement('tr');
            row.dataset.bookingId = booking.booking_id;
            row.innerHTML = `
                <td>${booking.booking_date}</td>
                <td>${booking.time_slot}</td>
                <td>${booking.contact_name}</td>
                <td>${booking.contact_phone}</td>
                <td>${booking.num_of_people}</td>
                <td class="actions-cell">
                    <button class="action-btn btn-cancel-booking" data-bookingid="${booking.booking_id}">取消預約</button>
                </td>
            `;
            bookingListTbody.appendChild(row);
        });
    }

    // 從後端 API 獲取所有預約資料
    async function fetchAllBookings() {
        try {
            const response = await fetch('/api/get-bookings');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '無法獲取預約列表');
            }
            allBookings = await response.json();
            renderBookingList(allBookings);
        } catch (error) {
            console.error('獲取預約列表失敗:', error);
            if (bookingListTbody) {
                bookingListTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">${error.message}</td></tr>`;
            }
        }
    }

    // 處理取消預約的點擊事件
    bookingListTbody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('btn-cancel-booking')) {
            const bookingId = event.target.dataset.bookingid;
            const booking = allBookings.find(b => b.booking_id == bookingId);

            if (!booking) return;

            if (confirm(`確定要取消 ${booking.booking_date} ${booking.contact_name} 的預約嗎？`)) {
                try {
                    const response = await fetch('/api/update-booking-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookingId: Number(bookingId), status: 'cancelled' })
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || '取消預約失敗');

                    alert('預約已成功取消！');
                    
                    // 從前端列表中移除該筆預約，或重新整理
                    allBookings = allBookings.filter(b => b.booking_id != bookingId);
                    renderBookingList(allBookings);

                } catch (error) {
                    alert(`錯誤：${error.message}`);
                }
            }
        }
    });


    // ---- 初始化 ----
    function initialize() {
        showPage('users');
        fetchAllUsers();
    }
    initialize();
});