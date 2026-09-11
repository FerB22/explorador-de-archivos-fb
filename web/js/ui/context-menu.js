// ════════════════════════════════════════════════════════════════════════════
// MENÚ CONTEXTUAL Y OPERACIONES CRUD DE ARCHIVOS/CARPETAS
// ════════════════════════════════════════════════════════════════════════════

function showCtx(x, y) {
  const m = document.getElementById('ctx-menu');
  if (!m) return;

  const requiresNode = [
    'ctx-open', 'ctx-reveal', 'ctx-rename', 'ctx-copy-to',
    'ctx-move-to', 'ctx-duplicate', 'ctx-copy-path',
    'ctx-copy-rel-path', 'ctx-toss-trash', 'ctx-fav-toggle', 'ctx-properties'
  ];
  requiresNode.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = ctxNode ? 'flex' : 'none';
  });

  if (ctxNode) {
    const favBtn = document.getElementById('ctx-fav-toggle');
    if (favBtn) {
      favBtn.style.display = 'flex';
      if (typeof FavoritesManager !== 'undefined') {
        const isPinned = FavoritesManager.isPinned(ctxNode.path);
        const favLabel = document.getElementById('ctx-fav-label');
        if (favLabel) favLabel.textContent = isPinned ? 'Desanclar de favoritos' : 'Anclar a favoritos';
      }
    }
  }

  m.querySelectorAll('.ctx-separator').forEach(sep => {
    sep.style.display = ctxNode ? 'block' : 'none';
  });

  m.style.display = 'block';
  m.style.left = x + 'px'; m.style.top = y + 'px';
  const r = m.getBoundingClientRect();
  if (r.right  > window.innerWidth)  m.style.left = (x - r.width)  + 'px';
  if (r.bottom > window.innerHeight) m.style.top  = (y - r.height) + 'px';
}

function hideCtx() {
  const m = document.getElementById('ctx-menu');
  if (m) m.style.display = 'none';
  ctxNode = null;
}

function getParentPath(p) {
  if (!p) return currentRootPath || '';
  const parts = p.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('\\');
}

async function refreshExplorer() {
  if (typeof FileTree !== 'undefined' && FileTree.loadRoot) {
    await FileTree.loadRoot();
  }
  if (typeof FolderView !== 'undefined' && FolderView.refresh) {
    await FolderView.refresh();
  }
}

function getResolvedTargetFolder() {
  const sel = (typeof FolderView !== 'undefined' && FolderView.getSelectedNode && FolderView.getSelectedNode())
    || (typeof FileTree !== 'undefined' && FileTree.getSelectedNode && FileTree.getSelectedNode());
  if (sel) {
    return sel.is_dir ? sel.path : getParentPath(sel.path);
  }
  if (typeof FolderView !== 'undefined' && FolderView.getCurrentPath && FolderView.getCurrentPath()) {
    return FolderView.getCurrentPath();
  }
  return currentRootPath || '';
}

async function handleCreateFolder(parentDir) {
  const target = parentDir || getResolvedTargetFolder();
  const targetName = target ? (target.replace(/\\/g, '/').split('/').filter(Boolean).pop() || target) : 'Directorio actual';
  const name = await CustomDialog.prompt({
    title: 'Nueva carpeta',
    subtitle: `Ubicación: ${targetName}`,
    label: 'Nombre de la carpeta:',
    defaultValue: 'Nueva carpeta',
    placeholder: 'Introduce el nombre de la carpeta...',
    confirmText: 'Crear carpeta',
    cancelText: 'Cancelar',
    badgeText: 'CARPETA',
    icon: '📁',
    selectBaseNameOnly: false
  });
  if (!name || !name.trim()) return;

  if (pyApi && pyApi.create_folder) {
    const res = await pyApi.create_folder(target, name.trim());
    if (res.success) {
      showToast(`Carpeta «${name.trim()}» creada`);
      await refreshExplorer();
    } else {
      showToast(res.message || 'Error al crear la carpeta');
    }
  }
}

async function handleCreateFile(parentDir) {
  const target = parentDir || getResolvedTargetFolder();
  const targetName = target ? (target.replace(/\\/g, '/').split('/').filter(Boolean).pop() || target) : 'Directorio actual';
  const name = await CustomDialog.prompt({
    title: 'Nuevo archivo',
    subtitle: `Ubicación: ${targetName}`,
    label: 'Nombre del archivo con extensión:',
    defaultValue: 'nuevo_archivo.txt',
    placeholder: 'ej. documento.txt',
    confirmText: 'Crear archivo',
    cancelText: 'Cancelar',
    badgeText: 'ARCHIVO',
    icon: '📄',
    selectBaseNameOnly: true
  });
  if (!name || !name.trim()) return;

  if (pyApi && pyApi.create_file) {
    const res = await pyApi.create_file(target, name.trim());
    if (res.success) {
      showToast(`Archivo «${name.trim()}» creado`);
      await refreshExplorer();
    } else {
      showToast(res.message || 'Error al crear el archivo');
    }
  }
}

async function handleDuplicate(node) {
  const targetNode = node
    || (typeof FolderView !== 'undefined' && FolderView.getSelectedNode && FolderView.getSelectedNode())
    || (typeof FileTree !== 'undefined' && FileTree.getSelectedNode && FileTree.getSelectedNode());
  if (!targetNode || !targetNode.path) {
    showToast('Selecciona un elemento para duplicar');
    return;
  }
  if (pyApi && pyApi.duplicate_item) {
    const res = await pyApi.duplicate_item(targetNode.path);
    if (res.success) {
      showToast(`Duplicado: «${res.new_name}»`);
      await refreshExplorer();
    } else {
      showToast(res.message || 'Error al duplicar elemento');
    }
  }
}

function startInlineRename(node, customEl) {
  if (!node || !node.path) return;
  const nodeEl = customEl || document.querySelector('.tree-node[data-path="' + CSS.escape(node.path) + '"]');
  if (!nodeEl) {
    CustomDialog.prompt({
      title: 'Renombrar elemento',
      subtitle: `Elemento: ${node.name}`,
      label: 'Nuevo nombre:',
      defaultValue: node.name,
      confirmText: 'Renombrar',
      cancelText: 'Cancelar',
      badgeText: 'RENOMBRAR',
      icon: '✏️',
      selectBaseNameOnly: !node.is_dir
    }).then(async newName => {
      if (newName && newName.trim() && newName.trim() !== node.name) {
        if (pyApi && pyApi.rename_item) {
          const res = await pyApi.rename_item(node.path, newName.trim());
          if (res.success) {
            showToast(`Renombrado a «${newName.trim()}»`);
            await refreshExplorer();
          } else {
            showToast(res.message || 'Error al renombrar');
          }
        }
      }
    });
    return;
  }
  const row = nodeEl.querySelector(':scope > .tree-row');
  const label = row ? row.querySelector('.tree-label') : null;
  if (!label || (row && row.querySelector('.tree-rename-input'))) return;

  const originalName = node.name;
  label.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tree-rename-input';
  input.value = originalName;

  row.appendChild(input);
  input.focus();

  // Seleccionar solo el nombre antes de la extensión si es un archivo
  const dotIndex = originalName.lastIndexOf('.');
  if (!node.is_dir && dotIndex > 0) {
    input.setSelectionRange(0, dotIndex);
  } else {
    input.select();
  }

  let committed = false;

  async function commit() {
    if (committed) return;
    committed = true;
    const newName = input.value.trim();
    if (!newName || newName === originalName) {
      cleanup();
      return;
    }
    if (pyApi && pyApi.rename_item) {
      const res = await pyApi.rename_item(node.path, newName);
      if (res.success) {
        showToast(`Renombrado a «${newName}»`);
        await refreshExplorer();
      } else {
        showToast(res.message || 'Error al renombrar');
        cleanup();
      }
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (input.parentNode) input.parentNode.removeChild(input);
    label.style.display = '';
  }

  input.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      await commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      committed = true;
      cleanup();
    }
  });

  input.addEventListener('click', (e) => { e.stopPropagation(); });
  input.addEventListener('dblclick', (e) => { e.stopPropagation(); });

  input.addEventListener('blur', async () => {
    if (!committed) {
      await commit();
    }
  });
}
