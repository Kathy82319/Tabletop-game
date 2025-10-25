// public/admin/app.js (已更新)
import { ui } from './ui.js';
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
        'drafts': './modules/draftsManagement.js',
        'store-info': './modules/storeInfo.js',
        'scan': './modules/scanAndPoint.js',
    },

async handleRouteChange() {
        // 【修改 1】將 pageId 拆分為 pageId 和 param
        // OLD: const pageId = window.location.hash.substring(1) || 'dashboard';
        const hash = window.location.hash.substring(1) || 'dashboard';
        const [pageId, param] = hash.split('@'); // <-- NEW

        // 【修改 2】確保導覽列和頁面顯示使用的是 pageId
        ui.setActiveNav(pageId); // <-- MODIFIED
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
                    // 【修改 3】將 param 傳遞給 init 函式
                    // OLD: await pageModule.init(context);
                    await pageModule.init(context, param); // <-- NEW
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