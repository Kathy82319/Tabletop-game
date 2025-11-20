// public/admin/modules/userManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// --- 全域變數 ---
let allUsers = [];
let allAssets = []; // 儲存職業、技能、裝備設定
let currentAssetType = 'class'; // 當前制度設定的分頁 (class/skill/equipment)

// --- 1. 顧客列表相關功能 (保留原有邏輯) ---

function renderUserList(users) {
    const userListTbody = document.getElementById('user-list-tbody');
    if (!userListTbody) return;

    userListTbody.innerHTML = '';
    users.forEach(user => {
        const row = userListTbody.insertRow();
        row.dataset.userId = user.user_id;
        row.style.cursor = 'pointer';
        const displayName = user.nickname ? `${user.line_display_name} (${user.nickname})` : user.line_display_name;
        const needsPerk = user.level > 1 && user.level > (user.perk_claimed_level || 0);
        const levelDisplay = needsPerk ? `${user.level} ⭐` : user.level;

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

        if (needsPerk) row.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
    });
}

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

// --- 2. 會員制度設定相關功能 (新功能) ---

const typeLabels = {
    'class': { label: '職業', desc: '預設福利' },
    'skill': { label: '技能', desc: '技能說明' },
    'equipment': { label: '裝備', desc: '裝備效果' }
};

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

function openEditAssetModal(assetId = null) {
    const form = document.getElementById('edit-asset-form');
    form.reset();
    
    const typeInfo = typeLabels[currentAssetType];
    document.getElementById('modal-asset-title').textContent = assetId ? '編輯項目' : `新增${typeInfo.label}`;
    document.getElementById('edit-asset-type').value = currentAssetType;
    document.getElementById('edit-asset-desc-label').textContent = typeInfo.desc;
    
    const deleteBtn = document.getElementById('delete-asset-btn');
    
    if (assetId) {
        const asset = allAssets.find(a => a.id == assetId);
        document.getElementById('edit-asset-id').value = asset.id;
        document.getElementById('edit-asset-name').value = asset.name;
        document.getElementById('edit-asset-desc').value = asset.description;
        deleteBtn.style.display = 'inline-block';
        deleteBtn.onclick = () => handleAssetDelete(asset.id);
    } else {
        document.getElementById('edit-asset-id').value = '';
        deleteBtn.style.display = 'none';
    }
    
    ui.showModal('#edit-asset-modal');
}

async function handleAssetSave(e) {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;

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
        ui.toast.error(error.message);
    } finally {
        button.disabled = false;
    }
}

async function handleAssetDelete(id) {
    if (!await ui.confirm('確定要刪除此項目嗎？')) return;
    try {
        await api.deleteGameAsset(id);
        ui.toast.success('已刪除');
        ui.hideModal('#edit-asset-modal');
        allAssets = await api.getGameAssets();
        renderAssetsList();
    } catch (error) {
        ui.toast.error(error.message);
    }
}

// --- 3. 編輯使用者 (整合下拉選單) ---

// 輔助：建立連動下拉選單
function setupAssetDropdown(selectId, otherInputId, type, currentValue, onSelectCallback) {
    const select = document.getElementById(selectId);
    const otherInput = document.getElementById(otherInputId);
    if(!select || !otherInput) return;
    
    const assets = allAssets.filter(a => a.type === type);
    
    select.innerHTML = '<option value="">無</option>';
    assets.forEach(asset => {
        const opt = document.createElement('option');
        opt.value = asset.name;
        opt.textContent = asset.name;
        opt.dataset.desc = asset.description || '';
        select.appendChild(opt);
    });
    select.add(new Option('其他 (自訂)', 'other'));

    const isStandard = assets.some(a => a.name === currentValue);
    if (currentValue && currentValue !== '無' && !isStandard) {
        select.value = 'other';
        otherInput.style.display = 'block';
        otherInput.value = currentValue;
    } else {
        select.value = currentValue || '';
        otherInput.style.display = 'none';
    }

    select.onchange = () => {
        if (select.value === 'other') {
            otherInput.style.display = 'block';
            otherInput.value = '';
            otherInput.focus();
        } else {
            otherInput.style.display = 'none';
            if (onSelectCallback) {
                const selectedOpt = select.options[select.selectedIndex];
                onSelectCallback(selectedOpt.dataset.desc || '');
            }
        }
    };
}

async function openEditUserModal(userId) {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return ui.toast.error('找不到該使用者！');

    // 確保資源已載入
    if (allAssets.length === 0) {
        try { allAssets = await api.getGameAssets(); } 
        catch (e) { console.error("載入資源失敗", e); }
    }

    const modal = document.getElementById('edit-user-modal');
    modal.querySelector('#edit-user-id').value = user.user_id;
    modal.querySelector('#modal-user-title').textContent = `編輯：${user.nickname || user.line_display_name}`;
    modal.querySelector('#edit-level-input').value = user.level;
    modal.querySelector('#edit-exp-input').value = user.current_exp;
    modal.querySelector('#edit-notes-textarea').value = user.notes || '';
    modal.querySelector('#edit-perk-input').value = user.perk || '';
    modal.querySelector('#edit-skill-desc-input').value = user.skill_description || '';

    // 設定職業 (連動帶入福利)
    setupAssetDropdown('edit-class-select', 'edit-class-other-input', 'class', user.class, (desc) => {
        document.getElementById('edit-perk-input').value = desc;
    });

    // 設定技能 (連動帶入說明)
    setupAssetDropdown('edit-skill-select', 'edit-skill-other-input', 'skill', user.skill, (desc) => {
        document.getElementById('edit-skill-desc-input').value = desc;
    });

    // 設定裝備
    setupAssetDropdown('edit-equipment-select', 'edit-equipment-other-input', 'equipment', user.equipment);

    // 設定標籤
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

async function handleEditUserFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const getValue = (selId, inpId) => {
        const val = form.querySelector(selId).value;
        return val === 'other' ? form.querySelector(inpId).value.trim() : val;
    };

    const data = {
        userId: form.querySelector('#edit-user-id').value,
        level: form.querySelector('#edit-level-input').value,
        current_exp: form.querySelector('#edit-exp-input').value,
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
    try {
        await api.updateUserDetails(data);
        ui.toast.success('更新成功');
        ui.hideModal('#edit-user-modal');
        // 重新載入使用者列表
        allUsers = await api.getUsers();
        handleUserSearch();
    } catch (e) {
        ui.toast.error(e.message);
    } finally {
        btn.disabled = false;
    }
}

// --- 4. 初始化與事件監聽 ---

function setupEventListeners() {
    const page = document.getElementById('page-users');
    if (page.dataset.initialized) return;

    // 子分頁切換邏輯
    const subTabs = page.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有 active
            subTabs.forEach(b => b.classList.remove('active'));
            page.querySelectorAll('.sub-view-container').forEach(div => div.style.display = 'none');
            
            // 啟用當前
            btn.classList.add('active');
            const targetId = btn.dataset.target;
            document.getElementById(targetId).style.display = 'block';
        });
    });

    // 使用者列表功能
    const userSearchInput = document.getElementById('user-search-input');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', handleUserSearch);
    }
    
    document.getElementById('user-list-tbody').addEventListener('click', async (event) => {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;
        
        if (target.classList.contains('btn-edit-user')) {
            openEditUserModal(row.dataset.userId);
        } else if (target.classList.contains('btn-claim-perk-list')) {
            // ... (省略領取福利的邏輯，保持原樣)
        }
    });

    // 會員制度設定功能
    const assetFilter = document.getElementById('assets-type-filter');
    assetFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            assetFilter.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentAssetType = e.target.dataset.type;
            renderAssetsList();
        }
    });

    document.getElementById('btn-add-asset').addEventListener('click', () => openEditAssetModal());
    document.getElementById('edit-asset-form').addEventListener('submit', handleAssetSave);
    document.getElementById('edit-user-form').addEventListener('submit', handleEditUserFormSubmit);
    
    document.getElementById('assets-list-tbody').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit-asset')) {
            openEditAssetModal(e.target.dataset.id);
        }
    });

    page.dataset.initialized = 'true';
}

export const init = async (context, param) => {
    const userListTbody = document.getElementById('user-list-tbody');
    if (!userListTbody) return;

    userListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">正在載入顧客資料...</td></tr>';
    
    try {
        const [users, assets] = await Promise.all([
            api.getUsers(),
            api.getGameAssets()
        ]);
        allUsers = users;
        allAssets = assets;

        renderUserList(allUsers);
        renderAssetsList(); // 預渲染設定列表
        setupEventListeners();
    } catch (error) {
        console.error('載入失敗:', error);
        userListTbody.innerHTML = `<tr><td colspan="6" style="color: red;">讀取失敗: ${error.message}</td></tr>`;
    }
};