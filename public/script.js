// public/script.js (重構修正最終版 - Part 1/2)

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 核心DOM元素與全域變數
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW"; // 請確認這是您的 LIFF ID
    let userProfile = null;
    let gameData = {};
    const appContent = document.getElementById('app-content');
    const pageTemplates = document.getElementById('page-templates');
    const tabBar = document.getElementById('tab-bar');

    // 業務邏輯變數
    const TOTAL_TABLES = 4;
    const PEOPLE_PER_TABLE = 4;
    const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];

    // 狀態變數
    let allGames = [];
    let allNews = [];
    let activeFilters = { keyword: '', tag: null };
    let bookingData = {};
    let dailyAvailability = { limit: TOTAL_TABLES, booked: 0, available: TOTAL_TABLES };
    let enabledDatesByAdmin = [];

    // =================================================================
    // 頁面切換邏輯 (重構核心)
    // =================================================================

    /**
     * 核心導覽函式，唯一的頁面渲染入口
     * 根據 URL hash (例如 #page-booking@step-date) 顯示對應的頁面和步驟
     */
    function handleNavigation() {
        const hash = location.hash.substring(1) || 'page-home';
        const [pageId, ...rest] = hash.split('@');
        const data = rest.join('@'); // 取得 @ 後面的所有內容 (用於步驟或ID)

        const pageTemplate = pageTemplates.querySelector(`#${pageId}`);
        if (pageTemplate) {
            appContent.innerHTML = pageTemplate.innerHTML;
        } else {
            // 如果找不到頁面，安全起見，強制顯示首頁
            appContent.innerHTML = pageTemplates.querySelector('#page-home').innerHTML;
            initializeHomePage(); // 確保首頁內容被初始化
            return;
        }

        // 頁面初始化函式映射表
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

        // 執行對應的初始化函式
        if (pageInitializers[pageId]) {
            pageInitializers[pageId]();
        }

        // 更新 Tab Bar 的高亮狀態
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === pageId);
        });
    }

    /**
     * 導航函式，所有頁面跳轉都必須呼叫此函式
     * @param {string} pageId - 目標頁面的 ID
     * @param {string} [data] - (可選) 附加資料，例如步驟 ID 或項目 ID
     */
    function navigateTo(pageId, data = null) {
        let newHash = pageId;
        if (data) {
            newHash += `@${data}`;
        }
        // 只有當 hash 真的改變時才賦值，避免不必要的重複觸發
        if (location.hash !== `#${newHash}`) {
            location.hash = newHash;
        }
    }

    // 監聽瀏覽器的返回操作(popstate)和程式內部導覽(hashchange)
    // 兩者都交給同一個核心函式處理，確保行為一致
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);

    // =================================================================
    // 全域事件監聽 (Event Listeners)
    // =================================================================

    // 使用事件委派，統一處理 appContent 內部的所有點擊事件，效能更好且能對應動態產生的元素
    appContent.addEventListener('click', (event) => {
        const target = event.target;

        // 統一處理所有返回按鈕
        if (target.closest('.details-back-button, .back-button')) {
            event.preventDefault();
            history.back(); // 只做這件事，剩下的交給 popstate 監聽器
            return;
        }

        // 處理情報卡片點擊
        const newsCard = target.closest('.news-card');
        if (newsCard && newsCard.dataset.newsId) {
            navigateTo('page-news-details', newsCard.dataset.newsId);
            return;
        }
        
        // 處理遊戲卡片點擊
        const gameCard = target.closest('.game-card');
        if (gameCard && gameCard.dataset.gameId) {
            navigateTo('page-game-details', gameCard.dataset.gameId);
            return;
        }
    });

    // Tab Bar 導航
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            navigateTo(button.dataset.target);
        }
    });

    // =================================================================
    // LIFF 初始化 (程式啟動點)
    // =================================================================
    async function initializeLiff() {
        try {
            await liff.init({ liffId: myLiffId });

            if (!liff.isLoggedIn()) {
                liff.login();
                return; // 登入後會自動重載，終止後續執行
            }
            userProfile = await liff.getProfile();
            
            // 首次進入時，如果 URL 沒有 hash，給定一個初始狀態
            if (!location.hash) {
                // replaceState 不會創建新的歷史紀錄，只是替換當前狀態
                history.replaceState({ page: 'page-home' }, '', '#page-home');
            }
            
            handleNavigation(); // 根據當前 hash 渲染頁面

        } catch (err) {
            console.error("LIFF 初始化或 Profile 獲取失敗", err);
            // 即使 LIFF 失敗，也嘗試渲染首頁
            history.replaceState({ page: 'page-home' }, '', '#page-home');
            handleNavigation();
        }
    }

    // =================================================================
    // 各頁面初始化函式 (Page Initializers)
    // =================================================================

    async function initializeHomePage() {
        try {
            if (allNews.length === 0) {
                const response = await fetch('/api/get-news');
                if (!response.ok) throw new Error('無法獲取最新情報');
                allNews = await response.json();
            }
            setupNewsFilters();
            renderNews();
        } catch (error) {
            console.error(error);
            const container = document.getElementById('news-list-container');
            if (container) container.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }
    
    function initializeNewsDetailsPageFromHash(newsId) {
        if (newsId && allNews.length > 0) {
            const newsItem = allNews.find(n => n.id == newsId);
            if (newsItem) {
                renderNewsDetails(newsItem);
            }
        }
    }  
    // =================================================================
    // 個人資料頁
    // =================================================================
        async function initializeProfilePage() {
        if (!userProfile) return;
        
        const qrcodeElement = document.getElementById('qrcode');
        if (qrcodeElement) {
            qrcodeElement.innerHTML = '';
            new QRCode(qrcodeElement, { text: userProfile.userId, width: 150, height: 150 });
        }

        const profilePicture = document.getElementById('profile-picture');
        if (profilePicture && userProfile.pictureUrl) {
            profilePicture.src = userProfile.pictureUrl;
        }

        document.getElementById('edit-profile-btn').onclick = () => navigateTo('page-edit-profile');
        document.getElementById('my-bookings-btn').onclick = () => navigateTo('page-my-bookings');
        document.getElementById('my-exp-history-btn').onclick = () => navigateTo('page-my-exp-history');
        document.getElementById('rental-history-btn').onclick = () => navigateTo('page-rental-history');
        
        try {
            const userData = await fetchGameData(true);
            updateProfileDisplay(userData);
        } catch (error) {
            console.error("無法更新個人資料畫面:", error);
            const displayNameElement = document.getElementById('display-name');
            if (displayNameElement) displayNameElement.textContent = '資料載入失敗';
        }
    }

    // 【需求 2.2 修正】增加 forceRefresh 參數
    async function fetchGameData(forceRefresh = false) { 
        if (!forceRefresh && gameData && gameData.user_id) return gameData;
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userProfile.userId, displayName: userProfile.displayName, pictureUrl: userProfile.pictureUrl }),
            });
            if (!response.ok) throw new Error('無法取得會員遊戲資料');
            gameData = await response.json();
            
            // updateProfileDisplay(gameData); // 這行可以移除，因為 initializeProfilePage 會呼叫
            return gameData;
        } catch (error) {
            console.error('呼叫會員 API 失敗:', error);
            document.getElementById('display-name').textContent = userProfile.displayName;
            return null;
        }
    }

// public/script.js

// (替換掉舊的 updateProfileDisplay 函式)
function updateProfileDisplay(data) {
    if (!data) return;
    document.getElementById('display-name').textContent = data.nickname || userProfile.displayName;
    document.getElementById('user-class').textContent = data.class || "無";
    document.getElementById('user-level').textContent = data.level;
    document.getElementById('user-exp').textContent = `${data.current_exp} / 10`;

    // 改為選取新的 <p> 元素
    const perkLine = document.getElementById('user-perk-line');
    const perkSpan = document.getElementById('user-perk');
    
    // 確保元素都存在，再根據資料決定是否顯示
    if (perkLine && perkSpan && data.perk && data.class !== '無') {
        perkSpan.textContent = data.perk;
        perkLine.style.display = 'block'; // 顯示整行 <p>
    } else if (perkLine) {
        perkLine.style.display = 'none'; // 隱藏整行 <p>
    }
}

// REPLACE THIS FUNCTION
async function initializeMyBookingsPage() {
    if (!userProfile) return;

    const currentContainer = document.getElementById('my-bookings-container');
    const pastContainer = document.getElementById('past-bookings-container');
    const toggleBtn = document.getElementById('toggle-past-bookings-btn');

    if (!currentContainer || !pastContainer || !toggleBtn) return;

    currentContainer.innerHTML = '<p>正在查詢您的預約紀錄...</p>';

    // 渲染函式，用於顯示預約列表
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
        // 預設載入目前的預約
        const currentResponse = await fetch(`/api/my-bookings?userId=${userProfile.userId}&filter=current`);
        if (!currentResponse.ok) throw new Error('查詢預約失敗');
        const currentBookings = await currentResponse.json();
        renderBookings(currentBookings, currentContainer);

        // 綁定按鈕事件
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

// public/script.js

// REPLACE THIS FUNCTION
async function initializeRentalHistoryPage() {
    if (!userProfile) return;

    const currentContainer = document.getElementById('rental-history-container');
    const pastContainer = document.getElementById('past-rentals-container');
    const toggleBtn = document.getElementById('toggle-past-rentals-btn');

    if (!currentContainer || !pastContainer || !toggleBtn) return;

    currentContainer.innerHTML = '<p>正在查詢您目前的租借...</p>';

    // 渲染函式，用於顯示租借列表
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
        // 預設載入目前的租借
        const currentResponse = await fetch(`/api/my-rental-history?userId=${userProfile.userId}&filter=current`);
        if (!currentResponse.ok) throw new Error('查詢租借紀錄失敗');
        const currentRentals = await currentResponse.json();
        renderRentals(currentRentals, currentContainer);

        // 綁定按鈕事件
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
            } catch (error) { console.error('獲取遊戲標籤失敗:', error); }
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
                        otherBtn.classList.toggle('active');
                        otherContainer.style.display = otherBtn.classList.contains('active') ? 'block' : 'none';
                    } else {
                        target.classList.toggle('active');
                    }
                }
            });
        }

        const form = document.getElementById('edit-profile-form');
        form.onsubmit = async (event) => {
            event.preventDefault();
            const statusMsg = document.getElementById('edit-profile-form-status');
            statusMsg.textContent = '儲存中...';

            let selectedGames = Array.from(gamesContainer.querySelectorAll('.preference-tag-btn.active')).map(btn => btn.dataset.tag).filter(tag => tag);
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
                const response = await fetch('/api/update-user-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || '儲存失敗');
                
                gameData = {}; // 清空快取
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
    const level = levels[difficulty] || 2; // 如果找不到對應的難度，預設為2顆星
    const totalStars = 4;
    let stars = '';
    for (let i = 0; i < totalStars; i++) {
        stars += i < level ? '★' : '☆';
    }
    return stars;
    }

    function renderGameDetails(game) {
        // 1. 處理圖片
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

        // 2. 處理核心資訊
        appContent.querySelector('.details-title').textContent = game.name;
        appContent.querySelector('#game-players').textContent = `${game.min_players} - ${game.max_players} 人`;
        appContent.querySelector('#game-difficulty').textContent = difficultyToStars(game.difficulty);

        // 3. 處理標籤
        const tagsContainer = appContent.querySelector('#game-tags-container');
        const tags = (game.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length > 0) {
            tagsContainer.innerHTML = tags.map(tag => `<span class="game-tag">${tag}</span>`).join('');
            tagsContainer.style.display = 'block';
        } else {
            tagsContainer.style.display = 'none';
        }
        
        // 4. 處理介紹
        appContent.querySelector('#game-intro-content').textContent = game.description || '暫無介紹。';
        
        // 5. 處理補充說明
        const supplementarySection = appContent.querySelector('#game-supplementary-section');
        if (game.supplementary_info) {
            appContent.querySelector('#game-supplementary-content').innerHTML = game.supplementary_info.replace(/\n/g, '<br>');
            supplementarySection.style.display = 'block';
        } else {
            supplementarySection.style.display = 'none';
        }

        // 6. 處理價格 (修正 rent_price 為 0 的 bug 並移除庫存)
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
        // 【修正】將 game-description 的 p 標籤加回來
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

    // 【問題2、3、4 修正】替換整個 populateFilters 函式
    function populateFilters() {
        // 【修正】將容器目標改為 #tag-filter-container
        const filterContainer = document.getElementById('tag-filter-container');
        const primaryTagsContainer = document.getElementById('primary-tags');
        const secondaryTagsContainer = document.getElementById('secondary-tags');
        
        // 舊的按鈕先移除，避免重複生成
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
            btn.className = 'filter-tag-btn'; // 【修正】為所有按鈕加上統一的 class

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

        // 【修正】在所有標籤後面動態新增「更多」和「清除」按鈕
        const moreBtn = document.createElement('button');
        moreBtn.id = 'more-tags-btn';
        moreBtn.textContent = '更多標籤';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-filters';
        clearBtn.textContent = '清除所有篩選';
        
        // 將按鈕加入到主容器的末尾
        filterContainer.appendChild(moreBtn);
        filterContainer.appendChild(clearBtn);

        // 重新綁定事件
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
        
        const searchInput = document.getElementById('keyword-search');
        if (searchInput) {
            searchInput.addEventListener('input', e => { 
                activeFilters.keyword = e.target.value; 
                renderGames(); 
            });
        }
        const clearButton = document.getElementById('clear-filters');
        if(clearButton) {
            clearButton.addEventListener('click', () => {
                activeFilters.keyword = '';
                activeFilters.tag = null;
                if(searchInput) searchInput.value = '';
                document.querySelectorAll('#tag-filter-container button').forEach(b => b.classList.remove('active'));
                renderGames();
            });
        }
    }

    function initializeGameDetailsPageFromHash(gameId) {
        if (gameId && allGames.length > 0) {
            const gameItem = allGames.find(g => g.game_id == gameId);
            if (gameItem) {
                renderGameDetails(gameItem);
            }
        }
    }

// =================================================================
// 場地預約頁 (從這裡開始取代)
// =================================================================
    /**
     * 【重構】初始化預約頁面
     * @param {string} [initialStep='step-preference'] - 初始要顯示的步驟
     */
    async function initializeBookingPage(stepId = 'step-preference') {
        // 顯示對應的步驟
        showBookingStep(stepId);
        
        // 綁定非 wizard 內的按鈕
        const viewMyBookingsBtn = document.getElementById('view-my-bookings-btn');
        if (viewMyBookingsBtn) {
            viewMyBookingsBtn.onclick = () => navigateTo('page-my-bookings');
        }

        // 填充動態文字
        try {
            const infoResponse = await fetch('/api/get-store-info');
            if (!infoResponse.ok) throw new Error('無法載入店家設定');
            const storeInfo = await infoResponse.json();
            
            document.getElementById('booking-announcement-box').innerText = storeInfo.booking_announcement_text || '';
            document.getElementById('go-to-booking-step-btn').innerText = storeInfo.booking_button_text || '開始預約';
            document.getElementById('booking-promo-text').innerText = storeInfo.booking_promo_text || '';

            const response = await fetch('/api/bookings-check?month-init=true');
            const data = await response.json();
            enabledDatesByAdmin = data.enabledDates || []; 
        } catch (error) {
            console.error("初始化預約頁面失敗:", error);
        }
        
        // 【關鍵修正】為預約流程容器建立獨立且唯一的事件監聽器
        const wizardContainer = document.getElementById('booking-wizard-container');
        if (wizardContainer && !wizardContainer.dataset.listenerAttached) {
            wizardContainer.dataset.listenerAttached = 'true'; // 標記已綁定，避免重複
            wizardContainer.addEventListener('click', (e) => {
                // 注意：這裡不再處理返回按鈕，已由全域監聽器統一處理
                if (e.target.closest('#go-to-booking-step-btn')) {
                    navigateTo('page-booking', 'step-date-and-slots');
                } else if (e.target.matches('#to-summary-btn')) {
                    handleBookingNextStep();
                } else if (e.target.matches('#confirm-booking-btn')) {
                    handleBookingConfirmation(e.target);
                }
            });
        }
        
        // Flatpickr 和自動填入資料邏輯
        const datepickerContainer = appContent.querySelector("#booking-datepicker-container");
        if (datepickerContainer) {
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
                        const slotsPlaceholder = document.getElementById('slots-placeholder');
                        if (slotsPlaceholder) {
                            slotsPlaceholder.textContent = '此日期未開放預約';
                            slotsPlaceholder.style.display = 'block';
                            document.getElementById('booking-slots-container').innerHTML = '';
                        }
                    }
                  }, 10);
                }
            });
        }

        const userData = await fetchGameData();
        if (userData) {
            const nameInput = document.getElementById('contact-name');
            const phoneInput = document.getElementById('contact-phone');
            if(nameInput) nameInput.value = userData.real_name || '';
            if(phoneInput) phoneInput.value = userData.phone || '';
        }
        
        // 如果是跳轉到 summary 步驟，需要重新渲染一次資料
        if (stepId === 'step-summary') {
            renderSummary();
        }
    }

    function showBookingStep(stepId) {
        document.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => {
            step.classList.toggle('active', step.id === stepId);
        });
    }

    // 新增這個函式
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
        // 驗證通過後，導航到下一步
        navigateTo('page-booking', 'step-summary');
    }

    // 當從 summary 頁返回時，需要重新渲染 summary 內容
    function initializeBookingSummary() {
         renderSummary();
    }
    
    // 從 `initializeBookingPage` 拆分出來的函式，保持不變
    async function fetchAndRenderSlots(date) {
        const slotsPlaceholder = document.getElementById('slots-placeholder');
        const slotsContainer = document.getElementById('booking-slots-container');
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
                    document.getElementById('contact-summary').textContent = `${bookingData.date} 的 ${bookingData.timeSlot}`;
                    // 導航到下一步
                    navigateTo('page-booking', 'step-contact');
                });
            });

        } catch (error) {
            slotsPlaceholder.textContent = `查詢空位失敗：${error.message}`;
        }
    }

function renderSummary() {
    const summaryCard = document.getElementById('booking-summary-card');
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

        document.getElementById('booking-result-content').innerHTML = `
            <h2 class="success">✅ 預約成功！</h2>
            <p>已將預約確認訊息發送至您的 LINE，我們到時見！</p>
            <button id="booking-done-btn" class="cta-button">返回預約首頁</button>`;
        showBookingStep('step-result');

        document.getElementById('booking-done-btn').addEventListener('click', () => showPage('page-booking'));

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

        // --- 【修改後的邏輯】 ---
        const addressText = info.address;
        const addressSpan = document.getElementById('store-address');
        const addressLink = document.getElementById('store-address-link');

        // 1. 填上地址文字
        if (addressSpan) {
            addressSpan.textContent = addressText;
        }

        // 2. 產生並設定Google地圖連結
        if (addressLink) {
            // 使用 encodeURIComponent 將地址轉換成安全的 URL 格式
            const encodedAddress = encodeURIComponent(addressText);
            addressLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }
        // --- 【修改結束】 ---

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

    // 啟動 LIFF
    initializeLiff();
});