// ════════════════════════════════════════════════════════════════════════════
// VISOR DE ARCHIVOS
// ════════════════════════════════════════════════════════════════════════════

const Viewer = (() => {

  const IDS = {
    toolbar:  'preview-toolbar',
    icon:     'preview-icon',
    name:     'preview-name',
    meta:     'preview-meta',
    btnOpen:     'preview-btn-open',
    btnReveal:   'preview-btn-reveal',
    btnCopyPath: 'preview-btn-copy-path',
    btnToggleHtml: 'preview-btn-toggle-html',
    btnToggleHtmlText: 'preview-btn-toggle-html-text',
    btnEdit:     'preview-btn-edit',
    btnEditText: 'preview-btn-edit-text',
    btnSave:     'preview-btn-save',
    btnCancelEdit: 'preview-btn-cancel-edit',
    body:        'preview-body',
    empty:    'pv-empty',
    loading:  'pv-loading',
    image:    'pv-image',
    img:      'pv-img',
    markdown: 'pv-markdown',
    code:     'pv-code',
    langBadge:'pv-lang-badge',
    copyBtn:  'pv-copy-btn',
    codeEl:   'pv-code-el',
    text:     'pv-text',
    editor:   'pv-editor',
    pdf:      'pv-pdf',
    none:     'pv-none',
    noneMsg:  'pv-none-msg',
    noneOpen: 'pv-none-open',
  };

  const CONTENT_IDS = [
    'pv-empty', 'pv-loading', 'pv-image', 'pv-markdown', 'pv-code',
    'pv-text', 'pv-editor', 'pv-pdf', 'pv-docx', 'pv-excel', 'pv-pptx',
    'pv-archive', 'pv-audio', 'pv-video', 'pv-notebook', 'pv-html', 'pv-none'
  ];

  // Extensiones y tipos de archivo admitidos para edición directa
  const EDITABLE_TYPES = new Set(['markdown', 'code', 'text', 'html']);

  // Estado del editor integrado
  let isEditing = false;
  let currentFileResult = null;
  let originalContent = '';
  let isDirty = false;
  let editorLayout = 'split'; // 'split' o 'edit'
  let livePreviewTimer = null;

  // Estado del visor PDF
  let pdfDoc = null;
  let pdfPageNum = 1;
  let pdfScale = 1.2;
  let pdfPageRendering = false;
  let pdfPageNumPending = null;
  let currentRenderTask = null;

  function initPdfJs() {
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    }
  }

  function renderPdfPage(num) {
    if (!pdfDoc) return;

    if (currentRenderTask) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }

    pdfPageRendering = true;
    pdfDoc.getPage(num).then(page => {
      const canvas = document.getElementById('pdf-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: pdfScale });

      // Dimensiones de resolución interna del buffer del canvas
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Dimensiones explícitas de estilo CSS para garantizar el reescalado visual inmediato en pantalla
      canvas.style.height = `${viewport.height}px`;
      canvas.style.width = `${viewport.width}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      currentRenderTask = page.render(renderContext);

      currentRenderTask.promise.then(() => {
        pdfPageRendering = false;
        currentRenderTask = null;
        if (pdfPageNumPending !== null) {
          const nextPending = pdfPageNumPending;
          pdfPageNumPending = null;
          renderPdfPage(nextPending);
        }
      }).catch(err => {
        if (err && err.name === 'RenderingCancelledException') {
          // Cancelación esperada al cambiar escala o página rápidamente
          return;
        }
        console.error("Error renderizando página PDF:", err);
        pdfPageRendering = false;
        currentRenderTask = null;
      });
    }).catch(err => {
      console.error("Error obteniendo página PDF:", err);
      pdfPageRendering = false;
    });

    const pageNumEl = document.getElementById('pdf-page-num');
    if (pageNumEl) pageNumEl.textContent = num;
    const pageCountEl = document.getElementById('pdf-page-count');
    if (pageCountEl) pageCountEl.textContent = pdfDoc.numPages;
    const zoomValEl = document.getElementById('pdf-zoom-val');
    if (zoomValEl) zoomValEl.textContent = Math.round(pdfScale * 100) + ' %';
    const prevBtn = document.getElementById('pdf-prev');
    if (prevBtn) prevBtn.disabled = (num <= 1);
    const nextBtn = document.getElementById('pdf-next');
    if (nextBtn) nextBtn.disabled = (num >= pdfDoc.numPages);
  }

  function queueRenderPage(num) {
    if (pdfPageRendering) {
      pdfPageNumPending = num;
      if (currentRenderTask) {
        currentRenderTask.cancel();
        currentRenderTask = null;
      }
    } else {
      renderPdfPage(num);
    }
  }

  function setupPdfEvents() {
    const prevBtn = document.getElementById('pdf-prev');
    const nextBtn = document.getElementById('pdf-next');
    const zoomInBtn = document.getElementById('pdf-zoom-in');
    const zoomOutBtn = document.getElementById('pdf-zoom-out');
    const fitWidthBtn = document.getElementById('pdf-fit-width');

    if (prevBtn && !prevBtn.dataset.bound) {
      prevBtn.dataset.bound = 'true';
      prevBtn.onclick = () => {
        if (pdfDoc && pdfPageNum > 1) {
          pdfPageNum--;
          queueRenderPage(pdfPageNum);
        }
      };
      nextBtn.onclick = () => {
        if (pdfDoc && pdfPageNum < pdfDoc.numPages) {
          pdfPageNum++;
          queueRenderPage(pdfPageNum);
        }
      };
      zoomInBtn.onclick = () => {
        if (!pdfDoc) return;
        pdfScale = Math.min(3.0, +(pdfScale + 0.2).toFixed(2));
        queueRenderPage(pdfPageNum);
      };
      zoomOutBtn.onclick = () => {
        if (!pdfDoc) return;
        pdfScale = Math.max(0.4, +(pdfScale - 0.2).toFixed(2));
        queueRenderPage(pdfPageNum);
      };
      fitWidthBtn.onclick = () => {
        if (!pdfDoc) return;
        const container = document.getElementById('pdf-canvas-container');
        if (container && container.clientWidth > 100) {
          pdfDoc.getPage(pdfPageNum).then(page => {
            const vp = page.getViewport({ scale: 1.0 });
            pdfScale = Math.max(0.4, Math.min(3.0, +((container.clientWidth - 48) / vp.width).toFixed(2)));
            queueRenderPage(pdfPageNum);
          });
        }
      };
    }

    if (!window._pdfKeyBound) {
      window._pdfKeyBound = true;
      window.addEventListener('keydown', (e) => {
        const pdfPanel = document.getElementById('pv-pdf');
        if (!pdfPanel || pdfPanel.style.display === 'none' || !pdfDoc) return;

        // Evitar interceptar si el usuario está escribiendo en un input o textarea
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
          return;
        }

        if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
          e.preventDefault();
          if (pdfPageNum < pdfDoc.numPages) {
            pdfPageNum++;
            queueRenderPage(pdfPageNum);
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
          e.preventDefault();
          if (pdfPageNum > 1) {
            pdfPageNum--;
            queueRenderPage(pdfPageNum);
          }
        } else if (e.key === 'Home') {
          e.preventDefault();
          if (pdfPageNum !== 1) {
            pdfPageNum = 1;
            queueRenderPage(pdfPageNum);
          }
        } else if (e.key === 'End') {
          e.preventDefault();
          if (pdfPageNum !== pdfDoc.numPages) {
            pdfPageNum = pdfDoc.numPages;
            queueRenderPage(pdfPageNum);
          }
        } else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
          e.preventDefault();
          pdfScale = Math.min(3.0, +(pdfScale + 0.2).toFixed(2));
          queueRenderPage(pdfPageNum);
          showToast(`Zoom: ${Math.round(pdfScale * 100)} %`, 1400);
        } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
          e.preventDefault();
          pdfScale = Math.max(0.4, +(pdfScale - 0.2).toFixed(2));
          queueRenderPage(pdfPageNum);
          showToast(`Zoom: ${Math.round(pdfScale * 100)} %`, 1400);
        } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
          e.preventDefault();
          const container = document.getElementById('pdf-canvas-container');
          if (container && container.clientWidth > 100) {
            pdfDoc.getPage(pdfPageNum).then(page => {
              const vp = page.getViewport({ scale: 1.0 });
              pdfScale = Math.max(0.4, Math.min(3.0, +((container.clientWidth - 48) / vp.width).toFixed(2)));
              queueRenderPage(pdfPageNum);
              showToast(`Zoom ajustado al ancho: ${Math.round(pdfScale * 100)} %`, 1600);
            });
          }
        }
      });
    }
  }

  function showOnly(id) {
    CONTENT_IDS.forEach(cid => {
      const el = document.getElementById(cid);
      if (el) el.style.display = cid === id ? '' : 'none';
    });
  }

  function showEmpty() {
    document.getElementById(IDS.toolbar).style.display = 'none';
    showOnly('pv-empty');
  }

  function updateToolbar(node, result) {
    const tb = document.getElementById(IDS.toolbar);
    tb.style.display = 'flex';
    document.getElementById(IDS.icon).textContent = node.is_dir ? '📂' : getIcon(node.extension);
    document.getElementById(IDS.name).textContent = result.name || node.name;
    const ext = result.extension ? result.extension.toUpperCase() : '';
    const size = result.size ? formatSize(result.size) : '';
    document.getElementById(IDS.meta).textContent = [ext, size].filter(Boolean).join(' · ');
    document.getElementById(IDS.btnOpen).onclick   = () => pyApi && pyApi.open_file(node.path);
    document.getElementById(IDS.btnReveal).onclick = () => pyApi && pyApi.reveal_file(node.path);

    if (typeof FolderView !== 'undefined' && FolderView.renderBreadcrumbsForFile) {
      FolderView.renderBreadcrumbsForFile(node);
    }
    const selectionEl = document.getElementById('sb-selection');
    if (selectionEl) {
      selectionEl.textContent = `Viendo: ${node.name} (${size || ext || 'Archivo'})`;
    }

    const copyBtn = document.getElementById(IDS.btnCopyPath);
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(node.path)
          .then(() => showToast('Ruta copiada al portapapeles'))
          .catch(() => showToast('No se pudo copiar la ruta'));
      };
      copyBtn.oncontextmenu = (e) => {
        e.preventDefault();
        let relPath = node.path;
        if (currentRootPath) {
          const normAbs = node.path.replace(/\\/g, '/');
          const normRoot = currentRootPath.replace(/\\/g, '/').replace(/\/+$/, '');
          if (normAbs.toLowerCase().startsWith(normRoot.toLowerCase())) {
            relPath = normAbs.slice(normRoot.length).replace(/^\/+/, '').replace(/\//g, '\\');
          }
        }
        navigator.clipboard.writeText(relPath)
          .then(() => showToast('Ruta relativa copiada al portapapeles'))
          .catch(() => showToast('No se pudo copiar la ruta'));
      };
    }

    const toggleHtmlBtn = document.getElementById(IDS.btnToggleHtml);
    if (toggleHtmlBtn) {
      if (result.type === 'html') {
        toggleHtmlBtn.style.display = 'inline-flex';
        const isCodeActive = document.getElementById('pv-html-code-container')?.style.display === 'block';
        updateHtmlToggleBtnText(isCodeActive);
        toggleHtmlBtn.onclick = () => {
          const previewContainer = document.getElementById('pv-html-preview-container');
          const codeContainer = document.getElementById('pv-html-code-container');
          const previewBtn = document.getElementById('pv-html-btn-preview');
          const codeBtn = document.getElementById('pv-html-btn-code');
          const codeVisible = codeContainer && codeContainer.style.display === 'block';
          if (codeVisible) {
            // Cambiar a vista web
            if (previewContainer) previewContainer.style.display = 'block';
            if (codeContainer) codeContainer.style.display = 'none';
            if (previewBtn) previewBtn.classList.add('active');
            if (codeBtn) codeBtn.classList.remove('active');
            updateHtmlToggleBtnText(false);
          } else {
            // Cambiar a código fuente
            if (previewContainer) previewContainer.style.display = 'none';
            if (codeContainer) codeContainer.style.display = 'block';
            if (previewBtn) previewBtn.classList.remove('active');
            if (codeBtn) codeBtn.classList.add('active');
            updateHtmlToggleBtnText(true);
          }
        };
      } else {
        toggleHtmlBtn.style.display = 'none';
      }
    }

    // Botón volver a carpeta
    const backToFolderBtn = document.getElementById('preview-btn-back-to-folder');
    if (backToFolderBtn) {
      backToFolderBtn.onclick = async () => {
        if (isEditing && isDirty) {
          const discard = await CustomDialog.confirm({
            title: 'Cambios sin guardar',
            message: 'Tienes cambios sin guardar. ¿Deseas salir y descartar las modificaciones?',
            confirmText: 'Descartar cambios',
            cancelText: 'Continuar editando',
            badgeText: 'AVISO',
            icon: '⚠️',
            isDanger: true
          });
          if (!discard) return;
        }
        clear();
      };
    }

    // Botón Editar archivo en visor
    const editBtn = document.getElementById(IDS.btnEdit);
    const saveBtn = document.getElementById(IDS.btnSave);
    const cancelBtn = document.getElementById(IDS.btnCancelEdit);

    const isEditable = EDITABLE_TYPES.has(result.type);
    if (editBtn) {
      if (isEditable) {
        editBtn.style.display = 'inline-flex';
        editBtn.onclick = () => {
          if (!isEditing) {
            startEditing(node, result);
          }
        };
      } else {
        editBtn.style.display = 'none';
      }
    }

    if (saveBtn) {
      saveBtn.style.display = isEditing ? 'inline-flex' : 'none';
      saveBtn.onclick = () => saveCurrentEdit();
    }

    if (cancelBtn) {
      cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
      cancelBtn.onclick = () => cancelCurrentEdit();
    }
  }

  function updateHtmlToggleBtnText(isCodeActive) {
    const textEl = document.getElementById(IDS.btnToggleHtmlText);
    const btn = document.getElementById(IDS.btnToggleHtml);
    if (!btn) return;
    if (isCodeActive) {
      if (textEl) textEl.textContent = '🌐 Vista web';
      btn.title = 'Mostrar página web interactiva con estilos y scripts';
    } else {
      if (textEl) textEl.textContent = '💻 Ver código';
      btn.title = 'Mostrar código fuente HTML';
    }
  }

  // ── Render por tipo ─────────────────────────────────────────────────────────

  function renderImage(result) {
    document.getElementById(IDS.img).src = result.content;
    showOnly('pv-image');
  }

  function generateHeadingSlug(text) {
    if (!text) return '';
    return text
      .toString()
      .trim()
      .toLowerCase()
      // Eliminar acentos/diacríticos para máxima compatibilidad con anclas
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Eliminar caracteres que no sean letras, números, espacios ni guiones
      .replace(/[^\w\s\-]/g, '')
      // Reemplazar espacios o secuencias de guiones por un único guion
      .replace(/[\s\_]+/g, '-')
      .replace(/\-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeTextForComparison(text) {
    if (!text) return '';
    return text
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function parseMarkdownToHtml(markdownText) {
    let text = markdownText || '';

    // 1. Pre-procesar bloques y expresiones matemáticas KaTeX para preservarlos de marked
    const mathTokens = [];
    function storeMath(mathStr, isBlock) {
      const idx = mathTokens.length;
      mathTokens.push({ math: mathStr, isBlock });
      return `@@KATEX_MATH_${idx}@@`;
    }

    // Proteger bloques de código de ser procesados por las expresiones matemáticas
    const codeTokens = [];
    text = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
      const idx = codeTokens.length;
      codeTokens.push(match);
      return `@@CODE_BLOCK_${idx}@@`;
    });

    // Detectar bloques de display math: $$...$$ o \[...\]
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
      return storeMath(formula.trim(), true);
    });
    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
      return storeMath(formula.trim(), true);
    });

    // Detectar expresiones inline math: \(...\) o $...$
    text = text.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
      return storeMath(formula.trim(), false);
    });

    // Proteger primero cifras monetarias explícitas ($1.500, $10.000, $ 50, etc.)
    // Un signo de dólar seguido de dígitos sin operadores matemáticos inmediatos es dinero, no LaTeX
    const currencyTokens = [];
    text = text.replace(/(?<!\\)\$\s?(\d[\d\.\,]*(?:\s*(?:CLP|USD|EUR|UF|mil|millones|pesos|dólares|%|\b))?)(?!\s*[\+\-\*\/\^\_\=\<\>\\])/gi, (match) => {
      const idx = currencyTokens.length;
      currencyTokens.push(match);
      return `@@CURRENCY_VAL_${idx}@@`;
    });

    // Inline math con delimitador $...$ (estándar Pandoc/CommonMark)
    // El $ de apertura no puede estar seguido de espacio; el $ de cierre no puede estar precedido de espacio ni seguido de dígito
    text = text.replace(/(?<!\\)\$(?!\s)([^\$\n\r]+?)(?<!\s)(?<!\\)\$(?!\d)/g, (match, formula) => {
      const trimmed = formula.trim();

      // Descartar si contiene estructura de oraciones en prosa (puntos seguidos de espacio o signos de interrogación/exclamación)
      if (/\.\s+[A-ZÁÉÍÓÚÑ]|\?\s|\!\s/i.test(trimmed)) {
        return match;
      }

      // Descartar si son múltiples palabras de texto plano sin ningún comando LaTeX ni operador matemático
      const hasMathSymbol = /[\+\-\*\/\^\_\=\<\>\\\{\}\(\)\[\]\|\~]|\\(?:times|alpha|beta|gamma|frac|sqrt|sum|int|cdot|approx|ne|le|ge|pm|infty)/i.test(trimmed);
      const wordCount = (trimmed.match(/\b[a-záéíóúñ]{3,}\b/gi) || []).length;
      if (wordCount >= 3 && !hasMathSymbol) {
        return match;
      }

      return storeMath(trimmed, false);
    });

    // Restaurar cifras monetarias
    text = text.replace(/@@CURRENCY_VAL_(\d+)@@/g, (_, idx) => {
      return currencyTokens[Number(idx)];
    });

    // Restaurar bloques de código
    text = text.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, idx) => {
      return codeTokens[Number(idx)];
    });

    // 2. Normalizar GitHub Callouts / Alerts ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
    // Formato estándar en Markdown de GitHub es:
    // > [!WARNING]
    // > Texto...
    // O párrafos independientes:
    // [!WARNING]
    text = text.replace(/^(\s*>\s*)?\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gim, (match, quotePrefix, alertType) => {
      const pfx = quotePrefix || '> ';
      return `${pfx}**@@ALERT_${alertType.toUpperCase()}@@**`;
    });

    // 3. Parsear Markdown a HTML con marked
    let html = '';
    if (window.marked && typeof marked.parse === 'function') {
      html = marked.parse(text);
    } else {
      html = text.replace(/\n/g, '<br>');
    }

    // 4. Transformar marcadores de GitHub Alerts en contenedores estilizados
    const ALERT_ICONS = {
      NOTE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      TIP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 7a5 5 0 0 1 5 5c0 2-1.5 3-2 4H9c-.5-1-2-2-2-4a5 5 0 0 1 5-5z"/></svg>',
      IMPORTANT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      WARNING: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      CAUTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
    };

    const ALERT_TITLES = {
      NOTE: 'Nota',
      TIP: 'Consejo',
      IMPORTANT: 'Importante',
      WARNING: 'Advertencia',
      CAUTION: 'Precaución'
    };

    // Reemplazar alertas dentro de blockquotes o párrafos
    html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (match, bqContent) => {
      const alertMatch = bqContent.match(/<strong>@@ALERT_(NOTE|TIP|IMPORTANT|WARNING|CAUTION)@@<\/strong>/i);
      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        const cleanedContent = bqContent.replace(/<p>\s*<strong>@@ALERT_[A-Z]+@@<\/strong>\s*<\/p>/i, '')
                                        .replace(/<strong>@@ALERT_[A-Z]+@@<\/strong>/i, '');
        return `
          <div class="markdown-alert markdown-alert-${type.toLowerCase()}">
            <div class="markdown-alert-title">
              ${ALERT_ICONS[type] || ''}
              <span>${ALERT_TITLES[type] || type}</span>
            </div>
            ${cleanedContent}
          </div>
        `;
      }
      return match;
    });

    // Alertas que quedaron sueltas como párrafos
    html = html.replace(/<p>\s*<strong>@@ALERT_(NOTE|TIP|IMPORTANT|WARNING|CAUTION)@@<\/strong>\s*<\/p>/gi, (match, typeUpper) => {
      const type = typeUpper.toUpperCase();
      return `
        <div class="markdown-alert markdown-alert-${type.toLowerCase()}">
          <div class="markdown-alert-title">
            ${ALERT_ICONS[type] || ''}
            <span>${ALERT_TITLES[type] || type}</span>
          </div>
        </div>
      `;
    });

    // 5. Renderizar tokens matemáticos con KaTeX
    html = html.replace(/@@KATEX_MATH_(\d+)@@/g, (_, idx) => {
      const token = mathTokens[Number(idx)];
      if (!token) return '';
      if (window.katex && typeof katex.renderToString === 'function') {
        try {
          return katex.renderToString(token.math, {
            displayMode: token.isBlock,
            throwOnError: false
          });
        } catch (err) {
          console.warn('Error KaTeX renderizando:', token.math, err);
          return `<span class="katex-error" title="${err.message}">${token.math}</span>`;
        }
      }
      return token.isBlock ? `$$${token.math}$$` : `$${token.math}$`;
    });

    // 6. Generar identificadores únicos (slugs) en encabezados (h1 - h6) para navegación por índices
    const slugCounts = new Map();
    html = html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, content) => {
      // Extraer texto plano despojándolo de etiquetas HTML internas
      const plainText = content.replace(/<[^>]+>/g, '').trim();
      const baseSlug = generateHeadingSlug(plainText);
      const normText = normalizeTextForComparison(plainText);

      // Si el encabezado ya posee un id manual o ancla explícita, preservarlo
      const existingIdMatch = attrs.match(/\bid=["']([^"']+)["']/i);
      let headingId = existingIdMatch ? existingIdMatch[1] : '';

      if (!headingId) {
        // También buscar si dentro del contenido hay una etiqueta de ancla <a name="..."> o <a id="...">
        const innerAnchorMatch = content.match(/<a\s+[^>]*(?:name|id)=["']([^"']+)["'][^>]*>/i);
        if (innerAnchorMatch) {
          headingId = innerAnchorMatch[1];
        } else if (baseSlug) {
          const count = slugCounts.get(baseSlug) || 0;
          slugCounts.set(baseSlug, count + 1);
          headingId = count === 0 ? baseSlug : `${baseSlug}-${count}`;
        }
      }

      const idAttr = (!existingIdMatch && headingId) ? ` id="${headingId}"` : '';
      const slugVal = headingId || baseSlug || '';
      const slugAttr = slugVal ? ` data-heading-slug="${slugVal}"` : '';
      const normAttr = normText ? ` data-norm-text="${normText}"` : '';

      return `<h${level}${attrs}${idAttr}${slugAttr}${normAttr}>${content}</h${level}>`;
    });

    // 7. Habilitar y numerar casillas de verificación interactivas (task lists / checklists)
    let taskCounter = 0;
    html = html.replace(/<li([^>]*)>([\s\S]*?)<\/li>/gi, (match, liAttrs, liContent) => {
      const inputMatch = liContent.match(/<input\s+[^>]*type=["']checkbox["'][^>]*>/i);
      if (inputMatch) {
        const fullInput = inputMatch[0];
        const isChecked = /checked/i.test(fullInput);
        const taskIndex = taskCounter++;
        const activeInput = `<input type="checkbox" class="task-checkbox" data-task-index="${taskIndex}" ${isChecked ? 'checked' : ''}>`;

        let newContent = liContent.replace(fullInput, activeInput);
        let classes = (liAttrs.match(/class=["']([^"']*)["']/i) || ['', ''])[1];
        if (!classes.includes('task-list-item')) classes = (classes + ' task-list-item').trim();
        if (isChecked && !classes.includes('is-completed')) classes = (classes + ' is-completed').trim();
        const cleanAttrs = liAttrs.replace(/\s*class=["'][^"']*["']/i, '');
        return `<li class="${classes}"${cleanAttrs}>${newContent}</li>`;
      }
      return match;
    });

    return html;
  }

  function renderMarkdown(result) {
    const el = document.getElementById(IDS.markdown);
    if (!el) return;

    el.innerHTML = parseMarkdownToHtml(result.content || '');

    // 6. Resaltar sintaxis en bloques de código dentro del Markdown
    if (window.hljs) {
      el.querySelectorAll('pre code').forEach((block) => {
        try {
          hljs.highlightElement(block);
        } catch (e) {
          /* Ignorar lenguajes desconocidos */
        }
      });
    }

    showOnly('pv-markdown');
  }

  function renderCode(result) {
    const codeEl = document.getElementById(IDS.codeEl);
    codeEl.textContent = result.content;
    codeEl.className = result.language ? 'language-' + result.language : '';
    if (window.hljs) {
      if (result.language) {
        try { hljs.highlightElement(codeEl); } catch(e) { /* no soportado */ }
      } else {
        hljs.highlightElement(codeEl);
      }
    }
    document.getElementById(IDS.langBadge).textContent = result.language || 'texto';
    document.getElementById(IDS.copyBtn).onclick = () => {
      navigator.clipboard.writeText(result.content)
        .then(() => showToast('Código copiado'))
        .catch(() => showToast('No se pudo copiar'));
    };
    showOnly('pv-code');
  }

  function renderText(result) {
    document.getElementById(IDS.text).textContent = result.content;
    showOnly('pv-text');
  }

  function renderHtml(result) {
    const previewBtn = document.getElementById('pv-html-btn-preview');
    const codeBtn = document.getElementById('pv-html-btn-code');
    const reloadBtn = document.getElementById('pv-html-btn-reload');
    const externalBtn = document.getElementById('pv-html-btn-external');
    const iframe = document.getElementById('pv-html-iframe');
    const previewContainer = document.getElementById('pv-html-preview-container');
    const codeContainer = document.getElementById('pv-html-code-container');
    const codeEl = document.getElementById('pv-html-code-el');

    // Preparar el contenido HTML inyectando <base> si hay un directorio contenedor local
    let htmlContent = result.content || '';
    if (result.dir_path) {
      // Normalizar ruta para URI de archivo
      const fileBase = 'file:///' + result.dir_path.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
      // Inyectar o reemplazar <base> en el head para resolver CSS, JS e imágenes relativas
      if (/<head[^>]*>/i.test(htmlContent)) {
        htmlContent = htmlContent.replace(/<head[^>]*>/i, `$&<base href="${fileBase}">`);
      } else {
        htmlContent = `<base href="${fileBase}">` + htmlContent;
      }
    }

    function loadIframeContent() {
      if (iframe) {
        iframe.srcdoc = htmlContent;
      }
    }

    // Modo por defecto: Vista web
    if (previewContainer && codeContainer) {
      previewContainer.style.display = 'block';
      codeContainer.style.display = 'none';
      if (previewBtn) previewBtn.classList.add('active');
      if (codeBtn) codeBtn.classList.remove('active');
    }

    loadIframeContent();

    // Resaltar código fuente en la pestaña de código
    if (codeEl) {
      codeEl.textContent = result.content;
      if (window.hljs) {
        hljs.highlightElement(codeEl);
      }
    }

    // Eventos de botones
    if (previewBtn) {
      previewBtn.onclick = () => {
        previewBtn.classList.add('active');
        if (codeBtn) codeBtn.classList.remove('active');
        if (previewContainer) previewContainer.style.display = 'block';
        if (codeContainer) codeContainer.style.display = 'none';
        updateHtmlToggleBtnText(false);
      };
    }

    if (codeBtn) {
      codeBtn.onclick = () => {
        codeBtn.classList.add('active');
        if (previewBtn) previewBtn.classList.remove('active');
        if (previewContainer) previewContainer.style.display = 'none';
        if (codeContainer) codeContainer.style.display = 'block';
        updateHtmlToggleBtnText(true);
      };
    }

    if (reloadBtn) {
      reloadBtn.onclick = () => {
        loadIframeContent();
        showToast('Página web recargada');
      };
    }

    if (externalBtn) {
      externalBtn.onclick = () => {
        if (pyApi && result.path) {
          pyApi.open_file(result.path);
        }
      };
    }

    showOnly('pv-html');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MÓDULO DEL EDITOR INTEGRADO (TEXTO PLANO, MARKDOWN Y CÓDIGO)
  // ════════════════════════════════════════════════════════════════════════════

  function updateEditorStats(text) {
    const lines = text.split('\n').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const statsEl = document.getElementById('pv-editor-stats');
    if (statsEl) {
      statsEl.textContent = `${lines} ${lines === 1 ? 'línea' : 'líneas'} · ${words} ${words === 1 ? 'palabra' : 'palabras'} · ${chars} car.`;
    }
  }

  function updateLineNumbers(text) {
    const linesCount = text.split('\n').length;
    const lineNumsEl = document.getElementById('pv-editor-line-numbers');
    if (lineNumsEl) {
      let nums = '';
      for (let i = 1; i <= linesCount; i++) {
        nums += i + '\n';
      }
      lineNumsEl.textContent = nums;
    }
  }

  function updateLivePreview(text, type) {
    const previewPane = document.getElementById('pv-editor-pane-preview');
    if (!previewPane) return;

    if (type === 'markdown') {
      previewPane.innerHTML = parseMarkdownToHtml(text);
      if (window.hljs) {
        previewPane.querySelectorAll('pre code').forEach((block) => {
          try { hljs.highlightElement(block); } catch (e) {}
        });
      }
    } else if (type === 'html') {
      previewPane.innerHTML = text;
    }
  }

  function setEditorDirty(dirty) {
    isDirty = dirty;
    const dirtyEl = document.getElementById('pv-editor-dirty-indicator');
    if (dirtyEl) {
      dirtyEl.style.display = dirty ? 'inline-flex' : 'none';
    }
    const saveBtn = document.getElementById(IDS.btnSave);
    if (saveBtn) {
      saveBtn.disabled = !dirty;
    }
  }

  function applyEditorLayout(layout, fileType) {
    editorLayout = layout;
    const previewPane = document.getElementById('pv-editor-pane-preview');
    const splitControls = document.getElementById('pv-editor-split-controls');
    const btnSplit = document.getElementById('pv-editor-btn-layout-split');
    const btnEditOnly = document.getElementById('pv-editor-btn-layout-edit');

    const supportsPreview = (fileType === 'markdown' || fileType === 'html');
    if (splitControls) {
      splitControls.style.display = supportsPreview ? 'flex' : 'none';
    }

    if (supportsPreview && layout === 'split') {
      if (previewPane) previewPane.style.display = 'block';
      if (btnSplit) btnSplit.classList.add('active');
      if (btnEditOnly) btnEditOnly.classList.remove('active');
    } else {
      if (previewPane) previewPane.style.display = 'none';
      if (btnSplit) btnSplit.classList.remove('active');
      if (btnEditOnly) btnEditOnly.classList.add('active');
    }
  }

  function startEditing(node, result) {
    if (!node || !result) return;
    isEditing = true;
    currentFileResult = result;
    originalContent = result.content || '';
    setEditorDirty(false);

    // Actualizar botones de toolbar
    const editBtn = document.getElementById(IDS.btnEdit);
    const saveBtn = document.getElementById(IDS.btnSave);
    const cancelBtn = document.getElementById(IDS.btnCancelEdit);
    const toggleHtmlBtn = document.getElementById(IDS.btnToggleHtml);

    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (toggleHtmlBtn) toggleHtmlBtn.style.display = 'none';

    // Configurar badges del editor
    const fileBadge = document.getElementById('pv-editor-file-badge');
    if (fileBadge) {
      const ext = (result.extension || '').toUpperCase();
      const typeLabel = result.type === 'markdown' ? 'Markdown' :
                        result.type === 'code' ? (result.language || ext || 'Código') :
                        result.type === 'html' ? 'HTML' : 'Texto plano';
      fileBadge.textContent = typeLabel;
    }

    // Configurar textarea y sincronización
    const textarea = document.getElementById('pv-editor-textarea');
    const lineNums = document.getElementById('pv-editor-line-numbers');

    if (textarea) {
      textarea.value = originalContent;
      updateEditorStats(originalContent);
      updateLineNumbers(originalContent);

      // Sincronizar scroll con números de línea
      textarea.onscroll = () => {
        if (lineNums) lineNums.scrollTop = textarea.scrollTop;
      };

      // Manejo de tabulación suave (4 espacios) y atajos
      textarea.onkeydown = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          saveCurrentEdit();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 4;
          textarea.dispatchEvent(new Event('input'));
        }
      };

      // Detección de cambios y vista previa en vivo
      textarea.oninput = () => {
        const val = textarea.value;
        setEditorDirty(val !== originalContent);
        updateEditorStats(val);
        updateLineNumbers(val);

        if (result.type === 'markdown' || result.type === 'html') {
          clearTimeout(livePreviewTimer);
          livePreviewTimer = setTimeout(() => {
            updateLivePreview(val, result.type);
          }, 100);
        }
      };
    }

    // Configuración de vista previa en vivo
    if (result.type === 'markdown' || result.type === 'html') {
      applyEditorLayout(editorLayout, result.type);
      updateLivePreview(originalContent, result.type);
    } else {
      applyEditorLayout('edit', result.type);
    }

    // Eventos de toggles de layout dividido
    const btnSplit = document.getElementById('pv-editor-btn-layout-split');
    const btnEditOnly = document.getElementById('pv-editor-btn-layout-edit');
    if (btnSplit) {
      btnSplit.onclick = () => applyEditorLayout('split', result.type);
    }
    if (btnEditOnly) {
      btnEditOnly.onclick = () => applyEditorLayout('edit', result.type);
    }

    showOnly('pv-editor');

    if (textarea) {
      textarea.focus();
    }
  }

  async function saveCurrentEdit() {
    if (!currentNode || !currentFileResult) return;
    const textarea = document.getElementById('pv-editor-textarea');
    if (!textarea) return;

    const newContent = textarea.value;
    const saveBtn = document.getElementById(IDS.btnSave);
    if (saveBtn) saveBtn.disabled = true;

    try {
      if (pyApi && pyApi.save_file_content) {
        const res = await pyApi.save_file_content(currentNode.path, newContent);
        if (res.success) {
          originalContent = newContent;
          currentFileResult.content = newContent;
          if (res.size !== undefined) currentFileResult.size = res.size;
          setEditorDirty(false);
          showToast('Archivo guardado correctamente');

          // Actualizar metadata de tamaño en barra de herramientas
          const ext = currentFileResult.extension ? currentFileResult.extension.toUpperCase() : '';
          const sizeStr = currentFileResult.size ? formatSize(currentFileResult.size) : '';
          const metaEl = document.getElementById(IDS.meta);
          if (metaEl) {
            metaEl.textContent = [ext, sizeStr].filter(Boolean).join(' · ');
          }

          // Transicionar de inmediato a la vista renderizada del documento
          exitEditMode();
        } else {
          showToast(res.message || 'Error al guardar archivo');
        }
      }
    } catch (err) {
      console.error('Error guardando archivo:', err);
      showToast('Ocurrió un error al intentar guardar');
    } finally {
      if (saveBtn) saveBtn.disabled = !isDirty;
    }
  }

  async function cancelCurrentEdit() {
    if (isDirty) {
      const discard = await CustomDialog.confirm({
        title: 'Descartar cambios',
        message: '¿Deseas descartar los cambios realizados?',
        confirmText: 'Descartar',
        cancelText: 'Continuar editando',
        badgeText: 'AVISO',
        icon: '⚠️',
        isDanger: true
      });
      if (!discard) return;
    }

    exitEditMode();
  }

  function exitEditMode() {
    isEditing = false;
    setEditorDirty(false);

    // Restaurar botones de toolbar
    const editBtn = document.getElementById(IDS.btnEdit);
    const saveBtn = document.getElementById(IDS.btnSave);
    const cancelBtn = document.getElementById(IDS.btnCancelEdit);
    const toggleHtmlBtn = document.getElementById(IDS.btnToggleHtml);

    if (editBtn) editBtn.style.display = EDITABLE_TYPES.has(currentFileResult?.type) ? 'inline-flex' : 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';

    if (currentFileResult && currentFileResult.type === 'html' && toggleHtmlBtn) {
      toggleHtmlBtn.style.display = 'inline-flex';
    }

    // Volver a renderizar en la vista de lectura habitual
    if (currentFileResult && currentNode) {
      switch (currentFileResult.type) {
        case 'markdown':
          renderMarkdown(currentFileResult);
          showOnly('pv-markdown');
          break;
        case 'code':
          renderCode(currentFileResult);
          showOnly('pv-code');
          break;
        case 'html':
          renderHtml(currentFileResult);
          showOnly('pv-html');
          break;
        case 'text':
          renderText(currentFileResult);
          showOnly('pv-text');
          break;
        default:
          showOnly('pv-text');
          break;
      }
    } else {
      showOnly('pv-empty');
    }
  }

  async function renderPdf(result) {
    initPdfJs();
    setupPdfEvents();
    showOnly('pv-pdf');
    try {
      const raw = atob(result.content);
      const uint8Array = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        uint8Array[i] = raw.charCodeAt(i);
      }
      pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      pdfPageNum = 1;
      pdfScale = 1.2;
      renderPdfPage(pdfPageNum);
    } catch (e) {
      console.error("Error al renderizar PDF:", e);
      renderNone(currentNode, { message: "No se pudo renderizar el PDF: " + e.message });
    }
  }

  function renderDocx(result) {
    document.getElementById('pv-docx-content').innerHTML = result.html || '<p>Documento vacío</p>';
    showOnly('pv-docx');
  }

  function renderExcel(result) {
    const tabs = document.getElementById('pv-excel-tabs');
    const grid = document.getElementById('pv-excel-grid');
    const search = document.getElementById('pv-excel-search');
    tabs.innerHTML = '';
    search.value = '';

    if (!result.sheets || !result.sheets.length) {
      grid.innerHTML = '<div class="tree-msg" style="padding:20px;">Hoja de cálculo vacía</div>';
      showOnly('pv-excel');
      return;
    }

    function renderSheet(sheetIdx) {
      const sheet = result.sheets[sheetIdx];
      tabs.querySelectorAll('.pv-excel-tab').forEach((b, idx) => {
        b.classList.toggle('active', idx === sheetIdx);
      });

      if (!sheet.rows || !sheet.rows.length) {
        grid.innerHTML = '<div class="tree-msg" style="padding:20px;">Hoja sin datos</div>';
        return;
      }

      let maxCols = 0;
      sheet.rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });

      let theadHtml = '<tr><th class="pv-excel-row-num">#</th>';
      for (let c = 0; c < maxCols; c++) {
        let colLetter = '';
        let num = c;
        while (num >= 0) {
          colLetter = String.fromCharCode(65 + (num % 26)) + colLetter;
          num = Math.floor(num / 26) - 1;
        }
        theadHtml += `<th>${colLetter}</th>`;
      }
      theadHtml += '</tr>';

      let tbodyHtml = '';
      sheet.rows.forEach((row, rIdx) => {
        tbodyHtml += `<tr class="excel-row"><td class="pv-excel-row-num">${rIdx + 1}</td>`;
        for (let c = 0; c < maxCols; c++) {
          const val = row[c] !== undefined ? row[c] : '';
          tbodyHtml += `<td>${val}</td>`;
        }
        tbodyHtml += '</tr>';
      });

      grid.innerHTML = `<table class="pv-excel-table"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>`;
    }

    result.sheets.forEach((sheet, idx) => {
      const btn = document.createElement('button');
      btn.className = 'pv-excel-tab' + (idx === 0 ? ' active' : '');
      btn.textContent = sheet.name;
      btn.onclick = () => renderSheet(idx);
      tabs.appendChild(btn);
    });

    search.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const rows = grid.querySelectorAll('.excel-row');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    };

    renderSheet(0);
    showOnly('pv-excel');
  }

  let pptxCurrentIndex = 0;
  let pptxSlides = [];
  let pptxShowSlideFn = null;

  function renderPptx(result) {
    pptxSlides = result.slides || [];
    pptxCurrentIndex = 0;
    const countEl = document.getElementById('pptx-count');
    const numEl = document.getElementById('pptx-num');
    const listEl = document.getElementById('pptx-sidebar-list');
    const prevBtn = document.getElementById('pptx-prev');
    const nextBtn = document.getElementById('pptx-next');
    const toggleListBtn = document.getElementById('pptx-toggle-list');
    const fsBtn = document.getElementById('pptx-btn-fullscreen');

    countEl.textContent = pptxSlides.length;
    listEl.innerHTML = '';
    listEl.style.display = 'flex';
    if (toggleListBtn) toggleListBtn.classList.add('active');

    pptxSlides.forEach((slide, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'pptx-thumb-item' + (idx === 0 ? ' active' : '');
      if (slide.image) {
        thumb.innerHTML = `
          <div class="pptx-thumb-preview">
            <img src="${slide.image}" class="pptx-thumb-img" alt="Pág. ${idx + 1}" loading="lazy">
          </div>
          <div class="pptx-thumb-title">Pág. ${idx + 1}</div>
        `;
      } else {
        thumb.innerHTML = `<div class="pptx-thumb-title">Pág. ${idx + 1}: ${slide.title || 'Diapositiva ' + (idx + 1)}</div>`;
      }
      thumb.onclick = () => showSlide(idx);
      listEl.appendChild(thumb);
    });

    if (toggleListBtn) {
      toggleListBtn.onclick = () => {
        const isHidden = listEl.style.display === 'none';
        listEl.style.display = isHidden ? 'flex' : 'none';
        toggleListBtn.classList.toggle('active', isHidden);
      };
    }

    if (fsBtn) {
      fsBtn.onclick = () => {
        const canvas = document.getElementById('pptx-slide-canvas');
        if (!document.fullscreenElement) {
          if (canvas.requestFullscreen) canvas.requestFullscreen();
          else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      };
    }

    prevBtn.onclick = () => {
      if (pptxCurrentIndex > 0) showSlide(pptxCurrentIndex - 1);
    };
    nextBtn.onclick = () => {
      if (pptxCurrentIndex < pptxSlides.length - 1) showSlide(pptxCurrentIndex + 1);
    };

    function showSlide(idx) {
      if (!pptxSlides.length) return;
      pptxCurrentIndex = idx;
      numEl.textContent = idx + 1;
      prevBtn.disabled = (idx === 0);
      nextBtn.disabled = (idx >= pptxSlides.length - 1);

      const thumbs = listEl.querySelectorAll('.pptx-thumb-item');
      thumbs.forEach((item, i) => {
        const isActive = (i === idx);
        item.classList.toggle('active', isActive);
        if (isActive) {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      const slide = pptxSlides[idx];
      const canvas = document.getElementById('pptx-slide-canvas');

      if (slide.image) {
        canvas.innerHTML = `
          <div class="pptx-visual-frame">
            <img src="${slide.image}" class="pptx-visual-img" alt="Diapositiva ${idx + 1}">
          </div>
        `;
      } else {
        let paragraphsHtml = '';
        if (slide.paragraphs && slide.paragraphs.length) {
          paragraphsHtml = slide.paragraphs.map(p => {
            const lvlClass = p.level > 0 ? ` pptx-p-level-${Math.min(p.level, 2)}` : '';
            return `<div class="pptx-p-item${lvlClass}">• ${p.text}</div>`;
          }).join('');
        }

        let tablesHtml = '';
        if (slide.tables && slide.tables.length) {
          tablesHtml = slide.tables.map(tbl => {
            const rows = tbl.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('');
            return `<table style="border-collapse:collapse;width:100%;margin:10px 0;">${rows}</table>`;
          }).join('');
        }

        let imagesHtml = '';
        if (slide.images && slide.images.length) {
          imagesHtml = `<div class="pptx-card-images">${slide.images.map(imgSrc => `<img src="${imgSrc}" class="pptx-card-img" alt="Diapositiva">`).join('')}</div>`;
        }

        canvas.innerHTML = `
          <div class="pptx-slide-card">
            <div class="pptx-card-title">${slide.title || 'Diapositiva ' + (idx + 1)}</div>
            <div class="pptx-card-body">
              ${paragraphsHtml}
              ${tablesHtml}
              ${imagesHtml}
            </div>
          </div>
        `;
      }
    }

    pptxShowSlideFn = showSlide;

    if (!window._pptxKeyBound) {
      window._pptxKeyBound = true;
      window.addEventListener('keydown', (e) => {
        const pptxPanel = document.getElementById('pv-pptx');
        if (!pptxPanel || pptxPanel.style.display === 'none') return;
        // Evitar interceptar si el usuario está escribiendo en un input
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          if (pptxShowSlideFn && pptxCurrentIndex < pptxSlides.length - 1) {
            pptxShowSlideFn(pptxCurrentIndex + 1);
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          if (pptxShowSlideFn && pptxCurrentIndex > 0) {
            pptxShowSlideFn(pptxCurrentIndex - 1);
          }
        } else if (e.key === 'Home') {
          e.preventDefault();
          if (pptxShowSlideFn) pptxShowSlideFn(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          if (pptxShowSlideFn) pptxShowSlideFn(pptxSlides.length - 1);
        }
      });
    }

    showSlide(0);
    showOnly('pv-pptx');
  }

  function renderArchive(result) {
    const summary = document.getElementById('pv-archive-summary');
    const tbody = document.getElementById('pv-archive-tbody');
    const filter = document.getElementById('pv-archive-filter');
    filter.value = '';

    summary.textContent = `${result.total_files} archivos · Descomprimido: ${result.total_uncompressed_fmt} · Comprimido: ${result.total_compressed_fmt}`;

    function renderRows(items) {
      tbody.innerHTML = '';
      items.forEach(e => {
        const tr = document.createElement('tr');
        const icon = e.is_dir ? '📁' : '📄';
        tr.className = 'archive-row';
        tr.innerHTML = `
          <td><span style="margin-right:6px;">${icon}</span>${e.name}</td>
          <td>${e.size_fmt}</td>
          <td>${e.compressed_fmt}</td>
          <td><span class="badge-ratio">${e.ratio}</span></td>
          <td style="color:var(--text-3);">${e.date}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    renderRows(result.entries || []);

    filter.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = (result.entries || []).filter(item => !q || item.name.toLowerCase().includes(q));
      renderRows(filtered);
    };

    showOnly('pv-archive');
  }

  function formatAudioTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function setupAudioPlayerEvents() {
    const audioEl = document.getElementById('pv-audio-el');
    if (!audioEl || audioEl.dataset.customBound) return;
    audioEl.dataset.customBound = 'true';

    const btnToggle = document.getElementById('pv-audio-btn-toggle');
    const iconPlay = document.getElementById('pv-audio-icon-play');
    const iconPause = document.getElementById('pv-audio-icon-pause');
    const discWrap = document.getElementById('pv-audio-disc-wrap');

    const progressBar = document.getElementById('pv-audio-progress-bar');
    const progressFill = document.getElementById('pv-audio-progress-fill');
    const progressHandle = document.getElementById('pv-audio-progress-handle');
    const currentTimeEl = document.getElementById('pv-audio-current-time');
    const durationEl = document.getElementById('pv-audio-duration');

    const btnBackward = document.getElementById('pv-audio-btn-backward');
    const btnForward = document.getElementById('pv-audio-btn-forward');
    const btnMute = document.getElementById('pv-audio-btn-mute');
    const iconVol = document.getElementById('pv-audio-icon-vol');
    const iconMuted = document.getElementById('pv-audio-icon-muted');
    const volumeSlider = document.getElementById('pv-audio-volume-slider');

    function updatePlayState(isPlaying) {
      if (iconPlay) iconPlay.style.display = isPlaying ? 'none' : 'block';
      if (iconPause) iconPause.style.display = isPlaying ? 'block' : 'none';
      if (discWrap) {
        if (isPlaying) discWrap.classList.add('playing');
        else discWrap.classList.remove('playing');
      }
    }

    if (btnToggle) {
      btnToggle.onclick = () => {
        if (audioEl.paused) {
          audioEl.play().catch(() => {});
        } else {
          audioEl.pause();
        }
      };
    }

    audioEl.addEventListener('play', () => updatePlayState(true));
    audioEl.addEventListener('pause', () => updatePlayState(false));
    audioEl.addEventListener('ended', () => {
      updatePlayState(false);
      if (progressFill) progressFill.style.width = '0%';
      if (progressHandle) progressHandle.style.left = '0%';
      if (currentTimeEl) currentTimeEl.textContent = '0:00';
    });

    audioEl.addEventListener('loadedmetadata', () => {
      if (durationEl) durationEl.textContent = formatAudioTime(audioEl.duration);
      if (currentTimeEl) currentTimeEl.textContent = formatAudioTime(audioEl.currentTime);
      if (progressFill) progressFill.style.width = '0%';
      if (progressHandle) progressHandle.style.left = '0%';
    });

    audioEl.addEventListener('timeupdate', () => {
      if (currentTimeEl) currentTimeEl.textContent = formatAudioTime(audioEl.currentTime);
      if (audioEl.duration && audioEl.duration > 0) {
        const pct = Math.min(100, Math.max(0, (audioEl.currentTime / audioEl.duration) * 100));
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressHandle) progressHandle.style.left = `${pct}%`;
      }
    });

    if (btnBackward) {
      btnBackward.onclick = () => {
        audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
      };
    }

    if (btnForward) {
      btnForward.onclick = () => {
        audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 5);
      };
    }

    // Scrubbing en la barra de progreso
    if (progressBar) {
      let isSeeking = false;

      const seek = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (audioEl.duration) {
          audioEl.currentTime = pos * audioEl.duration;
        }
      };

      progressBar.addEventListener('mousedown', (e) => {
        isSeeking = true;
        seek(e);
      });

      window.addEventListener('mousemove', (e) => {
        if (isSeeking) seek(e);
      });

      window.addEventListener('mouseup', () => {
        isSeeking = false;
      });
    }

    // Volumen y Mute
    let lastVolume = 1;
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audioEl.volume = val;
        audioEl.muted = (val === 0);
        updateVolumeIcons();
      });
    }

    function updateVolumeIcons() {
      const isMuted = audioEl.muted || audioEl.volume === 0;
      if (iconVol) iconVol.style.display = isMuted ? 'none' : 'block';
      if (iconMuted) iconMuted.style.display = isMuted ? 'block' : 'none';
      if (volumeSlider) volumeSlider.value = isMuted ? 0 : audioEl.volume;
    }

    if (btnMute) {
      btnMute.onclick = () => {
        if (audioEl.muted || audioEl.volume === 0) {
          audioEl.muted = false;
          audioEl.volume = lastVolume > 0 ? lastVolume : 0.8;
        } else {
          lastVolume = audioEl.volume;
          audioEl.muted = true;
        }
        updateVolumeIcons();
      };
    }
  }

  function renderAudio(result, node) {
    document.getElementById('pv-audio-title').textContent = node.name;
    const subEl = document.getElementById('pv-audio-subtitle');
    if (subEl) {
      const ext = node.extension ? node.extension.toUpperCase() : 'AUDIO';
      const sizeStr = node.size ? formatSize(node.size) : '';
      subEl.textContent = [ext, sizeStr].filter(Boolean).join(' · ');
    }

    setupAudioPlayerEvents();

    const audioEl = document.getElementById('pv-audio-el');
    audioEl.src = result.data_url;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
    showOnly('pv-audio');
  }

  function renderVideo(result) {
    const videoEl = document.getElementById('pv-video-el');
    videoEl.src = result.data_url;
    videoEl.play().catch(() => {});
    showOnly('pv-video');
  }

  function renderNotebook(result) {
    const container = document.getElementById('pv-notebook-content');
    container.innerHTML = '';

    (result.cells || []).forEach((cell, idx) => {
      if (cell.type === 'markdown') {
        const div = document.createElement('div');
        div.className = 'nb-cell nb-markdown-cell markdown-body';
        div.id = `nb-cell-${idx + 1}`;
        div.innerHTML = parseMarkdownToHtml(cell.source || '');
        container.appendChild(div);
      } else if (cell.type === 'code') {
        const div = document.createElement('div');
        div.className = 'nb-cell';
        div.id = `nb-cell-${idx + 1}`;

        let outputsHtml = '';
        (cell.outputs || []).forEach(out => {
          if (out.type === 'text') {
            outputsHtml += `<div class="nb-output">${out.content}</div>`;
          } else if (out.type === 'image') {
            outputsHtml += `<div class="nb-output"><img src="${out.content}" class="nb-output-img" alt="Salida"></div>`;
          } else if (out.type === 'error') {
            outputsHtml += `<div class="nb-output" style="color:#ef4444;background:#1a0808;">${out.content}</div>`;
          }
        });

        div.innerHTML = `
          <div class="nb-code-prompt">In [${idx + 1}]:</div>
          <pre><code class="language-python">${cell.source || ''}</code></pre>
          ${outputsHtml}
        `;

        if (window.hljs) {
          const codeEl = div.querySelector('code');
          if (codeEl) hljs.highlightElement(codeEl);
        }

        container.appendChild(div);
      }
    });

    showOnly('pv-notebook');
  }

  function renderNone(node, result) {
    const msg = result.message || 'Vista previa no disponible para este tipo de archivo.';
    document.getElementById(IDS.noneMsg).textContent = msg;
    document.getElementById(IDS.noneOpen).onclick = () => pyApi && pyApi.open_file(node.path);
    showOnly('pv-none');
  }

  // ── Función pública: cargar vista previa ────────────────────────────────────
  async function load(node) {
    currentNode = node;

    if (node.is_dir) {
      if (typeof FolderView !== 'undefined' && FolderView.navigateTo) {
        await FolderView.navigateTo(node.path);
      }
      return;
    }

    const fvPanel = document.getElementById('folder-view-panel');
    if (fvPanel) fvPanel.style.display = 'none';
    const pvBody = document.getElementById('preview-body');
    if (pvBody) pvBody.style.display = 'block';

    document.getElementById(IDS.toolbar).style.display = 'none';
    showOnly('pv-loading');

    const result = await pyApi.read_file(node.path);
    updateToolbar(node, result);
    if (typeof FileTree !== 'undefined' && FileTree.revealAndExpand) {
      FileTree.revealAndExpand(node.path, false);
    }
    if (typeof FavoritesManager !== 'undefined' && FavoritesManager.render) {
      FavoritesManager.render();
    }

    switch (result.type) {
      case 'pdf':      await renderPdf(result);         break;
      case 'docx':     renderDocx(result);              break;
      case 'excel':    renderExcel(result);             break;
      case 'pptx':     renderPptx(result);              break;
      case 'archive':  renderArchive(result);           break;
      case 'audio':    renderAudio(result, node);       break;
      case 'video':    renderVideo(result);             break;
      case 'notebook': renderNotebook(result);          break;
      case 'image':    renderImage(result);             break;
      case 'markdown': renderMarkdown(result);          break;
      case 'html':     renderHtml(result);              break;
      case 'code':     renderCode(result);              break;
      case 'text':     renderText(result);              break;
      default:         renderNone(node, result);        break;
    }
  }

  function clear() {
    if (isEditing) {
      exitEditMode();
    }
    isEditing = false;
    currentFileResult = null;
    originalContent = '';
    setEditorDirty(false);
    currentNode = null;
    if (typeof FavoritesManager !== 'undefined' && FavoritesManager.render) {
      FavoritesManager.render();
    }
    pdfDoc = null;
    const audioEl = document.getElementById('pv-audio-el');
    if (audioEl) { audioEl.pause(); audioEl.src = ''; }
    const videoEl = document.getElementById('pv-video-el');
    if (videoEl) { videoEl.pause(); videoEl.src = ''; }
    const htmlIframe = document.getElementById('pv-html-iframe');
    if (htmlIframe) { htmlIframe.srcdoc = ''; }
    const pvBody = document.getElementById('preview-body');
    if (pvBody) pvBody.style.display = 'none';
    const tb = document.getElementById(IDS.toolbar);
    if (tb) tb.style.display = 'none';
    const toggleHtmlBtn = document.getElementById(IDS.btnToggleHtml);
    if (toggleHtmlBtn) toggleHtmlBtn.style.display = 'none';
    const fvPanel = document.getElementById('folder-view-panel');
    if (fvPanel) fvPanel.style.display = 'flex';
  }

  function setupAnchorNavigation() {
    function scrollToTarget(container, targetEl) {
      if (!targetEl) return;
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Si el contenedor tiene margen superior o scroll bar propio
        if (container && container.scrollTop > 24) {
          container.scrollBy({ top: -16, behavior: 'smooth' });
        }
      } catch (err) {
        try {
          const containerRect = container.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          const offsetTop = targetRect.top - containerRect.top + container.scrollTop - 24;
          container.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
        } catch (e2) {
          targetEl.scrollIntoView();
        }
      }

      // Animación de resalte visual temporal para confirmar al usuario el salto
      try {
        targetEl.classList.remove('heading-anchor-target');
        void targetEl.offsetWidth; // Reiniciar animación
        targetEl.classList.add('heading-anchor-target');
        setTimeout(() => {
          targetEl.classList.remove('heading-anchor-target');
        }, 1800);
      } catch (e) {}
    }

    function findTargetElement(container, href, anchorEl) {
      if (!container || !href) return null;

      const hashIdx = href.indexOf('#');
      if (hashIdx === -1) return null;

      // Si el enlace tiene algo antes del '#', verificar si apunta al documento actual o es relativo
      const prefix = href.slice(0, hashIdx).trim().toLowerCase();
      if (prefix && prefix !== '.' && prefix !== './') {
        const curName = (currentNode && currentNode.name ? currentNode.name.toLowerCase() : '');
        if (curName && !prefix.endsWith(curName)) {
          return null; // Enlace a otro archivo distinto
        }
      }

      const rawTarget = href.slice(hashIdx + 1).trim();
      if (!rawTarget) return null;

      const decodedTarget = decodeURIComponent(rawTarget).trim();
      const slugTarget = generateHeadingSlug(decodedTarget);
      const normTarget = normalizeTextForComparison(decodedTarget);

      const anchorText = anchorEl ? anchorEl.textContent.trim() : '';
      const slugAnchorText = generateHeadingSlug(anchorText);
      const normAnchorText = normalizeTextForComparison(anchorText);

      // 1. Búsqueda por ID exacto decodificado o ID original
      try {
        let el = container.querySelector('#' + CSS.escape(decodedTarget)) ||
                 container.querySelector('#' + CSS.escape(rawTarget));
        if (el) return el;
      } catch (e) {}

      let globalEl = document.getElementById(decodedTarget) || document.getElementById(rawTarget);
      if (globalEl && container.contains(globalEl)) return globalEl;

      // 2. Búsqueda por atributo name (compatibilidad <a name="...">)
      try {
        let el = container.querySelector(`[name="${CSS.escape(decodedTarget)}"]`) ||
                 container.querySelector(`[name="${CSS.escape(rawTarget)}"]`);
        if (el) return el;
      } catch (e) {}

      // 3. Búsqueda por data-heading-slug o ID calculado mediante generateHeadingSlug
      if (slugTarget) {
        try {
          let el = container.querySelector(`[data-heading-slug="${CSS.escape(slugTarget)}"]`);
          if (el) return el;
        } catch (e) {}
        let elSlug = document.getElementById(slugTarget);
        if (elSlug && container.contains(elSlug)) return elSlug;
      }

      // 4. Búsqueda por data-norm-text usando el destino del href
      if (normTarget) {
        try {
          let el = container.querySelector(`[data-norm-text="${CSS.escape(normTarget)}"]`);
          if (el) return el;
        } catch (e) {}
      }

      // 5. Búsqueda por texto visible del enlace (fundamental para apuntes con índice traducido o slug desalineado)
      if (normAnchorText) {
        try {
          let el = container.querySelector(`[data-norm-text="${CSS.escape(normAnchorText)}"]`);
          if (el) return el;
        } catch (e) {}
      }
      if (slugAnchorText) {
        try {
          let el = container.querySelector(`[data-heading-slug="${CSS.escape(slugAnchorText)}"]`);
          if (el) return el;
        } catch (e) {}
      }

      // 6. Recorrido exhaustivo y coincidencia difusa sobre todos los encabezados del contenedor
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, .nb-cell');
      for (const h of headings) {
        const hSlug = h.getAttribute('data-heading-slug') || generateHeadingSlug(h.textContent);
        const hNorm = h.getAttribute('data-norm-text') || normalizeTextForComparison(h.textContent);

        // Coincidencia exacta con slug o texto normalizado
        if (slugTarget && hSlug === slugTarget) return h;
        if (normTarget && hNorm === normTarget) return h;
        if (slugAnchorText && hSlug === slugAnchorText) return h;
        if (normAnchorText && hNorm === normAnchorText) return h;

        // Coincidencia difusa de inclusión (si la longitud es significativa)
        if (normTarget && normTarget.length >= 4 && (hNorm.includes(normTarget) || normTarget.includes(hNorm))) {
          return h;
        }
        if (normAnchorText && normAnchorText.length >= 4 && (hNorm.includes(normAnchorText) || normAnchorText.includes(hNorm))) {
          return h;
        }
        if (slugTarget && slugTarget.length >= 4 && (hSlug.includes(slugTarget) || slugTarget.includes(hSlug))) {
          return h;
        }
      }

      return null;
    }

    // Interceptar clics en enlaces ancla dentro del visor de vista previa
    const pvBody = document.getElementById('preview-body');
    if (pvBody) {
      pvBody.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || !href.includes('#')) return;

        const targetEl = findTargetElement(pvBody, href, anchor);
        if (targetEl) {
          e.preventDefault();
          e.stopPropagation();
          scrollToTarget(pvBody, targetEl);
        }
      });
    }

    // Soporte para vista previa dividida en el editor interactivo
    const editorPreviewPane = document.getElementById('pv-editor-pane-preview');
    if (editorPreviewPane) {
      editorPreviewPane.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || !href.includes('#')) return;

        const targetEl = findTargetElement(editorPreviewPane, href, anchor);
        if (targetEl) {
          e.preventDefault();
          e.stopPropagation();
          scrollToTarget(editorPreviewPane, targetEl);
        }
      });
    }
  }

  function setupTaskCheckboxes() {
    async function handleCheckboxToggle(e) {
      const checkbox = e.target.closest('.task-checkbox');
      if (!checkbox) return;

      const isChecked = checkbox.checked;
      const taskIndex = parseInt(checkbox.dataset.taskIndex, 10);
      if (isNaN(taskIndex)) return;

      // Actualizar estilo visual del <li> padre
      const li = checkbox.closest('.task-list-item');
      if (li) {
        li.classList.toggle('is-completed', isChecked);
      }

      // Si el archivo activo es Markdown (.md o .markdown), persistir automáticamente en disco
      if (currentNode && (currentNode.name.endsWith('.md') || currentNode.name.endsWith('.markdown'))) {
        const rawContent = (currentFileResult && currentFileResult.content) || originalContent || '';
        if (!rawContent) return;

        // Reemplazar la enésima aparición de [ ] o [x] en el markdown original
        const taskRegex = /(^|\n)([ \t]*[-*+][ \t]+\[)([ xX])(\][ \t]+)/g;
        let matchCount = 0;
        let replaced = false;

        const updatedContent = rawContent.replace(taskRegex, (match, prefix, openBracket, currentMark, closeBracket) => {
          if (matchCount === taskIndex) {
            replaced = true;
            matchCount++;
            const newMark = isChecked ? 'x' : ' ';
            return `${prefix}${openBracket}${newMark}${closeBracket}`;
          }
          matchCount++;
          return match;
        });

        if (replaced && updatedContent !== rawContent) {
          try {
            if (pyApi && pyApi.save_file_content) {
              const res = await pyApi.save_file_content(currentNode.path, updatedContent);
              if (res.success) {
                originalContent = updatedContent;
                if (currentFileResult) {
                  currentFileResult.content = updatedContent;
                  if (res.size !== undefined) currentFileResult.size = res.size;
                }
                const textarea = document.getElementById(IDS.editorTextarea);
                if (textarea && textarea.value) {
                  textarea.value = updatedContent;
                }
                showToast(isChecked ? 'Criterio completado' : 'Criterio desmarcado');
              } else {
                showToast('Error al guardar cambio en disco');
              }
            }
          } catch (err) {
            console.error('Error al persistir checklist:', err);
          }
        }
      }
    }

    const pvBody = document.getElementById('preview-body');
    if (pvBody) {
      pvBody.addEventListener('change', handleCheckboxToggle);
    }

    const editorPreviewPane = document.getElementById('pv-editor-pane-preview');
    if (editorPreviewPane) {
      editorPreviewPane.addEventListener('change', handleCheckboxToggle);
    }
  }

  return {
    load,
    clear,
    setupAnchorNavigation,
    setupTaskCheckboxes,
    isVisible: () => {
      const pvBody = document.getElementById('preview-body');
      return pvBody && pvBody.style.display === 'block';
    },
    isEditing: () => isEditing,
    saveCurrentEdit,
    cancelCurrentEdit
  };
})();
