// ════════════════════════════════════════════════════════════════════════════
// NAVEGACIÓN HISTÓRICA POR GESTOS DE DOS DEDOS (TOUCH Y TRACKPAD)
// ════════════════════════════════════════════════════════════════════════════

const TwoFingerNavigation = (() => {
  // Umbrales para gestos de navegación horizontal (pantalla táctil y rueda/trackpad)
  const TOUCH_THRESHOLD = 230; // Píxeles de desplazamiento medio en pantalla táctil
  const WHEEL_THRESHOLD = 90;  // Umbral accesible para giros de rueda horizontal (MX Master 3S)
  const WHEEL_TIMEOUT_MS = 140; // Ventana ágil para confirmar navegación al soltar trackpad

  let activePointers = new Map();
  let pendingTouchAction = null;
  let isTrackingTouch = false;
  let touchCooldownUntil = 0;

  let wheelAccumulatedX = 0;
  let wheelTimeout = null;
  let pendingWheelAction = null;
  let wheelCooldownUntil = 0;
  let lastWheelStep = 0;
  let isDeceleratingCount = 0;

  let elBack = null;
  let elFwd = null;

  function init() {
    elBack = document.getElementById('gesture-indicator-back');
    elFwd = document.getElementById('gesture-indicator-forward');

    const appContainer = document.getElementById('explorer-app') || document.body;

    // 1. Detección táctil (Touchscreen con PointerEvents)
    appContainer.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    // 2. Detección de rueda horizontal y panel táctil
    window.addEventListener('wheel', handleWheel, { passive: false });
  }

  function isInputFocused() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
  }

  function isModalOpen() {
    return (typeof FolderPickerModal !== 'undefined' && FolderPickerModal.isOpen && FolderPickerModal.isOpen()) ||
           (typeof SearchModal !== 'undefined' && SearchModal.isOpen && SearchModal.isOpen()) ||
           (typeof PropertiesModal !== 'undefined' && PropertiesModal.isOpen && PropertiesModal.isOpen()) ||
           (typeof CustomDialog !== 'undefined' && CustomDialog.isOpen && CustomDialog.isOpen());
  }

  function isHorizontallyScrollable(el, deltaX) {
    if (!el) return false;

    // La barra lateral, el árbol de archivos, las pestañas y las rutas nunca deben disparar navegación histórica
    if (el.closest('.sidebar, #file-tree, .file-tree, #tab-bar, .tab-bar, #breadcrumbs-bar')) {
      return true;
    }

    // Si el visor de archivo está abierto y el puntero se encuentra dentro de su área o barra de herramientas
    const pvBody = document.getElementById('preview-body');
    const pvToolbar = document.getElementById('preview-toolbar');
    const isInPreview = (pvBody && pvBody.style.display !== 'none' && (pvBody.contains(el) || el === pvBody)) ||
                        (pvToolbar && pvToolbar.style.display !== 'none' && (pvToolbar.contains(el) || el === pvToolbar));

    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      // Clases o IDs de contenedores de contenido extenso que requieren desplazamiento horizontal
      const isContentBlock = cur.id === 'preview-body' ||
                             cur.id === 'folder-content-container' ||
                             cur.id === 'breadcrumbs-bar' ||
                             cur.id === 'file-tree' ||
                             cur.classList.contains('file-tree') ||
                             cur.classList.contains('markdown-body') ||
                             cur.classList.contains('pv-pre') ||
                             cur.classList.contains('pv-code-wrap') ||
                             cur.classList.contains('pv-excel-grid') ||
                             cur.classList.contains('pv-editor-textarea') ||
                             cur.classList.contains('pv-editor-preview-pane') ||
                             cur.classList.contains('nb-cell') ||
                             cur.classList.contains('nb-output') ||
                             cur.tagName === 'PRE' ||
                             cur.tagName === 'CODE' ||
                             cur.tagName === 'TABLE';

      const style = window.getComputedStyle(cur);
      const ox = style.overflowX;
      const isScrollStyle = (ox === 'auto' || ox === 'scroll');

      // Si el elemento tiene desbordamiento horizontal efectivo
      if ((isScrollStyle || isContentBlock) && cur.scrollWidth > cur.clientWidth + 1) {
        // En cualquier contenedor que tenga scroll horizontal (como el árbol o visores de código),
        // damos prioridad absoluta al desplazamiento del contenido para que la rueda secundaria no se atasque
        return true;
      }

      cur = cur.parentElement;
    }

    // Si el puntero está dentro del visor y el cuerpo del visor o su hijo activo tiene scroll horizontal
    if (isInPreview && pvBody) {
      if (pvBody.scrollWidth > pvBody.clientWidth + 4) {
        return true;
      }
      const preEl = pvBody.querySelector('.pv-pre, pre, .markdown-body, .pv-excel-grid, .pv-editor-textarea');
      if (preEl && preEl.scrollWidth > preEl.clientWidth + 4) {
        return true;
      }
    }

    return false;
  }

  // ── Pantalla táctil física (Touchscreen) ──────────────────────────────────
  function handlePointerDown(e) {
    if (e.pointerType !== 'touch') return;
    if (isInputFocused() || isModalOpen()) return;
    if (Date.now() < touchCooldownUntil) return;

    activePointers.set(e.pointerId, {
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      target: e.target
    });

    if (activePointers.size === 2) {
      touchTriggered = false;
      isTrackingTouch = true;
    }
  }

  function handlePointerMove(e) {
    if (e.pointerType !== 'touch') return;
    if (Date.now() < touchCooldownUntil) {
      hideIndicatorsImmediate();
      return;
    }
    if (!activePointers.has(e.pointerId)) return;

    const p = activePointers.get(e.pointerId);
    p.currentX = e.clientX;
    p.currentY = e.clientY;

    if (activePointers.size === 2 && isTrackingTouch) {
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];

      const dx1 = p1.currentX - p1.startX;
      const dx2 = p2.currentX - p2.startX;
      const dy1 = p1.currentY - p1.startY;
      const dy2 = p2.currentY - p2.startY;

      const midDx = (dx1 + dx2) / 2;
      const midDy = (dy1 + dy2) / 2;

      // Descartar si los dedos van en sentidos opuestos (pinch to zoom)
      if (Math.sign(dx1) !== Math.sign(dx2)) {
        hideIndicators();
        return;
      }

      // Exigir dominancia horizontal frente a la vertical
      if (Math.abs(midDx) < Math.abs(midDy) * 1.25) {
        hideIndicators();
        return;
      }

      // Evitar interceptar si el gesto ocurre sobre un elemento con desplazamiento horizontal interno
      if (isHorizontallyScrollable(p1.target || e.target, -midDx) || isHorizontallyScrollable(e.target, -midDx)) {
        hideIndicatorsImmediate();
        return;
      }

      const canGoBack = NavigationHistory.canBack();
      const canGoFwd = NavigationHistory.canForward();

      if (midDx > 30) {
        // Deslizar a la derecha -> Atrás
        if (canGoBack) {
          showIndicator('back', midDx, TOUCH_THRESHOLD);
          if (midDx >= TOUCH_THRESHOLD) {
            pendingTouchAction = 'back';
          } else {
            pendingTouchAction = null;
          }
        }
      } else if (midDx < -30) {
        // Deslizar a la izquierda -> Adelante
        if (canGoFwd) {
          showIndicator('forward', Math.abs(midDx), TOUCH_THRESHOLD);
          if (Math.abs(midDx) >= TOUCH_THRESHOLD) {
            pendingTouchAction = 'forward';
          } else {
            pendingTouchAction = null;
          }
        }
      } else {
        pendingTouchAction = null;
        hideIndicators();
      }
    }
  }

  function handlePointerUp(e) {
    if (e.pointerType !== 'touch') return;
    activePointers.delete(e.pointerId);

    if (activePointers.size < 2) {
      if (pendingTouchAction) {
        const act = pendingTouchAction;
        pendingTouchAction = null;
        triggerNavigation(act);
      } else {
        hideIndicators();
      }
      isTrackingTouch = false;
      touchCooldownUntil = Math.max(touchCooldownUntil, Date.now() + 350);
    }
  }

  // ── Panel táctil y rueda de ratón (Trackpad & Mouse Wheel) ────────────────
  function handleWheel(e) {
    // Ignorar si se pulsa Ctrl (gesto nativo de zoom)
    if (e.ctrlKey) return;
    if (isInputFocused() || isModalOpen()) return;

    // Una rueda física de ratón (deltaMode !== 0) o atajo Shift jamás debe navegar en el historial
    if (e.deltaMode !== 0 || e.shiftKey) return;

    // Bloquear si estamos en periodo de enfriamiento tras una navegación
    const now = Date.now();
    if (now < wheelCooldownUntil) {
      wheelAccumulatedX = 0;
      wheelTriggered = false;
      hideIndicatorsImmediate();
      return;
    }

    // Normalizar magnitud de deltaX según deltaMode (0: píxeles, 1: líneas, 2: páginas)
    let stepX = e.deltaX;
    if (e.deltaMode === 1) { // Delta por líneas (común en ruedas de ratón)
      stepX *= 33;
    } else if (e.deltaMode === 2) {
      stepX *= 100;
    }

    // Si deltaX es 0 pero shiftKey está presionado con deltaY, se interpreta como scroll horizontal
    if (stepX === 0 && e.shiftKey && e.deltaY) {
      stepX = e.deltaY;
    }

    // Solo evaluar gestos predominantemente horizontales
    if (Math.abs(stepX) < 1 || (Math.abs(stepX) < Math.abs(e.deltaY) * 1.1)) {
      return;
    }

    // Respetar elementos que tengan barra de desplazamiento horizontal activa o contenido ancho
    if (isHorizontallyScrollable(e.target, stepX)) {
      wheelAccumulatedX = 0;
      wheelTriggered = false;
      hideIndicatorsImmediate();
      return;
    }

    // Acumular el desplazamiento horizontal
    wheelAccumulatedX += stepX;

    const absStep = Math.abs(stepX);

    // Registro de desaceleración para detectar cuando el usuario levanta los dedos
    if (absStep < Math.abs(lastWheelStep) * 0.96) {
      isDeceleratingCount++;
    } else {
      isDeceleratingCount = 0;
    }
    lastWheelStep = stepX;

    const canGoBack = NavigationHistory.canBack();
    const canGoFwd = NavigationHistory.canForward();

    // Deslizamiento hacia la derecha (en Windows, deltaX < 0) -> Atrás
    if (wheelAccumulatedX < -15) {
      if (canGoBack) {
        e.preventDefault();
        const dist = Math.abs(wheelAccumulatedX);
        showIndicator('back', dist, WHEEL_THRESHOLD);
        if (dist >= WHEEL_THRESHOLD) {
          pendingWheelAction = 'back';
        } else {
          pendingWheelAction = null;
        }
      }
    }
    // Deslizamiento hacia la izquierda (deltaX > 0) -> Adelante
    else if (wheelAccumulatedX > 15) {
      if (canGoFwd) {
        e.preventDefault();
        const dist = wheelAccumulatedX;
        showIndicator('forward', dist, WHEEL_THRESHOLD);
        if (dist >= WHEEL_THRESHOLD) {
          pendingWheelAction = 'forward';
        } else {
          pendingWheelAction = null;
        }
      }
    } else {
      pendingWheelAction = null;
      hideIndicators();
    }

    // Si ya se superó el umbral y se detecta la inercia al soltar los dedos:
    // Disparamos la navegación de inmediato sin esperar a que la inercia se extinga (que tardaba 2 segundos)
    if (pendingWheelAction && (isDeceleratingCount >= 2 || absStep < 3.5)) {
      if (wheelTimeout) clearTimeout(wheelTimeout);
      const act = pendingWheelAction;
      pendingWheelAction = null;
      wheelAccumulatedX = 0;
      lastWheelStep = 0;
      isDeceleratingCount = 0;
      triggerNavigation(act);
      return;
    }

    // Temporizador de inactividad ágil (80 ms de respaldo)
    if (wheelTimeout) clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
      if (pendingWheelAction) {
        const act = pendingWheelAction;
        pendingWheelAction = null;
        wheelAccumulatedX = 0;
        lastWheelStep = 0;
        isDeceleratingCount = 0;
        triggerNavigation(act);
      } else {
        wheelAccumulatedX = 0;
        lastWheelStep = 0;
        isDeceleratingCount = 0;
        hideIndicators();
      }
    }, 80);
  }

  // ── Indicadores visuales y retroalimentación ─────────────────────────────
  function showIndicator(dir, currentDist, threshold) {
    const el = dir === 'back' ? elBack : elFwd;
    const otherEl = dir === 'back' ? elFwd : elBack;

    if (otherEl) {
      otherEl.style.display = 'none';
      otherEl.style.opacity = '0';
      otherEl.classList.remove('ready');
    }
    if (!el) return;

    el.style.display = 'flex';

    const ratio = Math.min(1.0, currentDist / threshold);
    const opacity = Math.min(1.0, 0.25 + ratio * 0.75);
    const travel = Math.round(ratio * 36);

    el.style.opacity = opacity.toFixed(2);

    if (dir === 'back') {
      el.style.transform = `translateY(-50%) translateX(${-24 + travel}px)`;
    } else {
      el.style.transform = `translateY(-50%) translateX(${24 - travel}px)`;
    }

    if (ratio >= 1.0) {
      el.classList.add('ready');
    } else {
      el.classList.remove('ready');
    }
  }

  function hideIndicatorsImmediate() {
    if (elBack) {
      elBack.style.display = 'none';
      elBack.style.opacity = '0';
      elBack.classList.remove('ready');
      elBack.style.transform = 'translateY(-50%) translateX(-24px)';
    }
    if (elFwd) {
      elFwd.style.display = 'none';
      elFwd.style.opacity = '0';
      elFwd.classList.remove('ready');
      elFwd.style.transform = 'translateY(-50%) translateX(24px)';
    }
  }

  function hideIndicators() {
    if (elBack) {
      elBack.style.opacity = '0';
      elBack.style.transform = 'translateY(-50%) translateX(-24px)';
      setTimeout(() => {
        if (elBack.style.opacity === '0') {
          elBack.style.display = 'none';
          elBack.classList.remove('ready');
        }
      }, 220);
    }
    if (elFwd) {
      elFwd.style.opacity = '0';
      elFwd.style.transform = 'translateY(-50%) translateX(24px)';
      setTimeout(() => {
        if (elFwd.style.opacity === '0') {
          elFwd.style.display = 'none';
          elFwd.classList.remove('ready');
        }
      }, 220);
    }
  }

  function triggerNavigation(direction) {
    if (typeof SoundFX !== 'undefined' && SoundFX.playPop) {
      SoundFX.playPop();
    }

    // Resetear inmediatamente acumuladores para que ningún evento residual active navegación secundaria
    wheelAccumulatedX = 0;
    lastWheelStep = 0;
    isDeceleratingCount = 0;
    pendingWheelAction = null;
    pendingTouchAction = null;
    if (wheelTimeout) {
      clearTimeout(wheelTimeout);
      wheelTimeout = null;
    }
    activePointers.clear();
    isTrackingTouch = false;

    // Enfriamiento para absorber la inercia residual restante de Windows
    const now = Date.now();
    wheelCooldownUntil = now + 750;
    touchCooldownUntil = now + 750;

    // Ejecutar la navegación
    if (direction === 'back') {
      NavigationHistory.back();
    } else {
      NavigationHistory.forward();
    }

    // Ocultar suavemente al soltar
    hideIndicators();
  }

  return {
    init,
    isTouchCooldownActive: () => Date.now() < touchCooldownUntil
  };
})();
