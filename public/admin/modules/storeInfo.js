// public/admin/modules/storeInfo.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let storeInfoForm;

/**
 * 將從 API 獲取的店家資訊填充到表單中
 * @param {object} info - 店家資訊物件
 */
function populateStoreInfoForm(info) {
    if (!storeInfoForm) return;

    // --- 基礎資訊 ---
    storeInfoForm.querySelector('#info-address').value = info.address || '';
    storeInfoForm.querySelector('#info-phone').value = info.phone || '';
    storeInfoForm.querySelector('#info-hours').value = info.opening_hours || '';
    storeInfoForm.querySelector('#info-desc').value = info.description || '';
    
    // --- 預約頁面文字設定 ---
    storeInfoForm.querySelector('#info-booking-announcement').value = info.booking_announcement_text || '';
    storeInfoForm.querySelector('#info-booking-button').value = info.booking_button_text || '';
    storeInfoForm.querySelector('#info-booking-promo').value = info.booking_promo_text || '';
    
    // 【修正】已移除對 info-notify-user-id 的操作
}

/**
 * 處理表單提交事件，將更新後的資訊傳送至 API
 * @param {Event} event - 表單提交事件
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    const button = storeInfoForm.querySelector('button[type="submit"]');

    const data = {
        address: storeInfoForm.querySelector('#info-address').value,
        phone: storeInfoForm.querySelector('#info-phone').value,
        opening_hours: storeInfoForm.querySelector('#info-hours').value,
        description: storeInfoForm.querySelector('#info-desc').value,
        booking_announcement_text: storeInfoForm.querySelector('#info-booking-announcement').value,
        booking_button_text: storeInfoForm.querySelector('#info-booking-button').value,
        booking_promo_text: storeInfoForm.querySelector('#info-booking-promo').value,
        // 【修正】已移除 booking_notify_user_id
    };

    button.textContent = '儲存中...';
    button.disabled = true;

    try {
        await api.updateStoreInfo(data);
        ui.toast.success('店家資訊已成功更新！');
    } catch (error) {
        ui.toast.error(`更新失敗: ${error.message}`);
    } finally {
        button.textContent = '儲存變更';
        button.disabled = false;
    }
}

/**
 * 綁定此頁面所有需要一次性設定的事件監聽器
 */
function setupEventListeners() {
    if (storeInfoForm.dataset.initialized) return;

    storeInfoForm.addEventListener('submit', handleFormSubmit);

    storeInfoForm.dataset.initialized = 'true';
}

/**
 * 模組的初始化函式
 */
export const init = async () => {
    const page = document.getElementById('page-store-info');
    storeInfoForm = document.getElementById('store-info-form');
    if (!page || !storeInfoForm) return;

    try {
        const info = await api.getStoreInfo();
        populateStoreInfoForm(info);
        setupEventListeners();
    } catch (error) {
        console.error('載入店家資訊失敗:', error);
        page.innerHTML = `<p style="color:red;">載入店家資訊失敗: ${error.message}</p>`;
    }
};