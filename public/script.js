document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 核心DOM元素與全域變數
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW";
    let userProfile = null;
    let gameData = {}; 
    const appContent = document.getElementById('app-content');
    const pageTemplates = document.getElementById('page-templates');
    const tabBar = document.getElementById('tab-bar');

    const TOTAL_TABLES = 4;
    const PEOPLE_PER_TABLE = 4;
    const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];

    let myRentals = [];
    let allGames = [];
    let allNews = [];
    let activeFilters = { keyword: '', tag: null };
    let bookingData = {};
    let dailyAvailability = { limit: TOTAL_TABLES, booked: 0, available: TOTAL_TABLES };
    let disabledDatesByAdmin = [];

    // =================================================================
    // 全域事件監聽
    // =================================================================
    appContent.addEventListener('click', (event) => {
        const target = event.target;

        if (target.closest('.details-back-button, .back-button')) {
            event.preventDefault();
            history.back(); 
            return;
        }

        const fabBtn = target.closest('#fab-quiz-btn');
        if (fabBtn) {
            RecWizard.open();
            return;
        }

        const newsCard = target.closest('.news-card');
        if (newsCard && newsCard.dataset.newsId) {
            navigateTo('page-news-details', newsCard.dataset.newsId);
            return;
        }
        
        const gameCard = target.closest('.game-card');
        if (gameCard && gameCard.dataset.gameId) {
            navigateTo('page-game-details', gameCard.dataset.gameId);
            return;
        }
    });

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            navigateTo(button.dataset.target);
        }
    });


    // =================================================================
    // 頁面切換邏輯 (重構)
    // =================================================================

function handleNavigation() {
    const hash = location.hash.substring(1) || 'page-home';

    if (appContent.dataset.currentPage === hash) {
        return;
    }
    appContent.dataset.currentPage = hash;

    const [pageId, ...rest] = hash.split('@');
    const data = rest.join('@');

    const pageTemplate = pageTemplates.querySelector(`#${pageId}`);
    if (pageTemplate) {
        appContent.innerHTML = pageTemplate.innerHTML;
    } else {
        appContent.innerHTML = pageTemplates.querySelector('#page-home').innerHTML;
        initializeHomePage();
        return;
    }

    const pageInitializers = {
        'page-home': initializeHomePage,
        'page-games': initializeGamesPage,
        'page-profile': initializeProfilePage,
        'page-my-bookings': initializeMyBookingsPage,
        'page-my-exp-history': initializeMyExpHistoryPage,
        'page-rental-history': initializeRentalHistoryPage,
        'page-booking': () => initializeBookingPage(data),
        'page-info': initializeInfoPage,
        'page-edit-profile': initializeEditProfilePage,
        'page-news-details': () => initializeNewsDetailsPageFromHash(data),
        'page-game-details': () => initializeGameDetailsPageFromHash(data),
    };

    if (pageInitializers[pageId]) {
        try {
            pageInitializers[pageId]();
        } catch (e) {
            appContent.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">頁面載入時發生錯誤，請檢查主控台(F12)的詳細訊息。</p>`;
        }
    } 

    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === pageId);
    });
}

    function navigateTo(pageId, data = null) {
        let newHash = pageId;
        if (data) {
            newHash += `@${data}`;
        }
        if (location.hash !== `#${newHash}`) {
            location.hash = newHash;
        }
    }
    
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);

    // =================================================================
    // 首頁 (最新情報)
    // =================================================================
function renderNews(filterCategory = 'ALL') {
    const container = document.getElementById('news-list-container');
    if (!container) return;

    const filteredNews = (filterCategory === 'ALL')
        ? allNews
        : allNews.filter(news => news.category === filterCategory);

    if (filteredNews.length === 0) {
        container.innerHTML = '<p>這個分類目前沒有消息。</p>';
        return;
    }

    container.innerHTML = filteredNews.map(news => {
        const snippet = news.content ? news.content.substring(0, 50) + '...' : '';
        const imageHTML = news.image_url
            ? `<div class="news-card-image-container">
                   <img src="${news.image_url}" alt="${news.title}" class="news-card-image">
               </div>`
            : '';

        return `
        <div class="news-card" data-news-id="${news.id}">
            <div class="news-card-header">
                <span class="news-card-category">${news.category}</span>
                <span class="news-card-date">${news.published_date}</span>
            </div>
            <div class="news-card-content">
                <h3 class="news-card-title">${news.title}</h3>
                ${imageHTML}
                <p class="news-card-snippet">${snippet}</p>
            </div>
        </div>
        `;
    }).join('');
}

    function setupNewsFilters() {
        const container = document.getElementById('news-filter-container');
        if (!container) return;
        const categories = ['ALL', ...new Set(allNews.map(news => news.category))];
        
        container.innerHTML = categories.map(cat => 
            `<button class="news-filter-btn ${cat === 'ALL' ? 'active' : ''}" data-category="${cat}">${cat === 'ALL' ? '全部' : cat}</button>`
        ).join('');
        
        container.querySelectorAll('.news-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelector('.active').classList.remove('active');
                btn.classList.add('active');
                renderNews(btn.dataset.category);
            });
        });
    }

    async function initializeHomePage() {
        try {
            const response = await fetch('/api/get-news');
            if (!response.ok) throw new Error('無法獲取最新情報');
            allNews = await response.json();
            setupNewsFilters();
            renderNews();
        } catch (error) {
            console.error(error);
            const container = document.getElementById('news-list-container');
            if(container) container.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }
    
    function renderNewsDetails(newsItem) {
        document.getElementById('news-details-title').textContent = newsItem.title;
        document.getElementById('news-details-category').textContent = newsItem.category;
        document.getElementById('news-details-date').textContent = newsItem.published_date;
        
        const contentEl = document.getElementById('news-details-content');
        contentEl.innerHTML = newsItem.content 
            ? newsItem.content.replace(/\n/g, '<br>') 
            : '<p style="color: #888;">此消息沒有提供詳細內容。</p>';

        const imageEl = document.getElementById('news-details-image');
        if (newsItem.image_url) {
            imageEl.src = newsItem.image_url;
            imageEl.alt = newsItem.title;
            imageEl.style.display = 'block';
        } else {
            imageEl.style.display = 'none';
        }
    }

function initializeNewsDetailsPageFromHash(newsIdString) {
    const newsId = parseInt(newsIdString, 10);
    if (isNaN(newsId)) {
        appContent.innerHTML = '<p>無效的新聞 ID。</p>';
        return;
    }

    const newsItem = allNews.find(news => news.id === newsId);

    if (newsItem) {
        renderNewsDetails(newsItem);
    } else {
        appContent.innerHTML = `<p>找不到 ID 為 ${newsId} 的新聞。</p>`;
        console.warn(`在 allNews 快取中找不到 ID 為 ${newsId} 的新聞`);
    }
}


function initializeGameDetailsPageFromHash(gameIdString) {
    const gameId = gameIdString; 
    if (!gameId) {
        appContent.innerHTML = '<p>無效的遊戲 ID。</p>';
        return;
    }
    
    const game = allGames.find(g => g.game_id == gameId);

    if (game) {
        renderGameDetails(game);
    } else {
        appContent.innerHTML = `<p>找不到 ID 為 ${gameId} 的遊戲。</p>`;
        console.warn(`在 allGames 快取中找不到 ID 為 ${gameId} 的遊戲`);
    }
}    
// =================================================================
// LIFF 初始化 (更新版)
// =================================================================

    async function initializeLiff() {
        try {
            await liff.init({ liffId: myLiffId });

            if (!liff.isLoggedIn()) {
                liff.login();
                return; 
            }
            userProfile = await liff.getProfile();
            
            if (!location.hash) {
                history.replaceState({ page: 'page-home', data: null }, '', '#page-home');
            }
            
            handleNavigation(); 

        } catch (err) {
            console.error("LIFF 初始化或 Profile 獲取失敗", err);
            history.replaceState({ page: 'page-home', data: null }, '', '#page-home');
            handleNavigation();
        }
    }
    // =================================================================
    // 個人資料頁
    // =================================================================
async function initializeProfilePage() {
    if (!userProfile) return;
    const displayNameElement = document.getElementById('display-name');
    if (displayNameElement) displayNameElement.textContent = '讀取中...';
    
    const profilePicture = document.getElementById('profile-picture');
    if (userProfile.pictureUrl) profilePicture.src = userProfile.pictureUrl;

    const qrcodeElement = document.getElementById('qrcode');
    if(qrcodeElement) {
        qrcodeElement.innerHTML = ''; 
        new QRCode(qrcodeElement, { text: userProfile.userId, width: 150, height: 150 });
    }
    
        document.getElementById('edit-profile-btn').addEventListener('click', () => navigateTo('page-edit-profile'));
        document.getElementById('my-bookings-btn').addEventListener('click', () => navigateTo('page-my-bookings'));
        document.getElementById('my-exp-history-btn').addEventListener('click', () => navigateTo('page-my-exp-history'));
        document.getElementById('rental-history-btn').addEventListener('click', () => navigateTo('page-rental-history'));

liff.getProfile().then(profile => {
        userProfile = profile;
        const pictureEl = document.getElementById('profile-picture');
        if(pictureEl) pictureEl.src = profile.pictureUrl || 'placeholder.jpg';
        // 舊的按鈕預設不顯示
        const oldQrBtn = document.getElementById('toggle-qrcode-btn');
        if(oldQrBtn) oldQrBtn.style.display = 'none'; 
    });

    // 【新增/修改】綁定 QR Code Icon 點擊按鈕
    const qrIconBtn = document.getElementById('qr-icon-btn');
    const qrContainer = document.getElementById('qrcode-container');
    if (qrIconBtn && qrContainer) {
        // 清除舊事件避免重複綁定
        const newQrIconBtn = qrIconBtn.cloneNode(true);
        qrIconBtn.parentNode.replaceChild(newQrIconBtn, qrIconBtn);
        newQrIconBtn.addEventListener('click', () => {
            const isHidden = qrContainer.style.display === 'none';
            qrContainer.style.display = isHidden ? 'block' : 'none'; // 修改顯示方式為 block
            // 點擊後滾動到上方，確保 QR Code 能被看見
            if(isHidden) window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    try {
        const userData = await fetchGameData(true); 
        updateProfileDisplay(userData);
    } catch (error) {
        console.error("無法更新個人資料畫面:", error);
        if (displayNameElement) displayNameElement.textContent = '資料載入失敗';
    }
}


    async function fetchGameData(forceRefresh = false) { 
        if (!forceRefresh && gameData && gameData.user_id) return gameData;
        try {
            // 【解決方案 1：在這裡加入檢查】
            const picUrl = userProfile.pictureUrl || "https://meee.com.tw/JOqBTeG";

            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 【修改】將 userProfile.pictureUrl 改為 picUrl
                body: JSON.stringify({ userId: userProfile.userId, displayName: userProfile.displayName, pictureUrl: picUrl }),
            });
            if (!response.ok) throw new Error('無法取得會員遊戲資料');
            gameData = await response.json();
            
            return gameData;
        } catch (error) {
            console.error('呼叫會員 API 失敗:', error);
            document.getElementById('display-name').textContent = userProfile.displayName;
            return null;
        }
    }

function updateProfileDisplay(data) {
    if (!data) return;
    
    // 大頭貼圖片與職業小圈圈邏輯
    const pictureEl = document.getElementById('profile-picture');
    if (pictureEl) pictureEl.src = userProfile.pictureUrl || '/api/admin/get-avatar?userId=' + data.user_id;

    const overlayEl = document.getElementById('class-icon-overlay');
    const classIconEl = document.getElementById('user-class-icon');
    
    // 基本資料填充
    document.getElementById('display-name').textContent = data.nickname || userProfile.displayName;
    document.getElementById('user-class').textContent = data.class || "無";
    
    const perkText = data.perk && data.perk !== '無' && data.perk !== '無特殊優惠' ? `(${data.perk})` : '';
    document.getElementById('user-perk-text').textContent = perkText;
    
    document.getElementById('user-level').textContent = data.level;
    document.getElementById('user-exp').textContent = `${data.current_exp} / 10`;

    // --- 【修改】核心邏輯：直接讀取後端傳來的 class_icon_url ---
    if (data.class_icon_url && classIconEl && overlayEl) {
        classIconEl.src = data.class_icon_url; 
        overlayEl.style.display = 'block'; 
    } else if (overlayEl) {
        overlayEl.style.display = 'none'; 
    }

    // 處理多筆動態資產 (user_assets) 保持不變
    const assets = data.user_assets || [];

    // --- 【新增】核心邏輯：在 user_assets 中尋找對應的職業圖片並顯示在小圈圈中 ---
    if (assets.length > 0) {
        // 比對出真實的職業資產
        const classAsset = assets.find(a => a.type === 'class' && a.name === data.class);
        if (classAsset && classAsset.icon_url && classIconEl && overlayEl) {
            classIconEl.src = classAsset.icon_url; // 填充圖片網址
            overlayEl.style.display = 'block'; // 顯示小圈圈
        } else if(overlayEl) {
            overlayEl.style.display = 'none'; // 找不到圖片或職業不存在，則隱藏小圈圈
        }
    } else if(overlayEl) {
        overlayEl.style.display = 'none'; // 新系統沒資料，則隱藏小圈圈
    }
    
    // --- 【原有邏輯】渲染「稱號、成就」部分 保持不變 ... ---
    // 渲染帶圖示、可點擊的互動標籤 (稱號、成就)
    const renderInteractiveTags = (type) => {
        const items = assets.filter(a => a.type === type);
        if (items.length === 0) return '<span>無</span>';
        
        return items.map(a => {
            const icon = a.icon_url ? `<img src="${a.icon_url}" style="height: 1.1em; vertical-align: middle; margin-right: 3px; border-radius: 2px;">` : '';
            const desc = a.custom_description || a.default_desc || '無說明';
            // CSS 樣式：拿掉背景與邊框，文字顏色加深，保留虛線底線
            return `<span style="display: inline-block; padding: 2px 0; cursor: pointer; color: #333; text-decoration: underline dotted #999; text-underline-offset: 3px;" onclick="showAssetPopover('${a.name}', '${desc}')">${icon}${a.name}</span>`;
        }).join('<span style="color: #ccc; margin: 0 4px;">|</span>'); // 用直槓分隔
    };

    // --- 【原有邏輯】渲染「技能、裝備」部分 保持不變 ... ---
    // 渲染一般圖示標籤與條列式說明文字 (技能、裝備)
    const renderStaticTagsAndDesc = (type, tagContainerId, descContainerId) => {
        const items = assets.filter(a => a.type === type);
        const tagContainer = document.getElementById(tagContainerId);
        const descContainer = document.getElementById(descContainerId);
        
        if (items.length === 0) {
            if(tagContainer) tagContainer.innerHTML = '<span>無</span>';
            if(descContainer) descContainer.innerHTML = '無';
            return;
        }

        if(tagContainer) {
            tagContainer.innerHTML = items.map(a => {
                const icon = a.icon_url ? `<img src="${a.icon_url}" style="height: 1.1em; vertical-align: middle; margin-right: 3px; border-radius: 2px;">` : '';
                return `<span style="display: inline-block; background: #e9ecef; padding: 2px 8px; border-radius: 12px; border: 1px solid #ced4da; font-size: 0.9em;">${icon}${a.name}</span>`;
            }).join('');
        }
        
        if(descContainer) {
            // 說明排版：標題變粗體，內容不變粗體
            descContainer.innerHTML = items.map(a => {
                const desc = a.custom_description || a.default_desc || '無說明';
                return `<div style="margin-bottom: 3px;"><strong style="color: #444;">${a.name}:</strong> <span style="color: #666;">${desc}</span></div>`;
            }).join('');
        }
    };

    // --- 【原有邏輯】寫入畫面部分 保持不變 ... ---
    // 寫入畫面
    if (assets.length > 0) {
        document.getElementById('user-title').innerHTML = renderInteractiveTags('title');
        document.getElementById('user-achievement').innerHTML = renderInteractiveTags('achievement');
        renderStaticTagsAndDesc('skill', 'user-skill', 'user-skill-desc');
        renderStaticTagsAndDesc('equipment', 'user-equipment', 'user-equipment-desc');
    } else {
        // 向下相容舊版資料 保持不變
        document.getElementById('user-title').innerHTML = '<span>無</span>';
        document.getElementById('user-achievement').innerHTML = '<span>無</span>';
        document.getElementById('user-skill').innerHTML = data.skill || '無';
        document.getElementById('user-skill-desc').innerHTML = data.skill_description || '無';
        document.getElementById('user-equipment').innerHTML = data.equipment || '無';
        document.getElementById('user-equipment-desc').innerHTML = data.equipment_description || '無';
    }
}


// 【新增】開啟小小解釋欄 (Popover)
window.showAssetPopover = function(name, desc) {
    document.getElementById('asset-popover-title').textContent = name;
    document.getElementById('asset-popover-desc').textContent = desc;
    
    document.getElementById('popover-backdrop').style.display = 'block';
    document.getElementById('asset-popover').style.display = 'block';
};

// 【新增】關閉小小解釋欄 (Popover)
window.closeAssetPopover = function() {
    document.getElementById('popover-backdrop').style.display = 'none';
    document.getElementById('asset-popover').style.display = 'none';
};

async function initializeMyBookingsPage() {
    if (!userProfile) return;

    const currentContainer = document.getElementById('my-bookings-container');
    const pastContainer = document.getElementById('past-bookings-container');
    const toggleBtn = document.getElementById('toggle-past-bookings-btn');

    if (!currentContainer || !pastContainer || !toggleBtn) return;

    currentContainer.innerHTML = '<p>正在查詢您的預約紀錄...</p>';

    const renderBookings = (bookings, container, isPast = false) => {
        if (bookings.length === 0) {
            container.innerHTML = `<p>${isPast ? '沒有過往的預約紀錄。' : '您目前沒有即將到來的預約。'}</p>`;
            return;
        }
        container.innerHTML = bookings.map(booking => `
            <div class="booking-info-card">
                <p class="booking-date-time">${booking.booking_date} - ${booking.time_slot}</p>
                <p><strong>預約姓名：</strong> ${booking.contact_name}</p>
                <p><strong>預約人數：</strong> ${booking.num_of_people} 人</p>
                <p><strong>狀態：</strong> <span class="booking-status-${booking.status}">${booking.status_text}</span></p>
            </div>
        `).join('');
    };

    try {
        const currentResponse = await fetch(`/api/my-bookings?userId=${userProfile.userId}&filter=current`);
        if (!currentResponse.ok) throw new Error('查詢預約失敗');
        const currentBookings = await currentResponse.json();
        renderBookings(currentBookings, currentContainer);

        toggleBtn.addEventListener('click', async () => {
            const isHidden = pastContainer.style.display === 'none';
            if (isHidden) {
                pastContainer.innerHTML = '<p>正在查詢過往紀錄...</p>';
                pastContainer.style.display = 'block';
                toggleBtn.textContent = '隱藏過往紀錄';

                try {
                    const pastResponse = await fetch(`/api/my-bookings?userId=${userProfile.userId}&filter=past`);
                    if (!pastResponse.ok) throw new Error('查詢過往預約失敗');
                    const pastBookings = await pastResponse.json();
                    renderBookings(pastBookings, pastContainer, true);
                } catch (error) {
                    pastContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
                }
            } else {
                pastContainer.style.display = 'none';
                toggleBtn.textContent = '查看過往紀錄';
            }
        });

    } catch (error) {
        currentContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}

    async function initializeMyExpHistoryPage() {
        if (!userProfile) return;
        const container = document.getElementById('my-exp-history-container');
        if (!container) return;
        container.innerHTML = '<p>正在查詢您的經驗紀錄...</p>';
        try {
            const response = await fetch(`/api/my-exp-history?userId=${userProfile.userId}`);
            if (!response.ok) throw new Error('查詢紀錄失敗');
            const records = await response.json();
            if (records.length === 0) {
                container.innerHTML = '<p>您目前沒有任何經驗值紀錄。</p>';
                return;
            }
            container.innerHTML = records.map(record => {
                const date = new Date(record.created_at).toLocaleDateString('sv'); 
                const expClass = record.exp_added > 0 ? 'exp-gain' : 'exp-loss';
                const expSign = record.exp_added > 0 ? '+' : '';
                return `
                    <div class="exp-record-card">
                        <div class="exp-record-date">${date}</div>
                        <div class="exp-record-reason">${record.reason}</div>
                        <div class="exp-record-value ${expClass}">${expSign}${record.exp_added}</div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            container.innerHTML = `<p style="color: red;">無法載入經驗紀錄。</p>`;
        }
    }

async function initializeRentalHistoryPage() {
    if (!userProfile) return;

    const currentContainer = document.getElementById('rental-history-container');
    const pastContainer = document.getElementById('past-rentals-container');
    const toggleBtn = document.getElementById('toggle-past-rentals-btn');

    if (!currentContainer || !pastContainer || !toggleBtn) return;

    currentContainer.innerHTML = '<p>正在查詢您目前的租借...</p>';

    const renderRentals = (rentals, container, isPast = false) => {
        if (rentals.length === 0) {
            container.innerHTML = `<p>${isPast ? '沒有過往的租借紀錄。' : '您目前沒有租借中的遊戲。'}</p>`;
            return;
        }

        container.innerHTML = rentals.map(rental => {
            let statusHTML = '';
            if (rental.status === 'returned') {
                statusHTML = `<div class="rental-status returned">已於 ${rental.return_date || ''} 歸還</div>`;
            } else if (typeof rental.overdue_days === 'number' && rental.overdue_days > 0) {
                statusHTML = `
                    <div class="rental-status overdue-text">
                        <strong>已逾期 ${rental.overdue_days} 天</strong><br>
                        累積逾期金額 ${rental.calculated_late_fee} 元
                    </div>`;
            } else {
                statusHTML = `<div class="rental-status rented">租借中</div>`;
            }

            return `
                <div class="rental-card">
                    <img src="${rental.game_image_url || 'placeholder.jpg'}" class="rental-game-image">
                    <div class="rental-info">
                        <h3 class="rental-game-title">${rental.game_name}</h3>
                        <p>租借日期：${rental.rental_date}</p>
                        <p>應還日期：${rental.due_date}</p>
                        ${statusHTML}
                    </div>
                </div>
            `;
        }).join('');
    };

    try {
        const currentResponse = await fetch(`/api/my-rental-history?userId=${userProfile.userId}&filter=current`);
        if (!currentResponse.ok) throw new Error('查詢租借紀錄失敗');
        const currentRentals = await currentResponse.json();
        renderRentals(currentRentals, currentContainer);

        toggleBtn.addEventListener('click', async () => {
            const isHidden = pastContainer.style.display === 'none';
            if (isHidden) {
                pastContainer.innerHTML = '<p>正在查詢過往紀錄...</p>';
                pastContainer.style.display = 'block';
                toggleBtn.textContent = '隱藏過往紀錄';

                try {
                    const pastResponse = await fetch(`/api/my-rental-history?userId=${userProfile.userId}&filter=past`);
                    if (!pastResponse.ok) throw new Error('查詢過往租借失敗');
                    const pastRentals = await pastResponse.json();
                    renderRentals(pastRentals, pastContainer, true);
                } catch (error) {
                    pastContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
                }
            } else {
                pastContainer.style.display = 'none';
                toggleBtn.textContent = '查看過往紀錄';
            }
        });

    } catch (error) {
        currentContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}
    // =================================================================
    // 編輯個人資料頁
    // =================================================================
async function initializeEditProfilePage() {
    if (allGames.length === 0) {
        try {
            const res = await fetch('/api/get-boardgames');
            if (!res.ok) throw new Error('無法獲取遊戲資料');
            allGames = await res.json();
        } catch (error) {
            console.error('獲取遊戲標籤失敗:', error);
        }
    }

    if (!userProfile) return;

    document.getElementById('edit-profile-name').value = userProfile.displayName;
    const userData = await fetchGameData();
    if (!userData) return;
    
    document.getElementById('edit-profile-real-name').value = userData.real_name || '';
    document.getElementById('edit-profile-nickname').value = userData.nickname || '';
    document.getElementById('edit-profile-phone').value = userData.phone || '';
    document.getElementById('edit-profile-email').value = userData.email || '';

    const gamesContainer = document.getElementById('preferred-games-container');
    const otherContainer = document.getElementById('preferred-games-other-container');
    const otherInput = document.getElementById('preferred-games-other-input');

    if (gamesContainer && otherContainer && otherInput) {
        const allStandardTags = [...new Set(allGames.flatMap(g => (g.tags || '').split(',')).map(t => t.trim()).filter(Boolean))];
        
        const userTags = new Set((userData.preferred_games || '').split(',').map(tag => tag.trim()).filter(Boolean));
        
        const userCustomTags = [...userTags].filter(tag => !allStandardTags.includes(tag));

        gamesContainer.innerHTML = allStandardTags.map(tag => {
            const isActive = userTags.has(tag) ? 'active' : '';
            return `<button type="button" class="preference-tag-btn ${isActive}" data-tag="${tag}">${tag}</button>`;
        }).join('');
        
        const otherBtn = document.createElement('button');
        otherBtn.type = 'button';
        otherBtn.className = 'preference-tag-btn';
        otherBtn.textContent = '其他';
        gamesContainer.appendChild(otherBtn);

        if (userCustomTags.length > 0) {
            otherBtn.classList.add('active');
            otherContainer.style.display = 'block';
            otherInput.value = userCustomTags.join(', ');
        } else {
            otherContainer.style.display = 'none';
        }

        gamesContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('preference-tag-btn')) {
                if (target === otherBtn) {
                    const isNowActive = otherBtn.classList.toggle('active');
                    otherContainer.style.display = isNowActive ? 'block' : 'none';
                } else {
                    target.classList.toggle('active');
                }
            }
        });
        
        otherInput.addEventListener('input', () => {
            let value = otherInput.value;
            let chineseCount = (value.match(/[\u4e00-\u9fa5]/g) || []).length;
            let englishCount = (value.match(/[a-zA-Z]/g) || []).length;
            
            if (chineseCount > 10) {
                value = Array.from(value).filter(char => /[\u4e00-\u9fa5]/.test(char)).slice(0, 10).join('');
                otherInput.value = value;
            }
            if (englishCount > 30) {
                 value = Array.from(value).filter(char => /[a-zA-Z]/.test(char)).slice(0, 30).join('');
                 otherInput.value = value;
            }
        });
    }

    const form = document.getElementById('edit-profile-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        const statusMsg = document.getElementById('edit-profile-form-status');
        statusMsg.textContent = '儲存中...';

        let selectedGames = Array.from(gamesContainer.querySelectorAll('.preference-tag-btn.active'))
                                 .map(btn => btn.dataset.tag)
                                 .filter(tag => tag); 
        
        if (otherContainer.style.display === 'block' && otherInput.value.trim() !== '') {
            const customTags = otherInput.value.trim().split(/[,，\s]+/).filter(Boolean);
            selectedGames.push(...customTags);
        }

        const formData = {
            userId: userProfile.userId,
            realName: document.getElementById('edit-profile-real-name').value.trim(),
            nickname: document.getElementById('edit-profile-nickname').value,
            phone: document.getElementById('edit-profile-phone').value,
            email: document.getElementById('edit-profile-email').value,
            preferredGames: [...new Set(selectedGames)], 
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl || ''
        };

        try {
            const response = await fetch('/api/update-user-profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '儲存失敗');
            
            gameData = {}; 
            statusMsg.textContent = '儲存成功！';
            statusMsg.style.color = 'green';
            setTimeout(() => history.back(), 1500); 

        } catch (error) {
            statusMsg.textContent = `儲存失敗: ${error.message}`;
            statusMsg.style.color = 'red';
        }
    };
}
    // =================================================================
    // 桌遊圖鑑頁
    // =================================================================
    function difficultyToStars(difficulty) {
    const levels = {
        '簡單': 1,
        '普通': 2,
        '困難': 3,
        '專家': 4
    };
    const level = levels[difficulty] || 2; 
    const totalStars = 4;
    let stars = '';
    for (let i = 0; i < totalStars; i++) {
        stars += i < level ? '★' : '☆';
    }
    return stars;
    }

    function renderGameDetails(game) {
        const mainImage = appContent.querySelector('.details-image-main');
        const thumbnailsContainer = appContent.querySelector('.details-image-thumbnails');
        
        const images = [game.image_url, game.image_url_2, game.image_url_3].filter(Boolean);
        
        mainImage.src = images.length > 0 ? images[0] : 'placeholder.jpg';
        
        thumbnailsContainer.innerHTML = images.map((imgSrc, index) => 
            `<img src="${imgSrc}" class="details-image-thumbnail ${index === 0 ? 'active' : ''}" data-src="${imgSrc}">`
        ).join('');
        
        thumbnailsContainer.addEventListener('click', e => {
            if (e.target.matches('.details-image-thumbnail')) {
                mainImage.src = e.target.dataset.src;
                thumbnailsContainer.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
            }
        });

        appContent.querySelector('.details-title').textContent = game.name;
        appContent.querySelector('#game-players').textContent = `${game.min_players} - ${game.max_players} 人`;
        appContent.querySelector('#game-difficulty').textContent = difficultyToStars(game.difficulty);

        const tagsContainer = appContent.querySelector('#game-tags-container');
        const tags = (game.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length > 0) {
            tagsContainer.innerHTML = tags.map(tag => `<span class="game-tag">${tag}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
        }
        
        appContent.querySelector('#game-intro-content').innerHTML = (game.description || '暫無介紹。').replace(/\n/g, '<br>');
        
        const supplementarySection = appContent.querySelector('#game-supplementary-section');
        if (game.supplementary_info) {
            appContent.querySelector('#game-supplementary-content').innerHTML = game.supplementary_info.replace(/\n/g, '<br>');
            supplementarySection.style.display = 'block';
        } else {
            supplementarySection.style.display = 'none';
        }

        const priceContent = appContent.querySelector('#game-price-content');
        let priceHTML = '';
        const hasSalePrice = Number(game.sale_price) > 0;
        const hasRentPrice = Number(game.rent_price) > 0;

        if (hasSalePrice) {
            priceHTML += `<div class="price-item"><p class="price-tag">參考售價</p><p class="price-value">$${game.sale_price}</p></div>`;
        }
        if (hasRentPrice) {
            priceHTML += `<div class="price-item"><p class="price-tag">租借費用 (三天)</p><p class="price-value">$${game.rent_price}</p></div>`;
        }
        
        if (priceHTML === '') {
            priceContent.innerHTML = `<p style="text-align:center;">價格資訊請洽店內公告</p>`;
        } else {
            priceContent.innerHTML = `<div class="price-grid">${priceHTML}</div>`;
        }
    }


function renderGames() {
        const container = document.getElementById('game-list-container');
        if(!container) return;
        let filteredGames = allGames.filter(g => g.is_visible === 1);
        const keyword = activeFilters.keyword.toLowerCase().trim();
        if (keyword) { filteredGames = filteredGames.filter(g => g.name.toLowerCase().includes(keyword) || g.description.toLowerCase().includes(keyword)); }
        if (activeFilters.tag) { filteredGames = filteredGames.filter(g => (g.tags || '').split(',').map(t => t.trim()).includes(activeFilters.tag)); }
        if (filteredGames.length === 0) {
            container.innerHTML = '<p>找不到符合條件的遊戲。</p>';
            return;
        }
        container.innerHTML = filteredGames.map(game => `
            <div class="game-card" data-game-id="${game.game_id}">
                <img src="${game.image_url || 'placeholder.jpg'}" alt="${game.name}" class="game-image">
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                    <p class="game-description">${game.description}</p> 
                    <div class="game-details">
                        <span>👥 ${game.min_players}-${game.max_players} 人</span>
                        <span>⭐ 難度: ${game.difficulty}</span>
                    </div>
                    <div class="game-tags">
                        ${(game.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(tag => `<span class="game-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function populateFilters() {
        const filterContainer = document.getElementById('tag-filter-container');
        const primaryTagsContainer = document.getElementById('primary-tags');
        const secondaryTagsContainer = document.getElementById('secondary-tags');
        
        document.getElementById('more-tags-btn')?.remove();
        document.getElementById('clear-filters')?.remove();

        if(!filterContainer || !primaryTagsContainer || !secondaryTagsContainer) return;
        
        const primaryTagsList = ["家庭", "兒童", "派對", "陣營", "小品", "策略"];
        const allTags = [...new Set(allGames.flatMap(g => (g.tags || '').split(',')).map(t => t.trim()).filter(Boolean))];
        
        primaryTagsContainer.innerHTML = '';
        secondaryTagsContainer.innerHTML = '';

        allTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.textContent = tag;
            btn.dataset.tag = tag;
            btn.className = 'filter-tag-btn'; 
            btn.addEventListener('click', () => {
                const currentActive = filterContainer.querySelector('.filter-tag-btn.active');
                if (currentActive) {
                    currentActive.classList.remove('active');
                }
                
                if (activeFilters.tag === tag) {
                    activeFilters.tag = null;
                } else {
                    activeFilters.tag = tag;
                    btn.classList.add('active');
                }
                renderGames();
            });

            if (primaryTagsList.includes(tag)) {
                primaryTagsContainer.appendChild(btn);
            } else {
                secondaryTagsContainer.appendChild(btn);
            }
        });

        const moreBtn = document.createElement('button');
        moreBtn.id = 'more-tags-btn';
        moreBtn.textContent = '更多標籤';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-filters';
        clearBtn.textContent = '清除所有篩選';
        
        filterContainer.appendChild(moreBtn);
        filterContainer.appendChild(clearBtn);

        if (secondaryTagsContainer.children.length > 0) {
            moreBtn.style.display = 'inline-block';
            moreBtn.addEventListener('click', () => {
                const isHidden = secondaryTagsContainer.style.display === 'none';
                secondaryTagsContainer.style.display = isHidden ? 'contents' : 'none';
                moreBtn.textContent = isHidden ? '收起標籤' : '更多標籤';
            });
        } else {
            moreBtn.style.display = 'none';
        }

        clearBtn.addEventListener('click', () => {
            activeFilters.keyword = '';
            activeFilters.tag = null;
            document.getElementById('keyword-search').value = '';
            document.querySelectorAll('#tag-filter-container button').forEach(b => b.classList.remove('active'));
            renderGames();
        });
    }

    async function initializeGamesPage() {
        if (allGames.length === 0) {
            try {
                const res = await fetch('/api/get-boardgames');
                if (!res.ok) throw new Error('API 請求失敗');
                allGames = await res.json();
            } catch (error) {
                console.error('初始化桌遊圖鑑失敗:', error);
                const container = document.getElementById('game-list-container');
                if(container) container.innerHTML = '<p style="color: red;">讀取桌遊資料失敗。</p>';
                return;
            }
        }
        renderGames();
        populateFilters();
        document.getElementById('keyword-search').addEventListener('input', e => { activeFilters.keyword = e.target.value; renderGames(); });
        document.getElementById('clear-filters').addEventListener('click', () => {
            activeFilters.keyword = '';
            activeFilters.tag = null;
            document.getElementById('keyword-search').value = '';
            document.querySelectorAll('#tag-filter-container button').forEach(b => b.classList.remove('active'));
            renderGames();
        });
    }

// =================================================================
// 場地預約頁
// =================================================================
// public/script.js

async function initializeBookingPage(stepId) {
    const currentStep = stepId || 'step-preference';
    
    try {
        showBookingStep(currentStep);
    } catch (e) {
        console.error(`showBookingStep 執行時出錯!`, e);
        return; 
    }

    const viewMyBookingsBtn = appContent.querySelector('#view-my-bookings-btn');
    if (viewMyBookingsBtn) {
        viewMyBookingsBtn.onclick = () => navigateTo('page-my-bookings');
    }

    try {
        const infoResponse = await fetch('/api/get-store-info');
        if (!infoResponse.ok) throw new Error(`無法載入店家設定 (狀態: ${infoResponse.status})`);
        const storeInfo = await infoResponse.json();

        appContent.querySelector('#booking-announcement-box').innerText = storeInfo.booking_announcement_text || '';
        appContent.querySelector('#go-to-booking-step-btn').innerText = storeInfo.booking_button_text || '開始預約';
        appContent.querySelector('#booking-promo-text').innerText = storeInfo.booking_promo_text || '';

        const response = await fetch('/api/bookings-check?month-init=true');
        if (!response.ok) throw new Error(`無法載入可預約日期 (狀態: ${response.status})`);
        const data = await response.json();
        enabledDatesByAdmin = data.enabledDates || [];

    } catch (error) {
        console.error("初始化預約頁面API失敗:", error);
        appContent.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">無法載入預約設定，請稍後再試。<br>錯誤詳情: ${error.message}</p>`;
        return; 
    }
    
    const wizardContainer = appContent.querySelector('#booking-wizard-container');
    if (wizardContainer && !wizardContainer.dataset.listenerAttached) {
        wizardContainer.dataset.listenerAttached = 'true';
        wizardContainer.addEventListener('click', (e) => {
            if (e.target.closest('#go-to-booking-step-btn')) {
                navigateTo('page-booking', 'step-date-and-slots');
            } else if (e.target.matches('#to-summary-btn')) {
                handleBookingNextStep();
            } else if (e.target.matches('#confirm-booking-btn')) {
                handleBookingConfirmation(e.target);
            }
        });
    }
    
    const datepickerContainer = appContent.querySelector("#booking-datepicker-container");
    if (datepickerContainer) {
        if (enabledDatesByAdmin.length === 0) {
            datepickerContainer.innerHTML = '<p style="text-align:center; color: var(--color-danger);">目前沒有開放預約的日期。</p>';
        } else {
            flatpickr(datepickerContainer, {
                inline: true, minDate: "today", dateFormat: "Y-m-d", locale: "zh_tw",
                enable: enabledDatesByAdmin,
                onChange: (selectedDates, dateStr) => {
                    bookingData.date = dateStr;
                    fetchAndRenderSlots(dateStr);
                },
                onClick: (selectedDates, dateStr, instance) => {
                  setTimeout(() => {
                    const clickedElement = instance.selectedDateElem;
                    if (clickedElement && clickedElement.classList.contains('flatpickr-disabled')) {
                        const slotsPlaceholder = appContent.querySelector('#slots-placeholder');
                        if (slotsPlaceholder) {
                            slotsPlaceholder.textContent = '此日期未開放預約';
                            slotsPlaceholder.style.display = 'block';
                            appContent.querySelector('#booking-slots-container').innerHTML = '';
                        }
                    }
                  }, 10);
                }
            });
        }
    }

    const userData = await fetchGameData();
    if (userData) {
        const nameInput = appContent.querySelector('#contact-name');
        const phoneInput = appContent.querySelector('#contact-phone');
        if(nameInput) nameInput.value = userData.real_name || '';
        if(phoneInput) phoneInput.value = userData.phone || '';
    }
    
    if (stepId === 'step-summary') {
        renderSummary();
    }
}

function showBookingStep(stepId) {
    appContent.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => {
        step.classList.toggle('active', step.id === stepId);
    });
}

    function handleBookingNextStep() {
        const peopleInput = document.getElementById('booking-people');
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');

        bookingData.people = Number(peopleInput.value);
        bookingData.name = nameInput.value.trim();
        bookingData.phone = phoneInput.value.trim();

        if (!bookingData.people || !bookingData.name || bookingData.phone.length < 10) {
            alert('請確實填寫所有資訊，並確認手機號碼為10碼！');
            return;
        }
        const tablesNeeded = Math.ceil(bookingData.people / PEOPLE_PER_TABLE);
        if (tablesNeeded > dailyAvailability.available) {
            alert(`抱歉，線上預訂的座位不足！建議您直接傳訊跟我們確認當日桌數哦。(⁰▿⁰)`);
            return;
        }
        navigateTo('page-booking', 'step-summary');
    }

    function initializeBookingSummary() {
         renderSummary();
    }
    
    async function fetchAndRenderSlots(date) {
        const slotsPlaceholder = document.getElementById('slots-placeholder');
        const slotsContainer = appContent.querySelector('#booking-slots-container');
        if (!slotsPlaceholder || !slotsContainer) return;

        slotsPlaceholder.textContent = '正在查詢當日空位...';
        slotsContainer.innerHTML = '';
        slotsPlaceholder.style.display = 'block';

        try {
            const response = await fetch(`/api/bookings-check?date=${date}`);
            if (!response.ok) throw new Error('查詢失敗');
            dailyAvailability = await response.json();
            
            if (dailyAvailability.available <= 0) {
                slotsPlaceholder.textContent = '抱歉，本日預約已額滿';
                return;
            }
            
            slotsPlaceholder.style.display = 'none';
            
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const isToday = (date === todayStr);

            slotsContainer.innerHTML = AVAILABLE_TIME_SLOTS.map(slot => {
                let isDisabled = false;
                if (isToday) {
                    const [hour, minute] = slot.split(':');
                    const slotTime = new Date();
                    slotTime.setHours(hour, minute, 0, 0);
                    if (slotTime < now) {
                        isDisabled = true;
                    }
                }
                return `<button class="slot-button" ${isDisabled ? 'disabled' : ''}>${slot}</button>`;
            }).join('');
            
            slotsContainer.querySelectorAll('.slot-button:not([disabled])').forEach(btn => {
                btn.addEventListener('click', () => {
                    bookingData.timeSlot = btn.textContent;
                    appContent.querySelector('#contact-summary').textContent = `${bookingData.date} 的 ${bookingData.timeSlot}`;
                    // 導航到下一步
                    navigateTo('page-booking', 'step-contact');
                });
            });

        } catch (error) {
            slotsPlaceholder.textContent = `查詢空位失敗：${error.message}`;
        }
    }

function renderSummary() {
    const summaryCard = appContent.querySelector('#booking-summary-card');
    summaryCard.innerHTML = `
        <p><span>姓名:</span><span>${bookingData.name}</span></p>
        <p><span>電話:</span><span>${bookingData.phone}</span></p>
        <p><span>日期:</span><span>${bookingData.date}</span></p>
        <p><span>時段:</span><span>${bookingData.timeSlot}</span></p>
        <p><span>人數:</span><span>${bookingData.people} 人</span></p>
    `;
}

async function handleBookingConfirmation(confirmBtn) {
    if (confirmBtn.dataset.isSubmitting === 'true') return;

    try {
        confirmBtn.dataset.isSubmitting = 'true';
        confirmBtn.disabled = true;
        confirmBtn.textContent = '處理中...';
        
        const bookingPayload = {
            userId: userProfile.userId,
            bookingDate: bookingData.date,
            timeSlot: bookingData.timeSlot,
            numOfPeople: bookingData.people,
            contactName: bookingData.name,
            contactPhone: bookingData.phone
        };

        const createRes = await fetch('/api/bookings-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingPayload)
        });

        if (!createRes.ok) {
            const errorResult = await createRes.json();
            throw new Error(errorResult.error || '建立預約時發生未知錯誤');
        }
        
        const result = await createRes.json();
        
        await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userProfile.userId, message: result.confirmationMessage })
        });

        appContent.querySelector('#booking-result-content').innerHTML = `
            <h2 class="success">✅ 預約成功！</h2>
            <p>已將預約確認訊息發送至您的 LINE，我們到時見！</p>
            <button id="booking-done-btn" class="cta-button">返回預約首頁</button>`;
        showBookingStep('step-result');

        appContent.querySelector('#booking-done-btn').addEventListener('click', () => navigateTo('page-booking')); // 建議使用 navigateTo

    } catch (error) {
        alert(`預約失敗：${error.message}`);
    } finally {
        confirmBtn.dataset.isSubmitting = 'false';
        confirmBtn.disabled = false;
        confirmBtn.textContent = '確認送出';
    }
}
    // =================================================================
    // 店家資訊頁
    // =================================================================
async function initializeInfoPage() {
    try {
        const response = await fetch('/api/get-store-info');
        if (!response.ok) throw new Error('無法獲取店家資訊');
        const info = await response.json();

        const addressText = info.address;
        const addressSpan = document.getElementById('store-address');
        const addressLink = document.getElementById('store-address-link');

        if (addressSpan) {
            addressSpan.textContent = addressText;
        }

        if (addressLink) {
            const encodedAddress = encodeURIComponent(addressText);
            addressLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }

        document.getElementById('store-phone').textContent = info.phone;
        document.getElementById('store-hours').innerHTML = info.opening_hours.replace(/\n/g, '<br>');
        document.getElementById('store-description').innerHTML = info.description.replace(/\n/g, '<br>');
    } catch (error) {
         const container = document.getElementById('store-info-container');
         if(container) container.innerHTML = `<p style="color:red;">${error.message}</p>`;
    }
}
    // =================================================================
    // Tab Bar 主導航
    // =================================================================

    initializeLiff();
});

// --- [新增] 問卷助手邏輯 ---
// --- 修改後的 RecWizard (支援記憶功能與複選) ---
const RecWizard = {
    answers: {
        players: [],
        price: [],
        tag: [],
        difficulty: []
    },
    allGames: [],

    init: function() {
        const fab = document.getElementById('fab-quiz-btn');
        if (fab) {
            fab.addEventListener('click', () => this.open());
        }
    },

    open: function() {
        // 載入遊戲資料
        if (this.allGames.length === 0) {
            fetch('/api/get-boardgames')
                .then(r => r.json())
                .then(data => { 
                    this.allGames = data; 
                    // 資料載入後，如果之前有結果，重新渲染一次結果頁
                    if (this.hasSavedState()) this.showResults();
                });
        }
        
        document.getElementById('quiz-modal').style.display = 'flex';
        
        // 【核心修改】檢查是否有暫存的狀態
        if (this.hasSavedState()) {
            this.loadState();
            this.showResults(); // 直接顯示結果，不重置
        } else {
            this.restart(); // 沒資料才重置
        }
    },

    close: function() {
        document.getElementById('quiz-modal').style.display = 'none';
    },

    restart: function() {
        this.answers = { players: [], price: [], tag: [], difficulty: [] };
        sessionStorage.removeItem('quiz_answers'); // 清除暫存
        document.querySelectorAll('.quiz-option-btn').forEach(btn => btn.classList.remove('selected'));
        this.showStep(1);
    },

    toggle: function(category, value, btnElement) {
        const index = this.answers[category].indexOf(value);
        if (index === -1) {
            this.answers[category].push(value);
            btnElement.classList.add('selected');
        } else {
            this.answers[category].splice(index, 1);
            btnElement.classList.remove('selected');
        }
        this.saveState(); // 每次變動都儲存
    },

    next: function(currentStep) {
        this.showStep(currentStep + 1);
    },

    prev: function(step) {
        this.showStep(step);
    },

    showStep: function(step) {
        document.querySelectorAll('.quiz-step').forEach(el => el.style.display = 'none');
        const target = document.getElementById(`quiz-step-${step}`);
        if(target) target.style.display = 'block';
        
        const progress = (step / 4) * 100;
        document.getElementById('quiz-progress-bar').style.width = `${progress}%`;
    },

    showResults: function() {
        document.querySelectorAll('.quiz-step').forEach(el => el.style.display = 'none');
        document.getElementById('quiz-result').style.display = 'block';
        document.getElementById('quiz-progress-bar').style.width = '100%';

        const { players, price, tag, difficulty } = this.answers;
        
        // 篩選邏輯 (與之前相同)
        const results = this.allGames.filter(game => {
            let matchPlayers = (players.length === 0) ? true : players.some(p => (p === 7 ? game.max_players >= 7 : (game.min_players <= p && game.max_players >= p)));
            if (!matchPlayers) return false;

            let matchPrice = (price.length === 0) ? true : price.some(range => {
                const p = game.sale_price || 0;
                if (range === 'low') return p <= 500;
                if (range === 'mid') return p > 500 && p <= 1000;
                if (range === 'high') return p > 1000 && p <= 2000;
                if (range === 'expensive') return p > 2000;
                return false;
            });
            if (!matchPrice) return false;

            if (tag.length > 0) {
                const gameTags = game.tags || '';
                if (!tag.some(t => gameTags.includes(t))) return false;
            }

            if (difficulty.length > 0 && !difficulty.includes(game.difficulty)) return false;

            return true;
        });

        // 渲染結果
        const container = document.getElementById('quiz-result-list');
        const countDisplay = document.getElementById('quiz-result-count');
        container.innerHTML = '';

        if (results.length === 0) {
            countDisplay.textContent = '😢 找不到同時符合條件的遊戲，請試著減少條件';
        } else {
            countDisplay.textContent = `為您推薦以下 ${results.length} 款遊戲：`;
            results.forEach(game => {
                const card = document.createElement('div');
                card.className = 'mini-game-card'; 
                card.innerHTML = `
                    <div class="mini-game-card-img-container">
                        <img src="${game.image_url || 'placeholder.jpg'}" alt="${game.name}" loading="lazy">
                    </div>
                    <div class="mini-game-card-info">
                        <h4>${game.name}</h4>
                        <div class="mini-game-card-meta">
                            <span>${game.min_players}-${game.max_players}人</span>
                            <span>${game.difficulty}</span>
                        </div>
                    </div>
                `;
                card.onclick = () => {
                    this.close();
                    window.location.hash = `page-game-details@${game.game_id}`;
                };
                container.appendChild(card);
            });
        }
    },

    // --- 新增：狀態儲存與讀取 ---
    saveState: function() {
        sessionStorage.setItem('quiz_answers', JSON.stringify(this.answers));
    },

    loadState: function() {
        const saved = sessionStorage.getItem('quiz_answers');
        if (saved) {
            this.answers = JSON.parse(saved);
            // 恢復按鈕的選中狀態 (如果是重開網頁的情況)
            this.restoreButtonStates();
        }
    },

    hasSavedState: function() {
        // 檢查是否有儲存且不為空
        const saved = sessionStorage.getItem('quiz_answers');
        if (!saved) return false;
        const parsed = JSON.parse(saved);
        // 檢查是否至少選了一個條件
        return parsed.players.length > 0 || parsed.price.length > 0 || parsed.tag.length > 0 || parsed.difficulty.length > 0;
    },

    restoreButtonStates: function() {
        // 根據 this.answers 重新標記按鈕 (僅在必要時呼叫，例如重新整理後)
        document.querySelectorAll('.quiz-option-btn').forEach(btn => btn.classList.remove('selected'));
        // 這裡邏輯較複雜，因為 DOM 是靜態的，通常不需要特別恢復按鈕狀態，
        // 除非我們在 restart 以外的時候回到前面的步驟。
        // 目前主要用途是 showResults() 直接顯示結果，所以這步可省略或做為擴充。
    }
};

// 在 DOMContentLoaded 或 initApp 中呼叫
document.addEventListener('DOMContentLoaded', () => {
    RecWizard.init();
});