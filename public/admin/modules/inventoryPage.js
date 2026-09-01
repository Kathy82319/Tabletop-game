// public/admin/modules/inventoryPage.js
// 「庫存管理」分頁：把不常用的販售紀錄併入庫存管理同一個分頁，各自邏輯沿用原本的模組。
import { init as initInventory } from './inventoryManagement.js';
import { init as initSalesHistory } from './salesHistory.js';

export const init = async (context, param) => {
    await initInventory(context, param);
    await initSalesHistory();
};
