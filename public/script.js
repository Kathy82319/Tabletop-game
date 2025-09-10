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
                // 注意：這裡我們不再立刻呼叫 fetchGames()
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

            fetchGameData(profile.userId); // 呼叫 fetchGameData 來取得會員遊戲資料

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

    async function fetchGameData(userId) {
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId }),
            });
            if (!response.ok) { throw new Error('無法取得會員遊戲資料'); }
            const gameData = await response.json();
            document.getElementById('user-class').textContent = gameData.class;
            document.getElementById('user-level').textContent = gameData.level;
            document.getElementById('user-exp').textContent = `${gameData.exp} / ${gameData.expToNextLevel}`;
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
        tag: null // 一次只篩選一個標籤
    };
    let gamesPageInitialized = false; // 追蹤圖鑑頁是否已初始化

    // 獲取圖鑑頁面上的重要元素
    const gameListContainer = document.getElementById('game-list-container');
    const keywordSearchInput = document.getElementById('keyword-search');
    const tagFiltersContainer = document.getElementById('tag-filters');
    const clearFiltersButton = document.getElementById('clear-filters');

    // 主要的渲染函式：根據篩選條件顯示遊戲
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
            detailsContainer.innerHTML = `
                <span>👥 ${game.min_players}-${game.max_players} 人</span>
                <span>⭐ 難度: ${game.difficulty}</span>
            `;

            infoContainer.appendChild(title);
            infoContainer.appendChild(description);
            infoContainer.appendChild(tagsContainer);
            infoContainer.appendChild(detailsContainer);

            gameCard.appendChild(img);
            gameCard.appendChild(infoContainer);
            gameListContainer.appendChild(gameCard);
        });
    }

    // 動態生成標籤篩選按鈕
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

    // 綁定篩選器的事件監聽器
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

    // 主函式：抓取資料並初始化圖鑑頁面 (只會執行一次)
    async function initializeGamesPage() {
        if (gamesPageInitialized) return; // 如果已初始化，就直接返回
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
    // 分頁切換邏輯 (整合遊戲圖鑑的初始化)
    // =================================================================
    const tabBar = document.getElementById('tab-bar');
    tabBar.addEventListener('click', (event) => {
        const button = event.target.closest('.tab-button');
        if (button) {
            const targetPageId = button.dataset.target;
            
            // ** 整合點：如果目標是圖鑑頁，且尚未初始化，就執行初始化 **
            if (targetPageId === 'page-games' && !gamesPageInitialized) {
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
    
    // 預設顯示首頁
    showPage('page-home');
});