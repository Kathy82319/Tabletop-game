document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 核心DOM元素與全域變數
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW";
    let userProfile = null;

    const appContent = document.getElementById('app-content');
    const pageTemplates = document.getElementById('page-templates');
    const tabBar = document.getElementById('tab-bar');

    // =================================================================
    // 全新頁面切換邏輯 (強制渲染)
    // =================================================================
    function showPage(pageId) {
        const template = pageTemplates.querySelector(`#${pageId}`);
        if (template) {
            // 核心步驟：強制清空主內容區，並複製樣板的 HTML 過去
            appContent.innerHTML = template.innerHTML;
            
            // 因為頁面是重新渲染的，所以每次渲染後都需要重新觸發該頁面的初始化函式
            switch (pageId) {
                case 'page-games':
                    initializeGamesPage();
                    break;
                case 'page-game-details':
                    // 遊戲詳情頁是動態的，由 renderGameDetails 函式處理，此處不需動作
                    break;
                case 'page-profile':
                    initializeProfilePage();
                    break;
                case 'page-booking':
                    initializeBookingPage();
                    break;
            }
        } else {
            console.error(`在 page-templates 中找不到樣板: ${pageId}`);
            appContent.innerHTML = `<h1>找不到頁面: ${pageId}</h1>`;
        }
    }

    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            showPage(targetPageId);
        }
    });

    // =================================================================
    // LIFF 初始化
    // =================================================================
    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                liff.getProfile().then(profile => {
                    userProfile = profile;
                    showPage('page-home'); // LIFF 初始化成功後，顯示預設的首頁
                }).catch(err => console.error("獲取 LINE Profile 失敗", err));
            }
        })
        .catch((err) => {
            console.error("LIFF 初始化失敗", err);
            showPage('page-home');
        });
        
    // =================================================================
    // 使用者資料 & 個人資料頁
    // =================================================================
    let profilePageInitialized = false;

    function displayUserProfile() {
        if (!userProfile) return;
        const displayNameEl = appContent.querySelector('#display-name');
        const statusMessageEl = appContent.querySelector('#status-message');
        const profilePictureEl = appContent.querySelector('#profile-picture');
        const qrcodeContainerEl = appContent.querySelector('#qrcode');

        if(displayNameEl) displayNameEl.textContent = userProfile.displayName;
        if(statusMessageEl) statusMessageEl.textContent = userProfile.statusMessage || '';
        if(profilePictureEl && userProfile.pictureUrl) profilePictureEl.src = userProfile.pictureUrl;
        
        if(qrcodeContainerEl) {
            qrcodeContainerEl.innerHTML = '';
            new QRCode(qrcodeContainerEl, { text: userProfile.userId, width: 200, height: 200 });
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
            let expToNextLevel = gameData.expToNextLevel || Math.floor(100 * Math.pow(gameData.level || 1, 1.5));
            
            const userClassEl = appContent.querySelector('#user-class');
            const userLevelEl = appContent.querySelector('#user-level');
            const userExpEl = appContent.querySelector('#user-exp');
            const nicknameInput = appContent.querySelector('#profile-nickname');
            const phoneInput = appContent.querySelector('#profile-phone');

            if(userClassEl) userClassEl.textContent = gameData.class;
            if(userLevelEl) userLevelEl.textContent = gameData.level;
            if(userExpEl) userExpEl.textContent = `${gameData.current_exp} / ${expToNextLevel}`;
            if(nicknameInput) nicknameInput.value = gameData.nickname || '';
            if(phoneInput) phoneInput.value = gameData.phone || '';

        } catch (error) {
            console.error('呼叫會員 API 失敗:', error);
        }
    }

    async function fetchAndDisplayMyBookings(userId) {
        const container = appContent.querySelector('#my-bookings-container');
        if (!container) return;
        container.innerHTML = '<p>正在查詢您的預約紀錄...</p>';
        try {
            const response = await fetch(`/api/my-bookings?userId=${userId}`);
            if (!response.ok) throw new Error('查詢預約失敗');
            const bookings = await response.json();
            if (bookings.length === 0) { container.innerHTML = '<p>您目前沒有即將到來的預約。</p>'; return; }
            container.innerHTML = '';
            bookings.forEach(booking => {
                const card = document.createElement('div');
                card.className = 'booking-info-card';
                card.innerHTML = `<p class="booking-date-time">${booking.booking_date} - ${booking.time_slot}</p><p><strong>預約姓名：</strong> ${booking.contact_name}</p><p><strong>預約人數：</strong> ${booking.num_of_people} 人</p>`;
                container.appendChild(card);
            });
        } catch (error) {
            console.error('獲取個人預約失敗:', error);
            container.innerHTML = '<p style="color: red;">無法載入預約紀錄。</p>';
        }
    }
    
    function initializeProfilePage() {
        displayUserProfile();
        if (userProfile) {
            fetchGameData(userProfile);
            fetchAndDisplayMyBookings(userProfile.userId);
        }

        const modal = appContent.querySelector('#profile-modal');
        const editBtn = appContent.querySelector('#edit-profile-btn');
        const closeBtn = appContent.querySelector('.modal-close-btn');
        const form = appContent.querySelector('#profile-form');
        const gameSelect = appContent.querySelector('#profile-games');
        const otherGameInput = appContent.querySelector('#profile-games-other');
        const statusMsg = appContent.querySelector('#profile-form-status');
        
        if(!modal || !editBtn || !closeBtn || !form || !gameSelect || !otherGameInput) return;

        editBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        modal.addEventListener('click', (event) => {
            if (event.target == modal) modal.style.display = 'none';
        });
        gameSelect.addEventListener('change', () => {
            otherGameInput.style.display = (gameSelect.value === '其他') ? 'block' : 'none';
        });
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            statusMsg.textContent = '儲存中...'; statusMsg.className = 'form-status';
            let preferredGames = gameSelect.value === '其他' ? otherGameInput.value.trim() : gameSelect.value;
            const formData = {
                userId: userProfile.userId,
                nickname: appContent.querySelector('#profile-nickname').value,
                phone: appContent.querySelector('#profile-phone').value,
                preferredGames: preferredGames
            };
            try {
                const response = await fetch('/api/update-user-profile', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || '儲存失敗');
                statusMsg.textContent = '儲存成功！'; statusMsg.classList.add('success');
                setTimeout(() => { modal.style.display = 'none'; statusMsg.textContent = ''; statusMsg.className = 'form-status'; }, 1500);
            } catch (error) {
                statusMsg.textContent = `儲存失敗: ${error.message}`; statusMsg.classList.add('error');
            }
        });
    }

    // =================================================================
    // 桌遊圖鑑 & 詳情頁功能區塊
    // =================================================================
    let allGames = [];
    let activeFilters = { keyword: '', tag: null };
    let gamesPageInitialized = false;
    let pageHistory = [];

    function renderGameDetails(game) {
        const detailsTemplate = pageTemplates.querySelector('#page-game-details');
        if (!detailsTemplate) return;
        
        appContent.innerHTML = detailsTemplate.innerHTML; // 先清空並放入容器骨架

        const isForSale = Number(game.for_sale_stock) > 0;
        const isForRent = Number(game.for_rent_stock) > 0;
        let priceHTML = '<div class="price-grid">';
        if (isForSale) {
            priceHTML += `<div class="price-item"><p>售價</p><p class="price-value">$${game.sale_price}</p><p class="stock-info">可販售庫存: ${game.for_sale_stock}</p></div><div class="price-item"><p>押金</p><p class="price-value">$${game.sale_price}</p><p class="stock-info">&nbsp;</p></div>`;
        }
        if (isForRent) {
             priceHTML += `<div class="price-item"><p>租金 (三天)</p><p class="price-value">$${game.rent_price}</p><p class="stock-info">可租借庫存: ${game.for_rent_stock}</p></div>`;
        }
        priceHTML += '</div>';
        
        const finalHTML = `<button class="details-back-button">← 返回圖鑑</button><div class="details-header"><img src="${game.image_url}" alt="${game.name}" class="details-image"><h1 class="details-title">${game.name}</h1></div><div class="details-section"><h3>遊戲簡介</h3><p>${game.description}</p></div><div class="details-section"><h3>價格與庫存</h3>${priceHTML}</div><div class="details-section"><h3>租借規則說明</h3><ol class="rules-list"><li>每筆租借基本天數為三天。</li><li>最長可延期至15天，每日 $20。</li><li>未提前申請延期且超過三天者視為逾期，逾期每日 $40 計算。</li><li>押金為該桌遊售價，歸還若發現缺件或毀損，將沒收押金。</li><li>每位使用者最多同時租借三款桌遊。</li></ol></div>`;
        
        appContent.innerHTML = finalHTML;
    }

    function renderGames() {
        const gameListContainer = appContent.querySelector('#game-list-container');
        if(!gameListContainer) return;
        let filteredGames = allGames.filter(g => g.is_visible === 'TRUE');
        const keyword = activeFilters.keyword.toLowerCase().trim();
        if (keyword) {
            filteredGames = filteredGames.filter(g => g.name.toLowerCase().includes(keyword) || g.description.toLowerCase().includes(keyword));
        }
        if (activeFilters.tag) {
            filteredGames = filteredGames.filter(g => g.tags.split(',').map(t => t.trim()).includes(activeFilters.tag));
        }
        gameListContainer.innerHTML = '';
        if (filteredGames.length === 0) { gameListContainer.innerHTML = '<p>找不到符合條件的遊戲。</p>'; return; }
        filteredGames.forEach(game => {
            const gameCard = document.createElement('div'); gameCard.className = 'game-card';
            gameCard.addEventListener('click', () => {
                pageHistory.push('page-games'); // 記錄從哪裡來
                renderGameDetails(game);
            });
            const img = document.createElement('img'); img.src = game.image_url; img.alt = game.name; img.className = 'game-image';
            const info = document.createElement('div'); info.className = 'game-info';
            const title = document.createElement('h3'); title.className = 'game-title'; title.textContent = game.name;
            const desc = document.createElement('p'); desc.className = 'game-description'; desc.textContent = game.description;
            const tags = document.createElement('div'); tags.className = 'game-tags';
            game.tags.split(',').forEach(t => {
                if(t.trim()) { const tagEl = document.createElement('span'); tagEl.className = 'game-tag'; tagEl.textContent = t.trim(); tags.appendChild(tagEl); }
            });
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
        if (allGames.length > 0) { // 如果已經抓過資料，就直接用，不用重抓
             renderGames(); populateFilters(); setupFilterEventListeners();
             return;
        }
        const gameListContainer = appContent.querySelector('#game-list-container');
        try {
            const res = await fetch('/api/games');
            if (!res.ok) throw new Error('API 請求失敗');
            allGames = await res.json();
            renderGames(); populateFilters(); setupFilterEventListeners();
        } catch (error) {
            console.error('初始化桌遊圖鑑失敗:', error);
            if(gameListContainer) gameListContainer.innerHTML = '<p style="color: red;">讀取桌遊資料失敗。</p>';
        }
    }


// =================================================================
// 場地預約功能區塊 (全新整合版，修正日曆置中與流程)
// =================================================================
const TOTAL_TABLES = 5; // 預設總桌數
const PEOPLE_PER_TABLE = 4;
const AVAILABLE_TIME_SLOTS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
const PRICES = { weekday: 150, weekend: 250 };
const ADVANCE_BOOKING_DISCOUNT = 20;

let bookingPageInitialized = false;
let bookingData = {}; // 用於儲存預約流程中的所有資料
let bookingHistoryStack = []; // 用於處理返回鍵
let dailyAvailability = { limit: TOTAL_TABLES, booked: 0, available: TOTAL_TABLES }; // 儲存當日空位資訊

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

    const elements = {
        wizardContainer: document.getElementById('booking-wizard-container'),
        preferenceBtns: document.querySelectorAll('.preference-btn'),
        datepickerContainer: document.getElementById('booking-datepicker-container'),
        slotsWrapper: document.getElementById('booking-slots-wrapper'),
        slotsPlaceholder: document.getElementById('slots-placeholder'),
        slotsContainer: document.getElementById('booking-slots-container'),
        contactSummary: document.getElementById('contact-summary'),
        peopleInput: document.getElementById('booking-people'),
        nameInput: document.getElementById('contact-name'),
        phoneInput: document.getElementById('contact-phone'),
        toSummaryBtn: document.getElementById('to-summary-btn'),
        summaryCard: document.getElementById('booking-summary-card'),
        confirmBtn: document.getElementById('confirm-booking-btn'),
        resultContent: document.getElementById('booking-result-content'),
    };

    // 使用事件代理來處理所有返回按鈕
    elements.wizardContainer.addEventListener('click', e => {
        if (e.target.matches('.back-button')) {
            goBackBookingStep();
        }
    });
    
    // 步驟 1: 選擇消費方式
    elements.preferenceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 在這裡我們只記錄選擇，但新流程中已移除計時制，所以直接進入下一步
            // bookingData.preference = btn.dataset.preference; // 這行可以保留或移除
            showBookingStep('step-date-and-slots');
        });
    });

    // 步驟 2: 初始化日曆
    flatpickr(elements.datepickerContainer, {
        inline: true, // 讓日曆直接顯示
        minDate: new Date().fp_incr(1), // 最早只能預約明天
        dateFormat: "Y-m-d",
        locale: "zh_tw",
        onChange: (selectedDates, dateStr) => {
            const day = selectedDates[0].getDay();
            bookingData.isWeekend = (day === 0 || day === 5 || day === 6);
            const today = new Date(); today.setHours(0,0,0,0);
            bookingData.hasDiscount = Math.ceil((selectedDates[0] - today) / (1000 * 60 * 60 * 24)) >= 3;
            bookingData.date = dateStr;
            fetchAndRenderSlots(dateStr); // 選擇日期後，立刻查詢並顯示時段
        },
    });

    async function fetchAndRenderSlots(date) {
        elements.slotsPlaceholder.textContent = '正在查詢當日空位...';
        elements.slotsContainer.innerHTML = '';
        elements.slotsPlaceholder.style.display = 'block';

        try {
            const response = await fetch(`/api/bookings-check?date=${date}`);
            if (!response.ok) throw new Error('查詢失敗');
            dailyAvailability = await response.json();

            elements.slotsContainer.innerHTML = '';
            
            if (dailyAvailability.available <= 0) {
                elements.slotsPlaceholder.textContent = '抱歉，本日預約已額滿';
                return;
            }

            elements.slotsPlaceholder.style.display = 'none'; // 隱藏提示文字
            
            AVAILABLE_TIME_SLOTS.forEach(slot => {
                const btn = document.createElement('button');
                btn.className = 'slot-button available'; // 預設都可選
                btn.textContent = slot;
                btn.addEventListener('click', () => {
                    bookingData.timeSlot = slot;
                    elements.contactSummary.textContent = `${bookingData.date} 的 ${slot}`;
                    showBookingStep('step-contact');
                });
                elements.slotsContainer.appendChild(btn);
            });
        } catch (error) {
            elements.slotsPlaceholder.textContent = `查詢空位失敗：${error.message}`;
            elements.slotsPlaceholder.style.color = 'red';
        }
    }
    
    // 步驟 3 -> 4: 填寫資料並前往總結
    elements.toSummaryBtn.addEventListener('click', () => {
        bookingData.people = Number(elements.peopleInput.value);
        bookingData.name = elements.nameInput.value.trim();
        bookingData.phone = elements.phoneInput.value.trim();

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
    });

    // 渲染總結畫面
    function renderSummary() {
        const priceKey = bookingData.isWeekend ? 'weekend' : 'weekday';
        const basePrice = PRICES[priceKey];
        let finalPrice = basePrice * bookingData.people;
        let discountText = '';
        if (bookingData.hasDiscount) {
            const totalDiscount = ADVANCE_BOOKING_DISCOUNT * bookingData.people;
            finalPrice -= totalDiscount;
            discountText = `<p class="discount-text"><span>早鳥優惠折扣:</span><span>-$${totalDiscount}</span></p>`;
        }
        
        elements.summaryCard.innerHTML = `
            <p><span>姓名:</span><span>${bookingData.name}</span></p>
            <p><span>電話:</span><span>${bookingData.phone}</span></p>
            <p><span>日期:</span><span>${bookingData.date}</span></p>
            <p><span>時段:</span><span>${bookingData.timeSlot}</span></p>
            <p><span>人數:</span><span>${bookingData.people} 人</span></p>
            <hr>
            ${discountText}
            <p><span>預估總金額:</span><span class="final-price">$${finalPrice}</span></p>
        `;
    }

    // 步驟 4 -> 5: 確認送出預約
    elements.confirmBtn.addEventListener('click', async () => {
        elements.confirmBtn.disabled = true;
        elements.confirmBtn.textContent = '處理中...';
        try {
            const createRes = await fetch('/api/bookings-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userProfile.userId,
                    bookingDate: bookingData.date,
                    timeSlot: bookingData.timeSlot,
                    numOfPeople: bookingData.people,
                    contactName: bookingData.name,
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

            elements.resultContent.innerHTML = `<h2 class="success">✅ 預約成功！</h2><p>已將預約確認訊息發送至您的 LINE，我們到時見！</p><button id="booking-done-btn" class="cta-button">返回預約首頁</button>`;
            showBookingStep('step-result');

            document.getElementById('booking-done-btn').addEventListener('click', () => {
                bookingHistoryStack = [];
                showBookingStep('step-preference');
                if (flatpickrInstance) flatpickrInstance.clear();
                elements.slotsContainer.innerHTML = '';
                elements.slotsPlaceholder.style.display = 'block';
                elements.slotsPlaceholder.textContent = '請先從上方選擇日期';
            });
        } catch (error) {
            alert(`預約失敗：${error.message}`);
        } finally {
            if (elements.confirmBtn) {
               elements.confirmBtn.disabled = false;
               elements.confirmBtn.textContent = '確認送出';
            }
        }
    });
}
    // =================================================================
    // 全域事件與分頁切換邏輯 (整合返回鍵)
    // =================================================================
    appContent.addEventListener('click', (event) => {
        // 處理詳情頁返回按鈕
        if (event.target.matches('.details-back-button')) {
            goBackPage();
        }
    });

    function goBackPage() {
        if (pageHistory.length > 0) {
            const previousPageId = pageHistory.pop();
            showPage(previousPageId);
        } else {
             showPage('page-home'); // 如果沒有歷史，回到首頁
        }
    }
});