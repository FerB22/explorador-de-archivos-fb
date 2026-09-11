// ════════════════════════════════════════════════════════════════════════════
// GESTOR DE PAPELERA Y ALMACENAMIENTO (Obsidian Void & Crumple Toss)
// ════════════════════════════════════════════════════════════════════════════
const TrashManager = (() => {
  let trashItems = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let undoTimer = null;
  let undoRemaining = 5;
  let lastTossedId = null;

  async function init() {
    if (pyApi && pyApi.get_sound_setting) {
      try {
        const soundActive = await pyApi.get_sound_setting();
        SoundFX.setEnabled(soundActive);
      } catch (_) {}
    }
    await loadData();
  }

  async function loadData() {
    if (!pyApi || !pyApi.get_trash_data) return;
    try {
      const data = await pyApi.get_trash_data();
      trashItems = data.items || [];

      // Actualizar conteos e insignias
      const countEl = document.getElementById('trash-badge-count');
      if (countEl) countEl.textContent = data.total_count || 0;

      const pillItems = document.getElementById('trash-pill-items');
      if (pillItems) pillItems.textContent = `${data.total_count || 0} elementos`;

      const metricUsed = document.getElementById('trash-metric-used');
      if (metricUsed) metricUsed.textContent = data.total_size_fmt || '0 B';

      // Actualizar barra de medidor GPU
      const meterFill = document.getElementById('trash-meter-fill');
      if (meterFill) {
        const ratio = Math.max(0.02, Math.min(1.0, data.used_ratio || 0));
        meterFill.style.transform = `scaleX(${ratio})`;
      }

      // Conteo en filtros tipo chip
      const catCounts = data.categories || {};
      const elAll = document.getElementById('chip-count-all');
      if (elAll) elAll.textContent = data.total_count || 0;

      const elPdf = document.getElementById('chip-count-pdf');
      if (elPdf) elPdf.textContent = (catCounts.pdf && catCounts.pdf.count) || 0;

      const elImg = document.getElementById('chip-count-image');
      if (elImg) elImg.textContent = (catCounts.image && catCounts.image.count) || 0;

      const elArc = document.getElementById('chip-count-archive');
      if (elArc) elArc.textContent = (catCounts.archive && catCounts.archive.count) || 0;

      const elDoc = document.getElementById('chip-count-doc');
      if (elDoc) elDoc.textContent = (catCounts.document && catCounts.document.count) || 0;

      renderList();
    } catch (err) {
      console.error('Error al cargar datos de papelera:', err);
    }
  }

  function renderList() {
    const listEl = document.getElementById('trash-file-list');
    const emptyEl = document.getElementById('trash-empty-state');
    if (!listEl || !emptyEl) return;

    // Filtrar elementos
    const filtered = trashItems.filter(item => {
      const matchCat = (activeFilter === 'all') || (item.category === activeFilter);
      const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'flex';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = '';

    const ICONS_BY_CAT = {
      pdf: '📕',
      image: '🖼️',
      archive: '📦',
      document: '📘',
      code: '🐍',
      other: '📄'
    };

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'trash-row';
      row.dataset.id = item.id;

      const catClass = `cat-${item.category || 'other'}`;
      const iconGlyph = ICONS_BY_CAT[item.category] || '📄';

      row.innerHTML = `
        <div class="trash-row-left">
          <div class="trash-file-icon-box ${catClass}">${iconGlyph}</div>
          <div class="trash-row-info">
            <span class="trash-row-name" title="${item.name}">${item.name}</span>
            <span class="trash-row-meta">${item.size_fmt || '0 B'} • ${item.deleted_at || 'Reciente'}</span>
          </div>
        </div>
        <div class="trash-row-actions">
          <button class="btn-trash-restore" title="Restaurar a ubicación original">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Restaurar
          </button>
          <button class="btn-trash-toss" title="Arrugar y enviar al depósito permanente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `;

      // Evento restaurar
      const btnRestore = row.querySelector('.btn-trash-restore');
      btnRestore.addEventListener('click', async (e) => {
        e.stopPropagation();
        await restoreItem(item.id, item.name);
      });

      // Evento lanzar a papelera («Crumple & Toss»)
      const btnToss = row.querySelector('.btn-trash-toss');
      btnToss.addEventListener('click', async (e) => {
        e.stopPropagation();
        await tossItem(row, item);
      });

      listEl.appendChild(row);
    });
  }

  // Animación física parabólica ("Crumple & Toss")
  function animateCrumpleAndToss(rowEl, onComplete) {
    const binTarget = document.getElementById('trash-can-target');
    if (!binTarget) {
      if (onComplete) onComplete();
      return;
    }

    const rectStart = rowEl.getBoundingClientRect();
    const rectEnd = binTarget.getBoundingClientRect();

    const x0 = rectStart.left + rectStart.width / 2;
    const y0 = rectStart.top + rectStart.height / 2;
    const x1 = rectEnd.left + rectEnd.width / 2;
    const y1 = rectEnd.top + rectEnd.height / 2 - 10;

    // 1. Crujido de papel
    SoundFX.playCrumple();

    // 2. Colapso elástico de la fila
    rowEl.classList.add('collapsing');

    // 3. Crear proyectil balístico (bola arrugada)
    const ball = document.createElement('div');
    ball.className = 'trash-ball-projectile';
    ball.style.left = `${x0 - 13}px`;
    ball.style.top = `${y0 - 13}px`;
    document.body.appendChild(ball);

    // 4. Sonido de barrido
    SoundFX.playWhoosh();

    const duration = 540; // ms
    const startTime = performance.now();
    const arcHeight = Math.min(180, Math.max(90, Math.abs(x1 - x0) * 0.25));

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      // Coordenadas con elevación sinusoidal
      const curX = x0 + (x1 - x0) * progress;
      const linearY = y0 + (y1 - y0) * progress;
      const arcOffset = arcHeight * Math.sin(Math.PI * progress);
      const curY = linearY - arcOffset;

      const rot = progress * 720;
      const scale = 1.0 - 0.55 * progress;

      ball.style.transform = `translate(${curX - x0}px, ${curY - y0}px) rotate(${rot}deg) scale(${scale})`;

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        // Impacto final en el depósito
        ball.remove();

        // Squash & stretch de la papelera receptora
        binTarget.classList.remove('bin-squash');
        void binTarget.offsetWidth; // forzar reflujo
        binTarget.classList.add('bin-squash');
        setTimeout(() => binTarget.classList.remove('bin-squash'), 400);

        // Disipación de micropartículas
        createParticles(x1, y1);

        // Sonido de golpe sordo
        SoundFX.playImpact();

        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function createParticles(x, y) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'trash-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
      const dist = 30 + Math.random() * 35;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 16;
      p.style.setProperty('--dx', `${dx}px`);
      p.style.setProperty('--dy', `${dy}px`);
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 500);
    }
  }

  async function tossItem(rowEl, item) {
    animateCrumpleAndToss(rowEl, async () => {
      try {
        const res = await pyApi.delete_trash_item_permanently(item.id);
        if (res.success) {
          showToast(`«${item.name}» eliminado definitivamente`);
        }
        await loadData();
      } catch (err) {
        console.error('Error al eliminar elemento:', err);
      }
    });
  }

  async function restoreItem(itemId, name) {
    if (!pyApi || !pyApi.restore_trash_item) return;
    try {
      const res = await pyApi.restore_trash_item(itemId);
      if (res.success) {
        SoundFX.playUndo();
        showToast(`«${name || 'Archivo'}» restaurado`);
        await loadData();
        await refreshExplorer();
      } else {
        showToast(res.message || 'Error al restaurar');
      }
    } catch (err) {
      console.error('Error al restaurar:', err);
    }
  }

  async function tossItemFromExplorer(node) {
    if (!pyApi || !pyApi.toss_to_trash) return;
    try {
      const res = await pyApi.toss_to_trash(node.path);
      if (res.success) {
        SoundFX.playCrumple();
        showUndoToast(res.item || { id: '', name: node.name });
        await refreshExplorer();
        await loadData();
        if (currentNode && currentNode.path === node.path) {
          Viewer.clear();
        }
      } else {
        showToast(res.message || 'No se pudo mover a la papelera');
      }
    } catch (err) {
      console.error('Error al desechar desde explorador:', err);
    }
  }

  function showUndoToast(item) {
    const toast = document.getElementById('trash-undo-toast');
    const ringCircle = document.getElementById('undo-ring-circle');
    const countdownEl = document.getElementById('undo-countdown-num');
    const nameEl = document.getElementById('undo-filename');
    if (!toast || !ringCircle || !countdownEl) return;

    if (undoTimer) clearInterval(undoTimer);

    lastTossedId = item.id;
    if (nameEl) nameEl.textContent = item.name;
    toast.style.display = 'flex';

    undoRemaining = 5.0;
    const totalDuration = 5.0;
    const intervalMs = 50;
    const totalSteps = (totalDuration * 1000) / intervalMs;
    let stepCount = 0;

    undoTimer = setInterval(() => {
      stepCount++;
      undoRemaining = Math.max(0, totalDuration - (stepCount * intervalMs) / 1000);
      countdownEl.textContent = `${Math.ceil(undoRemaining)}s`;

      const progress = (stepCount / totalSteps) * 100;
      ringCircle.style.strokeDashoffset = progress;

      if (stepCount >= totalSteps) {
        clearInterval(undoTimer);
        undoTimer = null;
        toast.style.display = 'none';
        lastTossedId = null;
      }
    }, intervalMs);
  }

  function setupUI() {
    // Alternancia de sonido
    const btnSound = document.getElementById('trash-btn-sound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        SoundFX.toggle();
      });
    }

    // Vaciar papelera
    const btnEmpty = document.getElementById('trash-btn-empty');
    if (btnEmpty) {
      btnEmpty.addEventListener('click', async () => {
        if (!trashItems.length) {
          showToast('La papelera ya está vacía');
          return;
        }
        const ok = await CustomDialog.confirm({
          title: 'Vaciar papelera',
          message: '¿Deseas vaciar por completo la papelera? Esta acción eliminará permanentemente todos los elementos y no se puede deshacer.',
          confirmText: 'Vaciar papelera',
          cancelText: 'Cancelar',
          badgeText: 'PAPELERA',
          icon: '🗑️',
          isDanger: true
        });
        if (ok && pyApi && pyApi.empty_trash) {
          const res = await pyApi.empty_trash();
          if (res.success) {
            SoundFX.playImpact();
            showToast('Papelera vaciada');
            await loadData();
          }
        }
      });
    }

    // Filtros tipo chip
    const chips = document.querySelectorAll('.chip-filter');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter || 'all';
        renderList();
      });
    });

    // Buscador en papelera
    const searchInp = document.getElementById('trash-search-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderList();
      });
    }

    // Botón Deshacer del toast
    const btnUndo = document.getElementById('trash-btn-undo-action');
    if (btnUndo) {
      btnUndo.addEventListener('click', async () => {
        if (undoTimer) {
          clearInterval(undoTimer);
          undoTimer = null;
        }
        const toast = document.getElementById('trash-undo-toast');
        if (toast) toast.style.display = 'none';

        if (lastTossedId) {
          await restoreItem(lastTossedId, 'Archivo');
          lastTossedId = null;
        }
      });
    }
  }

  return {
    init,
    loadData,
    setupUI,
    tossItemFromExplorer
  };
})();
