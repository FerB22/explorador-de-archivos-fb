// ════════════════════════════════════════════════════════════════════════════
// SÍNTESIS DE AUDIO PROCEDURAL (Web Audio API autónomo)
// ════════════════════════════════════════════════════════════════════════════

const SoundFX = (() => {
  let ctx = null;
  let enabled = true;

  function getAudioContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  // 1. Crujido y estrujamiento de papel (arrugado procedural)
  function playCrumple() {
    if (!enabled) return;
    const ac = getAudioContext();
    if (!ac) return;

    try {
      const dur = 0.22;
      const bufferSize = Math.floor(ac.sampleRate * dur);
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / ac.sampleRate;
        const crackle = Math.random() > 0.85 ? (Math.random() * 2 - 1) * 1.6 : (Math.random() * 2 - 1) * 0.25;
        data[i] = crackle * Math.exp(-6.5 * t);
      }

      const noise = ac.createBufferSource();
      noise.buffer = buffer;

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, ac.currentTime);
      filter.frequency.exponentialRampToValueAtTime(520, ac.currentTime + dur);
      filter.Q.value = 2.8;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.28, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      noise.start();
    } catch (err) {
      console.warn('Audio playCrumple error:', err);
    }
  }

  // 2. Barrido parabólico de vuelo (whoosh dinámico)
  function playWhoosh() {
    if (!enabled) return;
    const ac = getAudioContext();
    if (!ac) return;

    try {
      const dur = 0.32;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(760, ac.currentTime + 0.12);
      osc.frequency.exponentialRampToValueAtTime(250, ac.currentTime + dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, ac.currentTime);

      gain.gain.setValueAtTime(0.01, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch (err) {
      console.warn('Audio playWhoosh error:', err);
    }
  }

  // 3. Impacto sordo en el fondo de la papelera con microchasquido
  function playImpact() {
    if (!enabled) return;
    const ac = getAudioContext();
    if (!ac) return;

    try {
      const dur = 0.26;
      // Oscilador de golpe bajo
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(125, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(36, ac.currentTime + dur);

      gain.gain.setValueAtTime(0.38, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start();
      osc.stop(ac.currentTime + dur);

      // Microchasquido superficial
      const cDur = 0.04;
      const cBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * cDur), ac.sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let i = 0; i < cData.length; i++) cData[i] = (Math.random() * 2 - 1) * 0.35;
      const click = ac.createBufferSource();
      click.buffer = cBuf;
      const cGain = ac.createGain();
      cGain.gain.setValueAtTime(0.2, ac.currentTime);
      cGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + cDur);
      click.connect(cGain);
      cGain.connect(ac.destination);
      click.start();
    } catch (err) {
      console.warn('Audio playImpact error:', err);
    }
  }

  // 4. Restauración / Reversión (acorde musical ascendente)
  function playUndo() {
    if (!enabled) return;
    const ac = getAudioContext();
    if (!ac) return;

    try {
      const notes = [523.25, 659.25]; // C5, E5
      notes.forEach((freq, idx) => {
        const startTime = ac.currentTime + idx * 0.08;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.28);
      });
    } catch (err) {
      console.warn('Audio playUndo error:', err);
    }
  }

  // 5. Pop sutil para retroalimentación de navegación por gestos
  function playPop() {
    if (!enabled) return;
    const ac = getAudioContext();
    if (!ac) return;

    try {
      const dur = 0.09;
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ac.currentTime + 0.04);
      osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + dur);

      gain.gain.setValueAtTime(0.22, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch (err) {
      console.warn('Audio playPop error:', err);
    }
  }

  function setEnabled(val) {
    enabled = Boolean(val);
    updateUI();
  }

  function toggle() {
    enabled = !enabled;
    updateUI();
    if (pyApi && pyApi.save_sound_setting) {
      pyApi.save_sound_setting(enabled);
    }
    return enabled;
  }

  function updateUI() {
    const onIcon = document.getElementById('sound-icon-on');
    const offIcon = document.getElementById('sound-icon-off');
    const label = document.getElementById('sound-toggle-label');
    if (onIcon && offIcon && label) {
      if (enabled) {
        onIcon.style.display = 'block';
        offIcon.style.display = 'none';
        label.textContent = 'Sonido: ON';
      } else {
        onIcon.style.display = 'none';
        offIcon.style.display = 'block';
        label.textContent = 'Sonido: OFF';
      }
    }
  }

  return {
    playCrumple,
    playWhoosh,
    playImpact,
    playUndo,
    playPop,
    setEnabled,
    toggle,
    isEnabled: () => enabled,
    updateUI
  };
})();
