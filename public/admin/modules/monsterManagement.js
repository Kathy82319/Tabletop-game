// public/admin/modules/monsterManagement.js
// 「公會討伐戰」怪物池：可以自由新增／編輯／刪除任意數量的怪物，依序輪流上場；
// 這裡也可以微調「目前上場中」那隻的血量（除錯/調整平衡用）。
import { api } from '../api.js';
import { ui } from '../ui.js';

let templates = [];

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setPreview(imgId, url) {
    const img = document.getElementById(imgId);
    if (!img) return;
    if (url) { img.src = url; img.style.display = 'block'; }
    else { img.style.display = 'none'; }
}

function renderActiveStatus(monster) {
    const nameEl = document.getElementById('monster-active-name');
    const hpTextEl = document.getElementById('monster-active-hp-text');
    const hpInput = document.getElementById('monster-current-hp-input');

    if (!monster) {
        nameEl.textContent = '尚無上場中的怪物';
        hpTextEl.textContent = '-- / --';
        hpInput.value = '';
        setPreview('monster-active-image', '');
        return;
    }

    nameEl.textContent = monster.name;
    hpTextEl.textContent = `${monster.current_hp} / ${monster.max_hp}`;
    hpInput.value = monster.current_hp;
    hpInput.max = monster.max_hp;
    setPreview('monster-active-image', monster.image_url);
}

function renderTemplatesTable(activeTemplateId) {
    const tbody = document.getElementById('monster-templates-tbody');
    if (!tbody) return;

    if (templates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">怪物池是空的，點右上角「＋ 新增怪物」開始新增。</td></tr>';
        return;
    }

    tbody.innerHTML = templates.map(t => {
        const iconHtml = t.image_url
            ? `<img src="${t.image_url}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;">`
            : '-';
        const badge = t.id === activeTemplateId
            ? ' <span style="font-size:0.75rem; color:#fff; background:var(--success-color,#2ecc71); padding:2px 8px; border-radius:10px;">目前上場中</span>'
            : '';
        return `
            <tr>
                <td style="text-align:center;">${iconHtml}</td>
                <td style="text-align:left;">${escapeHtml(t.name)}${badge}</td>
                <td>${t.max_hp}</td>
                <td><button type="button" class="action-btn btn-edit-monster-template" data-id="${t.id}" style="background-color: var(--warning-color); color: #000;">編輯</button></td>
            </tr>`;
    }).join('');
}

async function loadAll() {
    const [monster, templateData] = await Promise.all([
        api.getMonsterState(),
        api.getMonsterTemplates(),
    ]);

    renderActiveStatus(monster);

    templates = templateData.templates || [];
    renderTemplatesTable(templateData.activeTemplateId);
}

function setupHpForm() {
    const form = document.getElementById('monster-hp-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const current_hp = document.getElementById('monster-current-hp-input').value;
            await api.saveMonsterState({ current_hp });
            ui.toast.success('已更新目前血量');
            await loadAll();
        } catch (error) {
            ui.toast.error(`儲存失敗: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    });
}

function openEditModal(templateId = null) {
    const form = document.getElementById('edit-monster-template-form');
    form.reset();

    const deleteBtn = document.getElementById('delete-monster-template-btn');
    const prevImg = document.getElementById('prev-monster-template-image');

    if (templateId) {
        const t = templates.find(t => t.id === templateId);
        document.getElementById('modal-monster-template-title').textContent = '編輯怪物';
        document.getElementById('edit-monster-template-id').value = t.id;
        document.getElementById('edit-monster-template-name').value = t.name;
        document.getElementById('edit-monster-template-image').value = t.image_url || '';
        document.getElementById('edit-monster-template-maxhp').value = t.max_hp;
        setPreview('prev-monster-template-image', t.image_url);
        deleteBtn.style.display = 'inline-block';
        deleteBtn.onclick = () => handleDelete(t.id);
    } else {
        document.getElementById('modal-monster-template-title').textContent = '新增怪物';
        document.getElementById('edit-monster-template-id').value = '';
        if (prevImg) prevImg.style.display = 'none';
        deleteBtn.style.display = 'none';
    }

    ui.showModal('#edit-monster-template-modal');
}

async function handleDelete(id) {
    if (!await ui.confirm('確定要把這隻怪物從怪物池移除嗎？')) return;
    try {
        await api.deleteMonsterTemplate(id);
        ui.toast.success('已刪除');
        ui.hideModal('#edit-monster-template-modal');
        await loadAll();
    } catch (error) {
        ui.toast.error(`刪除失敗: ${error.message}`);
    }
}

async function handleSave(e) {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;

    const data = {
        id: document.getElementById('edit-monster-template-id').value || undefined,
        name: document.getElementById('edit-monster-template-name').value.trim(),
        image_url: document.getElementById('edit-monster-template-image').value.trim(),
        max_hp: document.getElementById('edit-monster-template-maxhp').value,
    };

    try {
        await api.saveMonsterTemplate(data);
        ui.toast.success('已儲存');
        ui.hideModal('#edit-monster-template-modal');
        await loadAll();
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        button.disabled = false;
    }
}

function setupEventListeners() {
    const page = document.getElementById('view-misc-monster');
    if (!page || page.dataset.initialized) return;
    page.dataset.initialized = 'true';

    document.getElementById('btn-add-monster-template').addEventListener('click', () => openEditModal());

    document.getElementById('monster-templates-tbody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit-monster-template');
        if (btn) openEditModal(Number(btn.dataset.id));
    });

    document.getElementById('edit-monster-template-form').addEventListener('submit', handleSave);
}

export const init = async () => {
    const page = document.getElementById('view-misc-monster');
    if (!page) return;

    setupHpForm();
    setupEventListeners();

    try {
        await loadAll();
    } catch (error) {
        ui.toast.error(`載入怪物設定失敗: ${error.message}`);
    }
};
