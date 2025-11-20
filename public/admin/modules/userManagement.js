// public/admin/modules/userManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

// --- 全域變數 ---
let allUsers = [];
let allAssets = []; // 儲存職業、技能、裝備設定
let allDrafts = []; // 儲存訊息草稿 (用於 CRM 發送訊息)
let currentAssetType = 'class'; // 當前制度設定的分頁

// ============================================================
// 1. 顧客列表相關功能
// ============================================================

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

// ============================================================
// 2. 會員制度設定相關功能 (新增功能)
// ============================================================

const typeLabels = {
    'class': { label: '職業', desc: '預設福利' },
    'skill': { label: '技能', desc: '技能說明' },
    'equipment': { label: '裝備', desc: '裝備效果' }
};

function renderAssetsList() {
    const tbody = document.getElementById('assets-list-tbody');
    if(!tbody) return;

    const filtered = allAssets.filter(a => a.type === currentAssetType);
    
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
        if(asset) {
            document.getElementById('edit-asset-id').value = asset.id;
            document.getElementById('edit-asset-name').value = asset.name;
            document.getElementById('edit-asset-desc').value = asset.description;
            deleteBtn.style.display = 'inline-block';
            deleteBtn.onclick = () => handleAssetDelete(asset.id);
        }
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
        allAssets = await api.getGameAssets();
        renderAssetsList();
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '儲存';
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
        ui.toast.error(`刪除失敗: ${error.message}`);
    }
}

// ============================================================
// 3. 編輯使用者 (整合下拉選單)
// ============================================================

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

    if (allAssets.length === 0) {
        try { allAssets = await api.getGameAssets(); } 
        catch (e) { console.error("載入資源失敗", e); }
    }

    const modal = document.getElementById('edit-user-modal');
    if(!modal) return ui.toast.error("HTML 結構錯誤");

    modal.querySelector('#edit-user-id').value = user.user_id;
    modal.querySelector('#modal-user-title').textContent = `編輯：${user.nickname || user.line_display_name}`;
    modal.querySelector('#edit-level-input').value = user.level;
    modal.querySelector('#edit-exp-input').value = user.current_exp;
    modal.querySelector('#edit-notes-textarea').value = user.notes || '';
    
    modal.querySelector('#edit-perk-input').value = user.perk || '';
    modal.querySelector('#edit-skill-desc-input').value = user.skill_description || '';
    modal.querySelector('#edit-equipment-desc-input').value = user.equipment_description || '';

    setupAssetDropdown('edit-class-select', 'edit-class-other-input', 'class', user.class, (desc) => {
        document.getElementById('edit-perk-input').value = desc;
    });
    setupAssetDropdown('edit-skill-select', 'edit-skill-other-input', 'skill', user.skill, (desc) => {
        document.getElementById('edit-skill-desc-input').value = desc;
    });
    setupAssetDropdown('edit-equipment-select', 'edit-equipment-other-input', 'equipment', user.equipment, (desc) => {
        document.getElementById('edit-equipment-desc-input').value = desc;
    });
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
        equipment_description: form.querySelector('#edit-equipment-desc-input').value.trim(),
        tag: getValue('#edit-tag-select', '#edit-tag-other-input'),
        notes: form.querySelector('#edit-notes-textarea').value.trim()
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        await api.updateUserDetails(data);
        ui.toast.success('更新成功');
        ui.hideModal('#edit-user-modal');
        allUsers = await api.getUsers();
        handleUserSearch(); 
    } catch (e) {
        ui.toast.error(e.message);
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// 4. CRM 詳細資料頁面 (原本遺失的功能，現已補回)
// ============================================================

/**
 * 渲染歷史紀錄表格 (預約、租借、經驗)
 */
function renderHistoryTable(items, columns, headers) {
    if (!items || items.length === 0) { 
        const p = document.createElement('p'); 
        p.textContent = '無相關紀錄'; 
        return p; 
    }
    const table = document.createElement('table'); 
    table.innerHTML = `<thead><tr>${Object.values(headers).map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = table.createTBody();
    items.forEach(item => { 
        const row = tbody.insertRow(); 
        columns.forEach(col => { 
            const cell = row.insertCell(); 
            let value = item[col]; 
            if (col.includes('date') || col.includes('_at')) {
                value = new Date(value).toLocaleDateString();
            }
            cell.textContent = value; 
        }); 
    });
    return table;
}

/**
 * 載入並綁定訊息草稿
 */
async function loadAndBindMessageDrafts(userId) {
    const select = document.querySelector('#user-details-modal #message-draft-select'); 
    const content = document.querySelector('#user-details-modal #direct-message-content'); 
    const sendBtn = document.querySelector('#user-details-modal #send-direct-message-btn'); 
    
    if (!select || !content || !sendBtn) return;
    
    if (allDrafts.length === 0) { 
        try { allDrafts = await api.getMessageDrafts(); } 
        catch (error) { console.error("草稿載入失敗"); } 
    }
    
    select.innerHTML = '<option value="">-- 手動輸入或選擇草稿 --</option>'; 
    allDrafts.forEach(d => select.add(new Option(d.title, d.content))); 
    
    select.onchange = () => { content.value = select.value; };
    
    sendBtn.onclick = async () => { 
        const message = content.value.trim(); 
        if (!message) return ui.toast.error('訊息內容不可為空！'); 
        
        const confirmed = await ui.confirm(`確定要發送訊息給該顧客嗎？`); 
        if (!confirmed) return; 
        
        try { 
            sendBtn.textContent = '發送中...'; 
            sendBtn.disabled = true; 
            await api.sendMessage(userId, message); 
            ui.toast.success('訊息發送成功！'); 
            content.value = ''; 
            select.value = ''; 
        } catch (error) { 
            ui.toast.error(`錯誤：${error.message}`); 
        } finally { 
            sendBtn.textContent = '確認發送'; 
            sendBtn.disabled = false; 
        } 
    };
}

/**
 * 渲染 CRM 詳細資料彈窗內容
 */
function renderUserDetails(data) {
    const contentContainer = document.querySelector('#user-details-modal #user-details-content'); 
    if (!contentContainer) return;
    
    const { profile, bookings, rentals, exp_history } = data; 
    const displayName = profile.nickname || profile.line_display_name;
    document.querySelector('#user-details-modal #user-details-title').textContent = displayName;
    
    contentContainer.innerHTML = `
        <div class="details-grid">
            <div class="profile-summary">
                <img src="/api/admin/get-avatar?userId=${profile.user_id}" alt="Avatar">
                <h4>${displayName}</h4>
                <p><strong>姓名:</strong> ${profile.real_name || '未設定'}</p>
                <p><strong>電話:</strong> ${profile.phone || '未設定'}</p>
                <p><strong>Email:</strong> ${profile.email || '未設定'}</p>
                <hr>
                <p><strong>等級:</strong> ${profile.level} (${profile.current_exp}/10 EXP)</p>
                <p><strong>職業:</strong> ${profile.class}</p>
                <p><strong>技能:</strong> ${profile.skill || '無'}</p>
                <p><strong>裝備:</strong> ${profile.equipment || '無'}</p>
                <p><strong>標籤:</strong> ${profile.tag}</p>
            </div>
            <div class="profile-details">
                ${profile.notes ? `<div class="crm-notes-section" style="margin-bottom: 1rem; padding: 0.8rem; background-color: #fffbe6; border-radius: 6px; border: 1px solid #ffe58f; max-height: 5em; overflow-y: auto;"><h4 style="margin-bottom: 5px;">顧客備註</h4><p style="white-space: pre-wrap; margin: 0; text-align: left;">${profile.notes}</p></div>` : ''}
                <div class="details-tabs">
                    <button class="details-tab active" data-target="tab-bookings">預約紀錄</button>
                    <button class="details-tab" data-target="tab-rentals">租借紀錄</button>
                    <button class="details-tab" data-target="tab-exp">經驗值紀錄</button>
                </div>
                <div class="details-tab-content active" id="tab-bookings"></div>
                <div class="details-tab-content" id="tab-rentals"></div>
                <div class="details-tab-content" id="tab-exp"></div>
            </div>
        </div>
        <div class="message-sender">
            <h4>發送 LINE 訊息</h4>
            <div class="form-group">
                <label for="message-draft-select">選擇訊息草稿</label>
                <select id="message-draft-select"></select>
            </div>
            <div class="form-group">
                <label for="direct-message-content">訊息內容</label>
                <textarea id="direct-message-content" rows="4"></textarea>
            </div>
            <div class="form-actions">
                <button id="send-direct-message-btn" class="action-btn btn-save">確認發送</button>
            </div>
        </div>
    `;
    
    contentContainer.querySelector('#tab-bookings').appendChild(renderHistoryTable(bookings, ['booking_date', 'num_of_people', 'status_text'], { booking_date: '預約日', num_of_people: '人數', status_text: '狀態' }));
    contentContainer.querySelector('#tab-rentals').appendChild(renderHistoryTable(rentals, ['rental_date', 'game_name', 'status'], { rental_date: '租借日', game_name: '遊戲', status: '狀態' }));
    contentContainer.querySelector('#tab-exp').appendChild(renderHistoryTable(exp_history, ['created_at', 'reason', 'exp_added'], { created_at: '日期', reason: '原因', exp_added: '經驗' }));
    
    contentContainer.querySelector('.details-tabs').addEventListener('click', e => { 
        if (e.target.tagName === 'BUTTON') { 
            contentContainer.querySelector('.details-tab.active')?.classList.remove('active'); 
            e.target.classList.add('active'); 
            contentContainer.querySelector('.details-tab-content.active')?.classList.remove('active'); 
            contentContainer.querySelector(`#${e.target.dataset.target}`)?.classList.add('active'); 
        } 
    });
    
    loadAndBindMessageDrafts(profile.user_id);
}

/**
 * 開啟 CRM 詳細資料彈窗
 */
async function openUserDetailsModal(userId) {
    const contentContainer = document.querySelector('#user-details-modal #user-details-content'); 
    if (!contentContainer) return;
    
    contentContainer.innerHTML = '<p>讀取中...</p>'; 
    ui.showModal('#user-details-modal');
    
    try { 
        const data = await api.getUserDetails(userId); 
        renderUserDetails(data); 
    } catch (error) { 
        console.error("CRM 執行錯誤:", error); 
        contentContainer.innerHTML = `<p style="color:red;">載入資料時發生錯誤：${error.message}</p>`; 
    }
}

// ============================================================
// 5. 初始化與事件監聽
// ============================================================

function setupEventListeners() {
    const page = document.getElementById('page-users');

    // 子分頁切換邏輯
    const subTabs = page.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        btn.onclick = () => {
            subTabs.forEach(b => b.classList.remove('active'));
            page.querySelectorAll('.sub-view-container').forEach(div => div.style.display = 'none');
            
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
                    init();
                } catch (e) { ui.toast.error(e.message); }
            } else {
                // 【重要】這就是開啟 CRM 詳細資料的觸發點
                openUserDetailsModal(row.dataset.userId);
            }
        };
    }

    // 會員制度類別切換
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
        const [users, assets] = await Promise.all([
            api.getUsers(),
            api.getGameAssets()
        ]);
        allUsers = users;
        allAssets = assets;

        renderUserList(allUsers);
        renderAssetsList();
        setupEventListeners();

    } catch (error) {
        console.error('載入失敗:', error);
        userListTbody.innerHTML = `<tr><td colspan="6" style="color: red;">讀取失敗: ${error.message}</td></tr>`;
    }
};