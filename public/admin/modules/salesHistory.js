// public/admin/modules/salesHistory.js
import { api } from '../api.js';

let allOrders = [];
let filteredOrders = [];
const expandedOrders = new Set();

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDiscount(discount) {
    const tenths = Math.round(Number(discount) * 10);
    return tenths >= 10 ? '未打折' : `${tenths} 折`;
}

function renderOrderDetail(order) {
    const rows = order.items.map(item => `
        <tr>
            <td style="text-align:left;">${escapeHtml(item.game_name || '（遊戲資料遺失）')}</td>
            <td>${item.quantity}</td>
            <td>$${item.unit_price}</td>
            <td>${formatDiscount(item.discount)}</td>
            <td>$${item.total_price}</td>
        </tr>
    `).join('');

    return `
        <tr class="sales-detail-row" data-order-id="${order.order_id}">
            <td colspan="6" style="background:var(--bg-light, #f7f7f7); padding: 10px 16px;">
                <table style="width:100%;">
                    <thead>
                        <tr>
                            <th style="text-align:left;">商品</th>
                            <th>數量</th>
                            <th>原價</th>
                            <th>折數</th>
                            <th>小計</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </td>
        </tr>
    `;
}

function renderSalesHistory(list) {
    const tbody = document.getElementById('sales-history-tbody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">沒有符合條件的紀錄。</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(order => {
        const expanded = expandedOrders.has(order.order_id);
        const mainRow = `
            <tr>
                <td>#${order.order_id}</td>
                <td>${new Date(order.created_at).toLocaleString()}</td>
                <td>${order.items.length}</td>
                <td>$${order.total_amount}</td>
                <td>
                    <button class="action-btn btn-toggle-sales-detail" data-order-id="${order.order_id}"
                        style="background:var(--info-color, #17a2b8); color:#fff; padding:4px 10px;">
                        ${expanded ? '收合' : '展開'}
                    </button>
                </td>
                <td>
                    <button class="action-btn btn-delete-sales-order" data-order-id="${order.order_id}"
                        style="background:var(--danger-color); color:#fff; padding:4px 10px;">刪除</button>
                </td>
            </tr>
        `;
        return mainRow + (expanded ? renderOrderDetail(order) : '');
    }).join('');
}

function applyFilterAndRender() {
    const term = document.getElementById('sales-search-input').value.toLowerCase().trim();
    const dateStart = document.getElementById('sales-date-start').value;
    const dateEnd = document.getElementById('sales-date-end').value;

    filteredOrders = allOrders.filter(order => {
        if (term && !order.items.some(item => (item.game_name || '').toLowerCase().includes(term))) return false;
        if (dateStart && new Date(order.created_at) < new Date(dateStart)) return false;
        if (dateEnd) {
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            if (new Date(order.created_at) > end) return false;
        }
        return true;
    });

    renderSalesHistory(filteredOrders);
}

function clearFilters() {
    document.getElementById('sales-search-input').value = '';
    document.getElementById('sales-date-start').value = '';
    document.getElementById('sales-date-end').value = '';
    filteredOrders = [...allOrders];
    renderSalesHistory(filteredOrders);
}

async function handleDeleteOrder(orderId) {
    if (!confirm(`確定要刪除訂單 #${orderId} 嗎？\n刪除後這筆訂單會消失，對應賣出的商品庫存會自動加回來。`)) return;
    try {
        await api.deleteSalesOrder(orderId);
        expandedOrders.delete(orderId);
        allOrders = allOrders.filter(o => o.order_id !== orderId);
        applyFilterAndRender();
    } catch (e) {
        alert(`刪除失敗：${e.message}`);
    }
}

function setupEventListeners() {
    const page = document.getElementById('page-sales-history');
    if (page.dataset.initialized) return;

    document.getElementById('sales-search-input').addEventListener('input', applyFilterAndRender);
    document.getElementById('sales-date-start').addEventListener('change', applyFilterAndRender);
    document.getElementById('sales-date-end').addEventListener('change', applyFilterAndRender);
    document.getElementById('sales-clear-filter-btn').addEventListener('click', clearFilters);

    document.getElementById('sales-history-tbody').addEventListener('click', e => {
        const toggleBtn = e.target.closest('.btn-toggle-sales-detail');
        if (toggleBtn) {
            const orderId = Number(toggleBtn.dataset.orderId);
            if (expandedOrders.has(orderId)) {
                expandedOrders.delete(orderId);
            } else {
                expandedOrders.add(orderId);
            }
            renderSalesHistory(filteredOrders);
            return;
        }

        const deleteBtn = e.target.closest('.btn-delete-sales-order');
        if (deleteBtn) {
            handleDeleteOrder(Number(deleteBtn.dataset.orderId));
        }
    });

    page.dataset.initialized = 'true';
}

export const init = async () => {
    const tbody = document.getElementById('sales-history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6">正在載入販售紀錄...</td></tr>';
    try {
        allOrders = await api.getSalesOrders();
        filteredOrders = [...allOrders];
        renderSalesHistory(filteredOrders);
        setupEventListeners();
    } catch (e) {
        console.error('載入販售紀錄失敗:', e);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;">載入失敗: ${e.message}</td></tr>`;
    }
};
