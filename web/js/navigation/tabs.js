// ════════════════════════════════════════════════════════════════════════════
// PESTAÑAS MÚLTIPLES (TABBED BROWSING)
// ════════════════════════════════════════════════════════════════════════════

const TabManager = (() => {
  let tabs = [];
  let activeTabId = null;
  let tabIdCounter = 1;

  function init() {
    const btnAdd = document.getElementById('btn-tab-add');
    if (btnAdd) {
      btnAdd.onclick = () => createTab();
    }
  }

  function createTab(folderPath) {
    const targetPath = folderPath || currentRootPath || '';
    const parts = targetPath.replace(/\\/g, '/').split('/').filter(Boolean);
    const title = parts[parts.length - 1] || 'Archivos';

    const tabId = 'tab_' + (tabIdCounter++);
    const newTab = {
      id: tabId,
      title: title,
      path: targetPath,
      history: { stack: [targetPath], currentIndex: 0 }
    };

    tabs.push(newTab);
    renderTabs();
    switchTab(tabId);
    showToast(`Nueva pestaña: ${title}`, 1500);
    return newTab;
  }

  function switchTab(tabId) {
    if (activeTabId === tabId) return;

    if (activeTabId) {
      const prevTab = tabs.find(t => t.id === activeTabId);
      if (prevTab && typeof NavigationHistory !== 'undefined' && typeof FolderView !== 'undefined') {
        prevTab.history = NavigationHistory.getState();
        prevTab.path = FolderView.getCurrentPath();
      }
    }

    activeTabId = tabId;
    renderTabs();

    const curTab = tabs.find(t => t.id === tabId);
    if (curTab) {
      if (typeof NavigationHistory !== 'undefined') {
        NavigationHistory.setState(curTab.history);
      }
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        FolderView.navigateTo(curTab.path, false);
      }
    }
  }

  function closeTab(tabId, e) {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) {
      showToast('No se puede cerrar la única pestaña abierta');
      return;
    }

    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;

    const wasActive = activeTabId === tabId;
    tabs.splice(idx, 1);

    if (wasActive) {
      const newActive = tabs[Math.max(0, idx - 1)];
      activeTabId = newActive.id;
      renderTabs();
      if (typeof NavigationHistory !== 'undefined') {
        NavigationHistory.setState(newActive.history);
      }
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        FolderView.navigateTo(newActive.path, false);
      }
    } else {
      renderTabs();
    }
  }

  function updateActiveTab(path, title) {
    const curTab = tabs.find(t => t.id === activeTabId);
    if (!curTab) return;
    curTab.path = path;
    if (title) curTab.title = title;
    if (typeof NavigationHistory !== 'undefined') {
      curTab.history = NavigationHistory.getState();
    }
    renderTabs();
  }

  function renderTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    container.innerHTML = '';

    tabs.forEach(tab => {
      const el = document.createElement('div');
      const isAct = tab.id === activeTabId;
      el.className = 'tab-item' + (isAct ? ' active' : '');

      el.innerHTML = `
        <span class="tab-icon">📁</span>
        <span class="tab-title" title="${tab.path}">${tab.title}</span>
        ${tabs.length > 1 ? '<span class="tab-close" title="Cerrar pestaña (Ctrl + W)">✕</span>' : ''}
      `;

      el.onclick = () => switchTab(tab.id);

      const btnClose = el.querySelector('.tab-close');
      if (btnClose) {
        btnClose.onclick = (e) => closeTab(tab.id, e);
      }

      container.appendChild(el);
    });
  }

  function setupInitialTab(rootPath) {
    init();
    const parts = (rootPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const title = parts[parts.length - 1] || 'Archivos';
    tabs = [{
      id: 'tab_1',
      title: title,
      path: rootPath || '',
      history: { stack: [rootPath || ''], currentIndex: 0 }
    }];
    activeTabId = 'tab_1';
    tabIdCounter = 2;
    renderTabs();
  }

  return {
    init,
    createTab,
    switchTab,
    closeTab,
    updateActiveTab,
    setupInitialTab,
    getActiveTab: () => tabs.find(t => t.id === activeTabId)
  };
})();
