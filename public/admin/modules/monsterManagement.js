// public/admin/modules/monsterManagement.js
// 「公會討伐戰」怪物設定：名稱／圖片／血量
import { api } from '../api.js';
import { ui } from '../ui.js';

function setupForm() {
    const form = document.getElementById('monster-state-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = '儲存中...';

        const data = {
            name: document.getElementById('monster-name-input').value.trim(),
            image_url: document.getElementById('monster-image-input').value.trim(),
            max_hp: document.getElementById('monster-max-hp-input').value,
            current_hp: document.getElementById('monster-current-hp-input').value,
        };

        try {
            await api.saveMonsterState(data);
            ui.toast.success('已儲存怪物設定');
        } catch (error) {
            ui.toast.error(`儲存失敗: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = '儲存';
        }
    });
}

export const init = async () => {
    const form = document.getElementById('monster-state-form');
    if (!form) return;

    setupForm();

    try {
        const monster = await api.getMonsterState();
        if (monster) {
            document.getElementById('monster-name-input').value = monster.name || '';
            document.getElementById('monster-image-input').value = monster.image_url || '';
            document.getElementById('monster-max-hp-input').value = monster.max_hp;
            document.getElementById('monster-current-hp-input').value = monster.current_hp;

            const preview = document.getElementById('prev-monster-image');
            if (preview) {
                if (monster.image_url) { preview.src = monster.image_url; preview.style.display = 'block'; }
                else { preview.style.display = 'none'; }
            }
        }
    } catch (error) {
        ui.toast.error(`載入怪物設定失敗: ${error.message}`);
    }
};
