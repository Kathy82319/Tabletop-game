// public/admin/app.js

import { ui } from './ui.js';

const App = {
    router: {
        'dashboard': './modules/dashboard.js',
        'users': './modules/userManagement.js',
        'inventory': './modules/inventoryManagement.js',
        'rentals': './modules/rentalManagement.js', 
        'bookings': './modules/bookingManagement.js',
        'exp-history': './modules/expHistory.js',
        'news': './modules/newsManagement.js',
        'drafts': './modules/draftsManagement.js',
        'store-info': './modules/storeInfo.js',
        'scan': './modules/scanAndPoint.js',
    },

    async handleRouteChange() {
        const pageId = window.location.hash.substring(1) || 'dashboard';
        
        ui.setActiveNav(pageId);
        ui.showPage(pageId);

        const modulePath = this.router[pageId];
        if (modulePath) {
            try {
                const pageModule = await import(modulePath);
                if (pageModule.init) {
                    await pageModule.init();
                }
            } catch (error) {
                console.error(`載入模組 ${modulePath} 失敗:`, error);
                document.getElementById(`page-${pageId}`).innerHTML = `<p style="color:red;">載入頁面功能時發生錯誤。</p>`;
            }
        }
    },

    init() {
        // 顯示後台面板 (我們簡化了登入流程)
        const adminPanel = document.getElementById('admin-panel');
        if(adminPanel) adminPanel.style.display = 'block';

        ui.initSharedEventListeners();
        
        window.addEventListener('hashchange', () => this.handleRouteChange());
        
        document.querySelector('.nav-tabs').addEventListener('click', (event) => {
            if (event.target.tagName === 'A') {
                event.preventDefault();
                const newHash = event.target.getAttribute('href');
                if (window.location.hash !== newHash) {
                    window.location.hash = newHash;
                }
            }
        });

        this.handleRouteChange();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());