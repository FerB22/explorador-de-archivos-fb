// ════════════════════════════════════════════════════════════════════════════
// TEMA Y NOTIFICACIONES (TOAST)
// ════════════════════════════════════════════════════════════════════════════

let toastTimer = null;

function resolveToastIcon(msg) {
  const lower = (msg || '').toLowerCase();
  if (lower.includes('tema:')) return '🌓';
  if (lower.includes('guardado') || lower.includes('completado') || lower.includes('éxito')) return '✓';
  if (lower.includes('desmarcado')) return '◻️';
  if (lower.includes('copiad')) return '📋';
  if (lower.includes('movido') || lower.includes('moviendo')) return '📦';
  if (lower.includes('papelera') || lower.includes('eliminado')) return '🗑️';
  if (lower.includes('restaurado')) return '♻️';
  if (lower.includes('cread')) return '📁';
  if (lower.includes('renombrado')) return '✏️';
  if (lower.includes('duplicado')) return '📄';
  if (lower.includes('favoritos') || lower.includes('anclada')) return '⭐';
  if (lower.includes('error') || lower.includes('no se pudo')) return '⚠️';
  if (lower.includes('recargad')) return '🔄';
  if (lower.includes('zoom')) return '🔍';
  if (lower.includes('vista')) return '👁️';
  if (lower.includes('orden')) return '↕️';
  if (lower.includes('pestaña')) return '📑';
  return 'ℹ️';
}

function showToast(msg, ms = 2200, customIcon = null) {
  const t = document.getElementById('toast');
  if (!t) return;

  clearTimeout(toastTimer);

  const icon = customIcon || resolveToastIcon(msg);
  t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${msg}</span>`;

  // Forzar reinicio de animación si ya estaba mostrándose
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');

  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, ms);
}

function applyTheme(mode) {
  currentTheme = mode;
  try { localStorage.setItem('app_theme', mode); } catch (e) {}
  const html = document.documentElement;
  let effective = mode;
  if (mode === 'auto') effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  html.setAttribute('data-theme', effective);
  // Cambiar hoja de estilos de highlight.js
  const hlThemeEl = document.getElementById('hljs-theme');
  if (hlThemeEl) {
    hlThemeEl.href = effective === 'light'
      ? 'lib/hljs-light.min.css'
      : 'lib/hljs-dark.min.css';
  }
}

function cycleTheme() {
  const order = ['auto', 'dark', 'light'];
  const next = order[(order.indexOf(currentTheme) + 1) % order.length];
  applyTheme(next);
  if (pyApi && pyApi.save_theme) pyApi.save_theme(next);
  showToast('Tema: ' + next);
}
