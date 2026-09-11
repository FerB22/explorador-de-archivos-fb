// ════════════════════════════════════════════════════════════════════════════
// GESTOR DE ARRASTRAR Y SOLTAR (DRAG AND DROP PARA MOVER ELEMENTOS)
// ════════════════════════════════════════════════════════════════════════════
const DragDropManager = (() => {
  let draggedNode = null;

  function cleanPath(p) {
    if (!p) return '';
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  function isValidMove(sourcePath, targetDirPath, sourceIsDir) {
    if (!sourcePath || !targetDirPath) return false;
    const normSrc = cleanPath(sourcePath);
    const normTgt = cleanPath(targetDirPath);

    // 1. No mover hacia sí mismo
    if (normSrc === normTgt) return false;

    // 2. No mover a la carpeta donde ya reside
    const srcParts = normSrc.split('/');
    srcParts.pop();
    const parentOfSrc = srcParts.join('/');
    if (parentOfSrc === normTgt) return false;

    // 3. Si es carpeta, no mover dentro de sí misma o subcarpetas
    if (sourceIsDir) {
      if (normTgt.startsWith(normSrc + '/')) return false;
    }

    return true;
  }

  async function executeMove(sourcePath, targetDirPath) {
    if (!pyApi || !pyApi.move_item) return;

    const sourceName = sourcePath.split(/[\\/]/).pop() || 'Elemento';
    const targetName = targetDirPath.split(/[\\/]/).pop() || 'Carpeta destino';

    try {
      showToast(`Moviendo «${sourceName}»…`);
      const res = await pyApi.move_item(sourcePath, targetDirPath);
      if (res && res.success) {
        showToast(`Movido: «${sourceName}» → «${targetName}»`);
        if (typeof SoundFX !== 'undefined' && SoundFX.play) {
          SoundFX.play('move');
        }
        await refreshExplorer();
      } else {
        const msg = (res && res.message) ? res.message : 'No se pudo mover el elemento.';
        showToast(msg);
      }
    } catch (err) {
      console.error('Error al mover elemento vía drag & drop:', err);
      showToast('Error inesperado al mover el elemento.');
    }
  }

  function makeDraggable(el, node) {
    if (!el || !node) return;
    el.setAttribute('draggable', 'true');

    el.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      draggedNode = node;
      el.classList.add('is-dragging');

      try {
        e.dataTransfer.setData('text/plain', node.path);
        e.dataTransfer.setData('application/json', JSON.stringify(node));
        e.dataTransfer.effectAllowed = 'move';
      } catch (err) {}
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      draggedNode = null;
      document.querySelectorAll('.drag-over').forEach(d => d.classList.remove('drag-over'));
    });
  }

  function makeDropZone(el, getTargetFolderPath) {
    if (!el) return;

    function getTarget() {
      return typeof getTargetFolderPath === 'function' ? getTargetFolderPath() : getTargetFolderPath;
    }

    el.addEventListener('dragenter', (e) => {
      const targetPath = getTarget();
      if (!draggedNode || !targetPath) return;
      if (isValidMove(draggedNode.path, targetPath, draggedNode.is_dir)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
      }
    });

    el.addEventListener('dragover', (e) => {
      const targetPath = getTarget();
      if (!draggedNode || !targetPath) return;
      if (isValidMove(draggedNode.path, targetPath, draggedNode.is_dir)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!el.classList.contains('drag-over')) {
          el.classList.add('drag-over');
        }
      }
    });

    el.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', async (e) => {
      el.classList.remove('drag-over');
      const targetPath = getTarget();
      if (!draggedNode || !targetPath) return;

      if (isValidMove(draggedNode.path, targetPath, draggedNode.is_dir)) {
        e.preventDefault();
        e.stopPropagation();
        const src = draggedNode.path;
        draggedNode = null;
        await executeMove(src, targetPath);
      }
    });
  }

  return {
    makeDraggable,
    makeDropZone,
    executeMove,
    getDraggedNode: () => draggedNode
  };
})();
