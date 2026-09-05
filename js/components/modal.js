// Reusable Modal Component Controller
(function () {
  let modalOverlay = null;

  function ensureModalElements() {
    modalOverlay = document.getElementById('global-modal-overlay');
    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.id = 'global-modal-overlay';
      modalOverlay.className = 'modal-overlay';
      modalOverlay.innerHTML = `
        <div class="modal-container" id="global-modal-container">
          <div class="modal-header">
            <h3 class="card-title" id="global-modal-title">Modal Title</h3>
            <button class="btn-ghost btn-icon-only" id="global-modal-close" aria-label="Close">
              <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="18" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body" id="global-modal-body"></div>
          <div class="modal-footer" id="global-modal-footer"></div>
        </div>
      `;
      document.body.appendChild(modalOverlay);

      // Close on backdrop click
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          window.closeModal();
        }
      });

      // Close on close button click
      const closeBtn = document.getElementById('global-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', window.closeModal);
      }

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
          window.closeModal();
        }
      });
    }
  }

  window.openModal = function ({ title, contentHtml, footerHtml, width = '620px', onOpen = null }) {
    ensureModalElements();
    
    const container = document.getElementById('global-modal-container');
    const titleEl = document.getElementById('global-modal-title');
    const bodyEl = document.getElementById('global-modal-body');
    const footerEl = document.getElementById('global-modal-footer');

    container.style.maxWidth = width;
    titleEl.innerHTML = title;
    bodyEl.innerHTML = contentHtml;
    footerEl.innerHTML = footerHtml || '';

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (typeof onOpen === 'function') {
      onOpen(bodyEl, footerEl);
    }
  };

  window.closeModal = function () {
    if (modalOverlay) {
      modalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  };
})();
