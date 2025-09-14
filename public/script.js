// public/script.js (修正版)
document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 核心DOM元素與全域變數
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW";
    let userProfile = null;
    const appContent = document.getElementById('app-content');
    const pageTemplates = document.getElementById('page-templates');
    const tabBar = document.getElementById('tab-bar');
    let pageHistory = [];

    // 全域狀態變數
    let allGames = [];
    let allNews = []; 
    let activeFilters = { keyword: '', tag: null };
    let bookingData = {};
    let bookingHistoryStack = [];

    // =================================================================
    // 頁面切換邏輯
    // =================================================================
    function showPage(pageId, isBackAction = false) {
        const template = pageTemplates.querySelector(`#${pageId}`);
        if (template) {
            appContent.innerHTML = template.innerHTML;
            
            if (!isBackAction) {
                if (['page-home', 'page-games', 'page-profile', 'page-booking', 'page-info'].includes(pageId)) {
                    pageHistory = [pageId];
                } else {
                    pageHistory.push(pageId);
                }
            }
            
            switch (pageId) {
                case 'page-home': initializeHomePage(); break;
                case 'page-games': initializeGamesPage(); break;
                case 'page-profile': initializeProfilePage(); break;
                case 'page-booking': initializeBookingPage(); break;
                case 'page-info': initializeInfoPage(); break;
                case 'page-edit-profile': initializeEditProfilePage(); break;
            }
        } else {
            console.error(`在 page-templates 中找不到樣板: ${pageId}`);
        }
    }

    function goBackPage() {
        if (pageHistory.length > 1) {
            pageHistory.pop();
            showPage(pageHistory[pageHistory.length - 1], true);
        } else {
            liff.closeWindow();
        }
    }

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            showPage(button.dataset.target);
        }
    });
    
    appContent.addEventListener('click', (event) => {
        if (event.target.matches('.details-back-button')) goBackPage();
    });

    // =================================================================
    // LIFF 初始化 (唯一的、正確的區塊)
    // =================================================================
    liff.init({ liffId: myLiffId })
        .then(() => {
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                return liff.getProfile();
            }
        })
        .then(profile => {
            if (profile) {
                userProfile = profile;
            }
            showPage('page-home'); // 初始化成功後，不論是否有 profile 都顯示首頁
        })
        .catch((err) => {
            console.error("LIFF 初始化失敗", err);
            showPage('page-home'); // 即使失敗也顯示首頁
        });

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

        container.innerHTML = filteredNews.map(news => `
            <div class="news-card">
                <div class="news-card-header">
                    <span class="news-card-category">${news.category}</span>
                    <span class="news-card-date">${news.published_date}</span>
                </div>
                <div class="news-card-content">
                    <h3 class="news-card-title">${news.title}</h3>
                    ${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="news-card-image">` : ''}
                </div>
            </div>
        `).join('');
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
    
    // =================================================================
    // 店家資訊頁
    // =================================================================
    async function initializeInfoPage() {
        try {
            const response = await fetch('/api/get-store-info');
            if (!response.ok) throw new Error('無法獲取店家資訊');
            const info = await response.json();
            document.getElementById('store-name').textContent = info.name;
            document.getElementById('store-address').textContent = info.address;
            document.getElementById('store-phone').textContent = info.phone;
            document.getElementById('store-hours').textContent = info.opening_hours;
            document.getElementById('store-description').textContent = info.description;
        } catch (error) {
             console.error(error);
             document.getElementById('store-info-container').innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }
    // =================================================================
    // 使用者資料 & 個人資料頁
    // =================================================================
    function displayUserProfile(gameData) {
        if (!userProfile) return;
        document.getElementById('display-name').textContent = gameData?.nickname || userProfile.displayName;
        document.getElementById('status-message').textContent = userProfile.statusMessage || '';
        const profilePicture = document.getElementById('profile-picture');
        if (userProfile.pictureUrl) profilePicture.src = userProfile.pictureUrl;
        const qrcodeElement = document.getElementById('qrcode');
        if(qrcodeElement) {
            qrcodeElement.innerHTML = '';
            new QRCode(qrcodeElement, { text: userProfile.userId, width: 200, height: 200 });
        }
    }

    async function fetchGameData(profile) { 
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl }),
            });
            if (!response.ok) throw new Error('無法取得會員遊戲資料');
            const gameData = await response.json();
            
            displayUserProfile(gameData);
            
            const expToNextLevel = "10";
            const userClassEl = document.getElementById('user-class');
            const userLevelEl = document.getElementById('user-level');
            const userExpEl = document.getElementById('user-exp');

            if (userClassEl) {
                userClassEl.textContent = (gameData.class && gameData.class !== '無') ? gameData.class : "初心者";
            }
            if (userLevelEl) userLevelEl.textContent = gameData.level;
            if (userExpEl) userExpEl.textContent = `${gameData.current_exp} / ${expToNextLevel}`;
            
        } catch (error) {
            console.error('呼叫會員 API 失敗:', error);
        }
    }

    async function fetchAndDisplayMyBookings(userId) {
        const container = document.getElementById('my-bookings-container');
        if (!container) return;
        container.innerHTML = '<p>正在查詢您的預約紀錄...</p>';
        try {
            const response = await fetch(`/api/my-bookings?userId=${userId}`);
            if (!response.ok) throw new Error('查詢預約失敗');
            const bookings = await response.json();
            if (bookings.length === 0) {
                container.innerHTML = '<p>您目前沒有即將到來的預約。</p>';
            } else {
                container.innerHTML = '';
                bookings.forEach(booking => {
                    const card = document.createElement('div');
                    card.className = 'booking-info-card';
                    card.innerHTML = `<p class="booking-date-time">${booking.booking_date} - ${booking.time_slot}</p><p><strong>預約姓名：</strong> ${booking.contact_name}</p><p><strong>預約人數：</strong> ${booking.num_of_people} 人</p>`;
                    container.appendChild(card);
                });
            }
        } catch (error) {
            console.error('獲取個人預約失敗:', error);
            container.innerHTML = '<p style="color: red;">無法載入預約紀錄。</p>';
        }
    }
    
    function initializeProfilePage() {
        if (userProfile) {
            fetchGameData(userProfile);
            fetchAndDisplayMyBookings(userProfile.userId);
        }
        
        const editBtn = appContent.querySelector('#edit-profile-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => { 
                showPage('page-edit-profile'); 
            });
        }
    }

    async function initializeEditProfilePage() {
        if (!userProfile) {
            alert('無法獲取使用者資料，請稍後再試。');
            goBackPage();
            return;
        }
        
        const nameInput = appContent.querySelector('#edit-profile-name');
        if(nameInput) nameInput.value = userProfile.displayName;

        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userProfile.userId, displayName: userProfile.displayName, pictureUrl: userProfile.pictureUrl }),
            });
            const savedData = await response.json();

            const nicknameInput = appContent.querySelector('#edit-profile-nickname');
            const phoneInput = appContent.querySelector('#edit-profile-phone');
            const emailInput = appContent.querySelector('#edit-profile-email');
            if(nicknameInput) nicknameInput.value = savedData.nickname || '';
            if(phoneInput) phoneInput.value = savedData.phone || '';
            if(emailInput) emailInput.value = savedData.email || '';

            const gameSelect = appContent.querySelector('#edit-profile-games');
            const otherGameInput = appContent.querySelector('#edit-profile-games-other');
            if (gameSelect) {
                gameSelect.addEventListener('change', () => {
                    otherGameInput.style.display = (gameSelect.value === '其他') ? 'block' : 'none';
                });
            }
            
            const form = appContent.querySelector('#edit-profile-form');
            if (form) {
                form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const statusMsg = appContent.querySelector('#edit-profile-form-status');
                    
                    const phoneValue = phoneInput.value.trim();
                    if (phoneValue && (phoneValue.length !== 10 || !phoneValue.startsWith('09'))) {
                        alert('請輸入正確的10碼手機號碼，且必須為 09 開頭。');
                        return;
                    }

                    statusMsg.textContent = '儲存中...';
                    let preferredGames = gameSelect.value === '其他' ? otherGameInput.value.trim() : gameSelect.value;
                    if (preferredGames === "未提供") preferredGames = "";

                    const formData = {
                        userId: userProfile.userId,
                        nickname: nicknameInput.value.trim(),
                        phone: phoneValue,
                        email: emailInput.value.trim(),
                        preferredGames: preferredGames,
                        displayName: userProfile.displayName,
                        pictureUrl: userProfile.pictureUrl || ''
                    };

                    const updateResponse = await fetch('/api/update-user-profile', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
                    });
                    const result = await updateResponse.json();
                    if (!updateResponse.ok) throw new Error(result.error || '儲存失敗');
                    
                    statusMsg.textContent = '儲存成功！';
                    setTimeout(() => goBackPage(), 1000);
                });
            }
        } catch (error) {
            console.error('初始化編輯頁面失敗:', error);
            alert('無法載入您的資料，請返回上一頁再試。');
        }
    }


    // =================================================================
    // 桌遊圖鑑 & 詳情頁功能區塊 (此區塊無變動)
    // =================================================================
    function renderGameDetails(game) {
        const detailsTemplate = pageTemplates.querySelector('#page-game-details');
        if (!detailsTemplate) return;
        appContent.innerHTML = detailsTemplate.innerHTML;
        const isForSale = Number(game.for_sale_stock) > 0;
        const isForRent = Number(game.for_rent_stock) > 0;
        let priceHTML = '<div class="price-grid">';
        if (isForSale) { priceHTML += `<div class="price-item"><p>售價</p><p class="price-value">$${game.sale_price}</p><p class="stock-info">可販售庫存: ${game.for_sale_stock}</p></div><div class="price-item"><p>押金</p><p class="price-value">$${game.sale_price}</p><p class="stock-info">&nbsp;</p></div>`; }
        if (isForRent) { priceHTML += `<div class="price-item"><p>租金 (三天)</p><p class="price-value">$${game.rent_price}</p><p class="stock-info">可租借庫存: ${game.for_rent_stock}</p></div>`;}
        priceHTML += '</div>';
        const finalHTML = `<button class="details-back-button">← 返回圖鑑</button><div class="details-header"><img src="${game.image_url}" alt="${game.name}" class="details-image"><h1 class="details-title">${game.name}</h1></div><div class="details-section"><h3>遊戲簡介</h3><p>${game.description}</p></div><div class="details-section"><h3>價格與庫存</h3>${priceHTML}</div><div class="details-section"><h3>租借規則說明</h3><ol class="rules-list"><li>每筆租借基本天數為三天。</li><li>最長可延期至15天，每日 $20。</li><li>未提前申請延期且超過三天者視為逾期，逾期每日 $40 計算。</li><li>押金為該桌遊售價，歸還若發現缺件或毀損，將沒收押金。</li><li>每位使用者最多同時租借三款桌遊。</li></ol></div>`;
        appContent.innerHTML = finalHTML;
    }
    function renderGames() {
        const gameListContainer = appContent.querySelector('#game-list-container');
        if(!gameListContainer) return;
        let filteredGames = allGames.filter(g => g.is_visible === 'TRUE');
        const keyword = activeFilters.keyword.toLowerCase().trim();
        if (keyword) { filteredGames = filteredGames.filter(g => g.name.toLowerCase().includes(keyword) || g.description.toLowerCase().includes(keyword)); }
        if (activeFilters.tag) { filteredGames = filteredGames.filter(g => g.tags.split(',').map(t => t.trim()).includes(activeFilters.tag)); }
        gameListContainer.innerHTML = '';
        if (filteredGames.length === 0) { gameListContainer.innerHTML = '<p>找不到符合條件的遊戲。</p>'; return; }
        filteredGames.forEach(game => {
            const gameCard = document.createElement('div'); gameCard.className = 'game-card';
            gameCard.addEventListener('click', () => { pageHistory.push('page-games'); renderGameDetails(game); });
            const img = document.createElement('img'); img.src = game.image_url; img.alt = game.name; img.className = 'game-image';
            const info = document.createElement('div'); info.className = 'game-info';
            const title = document.createElement('h3'); title.className = 'game-title'; title.textContent = game.name;
            const desc = document.createElement('p'); desc.className = 'game-description'; desc.textContent = game.description;
            const tags = document.createElement('div'); tags.className = 'game-tags';
            game.tags.split(',').forEach(t => { if(t.trim()) { const tagEl = document.createElement('span'); tagEl.className = 'game-tag'; tagEl.textContent = t.trim(); tags.appendChild(tagEl); } });
            const details = document.createElement('div'); details.className = 'game-details';
            details.innerHTML = `<span>👥 ${game.min_players}-${game.max_players} 人</span><span>⭐ 難度: ${game.difficulty}</span>`;
            info.append(title, desc, tags, details);
            gameCard.append(img, info);
            gameListContainer.appendChild(gameCard);
        });
    }
    function populateFilters() {
        const tagFiltersContainer = appContent.querySelector('#tag-filters');
        if(!tagFiltersContainer) return;
        const allTags = new Set(allGames.flatMap(g => g.tags.split(',')).map(t => t.trim()).filter(Boolean));
        tagFiltersContainer.innerHTML = '';
        allTags.forEach(tag => {
            const btn = document.createElement('button'); btn.textContent = tag; btn.dataset.tag = tag;
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) { activeFilters.tag = null; btn.classList.remove('active'); }
                else { tagFiltersContainer.querySelectorAll('button').forEach(b => b.classList.remove('active')); activeFilters.tag = tag; btn.classList.add('active'); }
                renderGames();
            });
            tagFiltersContainer.appendChild(btn);
        });
    }
    function setupFilterEventListeners() {
        const keywordSearchInput = appContent.querySelector('#keyword-search');
        const clearFiltersButton = appContent.querySelector('#clear-filters');
        if(!keywordSearchInput || !clearFiltersButton) return;
        keywordSearchInput.addEventListener('input', e => { activeFilters.keyword = e.target.value; renderGames(); });
        clearFiltersButton.addEventListener('click', () => {
            activeFilters.keyword = ''; activeFilters.tag = null; keywordSearchInput.value = '';
            appContent.querySelectorAll('#tag-filters button').forEach(b => b.classList.remove('active'));
            renderGames();
        });
    }
    async function initializeGamesPage() {
        if (allGames.length > 0) { renderGames(); populateFilters(); setupFilterEventListeners(); return; }
        const gameListContainer = appContent.querySelector('#game-list-container');
        try {
            const res = await fetch('/api/games');
            if (!res.ok) throw new Error('API 請求失敗');
            allGames = await res.json();
            renderGames();
            populateFilters();
            setupFilterEventListeners();
        } catch (error) {
            console.error('初始化桌遊圖鑑失敗:', error);
            if(gameListContainer) gameListContainer.innerHTML = '<p style="color: red;">讀取桌遊資料失敗。</p>';
        }
    }
    // =================================================================
    // 場地預約功能區塊 (此區塊無變動)
    // =================================================================
    function showBookingStep(stepId) {
        document.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => step.classList.remove('active'));
        const targetStep = document.getElementById(stepId);
        if (targetStep) targetStep.classList.add('active');
        if(bookingHistoryStack[bookingHistoryStack.length - 1] !== stepId) bookingHistoryStack.push(stepId);
    }
    function goBackBookingStep() {
        if (bookingHistoryStack.length > 1) { bookingHistoryStack.pop(); const lastStep = bookingHistoryStack[bookingHistoryStack.length - 1]; showBookingStep(lastStep); return true; }
        return false;
    }
    function initializeBookingPage() {
        bookingHistoryStack = [];
        showBookingStep('step-preference');
        const elements = { wizardContainer: document.getElementById('booking-wizard-container'), preferenceBtns: document.querySelectorAll('.preference-btn'), datepickerContainer: document.getElementById('booking-datepicker-container'), slotsWrapper: document.getElementById('booking-slots-wrapper'), slotsPlaceholder: document.getElementById('slots-placeholder'), slotsContainer: document.getElementById('booking-slots-container'), contactSummary: document.getElementById('contact-summary'), peopleInput: document.getElementById('booking-people'), nameInput: document.getElementById('contact-name'), phoneInput: document.getElementById('contact-phone'), toSummaryBtn: document.getElementById('to-summary-btn'), summaryCard: document.getElementById('booking-summary-card'), confirmBtn: document.getElementById('confirm-booking-btn'), resultContent: document.getElementById('booking-result-content'),};
        elements.wizardContainer.addEventListener('click', e => { if (e.target.matches('.back-button')) goBackBookingStep(); });
        elements.preferenceBtns.forEach(btn => { btn.addEventListener('click', () => { showBookingStep('step-date-and-slots'); }); });
        const flatpickrInstance = flatpickr(elements.datepickerContainer, { inline: true, minDate: new Date().fp_incr(1), dateFormat: "Y-m-d", locale: "zh_tw", onChange: (selectedDates, dateStr) => { const day = selectedDates[0].getDay(); bookingData.isWeekend = (day === 0 || day === 5 || day === 6); const today = new Date(); today.setHours(0,0,0,0); bookingData.hasDiscount = Math.ceil((selectedDates[0] - today) / (1000 * 60 * 60 * 24)) >= 3; bookingData.date = dateStr; fetchAndRenderSlots(dateStr); }, });
        async function fetchAndRenderSlots(date) {
            elements.slotsPlaceholder.textContent = '正在查詢當日空位...';
            elements.slotsContainer.innerHTML = '';
            elements.slotsPlaceholder.style.display = 'block';
            try {
                const response = await fetch(`/api/bookings-check?date=${date}`);
                if (!response.ok) throw new Error('查詢失敗');
                dailyAvailability = await response.json();
                elements.slotsContainer.innerHTML = '';
                if (dailyAvailability.available <= 0) { elements.slotsPlaceholder.textContent = '抱歉，本日預約已額滿'; return; }
                elements.slotsPlaceholder.style.display = 'none';
                AVAILABLE_TIME_SLOTS.forEach(slot => { const btn = document.createElement('button'); btn.className = 'slot-button available'; btn.textContent = slot; btn.addEventListener('click', () => { bookingData.timeSlot = slot; elements.contactSummary.textContent = `${bookingData.date} 的 ${slot}`; showBookingStep('step-contact'); }); elements.slotsContainer.appendChild(btn); });
            } catch (error) { elements.slotsPlaceholder.textContent = `查詢空位失敗：${error.message}`; elements.slotsPlaceholder.style.color = 'red'; }
        }
        elements.toSummaryBtn.addEventListener('click', () => {
            bookingData.people = Number(elements.peopleInput.value); bookingData.name = elements.nameInput.value.trim(); bookingData.phone = elements.phoneInput.value.trim();
            if (!bookingData.people || !bookingData.name || bookingData.phone.length < 10) { alert('請確實填寫所有資訊，並確認手機號碼為10碼！'); return; }
            const tablesNeeded = Math.ceil(bookingData.people / PEOPLE_PER_TABLE);
            if (tablesNeeded > dailyAvailability.available) { alert(`抱歉，座位不足！您需要 ${tablesNeeded} 桌，但當日僅剩 ${dailyAvailability.available} 桌可預約。`); return; }
            renderSummary(); showBookingStep('step-summary');
        });
        function renderSummary() {
            const priceKey = bookingData.isWeekend ? 'weekend' : 'weekday'; const basePrice = PRICES[priceKey]; let finalPrice = basePrice * bookingData.people; let discountText = '';
            if (bookingData.hasDiscount) { const totalDiscount = ADVANCE_BOOKING_DISCOUNT * bookingData.people; finalPrice -= totalDiscount; discountText = `<p class="discount-text"><span>早鳥優惠折扣:</span><span>-$${totalDiscount}</span></p>`; }
            elements.summaryCard.innerHTML = `<p><span>姓名:</span><span>${bookingData.name}</span></p><p><span>電話:</span><span>${bookingData.phone}</span></p><p><span>日期:</span><span>${bookingData.date}</span></p><p><span>時段:</span><span>${bookingData.timeSlot}</span></p><p><span>人數:</span><span>${bookingData.people} 人</span></p><hr>${discountText}<p><span>預估總金額:</span><span class="final-price">$${finalPrice}</span></p>`;
        }
elements.confirmBtn.addEventListener('click', async () => {
    // ** 關鍵修正：增加 isSubmitting 旗標防止重複提交 **
    if (elements.confirmBtn.dataset.isSubmitting === 'true') return;

    try {
        elements.confirmBtn.dataset.isSubmitting = 'true'; // 標記為提交中
        elements.confirmBtn.disabled = true;
        elements.confirmBtn.textContent = '處理中...';
        
        const createRes = await fetch('/api/bookings-create', { /* ... fetch 內容不變 ... */ });
        const result = await createRes.json();
        if (!createRes.ok) throw new Error(result.error || '預約失敗');
        
        await fetch('/api/send-message', { /* ... fetch 內容不變 ... */ });

        elements.resultContent.innerHTML = `<h2 class="success">✅ 預約成功！</h2><p>已將預約確認訊息發送至您的 LINE，我們到時見！</p><button id="booking-done-btn" class="cta-button">返回預約首頁</button>`;
        showBookingStep('step-result');

        document.getElementById('booking-done-btn').addEventListener('click', () => { /* ... 內容不變 ... */ });

    } catch (error) {
        alert(`預約失敗：${error.message}`);
        // ** 關鍵修正：失敗時也要恢復按鈕狀態 **
        elements.confirmBtn.dataset.isSubmitting = 'false';
        elements.confirmBtn.disabled = false;
        elements.confirmBtn.textContent = '確認送出';
    }
        });
    }

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            showPage(targetPageId);
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            if (targetPageId === 'page-games') initializeGamesPage();
            else if (targetPageId === 'page-profile') {
                initializeProfilePage();
            } else if (targetPageId === 'page-booking') {
                initializeBookingPage();
            }
        }
    });

        // =================================================================
    // ** 全新 ** 首頁 (最新情報)
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

        container.innerHTML = filteredNews.map(news => `
            <div class="news-card">
                <div class="news-card-header">
                    <span class="news-card-category">${news.category}</span>
                    <span class="news-card-date">${news.published_date}</span>
                </div>
                <div class="news-card-content">
                    <h3 class="news-card-title">${news.title}</h3>
                    ${news.image_url ? `<img src="${news.image_url}" alt="${news.title}" class="news-card-image">` : ''}
                </div>
            </div>
        `).join('');
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
    
    // =================================================================
    // ** 全新 ** 店家資訊頁
    // =================================================================
    async function initializeInfoPage() {
        try {
            const response = await fetch('/api/get-store-info');
            if (!response.ok) throw new Error('無法獲取店家資訊');
            const info = await response.json();
            document.getElementById('store-name').textContent = info.name;
            document.getElementById('store-address').textContent = info.address;
            document.getElementById('store-phone').textContent = info.phone;
            document.getElementById('store-hours').textContent = info.opening_hours;
            document.getElementById('store-description').textContent = info.description;
        } catch (error) {
             console.error(error);
             document.getElementById('store-info-container').innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }
    
    showPage('page-home');
});