document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 全域變數與 LIFF 初始化
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW";
    let userProfile = null;

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                liff.getProfile().then(profile => {
                    userProfile = profile;
                    fetchGameData(profile);
                }).catch(err => console.error("獲取 LINE Profile 失敗", err));
            }
        })
        .catch((err) => { console.error("LIFF 初始化失敗", err); });
        
    // =================================================================
    // 使用者資料相關函式 (與之前相同)
    // =================================================================
    function displayUserProfile() {
        if (!userProfile) return;
        document.getElementById('display-name').textContent = userProfile.displayName;
        document.getElementById('status-message').textContent = userProfile.statusMessage || '';
        const profilePicture = document.getElementById('profile-picture');
        if (userProfile.pictureUrl) profilePicture.src = userProfile.pictureUrl;
        const qrcodeElement = document.getElementById('qrcode');
        qrcodeElement.innerHTML = '';
        new QRCode(qrcodeElement, { text: userProfile.userId, width: 200, height: 200 });
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
    // 場地預約功能區塊 (全新多步驟流程 + 返回鍵處理)
    // =================================================================
    const TOTAL_TABLES = 5;
    const PEOPLE_PER_TABLE = 4;
    const AVAILABLE_TIME_SLOTS = ['14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'];
    const PRICES = { weekday: { '一次性': 150, '計時制': 50 }, weekend: { '一次性': 250, '計時制': 80 } };
    const ADVANCE_BOOKING_DISCOUNT = 20;

    let bookingPageInitialized = false;
    let bookingData = {}; // 用於儲存預約流程中的所有資料
    let bookingHistoryStack = []; // 用於處理返回鍵

    function showBookingStep(stepId) {
        document.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(stepId).classList.add('active');
        
        // 更新歷史紀錄
        if(bookingHistoryStack[bookingHistoryStack.length - 1] !== stepId) {
            bookingHistoryStack.push(stepId);
        }
    }

    function goBackBookingStep() {
        if (bookingHistoryStack.length > 1) {
            bookingHistoryStack.pop(); // 移除目前步驟
            const lastStep = bookingHistoryStack[bookingHistoryStack.length - 1]; // 取得上一個步驟
            showBookingStep(lastStep);
            return true; // 表示成功返回
        }
        return false; // 表示已在第一步，無法返回
    }

    function initializeBookingPage() {
        if (bookingPageInitialized) return;
        bookingPageInitialized = true;

        const allSteps = ['step-preference', 'step-date', 'step-slots', 'step-contact', 'step-summary', 'step-result'];
        const allElements = {};
        allSteps.forEach(id => allElements[id] = document.getElementById(id));
        
        // 獲取所有互動元素
        allElements.preferenceBtns = document.querySelectorAll('.preference-btn');
        allElements.datepickerInput = document.getElementById('booking-datepicker');
        allElements.slotsContainer = document.getElementById('booking-slots-container');
        allElements.peopleInput = document.getElementById('booking-people');
        allElements.nameInput = document.getElementById('contact-name');
        allElements.phoneInput = document.getElementById('contact-phone');
        allElements.toSummaryBtn = document.getElementById('to-summary-btn');
        allElements.summaryCard = document.getElementById('booking-summary-card');
        allElements.confirmBtn = document.getElementById('confirm-booking-btn');
        allElements.resultContent = document.getElementById('booking-result-content');
        
        // 綁定所有返回按鈕
        document.querySelectorAll('#page-booking .back-button').forEach(btn => {
            btn.addEventListener('click', () => goBackBookingStep());
        });

        // 步驟 1: 選擇消費方式
        allElements.preferenceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bookingData.preference = btn.dataset.preference;
                showBookingStep('step-date');
            });
        });

        // 步驟 2: 選擇日期
        flatpickr(allElements.datepickerInput, {
            minDate: new Date().fp_incr(1),
            dateFormat: "Y-m-d",
            locale: "zh_tw",
            onChange: (selectedDates, dateStr) => {
                const day = selectedDates[0].getDay();
                bookingData.isWeekend = (day === 0 || day === 5 || day === 6);
                const today = new Date(); today.setHours(0,0,0,0);
                const diffDays = Math.ceil((selectedDates[0] - today) / (1000 * 60 * 60 * 24));
                bookingData.hasDiscount = (diffDays >= 3);
                bookingData.date = dateStr;
                fetchAndRenderSlots(dateStr);
                showBookingStep('step-slots');
            },
        });

        // 步驟 3: 選擇時段 (fetchAndRenderSlots 會處理後續)
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

        // 步驟 4: 填寫聯絡資訊 -> 進入總結
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
        
        // 步驟 5: 渲染總結並確認送出
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
                <p><span>消費方式:</span><span>${bookingData.preference}</span></p>
                <hr>
                ${discountText}
                <p><span>預估總金額:</span><span class="final-price">$${finalPrice}${priceSuffix}</span></p>
            `;
        }

        allElements.confirmBtn.addEventListener('click', async () => {
            allElements.confirmBtn.disabled = true;
            allElements.confirmBtn.textContent = '處理中...';
            try {
                const createResponse = await fetch('/api/bookings-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userProfile.userId,
                        bookingDate: bookingData.date,
                        timeSlot: bookingData.timeSlot,
                        numOfPeople: bookingData.people,
                        bookingPreference: bookingData.preference,
                        contactName: bookingData.name,
                        contactPhone: bookingData.phone
                    })
                });
                const result = await createResponse.json();
                if (!createResponse.ok) throw new Error(result.error || '預約失敗');

                // 預約成功後，發送 LINE 通知
                await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userProfile.userId, message: result.confirmationMessage })
                });

                allElements.resultContent.innerHTML = `
                    <h2 class="success">✅ 預約成功！</h2>
                    <p>已將預約確認訊息發送至您的 LINE，我們到時見！</p>
                    <button onclick="liff.closeWindow()" class="cta-button">關閉視窗</button>
                `;
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
    // 分頁切換邏輯 (整合返回鍵)
    // =================================================================
    const tabBar = document.getElementById('tab-bar');
    
    // 監聽 LIFF 的返回事件
    liff.events.on('back', (event) => {
        // 如果我們在預約流程中，就執行我們的返回邏輯
        if (document.getElementById('page-booking').classList.contains('active')) {
            if (goBackBookingStep()) {
                event.preventDefault(); // 阻止 LIFF 關閉
            }
        }
    });

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
                // 每次進入預約頁都重置到第一步
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
        if (targetPage) targetPage.classList.add('active');
    }
    
    showPage('page-home');
});