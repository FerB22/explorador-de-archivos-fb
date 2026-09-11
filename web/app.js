// ════════════════════════════════════════════════════════════════════════════
// ORQUESTADOR PRINCIPAL Y ARRANQUE DE LA APLICACIÓN
// ════════════════════════════════════════════════════════════════════════════

// ── Arranque pywebview ────────────────────────────────────────────────────────
window.addEventListener('pywebviewready', () => { pyApi = window.pywebview.api; boot(); });
if (window.pywebview && window.pywebview.api) { pyApi = window.pywebview.api; boot(); }

async function boot() {
  const cfg = await pyApi.get_config();
  currentTheme = cfg.theme || 'auto';
  currentRootPath = cfg.root_path || '';
  applyTheme(currentTheme);
  const parts = currentRootPath.split(/[\\/]/);
  document.getElementById('root-label').textContent = parts[parts.length - 1] || 'Archivos';
  setupSidebarResize(cfg.sidebar_width);
  SidebarManager.init();
  setupControls();
  NavigationHistory.setup();
  FolderView.setup();
  FavoritesManager.setup();
  SearchModal.init();
  PropertiesModal.init();
  SettingsModal.init();
  TabManager.setupInitialTab(currentRootPath);
  TwoFingerNavigation.init();
  Viewer.setupAnchorNavigation();
  Viewer.setupTaskCheckboxes();
  await FileTree.loadRoot();
  await FolderView.navigateTo(currentRootPath);
  await TrashManager.init();
}