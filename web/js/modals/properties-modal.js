// ════════════════════════════════════════════════════════════════════════════
// MODAL DE PROPIEDADES E INSPECCIÓN DETALLADA
// ════════════════════════════════════════════════════════════════════════════

const PropertiesModal = (() => {
  let modalEl = null;

  function init() {
    modalEl = document.getElementById('modal-properties');
    const btnClose = document.getElementById('prop-btn-close');
    const btnAccept = document.getElementById('prop-btn-accept');

    if (btnClose) btnClose.onclick = () => close();
    if (btnAccept) btnAccept.onclick = () => close();

    if (modalEl) {
      modalEl.onclick = (e) => {
        if (e.target === modalEl) close();
      };
    }
  }

  async function open(node) {
    if (!modalEl) init();
    if (!node || !node.path || !pyApi || !pyApi.get_item_properties) return;

    if (modalEl) modalEl.style.display = 'flex';

    document.getElementById('prop-icon').textContent = node.is_dir ? '📁' : getIcon(node.extension);
    document.getElementById('prop-name-heading').textContent = node.name;
    document.getElementById('prop-type-sub').textContent = node.is_dir ? 'Carpeta de archivos' : (node.extension ? `Archivo ${node.extension.toUpperCase()}` : 'Archivo');
    document.getElementById('prop-val-name').textContent = node.name;
    document.getElementById('prop-val-type').textContent = node.is_dir ? 'Carpeta de archivos' : (node.extension ? `Archivo ${node.extension.toUpperCase()}` : 'Archivo');
    document.getElementById('prop-val-location').textContent = getParentPath(node.path);
    document.getElementById('prop-val-path').textContent = node.path;
    document.getElementById('prop-val-size').textContent = 'Calculando…';

    const rowContains = document.getElementById('prop-row-contains');
    if (rowContains) rowContains.style.display = node.is_dir ? 'flex' : 'none';
    if (node.is_dir) document.getElementById('prop-val-contains').textContent = 'Calculando…';

    document.getElementById('prop-btn-copy-path').onclick = () => {
      navigator.clipboard.writeText(node.path)
        .then(() => showToast('Ruta copiada al portapapeles'))
        .catch(() => showToast('No se pudo copiar'));
    };

    document.getElementById('prop-btn-reveal').onclick = () => {
      if (pyApi && pyApi.reveal_file) pyApi.reveal_file(node.path);
    };

    try {
      const res = await pyApi.get_item_properties(node.path);
      if (res && res.success) {
        const sz = res.size || 0;
        document.getElementById('prop-val-size').textContent = `${formatSize(sz)} (${sz.toLocaleString('es-ES')} bytes)`;
        if (res.is_dir && rowContains) {
          rowContains.style.display = 'flex';
          document.getElementById('prop-val-contains').textContent = `${res.file_count} archivos, ${res.dir_count} subcarpetas`;
        }
        document.getElementById('prop-val-created').textContent = formatDate(res.created);
        document.getElementById('prop-val-modified').textContent = formatDate(res.modified);
        document.getElementById('prop-val-accessed').textContent = formatDate(res.accessed);
      }
    } catch (err) {
      console.error('Error al obtener propiedades:', err);
    }
  }

  function close() {
    if (modalEl) modalEl.style.display = 'none';
  }

  return {
    init,
    open,
    close,
    isOpen: () => modalEl && modalEl.style.display !== 'none'
  };
})();
