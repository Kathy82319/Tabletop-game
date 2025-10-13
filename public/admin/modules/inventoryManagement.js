// public/admin/modules/inventoryManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allGames = [];
let sortableGames = null;

function renderGameList(games) {
    const tbody = document.getElementById('game-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    games.forEach(game => {
        const row = tbody.insertRow();
        row.className = 'draggable-row';
        row.dataset.gameId = game.game_id;

        const isVisible = game.is_visible === 1;

        row.innerHTML = `
            <td><input type="checkbox" class="product-checkbox" data-game-id="${game.game_id}"></td>
            <td class="drag-handle-cell"><span class="drag-handle">⠿</span> ${game.display_order || 'N/A'}</td>
            <td class="compound-cell" style="text-align: left;">
                <div class="main-info">${game.name}</div>
                <div class="sub-info">ID: ${game.game_id}</div>
            </td>
            <td>${game.total_stock}</td>
            <td>${game.for_rent_stock}</td>
            <td class="compound-cell">
                <div class="main-info">$${game.sale_price}</div>
                <div class="sub-info">租金: $${game.rent_price}</div>
            </td>
            <td><label class="switch"><input type="checkbox" class="visibility-toggle" data-game-id="${game.game_id}" ${isVisible ? 'checked' : ''}><span class="slider"></span></label></td>
            <td class="actions-cell">
                <button class="action-btn btn-edit-game" data-gameid="${game.game_id}" style="background-color: var(--warning-color); color: #000;">編輯</button>
            </td>
        `;
    });
}

function applyFiltersAndRender() {
    const searchInput = document.getElementById('game-search-input');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    let filtered = searchTerm
        ? allGames.filter(game => (game.name || '').toLowerCase().includes(searchTerm))
        : [...allGames];

    const visibilityFilter = document.querySelector('#inventory-visibility-filter .active')?.dataset.filter;
    if (visibilityFilter === 'visible') {
        filtered = filtered.filter(g => g.is_visible === 1);
    } else if (visibilityFilter === 'hidden') {
        filtered = filtered.filter(g => g.is_visible !== 1);
    }

    renderGameList(filtered);
}

function initializeDragAndDrop() {
    const tbody = document.getElementById('game-list-tbody');
    if (sortableGames) sortableGames.destroy();
    if (tbody) {
        sortableGames = new Sortable(tbody, {
            animation: 150, handle: '.drag-handle',
            onEnd: async () => {
                const orderedIds = Array.from(tbody.children).map(row => row.dataset.gameId);
                try {
                    await api.updateProductOrder(orderedIds);
                    ui.toast.success('順序儲存成功！');
                    // 重新載入以確保順序正確
                    await init();
                } catch (error) {
                    ui.toast.error(error.message);
                    await init(); // 失敗時也重新載入
                }
            }
        });
    }
}

// --- 批次操作 UI ---
function updateBatchToolbarState() {
    const toolbar = document.getElementById('batch-actions-toolbar');
    const countSpan = document.getElementById('batch-selected-count');
    const selectedCheckboxes = document.querySelectorAll('.product-checkbox:checked');
    if (toolbar && countSpan) {
        toolbar.classList.toggle('visible', selectedCheckboxes.length > 0);
        countSpan.textContent = `已選取 ${selectedCheckboxes.length} 項`;
    }
}

function updateSelectAllCheckboxState() {
    const selectAll = document.getElementById('select-all-products');
    const allCheckboxes = document.querySelectorAll('.product-checkbox');
    if (!selectAll || allCheckboxes.length === 0) return;
    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(allCheckboxes).some(cb => cb.checked);
    selectAll.checked = allChecked;
    selectAll.indeterminate = !allChecked && someChecked;
}

// --- 批次操作 API 呼叫 ---
async function handleBatchUpdateVisibility(isVisible) {
    const selectedIds = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => cb.dataset.gameId);
    if (selectedIds.length === 0) return ui.toast.error('請至少選取一個項目！');
    try {
        await api.batchUpdateGames(selectedIds, isVisible);
        ui.toast.success(`成功更新 ${selectedIds.length} 個項目！`);
        await init();
    } catch (error) { ui.toast.error(`錯誤：${error.message}`); }
}

async function handleBatchSetRentPrice() {
    const selectedIds = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => cb.dataset.gameId);
    if (selectedIds.length === 0) return ui.toast.error('請至少選取一個項目！');

    const price = prompt('請輸入要為所有選取項目設定的「租金」金額：');
    if (price === null || price.trim() === '' || isNaN(Number(price)) || Number(price) < 0) {
        if(price !== null) ui.toast.error('請輸入有效的非負數金額。');
        return;
    }

    const confirmed = await ui.confirm(`確定要將 ${selectedIds.length} 個項目的租金設定為「$${price}」嗎？`);
    if (!confirmed) return;

    try {
        await api.batchSetRentPrice(selectedIds, price);
        ui.toast.success(`成功更新 ${selectedIds.length} 個項目！`);
        await init();
    } catch (error) { ui.toast.error(`錯誤：${error.message}`); }
}

async function handleBatchDelete() {
    const selectedIds = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(cb => cb.dataset.gameId);
    if (selectedIds.length === 0) return ui.toast.error('請至少選取一個項目！');
    const confirmed = await ui.confirm(`確定要刪除選取的 ${selectedIds.length} 個項目嗎？此操作無法復原。`);
    if (!confirmed) return;
    try {
        await api.batchDeleteGames(selectedIds);
        ui.toast.success('刪除成功！');
        await init();
    } catch (error) { ui.toast.error(`錯誤：${error.message}`); }
}

function setupEventListeners() {
    const page = document.getElementById('page-inventory');
    if (!page || page.dataset.initialized) return;

    page.addEventListener('click', e => {
        if (e.target.id === 'add-game-btn') {
            // openEditGameModal(); // 待遷移
            ui.toast.info('「新增/編輯」功能將在下一步驟中遷移。');
        } else if (e.target.closest('.btn-edit-game')) {
             ui.toast.info('「新增/編輯」功能將在下一步驟中遷移。');
        } else if (e.target.id === 'download-csv-template-btn') {
            // handleDownloadCsvTemplate(); // 待遷移
             ui.toast.info('「CSV」功能將在下一步驟中遷移。');
        }
    });

    // 篩選器
    ['inventory-stock-filter', 'inventory-visibility-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                e.currentTarget.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                applyFiltersAndRender();
            }
        });
    });

    document.getElementById('product-search-input')?.addEventListener('input', applyFiltersAndRender);

    // 批次操作
    const tbody = document.getElementById('product-list-tbody');
    tbody?.addEventListener('change', e => {
        if (e.target.classList.contains('product-checkbox')) {
            updateBatchToolbarState();
            updateSelectAllCheckboxState();
        }
    });

    document.getElementById('select-all-products')?.addEventListener('change', e => {
        document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = e.target.checked);
        updateBatchToolbarState();
    });

    document.getElementById('batch-publish-btn')?.addEventListener('click', () => handleBatchUpdateVisibility(true));
    document.getElementById('batch-unpublish-btn')?.addEventListener('click', () => handleBatchUpdateVisibility(false));
    document.getElementById('batch-set-rent-price-btn')?.addEventListener('click', handleBatchSetRentPrice);
    document.getElementById('batch-delete-btn')?.addEventListener('click', handleBatchDelete);

    page.dataset.initialized = 'true';
}

export const init = async () => {
    const tbody = document.getElementById('product-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">正在載入桌遊資料...</td></tr>`;

    // 離開頁面時隱藏工具列
    document.querySelectorAll('.nav-tabs a').forEach(link => {
        link.addEventListener('click', () => {
            if(window.location.hash !== '#inventory') {
                const toolbar = document.getElementById('batch-actions-toolbar');
                if(toolbar) toolbar.classList.remove('visible');
            }
        });
    });

    try {
        allGames = await api.getProducts();
        applyFiltersAndRender();
        initializeDragAndDrop();
        setupEventListeners();
        // 初始化時重置勾選狀態
        updateBatchToolbarState(); 
        updateSelectAllCheckboxState();
    } catch (error) {
        console.error('初始化庫存頁失敗:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="color: red; text-align:center;">讀取失敗: ${error.message}</td></tr>`;
    }
};