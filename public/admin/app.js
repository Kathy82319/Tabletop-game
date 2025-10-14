// public/admin/app.js (完整更新版)
import { ui } from './ui.js';

const App = {
    // 模組的實例快取
    modules: {},

    router: {
        'dashboard': './modules/dashboard.js',
        'users': './modules/userManagement.js',
        'inventory': './modules/inventoryManagement.js',
        'rentals': './modules/rentalManagement.js',
        'bookings': './modules/bookingManagement.js',
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
                if (!this.modules[pageId]) {
                    this.modules[pageId] = await import(modulePath);
                }
                const pageModule = this.modules[pageId];

                if (pageModule.init) {
                    // 【關鍵點】建立一個 context 物件，用於模組間通訊
                    const context = {
                        openCreateRentalModal: (gameId) => {
                            if (this.modules.rentals && this.modules.rentals.openCreateRentalModal) {
                                this.modules.rentals.openCreateRentalModal(gameId);
                            } else {
                                ui.toast.error("無法開啟租借視窗，請先切換到租借管理頁面一次。");
                            }
                        }
                    };
                    // 將 context 傳遞給 init 函式
                    await pageModule.init(context);
                }
            } catch (error) {
                console.error(`載入模組 ${modulePath} 失敗:`, error);
                document.getElementById(`page-${pageId}`).innerHTML = `<p style="color:red;">載入頁面功能時發生錯誤。</p>`;
            }
        }
    },

    init() {
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
        
        // 預先載入租借模組，確保 openCreateRentalModal 函式可用
        import('./modules/rentalManagement.js').then(module => {
            this.modules.rentals = module;
        });

        this.handleRouteChange();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());