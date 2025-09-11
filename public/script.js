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
    // 使用者資料相關函式
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
            filteredGames = filteredGames.filter(g => g.name.toLowerCase().includes(keyword) || g.description.toLowerCase().includes(keyword));
        }
        if (activeFilters.tag) {
            filteredGames = filteredGames.filter(g => g.tags.split(',').map(t => t.trim()).includes(activeFilters.tag));
        }
        gameListContainer.innerHTML = '';
        if (filteredGames.length === 0) {
            gameListContainer.innerHTML = '<p>找不到符合條件的遊戲。</p>';
            return;
        }
        filteredGames.forEach(game => {
            if (game.is_visible !== 'TRUE') return;
            const gameCard = document.createElement('div'); gameCard.className = 'game-card';
            const img = document.createElement('img'); img.src = game.image_url; img.alt = game.name; img.className = 'game-image';
            const info = document.createElement('div'); info.className = 'game-info';
            const title = document.createElement('h3'); title.className = 'game-title'; title.textContent = game.name;
            const desc = document.createElement('p'); desc.className = 'game-description'; desc.textContent = game.description;
            const tags = document.createElement('div'); tags.className = 'game-tags';
            game.tags.split(',').forEach(t => {
                if(t.trim()) {
                    const tagEl = document.createElement('span'); tagEl.className = 'game-tag'; tagEl.textContent = t.trim(); tags.appendChild(tagEl);
                }
            });
            const details = document.createElement('div'); details.className = 'game-details';
            details.innerHTML = `<span>👥 ${game.min_players}-${game.max_players} 人</span><span>⭐ 難度: ${game.difficulty}</span>`;
            info.append(title, desc, tags, details);
            gameCard.append(img, info);
            gameListContainer.appendChild(gameCard);
        });
    }

    function populateFilters() {
        const allTags = new Set(allGames.flatMap(g => g.tags.split(',')).map(t => t.trim()).filter(Boolean));
        tagFiltersContainer.innerHTML = '';
        allTags.forEach(tag => {
            const btn = document.createElement('button'); btn.textContent = tag; btn.dataset.tag = tag;
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active')) {
                    activeFilters.tag = null; btn.classList.remove('active');
                } else {
                    tagFiltersContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    activeFilters.tag = tag; btn.classList.add('active');
                }
                renderGames();
            });
            tagFiltersContainer.appendChild(btn);
        });
    }

    function setupFilterEventListeners() {
        keywordSearchInput.addEventListener('input', e => { activeFilters.keyword = e.target.value; renderGames(); });
        clearFiltersButton.addEventListener('click', () => {
            activeFilters.keyword = ''; activeFilters.tag = null; keywordSearchInput.value = '';
            tagFiltersContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            renderGames();
        });
    }

    async function initializeGamesPage() {
        if (gamesPageInitialized) return;
        gamesPageInitialized = true;
        try {
            const res = await fetch('/api/games');
            if (!res.ok) throw new Error('API 請求失敗');
            allGames = await res.json();
            populateFilters(); renderGames(); setupFilterEventListeners();
        } catch (error) {
            console.error('初始化桌遊圖鑑失敗:', error);
            gameListContainer.innerHTML = '<p style="color: red;">讀取桌遊資料失敗。</p>';
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
        document.querySelectorAll('#booking-wizard-container .booking-step').forEach(step => step.classList.remove('active'));
        document.getElementById(stepId)?.classList.add('active');
        if (bookingHistoryStack[bookingHistoryStack.length - 1] !== stepId) {
            bookingHistoryStack.push(stepId);
        }
    }

    function goBackBookingStep() {
        if (bookingHistoryStack.length > 1) {
            bookingHistoryStack.pop();
            const lastStep = bookingHistoryStack[bookingHistoryStack.length - 1];
            showBookingStep(lastStep);
        }
    }

    function initializeBookingPage() {
        if (bookingPageInitialized) return;
        bookingPageInitialized = true;

        const elements = {
            wizardContainer: document.getElementById('booking-wizard-container'),
            preferenceBtns: document.querySelectorAll('.preference-btn'),
            datepickerContainer: document.getElementById('booking-datepicker-container'),
            slotsContainer: document.getElementById('booking-slots-container'),
            peopleInput: document.getElementById('booking-people'),
            nameInput: document.getElementById('contact-name'),
            phoneInput: document.getElementById('contact-phone'),
            toSummaryBtn: document.getElementById('to-summary-btn'),
            summaryCard: document.getElementById('booking-summary-card'),
            confirmBtn: document.getElementById('confirm-booking-btn'),
            resultContent: document.getElementById('booking-result-content'),
        };

        elements.wizardContainer.addEventListener('click', e => {
            if (e.target.matches('.back-button')) goBackBookingStep();
        });
        
        elements.preferenceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bookingData.preference = btn.dataset.preference;
                showBookingStep('step-date');
            });
        });

        flatpickr(elements.datepickerContainer, {
            inline: true, // **修正點：讓日曆直接顯示**
            minDate: new Date().fp_incr(1),
            dateFormat: "Y-m-d",
            locale: "zh_tw",
            onChange: (selectedDates, dateStr) => {
                const day = selectedDates[0].getDay();
                bookingData.isWeekend = (day === 0 || day === 5 || day === 6);
                const today = new Date(); today.setHours(0,0,0,0);
                bookingData.hasDiscount = Math.ceil((selectedDates[0] - today) / (1000 * 60 * 60 * 24)) >= 3;
                bookingData.date = dateStr;
                fetchAndRenderSlots(dateStr);
                showBookingStep('step-slots');
            },
        });

        async function fetchAndRenderSlots(date) {
            elements.slotsContainer.innerHTML = '<p>正在查詢空位...</p>';
            try {
                const res = await fetch(`/api/bookings-check?date=${date}`);
                const bookedTablesBySlot = await res.json();
                elements.slotsContainer.innerHTML = '';
                AVAILABLE_TIME_SLOTS.forEach(slot => {
                    const tablesBooked = bookedTablesBySlot[slot] || 0;
                    const tablesAvailable = TOTAL_TABLES - tablesBooked;
                    const btn = document.createElement('button');
                    btn.className = 'slot-button';
                    btn.innerHTML = `${slot}<br><span style="font-size:0.8em;">剩餘 ${tablesAvailable} 桌</span>`;
                    if (tablesAvailable <= 0) {
                        btn.classList.add('booked'); btn.disabled = true;
                    } else {
                        btn.classList.add('available');
                        btn.addEventListener('click', () => {
                            bookingData.timeSlot = slot;
                            showBookingStep('step-contact');
                        });
                    }
                    elements.slotsContainer.appendChild(btn);
                });
            } catch (error) {
                elements.slotsContainer.innerHTML = `<p style="color: red;">查詢失敗：${error.message}</p>`;
            }
        }

        elements.toSummaryBtn.addEventListener('click', () => {
            bookingData.people = Number(elements.peopleInput.value);
            bookingData.name = elements.nameInput.value.trim();
            bookingData.phone = elements.phoneInput.value.trim();
            if (!bookingData.people || !bookingData.name || bookingData.phone.length < 10) {
                alert('請確實填寫所有資訊，並確認手機號碼為10碼！'); return;
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
            const priceSuffix = bookingData.preference === '計時制' ? ' / 每小時' : '';
            elements.summaryCard.innerHTML = `<p><span>姓名:</span><span>${bookingData.name}</span></p><p><span>電話:</span><span>${bookingData.phone}</span></p><p><span>日期:</span><span>${bookingData.date}</span></p><p><span>時段:</span><span>${bookingData.timeSlot}</span></p><p><span>人數:</span><span>${bookingData.people} 人</span></p><p><span>消費方式:</span><span>${bookingData.preference}</span></p><hr>${discountText}<p><span>預估總金額:</span><span class="final-price">$${finalPrice}${priceSuffix}</span></p>`;
        }

        elements.confirmBtn.addEventListener('click', async () => {
            elements.confirmBtn.disabled = true;
            elements.confirmBtn.textContent = '處理中...';
            try {
                const createRes = await fetch('/api/bookings-create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userProfile.userId, bookingDate: bookingData.date,
                        timeSlot: bookingData.timeSlot, numOfPeople: bookingData.people,
                        bookingPreference: bookingData.preference, contactName: bookingData.name,
                        contactPhone: bookingData.phone
                    })
                });
                const result = await createRes.json();
                if (!createRes.ok) throw new Error(result.error || '預約失敗');
                await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userProfile.userId, message: result.confirmationMessage })
                });
                elements.resultContent.innerHTML = `<h2 class="success">✅ 預約成功！</h2><p>已將預約確認訊息發送至您的 LINE，我們到時見！</p><button onclick="liff.closeWindow()" class="cta-button">關閉視窗</button>`;
                showBookingStep('step-result');
            } catch (error) {
                alert(`預約失敗：${error.message}`);
            } finally {
                elements.confirmBtn.disabled = false;
                elements.confirmBtn.textContent = '確認送出';
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
            
            if (targetPageId === 'page-games') initializeGamesPage();
            else if (targetPageId === 'page-profile') {
                displayUserProfile();
                if (userProfile) fetchGameData(userProfile);
_
            } else if (targetPageId === 'page-booking') {
                if (!bookingPageInitialized) initializeBookingPage();
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
        document.getElementById(pageId)?.classList.add('active');
    }
    
    showPage('page-home');
});