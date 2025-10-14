import { fetchAllGames, allGames } from '../api.js';
import { showModal, hideModal } from '../ui.js';

// --- DOM 元素 ---
const page = document.getElementById('page-inventory');
const gameListTbody = page.querySelector('#game-list-tbody');
const batchToolbar = page.querySelector('#batch-toolbar');
const batchCount = page.querySelector('#batch-count');
const selectAllGames = page.querySelector('#select-all-games');

// --- 事件監聽 ---
export function initInventoryManagement() {
    // 監聽整個表格的點擊事件，有效處理 checkbox 的變化
    gameListTbody.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            updateBatchToolbar();
        }
    });

    // 全選 checkbox 的功能
    selectAllGames.addEventListener('change', () => {
        const isChecked = selectAllGames.checked;
        gameListTbody.querySelectorAll('.game-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
        updateBatchToolbar();
    });

    // 批次操作按鈕的事件綁定
    batchToolbar.addEventListener('click', async (e) => {
        const action = e.target.id;
        const selectedIds = getSelectedGameIds();

        if (selectedIds.length === 0) {
            alert('請至少選擇一個項目');
            return;
        }

        let isVisible;
        if (action === 'batch-visible-btn') {
            isVisible = true;
        } else if (action === 'batch-hidden-btn') {
            isVisible = false;
        } else if (action === 'batch-export-csv-btn') {
            exportToCSV(selectedIds);
            return; // 匯出功能不需要後續的 API 呼叫
        } else {
            return; // 如果點擊的不是按鈕，則不執行任何操作
        }

        if (confirm(`確定要將 ${selectedIds.length} 個遊戲批次更新為「${isVisible ? '上架' : '下架'}」嗎？`)) {
            try {
                // 這裡可以呼叫一個新的批次更新 API
                // const response = await api.batchUpdateGamesVisibility(selectedIds, isVisible);
                // alert('批次更新成功！');
                // await fetchAllGames(); // 重新載入資料
                
                // 暫時用 alert 提示功能
                alert(`功能開發中：將 ${selectedIds.length} 個遊戲的狀態更新為 ${isVisible}`);

            } catch (error) {
                console.error('批次更新失敗:', error);
                alert(`批次更新失敗: ${error.message}`);
            }
        }
    });
}

// --- 功能函式 ---

// 更新工具列的顯示狀態和計數
function updateBatchToolbar() {
    const selectedCheckboxes = gameListTbody.querySelectorAll('.game-checkbox:checked');
    const count = selectedCheckboxes.length;

    if (count > 0) {
        batchCount.textContent = `已選取 ${count} 個項目`;
        batchToolbar.classList.add('visible');
    } else {
        batchToolbar.classList.remove('visible');
    }

    // 更新全選 checkbox 的狀態
    const totalCheckboxes = gameListTbody.querySelectorAll('.game-checkbox').length;
    selectAllGames.checked = totalCheckboxes > 0 && count === totalCheckboxes;
}

// 獲取所有被選中的遊戲 ID
function getSelectedGameIds() {
    return Array.from(gameListTbody.querySelectorAll('.game-checkbox:checked'))
                .map(cb => cb.closest('tr').dataset.gameId);
}

// 匯出 CSV 的功能
function exportToCSV(selectedIds) {
    const gamesToExport = allGames.filter(game => selectedIds.includes(game.game_id));
    if (gamesToExport.length === 0) {
        alert('沒有可匯出的資料');
        return;
    }

    // 定義 CSV 標頭
    const headers = ['game_id', 'name', 'tags', 'total_stock', 'for_rent_stock', 'sale_price', 'rent_price', 'is_visible'];
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

    // 轉換資料為 CSV 格式
    gamesToExport.forEach(game => {
        const row = headers.map(header => {
            let value = game[header];
            // 處理布林值和可能含有逗號的字串
            if (typeof value === 'boolean') {
                value = value ? 'TRUE' : 'FALSE';
            } else if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`; // 用引號包起來
            }
            return value;
        });
        csvContent += row.join(",") + "\n";
    });

    // 建立並觸發下載
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventory_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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
    let filtered = searchTerm ? allGames.filter(g => (g.name || '').toLowerCase().includes(searchTerm)) : [...allGames];
    const visibilityFilter = document.querySelector('#inventory-visibility-filter .active')?.dataset.filter;
    if (visibilityFilter === 'visible') filtered = filtered.filter(g => g.is_visible === 1);
    else if (visibilityFilter === 'hidden') filtered = filtered.filter(g => g.is_visible !== 1);
    const stockFilter = document.querySelector('#inventory-stock-filter .active')?.dataset.filter;
    if (stockFilter === 'in_stock') filtered = filtered.filter(g => Number(g.for_rent_stock) > 0);
    else if (stockFilter === 'out_of_stock') filtered = filtered.filter(g => Number(g.for_rent_stock) <= 0);
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
                    await init();
                } catch (error) { ui.toast.error(error.message); await init(); }
            }
        });
    }
}

function updateBatchToolbarState() {
    const toolbar = document.getElementById('batch-actions-toolbar');
    const countSpan = document.getElementById('batch-selected-count');
    const selected = document.querySelectorAll('.product-checkbox:checked');
    if (toolbar && countSpan) {
        toolbar.classList.toggle('visible', selected.length > 0);
        countSpan.textContent = `已選取 ${selected.length} 項`;
    }
}

function updateSelectAllCheckboxState() {
    const selectAll = document.getElementById('select-all-products');
    const allCb = document.querySelectorAll('.product-checkbox');
    if (!selectAll || allCb.length === 0) return;
    const allChecked = Array.from(allCb).every(cb => cb.checked);
    const someChecked = Array.from(allCb).some(cb => cb.checked);
    selectAll.checked = allChecked;
    selectAll.indeterminate = !allChecked && someChecked;
}

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
    if (price === null) return;
    if (price.trim() === '' || isNaN(Number(price)) || Number(price) < 0) return ui.toast.error('請輸入有效的非負數金額。');
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

// --- CSV 功能 ---
function handleDownloadCsvTemplate() {
    const headers = ["遊戲ID", "遊戲名稱", "遊戲介紹", "圖片網址1", "圖片網址2", "圖片網址3", "標籤(逗號分隔)", "最少人數", "最多人數", "難度", "總庫存", "可租借庫存", "售價", "租金", "押金", "每日逾期費", "是否上架(TRUE/FALSE)", "補充說明"];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",");
    const link = Object.assign(document.createElement("a"), { href: encodeURI(csvContent), download: "games_template.csv" });
    document.body.appendChild(link).click();
    document.body.removeChild(link);
}

function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return ui.toast.error('CSV 檔案中沒有可匯入的資料。');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = lines.slice(1).map(line => {
            const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g).map(v => v.trim().replace(/"/g, ''));
            return headers.reduce((obj, header, index) => ({ ...obj, [header]: values[index] || "" }), {});
        });
        const confirmed = await ui.confirm(`您準備從 CSV 檔案匯入/更新 ${data.length} 筆資料，確定嗎？\n(如果提供遊戲ID，將會更新現有資料)`);
        if (!confirmed) { event.target.value = ''; return; }
        try {
            const result = await api.bulkCreateGames({ games: data });
            ui.toast.success(result.message || '匯入成功！');
            await init();
        } catch (error) { ui.toast.error(`匯入失敗：${error.message}`); }
         finally { event.target.value = ''; }
    };
    reader.readAsText(file, 'UTF-8');
}

// --- 新增/編輯 Modal ---
function openEditGameModal(game = null) {
    const form = document.getElementById('edit-game-form');
    if (!form) return;
    form.reset();
    document.getElementById('modal-game-title').textContent = game ? `編輯：${game.name}` : '新增桌遊';

    const fields = ['game-id', 'game-name', 'game-tags', 'game-image', 'game-image-2', 'game-image-3', 'game-desc', 'min-players', 'max-players', 'difficulty', 'total-stock', 'for-rent-stock', 'sale-price', 'rent-price', 'deposit', 'late-fee', 'is-visible', 'supplementary-info'];
    fields.forEach(f => {
        const el = document.getElementById(`edit-${f}`);
        if(el) {
            const key = f.replace(/-/g, '_');
            if(el.type === 'checkbox') el.checked = game ? !!game[key] : false;
            else el.value = game ? game[key] || '' : '';
        }
    });
    document.getElementById('edit-game-id-display').value = game ? game.game_id : '(自動產生)';

    ui.showModal('#edit-game-modal');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const gameId = document.getElementById('edit-game-id').value;
    const isCreating = !gameId;
    const formData = {
        gameId: gameId || undefined,
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
        if (isCreating) await api.createGame(formData);
        else await api.updateProductDetails(formData);
        ui.hideModal('#edit-game-modal');
        await init();
        ui.toast.success('儲存成功！');
    } catch (error) { ui.toast.error(`儲存失敗：${error.message}`); }
}

function setupEventListeners() {
    const page = document.getElementById('page-inventory');
    if (!page || page.dataset.initialized) return;

    page.addEventListener('click', e => {
        if (e.target.id === 'add-game-btn') openEditGameModal();
        else if (e.target.closest('.btn-edit-game')) {
            const game = allGames.find(g => g.game_id === e.target.closest('.btn-edit-game').dataset.gameid);
            if(game) openEditGameModal(game);
        } else if (e.target.id === 'download-csv-template-btn') handleDownloadCsvTemplate();
    });

    ['inventory-stock-filter', 'inventory-visibility-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                e.currentTarget.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                applyFiltersAndRender();
            }
        });
    });

    document.getElementById('game-search-input')?.addEventListener('input', applyFiltersAndRender);
    document.getElementById('csv-upload-input')?.addEventListener('change', handleCsvUpload);
    document.getElementById('edit-game-form')?.addEventListener('submit', handleFormSubmit);

    const tbody = document.getElementById('game-list-tbody');
    tbody?.addEventListener('change', e => {
        if (e.target.classList.contains('product-checkbox')) {
            updateBatchToolbarState();
            updateSelectAllCheckboxState();
        } else if (e.target.classList.contains('visibility-toggle')) {
            // 單筆上架/下架的即時更新邏輯
            const gameId = e.target.dataset.gameId;
            const isVisible = e.target.checked;
            api.batchUpdateGames([gameId], isVisible)
               .then(() => {
                    const game = allGames.find(g => g.game_id === gameId);
                    if(game) game.is_visible = isVisible ? 1 : 0;
               })
               .catch(err => ui.toast.error(err.message));
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
    const tbody = document.getElementById('game-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">正在載入桌遊資料...</td></tr>`;

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
        allGames.sort((a,b) => (a.display_order || 999) - (b.display_order || 999));
        applyFiltersAndRender();
        initializeDragAndDrop();
        setupEventListeners();
        updateBatchToolbarState();
        updateSelectAllCheckboxState();
    } catch (error) {
        console.error('初始化庫存頁失敗:', error);
        tbody.innerHTML = `<tr><td colspan="8" style="color: red; text-align:center;">讀取失敗: ${error.message}</td></tr>`;
    }
};