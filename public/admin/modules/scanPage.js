// public/admin/modules/scanPage.js
// 「掃碼加點」分頁：把不常用的經驗紀錄查詢併入掃碼加點同一個分頁，各自邏輯沿用原本的模組。
import { init as initScan } from './scanAndPoint.js';
import { init as initExpHistory } from './expHistory.js';

export const init = async (context, param) => {
    await initScan(context, param);
    await initExpHistory();
};
