/* =========================================================
   AI FOOD FACTORY — SOUND EFFECTS
   All sounds are synthesised with the Web Audio API,
   so there are no audio files. If audio is unavailable
   the game simply runs silently.
   ========================================================= */
const Sound = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
  }

  function tone(freq, start, dur, type = 'sine', vol = 0.5, slideTo = null) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(start, dur, vol = 0.2, freq = 1200) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + start;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  const sfx = {
    click: () => tone(880, 0, 0.07, 'square', 0.15),
    toggle: () => { tone(660, 0, 0.05, 'square', 0.12); tone(990, 0.04, 0.05, 'square', 0.1); },
    arrive: () => { tone(784, 0, 0.25, 'sine', 0.4); tone(1047, 0.18, 0.4, 'sine', 0.35); },
    startup: () => { tone(110, 0, 0.9, 'sawtooth', 0.12, 440); tone(220, 0.3, 0.7, 'triangle', 0.2, 880); noise(0, 0.6, 0.08, 400); },
    analyze: () => { tone(1200 + Math.random() * 600, 0, 0.05, 'square', 0.08); },
    recipe: () => { tone(523, 0, 0.12, 'triangle', 0.3); tone(659, 0.1, 0.12, 'triangle', 0.3); tone(784, 0.2, 0.25, 'triangle', 0.3); },
    layer: () => { tone(300 + Math.random() * 200, 0, 0.12, 'sawtooth', 0.08, 600); noise(0, 0.15, 0.06, 2500); },
    servo: () => { tone(180, 0, 0.35, 'sawtooth', 0.06, 260); },
    complete: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.35)); },
    whoosh: () => noise(0, 0.45, 0.25, 900),
    happy: () => { tone(660, 0, 0.15, 'sine', 0.35); tone(880, 0.12, 0.25, 'sine', 0.35); },
    sad: () => { tone(400, 0, 0.25, 'sine', 0.3, 300); tone(300, 0.22, 0.35, 'sine', 0.3, 220); },
    money: () => { tone(1319, 0, 0.12, 'square', 0.15); tone(1760, 0.08, 0.3, 'square', 0.15); },
    levelUp: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.3, 'square', 0.15)); },
  };

  return {
    init,
    play(name) {
      try { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); sfx[name] && sfx[name](); } catch (e) { /* audio is optional */ }
    },
    toggle() { enabled = !enabled; return enabled; },
    get enabled() { return enabled; },
  };
})();
