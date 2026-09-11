// ════════════════════════════════════════════════════════════════════════════
// MODAL EMERGENTE SELECTOR DE CARPETA (Copiar a... / Mover a...)
// ════════════════════════════════════════════════════════════════════════════

const FolderPickerModal = (() => {
  let modalEl = null;
  let currentAction = null; // 'copy' | 'move'
  let currentItem = null;
  let allFolders = [];
  let selectedFolderPath = '';
  let isSubmitting = false;

  function initElements() {
    modalEl = document.getElementById('modal-folder-picker');
  }

  function isOpen() {
    return modalEl && modalEl.style.display === 'flex';
  }

  async function open(action, item) {
    initElements();
    if (!modalEl || !item || !item.path) return;

    currentAction = action;
    currentItem = item;
    isSubmitting = false;

    const badge = document.getElementById('mfp-badge-mode');
    const title = document.getElementById('mfp-title');
    const itemSub = document.getElementById('mfp-item-name');
    const confirmLabel = document.getElementById('mfp-confirm-label');
    const searchInput = document.getElementById('mfp-search-input');

    if (action === 'copy') {
      badge.textContent = 'COPIAR A';
      badge.className = 'modal-badge badge-copy';
      title.textContent = 'Seleccionar carpeta de destino para copiar';
      confirmLabel.textContent = 'Copiar aquí';
    } else {
      badge.textContent = 'MOVER A';
      badge.className = 'modal-badge badge-move';
      title.textContent = 'Seleccionar carpeta de destino para mover';
      confirmLabel.textContent = 'Mover aquí';
    }

    itemSub.textContent = `Elemento: ${item.name} (${item.is_dir ? 'Carpeta' : 'Archivo'})`;
    searchInput.value = '';

    selectedFolderPath = currentRootPath || '';
    updateSelectedDisplay();

    modalEl.style.display = 'flex';
    searchInput.focus();

    const listContainer = document.getElementById('mfp-folder-list');
    listContainer.innerHTML = '<div class="mfp-msg">⏳ Explorando carpetas…</div>';

    if (pyApi && pyApi.get_folders_list) {
      try {
        const res = await pyApi.get_folders_list('');
        allFolders = res.folders || [];
        renderList('');
      } catch (err) {
        console.error('Error al obtener carpetas:', err);
        listContainer.innerHTML = '<div class="mfp-msg">Error al cargar carpetas</div>';
      }
    }
  }

  function close() {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    currentAction = null;
    currentItem = null;
    allFolders = [];
    selectedFolderPath = '';
    isSubmitting = false;
  }

  function updateSelectedDisplay() {
    const targetPathEl = document.getElementById('mfp-target-path');
    if (!targetPathEl) return;
    let fullText = '';
    if (!selectedFolderPath || selectedFolderPath === currentRootPath) {
      const parts = (currentRootPath || '').split(/[\\/]/);
      fullText = `📁 [Raíz] ${parts[parts.length - 1] || 'Archivos'}`;
    } else {
      let displayPath = selectedFolderPath;
      if (currentRootPath && displayPath.toLowerCase().startsWith(currentRootPath.toLowerCase())) {
        displayPath = displayPath.slice(currentRootPath.length).replace(/^[\\/]+/, '');
      }
      fullText = `📁 ${displayPath || 'Raíz'}`;
    }
    targetPathEl.textContent = fullText;
    targetPathEl.title = fullText;
  }

  function renderList(query = '') {
    const listContainer = document.getElementById('mfp-folder-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const q = (query || '').trim().toLowerCase();

    // Entrada permanente: Carpeta raíz
    const rootItem = document.createElement('div');
    rootItem.className = 'mfp-folder-item' + (selectedFolderPath === currentRootPath ? ' selected' : '');
    const rootName = (currentRootPath || '').split(/[\\/]/).pop() || 'Archivos';
    rootItem.innerHTML = `
      <span class="mfp-folder-icon">📁</span>
      <div class="mfp-folder-info">
        <span class="mfp-folder-name">[Raíz] ${rootName}</span>
        <span class="mfp-folder-rel">Ubicación principal</span>
      </div>
    `;
    rootItem.addEventListener('click', () => {
      selectedFolderPath = currentRootPath;
      listContainer.querySelectorAll('.mfp-folder-item').forEach(el => el.classList.remove('selected'));
      rootItem.classList.add('selected');
      updateSelectedDisplay();
    });
    rootItem.addEventListener('dblclick', () => {
      selectedFolderPath = currentRootPath;
      confirm();
    });
    listContainer.appendChild(rootItem);

    // Filtrar carpetas excluyendo al propio elemento y a sus descendientes si es carpeta
    let filtered = allFolders;
    if (currentItem && currentItem.is_dir && currentItem.path) {
      const curNorm = currentItem.path.toLowerCase().replace(/\\/g, '/');
      filtered = filtered.filter(f => {
        const fNorm = f.path.toLowerCase().replace(/\\/g, '/');
        return fNorm !== curNorm && !fNorm.startsWith(curNorm + '/');
      });
    }

    if (q) {
      filtered = filtered.filter(f =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.rel_path && f.rel_path.toLowerCase().includes(q))
      );
    }

    if (!filtered.length && q) {
      const noResults = document.createElement('div');
      noResults.className = 'mfp-msg';
      noResults.textContent = `No se encontraron carpetas con «${query}»`;
      listContainer.appendChild(noResults);
      return;
    }

    filtered.forEach(f => {
      const itemEl = document.createElement('div');
      itemEl.className = 'mfp-folder-item' + (selectedFolderPath === f.path ? ' selected' : '');
      itemEl.innerHTML = `
        <span class="mfp-folder-icon">📁</span>
        <div class="mfp-folder-info">
          <span class="mfp-folder-name">${f.name}</span>
          <span class="mfp-folder-rel">${f.rel_path || f.path}</span>
        </div>
      `;
      itemEl.addEventListener('click', () => {
        selectedFolderPath = f.path;
        listContainer.querySelectorAll('.mfp-folder-item').forEach(el => el.classList.remove('selected'));
        itemEl.classList.add('selected');
        updateSelectedDisplay();
      });
      itemEl.addEventListener('dblclick', () => {
        selectedFolderPath = f.path;
        confirm();
      });
      listContainer.appendChild(itemEl);
    });
  }

  async function createSubfolder() {
    if (!currentItem) return;
    const parentTarget = selectedFolderPath || currentRootPath;
    const name = await CustomDialog.prompt({
      title: 'Nueva subcarpeta',
      subtitle: 'Crear dentro de la carpeta seleccionada',
      label: 'Nombre de la subcarpeta:',
      defaultValue: 'Nueva carpeta',
      placeholder: 'Escribe el nombre...',
      confirmText: 'Crear',
      cancelText: 'Cancelar',
      badgeText: 'SUBCARPETA',
      icon: '📁',
      selectBaseNameOnly: false
    });
    if (!name || !name.trim()) return;

    if (pyApi && pyApi.create_folder) {
      try {
        const res = await pyApi.create_folder(parentTarget, name.trim());
        if (res.success) {
          showToast(`Subcarpeta «${name.trim()}» creada`);
          const listRes = await pyApi.get_folders_list('');
          allFolders = listRes.folders || [];
          selectedFolderPath = res.path;
          const searchInput = document.getElementById('mfp-search-input');
          renderList(searchInput ? searchInput.value : '');
          updateSelectedDisplay();
        } else {
          showToast(res.message || 'Error al crear subcarpeta');
        }
      } catch (err) {
        console.error('Error al crear subcarpeta:', err);
      }
    }
  }

  async function confirm() {
    if (isSubmitting || !currentItem || !currentAction) return;
    const targetDir = selectedFolderPath || currentRootPath;
    if (!targetDir) {
      showToast('Selecciona una carpeta de destino');
      return;
    }

    isSubmitting = true;
    const btnConfirm = document.getElementById('mfp-btn-confirm');
    if (btnConfirm) btnConfirm.disabled = true;

    try {
      if (currentAction === 'copy') {
        const res = await pyApi.copy_item(currentItem.path, targetDir);
        if (res.success) {
          showToast(res.message || 'Copia realizada con éxito');
          close();
          await refreshExplorer();
        } else {
          showToast(res.message || 'Error al copiar elemento');
        }
      } else if (currentAction === 'move') {
        const res = await pyApi.move_item(currentItem.path, targetDir);
        if (res.success) {
          showToast(res.message || 'Elemento movido con éxito');
          close();
          await refreshExplorer();
          if (currentNode && currentNode.path === currentItem.path) {
            Viewer.clear();
          }
        } else {
          showToast(res.message || 'Error al mover elemento');
        }
      }
    } catch (err) {
      console.error('Error en operación de archivo:', err);
      showToast('Ocurrió un error inesperado');
    } finally {
      isSubmitting = false;
      if (btnConfirm) btnConfirm.disabled = false;
    }
  }

  function setup() {
    initElements();
    if (!modalEl) return;

    const btnClose = document.getElementById('mfp-btn-close');
    const btnCancel = document.getElementById('mfp-btn-cancel');
    const btnConfirm = document.getElementById('mfp-btn-confirm');
    const btnNewSub = document.getElementById('mfp-btn-new-subfolder');
    const searchInput = document.getElementById('mfp-search-input');

    if (btnClose) btnClose.addEventListener('click', () => close());
    if (btnCancel) btnCancel.addEventListener('click', () => close());
    if (btnConfirm) btnConfirm.addEventListener('click', () => confirm());
    if (btnNewSub) btnNewSub.addEventListener('click', () => createSubfolder());

    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) close();
    });

    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          renderList(e.target.value);
        }, 120);
      });
    }
  }

  return {
    open,
    close,
    isOpen,
    confirm,
    setup
  };
})();
