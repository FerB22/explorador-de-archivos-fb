// ════════════════════════════════════════════════════════════════════════════
// ÁRBOL DE ARCHIVOS
// ════════════════════════════════════════════════════════════════════════════
const FileTree = (() => {
  let cache        = {};
  let selectedPath = null;
  let selectedNode = null;

  function build(node, level) {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node';
    wrap.dataset.path  = node.path;
    wrap.dataset.isDir = node.is_dir;

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = (8 + level * 16) + 'px';

    for (let i = 0; i < level; i++) {
      const g = document.createElement('span'); g.className = 'tree-guide'; row.appendChild(g);
    }

    if (node.is_dir) {
      const cv = document.createElement('span');
      cv.className = 'tree-chevron';
      cv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
      row.appendChild(cv);
    } else {
      const ph = document.createElement('span'); ph.className = 'tree-chevron-ph'; row.appendChild(ph);
    }

    const ic = document.createElement('span');
    ic.className  = 'tree-icon';
    ic.textContent = node.is_dir ? '📁' : getIcon(node.extension);
    row.appendChild(ic);

    const lb = document.createElement('span');
    lb.className  = 'tree-label';
    lb.textContent = node.name;
    row.appendChild(lb);

    wrap.appendChild(row);
    if (node.is_dir) { const ch = document.createElement('div'); ch.className = 'tree-children'; wrap.appendChild(ch); }

    // Eventos
    row.addEventListener('click', async e => {
      e.stopPropagation();
      select(row, node.path, node);
      if (node.is_dir) {
        if (e.target.closest('.tree-chevron')) {
          await toggle(wrap, node.path, level);
          return;
        }
        if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
          await FolderView.navigateTo(node.path);
        } else {
          await toggle(wrap, node.path, level);
        }
      } else {
        await Viewer.load(node);
      }
    });

    row.addEventListener('contextmenu', async e => {
      e.preventDefault(); e.stopPropagation();
      select(row, node.path, node);
      if (node.is_dir) {
        if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
          await FolderView.navigateTo(node.path);
        }
      } else {
        await Viewer.load(node);
      }
      ctxNode = node;
      showCtx(e.clientX, e.clientY);
    });

    DragDropManager.makeDraggable(row, node);
    if (node.is_dir) {
      DragDropManager.makeDropZone(row, node.path);
    }

    return wrap;
  }

  function select(rowEl, path, node) {
    if (selectedPath) {
      const prev = document.querySelector('.tree-node[data-path="' + CSS.escape(selectedPath) + '"] > .tree-row');
      if (prev) prev.classList.remove('selected');
    }
    selectedPath = path;
    selectedNode = node || null;
    rowEl.classList.add('selected');
  }

  function normalizePath(p) {
    if (!p) return '';
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  function findNodeByNormPath(normPath) {
    const all = document.querySelectorAll('#file-tree .tree-node');
    for (const el of all) {
      if (normalizePath(el.dataset.path) === normPath) return el;
    }
    return null;
  }

  async function expandNode(wrap, path, level) {
    const cv = wrap.querySelector(':scope > .tree-row .tree-chevron');
    const ch = wrap.querySelector(':scope > .tree-children');
    const ic = wrap.querySelector(':scope > .tree-row .tree-icon');
    if (!ch) return;

    if (!cache[path]) {
      ch.innerHTML = '<div class="tree-msg" style="padding-left:' + (8 + (level + 1) * 16) + 'px">⏳ Cargando…</div>';
      ch.classList.add('open');
      const res = await pyApi.get_files(path);
      cache[path] = res.nodes;
      ch.innerHTML = '';
      if (!res.nodes || !res.nodes.length) {
        ch.innerHTML = '<div class="tree-msg" style="padding-left:' + (8 + (level + 1) * 16) + 'px">Sin contenido</div>';
      } else {
        const frag = document.createDocumentFragment();
        res.nodes.forEach(n => frag.appendChild(build(n, level + 1)));
        ch.appendChild(frag);
      }
    }
    ch.classList.add('open');
    if (cv) cv.classList.add('open');
    if (ic) ic.textContent = '📂';
  }

  async function revealAndExpand(targetPath, expandTarget = true) {
    if (!targetPath) return;

    const normTarget = normalizePath(targetPath);
    const normRoot   = normalizePath(currentRootPath);

    // Si la ruta no pertenece a la raíz del árbol actual, salir
    if (normRoot && !normTarget.startsWith(normRoot)) return;

    // Obtener los segmentos relativos a la raíz
    const rel = normTarget.slice(normRoot.length).replace(/^\/+/, '');
    const parts = rel ? rel.split('/').filter(Boolean) : [];

    // Reconstruir la ruta acumulada nivel por nivel
    // Obtenemos el prefijo de la raíz preservando el formato original
    const sep = targetPath.includes('\\') ? '\\' : '/';
    let currentAccum = currentRootPath.replace(/[\\/]+$/, '');

    for (let i = 0; i < parts.length; i++) {
      const isTarget = (i === parts.length - 1);
      
      // Buscar el nodo en el árbol lateral
      currentAccum += sep + parts[i];
      const normAccum = normalizePath(currentAccum);
      let nodeEl = findNodeByNormPath(normAccum);

      if (!nodeEl) break;

      // Si es un directorio, expandirlo
      if (nodeEl.dataset.isDir === 'true') {
        if (!isTarget || expandTarget) {
          const rowEl = nodeEl.querySelector(':scope > .tree-row');
          const level = rowEl ? Math.max(0, Math.round((parseInt(rowEl.style.paddingLeft || '8', 10) - 8) / 16)) : 0;
          await expandNode(nodeEl, nodeEl.dataset.path, level);
        }
      }
    }

    // Seleccionar y enfocar visualmente la fila de destino
    const targetEl = findNodeByNormPath(normTarget);
    if (targetEl) {
      const row = targetEl.querySelector(':scope > .tree-row');
      if (row) {
        select(row, targetEl.dataset.path, null);
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  async function toggle(wrap, path, level) {
    const cv = wrap.querySelector(':scope > .tree-row .tree-chevron');
    const ch = wrap.querySelector(':scope > .tree-children');
    const ic = wrap.querySelector(':scope > .tree-row .tree-icon');
    const isOpen = ch.classList.contains('open');

    if (isOpen) {
      ch.classList.remove('open');
      if (cv) cv.classList.remove('open');
      if (ic) ic.textContent = '📁';
    } else {
      await expandNode(wrap, path, level);
    }
  }

  function collapseAll() {
    document.querySelectorAll('.tree-children').forEach(c => c.classList.remove('open'));
    document.querySelectorAll('.tree-chevron').forEach(c => c.classList.remove('open'));
    document.querySelectorAll('.tree-node[data-is-dir="true"] .tree-icon').forEach(i => { i.textContent = '📁'; });
    Viewer.clear();
    selectedPath = null;
    selectedNode = null;
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    const tree = document.getElementById('file-tree');
    if (!q) {
      tree.querySelectorAll('.tree-node').forEach(node => {
        node.classList.remove('hidden');
        const lb = node.querySelector(':scope > .tree-row .tree-label');
        if (lb) lb.innerHTML = lb.textContent;
      });
      return;
    }
    tree.querySelectorAll('.tree-node').forEach(node => {
      const lb = node.querySelector(':scope > .tree-row .tree-label');
      if (!lb) return;
      const name = lb.textContent.toLowerCase();
      if (name.includes(q)) {
        const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        lb.innerHTML = lb.textContent.replace(new RegExp('(' + esc + ')', 'gi'), '<mark>$1</mark>');
        node.classList.remove('hidden');
        let p = node.parentElement && node.parentElement.closest('.tree-node');
        while (p) {
          p.classList.remove('hidden');
          const pch = p.querySelector(':scope > .tree-children'); if (pch) pch.classList.add('open');
          const pcv = p.querySelector(':scope > .tree-row .tree-chevron'); if (pcv) pcv.classList.add('open');
          const pic = p.querySelector(':scope > .tree-row .tree-icon'); if (pic) pic.textContent = '📂';
          p = p.parentElement && p.parentElement.closest('.tree-node');
        }
      } else {
        lb.innerHTML = lb.textContent;
        node.classList.add('hidden');
      }
    });
  }

  async function loadRoot() {
    const tree = document.getElementById('file-tree');
    tree.innerHTML = '<div class="tree-msg" style="padding:12px 14px">⏳ Cargando…</div>';
    cache = {};
    Viewer.clear();
    const res = await pyApi.get_files('');
    if (res.root) currentRootPath = res.root;
    const parts = (currentRootPath || '').split(/[\\/]/);
    document.getElementById('root-label').textContent = parts[parts.length - 1] || 'Archivos';
    tree.innerHTML = '';
    if (!res.nodes || !res.nodes.length) {
      tree.innerHTML = '<div class="tree-msg" style="padding:16px 14px;color:var(--text-3)">Carpeta vacía</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    res.nodes.forEach(n => frag.appendChild(build(n, 0)));
    tree.appendChild(frag);
  }

  return { loadRoot, collapseAll, filter, revealAndExpand, getSelectedNode: () => selectedNode };
})();
