// public/admin/modules/monsterManagement.js
// 「公會討伐戰」怪物設定：怪物池裡固定兩隻怪物（插槽 1、2），打死後自動換另一隻上場交錯輪流；
// 這裡也可以微調「目前上場中」那隻的血量（除錯/調整平衡用）。
import { api } from '../api.js';
import { ui } from '../ui.js';

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

function renderActiveBadge(activeSlot) {
    const badge1 = document.getElementById('monster-slot1-badge');
    const badge2 = document.getElementById('monster-slot2-badge');
    if (badge1) badge1.style.display = activeSlot === 1 ? 'inline-block' : 'none';
    if (badge2) badge2.style.display = activeSlot === 2 ? 'inline-block' : 'none';
}

function fillTemplateForm(slot, template) {
    const t = template || { name: '', image_url: '', max_hp: 100 };
    document.getElementById(`monster-slot${slot}-name-input`).value = t.name || '';
    document.getElementById(`monster-slot${slot}-image-input`).value = t.image_url || '';
    document.getElementById(`monster-slot${slot}-maxhp-input`).value = t.max_hp || 100;
    setPreview(`prev-monster-slot${slot}-image`, t.image_url);
}

async function loadAll() {
    const [monster, templateData] = await Promise.all([
        api.getMonsterState(),
        api.getMonsterTemplates(),
    ]);

    renderActiveStatus(monster);
    renderActiveBadge(templateData.activeSlot);

    const templates = templateData.templates || [];
    fillTemplateForm(1, templates.find(t => t.slot === 1));
    fillTemplateForm(2, templates.find(t => t.slot === 2));
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

function setupTemplatesForm() {
    const form = document.getElementById('monster-templates-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = '儲存中...';

        const templates = [1, 2].map(slot => ({
            slot,
            name: document.getElementById(`monster-slot${slot}-name-input`).value.trim(),
            image_url: document.getElementById(`monster-slot${slot}-image-input`).value.trim(),
            max_hp: document.getElementById(`monster-slot${slot}-maxhp-input`).value,
        }));

        try {
            await api.saveMonsterTemplates({ templates });
            ui.toast.success('已儲存怪物池');
            await loadAll();
        } catch (error) {
            ui.toast.error(`儲存失敗: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = '儲存怪物池';
        }
    });
}

export const init = async () => {
    const page = document.getElementById('view-misc-monster');
    if (!page) return;

    setupHpForm();
    setupTemplatesForm();

    try {
        await loadAll();
    } catch (error) {
        ui.toast.error(`載入怪物設定失敗: ${error.message}`);
    }
};
