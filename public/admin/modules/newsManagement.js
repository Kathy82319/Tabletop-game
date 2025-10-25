// public/admin/modules/newsManagement.js
import { api } from '../api.js';
import { ui } from '../ui.js';

let allNews = [];
let flatpickrInstance = null;

/**
 * 渲染情報列表
 * @param {Array} newsList - 要顯示的情報陣列
 */
function renderNewsList(newsList) {
    const tbody = document.getElementById('news-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (newsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">目前沒有任何情報。</td></tr>';
        return;
    }

    newsList.forEach(news => {
        const row = tbody.insertRow();
        const statusText = news.is_published ? '已發布' : '草稿';
        const statusColor = news.is_published ? 'var(--success-color)' : 'var(--secondary-color)';

        row.innerHTML = `
            <td>${news.title}</td>
            <td>${news.category}</td>
            <td>${news.published_date}</td>
            <td><span style="color: ${statusColor};">${statusText}</span></td>
            <td class="actions-cell">
                <button class="action-btn btn-edit-news" data-news-id="${news.id}" style="background-color: var(--warning-color); color: #000;">編輯</button>
            </td>
        `;
    });
}

/**
 * 開啟新增或編輯情報的彈出視窗
 * @param {number|null} newsId - 要編輯的情報 ID，若為 null 則是新增
 */
function openEditNewsModal(newsId = null) {
    const modal = document.getElementById('edit-news-modal');
    const form = document.getElementById('edit-news-form');
    const modalTitle = document.getElementById('modal-news-title');
    const deleteBtn = document.getElementById('delete-news-btn');

    if (!modal || !form || !modalTitle || !deleteBtn) return;

    form.reset();
    form.querySelector('#edit-news-id').value = '';

    if (flatpickrInstance) {
        flatpickrInstance.destroy();
    }
    flatpickrInstance = flatpickr("#edit-news-date", {
        dateFormat: "Y-m-d",
        defaultDate: new Date()
    });

    if (newsId) {
        const newsItem = allNews.find(n => n.id === newsId);
        if (!newsItem) {
            ui.toast.error('找不到該筆情報！');
            return;
        }
        modalTitle.textContent = '編輯情報';
        form.querySelector('#edit-news-id').value = newsItem.id;
        form.querySelector('#edit-news-title').value = newsItem.title;
        form.querySelector('#edit-news-category').value = newsItem.category;
        flatpickrInstance.setDate(newsItem.published_date);
        form.querySelector('#edit-news-image').value = newsItem.image_url || '';
        form.querySelector('#edit-news-content').value = newsItem.content || '';
        form.querySelector('#edit-news-published').checked = newsItem.is_published;
        deleteBtn.style.display = 'inline-block';
        deleteBtn.dataset.newsId = newsId;

    } else {
        modalTitle.textContent = '新增情報';
        deleteBtn.style.display = 'none';
    }

    ui.showModal('#edit-news-modal');
}

/**
 * 處理情報表單的提交 (新增或更新)
 * @param {Event} event - 表單提交事件
 */
async function handleNewsFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const newsId = form.querySelector('#edit-news-id').value;
    const button = form.querySelector('button[type="submit"]');

    const data = {
        id: newsId ? parseInt(newsId, 10) : undefined,
        title: form.querySelector('#edit-news-title').value.trim(),
        category: form.querySelector('#edit-news-category').value.trim(),
        published_date: form.querySelector('#edit-news-date').value,
        image_url: form.querySelector('#edit-news-image').value.trim(),
        content: form.querySelector('#edit-news-content').value.trim(),
        is_published: form.querySelector('#edit-news-published').checked,
    };

    button.disabled = true;
    button.textContent = '儲存中...';

    try {
        if (data.id) {
            await api.updateNews(data);
            ui.toast.success('情報更新成功！');
        } else {
            await api.createNews(data);
            ui.toast.success('情報新增成功！');
        }
        ui.hideModal('#edit-news-modal');
        await init(); // 重新載入列表
    } catch (error) {
        ui.toast.error(`儲存失敗: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = '儲存';
    }
}

/**
 * 處理刪除情報的事件
 */
async function handleDeleteNews() {
    const newsId = parseInt(this.dataset.newsId, 10);
    if (!newsId) return;

    const confirmed = await ui.confirm('您確定要永久刪除這則情報嗎？此操作無法復原。');
    if (!confirmed) return;

    try {
        await api.deleteNews(newsId);
        ui.toast.success('情報已刪除！');
        ui.hideModal('#edit-news-modal');
        await init(); // 重新載入列表
    } catch (error) {
        ui.toast.error(`刪除失敗: ${error.message}`);
    }
}


/**
 * 綁定此頁面所有需要一次性設定的事件監聽器
 */
function setupEventListeners() {
    const page = document.getElementById('page-news');
    if (page.dataset.initialized) return;

    document.getElementById('add-news-btn').addEventListener('click', () => openEditNewsModal());

    document.getElementById('news-list-tbody').addEventListener('click', (event) => {
        const editBtn = event.target.closest('.btn-edit-news');
        if (editBtn) {
            const newsId = parseInt(editBtn.dataset.newsId, 10);
            openEditNewsModal(newsId);
        }
    });

    document.getElementById('edit-news-form').addEventListener('submit', handleNewsFormSubmit);
    document.getElementById('delete-news-btn').addEventListener('click', handleDeleteNews);

    page.dataset.initialized = 'true';
}


/**
 * 模組的初始化函式
 */
export const init = async (context, param) => {
    const page = document.getElementById('page-news');
    const tbody = document.getElementById('news-list-tbody');
    if (!page || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="5">正在載入情報...</td></tr>';

    try {
        allNews = await api.getAllNews();
        renderNewsList(allNews);
        setupEventListeners();
    } catch (error) {
        console.error('載入情報失敗:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red;">載入失敗: ${error.message}</td></tr>`;
    }
};