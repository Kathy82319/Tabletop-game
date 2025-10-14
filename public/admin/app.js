// public/admin/app.js (完整更新版)
import { ui } from './ui.js';
// 【關鍵修改】從 rentalManagement 模組中引入初始化函式
import { initializeCreateRentalModalEventListeners } from './modules/rentalManagement.js';

const App = {
    modules: {},

    router: {
        'dashboard': './modules/dashboard.js',
        'users': './modules/userManagement.js',
        'inventory': './modules/inventoryManagement.js',
        'rentals': './modules/rentalManagement.js',
        'bookings': './modules/bookingManagement.js',
        'exp-history': './modules/expHistory.js',
        'news': './modules/newsManagement.js', 
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
                    const context = {
                        openCreateRentalModal: (gameId) => {
                            if (this.modules.rentals && this.modules.rentals.openCreateRentalModal) {
                                this.modules.rentals.openCreateRentalModal(gameId);
                            } else {
                                ui.toast.error("租借模組載入失敗，無法開啟視窗。");
                            }
                        }
                    };
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
        
        // 【關鍵修改】在應用程式啟動時，就為建立租借視窗綁定好所有事件
        initializeCreateRentalModalEventListeners();
        
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
        
        import('./modules/rentalManagement.js').then(module => {
            this.modules.rentals = module;
        });

        this.handleRouteChange();
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());