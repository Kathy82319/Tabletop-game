document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素宣告 ---
    const mainNav = document.querySelector('.nav-tabs');
    const pages = document.querySelectorAll('.page');
    
    // 顧客管理
    const userListTbody = document.getElementById('user-list-tbody');
    const userSearchInput = document.getElementById('user-search-input');
    const editTagModal = document.getElementById('edit-tag-modal');
    const editTagForm = document.getElementById('edit-tag-form');
    
    // 庫存管理
    const gameListTbody = document.getElementById('game-list-tbody');
    const gameSearchInput = document.getElementById('game-search-input');
    const editGameModal = document.getElementById('edit-game-modal');
    const editGameForm = document.getElementById('edit-game-form');
    const visibilityFilter = document.getElementById('visibility-filter');
    const rentalTypeFilter = document.getElementById('rental-type-filter');

    // 訂位管理
    const bookingListTbody = document.getElementById('booking-list-tbody');

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
    let allUsers = [], allGames = [], allBookings = [], allNews = [];
    let gameFilters = { visibility: 'all', rentalType: 'all' };
    let html5QrCode = null;
    let currentEditingNewsId = null;

    // ---- 頁面切換邏輯 ----
    function showPage(pageId) {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("停止掃描器失敗", err));
        }
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(`page-${pageId}`)?.classList.add('active');

        document.querySelectorAll('.nav-tabs a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) link.classList.add('active');
        });

        if (pageId === 'users' && allUsers.length === 0) fetchAllUsers();
        if (pageId === 'inventory' && allGames.length === 0) fetchAllGames();
        if (pageId === 'bookings' && allBookings.length === 0) fetchAllBookings();
        if (pageId === 'scan') startScanner();
        if (pageId === 'news' && allNews.length === 0) fetchAllNews();
        if (pageId === 'store-info') fetchStoreInfo();
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
            row.innerHTML = `
                <td style="text-align: left; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${user.line_display_name || 'N/A'}</td>
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

    editTagModal.querySelector('.btn-cancel').addEventListener('click', () => editTagModal.style.display = 'none');
    
    document.getElementById('edit-tag-select').addEventListener('change', (e) => {
        document.getElementById('edit-tag-other-input').style.display = (e.target.value === 'other') ? 'block' : 'none';
    });

    editTagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const tagSelect = document.getElementById('edit-tag-select');
        let newTag = tagSelect.value;
        if (newTag === 'other') newTag = document.getElementById('edit-tag-other-input').value.trim();
        try {
            const response = await fetch('/api/update-user-tag', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, tag: newTag })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');
            const user = allUsers.find(u => u.user_id === userId);
            if (user) user.tag = newTag;
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
            if (!confirm(`確定要從 Google Sheet 同步使用者 ${userId} 的資料嗎？`)) return;
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
        if (!allGames) return;
        const searchTerm = gameSearchInput.value.toLowerCase().trim();
        let filteredGames = allGames.filter(game => 
            (game.name || '').toLowerCase().includes(searchTerm) &&
            (gameFilters.visibility === 'all' || String(game.is_visible).toUpperCase() === gameFilters.visibility) &&
            (gameFilters.rentalType === 'all' || game.rental_type === gameFilters.rentalType)
        );
        renderGameList(filteredGames);
    }

    function renderGameList(games) {
        if (!gameListTbody) return;
        gameListTbody.innerHTML = '';
        games.forEach(game => {
            const row = document.createElement('tr');
            const isVisible = String(game.is_visible).toUpperCase() === 'TRUE';
            
            row.innerHTML = `
                <td class="compound-cell">
                    <div class="main-info">${game.name}</div>
                    <div class="sub-info">ID: ${game.game_id}</div>
                </td>
                <td>${game.total_stock}</td>
                <td>${isVisible ? '是' : '否'}</td>
                <td>${game.rental_type || 'N/A'}</td>
                <td class="actions-cell"><button class="action-btn btn-edit" data-gameid="${game.game_id}">編輯</button></td>
            `;
            gameListTbody.appendChild(row);
        });
    }

    async function fetchAllGames() {
        try {
            // ** 關鍵修正：將 API 路徑指向我們為後台專門建立的 API **
            const response = await fetch('/api/admin/get-sheet-boardgames'); 
            
            if (!response.ok) {
                // 嘗試解析 JSON 錯誤訊息，如果失敗，則顯示文字內容
                let errorDetails = '';
                try {
                    const errData = await response.json();
                    errorDetails = errData.details || errData.error || '無法獲取桌遊列表';
                } catch (e) {
                    errorDetails = await response.text();
                }
                throw new Error(errorDetails);
            }

            allGames = await response.json();
            applyGameFiltersAndRender();

        } catch (error) { 
            console.error('從 Google Sheet 獲取桌遊列表失敗:', error); 
            if(gameListTbody) gameListTbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">讀取資料失敗: ${error.message}</td></tr>`;
        }
    }

    gameSearchInput.addEventListener('input', applyGameFiltersAndRender);

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
    setupFilterButtons(rentalTypeFilter, 'rentalType');

    function openEditGameModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) return;
        alert(`此處為預覽，請直接在 Google Sheet 中編輯桌遊: ${game.name}`);
    }

    gameListTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit')) {
            openEditGameModal(e.target.dataset.gameid);
        }
    });

    const syncGamesBtn = document.getElementById('sync-games-btn');
    if (syncGamesBtn) {
        syncGamesBtn.addEventListener('click', async () => {
            if (!confirm('確定要用 Google Sheet 的內容覆寫 D1 資料庫嗎？這將會影響 LIFF 前台顯示的資料。')) return;
            try {
                syncGamesBtn.textContent = '同步中...';
                syncGamesBtn.disabled = true;
                // POST 請求到舊的 API，觸發同步到 D1 的動作 (這個路徑是正確的)
                const response = await fetch('/api/get-boardgames', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || '同步失敗');
                alert(result.message);
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                syncGamesBtn.textContent = '同步至資料庫';
                syncGamesBtn.disabled = false;
            }
        });
    }
    
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
    function initialize() {
        showPage('users');
    }
    
    initialize();
});