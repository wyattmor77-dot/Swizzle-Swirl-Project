/* =========================================================
   AI FOOD FACTORY — SOUND & MUSIC
   Everything is synthesised live with the Web Audio API, so
   there are no audio files to load. Three buses (music, SFX,
   ambience) each have their own volume. Looping sounds such
   as the grill sizzle are created ONCE per name and faded in
   and out, so they can never stack up.
   To swap in recorded sounds later, replace the functions in
   SFX / LOOPS below — the rest of the game only calls
   Sound.play(name) and Sound.loop(name, level).
   ========================================================= */
const Sound = (() => {
  let ctx = null;
  let master, musicBus, sfxBus, ambBus, noiseBuf;
  const loops = {};
  const vol = { master: 0.85, music: 0.4, sfx: 0.85, muted: false };
  try { Object.assign(vol, JSON.parse(localStorage.getItem('aff-volume') || '{}')); } catch (e) { /* storage unavailable */ }

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      ambBus = ctx.createGain(); ambBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolume();
    } catch (e) {
      ctx = null;
    }
  }

  function applyVolume() {
    if (!ctx) return;
    const m = vol.muted ? 0 : vol.master;
    master.gain.setTargetAtTime(m, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.55, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx * 0.6, ctx.currentTime, 0.05);
    ambBus.gain.setTargetAtTime(vol.sfx * 0.5, ctx.currentTime, 0.05);
    try { localStorage.setItem('aff-volume', JSON.stringify(vol)); } catch (e) { /* ignore */ }
  }

  /* ---------- building blocks ---------- */
  function tone(freq, start, dur, type = 'sine', v = 0.5, slideTo = null, bus = sfxBus) {
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  function noise(start, dur, v = 0.2, freq = 1200, type = 'bandpass', q = 1, bus = sfxBus, sweepTo = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }
  const bell = (f, start = 0, v = 0.3) => { tone(f, start, 1.2, 'sine', v); tone(f * 2.76, start, 0.5, 'sine', v * 0.3); tone(f * 5.4, start, 0.25, 'sine', v * 0.12); };

  /* ---------- one-shot sound effects ---------- */
  const SFX = {
    click: () => { tone(1200, 0, 0.04, 'square', 0.12); tone(800, 0.01, 0.05, 'sine', 0.15); },
    hover: () => tone(1800, 0, 0.03, 'sine', 0.04),
    toggle: () => { tone(660, 0, 0.05, 'square', 0.1); tone(990, 0.04, 0.06, 'square', 0.08); },
    tab: () => { noise(0, 0.12, 0.12, 2500, 'bandpass', 0.8, sfxBus, 600); tone(520, 0, 0.08, 'triangle', 0.12); },
    error: () => { tone(220, 0, 0.12, 'square', 0.12); tone(180, 0.12, 0.16, 'square', 0.12); },
    place: () => { tone(160, 0, 0.12, 'sine', 0.45, 70); noise(0, 0.06, 0.15, 3000, 'highpass'); },
    plop: () => { tone(420, 0, 0.1, 'sine', 0.3, 180); noise(0, 0.05, 0.08, 1800); },
    squirt: () => noise(0, 0.32, 0.25, 600, 'bandpass', 3, sfxBus, 2400),
    sprinkle: () => { for (let i = 0; i < 7; i++) noise(i * 0.035, 0.03, 0.08, 6000, 'highpass'); },
    ignite: () => { tone(2400, 0, 0.03, 'square', 0.15); tone(2000, 0.07, 0.03, 'square', 0.12); noise(0.1, 0.7, 0.35, 400, 'lowpass', 0.7, sfxBus, 1600); },
    flip: () => { noise(0, 0.18, 0.2, 900, 'bandpass', 1, sfxBus, 3000); noise(0.15, 0.45, 0.25, 5000, 'highpass'); tone(300, 0, 0.1, 'triangle', 0.15, 500); },
    sizzleBurst: () => noise(0, 0.6, 0.3, 5000, 'highpass'),
    perfect: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.25, 'triangle', 0.22)); },
    warn: () => { tone(880, 0, 0.09, 'square', 0.12); tone(880, 0.14, 0.09, 'square', 0.12); },
    burnt: () => { tone(300, 0, 0.35, 'sawtooth', 0.12, 120); noise(0, 0.5, 0.12, 300, 'lowpass'); },
    basketDown: () => { tone(500, 0, 0.08, 'triangle', 0.15, 300); noise(0.05, 0.8, 0.4, 4500, 'highpass'); noise(0.05, 0.5, 0.25, 800, 'lowpass'); },
    basketUp: () => { tone(1400, 0, 0.12, 'triangle', 0.12); tone(2100, 0.02, 0.1, 'sine', 0.08); noise(0, 0.25, 0.12, 2000); },
    ovenDoor: () => { tone(110, 0, 0.25, 'sine', 0.4, 60); noise(0, 0.35, 0.18, 700, 'lowpass'); },
    ding: () => bell(1568, 0, 0.35),
    orderBell: () => { bell(1319, 0, 0.3); bell(1760, 0.12, 0.25); },
    stretch: () => { tone(120, 0, 0.12, 'sine', 0.4, 80); noise(0, 0.12, 0.1, 500, 'lowpass'); },
    flour: () => noise(0, 0.4, 0.12, 1200, 'bandpass', 0.5),
    arrive: () => { bell(784, 0, 0.25); bell(1047, 0.18, 0.22); },
    step: () => { tone(90 + Math.random() * 20, 0, 0.08, 'sine', 0.25, 50); noise(0, 0.04, 0.06, 900, 'lowpass'); },
    pourStart: () => noise(0, 0.15, 0.15, 1500, 'bandpass', 2),
    lid: () => { tone(700, 0, 0.05, 'square', 0.12, 400); tone(1600, 0.04, 0.05, 'sine', 0.1); },
    trash: () => { noise(0, 0.3, 0.2, 500, 'lowpass'); tone(200, 0, 0.2, 'triangle', 0.15, 90); },
    scanStart: () => { tone(400, 0, 0.5, 'sine', 0.2, 1600); tone(410, 0, 0.5, 'sine', 0.12, 1620); },
    scanBeep: () => tone(1800 + Math.random() * 400, 0, 0.05, 'square', 0.06),
    check: () => { tone(1047, 0, 0.08, 'triangle', 0.18); tone(1568, 0.06, 0.12, 'triangle', 0.16); },
    alert: () => { tone(660, 0, 0.12, 'triangle', 0.18); tone(520, 0.12, 0.16, 'triangle', 0.18); },
    confirm: () => { [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.2, 'triangle', 0.22)); },
    printerStart: () => { tone(80, 0, 1.2, 'sawtooth', 0.12, 320); tone(160, 0.3, 0.9, 'triangle', 0.15, 640); noise(0, 0.8, 0.1, 300, 'lowpass'); bell(1047, 1.0, 0.15); },
    doorClose: () => { noise(0, 0.5, 0.18, 900, 'bandpass', 1, sfxBus, 300); tone(120, 0.45, 0.2, 'sine', 0.4, 60); tone(2500, 0.5, 0.03, 'square', 0.08); },
    doorOpen: () => { tone(60, 0, 0.2, 'sine', 0.3, 120); noise(0, 0.6, 0.2, 400, 'bandpass', 1, sfxBus, 1400); noise(0.2, 0.8, 0.12, 3000, 'highpass'); },
    beep: () => tone(1500 + Math.random() * 600, 0, 0.06, 'square', 0.07),
    servo: () => { tone(220, 0, 0.25, 'sawtooth', 0.05, 330); tone(1800, 0.25, 0.02, 'square', 0.06); },
    layer: () => { tone(300 + Math.random() * 200, 0, 0.14, 'sawtooth', 0.05, 700); noise(0, 0.18, 0.08, 2600); tone(1200, 0.12, 0.04, 'square', 0.05); },
    steam: () => noise(0, 0.9, 0.18, 4000, 'highpass', 0.7, sfxBus, 1500),
    synthComplete: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.5, 'triangle', 0.22)); bell(2093, 0.45, 0.15); },
    whoosh: () => noise(0, 0.45, 0.25, 500, 'bandpass', 1, sfxBus, 2500),
    happy: () => { tone(660, 0, 0.15, 'sine', 0.3); tone(880, 0.12, 0.15, 'sine', 0.3); tone(1320, 0.24, 0.25, 'sine', 0.25); },
    sad: () => { tone(400, 0, 0.25, 'triangle', 0.25, 300); tone(300, 0.22, 0.4, 'triangle', 0.25, 200); },
    money: () => { tone(1319, 0, 0.1, 'square', 0.12); tone(1760, 0.07, 0.35, 'square', 0.12); noise(0, 0.1, 0.06, 7000, 'highpass'); },
    tick: () => tone(2400, 0, 0.02, 'square', 0.05),
    notify: () => { tone(988, 0, 0.12, 'sine', 0.3); tone(1319, 0.1, 0.25, 'sine', 0.3); },
    chomp: () => { noise(0, 0.12, 0.35, 900, 'bandpass', 1.5); noise(0.08, 0.1, 0.25, 2500, 'bandpass', 2); tone(140, 0, 0.1, 'sine', 0.3, 80); },
    levelUp: () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.3, 'square', 0.12)); bell(2093, 0.45, 0.2); },
    star: (i = 0) => tone(880 * Math.pow(1.122, i), 0, 0.2, 'triangle', 0.2),
  };

  /* ---------- looping layers (created once, faded in/out) ---------- */
  function makeNoiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function lfo(freq, depth, target) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); o.start(); return o;
  }
  const LOOPS = {
    sizzle(out) {
      const n = makeNoiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const am = ctx.createGain(); am.gain.value = 0.7;
      n.connect(hp).connect(am).connect(out); n.start();
      const l1 = lfo(13, 0.25, am.gain), l2 = lfo(3.7, 0.2, am.gain);
      return [n, l1, l2];
    },
    fryer(out) {
      const n = makeNoiseSrc(); const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
      const am = ctx.createGain(); am.gain.value = 0.5;
      n.connect(lp).connect(am).connect(out); n.start();
      const l1 = lfo(9, 0.35, am.gain), l2 = lfo(2.3, 0.2, lp.frequency);
      const n2 = makeNoiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
      const g2 = ctx.createGain(); g2.gain.value = 0.35; n2.connect(hp).connect(g2).connect(out); n2.start();
      return [n, l1, l2, n2];
    },
    oven(out) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
      const g = ctx.createGain(); g.gain.value = 0.5;
      const n = makeNoiseSrc(); const nl = ctx.createBiquadFilter(); nl.type = 'lowpass'; nl.frequency.value = 400;
      const ng = ctx.createGain(); ng.gain.value = 0.4;
      o.connect(lp).connect(g).connect(out); n.connect(nl).connect(ng).connect(out); o.start(); n.start();
      return [o, n];
    },
    printerHum(out) {
      const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = 62;
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = 124.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const g = ctx.createGain(); g.gain.value = 0.6;
      a.connect(lp); b.connect(lp); lp.connect(g).connect(out); a.start(); b.start();
      const l = lfo(0.5, 0.15, g.gain);
      return [a, b, l];
    },
    motor(out) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 150;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0.25;
      o.connect(bp).connect(g).connect(out); o.start();
      const l1 = lfo(1.6, 70, o.frequency), l2 = lfo(0.7, 500, bp.frequency);
      return [o, l1, l2];
    },
    pour(out) {
      const n = makeNoiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.5;
      const g = ctx.createGain(); g.gain.value = 0.6; n.connect(bp).connect(g).connect(out); n.start();
      const l = lfo(7, 250, bp.frequency);
      return [n, l];
    },
    scan(out) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1320;
      const g = ctx.createGain(); g.gain.value = 0.12; o.connect(g).connect(out); o.start();
      const l = lfo(11, 0.1, g.gain), l2 = lfo(0.9, 200, o.frequency);
      return [o, l, l2];
    },
    ambience(out) {
      const n = makeNoiseSrc(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.35; n.connect(lp).connect(g).connect(out); n.start();
      const hum = ctx.createOscillator(); hum.frequency.value = 50; const hg = ctx.createGain(); hg.gain.value = 0.03;
      hum.connect(hg).connect(out); hum.start();
      const l = lfo(0.13, 0.12, g.gain);
      return [n, hum, l];
    },
  };

  function loop(name, level) {
    if (!ctx) return;
    let L = loops[name];
    if (level > 0.001) {
      if (!L) {
        const g = ctx.createGain(); g.gain.value = 0.0001;
        g.connect(name === 'ambience' ? ambBus : sfxBus);
        L = loops[name] = { gain: g, nodes: LOOPS[name](g), level: 0 };
      }
      clearTimeout(L.stopTimer); L.stopTimer = null;
      if (Math.abs(L.level - level) > 0.01) { L.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.12); L.level = level; }
    } else if (L && !L.stopTimer) {
      L.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      L.level = 0;
      L.stopTimer = setTimeout(() => {
        L.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
        L.gain.disconnect();
        delete loops[name];
      }, 700);
    }
  }
  function stopAllLoops() { Object.keys(loops).forEach((n) => { if (n !== 'ambience') loop(n, 0); }); }

  /* ---------- background music: a small procedural sequencer ---------- */
  const Music = {
    mode: 'restaurant', // 'restaurant' | 'processing'
    step: 0, nextTime: 0, timer: null, bpm: 104,
    // Fmaj7 – G6 – Em7 – Am7 (bright, modern, not distracting)
    chords: [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]],
    bass: [41, 43, 40, 45],
    start() {
      if (!ctx || this.timer) return;
      this.nextTime = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 30);
    },
    schedule() {
      const stepDur = 60 / this.bpm / 4;
      while (this.nextTime < ctx.currentTime + 0.12) { this.playStep(this.step, this.nextTime, stepDur); this.step = (this.step + 1) % 64; this.nextTime += stepDur; }
    },
    playStep(s, t, sd) {
      const bar = Math.floor(s / 16), i = s % 16;
      const chord = this.chords[bar], root = this.bass[bar];
      const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
      const v = (f, at, dur, type, gain, cutoff = 2500) => {
        const o = ctx.createOscillator(); const g = ctx.createGain(); const lp = ctx.createBiquadFilter();
        o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cutoff;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(lp).connect(g).connect(musicBus); o.start(at); o.stop(at + dur + 0.05);
      };
      const proc = this.mode === 'processing';
      // pad (once per bar)
      if (i === 0) chord.forEach((m) => { v(hz(m), t, sd * 16, 'triangle', 0.045, 1400); v(hz(m) * 1.004, t, sd * 16, 'sawtooth', 0.012, 900); });
      // bass
      if (!proc && (i === 0 || i === 6 || i === 8 || i === 14)) v(hz(root), t, sd * 1.8, 'triangle', 0.16, 600);
      if (proc && i % 4 === 0) v(hz(root), t, sd * 3, 'sawtooth', 0.07, 300 + i * 40);
      // arpeggio
      const arpEvery = proc ? 1 : 2;
      if (i % arpEvery === 0) {
        const note = chord[(i / arpEvery) % 4] + 12 + (proc && i % 8 >= 4 ? 12 : 0);
        v(hz(note), t, sd * 0.9, 'square', proc ? 0.022 : 0.018, proc ? 1200 + i * 120 : 2200);
      }
      // drums
      if (!proc) {
        if (i === 0 || i === 8 || i === 10) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.25); }
        if (i % 4 === 2) { const src = makeNoiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); src.connect(hp).connect(g).connect(musicBus); src.start(t); src.stop(t + 0.06); }
        if (i === 4 || i === 12) { const src = makeNoiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); src.connect(bp).connect(g).connect(musicBus); src.start(t); src.stop(t + 0.15); }
      } else if (i % 2 === 0) {
        const src = makeNoiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 9000; const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); src.connect(hp).connect(g).connect(musicBus); src.start(t); src.stop(t + 0.04);
      }
    },
  };

  return {
    init() { init(); },
    start() { init(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); Music.start(); loop('ambience', 0.6); },
    play(name, arg) {
      try { init(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); SFX[name] && SFX[name](arg); } catch (e) { /* audio is optional */ }
    },
    loop(name, level) { try { loop(name, level); } catch (e) { /* ignore */ } },
    stopAllLoops,
    setMusicMode(mode) { Music.mode = mode; },
    get volume() { return vol; },
    setVolume(key, value) { vol[key] = value; applyVolume(); },
    toggleMute() { vol.muted = !vol.muted; applyVolume(); return !vol.muted; },
    get enabled() { return !vol.muted; },
  };
})();
