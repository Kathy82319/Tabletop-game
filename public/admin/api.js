// public/admin/api.js

async function request(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP 錯誤，狀態碼: ${response.status}` }));
            throw new Error(errorData.error || '未知的 API 錯誤');
        }
        if (response.status === 204) return { success: true };
        return await response.json();
    } catch (error) {
        console.error(`API 請求失敗: ${url}`, error);
        throw error;
    }
}

export const api = {
    // Auth
    checkAuthStatus: () => request('/api/admin/auth/status'),
    
    // Dashboard
    getDashboardStats: () => request('/api/admin/dashboard-stats'),
    getActivities: () => request('/api/admin/activities'),
    markActivityAsRead: (activity_id) => request('/api/admin/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity_id }) }),    
    // Users
    getUsers: () => request('/api/get-users'),
    getUserDetails: (userId) => request(`/api/admin/user-details?userId=${userId}`),
    updateUserDetails: (data) => request('/api/update-user-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    
    searchUsers: (query) => request(`/api/admin/user-search?q=${encodeURIComponent(query)}`),

// Inventory (Boardgames)
getProducts: () => request('/api/get-boardgames'),
createGame: (data) => request('/api/admin/create-boardgame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
updateProductDetails: (data) => request('/api/admin/update-boardgame-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
updateProductOrder: (orderedGameIds) => request('/api/admin/update-boardgame-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedGameIds }) }),
batchUpdateGames: (gameIds, isVisible) => request('/api/admin/batch-update-games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameIds, isVisible }) }),
batchSetRentPrice: (gameIds, rentPrice) => request('/api/admin/batch-set-rent-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameIds, rentPrice }) }),
batchDeleteGames: (gameIds) => request('/api/admin/batch-delete-games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameIds }) }),
bulkCreateGames: (data) => request('/api/admin/bulk-create-games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
 
    // Rentals
    getAllRentals: (status = 'all') => request(`/api/admin/get-all-rentals?status=${status}`),
    createRental: (data) => request('/api/admin/create-rental', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    updateRentalDetails: (data) => request('/api/admin/update-rental-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    updateRentalStatus: (rentalId, status) => request('/api/admin/update-rental-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rentalId, status }) }),
    
    // Bookings
    getBookings: (status = 'today') => request(`/api/get-bookings?status=${status}`),
    createBooking: (data) => request('/api/admin/create-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    updateBookingStatus: (bookingId, status) => request('/api/update-booking-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, status }) }),
    getBookingSettings: () => request('/api/admin/booking-settings'),
    saveBookingSettings: (body) => request('/api/admin/booking-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),

    // EXP History
    getExpHistory: () => request('/api/admin/exp-history-list'),
    addPoints: (data) => request('/api/add-exp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    
    // News
    getAllNews: () => request('/api/admin/get-all-news'),
    createNews: (data) => request('/api/admin/create-news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    updateNews: (data) => request('/api/admin/update-news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    deleteNews: (id) => request('/api/admin/delete-news', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }),

    // Drafts
    getMessageDrafts: () => request('/api/admin/message-drafts'),
    createMessageDraft: (data) => request('/api/admin/message-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    updateMessageDraft: (data) => request('/api/admin/message-drafts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    deleteMessageDraft: (draft_id) => request('/api/admin/message-drafts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft_id }) }),
    
    // Misc
    sendMessage: (userId, message) => request('/api/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, message }) }),
    getStoreInfo: () => request('/api/get-store-info'),
    updateStoreInfo: (data) => request('/api/admin/update-store-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
};