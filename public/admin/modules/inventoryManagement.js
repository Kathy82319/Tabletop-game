// public/admin/modules/inventoryManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// 模組內部狀態
let sortableGames = null;
let allGamesData = [];
let selectedGameIds = new Set();
let context = null; // 用來儲存從 app.js 傳入的 context

// DOM 元素變數宣告 (在此處宣告，在 init 中賦值)
let gameListTbody, gameSearchInput, editGameModal, editGameForm,
    inventoryStockFilter, inventoryVisibilityFilter,
    batchActionsToolbar, selectAllGamesCheckbox, batchSelectionCount;

// (此處省略了 renderGameList, updateBatchToolbarVisibility 等函式，它們維持原樣)
// ... 您檔案中原本的 renderGameList, updateBatchToolbarVisibility, initializeGameDragAndDrop, openEditGameModal, handleEditGameFormSubmit 等函式都保留 ...
function updateBatchToolbarVisibility() {
    if (!batchActionsToolbar || !batchSelectionCount || !selectAllGamesCheckbox) return;

    const selectedCount = selectedGameIds.size;
    if (selectedCount > 0) {
        batchSelectionCount.textContent = `已選取 ${selectedCount} 個項目`;
        batchActionsToolbar.style.display = 'block';
    } else {
        batchActionsToolbar.style.display = 'none';
    }
    const totalVisibleRows = gameListTbody.rows.length;
    selectAllGamesCheckbox.checked = totalVisibleRows > 0 && selectedCount === totalVisibleRows;
}

function renderGameList(games) {
    if (!gameListTbody) return;
    gameListTbody.innerHTML = '';

    games.forEach(game => {
        const row = gameListTbody.insertRow();
        row.className = 'draggable-row';
        row.dataset.gameId = game.game_id;
        
        if (selectedGameIds.has(game.game_id)) {
            row.classList.add('table-row-selected');
        }
        
        const isVisible = game.is_visible === 1;

        const cellCheckbox = row.insertCell();
        const cellOrder = row.insertCell();
        const cellGame = row.insertCell();
        const cellTotalStock = row.insertCell();
        const cellRentStock = row.insertCell();
        const cellPrice = row.insertCell();
        const cellVisible = row.insertCell();
        const cellActions = row.insertCell();

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.gameId = game.game_id;
        checkbox.checked = selectedGameIds.has(game.game_id);
        cellCheckbox.appendChild(checkbox);

        cellOrder.className = 'drag-handle-cell';
        const handleSpan = document.createElement('span');
        handleSpan.className = 'drag-handle';
        handleSpan.textContent = '⠿';
        cellOrder.appendChild(handleSpan);
        cellOrder.append(document.createTextNode(game.display_order || 'N/A'));

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

        cellActions.className = 'actions-cell';
        cellActions.innerHTML = `
            <div style="display: flex; gap: 5px; justify-content: center;">
                <button class="action-btn btn-rent" data-gameid="${game.game_id}" style="background-color: #007bff;">出借</button>
                <button class="action-btn btn-edit-game" data-gameid="${game.game_id}" style="background-color: #ffc107; color: #000;">編輯</button>
            </div>
        `;
    });
}

function applyGameFiltersAndRender() {
    if (!allGamesData) return;

    // 確保 DOM 元素已初始化
    if (!gameSearchInput || !inventoryStockFilter || !inventoryVisibilityFilter) return;

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
    updateBatchToolbarVisibility();
}

function initializeGameDragAndDrop() {
    if (sortableGames) {
        sortableGames.destroy();
    }
    if (gameListTbody) {
        sortableGames = new Sortable(gameListTbody, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: async (evt) => {
                const orderedIds = Array.from(gameListTbody.children).map(row => row.dataset.gameId);
                
                allGamesData.sort((a, b) => orderedIds.indexOf(a.game_id) - orderedIds.indexOf(b.game_id));
                applyGameFiltersAndRender();

                try {
                    await api.updateProductOrder(orderedIds);
                } catch (error) {
                    ui.toast.error(`儲存順序失敗: ${error.message}`);
                    // 重新載入以恢復
                    init();
                }
            }
        });
    }
}

function openEditGameModal(gameId) {
    const game = allGamesData.find(g => g.game_id == gameId);
    if (!game) return ui.toast.error('找不到遊戲資料');

    editGameForm.reset();
    document.getElementById('modal-game-title').textContent = `編輯：${game.name}`;
    
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
    
    ui.showModal('#edit-game-modal');
}

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
        await api.updateProductDetails(updatedData);
        
        const gameIndex = allGamesData.findIndex(g => g.game_id === updatedData.gameId);
        if (gameIndex !== -1) {
            allGamesData[gameIndex] = { 
                ...allGamesData[gameIndex], 
                ...updatedData,
                is_visible: updatedData.is_visible ? 1 : 0
            };
        }
        
        applyGameFiltersAndRender();
        ui.hideModal('#edit-game-modal');
        ui.toast.success('更新成功！');
    } catch (error) {
        ui.toast.error(`錯誤：${error.message}`);
    }
}

/**
 * 綁定一次性的事件監聽器
 */
function setupEventListeners() {
    const pageElement = document.getElementById('page-inventory');
    if (pageElement.dataset.initialized) return;

    gameSearchInput.addEventListener('input', applyGameFiltersAndRender);

    const setupFilterGroup = (filterContainer) => {
        filterContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                filterContainer.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                applyGameFiltersAndRender();
            }
        });
    };
    setupFilterGroup(inventoryStockFilter);
    setupFilterGroup(inventoryVisibilityFilter);

    selectAllGamesCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const allVisibleRows = Array.from(gameListTbody.querySelectorAll('tr'));
        allVisibleRows.forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                const gameId = checkbox.dataset.gameId;
                checkbox.checked = isChecked;
                if (isChecked) {
                    selectedGameIds.add(gameId);
                    row.classList.add('table-row-selected');
                } else {
                    selectedGameIds.delete(gameId);
                    row.classList.remove('table-row-selected');
                }
            }
        });
        updateBatchToolbarVisibility();
    });

    gameListTbody.addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const gameId = row.dataset.gameId;

        if (target.matches('input[type="checkbox"]')) {
            if (target.checked) {
                selectedGameIds.add(gameId);
                row.classList.add('table-row-selected');
            } else {
                selectedGameIds.delete(gameId);
                row.classList.remove('table-row-selected');
            }
            updateBatchToolbarVisibility();
        } else if (target.classList.contains('btn-edit-game')) {
            openEditGameModal(gameId);
        } else if (target.classList.contains('btn-rent')) {
            // 【關鍵點】呼叫從 context 傳入的函式，取代舊的 console.log
            if (context && context.openCreateRentalModal) {
                context.openCreateRentalModal(gameId);
            }
        }
    });
    
    batchActionsToolbar.addEventListener('click', async (e) => {
        const selectedIdsArray = [...selectedGameIds];
        if (selectedIdsArray.length === 0) return;
        const targetId = e.target.id;
        let actionPromise;
        let confirmMessage;

        if (targetId === 'batch-publish-btn') actionPromise = () => api.batchUpdateGames(selectedIdsArray, true);
        else if (targetId === 'batch-unpublish-btn') actionPromise = () => api.batchUpdateGames(selectedIdsArray, false);
        else if (targetId === 'batch-delete-btn') {
            confirmMessage = `確定要永久刪除這 ${selectedIdsArray.length} 個項目嗎？此操作無法復原。`;
            actionPromise = () => api.batchDeleteGames(selectedIdsArray);
        } else return;

        if (confirmMessage && !await ui.confirm(confirmMessage)) return;

        try {
            const result = await actionPromise();
            ui.toast.success(result.message || '操作成功！');
            await init(context);
        } catch (error) {
            ui.toast.error(`操作失敗: ${error.message}`);
        }
    });

    editGameForm.addEventListener('submit', handleEditGameFormSubmit);
    pageElement.dataset.initialized = 'true';
}

/**
 * 【★★ 核心 ★★】
 * 模組的進入點函式
 */
export const init = async (ctx) => {
    context = ctx; // 儲存 context
    const pageElement = document.getElementById('page-inventory');
    if (!pageElement) return;
    
    // ** 修正點：將 DOM 元素獲取移到最前面 **
    gameListTbody = pageElement.querySelector('#game-list-tbody');
    gameSearchInput = pageElement.querySelector('#game-search-input');
    inventoryStockFilter = pageElement.querySelector('#inventory-stock-filter');
    inventoryVisibilityFilter = pageElement.querySelector('#inventory-visibility-filter');
    batchActionsToolbar = pageElement.querySelector('#batch-actions-toolbar');
    selectAllGamesCheckbox = pageElement.querySelector('#select-all-games-checkbox');
    batchSelectionCount = pageElement.querySelector('#batch-selection-count');
    editGameModal = document.getElementById('edit-game-modal');
    editGameForm = document.getElementById('edit-game-form');

    if (!gameListTbody) return;
    gameListTbody.innerHTML = '<tr><td colspan="8">正在載入庫存資料...</td></tr>';
    selectedGameIds.clear();

    try {
        allGamesData = await api.getProducts();
        applyGameFiltersAndRender();
        setupEventListeners();
        initializeGameDragAndDrop();
        updateBatchToolbarVisibility();
    } catch (error) {
        console.error('獲取庫存列表失敗:', error);
        gameListTbody.innerHTML = `<tr><td colspan="8">${error.message}</td></tr>`;
    }
};