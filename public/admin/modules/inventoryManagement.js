// public/admin/modules/inventoryManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let sortableGames = null;
let allGamesData = [];
let context = null;
let currentTags = [];

const AUTO_TAGS = ['販售', '可租借', '租借'];

let currentForSaleStock = 0;
let currentForRentStock = 0;

let gameListTbody, gameSearchInput, editGameModal, editGameForm, inventoryStockFilter;
let btnDownloadTemplate, btnImportCSV, btnAddNewProduct, importCSVModal, importCSVForm;

// --- Tag Chip Management ---

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTagChips() {
    const container = document.getElementById('tag-chip-container');
    const textInput = document.getElementById('tag-chip-text-input');
    if (!container || !textInput) return;

    container.querySelectorAll('.tag-chip').forEach(c => c.remove());

    // 唯讀 auto-tags（依當前庫存顯示，不可刪除）
    if (currentForSaleStock > 0) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip sale-tag';
        chip.textContent = '販售';
        container.insertBefore(chip, textInput);
    }
    if (currentForRentStock > 0) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip rent-tag';
        chip.textContent = '可租借';
        container.insertBefore(chip, textInput);
    }

    // 使用者自訂 tags
    currentTags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `${escapeHtml(tag)}<button type="button" class="tag-remove" data-tag="${escapeHtml(tag)}">&times;</button>`;
        container.insertBefore(chip, textInput);
    });

    document.getElementById('edit-game-tags').value = currentTags.join(',');
}

function addTag(tag) {
    const normalized = tag.trim();
    if (!normalized || AUTO_TAGS.includes(normalized) || currentTags.includes(normalized)) return;
    currentTags.push(normalized);
    renderTagChips();
}

function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    renderTagChips();
}

function initTagChips(existingTagsStr, forSaleStock = 0, forRentStock = 0) {
    currentTags = (existingTagsStr || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !AUTO_TAGS.includes(t));
    currentForSaleStock = forSaleStock;
    currentForRentStock = forRentStock;
    renderTagChips();
}

function setupTagChipListeners() {
    const container = document.getElementById('tag-chip-container');
    const textInput = document.getElementById('tag-chip-text-input');
    if (!container || !textInput) return;

    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-remove')) {
            removeTag(e.target.dataset.tag);
        } else {
            textInput.focus();
        }
    });

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(textInput.value);
            textInput.value = '';
        } else if (e.key === 'Backspace' && textInput.value === '' && currentTags.length > 0) {
            removeTag(currentTags[currentTags.length - 1]);
        }
    });

    textInput.addEventListener('input', () => {
        if (textInput.value.includes(',')) {
            const parts = textInput.value.split(',');
            parts.slice(0, -1).forEach(p => addTag(p));
            textInput.value = parts[parts.length - 1];
        }
    });
}

// --- Backup Stock Calculation ---

function updateBackupStock() {
    const total = parseInt(document.getElementById('edit-total-stock').value) || 0;
    const sale = parseInt(document.getElementById('edit-for-sale-stock').value) || 0;
    const rent = parseInt(document.getElementById('edit-for-rent-stock').value) || 0;
    const backup = total - sale - rent;
    const backupEl = document.getElementById('edit-backup-stock');
    if (backupEl) {
        backupEl.value = backup;
        backupEl.style.color = backup < 0 ? 'var(--danger-color)' : '';
    }
    // 庫存變動時同步更新介紹 tab 的 auto-tag chips
    currentForSaleStock = sale;
    currentForRentStock = rent;
    renderTagChips();
}

// --- Modal Tab Management ---

function setupModalTabListeners() {
    if (!editGameModal) return;
    editGameModal.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.modal-tab-btn');
        if (!tabBtn) return;
        const tabName = tabBtn.dataset.modalTab;
        editGameModal.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
        tabBtn.classList.add('active');
        editGameModal.querySelectorAll('.modal-tab-content').forEach(content => content.classList.remove('active'));
        const tabContent = document.getElementById(`modal-tab-${tabName}`);
        if (tabContent) tabContent.classList.add('active');
    });
}

function resetModalTabs() {
    if (!editGameModal) return;
    editGameModal.querySelectorAll('.modal-tab-btn').forEach((btn, i) => btn.classList.toggle('active', i === 0));
    editGameModal.querySelectorAll('.modal-tab-content').forEach((content, i) => content.classList.toggle('active', i === 0));
}

// --- Inline Edit ---

function makeInlineVal(field, gameId, value) {
    const span = document.createElement('span');
    span.className = 'inline-val';
    span.dataset.field = field;
    span.dataset.gameId = gameId;
    span.textContent = value;
    return span;
}

function makeStockLabel(text) {
    const s = document.createElement('span');
    s.className = 'stock-label';
    s.textContent = text;
    return s;
}

async function saveInlineEdit(span, gameId, field, originalValue, newRawValue) {
    const newValue = Number(newRawValue);
    span.classList.remove('editing');

    if (newValue === Number(originalValue)) {
        span.textContent = originalValue;
        return;
    }

    const game = allGamesData.find(g => g.game_id == gameId);
    if (!game) { span.textContent = originalValue; return; }

    const prevValue = game[field];
    game[field] = newValue; // optimistic update

    const total = Number(game.total_stock);
    const sale = Number(game.for_sale_stock);
    const rent = Number(game.for_rent_stock);

    if (sale + rent > total) {
        game[field] = prevValue;
        span.textContent = originalValue;
        ui.toast.error(`販售 (${sale}) + 租借 (${rent}) 不可超過總庫存 (${total})`);
        return;
    }

    span.textContent = newValue;

    try {
        const result = await api.patchGameStock({
            gameId,
            total_stock: Number(game.total_stock),
            for_sale_stock: Number(game.for_sale_stock),
            for_rent_stock: Number(game.for_rent_stock),
            sale_price: Number(game.sale_price),
            rent_price: Number(game.rent_price),
            deposit: Number(game.deposit)
        });

        game.is_visible = result.is_visible;

        if (['total_stock', 'for_sale_stock', 'for_rent_stock'].includes(field)) {
            updateRowStockDisplay(gameId);
        }

        ui.toast.success('已儲存');
    } catch (error) {
        game[field] = prevValue;
        span.textContent = originalValue;
        ui.toast.error(`儲存失敗：${error.message}`);
    }
}

function activateInlineEdit(span) {
    if (span.querySelector('input')) return;

    const gameId = span.dataset.gameId;
    const field = span.dataset.field;
    const originalValue = span.textContent;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = originalValue;
    input.min = '0';
    input.className = 'inline-edit-input';

    span.textContent = '';
    span.classList.add('editing');
    span.appendChild(input);
    input.focus();
    input.select();

    let committed = false;

    input.addEventListener('blur', () => {
        if (committed) return;
        committed = true;
        saveInlineEdit(span, gameId, field, originalValue, input.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (committed) return;
            committed = true;
            saveInlineEdit(span, gameId, field, originalValue, input.value);
        }
        if (e.key === 'Escape') {
            committed = true;
            span.classList.remove('editing');
            span.textContent = originalValue;
        }
    });
}

function updateRowStockDisplay(gameId) {
    const game = allGamesData.find(g => g.game_id == gameId);
    if (!game) return;
    const row = gameListTbody.querySelector(`tr[data-game-id="${gameId}"]`);
    if (!row) return;

    const backup = Number(game.total_stock) - Number(game.for_sale_stock) - Number(game.for_rent_stock);
    const backupEl = row.querySelector('.backup-display');
    if (backupEl) backupEl.textContent = backup;

    const tagsArea = row.querySelector('.tags-area');
    if (tagsArea) {
        tagsArea.querySelectorAll('.auto-tag').forEach(t => t.remove());
        const anchor = tagsArea.firstChild;
        if (Number(game.for_rent_stock) > 0) {
            const t = document.createElement('span');
            t.className = 'game-tag-chip rent-tag auto-tag';
            t.textContent = '可租借';
            tagsArea.insertBefore(t, anchor);
        }
        if (Number(game.for_sale_stock) > 0) {
            const t = document.createElement('span');
            t.className = 'game-tag-chip sale-tag auto-tag';
            t.textContent = '販售';
            tagsArea.insertBefore(t, tagsArea.firstChild);
        }
    }
}

// --- Render ---

function renderGameList(games) {
    if (!gameListTbody) return;
    gameListTbody.innerHTML = '';

    games.forEach(game => {
        const row = gameListTbody.insertRow();
        row.className = 'draggable-row';
        row.dataset.gameId = game.game_id;

        const cellOrder = row.insertCell();
        const cellGame = row.insertCell();
        const cellStock = row.insertCell();
        const cellPrice = row.insertCell();
        const cellActions = row.insertCell();

        // 順序 / drag
        cellOrder.className = 'drag-handle-cell';
        const handleSpan = document.createElement('span');
        handleSpan.className = 'drag-handle';
        handleSpan.textContent = '⠿';
        cellOrder.appendChild(handleSpan);
        cellOrder.append(document.createTextNode(game.display_order || 'N/A'));

        // 遊戲 名稱 / ID / 標籤
        cellGame.className = 'compound-cell';
        cellGame.style.textAlign = 'left';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'main-info';
        nameDiv.textContent = game.name;
        const idDiv = document.createElement('div');
        idDiv.className = 'sub-info';
        idDiv.textContent = `ID: ${game.game_id}`;
        const tagsArea = document.createElement('div');
        tagsArea.className = 'sub-info tags-area';
        tagsArea.style.marginTop = '5px';

        if (Number(game.for_sale_stock) > 0) {
            const t = document.createElement('span');
            t.className = 'game-tag-chip sale-tag auto-tag';
            t.textContent = '販售';
            tagsArea.appendChild(t);
        }
        if (Number(game.for_rent_stock) > 0) {
            const t = document.createElement('span');
            t.className = 'game-tag-chip rent-tag auto-tag';
            t.textContent = '可租借';
            tagsArea.appendChild(t);
        }
        (game.tags || '').split(',').map(t => t.trim()).filter(t => t && !AUTO_TAGS.includes(t)).forEach(tag => {
            const s = document.createElement('span');
            s.className = 'game-tag-chip';
            s.textContent = tag;
            tagsArea.appendChild(s);
        });

        cellGame.appendChild(nameDiv);
        cellGame.appendChild(idDiv);
        cellGame.appendChild(tagsArea);

        // 庫存（inline edit）
        cellStock.className = 'stock-cell';
        const saleStock = game.for_sale_stock ?? (Number(game.total_stock) - Number(game.for_rent_stock));
        const backup = Number(game.total_stock) - Number(saleStock) - Number(game.for_rent_stock);

        const stockLayout = document.createElement('div');
        stockLayout.className = 'stock-layout';

        // 左欄：總數量（垂直置中）
        const totalCol = document.createElement('div');
        totalCol.className = 'stock-total-col';
        const totalLabel = document.createElement('div');
        totalLabel.className = 'field-label';
        totalLabel.textContent = '總數量';
        totalCol.appendChild(totalLabel);
        totalCol.appendChild(makeInlineVal('total_stock', game.game_id, game.total_stock));

        // 右欄：販售 / 租借 / 備用
        const detailCol = document.createElement('div');
        detailCol.className = 'stock-detail-col';

        const makeFieldRow = (labelText, contentEl) => {
            const r = document.createElement('div');
            r.className = 'field-row';
            const lbl = document.createElement('span');
            lbl.className = 'field-label';
            lbl.textContent = labelText;
            r.appendChild(lbl);
            r.appendChild(contentEl);
            return r;
        };

        const backupSpan = document.createElement('span');
        backupSpan.className = 'backup-display backup-val';
        backupSpan.textContent = backup;

        detailCol.appendChild(makeFieldRow('販售', makeInlineVal('for_sale_stock', game.game_id, saleStock)));
        detailCol.appendChild(makeFieldRow('租借', makeInlineVal('for_rent_stock', game.game_id, game.for_rent_stock)));
        detailCol.appendChild(makeFieldRow('備用', backupSpan));

        stockLayout.appendChild(totalCol);
        stockLayout.appendChild(detailCol);
        cellStock.appendChild(stockLayout);

        // 定價（inline edit）
        cellPrice.className = 'price-cell';
        [['售價', 'sale_price', game.sale_price], ['租金', 'rent_price', game.rent_price], ['押金', 'deposit', game.deposit]]
            .forEach(([label, field, value]) => {
                const r = document.createElement('div');
                r.className = 'field-row';
                const lbl = document.createElement('span');
                lbl.className = 'field-label';
                lbl.textContent = label;
                r.appendChild(lbl);
                r.appendChild(makeInlineVal(field, game.game_id, value));
                cellPrice.appendChild(r);
            });

        // 操作
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
    if (!allGamesData || !gameSearchInput || !inventoryStockFilter) return;

    const searchTerm = gameSearchInput.value.toLowerCase().trim();
    let filteredGames = searchTerm
        ? allGamesData.filter(game => (game.name || '').toLowerCase().includes(searchTerm))
        : [...allGamesData];

    const stockFilterEl = inventoryStockFilter.querySelector('.active');
    if (stockFilterEl) {
        const stockFilter = stockFilterEl.dataset.filter;
        if (stockFilter === 'in_stock') {
            filteredGames = filteredGames.filter(game => Number(game.total_stock) > 0);
        } else if (stockFilter === 'out_of_stock') {
            filteredGames = filteredGames.filter(game => Number(game.total_stock) <= 0);
        }
    }

    renderGameList(filteredGames);
}

// --- Drag and Drop ---

function initializeGameDragAndDrop() {
    if (sortableGames) sortableGames.destroy();
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
                    init(context);
                }
            }
        });
    }
}

// --- Modal ---

function openEditGameModal(gameId) {
    const game = gameId ? allGamesData.find(g => g.game_id == gameId) : null;
    if (gameId && !game) return ui.toast.error('找不到遊戲資料');

    editGameForm.reset();
    resetModalTabs();

    if (game) {
        document.getElementById('modal-game-title').textContent = `編輯：${game.name}`;
        document.getElementById('edit-game-id').value = game.game_id;
        document.getElementById('edit-game-id-display').value = game.game_id;
        document.getElementById('edit-game-id-display').closest('.form-group').style.display = 'block';

        document.getElementById('edit-game-name').value = game.name;
        document.getElementById('edit-game-image').value = game.image_url || '';
        document.getElementById('edit-game-image-2').value = game.image_url_2 || '';
        document.getElementById('edit-game-image-3').value = game.image_url_3 || '';
        [['edit-game-image', 'prev-img-1'], ['edit-game-image-2', 'prev-img-2'], ['edit-game-image-3', 'prev-img-3']].forEach(([inputId, previewId]) => {
            const url = document.getElementById(inputId).value;
            const img = document.getElementById(previewId);
            if (img) { img.src = url || ''; img.style.display = url ? 'block' : 'none'; }
        });
        document.getElementById('edit-game-desc').value = game.description || '';
        document.getElementById('edit-min-players').value = game.min_players || 1;
        document.getElementById('edit-max-players').value = game.max_players || 1;
        document.getElementById('edit-difficulty').value = game.difficulty || '普通';
        document.getElementById('edit-play-time').value = game.play_time || '30~90分鐘';
        document.getElementById('edit-total-stock').value = game.total_stock || 0;
        const forSaleStock = game.for_sale_stock ?? (Number(game.total_stock || 0) - Number(game.for_rent_stock || 0));
        document.getElementById('edit-for-sale-stock').value = forSaleStock;
        document.getElementById('edit-for-rent-stock').value = game.for_rent_stock || 0;
        document.getElementById('edit-sale-price').value = game.sale_price || 0;
        document.getElementById('edit-rent-price').value = game.rent_price || 0;
        document.getElementById('edit-deposit').value = game.deposit || 0;
        document.getElementById('edit-late-fee').value = game.late_fee_per_day || 50;
        document.getElementById('edit-supplementary-info').value = game.supplementary_info || '';

        initTagChips(game.tags || '', forSaleStock, game.for_rent_stock || 0);
        updateBackupStock();

    } else {
        document.getElementById('modal-game-title').textContent = '新增遊戲';
        document.getElementById('edit-game-id').value = '';
        document.getElementById('edit-game-id-display').closest('.form-group').style.display = 'none';
        document.getElementById('edit-min-players').value = 1;
        document.getElementById('edit-max-players').value = 4;
        document.getElementById('edit-difficulty').value = '普通';
        document.getElementById('edit-play-time').value = '30~90分鐘';
        document.getElementById('edit-total-stock').value = 0;
        document.getElementById('edit-for-sale-stock').value = 0;
        document.getElementById('edit-for-rent-stock').value = 0;
        document.getElementById('edit-late-fee').value = 50;

        initTagChips('');
        updateBackupStock();
    }

    ui.showModal('#edit-game-modal');
}

async function handleEditGameFormSubmit(e) {
    e.preventDefault();

    const gameId = document.getElementById('edit-game-id').value;
    const totalStock = Number(document.getElementById('edit-total-stock').value);
    const forSaleStock = Number(document.getElementById('edit-for-sale-stock').value);
    const forRentStock = Number(document.getElementById('edit-for-rent-stock').value);

    if (forSaleStock + forRentStock > totalStock) {
        return ui.toast.error(`販售庫存 (${forSaleStock}) + 租借庫存 (${forRentStock}) 不可超過總庫存 (${totalStock})`);
    }

    const updatedData = {
        name: document.getElementById('edit-game-name').value,
        tags: document.getElementById('edit-game-tags').value,
        image_url: document.getElementById('edit-game-image').value,
        image_url_2: document.getElementById('edit-game-image-2').value,
        image_url_3: document.getElementById('edit-game-image-3').value,
        description: document.getElementById('edit-game-desc').value,
        min_players: document.getElementById('edit-min-players').value,
        max_players: document.getElementById('edit-max-players').value,
        difficulty: document.getElementById('edit-difficulty').value,
        play_time: document.getElementById('edit-play-time').value,
        total_stock: totalStock,
        for_sale_stock: forSaleStock,
        for_rent_stock: forRentStock,
        sale_price: document.getElementById('edit-sale-price').value,
        rent_price: document.getElementById('edit-rent-price').value,
        deposit: document.getElementById('edit-deposit').value,
        late_fee_per_day: document.getElementById('edit-late-fee').value,
        supplementary_info: document.getElementById('edit-supplementary-info').value
    };

    try {
        let resultMessage = '';

        if (gameId) {
            updatedData.gameId = gameId;
            await api.updateProductDetails(updatedData);
            const gameIndex = allGamesData.findIndex(g => g.game_id === updatedData.gameId);
            if (gameIndex !== -1) {
                allGamesData[gameIndex] = {
                    ...allGamesData[gameIndex],
                    ...updatedData,
                    is_visible: totalStock > 0 ? 1 : 0,
                    for_sale_stock: forSaleStock
                };
            }
            resultMessage = '更新成功！';
        } else {
            const result = await api.createGame(updatedData);
            await init(context);
            resultMessage = `新增成功！ (ID: ${result.gameId})`;
        }

        applyGameFiltersAndRender();
        ui.hideModal('#edit-game-modal');
        ui.toast.success(resultMessage);

    } catch (error) {
        ui.toast.error(`錯誤：${error.message}`);
    }
}

// --- CSV ---

const CSV_HEADERS = [
    "遊戲ID", "遊戲名稱", "遊戲介紹", "圖片網址1", "圖片網址2", "圖片網址3",
    "標籤(逗號分隔)", "最少人數", "最多人數", "難度", "總庫存", "販售庫存", "可租借庫存",
    "售價", "租金", "押金", "每日逾期費", "補充說明"
];

function handleDownloadTemplate() {
    const BOM = "﻿";
    const csvContent = "data:text/csv;charset=utf-8," + BOM + CSV_HEADERS.join(",") + "\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "games_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function openImportCSVModal() {
    if (importCSVForm) importCSVForm.reset();
    ui.showModal('#import-csv-modal');
}

async function handleImportCSV(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    if (!file) return ui.toast.error('請選擇一個 CSV 檔案');

    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = '匯入中...';

    const reader = new FileReader();
    reader.onload = async (event) => {
        const csvData = event.target.result;
        try {
            const lines = csvData.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error('CSV 檔案為空或只有標頭。');

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const games = [];

            if (headers[0] !== CSV_HEADERS[0] || headers[1] !== CSV_HEADERS[1]) {
                throw new Error('CSV 標頭與模板不符，請下載最新模板。');
            }

            for (let i = 1; i < lines.length; i++) {
                const data = lines[i].split(',');
                const game = {};
                for (let j = 0; j < headers.length; j++) {
                    if (headers[j]) game[headers[j]] = data[j] ? data[j].trim().replace(/"/g, '') : '';
                }
                games.push(game);
            }

            if (games.length === 0) throw new Error('CSV 檔案中沒有可匯入的資料。');

            ui.toast.info(`正在匯入 ${games.length} 筆資料...`);
            const result = await api.bulkCreateGames({ games });
            ui.toast.success(result.message || '匯入完成！');
            ui.hideModal('#import-csv-modal');
            await init(context);

        } catch (error) {
            ui.toast.error(`匯入失敗: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = '開始匯入';
        }
    };
    reader.onerror = () => {
        ui.toast.error('讀取檔案失敗');
        button.disabled = false;
        button.textContent = '開始匯入';
    };
    reader.readAsText(file);
}

// --- Event Listeners ---

function setupEventListeners() {
    const pageElement = document.getElementById('page-inventory');
    if (pageElement.dataset.initialized) return;

    gameSearchInput.addEventListener('input', applyGameFiltersAndRender);

    inventoryStockFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            inventoryStockFilter.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            applyGameFiltersAndRender();
        }
    });

    gameListTbody.addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const gameId = row.dataset.gameId;

        if (target.classList.contains('inline-val') && !target.querySelector('input')) {
            activateInlineEdit(target);
        } else if (target.classList.contains('btn-edit-game')) {
            openEditGameModal(gameId);
        } else if (target.classList.contains('btn-rent')) {
            if (context && context.openCreateRentalModal) {
                context.openCreateRentalModal(gameId);
            }
        }
    });

    editGameForm.addEventListener('submit', handleEditGameFormSubmit);

    ['edit-total-stock', 'edit-for-sale-stock', 'edit-for-rent-stock'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateBackupStock);
    });

    setupModalTabListeners();
    setupTagChipListeners();

    btnDownloadTemplate.addEventListener('click', handleDownloadTemplate);
    btnImportCSV.addEventListener('click', openImportCSVModal);
    btnAddNewProduct.addEventListener('click', () => openEditGameModal(null));

    if (importCSVForm) importCSVForm.addEventListener('submit', handleImportCSV);

    pageElement.dataset.initialized = 'true';
}

// --- Init ---

export const init = async (ctx, param) => {
    context = ctx;
    const pageElement = document.getElementById('page-inventory');
    if (!pageElement) return;

    gameListTbody = pageElement.querySelector('#game-list-tbody');
    gameSearchInput = pageElement.querySelector('#game-search-input');
    inventoryStockFilter = pageElement.querySelector('#inventory-stock-filter');
    editGameModal = document.getElementById('edit-game-modal');
    editGameForm = document.getElementById('edit-game-form');

    btnDownloadTemplate = pageElement.querySelector('#btn-download-csv-template');
    btnImportCSV = pageElement.querySelector('#btn-import-csv');
    btnAddNewProduct = pageElement.querySelector('#btn-add-new-product');
    importCSVModal = document.getElementById('import-csv-modal');
    importCSVForm = document.getElementById('import-csv-form');

    if (!gameListTbody) return;
    gameListTbody.innerHTML = '<tr><td colspan="5">正在載入庫存資料...</td></tr>';

    try {
        allGamesData = await api.getProducts();
        applyGameFiltersAndRender();
        setupEventListeners();
        initializeGameDragAndDrop();
    } catch (error) {
        console.error('獲取庫存列表失敗:', error);
        gameListTbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    }
};
