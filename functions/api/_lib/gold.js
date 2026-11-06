// functions/api/_lib/gold.js
// 「一袋金幣」這個裝備（GameAssets.id = 17）是目前會員最常用的功能：
// 升級時自動加值、使用時手動扣除。正確金額一律以 UserAssets.gold_balance 為準。
// custom_description 只是給人看的顯示文字（維持原本「怎麼用、能折抵什麼」的說明），
// 每次金額變動都會把文字裡「第一個數字」換成新金額，其餘文字不會被改動。
// 後台「編輯使用者」整批重寫 UserAssets 時不會帶 gold_balance（會變回 NULL），
// 所以這裡的讀取一律走 resolveGoldAmount 的 fallback：抓不到欄位就從敘述文字裡的數字還原，
// 下次異動時會自動把 gold_balance 補回去，不用額外做資料搬移。
export const GOLD_ASSET_ID = 17;
export const GOLD_TOPUP_PER_LEVEL = 100;
export const GOLD_SPEND_PER_USE = 100;

export function extractGoldAmount(text) {
    if (!text) return null;
    const match = String(text).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

export function buildGoldDescription(templateText, amount) {
    if (!templateText || !/\d+/.test(templateText)) {
        return `內有 ${amount} 元金幣`;
    }
    return templateText.replace(/\d+/, String(amount));
}

async function getGoldRow(db, userId) {
    return db.prepare(`
        SELECT ua.id, ua.custom_description, ua.gold_balance, ga.description as default_desc
        FROM UserAssets ua
        JOIN GameAssets ga ON ua.asset_id = ga.id
        WHERE ua.user_id = ? AND ua.asset_id = ?
    `).bind(userId, GOLD_ASSET_ID).first();
}

// gold_balance 欄位是空的時候（舊資料、或剛被後台「編輯使用者」整批重寫過），
// 從敘述文字裡的數字還原金額；get-users.js 的顧客列表也是用這個函式算出要不要顯示「使用金幣」按鈕
export function resolveGoldAmount(row) {
    if (row.gold_balance !== null && row.gold_balance !== undefined) return row.gold_balance;
    return extractGoldAmount(row.custom_description) ?? extractGoldAmount(row.default_desc) ?? 0;
}

// 查詢某會員目前的金幣餘額；沒有這個裝備就回傳 null
export async function getGoldBalance(db, userId) {
    const row = await getGoldRow(db, userId);
    if (!row) return null;
    return resolveGoldAmount(row);
}

// 升級自動加值：回傳要併入同一個 db.batch() 的操作陣列；沒有這個裝備就回傳空陣列，不影響原本升級流程
export async function buildGoldLevelUpOps(db, userId, levelsGained) {
    if (!levelsGained || levelsGained <= 0) return [];
    const row = await getGoldRow(db, userId);
    if (!row) return [];

    const currentAmount = resolveGoldAmount(row);
    const addAmount = GOLD_TOPUP_PER_LEVEL * levelsGained;
    const newAmount = currentAmount + addAmount;
    const newDesc = buildGoldDescription(row.custom_description || row.default_desc, newAmount);

    return [
        db.prepare('UPDATE UserAssets SET gold_balance = ?, custom_description = ? WHERE id = ?')
            .bind(newAmount, newDesc, row.id),
        db.prepare('INSERT INTO GoldLedger (user_id, asset_id, change_amount, balance_after, reason) VALUES (?, ?, ?, ?, ?)')
            .bind(userId, GOLD_ASSET_ID, addAmount, newAmount, `升級 ${levelsGained} 級，自動加值`),
    ];
}

// 後台手動使用金幣：固定扣 GOLD_SPEND_PER_USE 元（不開放自訂金額），
// 驗證餘額足夠後回傳要併入 db.batch() 的操作陣列；餘額不足就丟出 Error 給呼叫端轉成 400
export async function buildGoldSpendOps(db, userId, reason) {
    const row = await getGoldRow(db, userId);
    if (!row) throw new Error('此會員沒有「一袋金幣」這項裝備。');

    const currentAmount = resolveGoldAmount(row);
    if (GOLD_SPEND_PER_USE > currentAmount) {
        throw new Error(`金幣不足，目前剩餘 ${currentAmount} 元。`);
    }
    const newAmount = currentAmount - GOLD_SPEND_PER_USE;
    const newDesc = buildGoldDescription(row.custom_description || row.default_desc, newAmount);

    return {
        newAmount,
        ops: [
            db.prepare('UPDATE UserAssets SET gold_balance = ?, custom_description = ? WHERE id = ?')
                .bind(newAmount, newDesc, row.id),
            db.prepare('INSERT INTO GoldLedger (user_id, asset_id, change_amount, balance_after, reason) VALUES (?, ?, ?, ?, ?)')
                .bind(userId, GOLD_ASSET_ID, -GOLD_SPEND_PER_USE, newAmount, reason || '使用金幣'),
        ],
    };
}
