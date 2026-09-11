// ════════════════════════════════════════════════════════════════════════════
// CUADRO DE DIÁLOGO MODAL INTERACTIVO (Input / Prompt y Confirm)
// ════════════════════════════════════════════════════════════════════════════

const CustomDialog = (() => {
  let modalEl = null;
  let iconWrapEl = null;
  let iconEl = null;
  let badgeEl = null;
  let titleEl = null;
  let subtitleEl = null;
  let messageEl = null;
  let inputGroupEl = null;
  let labelEl = null;
  let inputEl = null;
  let errorEl = null;
  let btnCancel = null;
  let btnConfirm = null;
  let btnClose = null;
  let confirmTextEl = null;

  let resolvePromise = null;
  let isPromptMode = true;
  let isSubmitting = false;

  function initElements() {
    if (modalEl) return;
    modalEl = document.getElementById('modal-custom-dialog');
    if (!modalEl) return;

    iconWrapEl = document.getElementById('mcd-icon-wrap');
    iconEl = document.getElementById('mcd-icon');
    badgeEl = document.getElementById('mcd-badge');
    titleEl = document.getElementById('mcd-title');
    subtitleEl = document.getElementById('mcd-subtitle');
    messageEl = document.getElementById('mcd-message');
    inputGroupEl = document.getElementById('mcd-input-group');
    labelEl = document.getElementById('mcd-label');
    inputEl = document.getElementById('mcd-input');
    errorEl = document.getElementById('mcd-error-msg');
    btnCancel = document.getElementById('mcd-btn-cancel');
    btnConfirm = document.getElementById('mcd-btn-confirm');
    btnClose = document.getElementById('mcd-btn-close');
    confirmTextEl = document.getElementById('mcd-confirm-text');

    if (btnClose) btnClose.addEventListener('click', () => cancel());
    if (btnCancel) btnCancel.addEventListener('click', () => cancel());
    if (btnConfirm) btnConfirm.addEventListener('click', () => confirm());

    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      });

      inputEl.addEventListener('input', () => {
        validateInput();
      });
    }

    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          cancel();
        }
      });
    }
  }

  function isOpen() {
    return !!(modalEl && modalEl.style.display === 'flex');
  }

  function validateInput() {
    if (!isPromptMode || !inputEl) return true;
    const val = inputEl.value;
    const invalidChars = /[\\/:*?"<>|]/;
    if (invalidChars.test(val)) {
      if (errorEl) {
        errorEl.textContent = 'El nombre no puede contener: \\ / : * ? " < > |';
        errorEl.style.display = 'block';
      }
      inputEl.classList.add('input-invalid');
      if (btnConfirm) btnConfirm.disabled = true;
      return false;
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
    inputEl.classList.remove('input-invalid');
    if (btnConfirm) btnConfirm.disabled = false;
    return true;
  }

  function prompt({
    title = 'Nuevo elemento',
    subtitle = '',
    label = 'Nombre:',
    defaultValue = '',
    placeholder = '',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    badgeText = '',
    icon = '📁',
    selectBaseNameOnly = false
  } = {}) {
    initElements();
    if (!modalEl) return Promise.resolve(null);

    return new Promise((resolve) => {
      resolvePromise = resolve;
      isPromptMode = true;
      isSubmitting = false;

      if (titleEl) titleEl.textContent = title;
      if (subtitleEl) {
        if (subtitle) {
          subtitleEl.textContent = subtitle;
          subtitleEl.style.display = 'block';
        } else {
          subtitleEl.style.display = 'none';
        }
      }

      if (badgeEl) {
        if (badgeText) {
          badgeEl.textContent = badgeText;
          badgeEl.style.display = 'inline-block';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      if (iconEl) iconEl.textContent = icon;
      if (iconWrapEl) iconWrapEl.classList.remove('is-danger');

      if (messageEl) messageEl.style.display = 'none';
      if (inputGroupEl) inputGroupEl.style.display = 'flex';
      if (labelEl) labelEl.textContent = label;

      if (inputEl) {
        inputEl.placeholder = placeholder || '';
        inputEl.value = defaultValue || '';
        inputEl.classList.remove('input-invalid');
      }

      if (confirmTextEl) confirmTextEl.textContent = confirmText;
      if (btnConfirm) {
        btnConfirm.className = 'btn-primary';
        btnConfirm.disabled = false;
      }
      if (btnCancel) btnCancel.textContent = cancelText;

      validateInput();

      modalEl.style.display = 'flex';

      setTimeout(() => {
        if (inputEl) {
          inputEl.focus();
          if (defaultValue) {
            if (selectBaseNameOnly) {
              const lastDot = defaultValue.lastIndexOf('.');
              if (lastDot > 0) {
                inputEl.setSelectionRange(0, lastDot);
              } else {
                inputEl.select();
              }
            } else {
              inputEl.select();
            }
          }
        }
      }, 40);
    });
  }

  function confirmDialog({
    title = 'Confirmación',
    message = '¿Deseas continuar con esta acción?',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    badgeText = 'CONFIRMAR',
    icon = '⚠️',
    isDanger = false
  } = {}) {
    initElements();
    if (!modalEl) return Promise.resolve(false);

    return new Promise((resolve) => {
      resolvePromise = resolve;
      isPromptMode = false;
      isSubmitting = false;

      if (titleEl) titleEl.textContent = title;
      if (subtitleEl) subtitleEl.style.display = 'none';

      if (badgeEl) {
        if (badgeText) {
          badgeEl.textContent = badgeText;
          badgeEl.style.display = 'inline-block';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      if (iconEl) iconEl.textContent = icon;
      if (iconWrapEl) {
        if (isDanger) iconWrapEl.classList.add('is-danger');
        else iconWrapEl.classList.remove('is-danger');
      }

      if (messageEl) {
        messageEl.textContent = message;
        messageEl.style.display = 'block';
      }
      if (inputGroupEl) inputGroupEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';

      if (confirmTextEl) confirmTextEl.textContent = confirmText;
      if (btnConfirm) {
        btnConfirm.className = isDanger ? 'btn-primary btn-danger' : 'btn-primary';
        btnConfirm.disabled = false;
      }
      if (btnCancel) btnCancel.textContent = cancelText;

      modalEl.style.display = 'flex';

      setTimeout(() => {
        if (btnConfirm) btnConfirm.focus();
      }, 40);
    });
  }

  function confirm() {
    if (isSubmitting) return;
    if (isPromptMode) {
      if (!validateInput()) return;
      const val = inputEl ? inputEl.value : '';
      if (!val || !val.trim()) {
        if (errorEl) {
          errorEl.textContent = 'El nombre no puede estar vacío';
          errorEl.style.display = 'block';
        }
        if (inputEl) inputEl.focus();
        return;
      }
      isSubmitting = true;
      const cb = resolvePromise;
      resolvePromise = null;
      close();
      if (cb) cb(val.trim());
    } else {
      isSubmitting = true;
      const cb = resolvePromise;
      resolvePromise = null;
      close();
      if (cb) cb(true);
    }
  }

  function cancel() {
    if (isSubmitting) return;
    const cb = resolvePromise;
    resolvePromise = null;
    close();
    if (cb) cb(isPromptMode ? null : false);
  }

  function close() {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    if (inputEl) inputEl.value = '';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  return {
    isOpen,
    prompt,
    confirm: confirmDialog,
    close: cancel
  };
})();
