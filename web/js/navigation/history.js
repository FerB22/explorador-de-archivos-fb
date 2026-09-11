// ════════════════════════════════════════════════════════════════════════════
// HISTORIAL DE NAVEGACIÓN
// ════════════════════════════════════════════════════════════════════════════

const NavigationHistory = (() => {
  let stack = [];
  let currentIndex = -1;

  function push(path) {
    if (!path) return;
    if (currentIndex >= 0 && stack[currentIndex].toLowerCase() === path.toLowerCase()) {
      return;
    }
    if (currentIndex < stack.length - 1) {
      stack = stack.slice(0, currentIndex + 1);
    }
    stack.push(path);
    currentIndex = stack.length - 1;
    updateButtons();
  }

  function back() {
    if (currentIndex > 0) {
      currentIndex--;
      updateButtons();
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        FolderView.navigateTo(stack[currentIndex], false);
      }
    }
  }

  function forward() {
    if (currentIndex < stack.length - 1) {
      currentIndex++;
      updateButtons();
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        FolderView.navigateTo(stack[currentIndex], false);
      }
    }
  }

  function up() {
    const cur = getCurrentPath();
    if (!cur || !currentRootPath) return;
    const curNorm = cur.replace(/\\/g, '/').replace(/\/+$/, '');
    const rootNorm = currentRootPath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (curNorm.toLowerCase() === rootNorm.toLowerCase()) return;

    const parent = getParentPath(cur);
    if (parent && typeof FolderView !== 'undefined' && FolderView.navigateTo) {
      FolderView.navigateTo(parent);
    }
  }

  function getCurrentPath() {
    return (currentIndex >= 0 && currentIndex < stack.length) ? stack[currentIndex] : (currentRootPath || '');
  }

  function updateButtons() {
    const btnBack = document.getElementById('btn-nav-back');
    const btnFwd = document.getElementById('btn-nav-forward');
    const btnUp = document.getElementById('btn-nav-up');

    if (btnBack) btnBack.disabled = currentIndex <= 0;
    if (btnFwd) btnFwd.disabled = currentIndex >= stack.length - 1;

    if (btnUp) {
      const cur = getCurrentPath();
      const curNorm = (cur || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const rootNorm = (currentRootPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
      btnUp.disabled = !cur || curNorm.toLowerCase() === rootNorm.toLowerCase();
    }
  }

  function setup() {
    const btnBack = document.getElementById('btn-nav-back');
    const btnFwd = document.getElementById('btn-nav-forward');
    const btnUp = document.getElementById('btn-nav-up');
    const btnCopy = document.getElementById('btn-copy-current-path');

    if (btnBack) btnBack.addEventListener('click', () => back());
    if (btnFwd) btnFwd.addEventListener('click', () => forward());
    if (btnUp) btnUp.addEventListener('click', () => up());

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const cur = typeof FolderView !== 'undefined' && FolderView.getCurrentPath ? FolderView.getCurrentPath() : getCurrentPath();
        if (cur) {
          navigator.clipboard.writeText(cur)
            .then(() => showToast('Ruta de ubicación copiada'))
            .catch(() => showToast('No se pudo copiar la ruta'));
        }
      });
    }
  }

  function getState() {
    return { stack: [...stack], currentIndex };
  }

  function setState(state) {
    stack = state && Array.isArray(state.stack) ? [...state.stack] : [];
    currentIndex = state && typeof state.currentIndex === 'number' ? state.currentIndex : -1;
    updateButtons();
  }

  return {
    push,
    back,
    forward,
    up,
    setup,
    getCurrentPath,
    updateButtons,
    getState,
    setState,
    canBack: () => currentIndex > 0,
    canForward: () => currentIndex < stack.length - 1
  };
})();
