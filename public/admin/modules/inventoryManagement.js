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
let searchChips = [];

let gameListTbody, gameSearchInput, editGameModal, editGameForm, inventoryStockFilter;
let btnDownloadTemplate, btnImportCSV, btnAddNewProduct, importCSVModal, importCSVForm;
let sellGameModal, sellGameForm;

// --- Batch Sell (Checkout) ---
let btnBatchSell, checkoutModal, checkoutItemsTbody, checkoutBarcodeInput, checkoutManualSearch, checkoutManualResults, checkoutTotalEl, checkoutConfirmBtn, inventorySelectAll;
let selectedForBatchSale = new Set();
let checkoutItems = new Map(); // gameId -> { gameId, name, for_sale_stock, quantity, discountTenths }

// --- Tag Chip Management ---

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 遊戲可能有多組條碼（主要條碼 + BoardGameBarcodes 額外條碼，以逗號字串回傳），統一展開成陣列供比對
function parseExtraBarcodes(extraBarcodesStr) {
    return (extraBarcodesStr || '').split(',').map(b => b.trim()).filter(Boolean);
}

function gameBarcodes(game) {
    const list = [game.barcode, ...parseExtraBarcodes(game.extra_barcodes)];
    return [...new Set(list.map(b => (b || '').trim()).filter(Boolean))];
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
    const warningEl = document.getElementById('edit-stock-warning');
    if (warningEl) warningEl.style.display = backup < 0 ? 'block' : 'none';
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

function makeBarcodeInlineVal(gameId, value) {
    const span = document.createElement('span');
    span.className = 'inline-val barcode-val';
    span.dataset.field = 'barcode';
    span.dataset.gameId = gameId;
    if (value) {
        span.textContent = value;
    } else {
        span.textContent = '點擊掃描綁定';
        span.classList.add('barcode-empty');
    }
    return span;
}

function activateBarcodeInlineEdit(span, gameId) {
    if (span.querySelector('input')) return;

    const game = allGamesData.find(g => g.game_id == gameId);
    const originalValue = game ? (game.barcode || '') : '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalValue;
    input.className = 'inline-edit-input barcode-inline-input';

    span.textContent = '';
    span.classList.remove('barcode-empty');
    span.classList.add('editing');
    span.appendChild(input);
    input.focus();
    input.select();

    let committed = false;

    const renderDisplay = (value) => {
        if (value) {
            span.textContent = value;
            span.classList.remove('barcode-empty');
        } else {
            span.textContent = '點擊掃描綁定';
            span.classList.add('barcode-empty');
        }
    };

    const commit = async (rawValue) => {
        if (committed) return;
        committed = true;
        span.classList.remove('editing');

        const newValue = rawValue.trim();
        if (newValue === originalValue || !game) {
            renderDisplay(originalValue);
            return;
        }

        const prevValue = game.barcode;
        game.barcode = newValue; // optimistic update
        renderDisplay(newValue);

        try {
            await api.patchGameBarcode({ gameId, barcode: newValue });
            ui.toast.success(newValue ? '條碼已綁定' : '條碼已清除');
        } catch (error) {
            game.barcode = prevValue;
            renderDisplay(prevValue);
            ui.toast.error(`儲存失敗：${error.message}`);
        }
    };

    input.addEventListener('blur', () => commit(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit(input.value);
        } else if (e.key === 'Escape') {
            committed = true;
            span.classList.remove('editing');
            renderDisplay(originalValue);
        }
    });
}

function renderBackupValue(el, backup) {
    if (!el) return;
    if (backup < 0) {
        el.textContent = `⚠️ ${backup}`;
        el.style.color = 'var(--danger-color)';
        el.title = '販售 + 租借 已超過總庫存，請確認庫存是否有誤';
    } else {
        el.textContent = backup;
        el.style.color = '';
        el.title = '';
    }
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
    renderBackupValue(row.querySelector('.backup-display'), backup);

    const totalEl = row.querySelector('.inline-val[data-field="total_stock"]');
    if (totalEl && !totalEl.querySelector('input')) totalEl.textContent = game.total_stock;
    const saleEl = row.querySelector('.inline-val[data-field="for_sale_stock"]');
    if (saleEl && !saleEl.querySelector('input')) saleEl.textContent = game.for_sale_stock;

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

        const cellCheck = row.insertCell();
        const cellOrder = row.insertCell();
        const cellGame = row.insertCell();
        const cellStock = row.insertCell();
        const cellPrice = row.insertCell();
        const cellActions = row.insertCell();

        // 勾選（批次販售用；沒有販售庫存也能勾選，結帳時會用 ⚠️ 提示無庫存）
        cellCheck.style.textAlign = 'center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'batch-sell-check';
        checkbox.dataset.gameId = game.game_id;
        checkbox.checked = selectedForBatchSale.has(String(game.game_id));
        if (!(Number(game.for_sale_stock) > 0)) {
            checkbox.title = '⚠️ 無販售庫存';
        }
        cellCheck.appendChild(checkbox);

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
        const barcodeDiv = document.createElement('div');
        barcodeDiv.className = 'sub-info';
        barcodeDiv.style.marginTop = '3px';
        barcodeDiv.append('條碼: ', makeBarcodeInlineVal(game.game_id, game.barcode || ''));
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
        cellGame.appendChild(barcodeDiv);
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
        renderBackupValue(backupSpan, backup);

        detailCol.appendChild(makeFieldRow('販售', makeInlineVal('for_sale_stock', game.game_id, saleStock)));
        detailCol.appendChild(makeFieldRow('租借', makeInlineVal('for_rent_stock', game.game_id, game.for_rent_stock)));
        detailCol.appendChild(makeFieldRow('備用', backupSpan));

        stockLayout.appendChild(totalCol);
        stockLayout.appendChild(detailCol);
        cellStock.appendChild(stockLayout);

        // 定價（inline edit）
        cellPrice.className = 'price-cell';
        const priceInner = document.createElement('div');
        priceInner.className = 'price-inner';
        [['售價', 'sale_price', game.sale_price], ['租金', 'rent_price', game.rent_price], ['押金', 'deposit', game.deposit]]
            .forEach(([label, field, value]) => {
                const r = document.createElement('div');
                r.className = 'field-row';
                const lbl = document.createElement('span');
                lbl.className = 'field-label';
                lbl.textContent = label;
                r.appendChild(lbl);
                r.appendChild(makeInlineVal(field, game.game_id, value));
                priceInner.appendChild(r);
            });
        cellPrice.appendChild(priceInner);

        // 操作
        cellActions.className = 'actions-cell';
        cellActions.innerHTML = `
            <div style="display: flex; gap: 5px; justify-content: center;">
                <button class="action-btn btn-rent" data-gameid="${game.game_id}" style="background-color: #007bff;">出借</button>
                <button class="action-btn btn-sell" data-gameid="${game.game_id}" style="background-color: #28a745;">賣出</button>
                <button class="action-btn btn-edit-game" data-gameid="${game.game_id}" style="background-color: #ffc107; color: #000;">編輯</button>
            </div>
        `;
    });
}

// --- Sell Game ---

function openSellGameModal(gameId) {
    const game = allGamesData.find(g => g.game_id == gameId);
    if (!game) return ui.toast.error('找不到遊戲資料');

    sellGameForm.reset();
    document.getElementById('sell-game-id').value = gameId;
    document.getElementById('sell-game-title').textContent = `賣出：${game.name}`;
    const quantityInput = document.getElementById('sell-game-quantity');
    quantityInput.value = 1;
    quantityInput.max = game.for_sale_stock;
    document.getElementById('sell-game-stock-hint').textContent = `目前販售庫存：${game.for_sale_stock}`;

    ui.showModal('#sell-game-modal');
}

async function handleSellGameFormSubmit(e) {
    e.preventDefault();

    const gameId = document.getElementById('sell-game-id').value;
    const quantity = Number(document.getElementById('sell-game-quantity').value);
    const game = allGamesData.find(g => g.game_id == gameId);
    if (!game) return;

    if (!Number.isInteger(quantity) || quantity <= 0) {
        return ui.toast.error('賣出數量必須為正整數');
    }
    if (quantity > Number(game.for_sale_stock)) {
        return ui.toast.error(`販售庫存只剩 ${game.for_sale_stock}，無法賣出 ${quantity} 件`);
    }

    try {
        const result = await api.sellGame({ gameId, quantity });

        game.total_stock = result.total_stock;
        game.for_sale_stock = result.for_sale_stock;
        game.is_visible = result.is_visible;

        updateRowStockDisplay(gameId);
        ui.hideModal('#sell-game-modal');
        ui.toast.success(result.message || '賣出成功');
    } catch (error) {
        ui.toast.error(`賣出失敗：${error.message}`);
    }
}

// --- Batch Sell (Checkout) ---

function addItemToCheckout(game) {
    const gameId = String(game.game_id);
    const existing = checkoutItems.get(gameId);
    if (existing) {
        existing.quantity += 1;
    } else {
        checkoutItems.set(gameId, {
            gameId,
            name: game.name,
            sale_price: Number(game.sale_price) || 0,
            for_sale_stock: Number(game.for_sale_stock) || 0,
            quantity: 1,
            discountTenths: 10
        });
    }
    selectedForBatchSale.add(gameId);
    renderCheckoutItems();
}

function removeItemFromCheckout(gameId) {
    checkoutItems.delete(String(gameId));
    selectedForBatchSale.delete(String(gameId));
    renderCheckoutItems();
    const row = gameListTbody?.querySelector(`.batch-sell-check[data-game-id="${gameId}"]`);
    if (row) row.checked = false;
}

function computeLineSubtotal(item) {
    return Math.round(item.sale_price * item.quantity * (Number(item.discountTenths) / 10));
}

// 庫存警示：僅提示用，不會擋下結帳——即使庫存不足，送出後仍會成功並改用儀表板通知回報
function getItemWarning(item) {
    if (item.for_sale_stock <= 0) return '目前無販售庫存';
    if (item.quantity > item.for_sale_stock) return `庫存不足，目前僅剩 ${item.for_sale_stock} 件`;
    return '';
}

function renderCheckoutItems() {
    if (!checkoutItemsTbody) return;
    checkoutItemsTbody.innerHTML = '';

    if (checkoutItems.size === 0) {
        checkoutItemsTbody.innerHTML = '<tr id="checkout-empty-row"><td colspan="5" style="text-align:center; color:var(--text-light); padding: 12px 0;">尚未加入商品，請掃描條碼或手動搜尋加入</td></tr>';
        checkoutTotalEl.textContent = '0';
        return;
    }

    let total = 0;
    checkoutItems.forEach(item => {
        const subtotal = computeLineSubtotal(item);
        total += subtotal;

        const row = checkoutItemsTbody.insertRow();
        row.dataset.gameId = item.gameId;

        const cellName = row.insertCell();
        cellName.style.textAlign = 'left';
        const warning = getItemWarning(item);
        const warningHtml = warning
            ? `<div class="checkout-warning" style="color:var(--danger-color); font-size:0.85rem;" title="${escapeHtml(warning)}">⚠️ ${escapeHtml(warning)}</div>`
            : '';
        cellName.innerHTML = `
            <div class="main-info">${escapeHtml(item.name)}</div>
            <div class="sub-info">庫存：${item.for_sale_stock}</div>
            ${warningHtml}
        `;

        const cellQty = row.insertCell();
        cellQty.style.textAlign = 'center';
        cellQty.innerHTML = `<input type="number" class="checkout-qty-input" min="1" value="${item.quantity}" style="width:60px;">`;

        const cellDiscount = row.insertCell();
        cellDiscount.style.textAlign = 'center';
        cellDiscount.innerHTML = `<input type="number" class="checkout-discount-input" min="1" max="10" value="${item.discountTenths}" title="折數，10 代表不打折" style="width:50px;">`;

        const cellSubtotal = row.insertCell();
        cellSubtotal.style.textAlign = 'center';
        cellSubtotal.textContent = `$${subtotal}`;

        const cellRemove = row.insertCell();
        cellRemove.style.textAlign = 'center';
        cellRemove.innerHTML = `<button type="button" class="checkout-remove-btn" style="color:var(--danger-color); background:none; border:none; cursor:pointer; font-size:1.1rem;">&times;</button>`;
    });

    checkoutTotalEl.textContent = total;
}

function handleCheckoutBarcodeScan(rawValue) {
    const value = rawValue.trim();
    if (!value) return;
    checkoutBarcodeInput.value = '';

    const game = allGamesData.find(g => gameBarcodes(g).includes(value));
    if (!game) {
        ui.toast.error('掃描不到符合的商品條碼');
        return;
    }
    addItemToCheckout(game);
}

function renderCheckoutManualResults(term) {
    if (!term) {
        checkoutManualResults.style.display = 'none';
        return;
    }
    const t = term.toLowerCase();
    const results = allGamesData.filter(g => (g.name || '').toLowerCase().includes(t));
    checkoutManualResults.innerHTML = results.map(g => {
        const noStock = !(Number(g.for_sale_stock) > 0);
        const stockLabel = noStock ? `⚠️ 無庫存` : `庫存：${g.for_sale_stock}`;
        return `<li data-game-id="${g.game_id}">${escapeHtml(g.name)}（${stockLabel}）</li>`;
    }).join('');
    checkoutManualResults.style.display = results.length > 0 ? 'block' : 'none';
}

function openCheckoutModal() {
    checkoutItems.clear();
    selectedForBatchSale.forEach(gameId => {
        const game = allGamesData.find(g => String(g.game_id) === gameId);
        if (game) {
            checkoutItems.set(gameId, {
                gameId,
                name: game.name,
                sale_price: Number(game.sale_price) || 0,
                for_sale_stock: Number(game.for_sale_stock) || 0,
                quantity: 1,
                discountTenths: 10
            });
        }
    });

    renderCheckoutItems();
    checkoutBarcodeInput.value = '';
    checkoutManualSearch.value = '';
    checkoutManualResults.style.display = 'none';

    ui.showModal('#checkout-sale-modal');
    checkoutBarcodeInput.focus();
}

async function handleCheckoutConfirm() {
    if (checkoutItems.size === 0) {
        return ui.toast.error('請先加入要販售的商品');
    }

    const items = Array.from(checkoutItems.values()).map(item => ({
        gameId: item.gameId,
        quantity: item.quantity,
        discountTenths: item.discountTenths
    }));

    try {
        checkoutConfirmBtn.disabled = true;
        const result = await api.checkoutSale(items);

        (result.items || []).forEach(updated => {
            const game = allGamesData.find(g => String(g.game_id) === String(updated.gameId));
            if (game) {
                game.total_stock = updated.total_stock;
                game.for_sale_stock = updated.for_sale_stock;
                game.is_visible = updated.is_visible;
            }
        });

        checkoutItems.clear();
        selectedForBatchSale.clear();
        if (inventorySelectAll) inventorySelectAll.checked = false;
        applyGameFiltersAndRender();
        ui.hideModal('#checkout-sale-modal');
        ui.toast.success(result.message || '結帳完成');
        // 庫存不足的部分結帳仍會成功（允許庫存變負數），詳細警示已推送到儀表板通知
        if (Array.isArray(result.warnings) && result.warnings.length > 0) {
            ui.toast.info(`有 ${result.warnings.length} 款商品庫存不足，已通知儀表板`);
        }

    } catch (error) {
        ui.toast.error(`結帳失敗：${error.message}`);
    } finally {
        checkoutConfirmBtn.disabled = false;
    }
}

function setupCheckoutEventListeners() {
    if (!checkoutModal || checkoutModal.dataset.initialized) return;

    btnBatchSell.addEventListener('click', openCheckoutModal);

    checkoutBarcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCheckoutBarcodeScan(checkoutBarcodeInput.value);
        }
    });

    checkoutManualSearch.addEventListener('input', () => {
        renderCheckoutManualResults(checkoutManualSearch.value.trim());
    });

    checkoutManualResults.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const game = allGamesData.find(g => g.game_id == li.dataset.gameId);
        if (game) addItemToCheckout(game);
        checkoutManualSearch.value = '';
        checkoutManualResults.style.display = 'none';
    });

    checkoutItemsTbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('checkout-remove-btn')) {
            const row = e.target.closest('tr');
            if (row) removeItemFromCheckout(row.dataset.gameId);
        }
    });

    checkoutItemsTbody.addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const item = checkoutItems.get(row.dataset.gameId);
        if (!item) return;

        if (e.target.classList.contains('checkout-qty-input')) {
            const raw = parseInt(e.target.value, 10);
            item.quantity = isNaN(raw) ? item.quantity : Math.max(raw, 1);
        } else if (e.target.classList.contains('checkout-discount-input')) {
            const raw = parseInt(e.target.value, 10);
            item.discountTenths = isNaN(raw) ? item.discountTenths : Math.min(Math.max(raw, 1), 10);
        } else {
            return;
        }

        // 只更新這一列的小計、警示與總額，避免整表重繪讓輸入框失去焦點
        row.querySelector('td:nth-child(4)').textContent = `$${computeLineSubtotal(item)}`;

        const nameCell = row.querySelector('td:first-child');
        const existingWarningEl = nameCell.querySelector('.checkout-warning');
        const warning = getItemWarning(item);
        if (warning) {
            const html = `<div class="checkout-warning" style="color:var(--danger-color); font-size:0.85rem;" title="${escapeHtml(warning)}">⚠️ ${escapeHtml(warning)}</div>`;
            if (existingWarningEl) existingWarningEl.outerHTML = html;
            else nameCell.insertAdjacentHTML('beforeend', html);
        } else if (existingWarningEl) {
            existingWarningEl.remove();
        }

        let total = 0;
        checkoutItems.forEach(it => { total += computeLineSubtotal(it); });
        checkoutTotalEl.textContent = total;
    });

    checkoutItemsTbody.addEventListener('blur', (e) => {
        if (e.target.classList.contains('checkout-qty-input') || e.target.classList.contains('checkout-discount-input')) {
            const row = e.target.closest('tr');
            const item = row && checkoutItems.get(row.dataset.gameId);
            if (item && Number(e.target.value) !== (e.target.classList.contains('checkout-qty-input') ? item.quantity : item.discountTenths)) {
                e.target.value = e.target.classList.contains('checkout-qty-input') ? item.quantity : item.discountTenths;
            }
        }
    }, true);

    checkoutConfirmBtn.addEventListener('click', handleCheckoutConfirm);

    checkoutModal.dataset.initialized = 'true';
}

// --- Search Chips ---

function gameMatchesTerm(game, term) {
    const t = term.toLowerCase();
    if ((game.name || '').toLowerCase().includes(t)) return true;
    if (gameBarcodes(game).some(b => b.toLowerCase().includes(t))) return true;
    if (Number(game.for_sale_stock) > 0 && '販售'.includes(t)) return true;
    if (Number(game.for_rent_stock) > 0 && '可租借'.includes(t)) return true;
    return (game.tags || '').split(',').some(tag => tag.trim().toLowerCase().includes(t) && tag.trim() !== '');
}

function renderSearchChips() {
    const container = document.getElementById('game-search-container');
    if (!container || !gameSearchInput) return;
    container.querySelectorAll('.search-chip').forEach(c => c.remove());
    searchChips.forEach(chip => {
        const el = document.createElement('span');
        el.className = 'search-chip';
        el.innerHTML = `${escapeHtml(chip)}<button type="button" class="chip-remove" data-chip="${escapeHtml(chip)}">&times;</button>`;
        container.insertBefore(el, gameSearchInput);
    });
}

function addSearchChip(term) {
    const normalized = term.trim();
    if (!normalized || searchChips.includes(normalized)) return;
    searchChips.push(normalized);
    renderSearchChips();
    applyGameFiltersAndRender();
}

function removeSearchChip(term) {
    searchChips = searchChips.filter(c => c !== term);
    renderSearchChips();
    applyGameFiltersAndRender();
}

function applyGameFiltersAndRender() {
    if (!allGamesData || !gameSearchInput || !inventoryStockFilter) return;

    const inputText = gameSearchInput.value.trim();
    const allTerms = [...searchChips, ...(inputText ? [inputText] : [])];

    let filteredGames = allTerms.length > 0
        ? allGamesData.filter(game => allTerms.every(term => gameMatchesTerm(game, term)))
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

// --- Barcode Fields (編輯商品：可新增多組條碼) ---

function addBarcodeFieldRow(value = '', focus = false) {
    const container = document.getElementById('edit-game-barcode-list');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'barcode-field-row';
    row.style.cssText = 'display:flex; gap:6px; margin-bottom:6px;';
    row.innerHTML = `
        <input type="text" class="edit-game-barcode-input" placeholder="請掃描或手動輸入條碼" value="${escapeHtml(value)}" style="flex:1;">
        <button type="button" class="remove-barcode-field-btn action-btn" style="background:var(--danger-color); color:#fff; padding:4px 10px;">&times;</button>
    `;
    container.appendChild(row);
    if (focus) row.querySelector('input').focus();
}

function renderBarcodeFields(barcodeList) {
    const container = document.getElementById('edit-game-barcode-list');
    if (!container) return;
    container.innerHTML = '';
    const list = barcodeList.length > 0 ? barcodeList : [''];
    list.forEach(value => addBarcodeFieldRow(value));
}

// --- Help Card Fields (編輯商品：可上傳多張幫助卡圖片) ---

let helpCardFieldCounter = 0;

// 逗號分隔字串 <-> 陣列，跟多組條碼的 extra_barcodes 用同一套慣例
function parseHelpCardImages(helpCardImagesStr) {
    return (helpCardImagesStr || '').split(',').map(u => u.trim()).filter(Boolean);
}

function addHelpCardFieldRow(value = '') {
    const container = document.getElementById('edit-game-help-card-list');
    if (!container) return;
    const n = ++helpCardFieldCounter;
    const urlId = `help-card-img-url-${n}`;
    const previewId = `help-card-img-preview-${n}`;

    const row = document.createElement('div');
    row.className = 'help-card-field-row form-group';
    row.innerHTML = `
        <div class="img-upload-row">
            <input type="url" class="help-card-image-input" id="${urlId}" placeholder="貼上網址，或點右側上傳" value="${escapeHtml(value)}">
            <label class="img-upload-btn" title="上傳圖片到 R2">
                📁
                <input type="file" accept="image/*" data-target="${urlId}" data-preview="${previewId}" style="display:none" class="r2-file-input">
            </label>
            <button type="button" class="remove-help-card-field-btn action-btn" style="background:var(--danger-color); color:#fff; padding:4px 10px;">&times;</button>
        </div>
        <img id="${previewId}" class="img-preview" style="display:${value ? 'block' : 'none'};" src="${escapeHtml(value)}">
    `;
    container.appendChild(row);
}

function renderHelpCardFields(imageList) {
    const container = document.getElementById('edit-game-help-card-list');
    if (!container) return;
    container.innerHTML = '';
    imageList.forEach(value => addHelpCardFieldRow(value));
}

// --- Score Category Fields (編輯商品：可設定專屬計分欄位) ---

// game.score_categories 是 ScoreTemplates 存的 JSON 陣列字串（例如 ["建築分","資源分"]），沒有設定就是 null
function parseScoreCategories(scoreCategoriesStr) {
    if (!scoreCategoriesStr) return [];
    try {
        const arr = JSON.parse(scoreCategoriesStr);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function addScoreCategoryFieldRow(value = '', focus = false) {
    const container = document.getElementById('edit-game-score-category-list');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'score-category-field-row';
    row.style.cssText = 'display:flex; gap:6px; margin-bottom:6px;';
    row.innerHTML = `
        <input type="text" class="edit-game-score-category-input" placeholder="例如：建築分" value="${escapeHtml(value)}" style="flex:1;">
        <button type="button" class="remove-score-category-field-btn action-btn" style="background:var(--danger-color); color:#fff; padding:4px 10px;">&times;</button>
    `;
    container.appendChild(row);
    if (focus) row.querySelector('input').focus();
}

function renderScoreCategoryFields(categoryList) {
    const container = document.getElementById('edit-game-score-category-list');
    if (!container) return;
    container.innerHTML = '';
    categoryList.forEach(value => addScoreCategoryFieldRow(value));
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
        renderBarcodeFields(gameBarcodes(game));
        renderHelpCardFields(parseHelpCardImages(game.help_card_images));
        renderScoreCategoryFields(parseScoreCategories(game.score_categories));
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

        renderBarcodeFields([]);
        renderHelpCardFields([]);
        renderScoreCategoryFields([]);
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
    const barcodes = Array.from(document.querySelectorAll('#edit-game-barcode-list .edit-game-barcode-input'))
        .map(el => el.value.trim())
        .filter(Boolean);
    const helpCardImages = Array.from(document.querySelectorAll('#edit-game-help-card-list .help-card-image-input'))
        .map(el => el.value.trim())
        .filter(Boolean);
    const scoreCategories = Array.from(document.querySelectorAll('#edit-game-score-category-list .edit-game-score-category-input'))
        .map(el => el.value.trim())
        .filter(Boolean);

    const updatedData = {
        name: document.getElementById('edit-game-name').value,
        barcodes,
        helpCardImages,
        scoreCategories,
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
            const gameIndex = allGamesData.findIndex(g => String(g.game_id) === String(updatedData.gameId));
            if (gameIndex !== -1) {
                allGamesData[gameIndex] = {
                    ...allGamesData[gameIndex],
                    ...updatedData,
                    barcode: barcodes[0] || null,
                    extra_barcodes: barcodes.slice(1).join(','),
                    help_card_images: helpCardImages.join(','),
                    score_categories: scoreCategories.length > 0 ? JSON.stringify(scoreCategories) : null,
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

    gameSearchInput.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && gameSearchInput.value.trim()) {
            e.preventDefault();
            addSearchChip(gameSearchInput.value.trim());
            gameSearchInput.value = '';
        } else if (e.key === 'Backspace' && gameSearchInput.value === '' && searchChips.length > 0) {
            removeSearchChip(searchChips[searchChips.length - 1]);
        }
    });

    document.getElementById('game-search-container')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-remove')) {
            removeSearchChip(e.target.dataset.chip);
        } else {
            gameSearchInput.focus();
        }
    });

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
            if (target.dataset.field === 'barcode') {
                activateBarcodeInlineEdit(target, gameId);
            } else {
                activateInlineEdit(target);
            }
        } else if (target.classList.contains('btn-edit-game')) {
            openEditGameModal(gameId);
        } else if (target.classList.contains('btn-rent')) {
            if (context && context.openCreateRentalModal) {
                context.openCreateRentalModal(gameId);
            }
        } else if (target.classList.contains('btn-sell')) {
            openSellGameModal(gameId);
        } else if (target.classList.contains('batch-sell-check')) {
            if (target.checked) {
                selectedForBatchSale.add(String(gameId));
            } else {
                selectedForBatchSale.delete(String(gameId));
                if (inventorySelectAll) inventorySelectAll.checked = false;
            }
        }
    });

    if (inventorySelectAll) {
        inventorySelectAll.addEventListener('change', () => {
            const checkboxes = gameListTbody.querySelectorAll('.batch-sell-check:not(:disabled)');
            checkboxes.forEach(cb => {
                cb.checked = inventorySelectAll.checked;
                if (inventorySelectAll.checked) {
                    selectedForBatchSale.add(String(cb.dataset.gameId));
                } else {
                    selectedForBatchSale.delete(String(cb.dataset.gameId));
                }
            });
        });
    }

    setupCheckoutEventListeners();

    editGameForm.addEventListener('submit', handleEditGameFormSubmit);
    if (sellGameForm) sellGameForm.addEventListener('submit', handleSellGameFormSubmit);

    ['edit-total-stock', 'edit-for-sale-stock', 'edit-for-rent-stock'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateBackupStock);
    });

    setupModalTabListeners();
    setupTagChipListeners();

    document.getElementById('edit-game-barcode-add-btn')?.addEventListener('click', () => {
        addBarcodeFieldRow('', true);
    });
    document.getElementById('edit-game-barcode-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-barcode-field-btn')) {
            e.target.closest('.barcode-field-row')?.remove();
        }
    });
    document.getElementById('edit-game-barcode-list')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.classList.contains('edit-game-barcode-input')) return;
        e.preventDefault(); // 掃描槍會在條碼後自動送出 Enter，避免整張編輯表單被誤送出
        const rows = document.querySelectorAll('#edit-game-barcode-list .barcode-field-row');
        const isLastRow = e.target.closest('.barcode-field-row') === rows[rows.length - 1];
        if (isLastRow && e.target.value.trim()) {
            addBarcodeFieldRow('', true); // 掃完自動開下一格，方便連續掃描多組條碼
        }
    });

    document.getElementById('edit-game-help-card-add-btn')?.addEventListener('click', () => {
        addHelpCardFieldRow('');
    });
    document.getElementById('edit-game-help-card-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-help-card-field-btn')) {
            e.target.closest('.help-card-field-row')?.remove();
        }
    });

    document.getElementById('edit-game-score-category-add-btn')?.addEventListener('click', () => {
        addScoreCategoryFieldRow('', true);
    });
    document.getElementById('edit-game-score-category-list')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-score-category-field-btn')) {
            e.target.closest('.score-category-field-row')?.remove();
        }
    });
    document.getElementById('edit-game-score-category-list')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.classList.contains('edit-game-score-category-input')) return;
        e.preventDefault();
        const rows = document.querySelectorAll('#edit-game-score-category-list .score-category-field-row');
        const isLastRow = e.target.closest('.score-category-field-row') === rows[rows.length - 1];
        if (isLastRow && e.target.value.trim()) {
            addScoreCategoryFieldRow('', true);
        }
    });

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
    sellGameModal = document.getElementById('sell-game-modal');
    sellGameForm = document.getElementById('sell-game-form');

    btnDownloadTemplate = pageElement.querySelector('#btn-download-csv-template');
    btnImportCSV = pageElement.querySelector('#btn-import-csv');
    btnAddNewProduct = pageElement.querySelector('#btn-add-new-product');
    importCSVModal = document.getElementById('import-csv-modal');
    importCSVForm = document.getElementById('import-csv-form');

    inventorySelectAll = pageElement.querySelector('#inventory-select-all');
    btnBatchSell = pageElement.querySelector('#btn-batch-sell');
    checkoutModal = document.getElementById('checkout-sale-modal');
    checkoutItemsTbody = document.getElementById('checkout-items-tbody');
    checkoutBarcodeInput = document.getElementById('checkout-barcode-input');
    checkoutManualSearch = document.getElementById('checkout-manual-search');
    checkoutManualResults = document.getElementById('checkout-manual-results');
    checkoutTotalEl = document.getElementById('checkout-total-amount');
    checkoutConfirmBtn = document.getElementById('checkout-confirm-btn');

    if (!gameListTbody) return;
    gameListTbody.innerHTML = '<tr><td colspan="6">正在載入庫存資料...</td></tr>';

    try {
        allGamesData = await api.getProducts();
        applyGameFiltersAndRender();
        setupEventListeners();
        initializeGameDragAndDrop();
    } catch (error) {
        console.error('獲取庫存列表失敗:', error);
        gameListTbody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    }
};
