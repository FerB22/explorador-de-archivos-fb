// ════════════════════════════════════════════════════════════════════════════
// ACCESO RÁPIDO Y CARPETAS FAVORITAS
// ════════════════════════════════════════════════════════════════════════════

const FavoritesManager = (() => {
  let favorites = [];

  function load() {
    try {
      const stored = localStorage.getItem('explorer_favorites');
      favorites = stored ? JSON.parse(stored) : [];
    } catch (e) {
      favorites = [];
    }
  }

  function save() {
    localStorage.setItem('explorer_favorites', JSON.stringify(favorites));
  }

  function isPinned(path) {
    if (!path) return false;
    const pNorm = path.replace(/\\/g, '/').toLowerCase();
    return favorites.some(f => f.path.replace(/\\/g, '/').toLowerCase() === pNorm);
  }

  function pin(path, name, isDir = false) {
    if (!path || isPinned(path)) return;
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    const favName = name || parts[parts.length - 1] || (isDir ? 'Carpeta' : 'Archivo');
    const isDirectory = (typeof isDir === 'boolean') ? isDir : (ctxNode ? !!ctxNode.is_dir : false);
    const ext = isDirectory ? '' : (favName.includes('.') ? favName.split('.').pop().toLowerCase() : '');

    favorites.push({ name: favName, path, is_dir: isDirectory, ext });
    save();
    render();
    showToast(`«${favName}» anclado a favoritos`);
  }

  function unpin(path) {
    if (!path) return;
    const pNorm = path.replace(/\\/g, '/').toLowerCase();
    const prevLen = favorites.length;
    const removed = favorites.find(f => f.path.replace(/\\/g, '/').toLowerCase() === pNorm);
    favorites = favorites.filter(f => f.path.replace(/\\/g, '/').toLowerCase() !== pNorm);
    if (favorites.length < prevLen) {
      save();
      render();
      const tipo = (removed && !removed.is_dir) ? 'Archivo' : 'Carpeta';
      showToast(`${tipo} desanclado de favoritos`);
    }
  }

  function toggle(path, name, isDir = false) {
    if (isPinned(path)) {
      unpin(path);
    } else {
      pin(path, name, isDir);
    }
  }

  function render() {
    const listEl = document.getElementById('favorites-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!favorites.length) {
      listEl.innerHTML = '<div class="fav-empty-msg">Sin elementos anclados</div>';
      return;
    }

    const curPath = (typeof FolderView !== 'undefined' && FolderView.getCurrentPath()) || '';
    const curNorm = curPath.replace(/\\/g, '/').toLowerCase();
    const curFile = (typeof currentNode !== 'undefined' && currentNode && currentNode.path)
      ? currentNode.path.replace(/\\/g, '/').toLowerCase()
      : '';

    favorites.forEach(fav => {
      // Deducir is_dir para elementos guardados antes de esta actualización
      const isDir = (typeof fav.is_dir === 'boolean') ? fav.is_dir : !fav.name.includes('.');
      const favNorm = fav.path.replace(/\\/g, '/').toLowerCase();
      const isAct = isDir ? (favNorm === curNorm) : (favNorm === curFile);

      const itemEl = document.createElement('div');
      itemEl.className = 'fav-item' + (isAct ? ' active' : '');

      // Icono: carpeta o icono especializado por tipo de archivo
      const fileExt = fav.ext || (fav.name.includes('.') ? fav.name.split('.').pop().toLowerCase() : '');
      const icon = isDir ? '📁' : (typeof getIcon === 'function' ? getIcon(fileExt) : '📄');

      itemEl.innerHTML = `
        <span class="fav-icon">${icon}</span>
        <span class="fav-name" title="${fav.path}">${fav.name}</span>
        <button class="fav-unpin" title="Desanclar de favoritos">✕</button>
      `;

      itemEl.onclick = async (e) => {
        if (e.target.closest('.fav-unpin')) return;
        if (isDir) {
          if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
            await FolderView.navigateTo(fav.path);
          }
        } else {
          if (typeof Viewer !== 'undefined' && Viewer.load) {
            await Viewer.load({
              name: fav.name,
              path: fav.path,
              is_dir: false
            });
            render();
          }
        }
      };

      const unpinBtn = itemEl.querySelector('.fav-unpin');
      if (unpinBtn) {
        unpinBtn.onclick = (e) => {
          e.stopPropagation();
          unpin(fav.path);
        };
      }

      listEl.appendChild(itemEl);
    });
  }

  function setup() {
    load();
    const header = document.getElementById('fav-header');
    const section = document.getElementById('sidebar-favorites');

    const isCollapsed = localStorage.getItem('explorer_fav_collapsed') === 'true';
    if (section && isCollapsed) {
      section.classList.add('collapsed');
    }

    if (header && section) {
      header.onclick = () => {
        section.classList.toggle('collapsed');
        localStorage.setItem('explorer_fav_collapsed', section.classList.contains('collapsed'));
      };
    }

    render();
  }

  return {
    setup,
    isPinned,
    pin,
    unpin,
    toggle,
    render
  };
})();
