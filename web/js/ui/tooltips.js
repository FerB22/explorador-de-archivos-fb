// ════════════════════════════════════════════════════════════════════════════
// SISTEMA DE TOOLTIPS MODERNOS PERSONALIZADOS
// ════════════════════════════════════════════════════════════════════════════

const ModernTooltips = (() => {
  let tooltipEl = null;
  let showTimer = null;
  let currentTarget = null;

  function init() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'app-custom-tooltip';
    tooltipEl.id = 'app-custom-tooltip';
    document.body.appendChild(tooltipEl);

    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    document.addEventListener('mousedown', hideTooltip, { passive: true });
    window.addEventListener('scroll', hideTooltip, { passive: true });
  }

  function handleMouseOver(e) {
    const target = e.target.closest('[title], [data-tooltip]');
    if (!target) return;

    // Si tiene atributo title nativo, lo convertimos a data-tooltip para suprimir el cuadro blanco/amarillo de Windows
    if (target.hasAttribute('title')) {
      const text = target.getAttribute('title');
      if (text && text.trim()) {
        target.setAttribute('data-tooltip', text.trim());
      }
      target.removeAttribute('title');
    }

    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    currentTarget = target;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      if (currentTarget === target) {
        show(target, text);
      }
    }, 280);
  }

  function handleMouseOut(e) {
    if (currentTarget && !currentTarget.contains(e.relatedTarget)) {
      hideTooltip();
    }
  }

  function show(target, text) {
    if (!tooltipEl) return;
    tooltipEl.textContent = text;
    tooltipEl.classList.remove('visible');

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    let top = rect.bottom + 6;
    // Si queda muy abajo cerca del borde inferior, posicionar arriba del elemento
    if (top + 32 > window.innerHeight) {
      top = Math.max(6, rect.top - 28);
    }

    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    // Controlar que no se desborde por los lados de la ventana
    left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, left));

    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.classList.add('visible');
  }

  function hideTooltip() {
    clearTimeout(showTimer);
    currentTarget = null;
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  }

  return { init, hide: hideTooltip };
})();

// ════════════════════════════════════════════════════════════════════════════
// ANULACIÓN DE COMPORTAMIENTOS Y MENÚS NATIVOS DE CHROMIUM
// ════════════════════════════════════════════════════════════════════════════
const NativeOverrides = (() => {
  function init() {
    // 1. Suprimir el menú contextual genérico de navegador en áreas neutras
    window.addEventListener('contextmenu', (e) => {
      // Permitir menú contextual nativo en campos de texto editables (copiar/pegar)
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Si el elemento pertenece al árbol de archivos, tarjetas o componentes con menú propio, se gestiona internamente
      if (e.target.closest('.tree-row') || e.target.closest('.fc-card') || e.target.closest('.fc-row') || e.target.closest('.tab-item') || e.target.closest('.trash-row')) {
        return;
      }

      // En el resto de la interfaz (botones, cabeceras, barras de estado), suprimir el menú de Chromium
      e.preventDefault();
    });

    // 2. Prevenir el arrastre nativo no intencional de imágenes y texto no draggable
    window.addEventListener('dragstart', (e) => {
      if (!e.target.closest('[draggable="true"]') && e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    });
  }

  return { init };
})();

// Auto-inicialización
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ModernTooltips.init();
    NativeOverrides.init();
  });
} else {
  ModernTooltips.init();
  NativeOverrides.init();
}
