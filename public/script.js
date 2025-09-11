document.addEventListener('DOMContentLoaded', function () {
    // Global variables
    let liffProfile = null;
    let userId = '';
    const API_BASE_URL = '/api';

    // UI Elements
    const loadingOverlay = document.getElementById('loading');
    const pages = document.querySelectorAll('.page');
    const navButtons = document.querySelectorAll('.nav-btn');
    
    // Adventurer Page Elements
    const displayNameElem = document.getElementById('display-name');
    const profilePictureElem = document.getElementById('profile-picture');
    const statusMessageElem = document.getElementById('status-message');
    const playerClassElem = document.getElementById('player-class');
    const playerLevelElem = document.getElementById('player-level');
    const currentExpElem = document.getElementById('current-exp');
    const expToNextLevelElem = document.getElementById('exp-to-next-level');
    const expBarFillElem = document.getElementById('exp-bar-fill');
    const qrcodeContainer = document.getElementById('qrcode');
    const refreshButton = document.getElementById('refresh-button');

    // Games Page Elements
    const searchInput = document.getElementById('search-input');
    const tagsContainer = document.getElementById('tags-container');
    const gamesGrid = document.getElementById('games-grid');
    let allGames = [];
    let allTags = new Set();

    // Booking Page Elements
    let currentStep = 1;
    let bookingData = {};
    const bookingContainer = document.querySelector('.booking-container');
    const bookingPreferenceOneTimeBtn = document.getElementById('booking-preference-one-time');
    const bookingPreferenceTimedBtn = document.getElementById('booking-preference-timed');
    const bookingDateInput = document.getElementById('booking-date');
    const numOfPeopleInput = document.getElementById('num-of-people');
    const checkAvailabilityBtn = document.getElementById('check-availability-btn');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const contactNameInput = document.getElementById('contact-name');
    const contactPhoneInput = document.getElementById('contact-phone');
    const submitBookingBtn = document.getElementById('submit-booking-btn');
    const bookingDoneBtn = document.getElementById('booking-done-btn');
    const bookingSummaryDiv = document.getElementById('booking-summary');
    
    /**
     * -------- GENERAL FUNCTIONS --------
     */

    // Show loading overlay
    function showLoading() {
        loadingOverlay.classList.add('active');
    }

    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }
    
    // Show a specific page
    function showPage(pageId) {
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');

        navButtons.forEach(btn => btn.classList.remove('active'));
        document.getElementById(`nav-${pageId.split('-')[0]}`).classList.add('active');
    }

    // Initialize LIFF
    async function initializeLiff() {
        showLoading();
        try {
            await liff.init({ liffId: '2005634551-xnaEPEbW' });
            if (!liff.isLoggedIn()) {
                liff.login();
                return;
            }
            liffProfile = await liff.getProfile();
            userId = liffProfile.userId;

            // Once profile is fetched, setup all pages
            setupAdventurerPage();
            setupGamesPage();
            setupBookingPage();

        } catch (error) {
            console.error('LIFF initialization failed', error);
            alert('LIFF 初始化失敗，請稍後再試。');
        } finally {
            hideLoading();
        }
    }

    /**
     * -------- ADVENTURER'S PAGE FUNCTIONS --------
     */

    // Fetch user data from backend and update UI
    async function fetchUserData() {
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/user?userId=${userId}`);
            if (!response.ok) throw new Error('Failed to fetch user data');
            
            const userData = await response.json();
            
            // Update profile info
            displayNameElem.textContent = liffProfile.displayName;
            profilePictureElem.src = liffProfile.pictureUrl || 'https://via.placeholder.com/100';
            statusMessageElem.textContent = liffProfile.statusMessage || '沒有狀態訊息';
            
            // Update game data
            playerClassElem.textContent = userData.class || '無';
            playerLevelElem.textContent = userData.level || 1;
            
            // Update EXP bar
            const level = userData.level || 1;
            const currentExp = userData.current_exp || 0;
            const expToNextLevel = Math.floor(100 * Math.pow(level, 1.5));
            currentExpElem.textContent = currentExp;
            expToNextLevelElem.textContent = expToNextLevel;
            const expPercentage = Math.min((currentExp / expToNextLevel) * 100, 100);
            expBarFillElem.style.width = `${expPercentage}%`;

            // Generate QR Code
            if (qrcodeContainer) {
                qrcodeContainer.innerHTML = ''; // Clear previous QR code
                new QRCode(qrcodeContainer, {
                    text: userId,
                    width: 180,
                    height: 180,
                });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            alert('無法載入玩家資料！');
        } finally {
            hideLoading();
        }
    }
    
    function setupAdventurerPage() {
        fetchUserData(); // Initial fetch
        if (refreshButton) {
            refreshButton.addEventListener('click', fetchUserData);
        }
    }

    /**
     * -------- GAMES PAGE FUNCTIONS --------
     */

    // Fetch games data from backend
    async function fetchGames() {
        try {
            const response = await fetch(`${API_BASE_URL}/games`);
            if (!response.ok) throw new Error('Failed to fetch games');
            allGames = await response.json();
            
            // Process tags
            allGames.forEach(game => {
                game.tags.forEach(tag => allTags.add(tag.trim()));
            });
            
            renderTags();
            renderGames(allGames);
        } catch (error) {
            console.error('Error fetching games:', error);
            gamesGrid.innerHTML = '<p>無法載入桌遊列表。</p>';
        }
    }

    // Render tag buttons
    function renderTags() {
        tagsContainer.innerHTML = '<button class="tag-btn active" data-tag="all">全部</button>';
        allTags.forEach(tag => {
            const button = document.createElement('button');
            button.className = 'tag-btn';
            button.dataset.tag = tag;
            button.textContent = tag;
            tagsContainer.appendChild(button);
        });
    }

    // Render game cards
    function renderGames(games) {
        gamesGrid.innerHTML = '';
        if (games.length === 0) {
            gamesGrid.innerHTML = '<p>找不到符合條件的桌遊。</p>';
            return;
        }
        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.innerHTML = `
                <img src="${game.image_url}" alt="${game.name}" class="game-img">
                <div class="game-info">
                    <h3 class="game-title">${game.name}</h3>
                    <p class="game-players">${game.min_players}-${game.max_players}人 | 難度: ${game.difficulty}</p>
                    <div class="game-tags">${game.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
                </div>
            `;
            gamesGrid.appendChild(card);
        });
    }

    // Filter and search games
    function filterGames() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeTag = document.querySelector('.tag-btn.active').dataset.tag;

        const filteredGames = allGames.filter(game => {
            const nameMatch = game.name.toLowerCase().includes(searchTerm);
            const tagMatch = activeTag === 'all' || game.tags.includes(activeTag);
            return nameMatch && tagMatch;
        });

        renderGames(filteredGames);
    }
    
    function setupGamesPage() {
        fetchGames();
        
        searchInput.addEventListener('input', filterGames);

        tagsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('tag-btn')) {
                document.querySelector('.tag-btn.active').classList.remove('active');
                e.target.classList.add('active');
                filterGames();
            }
        });
    }

    /**
     * -------- BOOKING PAGE FUNCTIONS --------
     */

    // Show a specific step in the booking process
    function showStep(stepNumber) {
        currentStep = stepNumber;
        const steps = bookingContainer.querySelectorAll('.booking-step');
        steps.forEach(step => step.classList.remove('active'));
        
        const stepToShow = bookingContainer.querySelector(`.booking-step[data-step="${stepNumber}"]`);
        if(stepToShow) {
            stepToShow.classList.add('active');
        } else {
            console.error(`Booking step ${stepNumber} not found!`);
        }
    }
    
    // Initialize Flatpickr date picker
    flatpickr(bookingDateInput, {
        minDate: "today",
        dateFormat: "Y-m-d",
    });

    // Check availability
    async function checkAvailability() {
        const date = bookingDateInput.value;
        const people = numOfPeopleInput.value;

        if (!date || !people) {
            alert('請選擇日期和人數。');
            return;
        }

        bookingData.booking_date = date;
        bookingData.num_of_people = parseInt(people);
        
        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/bookings-check?date=${date}&people=${people}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const availableSlots = await response.json();
            
            timeSlotsContainer.innerHTML = '';
            if (availableSlots.length > 0) {
                availableSlots.forEach(slot => {
                    const button = document.createElement('button');
                    button.className = 'time-slot-btn';
                    button.textContent = slot;
                    button.dataset.slot = slot;
                    timeSlotsContainer.appendChild(button);
                });
            } else {
                timeSlotsContainer.innerHTML = '<p>抱歉，該日期已無可預約時段。</p>';
            }
            showStep(3);
        } catch (error) {
            console.error('Error checking availability:', error);
            alert('查詢時段失敗，請稍後再試。');
        } finally {
            hideLoading();
        }
    }
    
    // Submit booking
    async function submitBooking() {
        const contactName = contactNameInput.value.trim();
        const contactPhone = contactPhoneInput.value.trim();

        if (!contactName || !contactPhone) {
            alert('請填寫聯絡人姓名與電話。');
            return;
        }

        bookingData.contact_name = contactName;
        bookingData.contact_phone = contactPhone;
        bookingData.user_id = userId;

        showLoading();
        try {
            const response = await fetch(`${API_BASE_URL}/bookings-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || '預約失敗');
            }
            const result = await response.json();
            
            // Display summary
            bookingSummaryDiv.innerHTML = `
                <p><strong>預約類型:</strong> ${bookingData.booking_preference}</p>
                <p><strong>日期:</strong> ${bookingData.booking_date}</p>
                <p><strong>時段:</strong> ${bookingData.time_slot}</p>
                <p><strong>人數:</strong> ${bookingData.num_of_people}</p>
                <p><strong>聯絡人:</strong> ${bookingData.contact_name}</p>
            `;
            showStep(5);
            
        } catch (error) {
            console.error('Error submitting booking:', error);
            alert(`預約失敗：${error.message}`);
        } finally {
            hideLoading();
        }
    }


    function setupBookingPage() {
        // Step 1 listeners
        if (bookingPreferenceOneTimeBtn) {
            bookingPreferenceOneTimeBtn.addEventListener('click', () => {
                bookingData.booking_preference = '一次性';
                // You can add different logic here if needed
                showStep(2);
            });
        }
        if (bookingPreferenceTimedBtn) {
            bookingPreferenceTimedBtn.addEventListener('click', () => {
                bookingData.booking_preference = '計時制';
                // You can add different logic here if needed
                showStep(2);
            });
        }

        // Step 2 listener
        if (checkAvailabilityBtn) {
            checkAvailabilityBtn.addEventListener('click', checkAvailability);
        }
        
        // Step 3 listener (event delegation)
        if (timeSlotsContainer) {
            timeSlotsContainer.addEventListener('click', e => {
                if (e.target.classList.contains('time-slot-btn')) {
                    bookingData.time_slot = e.target.dataset.slot;
                    // Pre-fill contact name from LIFF profile
                    if(liffProfile && contactNameInput) {
                        contactNameInput.value = liffProfile.displayName;
                    }
                    showStep(4);
                }
            });
        }

        // Step 4 listener
        if (submitBookingBtn) {
            submitBookingBtn.addEventListener('click', submitBooking);
        }

        // Step 5 listener
        if (bookingDoneBtn) {
            bookingDoneBtn.addEventListener('click', () => {
                // Reset booking state and go back to adventurer page
                bookingData = {};
                showStep(1); // Reset to first step for next time
                showPage('adventurer-page');
            });
        }

        // Back buttons listener
        bookingContainer.addEventListener('click', e => {
            if (e.target.classList.contains('btn-back')) {
                const targetStep = e.target.dataset.targetStep;
                showStep(parseInt(targetStep));
            }
        });
    }


    /**
     * -------- NAVIGATION AND INITIALIZATION --------
     */

    // Setup navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.id.replace('nav-', '') + '-page';
            showPage(pageId);
        });
    });

    // Start the app
    initializeLiff();
});