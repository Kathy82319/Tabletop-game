// public/admin/modules/draftsManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allDrafts = [];

/**
 * 渲染訊息草稿列表
 * @param {Array} drafts - 要顯示的草稿陣列
 */
function renderDraftsList(drafts) {
    const tbody = document.getElementById('draft-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (drafts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">目前沒有任何訊息草稿。</td></tr>';
        return;
    }

    drafts.forEach(draft => {
        const row = tbody.insertRow();
        const preview = draft.content.length > 50 ? draft.content.substring(0, 50) + '...' : draft.content;
        row.innerHTML = `
            <td style="text-align: left;">${draft.title}</td>
            <td style="text-align: left;">${preview}</td>
            <td class="actions-cell">
                <button class="action-btn btn-edit-draft" data-draft-id="${draft.draft_id}" style="background-color: var(--warning-color); color: #000;">編輯</button>
            </td>
        `;
    });
}

/**
 * 開啟新增或編輯草稿的彈出視窗
 * @param {number|null} draftId - 要編輯的草稿 ID，若為 null 則是新增
 */
function openEditDraftModal(draftId = null) {
    const modal = document.getElementById('edit-draft-modal');
    const form = document.getElementById('edit-draft-form');
    const modalTitle = document.getElementById('modal-draft-title');
    const deleteBtn = document.getElementById('delete-draft-btn'); // 新增刪除按鈕變數

    if (!modal || !form || !modalTitle || !deleteBtn) return;

    form.reset();
    form.querySelector('#edit-draft-id').value = '';

    if (draftId) {
        const draft = allDrafts.find(d => d.draft_id === draftId);
        if (!draft) {
            ui.toast.error('找不到該筆草稿！');
            return;
        }
        modalTitle.textContent = '編輯訊息草稿';
        form.querySelector('#edit-draft-id').value = draft.draft_id;
        form.querySelector('#edit-draft-title').value = draft.title;
        form.querySelector('#edit-draft-content').value = draft.content;
        
        // 控制刪除按鈕的顯示
        deleteBtn.style.display = 'inline-block';
        deleteBtn.dataset.draftId = draftId;
    } else {
        modalTitle.textContent = '新增訊息草稿';
        deleteBtn.style.display = 'none'; // 新增時隱藏
    }

    ui.showModal('#edit-draft-modal');
}

/**
 * 處理草稿表單的提交 (新增或更新)
 * @param {Event} event - 表單提交事件
 */
async function handleDraftFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const draftId = form.querySelector('#edit-draft-id').value;
    const button = form.querySelector('button[type="submit"]');

    const data = {
        draft_id: draftId ? parseInt(draftId, 10) : undefined,
        title: form.querySelector('#edit-draft-title').value.trim(),
        content: form.querySelector('#edit-draft-content').value.trim(),
    };

    button.disabled = true;
    button.textContent = '儲存中...';

    try {
        if (data.draft_id) { // 更新
            await api.updateMessageDraft(data);
            ui.toast.success('草稿更新成功！');
        } else { // 新增
            await api.createMessageDraft(data);
            ui.toast.success('草稿新增成功！');
        }
        ui.hideModal('#edit-draft-modal');
        await init(); // 重新載入列表
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '儲存草稿';
    }
}

/**
 * 處理刪除草稿的事件
 */
async function handleDeleteDraft() {
    const draftId = parseInt(this.dataset.draftId, 10);
    if (!draftId) return;

    const confirmed = await ui.confirm('您確定要永久刪除這份草稿嗎？');
    if (!confirmed) return;

    try {
        await api.deleteMessageDraft(draftId);
        ui.toast.success('草稿已刪除！');
        ui.hideModal('#edit-draft-modal');
        await init();
    } catch (error) {
        ui.toast.error(`刪除失敗: ${error.message}`);
    }
}

/**
 * 綁定此頁面所有需要一次性設定的事件監聽器
 */
function setupEventListeners() {
    const page = document.getElementById('page-drafts');
    if (page.dataset.initialized) return;

    document.getElementById('add-draft-btn').addEventListener('click', () => openEditDraftModal());

    document.getElementById('draft-list-tbody').addEventListener('click', (event) => {
        const editBtn = event.target.closest('.btn-edit-draft');
        if (editBtn) {
            const draftId = parseInt(editBtn.dataset.draftId, 10);
            openEditDraftModal(draftId);
        }
    });

    document.getElementById('edit-draft-form').addEventListener('submit', handleDraftFormSubmit);
    document.getElementById('delete-draft-btn').addEventListener('click', handleDeleteDraft); // 綁定刪除事件

    page.dataset.initialized = 'true';
}


/**
 * 模組的初始化函式
 */
export const init = async () => {
    const page = document.getElementById('page-drafts');
    const tbody = document.getElementById('draft-list-tbody');
    if (!page || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="3">正在載入訊息草稿...</td></tr>';

    try {
        allDrafts = await api.getMessageDrafts();
        renderDraftsList(allDrafts);
        setupEventListeners();
    } catch (error) {
        console.error('載入訊息草稿失敗:', error);
        tbody.innerHTML = `<tr><td colspan="3" style="color:red;">載入失敗: ${error.message}</td></tr>`;
    }
};