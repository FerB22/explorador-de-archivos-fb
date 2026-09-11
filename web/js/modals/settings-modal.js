// ════════════════════════════════════════════════════════════════════════════
// MODAL DE AJUSTES Y PREFERENCIAS DEL EXPLORADOR
// ════════════════════════════════════════════════════════════════════════════

const SettingsModal = (() => {
  let modalEl = null;
  let isOpenState = false;
  let currentSettings = {
    root_path: '',
    default_system_path: '',
    theme: 'auto',
    sound_fx_enabled: true,
    sidebar_width: 290,
    version: '4.0.0'
  };

  function init() {
    modalEl = document.getElementById('modal-settings');
    if (!modalEl) return;

    // Cerrar con botón de cabecera
    const btnClose = document.getElementById('settings-btn-close');
    if (btnClose) btnClose.addEventListener('click', close);

    // Cerrar con botón Cancelar
    const btnCancel = document.getElementById('settings-btn-cancel');
    if (btnCancel) btnCancel.addEventListener('click', close);

    // Botón Guardar
    const btnSave = document.getElementById('settings-btn-save');
    if (btnSave) btnSave.addEventListener('click', save);

    // Botón Examinar carpeta
    const btnBrowse = document.getElementById('settings-btn-browse');
    if (btnBrowse) btnBrowse.addEventListener('click', handleBrowse);

    // Botón Restablecer a ruta de Documentos
    const btnResetRoot = document.getElementById('settings-btn-reset-root');
    if (btnResetRoot) btnResetRoot.addEventListener('click', handleResetRoot);

    // Cerrar al hacer clic en el backdrop
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) close();
    });

    // Pestañas de ajustes
    const tabBtns = modalEl.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.dataset.tab;
        modalEl.querySelectorAll('.settings-tab-pane').forEach(pane => {
          pane.style.display = (pane.id === 'settings-tab-' + targetTab) ? 'block' : 'none';
        });
      });
    });
  }

  async function open() {
    if (!modalEl) init();
    if (!modalEl) return;

    isOpenState = true;
    modalEl.style.display = 'flex';

    if (pyApi && pyApi.get_app_settings) {
      try {
        currentSettings = await pyApi.get_app_settings();
      } catch (_) {}
    }

    // Poblar campos
    const inputRoot = document.getElementById('settings-input-root');
    if (inputRoot) {
      inputRoot.value = currentSettings.root_path || currentRootPath || '';
    }

    const sysPathLabel = document.getElementById('settings-system-path-hint');
    if (sysPathLabel) {
      sysPathLabel.textContent = currentSettings.default_system_path || 'Carpeta Documentos del usuario';
    }

    // Tema
    const themeSelect = document.getElementById('settings-select-theme');
    if (themeSelect) {
      themeSelect.value = currentSettings.theme || currentTheme || 'auto';
    }

    // Sonido
    const soundToggle = document.getElementById('settings-toggle-sound');
    if (soundToggle) {
      soundToggle.checked = currentSettings.sound_fx_enabled !== false;
    }

    // Versión
    const versionLabel = document.getElementById('settings-app-version');
    if (versionLabel) {
      versionLabel.textContent = 'v' + (currentSettings.version || '4.0.0');
    }
  }

  function close() {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    isOpenState = false;
  }

  async function handleBrowse() {
    if (!pyApi || !pyApi.select_root_folder) return;
    try {
      const res = await pyApi.select_root_folder(false);
      if (res.success && res.path) {
        const inputRoot = document.getElementById('settings-input-root');
        if (inputRoot) inputRoot.value = res.path;
      }
    } catch (err) {
      showToast('Error al seleccionar carpeta: ' + err.message);
    }
  }

  function handleResetRoot() {
    const inputRoot = document.getElementById('settings-input-root');
    if (inputRoot && currentSettings.default_system_path) {
      inputRoot.value = currentSettings.default_system_path;
    }
  }

  async function save() {
    const inputRoot = document.getElementById('settings-input-root');
    const newRoot = inputRoot ? inputRoot.value.trim() : '';

    const themeSelect = document.getElementById('settings-select-theme');
    const newTheme = themeSelect ? themeSelect.value : 'auto';

    const soundToggle = document.getElementById('settings-toggle-sound');
    const newSound = soundToggle ? soundToggle.checked : true;

    if (!newRoot) {
      showToast('Por favor, selecciona una ruta válida');
      return;
    }

    let rootChanged = (newRoot.toLowerCase() !== (currentRootPath || '').toLowerCase());

    if (pyApi) {
      try {
        if (pyApi.save_root_folder_persistent) {
          const res = await pyApi.save_root_folder_persistent(newRoot);
          if (!res.success) {
            showToast(res.message || 'Error guardando carpeta raíz');
            return;
          }
        }

        if (pyApi.save_sound_setting) {
          await pyApi.save_sound_setting(newSound);
          if (typeof SoundFX !== 'undefined' && SoundFX.setEnabled) {
            SoundFX.setEnabled(newSound);
          }
        }

        if (pyApi.save_theme) {
          await pyApi.save_theme(newTheme);
        }
      } catch (err) {
        showToast('Error al guardar ajustes: ' + err.message);
        return;
      }
    }

    // Aplicar tema en cliente
    applyTheme(newTheme);

    // Si cambió la ruta raíz, actualizar el explorador
    if (rootChanged) {
      currentRootPath = newRoot;
      const parts = currentRootPath.split(/[\\/]/);
      const rootLabel = document.getElementById('root-label');
      if (rootLabel) rootLabel.textContent = parts[parts.length - 1] || 'Archivos';

      if (typeof refreshExplorer === 'function') {
        await refreshExplorer();
      }
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        await FolderView.navigateTo(currentRootPath);
      }
    }

    close();
    showToast('Ajustes guardados correctamente');
  }

  return {
    init,
    open,
    close,
    isOpen: () => isOpenState
  };
})();