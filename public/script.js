document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // LIFF & 使用者資料區塊
    // =================================================================
    const myLiffId = "2008076323-GN1e7naW"; // 你的 LIFF ID

    liff.init({ liffId: myLiffId })
        .then(() => {
            console.log("LIFF 初始化成功");
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                fetchUserProfile();
            }
        })
        .catch((err) => { console.error("LIFF 初始化失敗", err); });
         
    function fetchUserProfile() {
        liff.getProfile().then(profile => {
            document.getElementById('display-name').textContent = profile.displayName;
            document.getElementById('status-message').textContent = profile.statusMessage || '';
            const profilePicture = document.getElementById('profile-picture');
            if (profile.pictureUrl) {
                profilePicture.src = profile.pictureUrl;
            }

            // ** 修正點 1: 傳入完整的 profile 物件 **
            fetchGameData(profile); 

            const qrcodeElement = document.getElementById('qrcode');
            qrcodeElement.innerHTML = '';
            new QRCode(qrcodeElement, {
                text: profile.userId,
                width: 200,
                height: 200,
            });
        }).catch((err) => {
            console.error("取得 Profile 失敗", err);
        });
    }

    // ** 修正點 2: 修改函式以接收完整的 profile 物件 **
    async function fetchGameData(profile) { 
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // ** 修正點 3: 將完整的 profile 資訊都傳給後端 **
                body: JSON.stringify({ 
                    userId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl
                }),
            });
            if (!response.ok) { throw new Error('無法取得會員遊戲資料'); }
            
            const gameData = await response.json();

            // 假設後端回傳的資料中沒有 expToNextLevel，我們在前端計算
            // (如果後端有回傳，這裡的計算會被覆蓋，不影響)
            let expToNextLevel = gameData.expToNextLevel;
            if (!expToNextLevel) {
                 expToNextLevel = Math.floor(100 * Math.pow(gameData.level || 1, 1.5));
            }

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
    // 分頁切換邏輯
    // =================================================================
    const tabBar = document.getElementById('tab-bar');
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            
            if (targetPageId === 'page-games') {
                initializeGamesPage();
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