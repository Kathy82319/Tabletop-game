// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 核心DOM元素與全域變數
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW";
    let userProfile = null;
    let gameData = {}; // 用於快取使用者遊戲資料
    const appContent = document.getElementById('app-content');
    const pageTemplates = document.getElementById('page-templates');
    const tabBar = document.getElementById('tab-bar');

    const TOTAL_TABLES = 4;
    const PEOPLE_PER_TABLE = 4;
    const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];

    let myRentals = [];
    let allGames = [];
    let allNews = [];
    let pageHistory = ['page-home'];
    let activeFilters = { keyword: '', tag: null };
    let bookingData = {};
    let bookingHistoryStack = [];
    let dailyAvailability = { limit: TOTAL_TABLES, booked: 0, available: TOTAL_TABLES };
    let disabledDatesByAdmin = [];

    // =================================================================
    // 頁面切換邏輯
    // =================================================================
    function showPage(pageId, isBackAction = false) {
        const template = pageTemplates.querySelector(`#${pageId}`);
        if (template) {
            appContent.innerHTML = template.innerHTML;
            
            const state = { page: pageId };
            const url = `#${pageId}`;

            if (!isBackAction) {
                if (['page-home', 'page-games', 'page-profile', 'page-booking', 'page-info'].includes(pageId)) {
                    pageHistory = [pageId];
                    history.replaceState(state, '', url);
                } else {
                    pageHistory.push(pageId);
                    history.pushState(state, '', url);
                }
            }
            
            const pageInitializers = {
                'page-home': initializeHomePage,
                'page-games': initializeGamesPage,
                'page-profile': initializeProfilePage,
                'page-my-bookings': initializeMyBookingsPage,
                'page-my-exp-history': initializeMyExpHistoryPage,
                'page-rental-history': initializeRentalHistoryPage,
                'page-booking': initializeBookingPage,
                'page-info': initializeInfoPage,
                'page-edit-profile': initializeEditProfilePage,
            };

            if (pageInitializers[pageId]) {
                pageInitializers[pageId]();
            }

            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.target === pageHistory[0]);
            });

        } else {
            console.error(`在 page-templates 中找不到樣板: ${pageId}`);
        }
    }

    function goBackPage() {
        if (pageHistory.length > 1) {
            history.back();
        } else {
            liff.closeWindow();
        }
    }

    window.addEventListener('popstate', (event) => {
        if (pageHistory.length > 1) {
            pageHistory.pop();
            const previousPageId = pageHistory[pageHistory.length - 1];
            showPage(previousPageId, true);
        }
    });
    
    appContent.addEventListener('click', (event) => {
        if (event.target.matches('.details-back-button')) {
             goBackPage();
             return;
        }

        const newsCard = event.target.closest('.news-card');
        if (newsCard && newsCard.dataset.newsId) {
            const newsId = parseInt(newsCard.dataset.newsId, 10);
            const newsItem = allNews.find(n => n.id === newsId);
            if (newsItem) {
                showPage('page-news-details');
                renderNewsDetails(newsItem);
            }
        }
        
        const gameCard = event.target.closest('.game-card');
        if (gameCard && gameCard.dataset.gameId) {
            const gameId = gameCard.dataset.gameId;
            const gameItem = allGames.find(g => g.game_id == gameId);
            if (gameItem) {
                showPage('page-game-details');
                renderGameDetails(gameItem);
            }
        }
    });

    // =================================================================
    // 首頁 (最新情報)
    // =================================================================
// public/script.js
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
        // 產生內文摘要，最多截取 50 個字
        const snippet = news.content ? news.content.substring(0, 50) + '...' : '';
        // 決定是否要顯示圖片
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

// =================================================================
// LIFF 初始化 (更新版)
// =================================================================

// 【步驟 1: 新增這個函式】
// 這個函式專門用來決定 LIFF 載入後要顯示哪個頁面
function handleInitialRouting() {
    const hash = window.location.hash; // 獲取網址中 # 後面的部分

    // 如果 hash 存在且對應到某個頁面 (例如 #page-profile)
    // 我們就把 # 拿掉，得到 page-profile
    const pageId = hash ? hash.substring(1) : 'page-home';

    // 檢查這個 pageId 是否真的存在於我們的 HTML 樣板中
    const templateExists = document.getElementById(pageId);

    if (templateExists) {
        showPage(pageId); // 如果存在，就顯示對應頁面
    } else {
        showPage('page-home'); // 如果不存在或沒有 hash，就顯示首頁
    }
}

// 【步驟 2: 修改這個函式】
// 使用 async/await 讓程式碼更清晰
async function initializeLiff() {
    try {
        await liff.init({ liffId: myLiffId });

        if (!liff.isLoggedIn()) {
            liff.login();
            return; // 登入後會重新導向，後面的程式碼不會執行
        }

        // 成功登入後，先取得使用者資料
        userProfile = await liff.getProfile();

        // 【最關鍵的修改！】
        // 初始化和登入都完成後，才呼叫路由函式去判斷要顯示哪個頁面
        handleInitialRouting();

    } catch (err) {
        console.error("LIFF 初始化或 Profile 獲取失敗", err);
        // 即使失敗，也顯示首頁，避免畫面空白
        showPage('page-home');
    }
}
    // =================================================================
    // 個人資料頁
    // =================================================================
async function initializeProfilePage() {
    if (!userProfile) return;

    // --- 【需求 2.2 修正開始】 ---

    // 1. 將畫面元素先設定為讀取中狀態，確保每次進入頁面都會重置
    const displayNameElement = document.getElementById('display-name');
    if (displayNameElement) displayNameElement.textContent = '讀取中...';
    
    const profilePicture = document.getElementById('profile-picture');
    if (userProfile.pictureUrl) profilePicture.src = userProfile.pictureUrl;

    const qrcodeElement = document.getElementById('qrcode');
    if(qrcodeElement) {
        qrcodeElement.innerHTML = ''; // 清空舊的 QR Code
        new QRCode(qrcodeElement, { text: userProfile.userId, width: 150, height: 150 });
    }
    
    // 綁定按鈕事件
    document.getElementById('edit-profile-btn').addEventListener('click', () => showPage('page-edit-profile'));
    document.getElementById('my-bookings-btn').addEventListener('click', () => showPage('page-my-bookings'));
    document.getElementById('my-exp-history-btn').addEventListener('click', () => showPage('page-my-exp-history'));
    document.getElementById('rental-history-btn').addEventListener('click', () => showPage('page-rental-history'));
    
    // 2. 【核心修正】: 強制每次都重新 fetchGameData
    //    不再使用快取，確保資料永遠是最新
    try {
        const userData = await fetchGameData(true); // 傳入 true 表示強制刷新
        updateProfileDisplay(userData);
    } catch (error) {
        console.error("無法更新個人資料畫面:", error);
        if (displayNameElement) displayNameElement.textContent = '資料載入失敗';
    }
    // --- 【需求 2.2 修正結束】 ---
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
        if (!userProfile) return;

        document.getElementById('edit-profile-name').value = userProfile.displayName;

        const userData = await fetchGameData();
        if (!userData) return;
        
        document.getElementById('edit-profile-real-name').value = userData.real_name || '';
        document.getElementById('edit-profile-nickname').value = userData.nickname || '';
        document.getElementById('edit-profile-phone').value = userData.phone || '';
        document.getElementById('edit-profile-email').value = userData.email || '';
        


    // ** 需求 3 修改：處理偏好遊戲多選 **
    const gamesContainer = document.getElementById('preferred-games-container');
    if (gamesContainer) {
        // 從 allGames 變數中提取所有不重複的標籤
        const allTags = [...new Set(allGames.flatMap(g => (g.tags || '').split(',')).map(t => t.trim()).filter(Boolean))];
        
        // 使用者已選的標籤 (從字串轉為陣列)
        const userTags = (userData.preferred_games || '').split(',').filter(Boolean);

        gamesContainer.innerHTML = allTags.map(tag => {
            const isActive = userTags.includes(tag) ? 'active' : '';
            return `<button type="button" class="game-preference-tag ${isActive}" data-tag="${tag}">${tag}</button>`;
        }).join('');

        // 綁定點擊事件
        gamesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('game-preference-tag')) {
                e.target.classList.toggle('active');
            }
        });
    }

    const form = document.getElementById('edit-profile-form');
    form.onsubmit = async (event) => {
        event.preventDefault();
        const statusMsg = document.getElementById('edit-profile-form-status');

            const realNameInput = document.getElementById('edit-profile-real-name');
            const realName = realNameInput.value.trim();
            const chineseCharCount = (realName.match(/[\u4e00-\u9fa5]/g) || []).length;
            const englishCharCount = (realName.match(/[a-zA-Z]/g) || []).length;

            if (chineseCharCount > 10) {
                statusMsg.textContent = '錯誤：姓名欄位中文字數不可超過 10 個字。';
                statusMsg.style.color = 'red';
                return;
            }
            if (englishCharCount > 20) {
                statusMsg.textContent = '錯誤：姓名欄位英文字母不可超過 20 個。';
                statusMsg.style.color = 'red';
                return;
            }

            statusMsg.textContent = '儲存中...';
        // ** 需求 3 修改：從按鈕狀態收集偏好遊戲 **
        let selectedGames = [];
        if (gamesContainer) {
            selectedGames = Array.from(gamesContainer.querySelectorAll('.game-preference-tag.active')).map(btn => btn.dataset.tag);
        }

        const formData = {
            userId: userProfile.userId,
            realName: realName,
            nickname: document.getElementById('edit-profile-nickname').value,
            phone: document.getElementById('edit-profile-phone').value,
            email: document.getElementById('edit-profile-email').value,
            preferredGames: selectedGames, // 傳送陣列
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl || ''
        };

        try {
            const response = await fetch('/api/update-user-profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '儲存失敗');
            
            gameData = {}; // 清空快取以便下次刷新
            statusMsg.textContent = '儲存成功！';
            statusMsg.style.color = 'green';
            setTimeout(() => goBackPage(), 1500);

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
        container.innerHTML = filteredGames.map(game => `
            <div class="game-card" data-game-id="${game.game_id}">
                <img src="${game.image_url || 'placeholder.jpg'}" alt="${game.name}" class="game-image">
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                    <p class="game-description">${game.description}</p>
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
    function showBookingStep(stepId) {
        document.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => step.classList.remove('active'));
        const targetStep = document.getElementById(stepId);
        if (targetStep) targetStep.classList.add('active');

        // ** 新增的關鍵邏輯 **
        // 當顯示的是「選擇日期」這一步時，強制重置時段區塊的狀態
        if (stepId === 'step-date-and-slots') {
            const slotsPlaceholder = document.getElementById('slots-placeholder');
            const slotsContainer = document.getElementById('booking-slots-container');
            if (slotsPlaceholder && slotsContainer) {
                // 恢復提示文字
                slotsPlaceholder.textContent = '請先從上方選擇日期';
                // 確保提示文字是可見的
                slotsPlaceholder.style.display = 'block';
                // 清空任何可能殘留的時段按鈕
                slotsContainer.innerHTML = '';
            }
        }

        if(bookingHistoryStack[bookingHistoryStack.length - 1] !== stepId) {
            bookingHistoryStack.push(stepId);
        }
    }

    function goBackBookingStep() {
        if (bookingHistoryStack.length > 1) {
            bookingHistoryStack.pop();
            const lastStep = bookingHistoryStack[bookingHistoryStack.length - 1];
            showBookingStep(lastStep); // 呼叫我們修改過的新函式
            return true;
        }
        return false;
    }

// public/script.js
    async function initializeBookingPage() {
        bookingHistoryStack = [];
        showBookingStep('step-preference');

        document.getElementById('view-my-bookings-btn').addEventListener('click', () => {
            showPage('page-my-bookings');
        });

        try {
            // 請求的 API 端點不變，但後端回傳的內容已改變
            const response = await fetch('/api/bookings-check?month-init=true');
            const data = await response.json();
            // 將接收到的資料存到 enabledDatesByAdmin
            enabledDatesByAdmin = data.enabledDates || []; 
        } catch (error) {
            console.error("獲取可預約日期失敗:", error);
            enabledDatesByAdmin = [];
        }

        const wizardContainer = document.getElementById('booking-wizard-container');
        if (wizardContainer) {
            wizardContainer.addEventListener('click', async (e) => {
            // ... (原本的 click 事件邏輯不變) ...
             if (e.target.matches('.back-button')) {
                goBackBookingStep();
            } else if (e.target.closest('.preference-btn')) {
                showBookingStep('step-date-and-slots');
            } else if (e.target.matches('#to-summary-btn')) {
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
                    alert(`抱歉，座位不足！您需要 ${tablesNeeded} 桌，但當日僅剩 ${dailyAvailability.available} 桌可預約。`);
                    return;
                }
                renderSummary();
                showBookingStep('step-summary');
            } else if (e.target.matches('#confirm-booking-btn')) {
                await handleBookingConfirmation(e.target);
            }
        });
    }

    // 【關鍵修改】選取當前頁面上的日曆容器來初始化
        const datepickerContainer = appContent.querySelector("#booking-datepicker-container");
        if (datepickerContainer) {
            // 【** 請用下面的版本完整取代你現有的 flatpickr() 初始化區塊 **】
            flatpickr(datepickerContainer, {
                inline: true,
                minDate: "today",
                dateFormat: "Y-m-d",
                locale: "zh_tw",
                enable: enabledDatesByAdmin,
                
                // onChange 事件只會在點擊 "可選取" 日期時觸發，這是正確的
                onChange: (selectedDates, dateStr) => {
                    bookingData.date = dateStr;
                    fetchAndRenderSlots(dateStr);
                },

                // ** 新增 onClick 事件來處理所有點擊 **
                // 無論點擊的是否為可選日期，這個事件都會觸發
                onClick: (selectedDates, dateStr, instance) => {
                    // 檢查被點擊的日期元素是否包含 'flatpickr-disabled' class
                    // 我們需要稍微延遲檢查，確保 flatpickr 完成了 class 的更新
                    setTimeout(() => {
                        const clickedElement = instance.selectedDateElem;
                        if (clickedElement && clickedElement.classList.contains('flatpickr-disabled')) {
                            // 如果是不可選的日期，就重置時段選擇區
                            const slotsPlaceholder = document.getElementById('slots-placeholder');
                            const slotsContainer = document.getElementById('booking-slots-container');
                            if (slotsPlaceholder && slotsContainer) {
                                slotsPlaceholder.textContent = '此日期未開放預約'; // 給予更明確的提示
                                slotsPlaceholder.style.display = 'block';
                                slotsContainer.innerHTML = '';
                            }
                        }
                    }, 10); // 10毫秒的延遲通常就足夠了
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
    }

    async function fetchAndRenderSlots(date) {
        const slotsPlaceholder = document.getElementById('slots-placeholder');
        const slotsContainer = document.getElementById('booking-slots-container');
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
                    showBookingStep('step-contact');
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
            document.getElementById('store-address').textContent = info.address;
            document.getElementById('store-phone').textContent = info.phone;
            document.getElementById('store-hours').innerHTML = info.opening_hours.replace(/\n/g, '<br>');
            document.getElementById('store-description').innerHTML = info.description.replace(/\n/g, '<br>');
        } catch (error) {
             document.getElementById('store-info-container').innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }

    // =================================================================
    // Tab Bar 主導航
    // =================================================================
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            showPage(targetPageId);
        }
    });

    // 啟動 LIFF
    initializeLiff();
});