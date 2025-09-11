document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 全域變數與 LIFF 初始化
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW";
    let userProfile = null; // 用來儲存使用者 LIFF Profile

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                // 登入成功後，先獲取一次使用者資料
                liff.getProfile().then(profile => {
                    userProfile = profile;
                    fetchGameData(profile); // 更新/註冊使用者資料
                }).catch(err => console.error("獲取 Profile 失敗", err));
            }
        })
        .catch((err) => { console.error("LIFF 初始化失敗", err); });
        
    // =================================================================
    // 使用者資料相關函式 (與之前相同)
    // =================================================================
    function fetchUserProfile() {
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
    let allGames = []; // 儲存所有遊戲資料的變數
    let activeFilters = {
        keyword: '',
        tag: null
    };
    let gamesPageInitialized = false; // 追蹤圖鑑頁是否已初始化

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
    // 場地預約功能區塊 (全新)
    // =================================================================
    
    // ===== 請在這裡設定你的店家資訊 =====
    const AVAILABLE_TABLES = ['A1', 'A2', 'A3', 'A4', 'A5', '二樓包廂'];
    const AVAILABLE_TIME_SLOTS = ['14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'];
    // ===================================
    
    let bookingPageInitialized = false;
    let selectedBookingInfo = {
        date: null,
        timeSlot: null,
        tableNumber: null
    };

    function initializeBookingPage() {
        if (bookingPageInitialized) return;
        bookingPageInitialized = true;

        const datepickerInput = document.getElementById('booking-datepicker');
        const slotsStep = document.getElementById('slots-step');
        const confirmationStep = document.getElementById('confirmation-step');
        const slotsContainer = document.getElementById('booking-slots-container');
        const bookingSummary = document.getElementById('booking-summary');
        const numOfPeopleSelect = document.getElementById('booking-people');
        const confirmBtn = document.getElementById('confirm-booking-btn');
        const bookingResult = document.getElementById('booking-result');

        // 初始化 Flatpickr 日曆
        flatpickr(datepickerInput, {
            minDate: "today",
            dateFormat: "Y-m-d",
            locale: "zh_tw", // 使用中文語系
            onChange: function(selectedDates, dateStr, instance) {
                selectedBookingInfo = { date: dateStr, timeSlot: null, tableNumber: null };
                slotsStep.style.display = 'block';
                confirmationStep.style.display = 'none';
                bookingResult.innerHTML = '';
                fetchAndRenderSlots(dateStr);
            },
        });

        async function fetchAndRenderSlots(date) {
            slotsContainer.innerHTML = '<p>正在查詢空位...</p>';
            try {
                const response = await fetch(`/api/bookings-check?date=${date}`);
                if (!response.ok) throw new Error('查詢失敗');
                const bookedSlots = await response.json(); // ex: [{time_slot: "14:00-16:00", table_number: "A1"}, ...]

                slotsContainer.innerHTML = '';
                AVAILABLE_TIME_SLOTS.forEach(slot => {
                    AVAILABLE_TABLES.forEach(table => {
                        const isBooked = bookedSlots.some(
                            booked => booked.time_slot === slot && booked.table_number === table
                        );
                        
                        const button = document.createElement('button');
                        button.className = 'slot-button';
                        button.textContent = `${slot} - ${table}`;
                        button.dataset.slot = slot;
                        button.dataset.table = table;

                        if (isBooked) {
                            button.classList.add('booked');
                            button.disabled = true;
                        } else {
                            button.classList.add('available');
                            button.addEventListener('click', () => {
                                // 移除其他按鈕的選中樣式
                                slotsContainer.querySelectorAll('.slot-button.selected').forEach(btn => btn.classList.remove('selected'));
                                // 將當前按鈕設為選中
                                button.classList.add('selected');
                                
                                selectedBookingInfo.timeSlot = slot;
                                selectedBookingInfo.tableNumber = table;
                                
                                bookingSummary.textContent = `您預約了：${selectedBookingInfo.date} 的 ${slot} 時段，桌號 ${table}`;
                                confirmationStep.style.display = 'block';
                            });
                        }
                        slotsContainer.appendChild(button);
                    });
                });
            } catch (error) {
                slotsContainer.innerHTML = '<p style="color: red;">查詢空位失敗，請稍後再試。</p>';
            }
        }

        confirmBtn.addEventListener('click', async () => {
            if (!userProfile || !selectedBookingInfo.date || !selectedBookingInfo.timeSlot || !selectedBookingInfo.tableNumber) {
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
                        tableNumber: selectedBookingInfo.tableNumber,
                        numOfPeople: parseInt(numOfPeopleSelect.value, 10),
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || '預約失敗');
                
                // 預約成功
                slotsStep.style.display = 'none';
                confirmationStep.style.display = 'none';
                bookingResult.innerHTML = `<p class="success">✅ 預約成功！</p><p>${bookingSummary.textContent}</p>`;

            } catch (error) {
                alert(`預約失敗：${error.message}`);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = '確認預約';
            }
        });
    }

    // =================================================================
    // 分頁切換邏輯 (整合新功能)
    // =================================================================
    const tabBar = document.getElementById('tab-bar');
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            
            if (targetPageId === 'page-games') {
                // ... (你現有的 initializeGamesPage() 呼叫)
            } else if (targetPageId === 'page-profile') {
                fetchUserProfile(); // 切換到個人資料頁時，刷新一次資料
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
        if (targetPage) targetPage.classList.add('active');
    }
    
    showPage('page-home');
});