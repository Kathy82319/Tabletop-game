// public/admin/modules/miscSettings.js
// 「其他設定」分頁：情報管理、訊息草稿、店家資訊、記分板紀錄用子分頁切換，
// 各自的邏輯完全沿用原本的模組，這裡只是依序初始化它們。
import { init as initNews } from './newsManagement.js';
import { init as initDrafts } from './draftsManagement.js';
import { init as initStoreInfo } from './storeInfo.js';
import { init as initScoreboards } from './scoreboardManagement.js';

function setupSubTabs() {
    const page = document.getElementById('page-misc');
    if (!page || page.dataset.subTabsInitialized) return;
    page.dataset.subTabsInitialized = 'true';

    const subTabs = page.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(btn => {
        btn.onclick = () => {
            subTabs.forEach(b => b.classList.remove('active'));
            page.querySelectorAll('.sub-view-container').forEach(div => div.style.display = 'none');
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).style.display = 'block';
        };
    });
}

export const init = async (context, param) => {
    setupSubTabs();
    await initNews(context, param);
    await initDrafts(context, param);
    await initStoreInfo(context, param);
    await initScoreboards();
};
