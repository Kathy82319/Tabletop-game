// public/modules/inventoryManagement.js

// 模組內部狀態，用於管理 Sortable.js 實例
let sortableGames = null;
let allGamesData = []; // 儲存從主腳本傳入的遊戲資料

// DOM 元素（在初始化時獲取）
let gameListTbody, gameSearchInput, editGameModal, editGameForm, syncGamesBtn,
    inventoryStockFilter, inventoryVisibilityFilter;

// 從主腳本傳入的函式
let openCreateRentalModalCallback;

/**
 * 渲染遊戲列表到表格中
 * @param {Array} games - 要渲染的遊戲物件陣列
 */
function renderGameList(games) {
    if (!gameListTbody) return;
    gameListTbody.innerHTML = ''; // 清空現有內容

    games.forEach(game => {
        const row = gameListTbody.insertRow();
        row.className = 'draggable-row';
        row.dataset.gameId = game.game_id;

        const isVisible = game.is_visible === 1;

        // 建立儲存格
        const cellOrder = row.insertCell();
        const cellGame = row.insertCell();
        const cellTotalStock = row.insertCell();
        const cellRentStock = row.insertCell();
        const cellPrice = row.insertCell();
        const cellVisible = row.insertCell();
        const cellActions = row.insertCell();

        // 填充 [順序] 儲存格
        cellOrder.className = 'drag-handle-cell';
        const handleSpan = document.createElement('span');
        handleSpan.className = 'drag-handle';
        handleSpan.textContent = '⠿'; // 拖曳圖示
        cellOrder.appendChild(handleSpan);
        cellOrder.append(document.createTextNode(game.display_order || 'N/A'));

        // 填充 [遊戲] 儲存格
        cellGame.className = 'compound-cell';
        cellGame.style.textAlign = 'left';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'main-info';
        nameDiv.textContent = game.name;
        const idDiv = document.createElement('div');
        idDiv.className = 'sub-info';
        idDiv.textContent = `ID: ${game.game_id}`;
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'sub-info';
        tagsDiv.style.marginTop = '5px';
        (game.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.style.cssText = 'background:#eee; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px;';
            tagSpan.textContent = tag;
            tagsDiv.appendChild(tagSpan);
        });
        cellGame.appendChild(nameDiv);
        cellGame.appendChild(idDiv);
        cellGame.appendChild(tagsDiv);

        // 填充其他儲存格
        cellTotalStock.textContent = game.total_stock;
        cellRentStock.textContent = game.for_rent_stock;

        cellPrice.className = 'compound-cell';
        const saleDiv = document.createElement('div');
        saleDiv.className = 'main-info';
        saleDiv.textContent = `$${game.sale_price}`;
        const rentDiv = document.createElement('div');
        rentDiv.className = 'sub-info';
        rentDiv.textContent = `租金: $${game.rent_price}`;
        cellPrice.appendChild(saleDiv);
        cellPrice.appendChild(rentDiv);

        cellVisible.textContent = isVisible ? '是' : '否';

        // 填充 [操作] 儲存格
        cellActions.className = 'actions-cell';
        const actionContainer = document.createElement('div');
        actionContainer.style.cssText = 'display: flex; gap: 5px; justify-content: center;';
        const rentBtn = document.createElement('button');
        rentBtn.className = 'action-btn btn-rent';
        rentBtn.dataset.gameid = game.game_id;
        rentBtn.style.backgroundColor = '#007bff';
        rentBtn.textContent = '出借';
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn btn-edit-game';
        editBtn.dataset.gameid = game.game_id;
        editBtn.style.cssText = 'background-color: #ffc107; color: #000;';
        editBtn.textContent = '編輯';
        actionContainer.appendChild(rentBtn);
        actionContainer.appendChild(editBtn);
        cellActions.appendChild(actionContainer);
    });
}

/**
 * 根據目前的篩選條件過濾並重新渲染遊戲列表
 */
function applyGameFiltersAndRender() {
    if (!allGamesData) return;

    const searchTerm = gameSearchInput.value.toLowerCase().trim();
    let filteredGames = searchTerm
        ? allGamesData.filter(game => (game.name || '').toLowerCase().includes(searchTerm))
        : [...allGamesData];

    const stockFilterEl = inventoryStockFilter.querySelector('.active');
    if (stockFilterEl) {
        const stockFilter = stockFilterEl.dataset.filter;
        if (stockFilter === 'in_stock') {
            filteredGames = filteredGames.filter(game => Number(game.for_rent_stock) > 0);
        } else if (stockFilter === 'out_of_stock') {
            filteredGames = filteredGames.filter(game => Number(game.for_rent_stock) <= 0);
        }
    }

    const visibilityFilterEl = inventoryVisibilityFilter.querySelector('.active');
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

/**
 * 初始化列表的拖曳排序功能
 */
function initializeGameDragAndDrop() {
    if (sortableGames) {
        sortableGames.destroy(); // 如果已存在，先銷毀舊的實例
    }
    if (gameListTbody) {
        sortableGames = new Sortable(gameListTbody, {
            animation: 150,
            handle: '.drag-handle', // 指定拖曳的控制項
            onEnd: async (evt) => {
                const orderedIds = Array.from(gameListTbody.children).map(row => row.dataset.gameId);
                
                // 重新排序前端的資料陣列以維持同步
                allGamesData.sort((a, b) => orderedIds.indexOf(a.game_id) - orderedIds.indexOf(b.game_id));
                applyGameFiltersAndRender();

                try {
                    // 呼叫後端 API 來儲存新的順序
                    const response = await fetch('/api/admin/update-boardgame-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderedGameIds: orderedIds })
                    });
                    if (!response.ok) {
                        throw new Error('儲存順序失敗，請刷新頁面重試。');
                    }
                    // 成功後可以考慮重新獲取所有遊戲資料，或者信任前端的排序
                } catch (error) {
                    alert(error.message);
                    // 如果失敗，最好重新獲取一次資料以恢復到伺服器狀態
                    // await fetchAllGames(); // 這需要從主腳本傳入 fetch 函式
                }
            }
        });
    }
}

/**
 * 開啟編輯遊戲的彈出視窗
 * @param {string} gameId - 要編輯的遊戲 ID
 */
function openEditGameModal(gameId) {
    const game = allGamesData.find(g => g.game_id == gameId);
    if (!game) return alert('找不到遊戲資料');

    editGameForm.reset();
    document.getElementById('modal-game-title').textContent = `編輯：${game.name}`;
    
    // 填充表單
    document.getElementById('edit-game-id').value = game.game_id;
    document.getElementById('edit-game-id-display').value = game.game_id;
    document.getElementById('edit-game-name').value = game.name;
    document.getElementById('edit-game-tags').value = game.tags || '';
    document.getElementById('edit-game-image').value = game.image_url || '';
    document.getElementById('edit-game-image-2').value = game.image_url_2 || '';
    document.getElementById('edit-game-image-3').value = game.image_url_3 || '';
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
    document.getElementById('edit-supplementary-info').value = game.supplementary_info || '';
    
    editGameModal.style.display = 'flex';
}

/**
 * 處理編輯遊戲表單的提交
 * @param {Event} e - 表單提交事件
 */
async function handleEditGameFormSubmit(e) {
    e.preventDefault();
            
    const updatedData = {
        gameId: document.getElementById('edit-game-id').value,
        name: document.getElementById('edit-game-name').value,
        tags: document.getElementById('edit-game-tags').value,
        image_url: document.getElementById('edit-game-image').value,
        image_url_2: document.getElementById('edit-game-image-2').value,
        image_url_3: document.getElementById('edit-game-image-3').value,
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
        is_visible: document.getElementById('edit-is-visible').checked,
        supplementary_info: document.getElementById('edit-supplementary-info').value
    };

    try {
        const response = await fetch('/api/admin/update-boardgame-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '更新失敗');
        
        // 更新前端的資料狀態
        const gameIndex = allGamesData.findIndex(g => g.game_id === updatedData.gameId);
        if (gameIndex !== -1) {
            allGamesData[gameIndex] = { 
                ...allGamesData[gameIndex], 
                ...updatedData,
                is_visible: updatedData.is_visible ? 1 : 0 // 將布林值轉回 1 或 0
            };
        }
        
        applyGameFiltersAndRender();
        editGameModal.style.display = 'none';
        alert('更新成功！');
    } catch (error) {
        alert(`錯誤：${error.message}`);
    }
}


/**
 * 初始化庫存管理頁面，綁定所有事件監聽器
 * @param {HTMLElement} pageElement - "庫存管理" 頁面的主容器元素
 * @param {Array} games - 從主腳本傳入的完整遊戲資料陣列
 * @param {Function} openCreateRentalModal - 從主腳本傳入的、用於打開建立租借視窗的函式
 */
export function initializeInventoryPage(pageElement, games, openCreateRentalModal) {
    // 儲存資料和回呼函式
    allGamesData = games;
    openCreateRentalModalCallback = openCreateRentalModal;

    // 獲取此頁面需要的所有 DOM 元素
    gameListTbody = pageElement.querySelector('#game-list-tbody');
    gameSearchInput = pageElement.querySelector('#game-search-input');
    inventoryStockFilter = pageElement.querySelector('#inventory-stock-filter');
    inventoryVisibilityFilter = pageElement.querySelector('#inventory-visibility-filter');
    
    // 獲取全域的 DOM 元素 (Modal, Form 等)
    syncGamesBtn = document.getElementById('sync-games-btn');
    editGameModal = document.getElementById('edit-game-modal');
    editGameForm = document.getElementById('edit-game-form');

    // 初始渲染
    applyGameFiltersAndRender();
    initializeGameDragAndDrop();

    // --- 綁定事件監聽器 ---

    // 搜尋框
    gameSearchInput.addEventListener('input', applyGameFiltersAndRender);
    
    // 庫存篩選按鈕群組
    inventoryStockFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            inventoryStockFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            applyGameFiltersAndRender();
        }
    });

    // 上架狀態篩選按鈕群組
    inventoryVisibilityFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            inventoryVisibilityFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            applyGameFiltersAndRender();
        }
    });

    // 同步按鈕
    syncGamesBtn.addEventListener('click', async () => {
        if (!confirm('確定要從 Google Sheet 同步所有桌遊資料到資料庫嗎？\n\n這將會用 Sheet 上的資料覆蓋現有資料。')) return;

        try {
            syncGamesBtn.textContent = '同步中...';
            syncGamesBtn.disabled = true;
            const response = await fetch('/api/admin/sync-boardgames-from-sheet', { method: 'POST' });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.details || '同步失敗');
            }
            alert(result.message || '同步成功！');
            // 同步成功後，需要通知主腳本重新獲取資料
            // 這裡我們直接修改 allGamesData，但更好的做法是透過回呼函式
            // const newGames = await fetch('/api/get-boardgames').then(res => res.json());
            // allGamesData = newGames;
            // applyGameFiltersAndRender();
            window.location.reload(); // 最簡單的方式是直接重整頁面
        } catch (error) {
            alert(`錯誤：${error.message}`);
        } finally {
            syncGamesBtn.textContent = '同步至資料庫';
            syncGamesBtn.disabled = false;
        }
    });

    // 遊戲列表事件代理 (處理 "編輯" 和 "出借" 按鈕)
    gameListTbody.addEventListener('click', (e) => {
        const target = e.target;
        const gameId = target.dataset.gameid; 
        if (!gameId) return;

        if (target.classList.contains('btn-edit-game')) {
            openEditGameModal(gameId);
        } else if (target.classList.contains('btn-rent')) {
            // 呼叫從主腳本傳入的回呼函式
            if(openCreateRentalModalCallback) {
                openCreateRentalModalCallback(gameId);
            }
        }
    });

    // 編輯遊戲 Modal 的關閉按鈕
    editGameModal.querySelector('.modal-close').addEventListener('click', () => editGameModal.style.display = 'none');
    editGameModal.querySelector('.btn-cancel').addEventListener('click', () => editGameModal.style.display = 'none');

    // 編輯遊戲表單提交
    editGameForm.addEventListener('submit', handleEditGameFormSubmit);
}