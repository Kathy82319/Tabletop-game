// public/admin/ui.js

export const ui = {
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.toggle('active', page.id === `page-${pageId}`);
        });
    },

    confirm: function(message) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmation-modal');
            const messageEl = document.getElementById('confirmation-message');
            const confirmBtn = document.getElementById('confirmation-confirm-btn');
            const cancelBtn = document.getElementById('confirmation-cancel-btn');
            const closeBtn = modal.querySelector('.modal-close');

            messageEl.textContent = message;

            const close = (result) => {
                ui.hideModal('#confirmation-modal');
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                closeBtn.onclick = null;
                resolve(result);
            };

            confirmBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            closeBtn.onclick = () => close(false);

            ui.showModal('#confirmation-modal');
        });
    },
    
    setActiveNav(pageId) {
        document.querySelectorAll('.nav-tabs a').forEach(link => {
            const linkTarget = link.getAttribute('href').substring(1);
            link.classList.toggle('active', linkTarget === pageId);
        });
    },

    toast: {
        _show: function(message, type = 'info') {
            let backgroundColor;
            switch(type) {
                case 'success':
                    backgroundColor = "linear-gradient(to right, #00b09b, #96c93d)";
                    break;
                case 'error':
                    backgroundColor = "linear-gradient(to right, #ff5f6d, #ffc371)";
                    break;
                default:
                    backgroundColor = "linear-gradient(to right, #4facfe, #00f2fe)";
                    break;
            }

            Toastify({
                text: message,
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                stopOnFocus: true,
                style: { background: backgroundColor },
            }).showToast();
        },
        success: function(message) { this._show(message, 'success'); },
        error: function(message) { this._show(message, 'error'); },
        info: function(message) { this._show(message, 'info'); }
    },

    showModal(modalId) {
        const modal = document.querySelector(modalId);
        if (modal) modal.style.display = 'flex';
    },

    hideModal(modalId) {
        const modal = document.querySelector(modalId);
        if (modal) modal.style.display = 'none';
    },

    initSharedEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close') || e.target.matches('.btn-cancel')) {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.style.display = 'none';
            }
        });
    }
};