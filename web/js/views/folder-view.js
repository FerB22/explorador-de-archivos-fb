// ════════════════════════════════════════════════════════════════════════════
// VISTA CENTRAL DE CARPETA (Cuadrícula y Lista detallada)
// ════════════════════════════════════════════════════════════════════════════
const FolderView = (() => {
  let currentPath = '';
  let currentNodes = [];
  let selectedNode = null;
  let viewMode = localStorage.getItem('folder_view_mode') || 'grid';
  let sortMode = localStorage.getItem('folder_sort_mode') || 'name-asc';
  let filterText = '';

  async function navigateTo(folderPath, pushToHistory = true) {
    currentPath = folderPath || currentRootPath || '';
    if (pushToHistory) {
      NavigationHistory.push(currentPath);
    }

    const fvPanel = document.getElementById('folder-view-panel');
    const pvToolbar = document.getElementById('preview-toolbar');
    const pvBody = document.getElementById('preview-body');

    if (fvPanel) fvPanel.style.display = 'flex';
    if (pvToolbar) pvToolbar.style.display = 'none';
    if (pvBody) pvBody.style.display = 'none';

    selectedNode = null;

    renderBreadcrumbs(currentPath);

    const container = document.getElementById('folder-content-container');
    if (container) container.innerHTML = '<div class="fc-empty-state"><span>⏳ Cargando elementos…</span></div>';

    if (pyApi && pyApi.get_files) {
      try {
        const res = await pyApi.get_files(currentPath);
        currentNodes = res.nodes || [];
      } catch (err) {
        console.error('Error al cargar carpeta:', err);
        currentNodes = [];
      }
    }

    updateHeader();
    renderContent();
    updateStatusBar();
    syncTreeSelection(currentPath);

    if (typeof TabManager !== 'undefined' && TabManager.updateActiveTab) {
      const parts = (currentPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
      const folderName = parts.length ? parts[parts.length - 1] : 'Archivos';
      TabManager.updateActiveTab(currentPath, folderName);
    }
    if (typeof FavoritesManager !== 'undefined' && FavoritesManager.render) {
      FavoritesManager.render();
    }
  }

  function updateHeader() {
    const titleEl = document.getElementById('fv-title');
    const countBadge = document.getElementById('fv-count-badge');
    const filterInput = document.getElementById('fv-filter-input');

    if (filterInput) filterInput.value = '';
    filterText = '';

    const parts = (currentPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const folderName = parts.length ? parts[parts.length - 1] : 'Archivos';
    if (titleEl) titleEl.textContent = folderName;

    const dirsCount = currentNodes.filter(n => n.is_dir).length;
    const filesCount = currentNodes.filter(n => !n.is_dir).length;
    if (countBadge) {
      countBadge.textContent = `${currentNodes.length} elementos (${dirsCount} ${dirsCount === 1 ? 'carpeta' : 'carpetas'}, ${filesCount} ${filesCount === 1 ? 'archivo' : 'archivos'})`;
    }
  }

  function renderBreadcrumbs(path, forFile = false) {
    const bar = document.getElementById('breadcrumbs-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const normRoot = (currentRootPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const normPath = (path || '').replace(/\\/g, '/').replace(/\/+$/, '');

    const rootName = normRoot.split('/').pop() || 'Archivos';
    const isRootActive = !forFile && (normPath.toLowerCase() === normRoot.toLowerCase());
    const rootSegment = document.createElement('span');
    rootSegment.className = 'breadcrumb-item' + (isRootActive ? ' active' : '');
    rootSegment.innerHTML = `<span>📁</span><span>${rootName}</span>`;
    rootSegment.addEventListener('click', () => navigateTo(currentRootPath));
    DragDropManager.makeDropZone(rootSegment, currentRootPath);
    bar.appendChild(rootSegment);

    if (normPath.toLowerCase() !== normRoot.toLowerCase() && normPath.toLowerCase().startsWith(normRoot.toLowerCase())) {
      const sub = normPath.slice(normRoot.length).replace(/^\/+/, '');
      const parts = sub.split('/').filter(Boolean);
      let cumulative = normRoot;

      parts.forEach((part, idx) => {
        cumulative += '/' + part;
        const thisPath = cumulative.replace(/\//g, '\\');
        const isLast = idx === parts.length - 1;
        const isActive = !forFile && isLast;

        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
        bar.appendChild(sep);

        const seg = document.createElement('span');
        seg.className = 'breadcrumb-item' + (isActive ? ' active' : '');
        seg.textContent = part;
        // Si no es el elemento activo final, o si estamos mostrando un archivo, este segmento siempre es clicable
        if (!isActive) {
          seg.addEventListener('click', () => navigateTo(thisPath));
        }
        DragDropManager.makeDropZone(seg, thisPath);
        bar.appendChild(seg);
      });
    }

    bar.scrollLeft = bar.scrollWidth;
  }

  function renderBreadcrumbsForFile(fileNode) {
    const parent = getParentPath(fileNode.path);
    renderBreadcrumbs(parent, true);

    const bar = document.getElementById('breadcrumbs-bar');
    if (!bar) return;

    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
    bar.appendChild(sep);

    const fileSeg = document.createElement('span');
    fileSeg.className = 'breadcrumb-item active';
    fileSeg.innerHTML = `<span>${getIcon(fileNode.extension)}</span><span>${fileNode.name}</span>`;
    bar.appendChild(fileSeg);

    bar.scrollLeft = bar.scrollWidth;
  }

  function sortNodes(nodes) {
    const list = [...nodes];
    list.sort((a, b) => {
      // Carpetas siempre primero
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;

      switch (sortMode) {
        case 'name-asc':
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'name-desc':
          return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'date-desc':
          return (b.modified || 0) - (a.modified || 0);
        case 'date-asc':
          return (a.modified || 0) - (b.modified || 0);
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'size-asc':
          return (a.size || 0) - (b.size || 0);
        case 'type-asc':
          return (a.extension || '').localeCompare(b.extension || '') || a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      }
    });
    return list;
  }

  let activeRenderToken = 0;

  function renderContent(filterQuery = '') {
    const container = document.getElementById('folder-content-container');
    if (!container) return;

    // Cancelar cualquier renderizado progresivo pendiente
    activeRenderToken++;
    const currentToken = activeRenderToken;

    container.innerHTML = '';
    container.className = `folder-content-container view-${viewMode}`;

    const q = (filterQuery || '').trim().toLowerCase();
    let items = currentNodes;
    if (q) {
      items = items.filter(n => n.name.toLowerCase().includes(q));
    }
    items = sortNodes(items);

    if (!items.length) {
      container.innerHTML = `
        <div class="fc-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M3 3h6l2 3h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
          </svg>
          <p>${q ? `No se encontraron elementos con «${filterQuery}»` : 'Esta carpeta está vacía'}</p>
        </div>
      `;
      return;
    }

    const BATCH_SIZE = 80;
    let renderedIndex = 0;

    function createItemElement(node) {
      if (viewMode === 'grid') {
        const card = document.createElement('div');
        card.className = 'fc-card' + (selectedNode && selectedNode.path === node.path ? ' selected' : '');
        const icon = node.is_dir ? '📁' : getIcon(node.extension);
        const subInfo = node.is_dir ? 'Carpeta' : (node.extension ? node.extension.toUpperCase() : 'Archivo');
        const sizeInfo = node.is_dir ? '' : ' · ' + formatSize(node.size || 0);

        card.innerHTML = `
          <span class="fc-icon">${icon}</span>
          <span class="fc-name" title="${node.name}">${node.name}</span>
          <span class="fc-sub">${subInfo}${sizeInfo}</span>
        `;

        card.addEventListener('click', (e) => {
          e.stopPropagation();
          selectCard(card, node);
        });

        card.addEventListener('dblclick', async (e) => {
          e.stopPropagation();
          if (node.is_dir) {
            await navigateTo(node.path);
          } else {
            await Viewer.load(node);
          }
        });

        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectCard(card, node);
          ctxNode = node;
          showCtx(e.clientX, e.clientY);
        });

        DragDropManager.makeDraggable(card, node);
        if (node.is_dir) {
          DragDropManager.makeDropZone(card, node.path);
        }

        return card;
      } else {
        const row = document.createElement('div');
        row.className = 'fc-row' + (selectedNode && selectedNode.path === node.path ? ' selected' : '');
        const icon = node.is_dir ? '📁' : getIcon(node.extension);
        const typeInfo = node.is_dir ? 'Carpeta' : (node.extension ? `Archivo ${node.extension.toUpperCase()}` : 'Archivo');
        const dateStr = formatDate(node.modified);
        const sizeStr = node.is_dir ? '—' : formatSize(node.size || 0);

        row.innerHTML = `
          <span class="fc-icon">${icon}</span>
          <span class="fc-name" title="${node.name}">${node.name}</span>
          <span class="fc-type" title="${typeInfo}">${typeInfo}</span>
          <span class="fc-date">${dateStr}</span>
          <span class="fc-size">${sizeStr}</span>
        `;

        row.addEventListener('click', (e) => {
          e.stopPropagation();
          selectCard(row, node);
        });

        row.addEventListener('dblclick', async (e) => {
          e.stopPropagation();
          if (node.is_dir) {
            await navigateTo(node.path);
          } else {
            await Viewer.load(node);
          }
        });

        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectCard(row, node);
          ctxNode = node;
          showCtx(e.clientX, e.clientY);
        });

        DragDropManager.makeDraggable(row, node);
        if (node.is_dir) {
          DragDropManager.makeDropZone(row, node.path);
        }

        return row;
      }
    }

    function renderNextBatch() {
      if (currentToken !== activeRenderToken) return;

      const frag = document.createDocumentFragment();
      const endIndex = Math.min(renderedIndex + BATCH_SIZE, items.length);

      for (let i = renderedIndex; i < endIndex; i++) {
        frag.appendChild(createItemElement(items[i]));
      }

      container.appendChild(frag);
      renderedIndex = endIndex;

      if (renderedIndex < items.length) {
        requestAnimationFrame(renderNextBatch);
      }
    }

    // El primer lote se acopla de inmediato al DOM
    renderNextBatch();
  }

  function selectCard(element, node) {
    const container = document.getElementById('folder-content-container');
    if (container) {
      container.querySelectorAll('.fc-card, .fc-row').forEach(el => el.classList.remove('selected'));
    }
    element.classList.add('selected');
    selectedNode = node;
    updateStatusBar();
  }

  function updateStatusBar() {
    const countEl = document.getElementById('sb-item-count');
    const selectionEl = document.getElementById('sb-selection');

    const dirsCount = currentNodes.filter(n => n.is_dir).length;
    const filesCount = currentNodes.filter(n => !n.is_dir).length;

    if (countEl) {
      countEl.textContent = `${currentNodes.length} elementos (${dirsCount} ${dirsCount === 1 ? 'carpeta' : 'carpetas'}, ${filesCount} ${filesCount === 1 ? 'archivo' : 'archivos'})`;
    }

    if (selectionEl) {
      if (selectedNode) {
        selectionEl.textContent = `Seleccionado: ${selectedNode.name} (${selectedNode.is_dir ? 'Carpeta' : (selectedNode.extension ? selectedNode.extension.toUpperCase() : 'Archivo')})`;
      } else {
        selectionEl.textContent = 'Listo';
      }
    }
  }

  function syncTreeSelection(path) {
    if (!path) return;
    if (typeof FileTree !== 'undefined' && FileTree.revealAndExpand) {
      FileTree.revealAndExpand(path, true);
    } else {
      const treeNode = document.querySelector(`.tree-node[data-path="${CSS.escape(path)}"] > .tree-row`);
      if (treeNode) {
        document.querySelectorAll('.tree-row.selected').forEach(r => r.classList.remove('selected'));
        treeNode.classList.add('selected');
      }
    }
  }

  function setViewMode(mode, notify = true) {
    viewMode = mode;
    localStorage.setItem('folder_view_mode', mode);
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    if (btnList) btnList.classList.toggle('active', mode === 'list');
    renderContent(filterText);
    if (notify) {
      showToast(mode === 'grid' ? 'Vista: Cuadrícula' : 'Vista: Lista', 1400);
    }
  }

  function setup() {
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    const filterInput = document.getElementById('fv-filter-input');
    const sortSelect = document.getElementById('fv-sort-select');
    const container = document.getElementById('folder-content-container');
    const btnBackToFolder = document.getElementById('preview-btn-back-to-folder');

    if (btnGrid) btnGrid.addEventListener('click', () => setViewMode('grid'));
    if (btnList) btnList.addEventListener('click', () => setViewMode('list'));

    if (sortSelect) {
      sortSelect.value = sortMode;
      sortSelect.addEventListener('change', (e) => {
        sortMode = e.target.value;
        localStorage.setItem('folder_sort_mode', sortMode);
        renderContent(filterText);
        const labels = {
          name_asc: 'Nombre (A - Z)',
          name_desc: 'Nombre (Z - A)',
          date_desc: 'Más recientes primero',
          date_asc: 'Más antiguos primero',
          size_desc: 'Mayor tamaño',
          size_asc: 'Menor tamaño',
          type: 'Tipo de archivo'
        };
        showToast(`Orden: ${labels[sortMode] || sortMode}`, 1500);
      });
    }

    if (filterInput) {
      let filterTimer = null;
      filterInput.addEventListener('input', (e) => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
          filterText = e.target.value;
          renderContent(filterText);
        }, 120);
      });
    }

    if (container) {
      container.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.fc-card') && !e.target.closest('.fc-row')) {
          e.preventDefault();
          ctxNode = null;
          showCtx(e.clientX, e.clientY);
        }
      });

      container.addEventListener('click', (e) => {
        if (!e.target.closest('.fc-card') && !e.target.closest('.fc-row')) {
          container.querySelectorAll('.fc-card, .fc-row').forEach(el => el.classList.remove('selected'));
          selectedNode = null;
          updateStatusBar();
        }
      });

      // Permitir soltar en el espacio vacío para mover elementos a la carpeta actualmente abierta
      container.addEventListener('dragover', (e) => {
        if (e.target.closest('.fc-card') || e.target.closest('.fc-row')) return;
        const dragged = DragDropManager.getDraggedNode();
        if (!dragged) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      container.addEventListener('drop', async (e) => {
        if (e.target.closest('.fc-card') || e.target.closest('.fc-row')) return;
        const dragged = DragDropManager.getDraggedNode();
        if (!dragged) return;
        e.preventDefault();
        await DragDropManager.executeMove(dragged.path, currentPath);
      });
    }

    if (btnBackToFolder) {
      btnBackToFolder.addEventListener('click', () => {
        const target = currentPath || currentRootPath;
        navigateTo(target);
      });
    }

    setViewMode(viewMode, false);
  }

  return {
    navigateTo,
    setup,
    getCurrentPath: () => currentPath,
    getSelectedNode: () => selectedNode,
    renderBreadcrumbsForFile,
    refresh: () => navigateTo(currentPath, false),
    setSortMode: (mode) => {
      sortMode = mode;
      localStorage.setItem('folder_sort_mode', mode);
      const sortSelect = document.getElementById('fv-sort-select');
      if (sortSelect) sortSelect.value = mode;
      renderContent(filterText);
    },
    getSortMode: () => sortMode
  };
})();
