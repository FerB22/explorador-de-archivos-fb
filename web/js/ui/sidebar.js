// ════════════════════════════════════════════════════════════════════════════
// GESTIÓN DE VISIBILIDAD Y REDIMENSIONAMIENTO DE BARRA LATERAL
// ════════════════════════════════════════════════════════════════════════════

const SidebarManager = {
  isCollapsed: false,

  init() {
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const btnShow = document.getElementById('btn-show-sidebar');
    const shell = document.querySelector('.app-shell');

    if (btnToggle) {
      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    if (btnShow) {
      btnShow.addEventListener('click', (e) => {
        e.stopPropagation();
        this.expand();
      });
    }

    // Atajo universal: Ctrl + B para alternar la barra lateral
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          e.preventDefault();
          this.toggle();
        }
      }
    });

    // Restaurar estado persistido
    try {
      const savedState = localStorage.getItem('sidebar_collapsed');
      if (savedState === 'true') {
        this.collapse(false);
      }
    } catch (e) {}
  },

  toggle() {
    if (this.isCollapsed) {
      this.expand();
    } else {
      this.collapse(true);
    }
  },

  collapse(showToastMessage = false) {
    const shell = document.querySelector('.app-shell');
    const btnShow = document.getElementById('btn-show-sidebar');
    if (!shell) return;

    this.isCollapsed = true;
    shell.classList.add('sidebar-collapsed');
    if (btnShow) btnShow.style.display = 'flex';
    try {
      localStorage.setItem('sidebar_collapsed', 'true');
    } catch (e) {}

    if (showToastMessage && typeof showToast === 'function') {
      showToast('Barra lateral oculta (Ctrl + B)');
    }
  },

  expand() {
    const shell = document.querySelector('.app-shell');
    const btnShow = document.getElementById('btn-show-sidebar');
    if (!shell) return;

    this.isCollapsed = false;
    shell.classList.remove('sidebar-collapsed');
    if (btnShow) btnShow.style.display = 'none';
    try {
      localStorage.setItem('sidebar_collapsed', 'false');
    } catch (e) {}

    if (typeof showToast === 'function') {
      showToast('Barra lateral visible');
    }
  }
};

function setupSidebarResize(initialWidth) {
  const sidebar = document.querySelector('.sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  if (!sidebar || !resizer) return;

  const storedW = parseInt(initialWidth) || parseInt(localStorage.getItem('sidebar_width')) || 290;
  sidebar.style.width = `${Math.max(220, Math.min(850, storedW))}px`;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizer.classList.add('is-resizing');
    document.body.classList.add('is-resizing');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const minW = 220;
    const maxW = Math.min(850, window.innerWidth - 320);
    const newW = Math.max(minW, Math.min(maxW, startWidth + dx));
    sidebar.style.width = `${newW}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove('is-resizing');
    document.body.classList.remove('is-resizing');
    const finalW = Math.round(sidebar.getBoundingClientRect().width);
    localStorage.setItem('sidebar_width', finalW);
    if (pyApi && pyApi.save_sidebar_width) {
      pyApi.save_sidebar_width(finalW);
    }
  });

  // Doble clic para restablecer el ancho por defecto (290 px)
  resizer.addEventListener('dblclick', () => {
    sidebar.style.width = '290px';
    localStorage.setItem('sidebar_width', 290);
    if (pyApi && pyApi.save_sidebar_width) {
      pyApi.save_sidebar_width(290);
    }
    showToast('Ancho de barra lateral restablecido');
  });
}
