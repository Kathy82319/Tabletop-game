// public/admin/modules/userManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allUsers = []; // 快取所有使用者資料
let allDrafts = []; // 快取訊息草稿

// 渲染使用者列表
function renderUserList(users) {
    const userListTbody = document.getElementById('user-list-tbody');
    if (!userListTbody) return;

    userListTbody.innerHTML = '';
    users.forEach(user => {
        const row = userListTbody.insertRow();
        row.dataset.userId = user.user_id;
        row.style.cursor = 'pointer';
        const displayName = user.nickname ? `${user.line_display_name} (${user.nickname})` : user.line_display_name;

        // 【修改 1】調整條件：檢查 user.level > 1
        const needsPerk = user.level > 1 && user.level > (user.perk_claimed_level || 0);
        const levelDisplay = needsPerk ? `${user.level} ⭐` : user.level;

        // 【修改 2】動態產生操作欄位的按鈕 HTML
        let actionsHTML = `<button class="action-btn btn-edit-user" data-userid="${user.user_id}" style="background-color: var(--warning-color); color: #000;">編輯</button>`;
        if (needsPerk) {
            // 如果需要福利，才加入「福利已給」按鈕
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

        // 背景色標示 (可選，條件同上)
        if (needsPerk) {
            row.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
        }
    });
}

// 處理使用者搜尋 (不變)
function handleUserSearch() {
    const userSearchInput = document.getElementById('user-search-input');
    const searchTerm = userSearchInput.value.toLowerCase().trim();
    const filteredUsers = searchTerm
        ? allUsers.filter(user =>
            (user.line_display_name || '').toLowerCase().includes(searchTerm) ||
            (user.nickname || '').toLowerCase().includes(searchTerm)
        )
        : allUsers;
    renderUserList(filteredUsers);
}

// 開啟編輯使用者彈窗 (不變)
function openEditUserModal(userId) {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) {
        return ui.toast.error('找不到該使用者！');
    }
    const modal = document.getElementById('edit-user-modal');
    if (!modal) return;
    modal.querySelector('#edit-user-id').value = user.user_id;
    modal.querySelector('#modal-user-title').textContent = `編輯：${user.line_display_name}`;
    modal.querySelector('#edit-level-input').value = user.level || 1;
    modal.querySelector('#edit-exp-input').value = user.current_exp || 0;
    modal.querySelector('#edit-notes-textarea').value = user.notes || '';
    const classSelect = modal.querySelector('#edit-class-select');
    const classOtherInput = modal.querySelector('#edit-class-other-input');
    const perkSelect = modal.querySelector('#edit-perk-select');
    const perkOtherInput = modal.querySelector('#edit-perk-other-input');
    const uniqueClasses = ['無', ...new Set(allUsers.map(u => u.class).filter(c => c && c !== '無'))];
    const uniquePerks = ['無特殊優惠', ...new Set(allUsers.map(u => u.perk).filter(p => p && p !== '無特殊優惠'))];
    const populateDropdown = (selectEl, otherInputEl, options, currentValue) => {
        selectEl.innerHTML = '';
        options.forEach(opt => selectEl.add(new Option(opt, opt)));
        selectEl.add(new Option('其他 (自訂)', 'other'));
        if (options.includes(currentValue)) {
            selectEl.value = currentValue;
            otherInputEl.style.display = 'none'; otherInputEl.value = '';
        } else {
            selectEl.value = 'other'; otherInputEl.style.display = 'block'; otherInputEl.value = currentValue || '';
        }
        selectEl.onchange = () => { otherInputEl.style.display = (selectEl.value === 'other') ? 'block' : 'none'; if(selectEl.value === 'other') otherInputEl.focus(); };
    };
    populateDropdown(classSelect, classOtherInput, uniqueClasses, user.class);
    populateDropdown(perkSelect, perkOtherInput, uniquePerks, user.perk);
    modal.querySelector('#edit-tag-select').value = user.tag || '';
    ui.showModal('#edit-user-modal');
}

// 處理編輯使用者表單提交 (不變)
async function handleEditUserFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const userId = form.querySelector('#edit-user-id').value;
    const button = form.querySelector('button[type="submit"]');
    const classSelect = form.querySelector('#edit-class-select');
    let finalClass = classSelect.value;
    if (finalClass === 'other') finalClass = form.querySelector('#edit-class-other-input').value.trim() || '無';
    const perkSelect = form.querySelector('#edit-perk-select');
    let finalPerk = perkSelect.value;
    if (finalPerk === 'other') finalPerk = form.querySelector('#edit-perk-other-input').value.trim() || '無特殊優惠';
    const updatedData = {
        userId: userId,
        level: parseInt(form.querySelector('#edit-level-input').value, 10),
        current_exp: parseInt(form.querySelector('#edit-exp-input').value, 10),
        user_class: finalClass,
        tag: form.querySelector('#edit-tag-select').value,
        perk: finalPerk,
        notes: form.querySelector('#edit-notes-textarea').value.trim(),
    };
    button.textContent = '儲存中...'; button.disabled = true;
    try {
        await api.updateUserDetails(updatedData);
        ui.toast.success('使用者資料更新成功！');
        await init();
        handleUserSearch();
        ui.hideModal('#edit-user-modal');
    } catch (error) { ui.toast.error(`更新失敗：${error.message}`);
    } finally { button.textContent = '儲存'; button.disabled = false; }
}

// renderHistoryTable (不變)
function renderHistoryTable(items, columns, headers) {
    if (!items || items.length === 0) { const p = document.createElement('p'); p.textContent = '無相關紀錄'; return p; }
    const table = document.createElement('table'); table.innerHTML = `<thead><tr>${Object.values(headers).map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = table.createTBody();
    items.forEach(item => { const row = tbody.insertRow(); columns.forEach(col => { const cell = row.insertCell(); let value = item[col]; if (col.includes('date') || col.includes('_at')) value = new Date(value).toLocaleDateString(); cell.textContent = value; }); });
    return table;
}

// loadAndBindMessageDrafts (不變)
async function loadAndBindMessageDrafts(userId) {
    const select = document.querySelector('#user-details-modal #message-draft-select'); const content = document.querySelector('#user-details-modal #direct-message-content'); const sendBtn = document.querySelector('#user-details-modal #send-direct-message-btn'); if (!select || !content || !sendBtn) return;
    if (allDrafts.length === 0) { try { allDrafts = await api.getMessageDrafts(); } catch (error) { ui.toast.error("載入草稿失敗"); } }
    select.innerHTML = '<option value="">-- 手動輸入或選擇草稿 --</option>'; allDrafts.forEach(d => select.add(new Option(d.title, d.content))); select.onchange = () => { content.value = select.value; };
    sendBtn.onclick = async () => { const message = content.value.trim(); if (!message) return ui.toast.error('訊息內容不可為空！'); const confirmed = await ui.confirm(`確定要發送訊息給該顧客嗎？`); if (!confirmed) return; try { sendBtn.textContent = '發送中...'; sendBtn.disabled = true; await api.sendMessage(userId, message); ui.toast.success('訊息發送成功！'); content.value = ''; select.value = ''; } catch (error) { ui.toast.error(`錯誤：${error.message}`); } finally { sendBtn.textContent = '確認發送'; sendBtn.disabled = false; } };
}

// 【修改】renderUserDetails 調整條件：檢查 profile.level > 1
function renderUserDetails(data) {
    const contentContainer = document.querySelector('#user-details-modal #user-details-content'); if (!contentContainer) return;
    const { profile, bookings, rentals, exp_history } = data; const displayName = profile.nickname || profile.line_display_name;
    document.querySelector('#user-details-modal #user-details-title').textContent = displayName;
    // 【調整條件】
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
                <p><strong>標籤:</strong> ${profile.tag}</p>
            </div>
            <div class="profile-details">
                ${profile.notes ? `<div class="crm-notes-section" style="margin-bottom: 1rem; padding: 0.8rem; background-color: #fffbe6; border-radius: 6px; border: 1px solid #ffe58f; max-height: 5em; overflow-y: auto;">
                    <h4 style="margin-bottom: 5px;">顧客備註</h4><p style="white-space: pre-wrap; margin: 0; text-align: left;">${profile.notes}</p></div>` : ''}
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
    contentContainer.querySelector('.details-tabs').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { contentContainer.querySelector('.details-tab.active')?.classList.remove('active'); e.target.classList.add('active'); contentContainer.querySelector('.details-tab-content.active')?.classList.remove('active'); contentContainer.querySelector(`#${e.target.dataset.target}`)?.classList.add('active'); } });
    loadAndBindMessageDrafts(profile.user_id);
}

// openUserDetailsModal (不變)
async function openUserDetailsModal(userId) {
    const contentContainer = document.querySelector('#user-details-modal #user-details-content'); if (!contentContainer) return;
    contentContainer.innerHTML = '<p>讀取中...</p>'; ui.showModal('#user-details-modal');
    try { const data = await api.getUserDetails(userId); renderUserDetails(data); } catch (error) { console.error("CRM 執行錯誤:", error); contentContainer.innerHTML = `<p style="color:red;">載入資料時發生錯誤：${error.message}</p>`; }
}

// 【修改】setupEventListeners 加入列表福利按鈕的監聽
function setupEventListeners() {
    const page = document.getElementById('page-users'); if (!page || page.dataset.initialized) return;
    const userSearchInput = document.getElementById('user-search-input'); userSearchInput.addEventListener('input', handleUserSearch);
    const userListTbody = document.getElementById('user-list-tbody');
    userListTbody.addEventListener('click', async (event) => { // 【修改】改為 async
        const target = event.target; const row = target.closest('tr'); if (!row || !row.dataset.userId) return; const userId = row.dataset.userId;

        if (target.classList.contains('btn-edit-user')) {
            openEditUserModal(userId);
        } else if (target.classList.contains('btn-claim-perk-list')) { // 【新增】處理列表中的福利按鈕
            const button = target;
            const confirmed = await ui.confirm('您確定已經給予該顧客升級福利了嗎？'); if (!confirmed) return;
            button.textContent = '處理中...'; button.disabled = true;
            try {
                await api.claimPerk(userId);
                ui.toast.success('狀態更新成功！');
                await init(); // 重新載入列表
            } catch (error) {
                ui.toast.error(`更新失敗: ${error.message}`);
                button.textContent = '✅ 福利已給'; button.disabled = false; // 恢復按鈕
            }
        } else { // 點擊列的其他地方
            openUserDetailsModal(userId);
        }
    });
    const editUserForm = document.getElementById('edit-user-form'); if (editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    const userDetailsModal = document.getElementById('user-details-modal');
    page.dataset.initialized = 'true';
}

// 模組初始化函式 (不變)
export const init = async (context, param) => {
    const userListTbody = document.getElementById('user-list-tbody'); if (!userListTbody) return;
    userListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">正在載入顧客資料...</td></tr>';
    try { allUsers = await api.getUsers(); renderUserList(allUsers); setupEventListeners(); } catch (error) { console.error('獲取使用者列表失敗:', error); userListTbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">讀取失敗: ${error.message}</td></tr>`; }
};