// public/admin/modules/membershipSettings.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allAssets = [];
let currentType = 'class';

// 這裡定義了所有分類，共用同一套邏輯
const typeLabels = {
    'class': { label: '職業', desc: '預設福利' },
    'skill': { label: '技能', desc: '技能說明' },
    'equipment': { label: '裝備', desc: '裝備效果' },
    'title': { label: '稱號', desc: '稱號說明' },
    'achievement': { label: '成就', desc: '達成條件說明' }
};

function renderList() {
    const tbody = document.getElementById('assets-list-tbody');
    const filtered = allAssets.filter(a => a.type === currentType);
    
    document.getElementById('asset-desc-header').textContent = typeLabels[currentType].desc;
    
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">尚無資料。</td></tr>'; // 確保這裡跨 4 欄
        return;
    }

    filtered.forEach(asset => {
        const row = tbody.insertRow();
        
        // 判斷並生成圖片的 HTML
        const iconHtml = asset.icon_url 
            ? `<img src="${asset.icon_url}" style="max-height: 1.5em; vertical-align: middle; border-radius: 4px;">` 
            : '-';

        // 確保這裡嚴格輸出 4 個 <td>，對應表頭的 4 個欄位
        row.innerHTML = `
            <td style="text-align: center;">${iconHtml}</td>
            <td>${asset.name}</td>
            <td>${asset.description || '-'}</td>
            <td><button class="action-btn btn-edit-asset" data-id="${asset.id}" style="background-color: var(--warning-color); color: #000;">編輯</button></td>
        `;
    });
}

function openEditModal(assetId = null) {
    const form = document.getElementById('edit-asset-form');
    form.reset();
    
    const typeInfo = typeLabels[currentType];
    document.getElementById('modal-asset-title').textContent = assetId ? '編輯項目' : `新增${typeInfo.label}`;
    document.getElementById('edit-asset-type').value = currentType;
    document.getElementById('edit-asset-desc-label').textContent = typeInfo.desc;
    
    const deleteBtn = document.getElementById('delete-asset-btn');
    
    if (assetId) {
        const asset = allAssets.find(a => a.id == assetId);
        document.getElementById('edit-asset-id').value = asset.id;
        document.getElementById('edit-asset-name').value = asset.name;
        document.getElementById('edit-asset-desc').value = asset.description;
        
        // 編輯時，將圖片網址帶入輸入框
        document.getElementById('edit-asset-icon').value = asset.icon_url || '';
        
        deleteBtn.style.display = 'inline-block';
        deleteBtn.onclick = () => handleDelete(asset.id);
    } else {
        document.getElementById('edit-asset-id').value = '';
        document.getElementById('edit-asset-icon').value = ''; // 新增時清空輸入框
        deleteBtn.style.display = 'none';
    }
    
    ui.showModal('#edit-asset-modal');
}

async function handleSave(e) {
    e.preventDefault();
    const data = {
        id: document.getElementById('edit-asset-id').value,
        type: document.getElementById('edit-asset-type').value,
        name: document.getElementById('edit-asset-name').value,
        description: document.getElementById('edit-asset-desc').value,
        icon_url: document.getElementById('edit-asset-icon').value // 儲存時收集圖片網址
    };
    
    try {
        await api.saveGameAsset(data);
        ui.toast.success('儲存成功');
        ui.hideModal('#edit-asset-modal');
        await init();
    } catch (error) {
        ui.toast.error(error.message);
    }
}

async function handleDelete(id) {
    if (!await ui.confirm('確定要刪除此項目嗎？')) return;
    try {
        await api.deleteGameAsset(id);
        ui.toast.success('已刪除');
        ui.hideModal('#edit-asset-modal');
        await init();
    } catch (error) {
        ui.toast.error(error.message);
    }
}

export const init = async () => {
    try {
        allAssets = await api.getGameAssets();
        
        const filterContainer = document.getElementById('assets-type-filter');
        if (!filterContainer.dataset.bound) {
            filterContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    filterContainer.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    currentType = e.target.dataset.type; // 切換分類
                    renderList(); // 重新渲染列表
                }
            });
            document.getElementById('btn-add-asset').addEventListener('click', () => openEditModal());
            document.getElementById('edit-asset-form').addEventListener('submit', handleSave);
            
            document.getElementById('assets-list-tbody').addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-edit-asset')) {
                    openEditModal(e.target.dataset.id);
                }
            });
            filterContainer.dataset.bound = 'true';
        }
        
        renderList();
    } catch (error) {
        console.error(error);
        ui.toast.error('載入設定失敗');
    }
};