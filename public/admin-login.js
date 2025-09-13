// public/admin-login.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素宣告 ---
    const mainNav = document.querySelector('.nav-tabs');
    const pages = document.querySelectorAll('.page');
    
    // 顧客管理頁面元素
    const userListTbody = document.getElementById('user-list-tbody');
    const userSearchInput = document.getElementById('user-search-input');
    
    // 庫存管理頁面元素
    const gameListTbody = document.getElementById('game-list-tbody');
    const gameSearchInput = document.getElementById('game-search-input');
    const editGameModal = document.getElementById('edit-game-modal');
    const editGameForm = document.getElementById('edit-game-form');
    const modalTitle = document.getElementById('modal-title');
    const closeModalBtn = document.querySelector('.modal-close');
    const cancelModalBtn = document.querySelector('.btn-cancel');

    // --- 全域狀態變數 ---
    let allUsers = [];
    let allGames = [];

    // ---- 頁面切換邏輯 ----
    function showPage(pageId) {
        pages.forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) targetPage.classList.add('active');

        document.querySelectorAll('.nav-tabs a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) link.classList.add('active');
        });

        // 如果切換到庫存管理頁面且資料尚未載入，則載入資料
        if (pageId === 'inventory' && allGames.length === 0) {
            fetchAllGames();
        }
    }

    mainNav.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const pageId = event.target.getAttribute('href').substring(1);
            showPage(pageId);
        }
    });
    
    // ** 關鍵修正：監聽新的導覽列 **
    mainNav.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const pageId = event.target.getAttribute('href').substring(1);
            showPage(pageId);
        }
    });

    // ---- 使用者管理邏輯 ----

    // 渲染使用者列表
    function renderUserList(users) {
        if (!userListTbody) return;
        userListTbody.innerHTML = '';
        if (users.length === 0) {
            userListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到任何使用者資料。</td></tr>';
            return;
        }
        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.user_id;
            row.innerHTML = `
                <td>${user.line_display_name || 'N/A'}</td>
                <td>${user.nickname || ''}</td>
                <td>${user.level}</td>
                <td>${user.current_exp} / 10</td>
                <td><span class="tag-display">${user.tag || '無'}</span></td>
                <td>
                    <button class="action-btn btn-edit" data-userid="${user.user_id}">編輯標籤</button>
                    <button class="action-btn btn-sync" data-userid="${user.user_id}">從Sheet同步</button>
                </td>
            `;
            userListTbody.appendChild(row);
        });
    }

    // 從後端 API 獲取所有使用者資料 (增強錯誤處理版)
    async function fetchAllUsers() {
        try {
            const response = await fetch('/api/get-users');
            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                throw new Error(`伺服器回應格式錯誤 (狀態碼: ${response.status})，內容: ${errorText.substring(0, 100)}...`);
            }
            allUsers = await response.json();
            renderUserList(allUsers);
        } catch (error) {
            console.error('獲取使用者列表失敗:', error);
            if (userListTbody) {
                userListTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">獲取資料失敗：${error.message}</td></tr>`;
            }
        }
    }

    // 搜尋功能
    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.toLowerCase().trim();
        const filteredUsers = searchTerm ? allUsers.filter(user => 
            (user.line_display_name || '').toLowerCase().includes(searchTerm) || 
            (user.nickname || '').toLowerCase().includes(searchTerm)
        ) : allUsers;
        renderUserList(filteredUsers);
    });

    // 按鈕事件處理 (使用事件代理)
    userListTbody.addEventListener('click', async (event) => {
        const target = event.target;
        const userId = target.dataset.userid;
        if (!userId) return;

        if (target.classList.contains('btn-edit')) {
            const currentTag = allUsers.find(u => u.user_id === userId).tag || '';
            const newTag = prompt('請輸入新的標籤 (會員, 員工, 特殊, 或其他):', currentTag);
            
            if (newTag !== null) {
                try {
                    const response = await fetch('/api/update-user-tag', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: userId, tag: newTag.trim() })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || '更新失敗');
                    
                    const user = allUsers.find(u => u.user_id === userId);
                    user.tag = newTag.trim();
                    const tagDisplay = document.querySelector(`tr[data-user-id="${userId}"] .tag-display`);
                    if (tagDisplay) tagDisplay.textContent = newTag.trim() || '無';
                    alert('標籤更新成功！');
                } catch (error) {
                    alert(`錯誤：${error.message}`);
                }
            }
        }

        if (target.classList.contains('btn-sync')) {
            if (!confirm(`確定要從 Google Sheet 同步使用者 ${userId} 的資料嗎？D1 資料庫中的該筆紀錄將被覆蓋。`)) return;

            try {
                target.textContent = '同步中...';
                target.disabled = true;

                const response = await fetch('/api/sync-user-from-sheet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error || '同步失敗');

                alert('同步成功！將重新整理列表資料。');
                await fetchAllUsers();
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                target.textContent = '從Sheet同步';
                target.disabled = false;
            }
        }
    });
    // =================================================================
    // 庫存管理模組
    // =================================================================
    
    // 渲染桌遊列表到表格
    function renderGameList(games) {
        if (!gameListTbody) return;
        gameListTbody.innerHTML = '';
        if (games.length === 0) {
            gameListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到任何桌遊資料。</td></tr>';
            return;
        }
        games.forEach(game => {
            const row = document.createElement('tr');
            row.dataset.gameId = game.game_id;
            row.innerHTML = `
                <td>${game.game_id}</td>
                <td>${game.name}</td>
                <td>${game.total_stock}</td>
                <td>${game.is_visible === 'TRUE' ? '是' : '否'}</td>
                <td>${game.rental_type || 'N/A'}</td>
                <td>
                    <button class="action-btn btn-edit" data-gameid="${game.game_id}">編輯</button>
                </td>
            `;
            gameListTbody.appendChild(row);
        });
    }

    // 從後端獲取所有桌遊資料
    async function fetchAllGames() {
        try {
            const response = await fetch('/api/get-boardgames');
            if (!response.ok) throw new Error('無法從伺服器獲取桌遊列表。');
            allGames = await response.json();
            renderGameList(allGames);
        } catch (error) {
            console.error('獲取桌遊列表失敗:', error);
            if (gameListTbody) gameListTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">${error.message}</td></tr>`;
        }
    }

    // 桌遊搜尋功能
    gameSearchInput.addEventListener('input', () => {
        const searchTerm = gameSearchInput.value.toLowerCase().trim();
        const filteredGames = searchTerm 
            ? allGames.filter(game => (game.name || '').toLowerCase().includes(searchTerm))
            : allGames;
        renderGameList(filteredGames);
    });

    // --- Modal 編輯功能 ---
    function openEditModal(gameId) {
        const game = allGames.find(g => g.game_id == gameId);
        if (!game) return;

        modalTitle.textContent = `編輯桌遊：${game.name}`;
        document.getElementById('edit-game-id').value = game.game_id;
        document.getElementById('edit-total-stock').value = game.total_stock;
        document.getElementById('edit-is-visible').value = game.is_visible || 'TRUE';
        document.getElementById('edit-rental-type').value = game.rental_type || '僅供內用';
        editGameModal.style.display = 'flex';
    }

    function closeEditModal() {
        editGameModal.style.display = 'none';
    }

    gameListTbody.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-edit')) {
            const gameId = event.target.dataset.gameid;
            openEditModal(gameId);
        }
    });

    closeModalBtn.addEventListener('click', closeEditModal);
    cancelModalBtn.addEventListener('click', closeEditModal);

    editGameForm.addEventListener('submit', async (event) => {
        event.preventDefault();
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
            closeEditModal();
            // 更新前端的資料緩存和畫面
            const gameIndex = allGames.findIndex(g => g.game_id == gameId);
            if (gameIndex > -1) {
                allGames[gameIndex] = { ...allGames[gameIndex], ...formData };
            }
            renderGameList(allGames); // 重新渲染整個列表

        } catch (error) {
            alert(`錯誤：${error.message}`);
        }
    });

    // ---- 初始化 ----
    function initialize() {
        showPage('users'); // 預設顯示顧客管理
        fetchAllUsers();   // 預載入使用者資料
    }

    initialize();
});