import { api } from '../api.js';
import { ui } from '../ui.js';

let allAssets = [];
let currentType = 'class';

const typeLabels = {
    'class': { label: '職業', desc: '預設福利' },
    'skill': { label: '技能', desc: '技能說明' },
    'equipment': { label: '裝備', desc: '裝備效果' }
};

function renderList() {
    const tbody = document.getElementById('assets-list-tbody');
    const filtered = allAssets.filter(a => a.type === currentType);
    
    // 更新表頭
    document.getElementById('asset-desc-header').textContent = typeLabels[currentType].desc;
    
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
        deleteBtn.style.display = 'inline-block';
        deleteBtn.onclick = () => handleDelete(asset.id);
    } else {
        document.getElementById('edit-asset-id').value = '';
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
        description: document.getElementById('edit-asset-desc').value
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
        
        // 綁定 Tab 切換
        const filterContainer = document.getElementById('assets-type-filter');
        if (!filterContainer.dataset.bound) {
            filterContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    filterContainer.querySelector('.active').classList.remove('active');
                    e.target.classList.add('active');
                    currentType = e.target.dataset.type;
                    renderList();
                }
            });
            document.getElementById('btn-add-asset').addEventListener('click', () => openEditModal());
            document.getElementById('edit-asset-form').addEventListener('submit', handleSave);
            
            // 列表點擊編輯
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