// ── Controles principales ─────────────────────────────────────────────────────
function setupControls() {
  // Buscador de archivos
  let timer = null;
  const inp = document.getElementById('file-search');
  const clr = document.getElementById('btn-search-clear');
  inp.addEventListener('input', e => {
    clearTimeout(timer);
    clr.style.display = e.target.value ? 'inline-block' : 'none';
    timer = setTimeout(() => FileTree.filter(e.target.value), 150);
  });
  clr.addEventListener('click', () => { inp.value = ''; clr.style.display = 'none'; FileTree.filter(''); inp.focus(); });

  // Botones de acción rápida en cabecera del árbol
  const btnNewFolder = document.getElementById('btn-new-folder');
  if (btnNewFolder) {
    btnNewFolder.addEventListener('click', async () => {
      await handleCreateFolder();
    });
  }

  const btnNewFile = document.getElementById('btn-new-file');
  if (btnNewFile) {
    btnNewFile.addEventListener('click', async () => {
      await handleCreateFile();
    });
  }

  // Botones de pie de barra lateral
  document.getElementById('btn-collapse-all').addEventListener('click', () => FileTree.collapseAll());
  document.getElementById('btn-refresh').addEventListener('click', async () => { await refreshExplorer(); showToast('Árbol y vista actualizados'); });
  document.getElementById('btn-reveal-root').addEventListener('click', async () => { if (pyApi) await pyApi.reveal_file(''); });
  document.getElementById('btn-theme-toggle').addEventListener('click', () => cycleTheme());
  document.getElementById('btn-change-root').addEventListener('click', async () => {
    if (!pyApi) return;
    const res = await pyApi.select_root_folder();
    if (res.success) {
      showToast('Carpeta raíz actualizada');
      await refreshExplorer();
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        await FolderView.navigateTo(currentRootPath);
      }
    }
  });

  const btnOpenSettings = document.getElementById('btn-open-settings');
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      if (typeof SettingsModal !== 'undefined') {
        SettingsModal.open();
      }
    });
  }

  // Conmutador de vistas (Archivos vs Papelera)
  const navTabFiles = document.getElementById('nav-tab-files');
  const navTabTrash = document.getElementById('nav-tab-trash');
  const panelExplorer = document.getElementById('panel-explorer');
  const panelTrash = document.getElementById('panel-trash');

  if (navTabFiles && navTabTrash) {
    navTabFiles.addEventListener('click', () => {
      navTabFiles.classList.add('active');
      navTabTrash.classList.remove('active');
      if (panelExplorer) panelExplorer.style.display = 'flex';
      if (panelTrash) panelTrash.style.display = 'none';
    });

    navTabTrash.addEventListener('click', async () => {
      navTabTrash.classList.add('active');
      navTabFiles.classList.remove('active');
      if (panelExplorer) panelExplorer.style.display = 'none';
      if (panelTrash) panelTrash.style.display = 'flex';
      await TrashManager.loadData();
    });
  }

  // Menú contextual
  document.getElementById('ctx-open').addEventListener('click', async () => {
    if (ctxNode && pyApi) await pyApi.open_file(ctxNode.path); hideCtx();
  });
  document.getElementById('ctx-reveal').addEventListener('click', async () => {
    if (ctxNode && pyApi) await pyApi.reveal_file(ctxNode.path); hideCtx();
  });

  const ctxNewFolder = document.getElementById('ctx-new-folder');
  if (ctxNewFolder) {
    ctxNewFolder.addEventListener('click', async () => {
      const targetDir = ctxNode ? (ctxNode.is_dir ? ctxNode.path : getParentPath(ctxNode.path)) : currentRootPath;
      hideCtx();
      await handleCreateFolder(targetDir);
    });
  }

  const ctxNewFile = document.getElementById('ctx-new-file');
  if (ctxNewFile) {
    ctxNewFile.addEventListener('click', async () => {
      const targetDir = ctxNode ? (ctxNode.is_dir ? ctxNode.path : getParentPath(ctxNode.path)) : currentRootPath;
      hideCtx();
      await handleCreateFile(targetDir);
    });
  }

  const ctxRename = document.getElementById('ctx-rename');
  if (ctxRename) {
    ctxRename.addEventListener('click', () => {
      const nodeToRename = ctxNode;
      hideCtx();
      if (nodeToRename) startInlineRename(nodeToRename);
    });
  }

  const ctxCopyTo = document.getElementById('ctx-copy-to');
  if (ctxCopyTo) {
    ctxCopyTo.addEventListener('click', () => {
      const nodeToCopy = ctxNode;
      hideCtx();
      if (nodeToCopy) FolderPickerModal.open('copy', nodeToCopy);
    });
  }

  const ctxMoveTo = document.getElementById('ctx-move-to');
  if (ctxMoveTo) {
    ctxMoveTo.addEventListener('click', () => {
      const nodeToMove = ctxNode;
      hideCtx();
      if (nodeToMove) FolderPickerModal.open('move', nodeToMove);
    });
  }

  const ctxDuplicate = document.getElementById('ctx-duplicate');
  if (ctxDuplicate) {
    ctxDuplicate.addEventListener('click', async () => {
      const nodeToDup = ctxNode;
      hideCtx();
      if (nodeToDup) await handleDuplicate(nodeToDup);
    });
  }

  document.getElementById('ctx-copy-path').addEventListener('click', () => {
    if (!ctxNode || !ctxNode.path) return hideCtx();
    const absPath = ctxNode.path;
    navigator.clipboard.writeText(absPath)
      .then(() => showToast('Ruta copiada al portapapeles'))
      .catch(() => showToast('No se pudo copiar la ruta'));
    hideCtx();
  });
  document.getElementById('ctx-copy-rel-path').addEventListener('click', () => {
    if (!ctxNode || !ctxNode.path) return hideCtx();
    const absPath = ctxNode.path;
    let relPath = absPath;
    if (currentRootPath) {
      const normAbs = absPath.replace(/\\/g, '/');
      const normRoot = currentRootPath.replace(/\\/g, '/').replace(/\/+$/, '');
      if (normAbs.toLowerCase().startsWith(normRoot.toLowerCase())) {
        relPath = normAbs.slice(normRoot.length).replace(/^\/+/, '');
        relPath = relPath.replace(/\//g, '\\');
      }
    }
    navigator.clipboard.writeText(relPath)
      .then(() => showToast('Ruta relativa copiada al portapapeles'))
      .catch(() => showToast('No se pudo copiar la ruta'));
    hideCtx();
  });
  const ctxToss = document.getElementById('ctx-toss-trash');
  if (ctxToss) {
    ctxToss.addEventListener('click', async () => {
      if (!ctxNode || !ctxNode.path || !pyApi) return hideCtx();
      const nodeToToss = ctxNode;
      hideCtx();
      await TrashManager.tossItemFromExplorer(nodeToToss);
    });
  }

  const ctxFav = document.getElementById('ctx-fav-toggle');
  if (ctxFav) {
    ctxFav.addEventListener('click', () => {
      if (ctxNode) {
        FavoritesManager.toggle(ctxNode.path, ctxNode.name, ctxNode.is_dir);
      }
      hideCtx();
    });
  }

  const ctxProps = document.getElementById('ctx-properties');
  if (ctxProps) {
    ctxProps.addEventListener('click', () => {
      const nodeForProps = ctxNode;
      hideCtx();
      if (nodeForProps) PropertiesModal.open(nodeForProps);
    });
  }

  // Botón de búsqueda recursiva en barra de navegación
  const btnNavSearch = document.getElementById('btn-nav-search');
  if (btnNavSearch) {
    btnNavSearch.addEventListener('click', () => {
      SearchModal.open();
    });
  }

  // Clic secundario en zona vacía del explorador (creación en raíz)
  const treeContainer = document.getElementById('file-tree');
  if (treeContainer) {
    treeContainer.addEventListener('contextmenu', e => {
      if (!e.target.closest('.tree-row')) {
        e.preventDefault();
        ctxNode = null;
        showCtx(e.clientX, e.clientY);
      }
    });

    // Soporte de desplazamiento horizontal para rueda lateral (Logitech MX Master 3S) y Shift + rueda
    // Gestionado universalmente en ventana con prioridad absoluta de contenido
  }

  // Desplazamiento horizontal ergonómico (estilo IDE) para rueda de pulgar (Logitech MX Master 3S) y Shift + rueda
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // Zoom con Ctrl

    let dx = e.deltaX;
    if (e.deltaMode === 1) dx *= 33; // Normalización por líneas (ruedas con muescas)
    else if (e.deltaMode === 2) dx *= 100; // Normalización por páginas

    // Soporte para Shift + rueda principal
    if (dx === 0 && e.shiftKey && e.deltaY) {
      dx = e.deltaY;
      if (e.deltaMode === 1) dx *= 33;
      else if (e.deltaMode === 2) dx *= 100;
    }

    if (Math.abs(dx) < 0.5) return;

    // Buscar contenedor desplazable horizontalmente bajo el puntero
    let cur = e.target;
    let scrollContainer = null;

    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (cur.id === 'file-tree' || cur.classList.contains('file-tree') ||
          cur.id === 'tab-bar' || cur.classList.contains('tab-bar') ||
          cur.id === 'breadcrumbs-bar' ||
          cur.classList.contains('pv-pre') || cur.classList.contains('pv-code-wrap') ||
          cur.classList.contains('pv-excel-grid') || cur.classList.contains('pv-editor-textarea')) {
        if (cur.scrollWidth > cur.clientWidth) {
          scrollContainer = cur;
          break;
        }
      }

      const style = window.getComputedStyle(cur);
      const ox = style.overflowX;
      if ((ox === 'auto' || ox === 'scroll') && cur.scrollWidth > cur.clientWidth) {
        scrollContainer = cur;
        break;
      }
      cur = cur.parentElement;
    }

    if (!scrollContainer) return;

    // Desplazamiento directo, simétrico y sin latencia
    scrollContainer.scrollLeft += dx;
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false, capture: true });

  document.addEventListener('click', () => hideCtx());

  // Atajos de teclado globales
  document.addEventListener('keydown', async e => {
    // Si algún modal está abierto
    if (typeof SettingsModal !== 'undefined' && SettingsModal.isOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        SettingsModal.close();
      }
      return;
    }

    if (FolderPickerModal.isOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        FolderPickerModal.close();
      } else if (e.key === 'Enter' && e.target.id !== 'mfp-search-input') {
        e.preventDefault();
        await FolderPickerModal.confirm();
      }
      return;
    }

    if (SearchModal.isOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        SearchModal.close();
      }
      return;
    }

    if (PropertiesModal.isOpen()) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        PropertiesModal.close();
      }
      return;
    }

    if (typeof CustomDialog !== 'undefined' && CustomDialog.isOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        CustomDialog.close();
      }
      return;
    }

    // Ctrl + S: Guardar cambios si se está editando en el visor
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
      if (typeof Viewer !== 'undefined' && Viewer.isEditing && Viewer.isEditing()) {
        e.preventDefault();
        await Viewer.saveCurrentEdit();
        return;
      }
    }

    if (e.key === 'Escape') {
      if (typeof Viewer !== 'undefined' && Viewer.isEditing && Viewer.isEditing()) {
        e.preventDefault();
        Viewer.cancelCurrentEdit();
        return;
      }
      hideCtx();
      return;
    }

    // Ctrl + ,: Abrir Ajustes
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ',') {
      e.preventDefault();
      if (typeof SettingsModal !== 'undefined') {
        SettingsModal.open();
      }
      return;
    }

    // Ctrl + T: Nueva pestaña
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      TabManager.createTab();
      return;
    }

    // Ctrl + W: Cerrar pestaña activa
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault();
      const activeTab = TabManager.getActiveTab();
      if (activeTab) TabManager.closeTab(activeTab.id);
      return;
    }

    // Ctrl + F: Búsqueda profunda en disco
    if (e.ctrlKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      SearchModal.open();
      return;
    }

    // Alt + Enter: Propiedades del elemento seleccionado
    if (e.altKey && e.key === 'Enter') {
      const selNodeForProps = (typeof FolderView !== 'undefined' && FolderView.getSelectedNode && FolderView.getSelectedNode())
        || FileTree.getSelectedNode();
      if (selNodeForProps) {
        e.preventDefault();
        PropertiesModal.open(selNodeForProps);
      }
      return;
    }

    // Atajos de navegación en historial
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      NavigationHistory.back();
      return;
    }

    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      NavigationHistory.forward();
      return;
    }

    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      NavigationHistory.up();
      return;
    }

    if (e.key === 'F5') {
      e.preventDefault();
      await refreshExplorer();
      showToast('Recargado');
      return;
    }

    // No interceptar si el usuario está tipeando en un input o textarea
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
      return;
    }

    // Backspace para retroceder carpeta (cuando no se esté editando texto)
    if (e.key === 'Backspace') {
      e.preventDefault();
      NavigationHistory.back();
      return;
    }

    const selNode = (typeof FolderView !== 'undefined' && FolderView.getSelectedNode && FolderView.getSelectedNode())
      || FileTree.getSelectedNode();

    // F2: Renombrar en línea
    if (e.key === 'F2') {
      if (selNode) {
        e.preventDefault();
        startInlineRename(selNode);
      }
      return;
    }

    // Ctrl + Shift + N: Nueva carpeta
    if (e.ctrlKey && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
      e.preventDefault();
      await handleCreateFolder();
      return;
    }

    // Ctrl + C: Copiar a... (despliega pop-up selector)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
      if (selNode) {
        e.preventDefault();
        FolderPickerModal.open('copy', selNode);
      }
      return;
    }

    // Ctrl + X: Mover a... (despliega pop-up selector)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'x' || e.key === 'X')) {
      if (selNode) {
        e.preventDefault();
        FolderPickerModal.open('move', selNode);
      }
      return;
    }

    // Ctrl + D: Duplicar elemento
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'd' || e.key === 'D')) {
      if (selNode) {
        e.preventDefault();
        await handleDuplicate(selNode);
      }
      return;
    }

    // Delete / Supr: Mover a la papelera
    if (e.key === 'Delete' || e.key === 'Del') {
      if (selNode) {
        e.preventDefault();
        await TrashManager.tossItemFromExplorer(selNode);
      }
      return;
    }
  });

  // Soporte para botones laterales de ratón (Logitech MX Master 3S y estándar)
  // Button 3 = Back (Retroceder), Button 4 = Forward (Adelantar)
  const handleMouseButtonNav = (e) => {
    // Si algún modal o menú contextual está abierto
    if (FolderPickerModal.isOpen() || SearchModal.isOpen() || PropertiesModal.isOpen() || (typeof CustomDialog !== 'undefined' && CustomDialog.isOpen())) {
      return;
    }

    if (e.button === 3) {
      // Botón lateral Atrás / Retroceder
      e.preventDefault();
      e.stopPropagation();
      if (typeof Viewer !== 'undefined' && Viewer.isVisible && Viewer.isVisible()) {
        if (Viewer.isEditing && Viewer.isEditing()) {
          Viewer.cancelCurrentEdit();
        } else {
          Viewer.clear();
        }
      } else {
        NavigationHistory.back();
      }
    } else if (e.button === 4) {
      // Botón lateral Adelante / Avanzar
      e.preventDefault();
      e.stopPropagation();
      NavigationHistory.forward();
    }
  };

  window.addEventListener('mouseup', handleMouseButtonNav, true);
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && (e.button === 3 || e.button === 4)) {
      e.preventDefault();
    }
  }, true);

  // Seguimiento de cambio de tema del sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'auto') applyTheme('auto');
  });

  // Inicializar modal selector de carpetas
  FolderPickerModal.setup();

  // Controles de papelera
  TrashManager.setupUI();
}

