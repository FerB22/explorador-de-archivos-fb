// ════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA RECURSIVA EN DISCO
// ════════════════════════════════════════════════════════════════════════════

const SearchModal = (() => {
  let modalEl = null;
  let inputEl = null;
  let resultsListEl = null;
  let countEl = null;
  let spinnerEl = null;
  let scopeLabelEl = null;
  let btnOpenEl = null;
  let currentResults = [];
  let selectedIndex = -1;
  let searchTimer = null;
  let activeSearchRoot = '';

  function init() {
    modalEl = document.getElementById('modal-deep-search');
    inputEl = document.getElementById('mds-search-input');
    resultsListEl = document.getElementById('mds-results-list');
    countEl = document.getElementById('mds-results-count');
    spinnerEl = document.getElementById('mds-spinner');
    scopeLabelEl = document.getElementById('mds-scope-label');
    btnOpenEl = document.getElementById('mds-btn-open');
    const btnClose = document.getElementById('mds-btn-close');
    const btnCancel = document.getElementById('mds-btn-cancel');

    if (btnClose) btnClose.onclick = () => close();
    if (btnCancel) btnCancel.onclick = () => close();

    if (modalEl) {
      modalEl.onclick = (e) => {
        if (e.target === modalEl) close();
      };
    }

    if (inputEl) {
      inputEl.oninput = () => {
        clearTimeout(searchTimer);
        const q = inputEl.value.trim();
        if (!q) {
          currentResults = [];
          renderResults();
          return;
        }
        searchTimer = setTimeout(() => executeSearch(q), 180);
      };

      inputEl.onkeydown = (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectIndex(Math.min(currentResults.length - 1, selectedIndex + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectIndex(Math.max(0, selectedIndex - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
            openResult(currentResults[selectedIndex]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      };
    }

    if (btnOpenEl) {
      btnOpenEl.onclick = () => {
        if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
          openResult(currentResults[selectedIndex]);
        }
      };
    }
  }

  function open(targetRoot) {
    if (!modalEl) init();
    activeSearchRoot = targetRoot || (typeof FolderView !== 'undefined' && FolderView.getCurrentPath()) || currentRootPath;
    if (scopeLabelEl) {
      const parts = activeSearchRoot.split(/[\\/]/).filter(Boolean);
      scopeLabelEl.textContent = `Buscando en: ${parts[parts.length - 1] || 'Raíz'} y todas sus subcarpetas`;
    }
    if (modalEl) modalEl.style.display = 'flex';
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 60);
    }
    currentResults = [];
    selectedIndex = -1;
    renderResults();
  }

  function close() {
    if (modalEl) modalEl.style.display = 'none';
  }

  async function executeSearch(query) {
    if (!pyApi || !pyApi.search_files) return;
    if (spinnerEl) spinnerEl.style.display = 'block';
    try {
      const res = await pyApi.search_files(query, activeSearchRoot);
      currentResults = res.results || [];
      selectedIndex = currentResults.length > 0 ? 0 : -1;
      renderResults();
    } catch (err) {
      console.error('Error en búsqueda profunda:', err);
      currentResults = [];
      renderResults();
    } finally {
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  }

  function renderResults() {
    if (!resultsListEl) return;
    resultsListEl.innerHTML = '';
    if (countEl) {
      countEl.textContent = `${currentResults.length} coincidencia${currentResults.length === 1 ? '' : 's'}`;
    }
    if (btnOpenEl) {
      btnOpenEl.disabled = selectedIndex < 0;
    }

    if (!currentResults.length) {
      const q = inputEl ? inputEl.value.trim() : '';
      resultsListEl.innerHTML = `
        <div class="mds-empty-msg">${q ? `No se encontraron coincidencias para «${q}».` : 'Escribe un término para iniciar la búsqueda en disco.'}</div>
      `;
      return;
    }

    currentResults.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'mds-result-item' + (idx === selectedIndex ? ' selected' : '');
      const icon = item.is_dir ? '📁' : getIcon(item.extension);

      el.innerHTML = `
        <span class="mds-result-icon">${icon}</span>
        <div class="mds-result-info">
          <span class="mds-result-name" title="${item.name}">${item.name}</span>
          <span class="mds-result-rel" title="${item.relative}">${item.relative}</span>
        </div>
        <span class="mds-result-meta">${item.is_dir ? 'Carpeta' : formatSize(item.size || 0)}</span>
      `;

      el.onclick = () => {
        selectIndex(idx);
      };

      el.ondblclick = () => {
        openResult(item);
      };

      resultsListEl.appendChild(el);
    });

    const activeEl = resultsListEl.children[selectedIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectIndex(idx) {
    selectedIndex = idx;
    if (resultsListEl) {
      Array.from(resultsListEl.children).forEach((child, i) => {
        child.classList.toggle('selected', i === selectedIndex);
      });
      const activeEl = resultsListEl.children[selectedIndex];
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
    if (btnOpenEl) {
      btnOpenEl.disabled = selectedIndex < 0;
    }
  }

  async function openResult(item) {
    if (!item) return;
    close();
    if (item.is_dir) {
      await FolderView.navigateTo(item.path);
    } else {
      await Viewer.load(item);
    }
  }

  return {
    init,
    open,
    close,
    isOpen: () => modalEl && modalEl.style.display !== 'none'
  };
})();
