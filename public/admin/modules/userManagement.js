// public/admin/modules/userManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// --- 全域變數 ---
let allUsers = [];
let allAssets = []; // 儲存職業、技能、裝備設定
let currentAssetType = 'class'; // 當前制度設定的分頁 (class/skill/equipment)

// --- 1. 顧客列表相關功能 ---

/**
 * 渲染使用者列表表格
 */
function renderUserList(users) {
    const userListTbody = document.getElementById('user-list-tbody');
    if (!userListTbody) return;

    userListTbody.innerHTML = '';
    if (users.length === 0) {
        userListTbody.innerHTML = '<tr><td colspan="6">沒有符合條件的使用者。</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = userListTbody.insertRow();
        row.dataset.userId = user.user_id;
        row.style.cursor = 'pointer';
        
        const displayName = user.nickname ? `${user.line_display_name} (${user.nickname})` : user.line_display_name;
        
        // 檢查是否需要升級福利
        const needsPerk = user.level > 1 && user.level > (user.perk_claimed_level || 0);
        const levelDisplay = needsPerk ? `${user.level} ⭐` : user.level;

        // 操作按鈕
        let actionsHTML = `<button class="action-btn btn-edit-user" data-userid="${user.user_id}" style="background-color: var(--warning-color); color: #000;">編輯</button>`;
        if (needsPerk) {
            actionsHTML += ` <button class="action-btn btn-claim-perk-list" data-userid="${user.user_id}" style="background-color: var(--success-color);">✅ 福利已給</button>`;
        }

        row.innerHTML = `
            <td class="compound-cell" style="text-align: left;">
                <div class="main-info">${displayName || 'N/A'}</div>
                <div class="sub-info">${user.user_id}</div>
            </td>
            <td>${levelDisplay}</td>
            <td>${user.current_exp} / 10</td>
            <td>${user.class || '無'}</td>
            <td><span class="tag-display">${user.tag || '無'}</span></td>
            <td class="actions-cell">${actionsHTML}</td> 
        `;

        // 標示需要福利的會員
        if (needsPerk) {
            row.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
        }
    });
}

/**
 * 處理使用者搜尋
 */
function handleUserSearch() {
    const userSearchInput = document.getElementById('user-search-input');
    const searchTerm = userSearchInput.value.toLowerCase().trim();
    
    const filteredUsers = searchTerm
        ? allUsers.filter(user =>
            (user.line_display_name || '').toLowerCase().includes(searchTerm) ||
            (user.nickname || '').toLowerCase().includes(searchTerm) ||
            (user.real_name || '').toLowerCase().includes(searchTerm) ||
            (user.class || '').toLowerCase().includes(searchTerm) ||
            (user.tag || '').toLowerCase().includes(searchTerm)
        )
        : allUsers;
    renderUserList(filteredUsers);
}

// --- 2. 會員制度設定相關功能 ---

const typeLabels = {
    'class': { label: '職業', desc: '預設福利' },
    'skill': { label: '技能', desc: '技能說明' },
    'equipment': { label: '裝備', desc: '裝備效果' }
};

/**
 * 渲染設定列表 (職業/技能/裝備)
 */
function renderAssetsList() {
    const tbody = document.getElementById('assets-list-tbody');
    if(!tbody) return;

    const filtered = allAssets.filter(a => a.type === currentAssetType);
    
    // 更新表頭文字
    const headerDesc = document.getElementById('asset-desc-header');
    if(headerDesc) headerDesc.textContent = typeLabels[currentAssetType].desc;
    
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">尚無資料。</td></tr>';
        return;
    }

    filtered.forEach(asset => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${asset.name}</td>
            <td>${asset.description || '-'}</td>
            <td><button class="action-btn btn-edit-asset" data-id="${asset.id}" style="background-color: var(--warning-color); color: #000;">編輯</button></td>
        `;
    });
}

/**
 * 開啟 新增/編輯 項目視窗
 */
function openEditAssetModal(assetId = null) {
    const form = document.getElementById('edit-asset-form');
    form.reset();
    
    const typeInfo = typeLabels[currentAssetType];
    document.getElementById('modal-asset-title').textContent = assetId ? '編輯項目' : `新增${typeInfo.label}`;
    document.getElementById('edit-asset-type').value = currentAssetType;
    document.getElementById('edit-asset-desc-label').textContent = typeInfo.desc;
    
    const deleteBtn = document.getElementById('delete-asset-btn');
    
    if (assetId) {
        // 編輯模式
        const asset = allAssets.find(a => a.id == assetId); // 注意：ID 可能是字串或數字
        if(asset) {
            document.getElementById('edit-asset-id').value = asset.id;
            document.getElementById('edit-asset-name').value = asset.name;
            document.getElementById('edit-asset-desc').value = asset.description;
            deleteBtn.style.display = 'inline-block';
            deleteBtn.onclick = () => handleAssetDelete(asset.id);
        }
    } else {
        // 新增模式
        document.getElementById('edit-asset-id').value = '';
        deleteBtn.style.display = 'none';
    }
    
    ui.showModal('#edit-asset-modal');
}

/**
 * 儲存項目 (新增或更新)
 */
async function handleAssetSave(e) {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = '儲存中...';

    const data = {
        id: document.getElementById('edit-asset-id').value,
        type: document.getElementById('edit-asset-type').value,
        name: document.getElementById('edit-asset-name').value,
        description: document.getElementById('edit-asset-desc').value
    };
    
    try {
        await api.saveGameAsset(data);
        ui.toast.success('儲存成功');
        ui.hideModal('#edit-asset-modal');
        // 重新載入設定並刷新列表
        allAssets = await api.getGameAssets();
        renderAssetsList();
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '儲存';
    }
}

/**
 * 刪除項目
 */
async function handleAssetDelete(id) {
    if (!await ui.confirm('確定要刪除此項目嗎？')) return;
    try {
        await api.deleteGameAsset(id);
        ui.toast.success('已刪除');
        ui.hideModal('#edit-asset-modal');
        allAssets = await api.getGameAssets();
        renderAssetsList();
    } catch (error) {
        ui.toast.error(`刪除失敗: ${error.message}`);
    }
}

// --- 3. 編輯使用者 (整合下拉選單) ---

/**
 * 輔助函式：建立連動下拉選單
 * @param {string} selectId 下拉選單 ID
 * @param {string} otherInputId 自訂輸入框 ID
 * @param {string} type 資源類型 (class/skill/equipment)
 * @param {string} currentValue 當前使用者的值
 * @param {function} onSelectCallback 當選擇改變時的回調 (用於帶入說明)
 */
function setupAssetDropdown(selectId, otherInputId, type, currentValue, onSelectCallback) {
    const select = document.getElementById(selectId);
    const otherInput = document.getElementById(otherInputId);
    if(!select || !otherInput) return;
    
    // 1. 篩選出對應類型的選項
    const assets = allAssets.filter(a => a.type === type);
    
    // 2. 建立選項 HTML
    select.innerHTML = '<option value="">無</option>';
    assets.forEach(asset => {
        const opt = document.createElement('option');
        opt.value = asset.name;
        opt.textContent = asset.name;
        opt.dataset.desc = asset.description || '';
        select.appendChild(opt);
    });
    select.add(new Option('其他 (自訂)', 'other'));

    // 3. 設定預設值 (判斷是否為自訂值)
    const isStandard = assets.some(a => a.name === currentValue);
    if (currentValue && currentValue !== '無' && !isStandard) {
        select.value = 'other';
        otherInput.style.display = 'block';
        otherInput.value = currentValue;
    } else {
        select.value = currentValue || '';
        otherInput.style.display = 'none';
    }

    // 4. 綁定變更事件
    select.onchange = () => {
        if (select.value === 'other') {
            otherInput.style.display = 'block';
            otherInput.value = '';
            otherInput.focus();
        } else {
            otherInput.style.display = 'none';
            // 如果有 callback，則執行 (例如：選了技能，自動把技能說明填入下面的框框)
            if (onSelectCallback) {
                const selectedOpt = select.options[select.selectedIndex];
                onSelectCallback(selectedOpt.dataset.desc || '');
            }
        }
    };
}

/**
 * 開啟編輯使用者彈窗
 */
async function openEditUserModal(userId) {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return ui.toast.error('找不到該使用者！');

    // 確保資源已載入 (如果 allAssets 為空，嘗試重新載入)
    if (allAssets.length === 0) {
        try { allAssets = await api.getGameAssets(); } 
        catch (e) { console.error("載入資源失敗", e); }
    }

    const modal = document.getElementById('edit-user-modal');
    if(!modal) {
        return ui.toast.error("找不到編輯視窗 (HTML未更新?)");
    }

    // 填入基本資料
    modal.querySelector('#edit-user-id').value = user.user_id;
    modal.querySelector('#modal-user-title').textContent = `編輯：${user.nickname || user.line_display_name}`;
    modal.querySelector('#edit-level-input').value = user.level;
    modal.querySelector('#edit-exp-input').value = user.current_exp;
    modal.querySelector('#edit-notes-textarea').value = user.notes || '';
    
    // 填入文字框資料
    modal.querySelector('#edit-perk-input').value = user.perk || '';
    modal.querySelector('#edit-skill-desc-input').value = user.skill_description || '';

    // --- 設定連動下拉選單 ---

    // 1. 職業 (Class) -> 連動帶入福利
    setupAssetDropdown('edit-class-select', 'edit-class-other-input', 'class', user.class, (desc) => {
        document.getElementById('edit-perk-input').value = desc;
    });

    // 2. 技能 (Skill) -> 連動帶入說明
    setupAssetDropdown('edit-skill-select', 'edit-skill-other-input', 'skill', user.skill, (desc) => {
        document.getElementById('edit-skill-desc-input').value = desc;
    });

    // 3. 裝備 (Equipment)
    setupAssetDropdown('edit-equipment-select', 'edit-equipment-other-input', 'equipment', user.equipment);

    // 4. 標籤 (Tag) - 標籤不屬於 GameAssets，維持寫死或另外管理
    const tagSelect = document.getElementById('edit-tag-select');
    const tagInput = document.getElementById('edit-tag-other-input');
    const defaultTags = ['無', '會員', '員工', '黑名單'];
    
    tagSelect.innerHTML = '';
    defaultTags.forEach(t => tagSelect.add(new Option(t, t)));
    tagSelect.add(new Option('其他', 'other'));
    
    if (defaultTags.includes(user.tag)) {
        tagSelect.value = user.tag || '無';
        tagInput.style.display = 'none';
    } else {
        tagSelect.value = 'other';
        tagInput.style.display = 'block';
        tagInput.value = user.tag;
    }
    tagSelect.onchange = () => { tagInput.style.display = tagSelect.value === 'other' ? 'block' : 'none'; };

    ui.showModal('#edit-user-modal');
}

/**
 * 提交使用者編輯表單
 */
async function handleEditUserFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    
    // 輔助函式：取得下拉選單的值 (若是 'other' 則取輸入框)
    const getValue = (selId, inpId) => {
        const val = form.querySelector(selId).value;
        return val === 'other' ? form.querySelector(inpId).value.trim() : val;
    };

    const data = {
        userId: form.querySelector('#edit-user-id').value,
        level: form.querySelector('#edit-level-input').value,
        current_exp: form.querySelector('#edit-exp-input').value,
        // 取值
        user_class: getValue('#edit-class-select', '#edit-class-other-input'),
        perk: form.querySelector('#edit-perk-input').value.trim(),
        skill: getValue('#edit-skill-select', '#edit-skill-other-input'),
        skill_description: form.querySelector('#edit-skill-desc-input').value.trim(),
        equipment: getValue('#edit-equipment-select', '#edit-equipment-other-input'),
        tag: getValue('#edit-tag-select', '#edit-tag-other-input'),
        notes: form.querySelector('#edit-notes-textarea').value.trim()
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    try {
        await api.updateUserDetails(data);
        ui.toast.success('更新成功');
        ui.hideModal('#edit-user-modal');
        
        // 重新載入使用者列表以顯示最新資料
        allUsers = await api.getUsers();
        handleUserSearch(); 
    } catch (e) {
        ui.toast.error(`更新失敗: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = '儲存';
    }
}

// --- 4. 初始化與事件監聽 ---

function setupEventListeners() {
    const page = document.getElementById('page-users');
    // 【注意】已移除 page.dataset.initialized 檢查，確保事件每次都能正確綁定

    // 綁定子分頁 (顧客總表 vs 會員制度設定) 切換
    const subTabs = page.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        // 先移除舊的監聽器避免重複 (簡易作法：複製節點取代)
        // 但較好的做法是直接覆蓋 onclick 或確保只綁一次
        // 這裡使用 addEventListener，若多次執行 init 會重複綁定，但影響不大
        btn.onclick = () => {
            // 移除所有 active
            subTabs.forEach(b => b.classList.remove('active'));
            page.querySelectorAll('.sub-view-container').forEach(div => div.style.display = 'none');
            
            // 啟用當前
            btn.classList.add('active');
            const targetId = btn.dataset.target;
            document.getElementById(targetId).style.display = 'block';
        };
    });

    // 綁定搜尋框
    const userSearchInput = document.getElementById('user-search-input');
    if (userSearchInput) {
        userSearchInput.oninput = handleUserSearch;
    }
    
    // 綁定使用者列表點擊 (委派)
    const userTbody = document.getElementById('user-list-tbody');
    if(userTbody) {
        userTbody.onclick = async (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row) return;
            
            if (target.classList.contains('btn-edit-user')) {
                openEditUserModal(row.dataset.userId);
            } else if (target.classList.contains('btn-claim-perk-list')) {
                const button = target;
                if (!await ui.confirm('確定已給予福利？')) return;
                try {
                    await api.claimPerk(row.dataset.userId);
                    ui.toast.success('狀態更新成功');
                    // 簡單重整：重新載入資料
                    init();
                } catch (e) { ui.toast.error(e.message); }
            }
        };
    }

    // 綁定會員制度類別切換 (職業/技能/裝備)
    const assetFilter = document.getElementById('assets-type-filter');
    if(assetFilter) {
        assetFilter.onclick = (e) => {
            if (e.target.tagName === 'BUTTON') {
                assetFilter.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                currentAssetType = e.target.dataset.type;
                renderAssetsList();
            }
        };
    }

    // 綁定按鈕與表單
    const btnAddAsset = document.getElementById('btn-add-asset');
    if(btnAddAsset) btnAddAsset.onclick = () => openEditAssetModal();

    const editAssetForm = document.getElementById('edit-asset-form');
    if(editAssetForm) editAssetForm.onsubmit = handleAssetSave;

    const editUserForm = document.getElementById('edit-user-form');
    if(editUserForm) editUserForm.onsubmit = handleEditUserFormSubmit;
    
    const assetsTbody = document.getElementById('assets-list-tbody');
    if(assetsTbody) {
        assetsTbody.onclick = (e) => {
            if (e.target.classList.contains('btn-edit-asset')) {
                openEditAssetModal(e.target.dataset.id);
            }
        };
    }

    page.dataset.initialized = 'true';
}

/**
 * 模組進入點
 */
export const init = async (context, param) => {
    const userListTbody = document.getElementById('user-list-tbody');
    if (!userListTbody) return;

    userListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">正在載入顧客資料...</td></tr>';
    
    try {
        // 同時載入 使用者列表 與 資源設定
        const [users, assets] = await Promise.all([
            api.getUsers(),
            api.getGameAssets()
        ]);
        allUsers = users;
        allAssets = assets;

        renderUserList(allUsers);
        renderAssetsList(); // 預先渲染設定列表 (雖然一開始可能隱藏)
        
        // 綁定事件
        setupEventListeners();

    } catch (error) {
        console.error('載入失敗:', error);
        userListTbody.innerHTML = `<tr><td colspan="6" style="color: red;">讀取失敗: ${error.message}</td></tr>`;
    }
};