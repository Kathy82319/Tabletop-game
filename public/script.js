document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 全域變數與 LIFF 初始化
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW"; // 你的 LIFF ID
    let userProfile = null; // 用來儲存使用者 LIFF Profile

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                // 登入成功後，先獲取一次使用者資料並儲存
                liff.getProfile().then(profile => {
                    userProfile = profile;
                    fetchGameData(profile); // 呼叫後端，處理使用者資料的取得或自動註冊
                }).catch(err => console.error("獲取 LINE Profile 失敗", err));
            }
        })
        .catch((err) => { console.error("LIFF 初始化失敗", err); });
        
    // =================================================================
    // 使用者資料相關函式
    // =================================================================
    function displayUserProfile() {
        if (!userProfile) return; // 確保 userProfile 有資料才執行
        document.getElementById('display-name').textContent = userProfile.displayName;
        document.getElementById('status-message').textContent = userProfile.statusMessage || '';
        const profilePicture = document.getElementById('profile-picture');
        if (userProfile.pictureUrl) {
            profilePicture.src = userProfile.pictureUrl;
        }
        
        const qrcodeElement = document.getElementById('qrcode');
        qrcodeElement.innerHTML = '';
        new QRCode(qrcodeElement, { text: userProfile.userId, width: 200, height: 200 });
    }

    async function fetchGameData(profile) { 
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl
                }),
            });
            if (!response.ok) { throw new Error('無法取得會員遊戲資料'); }
            
            const gameData = await response.json();

            let expToNextLevel = gameData.expToNextLevel || Math.floor(100 * Math.pow(gameData.level || 1, 1.5));

            document.getElementById('user-class').textContent = gameData.class;
            document.getElementById('user-level').textContent = gameData.level;
            document.getElementById('user-exp').textContent = `${gameData.current_exp} / ${expToNextLevel}`;

        } catch (error) {
            console.error('呼叫會員 API 失敗:', error);
        }
    }

    // =================================================================
    // 桌遊圖鑑 & 篩選功能區塊
    // =================================================================
    let allGames = [];
    let activeFilters = { keyword: '', tag: null };
    let gamesPageInitialized = false;

    const gameListContainer = document.getElementById('game-list-container');
    const keywordSearchInput = document.getElementById('keyword-search');
    const tagFiltersContainer = document.getElementById('tag-filters');
    const clearFiltersButton = document.getElementById('clear-filters');

    function renderGames() {
        let filteredGames = allGames;
        const keyword = activeFilters.keyword.toLowerCase().trim();
        if (keyword) {
            filteredGames = filteredGames.filter(game => 
                game.name.toLowerCase().includes(keyword) || 
                game.description.toLowerCase().includes(keyword)
            );
        }
        if (activeFilters.tag) {
            filteredGames = filteredGames.filter(game => 
                game.tags.split(',').map(t => t.trim()).includes(activeFilters.tag)
            );
        }

        gameListContainer.innerHTML = '';
        if (filteredGames.length === 0) {
            gameListContainer.innerHTML = '<p>找不到符合條件的遊戲。</p>';
            return;
        }

        filteredGames.forEach(game => {
            if (game.is_visible !== 'TRUE') return;
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            const img = document.createElement('img');
            img.src = game.image_url;
            img.alt = game.name;
            img.className = 'game-image';
            const infoContainer = document.createElement('div');
            infoContainer.className = 'game-info';
            const title = document.createElement('h3');
            title.className = 'game-title';
            title.textContent = game.name;
            const description = document.createElement('p');
            description.className = 'game-description';
            description.textContent = game.description;
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'game-tags';
            game.tags.split(',').forEach(tagStr => {
                const tag = tagStr.trim();
                if (tag) {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'game-tag';
                    tagElement.textContent = tag;
                    tagsContainer.appendChild(tagElement);
                }
            });
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'game-details';
            detailsContainer.innerHTML = `<span>👥 ${game.min_players}-${game.max_players} 人</span><span>⭐ 難度: ${game.difficulty}</span>`;
            
            infoContainer.appendChild(title);
            infoContainer.appendChild(description);
            infoContainer.appendChild(tagsContainer);
            infoContainer.appendChild(detailsContainer);
            gameCard.appendChild(img);
            gameCard.appendChild(infoContainer);
            gameListContainer.appendChild(gameCard);
        });
    }

    function populateFilters() {
        const allTags = new Set();
        allGames.forEach(game => {
            game.tags.split(',').forEach(tag => {
                const trimmedTag = tag.trim();
                if (trimmedTag) allTags.add(trimmedTag);
            });
        });
        
        tagFiltersContainer.innerHTML = '';
        allTags.forEach(tag => {
            const button = document.createElement('button');
            button.textContent = tag;
            button.dataset.tag = tag;
            button.addEventListener('click', () => {
                if (button.classList.contains('active')) {
                    activeFilters.tag = null;
                    button.classList.remove('active');
                } else {
                    tagFiltersContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    activeFilters.tag = tag;
                    button.classList.add('active');
                }
                renderGames();
            });
            tagFiltersContainer.appendChild(button);
        });
    }

    function setupFilterEventListeners() {
        keywordSearchInput.addEventListener('input', (e) => {
            activeFilters.keyword = e.target.value;
            renderGames();
        });
        clearFiltersButton.addEventListener('click', () => {
            activeFilters.keyword = '';
            activeFilters.tag = null;
            keywordSearchInput.value = '';
            tagFiltersContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            renderGames();
        });
    }

    async function initializeGamesPage() {
        if (gamesPageInitialized) return;
        gamesPageInitialized = true;
        try {
            const response = await fetch('/api/games');
            if (!response.ok) throw new Error('無法從 API 取得桌遊資料');
            allGames = await response.json();
            populateFilters();
            renderGames();
            setupFilterEventListeners();
        } catch (error) {
            console.error('初始化桌遊圖鑑失敗:', error);
            gameListContainer.innerHTML = '<p style="color: red;">讀取桌遊資料失敗，請稍後再試。</p>';
        }
    }

    // =================================================================
    // 場地預約功能區塊
    // =================================================================
    const TOTAL_TABLES = 5;
    const PEOPLE_PER_TABLE = 4;
    const AVAILABLE_TIME_SLOTS = ['14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'];
    const PRICES = { weekday: { '一次性': 150, '計時制': 50 }, weekend: { '一次性': 250, '計時制': 80 } };
    const ADVANCE_BOOKING_DISCOUNT = 20;

    let bookingPageInitialized = false;
    let bookingData = {}; 
    let bookingHistoryStack = [];

    function showBookingStep(stepId) {
        document.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => {
            step.classList.remove('active');
        });
        const targetStep = document.getElementById(stepId);
        if (targetStep) {
            targetStep.classList.add('active');
        }
        
        if(bookingHistoryStack[bookingHistoryStack.length - 1] !== stepId) {
            bookingHistoryStack.push(stepId);
        }
    }

    function goBackBookingStep() {
        if (bookingHistoryStack.length > 1) {
            bookingHistoryStack.pop(); 
            const lastStep = bookingHistoryStack[bookingHistoryStack.length - 1]; 
            showBookingStep(lastStep);
            return true; 
        }
        return false; 
    }

    function initializeBookingPage() {
        if (bookingPageInitialized) return;
        bookingPageInitialized = true;

        const allSteps = ['step-preference', 'step-date', 'step-slots', 'step-contact', 'step-summary', 'step-result'];
        const allElements = {};
        allSteps.forEach(id => allElements[id] = document.getElementById(id));
        
        allElements.preferenceBtns = document.querySelectorAll('.preference-btn');
        allElements.datepickerInput = document.getElementById('booking-datepicker-container');
        allElements.slotsContainer = document.getElementById('booking-slots-container');
        allElements.peopleInput = document.getElementById('booking-people');
        allElements.nameInput = document.getElementById('contact-name');
        allElements.phoneInput = document.getElementById('contact-phone');
        allElements.toSummaryBtn = document.getElementById('to-summary-btn');
        allElements.summaryCard = document.getElementById('booking-summary-card');
        allElements.confirmBtn = document.getElementById('confirm-booking-btn');
        allElements.resultContent = document.getElementById('booking-result-content');
        
        document.querySelectorAll('#page-booking .back-button').forEach(btn => {
            btn.addEventListener('click', () => goBackBookingStep());
        });

        allElements.preferenceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bookingData.preference = btn.dataset.preference;
                showBookingStep('step-date');
            });
        });

flatpickr(datepickerContainer, {
    inline: true, // << 核心改動：讓日曆直接顯示在頁面上，而不是彈出式
    minDate: new Date().fp_incr(1),
    dateFormat: "Y-m-d",
    locale: "zh_tw",
    onChange: function(selectedDates, dateStr, instance) {
        // ... 後續的 onChange 邏輯維持不變 ...
        const selectedDate = selectedDates[0];
        const dayOfWeek = selectedDate.getDay();
        bookingData.isWeekend = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6);
        
        const today = new Date(); today.setHours(0,0,0,0);
        const diffTime = selectedDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        bookingData.hasDiscount = (diffDays >= 3);

        bookingData.date = dateStr;
        fetchAndRenderSlots(dateStr);
        showBookingStep('step-slots');
    },
});

        async function fetchAndRenderSlots(date) {
            allElements.slotsContainer.innerHTML = '<p>正在查詢空位...</p>';
            try {
                const response = await fetch(`/api/bookings-check?date=${date}`);
                const bookedTablesBySlot = await response.json();
                allElements.slotsContainer.innerHTML = '';
                AVAILABLE_TIME_SLOTS.forEach(slot => {
                    const tablesBooked = bookedTablesBySlot[slot] || 0;
                    const tablesAvailable = TOTAL_TABLES - tablesBooked;
                    const button = document.createElement('button');
                    button.className = 'slot-button';
                    button.innerHTML = `${slot}<br><span style="font-size:0.8em; font-weight:normal;">剩餘 ${tablesAvailable} 桌</span>`;
                    if (tablesAvailable <= 0) {
                        button.classList.add('booked');
                        button.disabled = true;
                    } else {
                        button.classList.add('available');
                        button.addEventListener('click', () => {
                            bookingData.timeSlot = slot;
                            showBookingStep('step-contact');
                        });
                    }
                    allElements.slotsContainer.appendChild(button);
                });
            } catch (error) {
                allElements.slotsContainer.innerHTML = `<p style="color: red;">查詢空位失敗：${error.message}</p>`;
            }
        }

        allElements.toSummaryBtn.addEventListener('click', () => {
            bookingData.people = Number(allElements.peopleInput.value);
            bookingData.name = allElements.nameInput.value.trim();
            bookingData.phone = allElements.phoneInput.value.trim();
            if (!bookingData.people || !bookingData.name || !bookingData.phone || bookingData.phone.length < 10) {
                alert('請確實填寫所有資訊，並確認手機號碼為10碼！');
                return;
            }
            renderSummary();
            showBookingStep('step-summary');
        });
        
        function renderSummary() {
            const priceKey = bookingData.isWeekend ? 'weekend' : 'weekday';
            const basePrice = PRICES[priceKey][bookingData.preference];
            let finalPrice = basePrice * bookingData.people;
            let discountText = '';
            if (bookingData.preference === '一次性' && bookingData.hasDiscount) {
                const totalDiscount = ADVANCE_BOOKING_DISCOUNT * bookingData.people;
                finalPrice -= totalDiscount;
                discountText = `<p class="discount-text"><span>早鳥優惠折扣:</span><span>-$${totalDiscount}</span></p>`;
            }
            const priceSuffix = (bookingData.preference === '計時制') ? ' / 每小時' : '';
            allElements.summaryCard.innerHTML = `
                <p><span>姓名:</span><span>${bookingData.name}</span></p>
                <p><span>電話:</span><span>${bookingData.phone}</span></p>
                <p><span>日期:</span><span>${bookingData.date}</span></p>
                <p><span>時段:</span><span>${bookingData.timeSlot}</span></p>
                <p><span>人數:</span><span>${bookingData.people} 人</span></p>
                <p><span>消費方式:</span><span>${bookingData.preference}</span></p><hr>${discountText}
                <p><span>預估總金額:</span><span class="final-price">$${finalPrice}${priceSuffix}</span></p>`;
        }

        allElements.confirmBtn.addEventListener('click', async () => {
            allElements.confirmBtn.disabled = true;
            allElements.confirmBtn.textContent = '處理中...';
            try {
                const createResponse = await fetch('/api/bookings-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userProfile.userId, bookingDate: bookingData.date,
                        timeSlot: bookingData.timeSlot, numOfPeople: bookingData.people,
                        bookingPreference: bookingData.preference, contactName: bookingData.name,
                        contactPhone: bookingData.phone
                    })
                });
                const result = await createResponse.json();
                if (!createResponse.ok) throw new Error(result.error || '預約失敗');

                await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userProfile.userId, message: result.confirmationMessage })
                });

                allElements.resultContent.innerHTML = `
                    <h2 class="success">✅ 預約成功！</h2>
                    <p>已將預約確認訊息發送至您的 LINE，我們到時見！</p>
                    <button onclick="liff.closeWindow()" class="cta-button">關閉視窗</button>`;
                showBookingStep('step-result');

            } catch (error) {
                alert(`預約失敗：${error.message}`);
            } finally {
                allElements.confirmBtn.disabled = false;
                allElements.confirmBtn.textContent = '確認送出';
            }
        });
    }

    // =================================================================
    // 分頁切換邏輯
    // =================================================================
    const tabBar = document.getElementById('tab-bar');

    // ** 移除錯誤的 liff.events.on('back', ...) 監聽器 **

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            
            if (targetPageId === 'page-games') {
                initializeGamesPage();
            } else if (targetPageId === 'page-profile') {
                displayUserProfile();
                if (userProfile) fetchGameData(userProfile);
            } else if (targetPageId === 'page-booking') {
                if (!bookingPageInitialized) {
                    initializeBookingPage();
                }
                bookingHistoryStack = [];
                showBookingStep('step-preference');
            }

            showPage(targetPageId);
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        }
    });

    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
    }
    
    showPage('page-home');
});