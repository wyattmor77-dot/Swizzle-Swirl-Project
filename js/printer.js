/* =========================================================
   AI FOOD FACTORY — THE 3D FOOD PRINTER
   Printer: draws the machine (cartridges, gantry, nozzle,
            glass chamber, platform, screen, output tray).
   PrintJob: the timed printing cutscene. Everything is a
            function of elapsed time, so SKIP just jumps ahead.
   ========================================================= */
const PW = 560, PH = 740;              // printer drawing size (logical px)
const PLATFORM = { x: 210, y: 522 };   // centre of the print platform
const TRAY = { x: 474, y: 540 };       // centre of the output tray
const PARK = { x: 210, y: 236 };       // nozzle rest position

class Printer {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    this.time = 0;
    this.particles = [];
    this.reset();
  }

  reset() {
    this.state = {
      power: 0.35, mode: 'idle', build: null, reveal: null, activeLayer: -1, activeCart: null, seal: 0, present: 0, quality: null,
      nozzle: { ...PARK }, food: null, trayBuild: null, door: 0, flash: 0, bootProgress: 0,
      screen: { title: 'AI FOOD PRINTER', lines: ['STATUS: STANDBY', 'AWAITING ORDER...'], progress: null },
      cartLevels: Object.fromEntries(CARTRIDGE_ORDER.map((k, i) => [k, 0.7 + ((i * 37) % 25) / 100])),
    };
  }

  showReady(build, title = '') {
    const s = this.state;
    s.mode = 'ready'; s.trayBuild = build; s.food = null; s.reveal = null; s.build = null; s.power = 0.7; s.seal = 0; s.present = 0;
    s.activeCart = null; s.door = 0; s.nozzle = { ...PARK };
    s.screen = { title: 'FOOD READY', lines: [title, 'SERVE TO CUSTOMER  ◀◀'], progress: null };
  }

  clearTray() {
    this.state.trayBuild = null;
    this.state.mode = 'idle';
    this.state.power = 0.35;
    this.state.screen = { title: 'AI FOOD PRINTER', lines: ['STATUS: STANDBY', 'AWAITING ORDER...'], progress: null };
  }

  update(dt) {
    this.time += dt;
    const s = this.state;
    // particles
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; if (p.steam) p.r += dt * 14; }
    if ((s.mode === 'printing' || s.mode === 'complete') && Math.random() < dt * 6) {
      this.particles.push({ x: PLATFORM.x + (Math.random() - 0.5) * 160, y: PLATFORM.y - 30, vx: (Math.random() - 0.5) * 10, vy: -40 - Math.random() * 30, g: 0, life: 1.4, color: 'rgba(255,255,255,0.25)', r: 6, steam: true });
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (s.mode === 'printing' && s.activeCart) {
      for (let i = 0; i < 2; i++) {
        this.particles.push({ x: s.nozzle.x + (Math.random() - 0.5) * 6, y: s.nozzle.y + 14, vx: (Math.random() - 0.5) * 30, vy: 60 + Math.random() * 80, g: 200, life: 0.25, color: CARTRIDGES[s.activeCart].color, r: 2 + Math.random() * 2 });
      }
    }
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 0.8);
  }

  sparkle(x, y, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 120, life: 0.6 + Math.random() * 0.6, color: Math.random() > 0.5 ? '#ffffff' : '#7ff6ff', r: 1.5 + Math.random() * 2.5 });
    }
  }

  /* ---------------- drawing ---------------- */
  draw() {
    const c = this.c;
    const s = this.state;
    const t = this.time;
    const dpr = this.canvas.width / PW;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, PW, PH);
    const glowA = 0.25 + s.power * 0.75;
    const cyan = `rgba(64,232,255,${glowA})`;

    // floor shadow + feet
    oval(c, PW / 2, 728, 260, 14, 0, 'rgba(0,20,50,0.25)');
    c.fillStyle = '#7d8fa3';
    c.beginPath(); c.roundRect(40, 704, 70, 26, 8); c.roundRect(450, 704, 70, 26, 8); c.fill();

    // housing
    c.save();
    c.shadowColor = 'rgba(0,30,80,0.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
    const hg = c.createLinearGradient(10, 0, 550, 0);
    hg.addColorStop(0, '#cfd9e6'); hg.addColorStop(0.18, '#f8fbff'); hg.addColorStop(0.7, '#e6edf6'); hg.addColorStop(1, '#b7c4d4');
    c.fillStyle = hg;
    c.beginPath(); c.roundRect(10, 40, 540, 672, 34); c.fill();
    c.restore();
    c.strokeStyle = cyan; c.lineWidth = 3;
    c.beginPath(); c.roundRect(16, 46, 528, 660, 30); c.stroke();

    // label plate
    c.fillStyle = '#0b1a2e';
    c.beginPath(); c.roundRect(130, 4, 300, 48, 16); c.fill();
    c.strokeStyle = cyan; c.lineWidth = 2; c.stroke();
    c.save();
    c.font = '800 24px "Orbitron", "Segoe UI", Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#40e8ff'; c.shadowBlur = 8 + s.power * 14;
    c.fillStyle = s.power > 0.5 ? '#bff8ff' : '#7fb8c8';
    c.fillText('AI FOOD PRINTER', 280, 29);
    c.restore();

    this.drawCartridges(c, s, t);
    this.drawCore(c, s, t);
    this.drawChamber(c, s, t);
    this.drawMechanics(c, s, t);
    this.drawTray(c, s, t);
    this.drawScreen(c, s, t);

    // bottom indicator lights
    for (let i = 0; i < 10; i++) {
      const on = s.power > 0.5 ? (Math.sin(t * 5 + i * 0.8) > -0.2) : i === 0;
      dot(c, 60 + i * 18, 712, 4, on ? ['#40e8ff', '#4fd06a', '#ffd84a', '#ff4d6d'][i % 4] : '#5b6a7c');
    }

    // particles on top
    for (const p of this.particles) { c.globalAlpha = p.steam ? Math.min(1, p.life) * 0.6 : Math.min(1, p.life * 3); dot(c, p.x, p.y, p.r, p.color); }
    c.globalAlpha = 1;
  }

  drawCartridges(c, s, t) {
    CARTRIDGE_ORDER.forEach((key, i) => {
      const x = 34 + i * 60, y = 64, w = 46, h = 84;
      const cart = CARTRIDGES[key];
      const active = s.activeCart === key;
      c.save();
      if (active) { c.shadowColor = cart.color; c.shadowBlur = 22; }
      c.fillStyle = 'rgba(220,240,255,0.55)';
      c.beginPath(); c.roundRect(x, y, w, h, 14); c.fill();
      c.restore();
      const level = s.cartLevels[key];
      c.save();
      c.beginPath(); c.roundRect(x + 4, y + 4, w - 8, h - 8, 10); c.clip();
      const lh = (h - 8) * level, ly = y + h - 4 - lh;
      const g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, shade(cart.color, -0.25)); g.addColorStop(0.4, shade(cart.color, 0.25)); g.addColorStop(1, shade(cart.color, -0.3));
      c.fillStyle = g; c.fillRect(x, ly, w, lh + 10);
      // liquid surface wave
      c.fillStyle = shade(cart.color, 0.4);
      c.beginPath(); c.ellipse(x + w / 2, ly + Math.sin(t * 4 + i) * 1.5, w / 2 - 4, 3, 0, 0, Math.PI * 2); c.fill();
      if (active) for (let b = 0; b < 4; b++) dot(c, x + 12 + ((b * 9) % 24), ly + ((t * 60 + b * 23) % lh), 2.2, 'rgba(255,255,255,0.7)');
      c.restore();
      c.strokeStyle = active ? cart.color : 'rgba(80,110,140,0.6)'; c.lineWidth = active ? 3 : 2;
      c.beginPath(); c.roundRect(x, y, w, h, 14); c.stroke();
      c.fillStyle = '#8b9bb0'; c.fillRect(x + 8, y - 8, w - 16, 10);
      c.fillRect(x + w / 2 - 4, y + h, 8, 12);
      c.font = '700 10px "Segoe UI", Arial, sans-serif'; c.textAlign = 'center';
      c.fillStyle = active ? shade(cart.color, -0.35) : '#4b5d72';
      c.fillText(cart.label, x + w / 2, y + h + 24);
      dot(c, x + w / 2, y + h + 32, 3, active ? cart.color : s.power > 0.5 ? '#9ad7e6' : '#9aa9b9');
    });
  }

  drawCore(c, s, t) {
    // "AI core" chip — pulses while the AI is thinking
    const x = 408, y = 60, w = 124, h = 108;
    c.fillStyle = '#0b1a2e';
    c.beginPath(); c.roundRect(x, y, w, h, 16); c.fill();
    const thinking = ['boot', 'analyzing', 'recipe'].includes(s.mode);
    const pulse = thinking ? 0.6 + 0.4 * Math.sin(t * 10) : s.power > 0.5 ? 0.6 : 0.25;
    c.strokeStyle = `rgba(64,232,255,${pulse})`; c.lineWidth = 2;
    // neural net lines
    const nodes = [];
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) nodes.push([x + 24 + col * 38, y + 26 + row * 28, col]);
    for (const a of nodes) for (const b of nodes) if (b[2] === a[2] + 1) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    nodes.forEach((n, i) => dot(c, n[0], n[1], 4.5, thinking && Math.sin(t * 12 + i) > 0.3 ? '#ffffff' : `rgba(64,232,255,${0.4 + pulse * 0.6})`));
    c.font = '800 11px "Orbitron", "Segoe UI", sans-serif'; c.textAlign = 'center';
    c.fillStyle = '#9ff4ff';
    c.fillText(thinking ? 'AI THINKING' : 'AI CORE', x + w / 2, y + h - 6);
  }

  drawChamber(c, s, t) {
    const x = 30, y = 182, w = 362, h = 380;
    // interior
    const ig = c.createLinearGradient(0, y, 0, y + h);
    ig.addColorStop(0, '#13283f'); ig.addColorStop(1, '#1f4466');
    c.fillStyle = ig;
    c.beginPath(); c.roundRect(x, y, w, h, 18); c.fill();
    c.save();
    c.beginPath(); c.roundRect(x, y, w, h, 18); c.clip();
    c.strokeStyle = 'rgba(64,232,255,0.08)'; c.lineWidth = 1;
    for (let gx = x; gx < x + w; gx += 24) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); }
    for (let gy = y; gy < y + h; gy += 24) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
    // interior lights
    if (s.power > 0.5) {
      const lg = c.createRadialGradient(PLATFORM.x, y + 10, 10, PLATFORM.x, y + 10, 300);
      lg.addColorStop(0, `rgba(160,245,255,${0.25 * s.power})`); lg.addColorStop(1, 'rgba(160,245,255,0)');
      c.fillStyle = lg; c.fillRect(x, y, w, h);
    }
    for (let i = 0; i < 7; i++) dot(c, x + 30 + i * 50, y + 10, 4, s.power > 0.5 ? '#bff8ff' : '#4d6f88');

    // platform
    const printing = s.mode === 'printing' || s.mode === 'finalizing';
    c.fillStyle = '#5d7088';
    c.fillRect(PLATFORM.x - 30, PLATFORM.y + 8, 60, 40);
    extrude(c, pEllipse(150, 38, PLATFORM.x), PLATFORM.y + 12, 12, '#9fb3c8', { cx: PLATFORM.x, w: 150, top: topGrad(c, PLATFORM.x, PLATFORM.y, 150, '#dfe9f3', 0.2) });
    c.beginPath(); c.ellipse(PLATFORM.x, PLATFORM.y, 140, 34, 0, 0, Math.PI * 2);
    c.strokeStyle = printing ? `rgba(64,232,255,${0.6 + 0.4 * Math.sin(t * 8)})` : s.power > 0.5 ? 'rgba(64,232,255,0.5)' : 'rgba(64,232,255,0.15)';
    c.lineWidth = 3; c.stroke();
    if (s.flash > 0) {
      const fg = c.createRadialGradient(PLATFORM.x, PLATFORM.y - 80, 10, PLATFORM.x, PLATFORM.y - 80, 220);
      fg.addColorStop(0, `rgba(255,255,255,${s.flash * 0.8})`); fg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = fg; c.fillRect(x, y, w, h);
    }

    // presentation spotlight
    if (s.present > 0) {
      const sg = c.createLinearGradient(0, y, 0, PLATFORM.y);
      sg.addColorStop(0, `rgba(255,250,220,${0.05 * s.present})`); sg.addColorStop(1, `rgba(255,250,220,${0.4 * s.present})`);
      c.fillStyle = sg; c.beginPath(); c.moveTo(PLATFORM.x - 40, y); c.lineTo(PLATFORM.x + 40, y); c.lineTo(PLATFORM.x + 170, PLATFORM.y + 20); c.lineTo(PLATFORM.x - 170, PLATFORM.y + 20); c.closePath(); c.fill();
    }
    this.drawArms(c, s, t);
    // food being printed
    if (s.build && s.food && s.food.inChamber) this.drawPrintingFood(c, s, t);

    // gantry rail + carriage + nozzle
    const n = s.nozzle;
    c.fillStyle = '#8b9bb0'; c.fillRect(x + 6, 196, w - 12, 12);
    c.fillStyle = '#c5d2e0'; c.fillRect(x + 6, 196, w - 12, 4);
    c.fillStyle = '#56687e'; c.fillRect(n.x - 6, 208, 12, Math.max(0, n.y - 222));
    c.fillStyle = '#dfe8f2';
    c.beginPath(); c.roundRect(n.x - 26, 190, 52, 26, 8); c.fill();
    c.strokeStyle = '#7a8ca1'; c.lineWidth = 2; c.stroke();
    const tipColor = s.activeCart ? CARTRIDGES[s.activeCart].color : '#9fb3c8';
    c.fillStyle = '#c9d6e3';
    c.beginPath(); c.moveTo(n.x - 18, n.y - 18); c.lineTo(n.x + 18, n.y - 18); c.lineTo(n.x + 6, n.y + 6); c.lineTo(n.x - 6, n.y + 6); c.closePath(); c.fill();
    c.strokeStyle = '#7a8ca1'; c.stroke();
    c.save();
    if (s.activeCart) { c.shadowColor = tipColor; c.shadowBlur = 18; }
    dot(c, n.x, n.y + 8, 5, tipColor);
    c.restore();
    // laser scan line at the current print height
    if (s.mode === 'printing' && s.scanY != null) {
      c.save();
      c.shadowColor = tipColor; c.shadowBlur = 12;
      c.strokeStyle = alpha(s.activeCart ? CARTRIDGES[s.activeCart].color : '#40e8ff', 0.85); c.lineWidth = 2;
      c.beginPath(); c.moveTo(PLATFORM.x - s.scanW, s.scanY); c.lineTo(PLATFORM.x + s.scanW, s.scanY); c.stroke();
      c.globalAlpha = 0.35;
      c.beginPath(); c.moveTo(n.x, n.y + 10); c.lineTo(n.x - 14, s.scanY); c.lineTo(n.x + 14, s.scanY); c.closePath(); c.fillStyle = tipColor; c.fill();
      c.restore();
    }
    c.restore();

    // feed tube from the active cartridge to the carriage
    if (s.activeCart) {
      const i = CARTRIDGE_ORDER.indexOf(s.activeCart);
      const sx = 34 + i * 60 + 23;
      c.save();
      c.strokeStyle = alpha(CARTRIDGES[s.activeCart].color, 0.9); c.lineWidth = 5; c.lineCap = 'round';
      c.shadowColor = CARTRIDGES[s.activeCart].color; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(sx, 160); c.bezierCurveTo(sx, 182, n.x, 170, n.x, 192); c.stroke();
      c.setLineDash([4, 10]); c.lineDashOffset = -t * 60; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(sx, 160); c.bezierCurveTo(sx, 182, n.x, 170, n.x, 192); c.stroke();
      c.restore();
    }

    // glass front with reflections
    c.fillStyle = 'rgba(200,240,255,0.08)';
    c.beginPath(); c.roundRect(x, y, w, h, 18); c.fill();
    c.save();
    c.beginPath(); c.roundRect(x, y, w, h, 18); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.beginPath(); c.moveTo(x + 40, y); c.lineTo(x + 110, y); c.lineTo(x + 10, y + h); c.lineTo(x - 60, y + h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath(); c.moveTo(x + 140, y); c.lineTo(x + 160, y); c.lineTo(x + 60, y + h); c.lineTo(x + 40, y + h); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = '#a9b8c9'; c.lineWidth = 6;
    c.beginPath(); c.roundRect(x, y, w, h, 18); c.stroke();
    c.strokeStyle = `rgba(64,232,255,${0.3 + s.power * 0.5})`; c.lineWidth = 2;
    c.beginPath(); c.roundRect(x + 5, y + 5, w - 10, h - 10, 14); c.stroke();

    // sealing glass door (slides down when synthesis starts)
    if (s.seal > 0) {
      const dh = h * s.seal;
      c.fillStyle = 'rgba(160,220,255,0.18)'; c.fillRect(x + 4, y + 4, w - 8, dh - 4);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(x + 200, y); c.lineTo(x + 240, y); c.lineTo(x + 140, y + dh); c.lineTo(x + 100, y + dh); c.closePath(); c.fill();
      c.fillStyle = '#a9b8c9'; c.fillRect(x + 2, y + dh - 10, w - 4, 10);
      c.fillStyle = s.seal > 0.98 ? '#4fd06a' : '#ffd84a';
      for (let k = 0; k < 5; k++) dot(c, x + 40 + k * 70, y + dh - 5, 3, c.fillStyle);
      if (s.seal > 0.98) { c.font = '800 11px Orbitron, sans-serif'; c.textAlign = 'right'; c.fillStyle = '#9dffb0'; c.fillText('🔒 CHAMBER SEALED', x + w - 14, y + dh - 18); }
    }
    // side door to output tray
    const doorH = 120 * (1 - s.door);
    c.fillStyle = '#b8c6d6'; c.fillRect(388, 440, 14, 122);
    c.fillStyle = '#16304a'; c.fillRect(390, 442, 10, 118);
    c.fillStyle = '#d6e1ec'; c.fillRect(389, 442, 12, doorH);

    // food travelling to the tray is drawn above the glass
    if (s.build && s.food && !s.food.inChamber) drawFood(c, s.build, s.food.x, s.food.y, s.food.s, s.reveal);
  }

  drawArms(c, s, t) {
    const active = s.mode === 'printing' || s.mode === 'finalizing';
    const ik = (bx, by, tx, ty, l1, l2, flip) => {
      const dx = tx - bx, dy = ty - by, d = Math.min(l1 + l2 - 1, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx), b = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
      const a1 = a + (flip ? b : -b);
      const ex = bx + Math.cos(a1) * l1, ey = by + Math.sin(a1) * l1;
      return [ex, ey, bx + Math.cos(a1) * l1 + Math.cos(Math.atan2(ty - ey, tx - ex)) * l2, ey + Math.sin(Math.atan2(ty - ey, tx - ex)) * l2];
    };
    const targetY = s.scanY != null ? s.scanY : 330;
    [[48, 300, -1], [374, 300, 1]].forEach(([bx, by, side], i) => {
      const reach = active ? 70 + Math.sin(t * 5 + i * 2) * 18 : 20;
      const tx = PLATFORM.x + side * (active ? 95 + Math.sin(t * 3 + i) * 15 : 120);
      const ty = active ? targetY - 10 + Math.cos(t * 4 + i) * 12 : by + 60;
      const [ex, ey, hx, hy] = ik(bx, by, side < 0 ? Math.max(bx + 20, tx - reach + 70) : Math.min(bx - 20, tx + reach - 70), ty, 80, 75, side > 0);
      c.lineCap = 'round';
      c.strokeStyle = '#8b9bb0'; c.lineWidth = 14; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
      c.strokeStyle = '#dfe8f2'; c.lineWidth = 8; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
      dot(c, bx, by, 12, '#56687e'); dot(c, ex, ey, 8, '#56687e'); dot(c, ex, ey, 3, active ? '#40e8ff' : '#9fb3c8');
      // gripper / tool
      c.save(); c.translate(hx, hy); c.rotate(Math.atan2(hy - ey, hx - ex));
      c.fillStyle = '#56687e'; c.fillRect(0, -8, 14, 16);
      c.strokeStyle = '#7d8fa3'; c.lineWidth = 4; const open = active ? 4 + Math.sin(t * 8 + i) * 3 : 3;
      c.beginPath(); c.moveTo(14, -open); c.lineTo(26, -open - 3); c.moveTo(14, open); c.lineTo(26, open + 3); c.stroke();
      if (active) { c.shadowColor = '#40e8ff'; c.shadowBlur = 12; dot(c, 28, 0, 3, '#bff8ff'); }
      c.restore();
    });
  }

  drawPrintingFood(c, s) {
    drawFood(c, s.build, s.food.x, s.food.y - s.present * (6 + Math.sin(this.time * 3) * 3), s.food.s, s.reveal);
  }

  drawMechanics(c, s, t) {
    const speed = s.mode === 'printing' ? 4 : s.power > 0.5 ? 1 : 0.2;
    const gear = (gx, gy, r, teeth, dir, color) => {
      c.save(); c.translate(gx, gy); c.rotate(t * speed * dir);
      c.fillStyle = color; c.beginPath();
      for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2; const rr = i % 2 ? r : r + 6; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill();
      dot(c, 0, 0, r * 0.45, '#e6edf6'); dot(c, 0, 0, r * 0.18, '#56687e');
      c.restore();
    };
    c.fillStyle = '#dde6f0';
    c.beginPath(); c.roundRect(408, 182, 124, 248, 16); c.fill();
    c.strokeStyle = '#b4c2d2'; c.lineWidth = 2; c.stroke();
    gear(446, 226, 22, 10, 1, '#8b9bb0');
    gear(488, 252, 16, 8, -1.35, '#a3b2c4');
    // pistons
    for (let i = 0; i < 2; i++) {
      const ext = s.mode === 'printing' ? 10 + Math.sin(t * 9 + i * 2) * 10 : 6;
      c.fillStyle = '#7d8fa3'; c.fillRect(424 + i * 50, 290, 28, 40);
      c.fillStyle = '#c5d2e0'; c.fillRect(432 + i * 50, 330, 12, 16 + ext);
    }
    // gauge
    dot(c, 470, 392, 26, '#0b1a2e');
    c.strokeStyle = 'rgba(64,232,255,0.6)'; c.lineWidth = 3;
    c.beginPath(); c.arc(470, 392, 20, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
    const needle = Math.PI * 0.8 + Math.PI * 1.4 * (s.mode === 'printing' ? 0.7 + Math.sin(t * 7) * 0.12 : s.power * 0.5);
    c.strokeStyle = '#ff4d6d'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(470, 392); c.lineTo(470 + Math.cos(needle) * 18, 392 + Math.sin(needle) * 18); c.stroke();
    // LED column
    for (let i = 0; i < 5; i++) {
      const on = s.power > 0.5 && (s.mode !== 'idle' || i === 0) && Math.sin(t * 6 + i) > -0.3;
      dot(c, 520, 296 + i * 22, 5, on ? ['#4fd06a', '#40e8ff', '#ffd84a', '#ff8fd8', '#ff4d6d'][i] : '#8796a8');
    }
  }

  drawTray(c, s, t) {
    // output tray shelf
    c.fillStyle = '#b8c6d6';
    c.beginPath(); c.moveTo(400, 552); c.lineTo(548, 552); c.lineTo(540, 566); c.lineTo(400, 566); c.closePath(); c.fill();
    extrude(c, pEllipse(66, 17, TRAY.x), TRAY.y + 8, 6, '#9fb3c8', { cx: TRAY.x, w: 66, top: '#eef3f8' });
    c.beginPath(); c.ellipse(TRAY.x, TRAY.y + 2, 60, 14, 0, 0, Math.PI * 2);
    c.strokeStyle = s.trayBuild ? `rgba(79,208,106,${0.6 + 0.4 * Math.sin(t * 5)})` : 'rgba(64,232,255,0.3)';
    c.lineWidth = 3; c.stroke();
    c.font = '800 10px "Orbitron", "Segoe UI", sans-serif'; c.textAlign = 'center';
    c.fillStyle = '#4b5d72'; c.fillText('OUTPUT TRAY', TRAY.x, 450);
    c.fillText('▼', TRAY.x, 464);
    if (s.trayBuild) {
      const sc = fitScale(s.trayBuild, 130, 120);
      drawFood(c, s.trayBuild, TRAY.x, TRAY.y + 2, sc);
    }
  }

  drawScreen(c, s, t) {
    const x = 30, y = 574, w = 502, h = 122;
    c.fillStyle = '#7d8fa3';
    c.beginPath(); c.roundRect(x - 4, y - 4, w + 8, h + 8, 16); c.fill();
    const sg = c.createLinearGradient(0, y, 0, y + h);
    sg.addColorStop(0, '#06192b'); sg.addColorStop(1, '#0b2a44');
    c.fillStyle = sg;
    c.beginPath(); c.roundRect(x, y, w, h, 12); c.fill();
    c.save();
    c.beginPath(); c.roundRect(x, y, w, h, 12); c.clip();
    // scanlines
    c.fillStyle = 'rgba(64,232,255,0.04)';
    for (let yy = y; yy < y + h; yy += 4) c.fillRect(x, yy, w, 2);
    const on = s.power > 0.3;
    const col = s.screen.color || '#7ff6ff';
    c.shadowColor = col; c.shadowBlur = on ? 8 : 0;
    c.fillStyle = on ? col : '#3d6b80';
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = '800 22px "Orbitron", "Consolas", monospace';
    c.fillText(s.screen.title, x + 18, y + 34);
    c.font = '600 16px "Consolas", "Courier New", monospace';
    c.fillStyle = on ? '#d6fbff' : '#3d6b80';
    s.screen.lines.forEach((line, i) => c.fillText(line, x + 18, y + 62 + i * 22));
    c.shadowBlur = 0;
    if (s.screen.progress != null) {
      const bx = x + 300, by = y + 18, bw = 182, bh = 18;
      c.strokeStyle = '#40e8ff'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh);
      const pg = c.createLinearGradient(bx, 0, bx + bw, 0);
      pg.addColorStop(0, '#40e8ff'); pg.addColorStop(1, '#4fd06a');
      c.fillStyle = pg; c.fillRect(bx + 3, by + 3, (bw - 6) * s.screen.progress, bh - 6);
    }
    // blinking cursor
    if (on && Math.sin(t * 6) > 0) { c.fillStyle = '#7ff6ff'; c.fillRect(x + w - 26, y + h - 22, 10, 4); }
    c.restore();
  }
}

/* =========================================================
   PRINT JOB — the synthesis cutscene timeline
   ========================================================= */
class PrintJob {
  constructor(printer, build, plan, orderName, handler) {
    this.p = printer;
    this.build = build;
    this.plan = plan;
    this.orderName = orderName.toUpperCase();
    this.on = handler; // (eventName, payload, skipped) => void
    this.t = 0;
    this.done = false;
    const N = build.layers.length;
    const T = {};
    T.analyze = 0.8;
    T.stepGap = 0.32;
    T.verified = T.analyze + plan.steps.length * T.stepGap;
    T.begin = T.verified + 0.6;
    T.print = T.begin + 0.5;
    T.printDur = Math.min(5.5, Math.max(3.2, N * 0.5));
    T.printEnd = T.print + T.printDur;
    T.complete = T.printEnd;
    T.quality = T.complete + 0.9;
    T.open = T.quality + 1.0;
    T.transfer = T.open + 1.3;
    T.transferEnd = T.transfer + 0.9;
    T.end = T.transferEnd + 0.8;
    this.T = T;
    this.layerDur = T.printDur / N;
    this.scale = fitScale(build, 300, 300);
    this.events = [
      { t: 0, name: 'start' },
      ...plan.steps.map((st, i) => ({ t: T.analyze + i * T.stepGap, name: 'step', payload: i })),
      { t: T.verified, name: 'verified' },
      { t: T.begin, name: 'begin' },
      { t: T.print, name: 'printStart' },
      ...build.layers.map((L, i) => ({ t: T.print + i * this.layerDur, name: 'layer', payload: i })),
      { t: T.complete, name: 'complete' },
      { t: T.quality, name: 'quality' },
      { t: T.open, name: 'open' },
      { t: T.transfer, name: 'transfer' },
      { t: T.transferEnd, name: 'cameraOut' },
      { t: T.end, name: 'end' },
    ];
    this.nextEvent = 0;
    const s = this.p.state;
    s.build = build; s.reveal = build.layers.map(() => 0); s.trayBuild = null; s.quality = null;
    s.food = { x: PLATFORM.x, y: PLATFORM.y - 2, s: this.scale, inChamber: true };
  }

  skip() { if (this.t < this.T.transferEnd) this.seek(this.T.transferEnd, true); }

  seek(t, skipped) {
    this.t = t;
    while (this.nextEvent < this.events.length && this.events[this.nextEvent].t <= this.t) {
      const ev = this.events[this.nextEvent++];
      this.on(ev.name, ev.payload, skipped);
    }
    this.apply();
  }

  update(dt) {
    if (this.done) return;
    this.seek(this.t + dt, false);
    if (this.t >= this.T.end) this.done = true;
  }

  apply() {
    const s = this.p.state, T = this.T, t = this.t, b = this.build, N = b.layers.length;
    const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
    s.power = 0.35 + 0.65 * ease(t / 0.7);
    s.scanY = null;
    s.activeCart = null;
    s.seal = t < T.open ? ease(t / 0.6) : 1 - ease((t - T.open) / 0.6);
    s.present = t >= T.open && t < T.transfer ? ease((t - T.open) / 0.5) : t >= T.transfer ? 1 - ease((t - T.transfer) / 0.4) : 0;
    const L0 = b.layers[0];

    if (t < T.analyze) {
      s.mode = 'boot';
      s.screen = { title: 'AI FOOD SYNTHESIS', lines: ['SEALING CHAMBER...', 'POWERING CARTRIDGES ▸▸▸'], progress: Math.min(1, t / T.analyze) };
    } else if (t < T.verified) {
      s.mode = 'analyzing';
      s.screen = { title: 'ANALYZING FOOD...', lines: [`ORDER: ${this.orderName}`, `LAYERS FOUND: ${Math.min(N, Math.round(((t - T.analyze) / (T.verified - T.analyze)) * N * 1.5))}`], progress: (t - T.analyze) / (T.verified - T.analyze) };
    } else if (t < T.begin) {
      s.mode = 'recipe';
      s.screen = { title: 'RECIPE VERIFIED ✓', lines: [`ORDER: ${this.orderName}`, `${N} LAYERS · CONFIDENCE ${this.plan.confidence}%`], progress: 1, color: '#9dffb0' };
    } else if (t < T.print) {
      s.mode = 'recipe';
      const k = ease((t - T.begin) / (T.print - T.begin));
      const target = { x: PLATFORM.x, y: s.food.y + L0.bottom * this.scale - 22 };
      s.nozzle = { x: PARK.x + (target.x - PARK.x) * k, y: PARK.y + (target.y - PARK.y) * k };
      s.screen = { title: 'BEGINNING SYNTHESIS', lines: ['NOZZLE CALIBRATED', 'ROBOTIC ARMS ONLINE'], progress: k };
    } else if (t < T.printEnd) {
      s.mode = 'printing';
      const tp = t - T.print;
      const cur = Math.min(N - 1, Math.floor(tp / this.layerDur));
      s.reveal = b.layers.map((_, i) => Math.max(0, Math.min(1, (tp - i * this.layerDur) / this.layerDur)));
      const L = b.layers[cur];
      const p = s.reveal[cur];
      s.activeLayer = cur;
      s.activeCart = L.ing.cart;
      const cutLocal = L.bottom - (L.bottom - L.top) * p;
      s.scanY = s.food.y + cutLocal * this.scale;
      s.scanW = (L.shape.w || 120) * this.scale;
      s.nozzle = { x: PLATFORM.x + Math.sin(tp * 13) * s.scanW * 0.8, y: Math.max(232, s.scanY - 22) };
      const pct = Math.round((tp / T.printDur) * 100);
      const bars = Math.round(pct / 10);
      s.screen = {
        title: `PRINTING ${'█'.repeat(bars)}${'░'.repeat(10 - bars)} ${pct}%`,
        lines: [`LAYER ${cur + 1}/${N}: ${L.ing.name.toUpperCase()}`, `${CARTRIDGES[L.ing.cart].label} CARTRIDGE ▸ NOZZLE`],
        progress: null,
      };
      s.cartLevels[L.ing.cart] = Math.max(0.15, s.cartLevels[L.ing.cart] - 0.0008);
    } else if (t < T.open) {
      s.mode = t < T.quality ? 'complete' : 'quality';
      s.reveal = b.layers.map(() => 1);
      const k = ease((t - T.complete) / 0.6);
      s.nozzle = { x: s.nozzle.x + (PARK.x - s.nozzle.x) * k, y: s.nozzle.y + (PARK.y - s.nozzle.y) * k };
      if (t < T.quality) s.screen = { title: 'FOOD SYNTHESIS COMPLETE', lines: [`ORDER: ${this.orderName}`, `${N} LAYERS PRINTED`], progress: null, color: '#9dffb0' };
      else { s.quality = this.plan.quality; s.screen = { title: `QUALITY SCORE: ${this.plan.quality}%`, lines: ['AI INSPECTION PASSED', 'OPENING CHAMBER...'], progress: this.plan.quality / 100, color: this.plan.quality >= 80 ? '#9dffb0' : '#ffd84a' }; }
    } else if (t < T.transfer) {
      s.mode = 'present';
      s.reveal = b.layers.map(() => 1);
      s.nozzle = { ...PARK };
      s.screen = { title: 'PRESENTING YOUR FOOD', lines: [`${this.orderName}`, `QUALITY ${this.plan.quality}% ✓`], progress: null, color: '#9dffb0' };
    } else {
      s.mode = 'transfer';
      s.reveal = b.layers.map(() => 1);
      s.nozzle = { ...PARK };
      const k = ease((t - T.transfer) / (T.transferEnd - T.transfer));
      s.door = Math.min(1, k * 3) * (k < 0.85 ? 1 : (1 - k) / 0.15);
      const trayScale = fitScale(b, 130, 120);
      s.food = {
        x: PLATFORM.x + (TRAY.x - PLATFORM.x) * k,
        y: PLATFORM.y - 2 + (TRAY.y + 2 - (PLATFORM.y - 2)) * k - Math.sin(k * Math.PI) * 30,
        s: this.scale + (trayScale - this.scale) * k,
        inChamber: k < 0.5,
      };
      s.screen = { title: 'DISPENSING...', lines: ['MOVING FOOD TO OUTPUT TRAY', 'PLEASE SERVE WHILE FRESH'], progress: k };
      if (t >= T.transferEnd) this.p.showReady(b, this.orderName);
    }
  }
}
