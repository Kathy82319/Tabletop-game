// Cloudflare Workers 執行環境固定用 UTC，但本專案的 deadline / event_date 等欄位
// 存的都是「台灣當地時間」的原始字串（使用者在台灣填的日期時間，沒有時區資訊）。
// 若直接用 new Date().toISOString()（UTC）跟這些欄位比較，會有 8 小時的時差誤差，
// 導致揪團明明已經過了台灣時間的截止時間，後端卻要再等 8 小時才判定為過期。
// 所以凡是要跟 deadline 這類欄位比較「現在幾點」，都要用這支函式换算成台灣時間字串。
export function nowTaiwanString() {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
}
