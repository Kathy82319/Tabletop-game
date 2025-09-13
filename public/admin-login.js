// public/admin-login.js

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
    const visibilityFilter = document.getElementById('visibility-filter');
    const rentalTypeFilter = document.getElementById('rental-type-filter');
    const editGameModal = document.getElementById('edit-game-modal');
    const editGameForm = document.getElementById('edit-game-form');

    // --- 全域狀態變數 ---
    let allUsers = [];
    let allGames = [];
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

        if (pageId === 'inventory' && allGames.length === 0) fetchAllGames();
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
                <td>${user.line_display_name || 'N/A'}</td>
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

    async function fetchAllUsers() {
        try {
            const response = await fetch('/api/get-users');
            if (!response.ok) throw new Error('無法獲取使用者列表');
            allUsers = await response.json();
            renderUserList(allUsers);
        } catch (error) {
            console.error('獲取使用者列表失敗:', error);
        }
    }

    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.toLowerCase().trim();
        const filteredUsers = searchTerm ? allUsers.filter(user => (user.line_display_name || '').toLowerCase().includes(searchTerm)) : allUsers;
        renderUserList(filteredUsers);
    });
    
    // --- 使用者標籤編輯 Modal ---
    function openEditTagModal(userId) {
        const user = allUsers.find(u => u.user_id === userId);
        if (!user) return;
        
        const modalTitle = document.getElementById('modal-user-title');
        const userIdInput = document.getElementById('edit-user-id');
        const tagSelect = document.getElementById('edit-tag-select');
        const otherInput = document.getElementById('edit-tag-other-input');

        modalTitle.textContent = `編輯標籤：${user.line_display_name}`;
        userIdInput.value = user.user_id;
        
        const standardTags = ["會員", "員工", "特殊"];
        if (user.tag && !standardTags.includes(user.tag) && user.tag !== '') {
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, tag: newTag })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '更新失敗');
            
            const user = allUsers.find(u => u.user_id === userId);
            if (user) user.tag = newTag;
            renderUserList(allUsers); // 重新渲染整個列表
            editTagModal.style.display = 'none';
        } catch (error) {
            alert(`錯誤：${error.message}`);
        }
    });

    userListTbody.addEventListener('click', async (event) => {
        const target = event.target;
        const userId = target.dataset.userid;
        if (!userId) return;

        if (target.classList.contains('btn-edit')) openEditTagModal(userId);

        if (target.classList.contains('btn-sync')) { /* ...同步邏輯不變... */ }
    });


    // =================================================================
    // 庫存管理模組
    // =================================================================
    function applyGameFiltersAndRender() {
        const searchTerm = gameSearchInput.value.toLowerCase().trim();
        let filteredGames = allGames;

        if (searchTerm) {
            filteredGames = filteredGames.filter(game => (game.name || '').toLowerCase().includes(searchTerm));
        }
        if (gameFilters.visibility !== 'all') {
            filteredGames = filteredGames.filter(game => game.is_visible === gameFilters.visibility);
        }
        if (gameFilters.rentalType !== 'all') {
            filteredGames = filteredGames.filter(game => game.rental_type === gameFilters.rentalType);
        }
        
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
        document.getElementById('edit-rental-type').value = game.rental_type || '僅供內用';
        editGameModal.style.display = 'flex';
    }

    gameListTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit')) openEditGameModal(e.target.dataset.gameid);
    });

    editGameModal.querySelector('.modal-close').addEventListener('click', () => editGameModal.style.display = 'none');
    editGameModal.querySelector('.btn-cancel').addEventListener('click', () => editGameModal.style.display = 'none');
    
    editGameForm.addEventListener('submit', async (e) => { /* ...此函式內容不變... */ });

    // ---- 初始化 ----
    function initialize() {
        showPage('users');
        fetchAllUsers();
    }
    
    initialize();
});