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

            // 簡單的升級經驗值公式 (如果後端沒有提供)
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
    const PRICES = {
        weekday: { once: 150, per_hour: 50 },
        weekend: { once: 250, per_hour: 80 },
    };
    const ADVANCE_BOOKING_DISCOUNT = 20;

    let bookingPageInitialized = false;
    let selectedBookingInfo = {
        date: null,
        timeSlot: null,
        numOfPeople: 0,
        isWeekend: false,
        hasDiscount: false,
        estimatedPrice: 0
    };

    function initializeBookingPage() {
        if (bookingPageInitialized) return;
        bookingPageInitialized = true;

        const infoView = document.getElementById('booking-info-view');
        const processView = document.getElementById('booking-process-view');
        const startBookingBtn = document.getElementById('start-booking-btn');
        const backToInfoBtn = document.getElementById('back-to-info-btn');
        const datepickerInput = document.getElementById('booking-datepicker');
        const slotsStep = document.getElementById('slots-step');
        const confirmationStep = document.getElementById('confirmation-step');
        const slotsContainer = document.getElementById('booking-slots-container');
        const bookingSummary = document.getElementById('booking-summary');
        const numOfPeopleInput = document.getElementById('booking-people');
        const preferenceSelect = document.getElementById('booking-preference');
        const priceEstimationBox = document.getElementById('price-estimation');
        const confirmBtn = document.getElementById('confirm-booking-btn');
        const bookingResult = document.getElementById('booking-result');

        startBookingBtn.addEventListener('click', () => {
            infoView.style.display = 'none';
            processView.style.display = 'flex';
        });

        backToInfoBtn.addEventListener('click', () => {
            processView.style.display = 'none';
            infoView.style.display = 'flex';
            datepickerInput.value = '';
            slotsStep.style.display = 'none';
            confirmationStep.style.display = 'none';
        });

        flatpickr(datepickerInput, {
            minDate: new Date().fp_incr(1),
            dateFormat: "Y-m-d",
            locale: "zh_tw",
            onChange: function(selectedDates, dateStr) {
                const selectedDate = selectedDates[0];
                const dayOfWeek = selectedDate.getDay();
                selectedBookingInfo.isWeekend = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6);
                
                const today = new Date();
                today.setHours(0,0,0,0);
                const diffTime = selectedDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                selectedBookingInfo.hasDiscount = (diffDays >= 3);

                selectedBookingInfo.date = dateStr;
                slotsStep.style.display = 'block';
                confirmationStep.style.display = 'none';
                bookingResult.innerHTML = '';
                fetchAndRenderSlots(dateStr);
            },
        });

        function calculateAndUpdatePrice() {
            const people = Number(numOfPeopleInput.value);
            if (people <= 0) {
                priceEstimationBox.innerHTML = '';
                return;
            }
            const priceKey = selectedBookingInfo.isWeekend ? 'weekend' : 'weekday';
            const preference = preferenceSelect.value;
            const basePricePerPerson = (preference === '一次性') ? PRICES[priceKey].once : PRICES[priceKey].per_hour;
            let finalPrice = basePricePerPerson * people;
            let discountText = '';
            
            if (preference === '一次性' && selectedBookingInfo.hasDiscount) {
                const totalDiscount = ADVANCE_BOOKING_DISCOUNT * people;
                finalPrice -= totalDiscount;
                discountText = `<p class="discount-text">已套用早鳥優惠，共折扣 $${totalDiscount}！</p>`;
            }
            
            selectedBookingInfo.estimatedPrice = finalPrice;
            const priceSuffix = (preference === '一次性') ? '' : ' / 每小時';
            
            priceEstimationBox.innerHTML = `
                <p>預估總費用 (${people}人)：</p>
                <p class="final-price">$${finalPrice}${priceSuffix}</p>
                ${discountText}
                <p style="font-size: 0.8rem; color: #888; margin-top: 5px;">(詳細計費以現場為準)</p>
            `;
        }

        numOfPeopleInput.addEventListener('input', calculateAndUpdatePrice);
        preferenceSelect.addEventListener('change', calculateAndUpdatePrice);

        async function fetchAndRenderSlots(date) {
            slotsContainer.innerHTML = '<p>正在查詢空位...</p>';
            try {
                const response = await fetch(`/api/bookings-check?date=${date}`);
                if (!response.ok) throw new Error('查詢失敗');
                const bookedTablesBySlot = await response.json();

                slotsContainer.innerHTML = '';
                AVAILABLE_TIME_SLOTS.forEach(slot => {
                    const tablesBooked = bookedTablesBySlot[slot] || 0;
                    const tablesAvailable = TOTAL_TABLES - tablesBooked;
                    
                    const button = document.createElement('button');
                    button.className = 'slot-button';
                    button.innerHTML = `${slot}<br><span style="font-size:0.8em; font-weight:normal;">剩餘 ${tablesAvailable} 桌</span>`;
                    button.dataset.slot = slot;
                    
                    if (tablesAvailable <= 0) {
                        button.classList.add('booked');
                        button.disabled = true;
                    } else {
                        button.classList.add('available');
                        button.addEventListener('click', () => {
                            slotsContainer.querySelectorAll('.slot-button.selected').forEach(btn => btn.classList.remove('selected'));
                            button.classList.add('selected');
                            
                            selectedBookingInfo.timeSlot = slot;
                            bookingSummary.textContent = `${selectedBookingInfo.date} 的 ${slot}`;
                            confirmationStep.style.display = 'block';
                            numOfPeopleInput.value = '';
                            priceEstimationBox.innerHTML = '';
                        });
                    }
                    slotsContainer.appendChild(button);
                });
            } catch (error) {
                slotsContainer.innerHTML = `<p style="color: red;">查詢空位失敗：${error.message}</p>`;
            }
        }

        confirmBtn.addEventListener('click', async () => {
            const numOfPeople = Number(numOfPeopleInput.value);
            
            if (!userProfile || !selectedBookingInfo.date || !selectedBookingInfo.timeSlot || numOfPeople <= 0) {
                alert('預約資訊不完整！');
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = '處理中...';
            
            try {
                const response = await fetch('/api/bookings-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userProfile.userId,
                        bookingDate: selectedBookingInfo.date,
                        timeSlot: selectedBookingInfo.timeSlot,
                        numOfPeople: numOfPeople,
                        bookingPreference: preferenceSelect.value
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || '預約失敗');
                
                processView.style.display = 'none';
                infoView.style.display = 'flex'; 
                bookingResult.innerHTML = `<div class="rules-card" style="text-align: center;"><h2 class="success">✅ 預約成功！</h2><p>感謝您的預約，我們到時見！</p><p><strong>${bookingSummary.textContent}，共 ${numOfPeople} 人</strong></p><button onclick="location.reload()" class="cta-button" style="margin-top: 20px;">返回</button></div>`;
                infoView.innerHTML = bookingResult.innerHTML;
                
            } catch (error) {
                alert(`預約失敗：${error.message}`);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '確認送出預約';
            }
        });
    }

    // =================================================================
    // 分頁切換邏輯
    // =================================================================
    const tabBar = document.getElementById('tab-bar');
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            
            // 根據點擊的分頁，執行對應的初始化或刷新
            if (targetPageId === 'page-games') {
                initializeGamesPage();
            } else if (targetPageId === 'page-profile') {
                displayUserProfile(); // 顯示已儲存的 profile
                if (userProfile) fetchGameData(userProfile); // 每次點擊都重新抓取最新的等級/經驗值
            } else if (targetPageId === 'page-booking') {
                initializeBookingPage();
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
    
    // 預設顯示首頁
    showPage('page-home');
});