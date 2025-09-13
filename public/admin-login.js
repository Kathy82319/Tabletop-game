// public/admin-login.js

document.addEventListener('DOMContentLoaded', () => {
    // ** 關鍵修正：選擇器從 .sidebar-nav 改為 .nav-tabs **
    const mainNav = document.querySelector('.nav-tabs');
    const pages = document.querySelectorAll('.page');
    const userListTbody = document.getElementById('user-list-tbody');
    const userSearchInput = document.getElementById('user-search-input');

    let allUsers = [];

    // ---- 頁面切換邏輯 ----
    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.remove('active');
        });
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        const navLinks = document.querySelectorAll('.nav-tabs a');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) {
                link.classList.add('active');
            }
        });
    }
    
    // ** 關鍵修正：監聽新的導覽列 **
    mainNav.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const pageId = event.target.getAttribute('href').substring(1);
            showPage(pageId);
        }
    });

    // ---- 使用者管理邏輯 ----

    // 渲染使用者列表
    function renderUserList(users) {
        if (!userListTbody) return;
        userListTbody.innerHTML = '';
        if (users.length === 0) {
            userListTbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">找不到任何使用者資料。</td></tr>';
            return;
        }
        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.userId = user.user_id;
            row.innerHTML = `
                <td>${user.line_display_name || 'N/A'}</td>
                <td>${user.nickname || ''}</td>
                <td>${user.level}</td>
                <td>${user.current_exp} / 10</td>
                <td><span class="tag-display">${user.tag || '無'}</span></td>
                <td>
                    <button class="action-btn btn-edit" data-userid="${user.user_id}">編輯標籤</button>
                    <button class="action-btn btn-sync" data-userid="${user.user_id}">從Sheet同步</button>
                </td>
            `;
            userListTbody.appendChild(row);
        });
    }

    // 從後端 API 獲取所有使用者資料 (增強錯誤處理版)
    async function fetchAllUsers() {
        try {
            const response = await fetch('/api/get-users');
            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                throw new Error(`伺服器回應格式錯誤 (狀態碼: ${response.status})，內容: ${errorText.substring(0, 100)}...`);
            }
            allUsers = await response.json();
            renderUserList(allUsers);
        } catch (error) {
            console.error('獲取使用者列表失敗:', error);
            if (userListTbody) {
                userListTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">獲取資料失敗：${error.message}</td></tr>`;
            }
        }
    }

    // 搜尋功能
    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.toLowerCase().trim();
        const filteredUsers = searchTerm ? allUsers.filter(user => 
            (user.line_display_name || '').toLowerCase().includes(searchTerm) || 
            (user.nickname || '').toLowerCase().includes(searchTerm)
        ) : allUsers;
        renderUserList(filteredUsers);
    });

    // 按鈕事件處理 (使用事件代理)
    userListTbody.addEventListener('click', async (event) => {
        const target = event.target;
        const userId = target.dataset.userid;
        if (!userId) return;

        if (target.classList.contains('btn-edit')) {
            const currentTag = allUsers.find(u => u.user_id === userId).tag || '';
            const newTag = prompt('請輸入新的標籤 (會員, 員工, 特殊, 或其他):', currentTag);
            
            if (newTag !== null) {
                try {
                    const response = await fetch('/api/update-user-tag', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: userId, tag: newTag.trim() })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || '更新失敗');
                    
                    const user = allUsers.find(u => u.user_id === userId);
                    user.tag = newTag.trim();
                    const tagDisplay = document.querySelector(`tr[data-user-id="${userId}"] .tag-display`);
                    if (tagDisplay) tagDisplay.textContent = newTag.trim() || '無';
                    alert('標籤更新成功！');
                } catch (error) {
                    alert(`錯誤：${error.message}`);
                }
            }
        }

        if (target.classList.contains('btn-sync')) {
            if (!confirm(`確定要從 Google Sheet 同步使用者 ${userId} 的資料嗎？D1 資料庫中的該筆紀錄將被覆蓋。`)) return;

            try {
                target.textContent = '同步中...';
                target.disabled = true;

                const response = await fetch('/api/sync-user-from-sheet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error || '同步失敗');

                alert('同步成功！將重新整理列表資料。');
                await fetchAllUsers();
            } catch (error) {
                alert(`錯誤：${error.message}`);
            } finally {
                target.textContent = '從Sheet同步';
                target.disabled = false;
            }
        }
    });

    // ---- 初始化 ----
    function initialize() {
        showPage('users');
        fetchAllUsers();
    }

    initialize();
});