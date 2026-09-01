// public/admin/modules/miscSettings.js
// 「其他設定」分頁：把不常用的情報管理、訊息草稿、店家資訊、記分板紀錄併在同一個分頁裡，
// 各自的邏輯完全沿用原本的模組，這裡只是依序初始化它們。
import { init as initNews } from './newsManagement.js';
import { init as initDrafts } from './draftsManagement.js';
import { init as initStoreInfo } from './storeInfo.js';
import { init as initScoreboards } from './scoreboardManagement.js';

export const init = async (context, param) => {
    await initNews(context, param);
    await initDrafts(context, param);
    await initStoreInfo(context, param);
    await initScoreboards();
};
