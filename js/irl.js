/* =========================================================
   AI FOOD FACTORY — "PRINT IT IN REAL LIFE" CUTSCENE
   The restaurant is a video game. After you serve a dish,
   you can send it to a (fictional) 3D food printer in the
   player's real room:
     game zooms out onto a monitor → the computer sends the
     recipe down a cable → the home printer builds the food
     layer by layer → the player spins their chair and eats it
     → back into the game.
   ========================================================= */
const MONITOR = { x: 470, y: 160, w: 660, h: 371 };          // where the game shrinks to
const IRL_PRINTER = { x: 65, y: 330, s: 0.42 };               // home printer on the side table
const GAMER = { x: 820, headY: 470, scale: 1.25 };
const CABLE = [[800, 562], [1150, 600], [1236, 640], [1236, 872], [210, 872], [210, 650]];
const GAMER_LOOK = { type: 'human', skin: '#e8b48a', hair: '#2b1a10', hairStyle: 'short', shirt: '#7a3cff', pattern: 'hoodie', acc: 'headphones', accColor: '#19d3f0' };

const Irl = {
  active: false,
  init() {
    this.scene = document.getElementById('irlScene');
    this.back = document.getElementById('irlBack').getContext('2d');
    this.front = document.getElementById('irlFront').getContext('2d');
    this.printer = new Printer(document.getElementById('irlPrinter'));
    this.gamerCv = document.createElement('canvas'); this.gamerCv.width = 520; this.gamerCv.height = 840;
    this.gamerCtx = this.gamerCv.getContext('2d'); this.gamerCtx.scale(2, 2);
    this.biteCv = document.createElement('canvas'); this.biteCv.width = 600; this.biteCv.height = 500;
    this.crumbs = [];
  },

  /* ---------- camera for the real-world room ---------- */
  cam(cx, cy, s) {
    this.scene.style.transform = cx == null ? '' : `translate(${800 - cx * s}px, ${450 - cy * s}px) scale(${s})`;
  },
  caption(html, ms = 2600) {
    const el = document.getElementById('irlCaption');
    el.innerHTML = html;
    el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.capTimer);
    this.capTimer = setTimeout(() => el.classList.remove('show'), ms);
  },

  start(build, order, plan) {
    this.active = true;
    this.build = build; this.order = order; this.plan = plan;
    this.t = 0; this.phase = 'zoomOut'; this.events = {}; this.job = null; this.pendingPickup = false;
    this.chair = 0; this.mood = 'neutral'; this.bites = 0; this.food = null; this.crumbs = [];
    this.printer.reset();
    const st = document.getElementById('stage');
    st.classList.add('irl', 'cinematic');
    document.getElementById('gameView').style.transform = `translate(${MONITOR.x}px, ${MONITOR.y}px) scale(${MONITOR.w / 1600})`;
    Sound.setMusicMode('processing');
    Sound.play('whoosh');
    show($('skipBtn'));
    $('skipBtn').onclick = () => this.finish(true);
  },

  once(key, fn) { if (!this.events[key]) { this.events[key] = 1; fn(); } },

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    this.printer.update(dt);
    // ---------- 1. the game shrinks onto the player's monitor ----------
    this.once('cap1', () => setTimeout(() => this.caption('MEANWHILE, IN <b>REAL LIFE</b>...', 2400), 500));
    if (t > 2.0) this.once('prompt', () => {
      const p = $('irlPrompt');
      p.querySelector('.ip-food').textContent = `${FOOD_BY_ID[this.order.foodId].emoji} ${this.order.name}`;
      p.classList.remove('clicked');
      show(p);
      Sound.play('notify');
      this.caption('The player wants to try the food from the game...', 2200);
    });
    if (t > 3.3) this.once('click', () => { $('irlPrompt').classList.add('clicked'); Sound.play('click'); });
    // ---------- 2. the computer sends the recipe to the home printer ----------
    if (t > 3.8) this.once('upload', () => {
      hide($('irlPrompt'));
      this.phase = 'upload';
      Sound.play('printerStart');
      Sound.loop('printerHum', 0.4);
      this.caption('GAME ➜ COMPUTER ➜ HOME FOOD PRINTER', 2200);
    });
    if (this.phase === 'upload' && Math.random() < dt * 14) Sound.play('beep');
    // ---------- 3. AI food printer synthesizes the food ----------
    if (t > 6.0) this.once('print', () => {
      this.phase = 'print';
      this.cam(400, 470, 2.0);
      this.startJob();
    });
    if (this.job) this.job.update(dt);
    if (this.pendingPickup) { this.pendingPickup = false; this.pickup(); }
    // ---------- 4. the player takes the food and eats it ----------
    if (this.phase === 'pickup') {
      const k = Math.min(1, (t - this.pickT) / 1.2);
      this.chair = Math.min(1, (t - this.pickT) / 0.7);
      const from = this.foodFrom, to = { x: GAMER.x + 56, y: 650, s: 0.42 };
      const e = k * k * (3 - 2 * k);
      this.food = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * 140, s: from.s + (to.s - from.s) * e };
      if (k >= 1) { this.phase = 'eat'; this.eatT = t; this.mood = 'wow'; }
    }
    if (this.phase === 'eat') {
      const k = t - this.eatT;
      const lift = Math.min(1, k / 0.6);
      this.food = { x: GAMER.x + 56 - lift * 26, y: 650 - lift * 56, s: 0.42 };
      [0.9, 1.7, 2.5].forEach((bt, i) => {
        if (k > bt) this.once('bite' + i, () => {
          this.bites = i + 1;
          Sound.play('chomp');
          for (let n = 0; n < 14; n++) this.crumbs.push({ x: this.food.x + 20, y: this.food.y - 10, vx: (Math.random() - 0.3) * 160, vy: -Math.random() * 120, life: 1 });
          this.mood = i === 2 ? 'ecstatic' : 'happy';
        });
      });
      if (k > 2.9) this.once('yum', () => {
        Sound.play('happy');
        const b = $('irlBubble'); b.textContent = pick(['Mmm! It tastes just like in the game!', 'No way... I can EAT my game food!', 'Best. Gaming snack. Ever.']); show(b);
        const h = $('irlHearts'); h.innerHTML = '❤️❤️❤️❤️❤️'; show(h);
        this.caption('Cooked in the game. Printed at home. Eaten in real life.', 3000);
      });
      if (k > 5.6) this.once('back', () => this.finish(false));
    }
    for (const cr of this.crumbs) { cr.x += cr.vx * dt; cr.y += cr.vy * dt; cr.vy += 500 * dt; cr.life -= dt; }
    this.crumbs = this.crumbs.filter((cr) => cr.life > 0);
  },

  startJob() {
    const plan = this.plan;
    $('aiSteps').innerHTML = '';
    hide($('aiRecipe'));
    $('aiRecipeMeta').textContent = `Confidence ${plan.confidence}% · ${this.build.layers.length} layers · AI quality ${plan.quality}%`;
    $('aiLayers').innerHTML = this.build.layers.map((L) => `<li><i style="background:${CARTRIDGES[L.ing.cart].color}"></i>${L.ing.name}</li>`).join('');
    $('aiPanel').classList.add('irl');
    show($('aiPanel'));
    const steps = $('aiSteps');
    const finishStep = (i) => {
      const li = steps.children[i];
      if (!li || li.dataset.done) return;
      li.dataset.done = '1';
      li.querySelector('.ico').className = 'ico ok';
      li.insertAdjacentHTML('beforeend', `<span class="res ${plan.steps[i].warn ? 'warn' : ''}">→ ${plan.steps[i].result}</span>`);
    };
    const pr = this.printer;
    this.job = new PrintJob(pr, this.build, plan, this.order.name, (ev, i) => {
      switch (ev) {
        case 'start': Sound.play('doorClose'); break;
        case 'step':
          if (i > 0) finishStep(i - 1);
          steps.insertAdjacentHTML('beforeend', `<li><span class="ico spin"></span> ${plan.steps[i].text}</li>`);
          Sound.play('beep');
          break;
        case 'verified': finishStep(plan.steps.length - 1); show($('aiRecipe')); Sound.play('confirm'); break;
        case 'begin': Sound.play('servo'); Sound.loop('motor', 0.35); break;
        case 'layer': {
          const lis = $('aiLayers').children;
          for (let k = 0; k < lis.length; k++) lis[k].className = k < i ? 'done' : k === i ? 'now' : '';
          Sound.play('layer'); if (i % 2) Sound.play('servo');
          break;
        }
        case 'complete':
          [...$('aiLayers').children].forEach((li) => (li.className = 'done'));
          Sound.loop('motor', 0);
          pr.state.flash = 1; pr.sparkle(PLATFORM.x, PLATFORM.y - 80, 40);
          Sound.play('synthComplete');
          break;
        case 'quality': Sound.play('check'); break;
        case 'open': Sound.play('doorOpen'); Sound.play('steam'); pr.sparkle(PLATFORM.x, PLATFORM.y - 60, 25); break;
        case 'transfer': this.pendingPickup = true; break;
      }
    });
  },

  pickup() {
    const pr = this.printer, s = pr.state;
    this.foodFrom = { x: IRL_PRINTER.x + s.food.x * IRL_PRINTER.s, y: IRL_PRINTER.y + (s.food.y - 6) * IRL_PRINTER.s, s: s.food.s * IRL_PRINTER.s };
    this.job = null;
    s.build = null; s.food = null; s.mode = 'idle'; s.seal = 0; s.present = 0;
    s.screen = { title: 'ENJOY YOUR FOOD!', lines: ['PRINTED FROM: AI FOOD FACTORY', 'BON APPÉTIT ♥'], progress: null, color: '#9dffb0' };
    hide($('aiPanel'));
    Sound.loop('printerHum', 0);
    Sound.play('whoosh');
    this.phase = 'pickup';
    this.pickT = this.t;
    this.cam(700, 520, 1.3);
    this.caption("That's the real player — grabbing the printed food!", 2400);
  },

  finish(skipped) {
    if (!this.active) return;
    this.active = false;
    this.job = null;
    Sound.loop('printerHum', 0); Sound.loop('motor', 0);
    Sound.setMusicMode('restaurant');
    ['irlPrompt', 'irlBubble', 'irlHearts', 'aiPanel', 'skipBtn'].forEach((id) => hide($(id)));
    $('aiPanel').classList.remove('irl');
    $('irlCaption').classList.remove('show');
    this.cam(null);
    document.getElementById('gameView').style.transform = '';
    setTimeout(() => {
      document.getElementById('stage').classList.remove('irl', 'cinematic');
      Game.afterIrl(skipped);
    }, skipped ? 50 : 1300);
    if (skipped) Sound.play('click');
  },

  /* ---------- drawing ---------- */
  draw(time) {
    if (!this.active) return;
    const c = this.back;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.drawImage(this.room(), 0, 0, 1600, 900);
    // LED strip
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `hsl(${(i * 12 + time * 90) % 360}, 90%, 60%)`;
      c.globalAlpha = 0.9; c.fillRect(i * 40, 26, 36, 6);
      c.globalAlpha = 0.12; c.fillRect(i * 40 - 10, 30, 56, 70);
    }
    c.globalAlpha = 1;
    // PC fans
    for (let i = 0; i < 3; i++) {
      const fx = 1236, fy = 680 + i * 58;
      c.save(); c.translate(fx, fy); c.rotate(time * 8);
      c.strokeStyle = `hsl(${(i * 120 + time * 90) % 360}, 90%, 60%)`; c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.stroke();
      for (let b = 0; b < 4; b++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -6, 16, 0); c.stroke(); }
      c.restore();
    }
    // monitor glow onto the desk
    const g = c.createRadialGradient(800, 560, 20, 800, 560, 420);
    g.addColorStop(0, 'rgba(120,200,255,0.25)'); g.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = g; c.fillRect(380, 540, 840, 80);
    // the cable + data packets
    const uploading = this.phase === 'upload';
    c.lineJoin = 'round';
    c.strokeStyle = uploading ? 'rgba(64,232,255,0.95)' : 'rgba(64,232,255,0.35)';
    c.lineWidth = uploading ? 6 : 4;
    c.shadowColor = '#40e8ff'; c.shadowBlur = uploading ? 18 : 4;
    c.beginPath(); CABLE.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.shadowBlur = 0;
    if (uploading) {
      const k = Math.min(1, (this.t - 3.8) / 2.2);
      for (let n = 0; n < 7; n++) {
        const p = Math.min(1, Math.max(0, k * 1.35 - n * 0.05));
        if (p <= 0 || p >= 1) continue;
        const [x, y] = this.alongCable(p);
        c.save(); c.shadowColor = '#40e8ff'; c.shadowBlur = 14;
        c.fillStyle = '#e8fdff'; c.beginPath(); c.roundRect(x - 13, y - 9, 26, 18, 5); c.fill();
        c.fillStyle = '#12304a'; c.font = '800 10px Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(n % 2 ? '01' : '10', x, y + 1);
        c.restore();
      }
    }
    // printer status light on the side table
    c.fillStyle = this.phase === 'print' ? '#4fd06a' : '#40e8ff';
    c.beginPath(); c.arc(300, 652, 5, 0, Math.PI * 2); c.fill();
    this.printer.draw();
    this.drawFront(time);
  },

  alongCable(p) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < CABLE.length; i++) { const d = Math.hypot(CABLE[i][0] - CABLE[i - 1][0], CABLE[i][1] - CABLE[i - 1][1]); segs.push(d); total += d; }
    let dist = p * total;
    for (let i = 0; i < segs.length; i++) {
      if (dist <= segs[i]) { const a = CABLE[i], b = CABLE[i + 1], k = dist / segs[i]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
      dist -= segs[i];
    }
    return CABLE[CABLE.length - 1];
  },

  drawFront(time) {
    const c = this.front;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 1600, 900);
    // gaming chair spins round: back view → front view
    const spin = this.chair;
    const sx = Math.cos(spin * Math.PI);
    c.save();
    c.translate(GAMER.x, 0); c.scale(Math.max(0.04, Math.abs(sx)), 1); c.translate(-GAMER.x, 0);
    if (sx >= 0) this.drawGamerBack(c, time);
    else this.drawGamerFront(c, time);
    c.restore();
    // food in flight / in hand
    if (this.food && this.build) {
      if (this.phase === 'eat' && sx < 0) {
        // raised arm holding the food
        c.strokeStyle = shade(GAMER_LOOK.shirt, -0.12); c.lineWidth = 36; c.lineCap = 'round';
        c.beginPath(); c.moveTo(GAMER.x + 92, 640); c.quadraticCurveTo(GAMER.x + 110, 620, this.food.x + 10, this.food.y + 30); c.stroke();
      }
      this.drawBittenFood(c, this.food.x, this.food.y, this.food.s);
      if (this.phase === 'eat' && sx < 0) { dot(c, this.food.x + 14, this.food.y + 34, 20, GAMER_LOOK.skin); }
    }
    for (const cr of this.crumbs) { c.globalAlpha = Math.max(0, cr.life); dot(c, cr.x, cr.y, 4, '#d9a35a'); }
    c.globalAlpha = 1;
  },

  drawGamerBack(c, time) {
    const x = GAMER.x;
    const bob = Math.sin(time * 6) * 2;
    // head peeking over the chair
    dot(c, x, 452 + bob, 66, GAMER_LOOK.hair);
    c.strokeStyle = '#1d2733'; c.lineWidth = 12; c.beginPath(); c.arc(x, 458 + bob, 70, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.fillStyle = GAMER_LOOK.accColor; c.beginPath(); c.roundRect(x - 84, 440 + bob, 22, 46, 10); c.roundRect(x + 62, 440 + bob, 22, 46, 10); c.fill();
    // shoulders
    c.fillStyle = GAMER_LOOK.shirt; c.beginPath(); c.roundRect(x - 140, 540, 280, 200, 70); c.fill();
    this.drawChairBack(c, x);
  },
  drawChairBack(c, x) {
    const g = c.createLinearGradient(x - 120, 0, x + 120, 0);
    g.addColorStop(0, '#15151c'); g.addColorStop(0.5, '#2b2b36'); g.addColorStop(1, '#15151c');
    c.fillStyle = g; c.beginPath(); c.roundRect(x - 118, 500, 236, 330, 50); c.fill();
    c.fillStyle = '#ff2d55'; c.fillRect(x - 70, 510, 22, 310); c.fillRect(x + 48, 510, 22, 310);
    c.fillStyle = '#1d1d26'; c.fillRect(x - 12, 830, 24, 50);
    c.fillStyle = '#111'; c.beginPath(); c.ellipse(x, 885, 140, 14, 0, 0, Math.PI * 2); c.fill();
    c.font = '900 22px Orbitron, Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillText('PLAYER 1', x, 620);
  },
  drawGamerFront(c, time) {
    const x = GAMER.x;
    // chair behind, seen from the front
    c.fillStyle = '#1d1d26'; c.beginPath(); c.roundRect(x - 125, 380, 250, 450, 50); c.fill();
    c.fillStyle = '#ff2d55'; c.fillRect(x - 78, 395, 20, 420); c.fillRect(x + 58, 395, 20, 420);
    drawCustomer(this.gamerCtx, GAMER_LOOK, this.mood, time, { raiseRight: this.phase === 'eat' });
    const s = GAMER.scale;
    c.drawImage(this.gamerCv, x - 130 * s, GAMER.headY - 150 * s, 260 * s, 420 * s);
    c.fillStyle = '#111'; c.beginPath(); c.ellipse(x, 885, 140, 14, 0, 0, Math.PI * 2); c.fill();
  },
  drawBittenFood(c, x, y, s) {
    const bc = this.biteCv, b = bc.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, 600, 500);
    drawFood(b, this.build, 300, 330, 1, null, true);
    if (this.bites) {
      b.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < this.bites; i++) {
        const bx = 300 + 120 - i * 70, by = 300 - 40 + (i % 2) * 30;
        for (let k = 0; k < 5; k++) { b.beginPath(); b.arc(bx + Math.cos(k * 1.3) * 26, by + Math.sin(k * 1.3) * 30, 34, 0, Math.PI * 2); b.fill(); }
      }
      b.globalCompositeOperation = 'source-over';
    }
    c.drawImage(bc, x - 300 * s, y - 330 * s, 600 * s, 500 * s);
  },

  /* static room drawing, cached */
  room() {
    if (this.roomCache) return this.roomCache;
    const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 1800;
    const c = cv.getContext('2d'); c.scale(2, 2);
    // wall
    const w = c.createLinearGradient(0, 0, 0, 820);
    w.addColorStop(0, '#1a1336'); w.addColorStop(1, '#2d2160');
    c.fillStyle = w; c.fillRect(0, 0, 1600, 900);
    c.fillStyle = 'rgba(255,255,255,0.03)'; for (let x = 0; x < 1600; x += 80) c.fillRect(x, 0, 2, 820);
    // window at night
    c.fillStyle = '#0b0f24'; c.beginPath(); c.roundRect(1330, 90, 240, 290, 12); c.fill();
    const sky = c.createLinearGradient(0, 100, 0, 370); sky.addColorStop(0, '#0d1b4a'); sky.addColorStop(1, '#3a2a6e');
    c.fillStyle = sky; c.fillRect(1342, 102, 216, 266);
    dot(c, 1510, 150, 22, '#fff6c8'); dot(c, 1518, 144, 20, '#0d1b4a');
    for (let i = 0; i < 9; i++) { c.fillStyle = '#121a3a'; const bh = 60 + ((i * 47) % 110); c.fillRect(1342 + i * 24, 368 - bh, 22, bh); for (let k = 0; k < 6; k++) if ((i + k) % 3) { c.fillStyle = 'rgba(255,220,120,0.7)'; c.fillRect(1346 + i * 24, 372 - bh + k * 14, 5, 6); } }
    c.strokeStyle = '#3a3f5c'; c.lineWidth = 8; c.strokeRect(1342, 102, 216, 266); c.beginPath(); c.moveTo(1450, 102); c.lineTo(1450, 368); c.stroke();
    // game poster
    c.fillStyle = '#0b1a2e'; c.beginPath(); c.roundRect(110, 80, 230, 210, 10); c.fill();
    c.strokeStyle = '#40e8ff'; c.lineWidth = 3; c.stroke();
    drawFood(c, buildFood(FOOD_BY_ID.burger, AI.defaultSelection(FOOD_BY_ID.burger)), 225, 210, 0.5);
    c.font = '800 20px Orbitron, Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#bff8ff'; c.fillText('AI FOOD', 225, 118); c.fillText('FACTORY', 225, 142);
    c.font = '700 11px Arial'; c.fillStyle = '#ffc83d'; c.fillText('NOW WITH PRINT-AT-HOME', 225, 272);
    // shelf with collectibles
    c.fillStyle = '#4a3a2a'; c.fillRect(1330, 430, 240, 12);
    [['#ff4d8d', 26], ['#40e8ff', 34], ['#ffc83d', 22], ['#4fd06a', 30]].forEach(([col, h], i) => { c.fillStyle = col; c.beginPath(); c.roundRect(1350 + i * 56, 430 - h - 14, 26, h, 6); c.fill(); dot(c, 1363 + i * 56, 430 - h - 22, 11, col); });
    // floor + rug
    const fl = c.createLinearGradient(0, 820, 0, 900); fl.addColorStop(0, '#3b2a22'); fl.addColorStop(1, '#22170f');
    c.fillStyle = fl; c.fillRect(0, 820, 1600, 80);
    c.fillStyle = 'rgba(122,60,255,0.35)'; c.beginPath(); c.ellipse(800, 880, 420, 40, 0, 0, Math.PI * 2); c.fill();
    // desk
    c.fillStyle = '#16161e'; c.fillRect(320, 590, 18, 240); c.fillRect(1262, 590, 18, 240);
    const dg = c.createLinearGradient(0, 556, 0, 596); dg.addColorStop(0, '#3a3a48'); dg.addColorStop(1, '#1d1d26');
    c.fillStyle = dg; c.beginPath(); c.roundRect(300, 556, 1000, 40, 8); c.fill();
    c.fillStyle = '#ff2d55'; c.fillRect(300, 594, 1000, 3);
    // monitor bezel + stand
    c.fillStyle = '#26262e'; c.fillRect(770, 540, 60, 20); c.beginPath(); c.roundRect(720, 552, 160, 10, 4); c.fill();
    c.fillStyle = '#0b0b10'; c.beginPath(); c.roundRect(MONITOR.x - 14, MONITOR.y - 14, MONITOR.w + 28, MONITOR.h + 34, 14); c.fill();
    c.fillStyle = '#9aa7b4'; c.font = '700 10px Arial'; c.textAlign = 'center'; c.fillText('GAMEMASTER 4K', 800, MONITOR.y + MONITOR.h + 14);
    // keyboard + mouse + mug
    c.fillStyle = '#111'; c.beginPath(); c.roundRect(640, 560, 250, 22, 6); c.fill();
    for (let i = 0; i < 20; i++) { c.fillStyle = `hsl(${i * 18}, 90%, 60%)`; c.fillRect(648 + i * 12, 565, 9, 5); c.fillRect(648 + i * 12, 573, 9, 4); }
    c.fillStyle = '#111'; c.beginPath(); c.ellipse(930, 570, 16, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8eef5'; c.beginPath(); c.roundRect(400, 520, 40, 40, 6); c.fill(); c.strokeStyle = '#e8eef5'; c.lineWidth = 5; c.beginPath(); c.arc(444, 540, 10, -1.2, 1.2); c.stroke();
    // PC tower
    c.fillStyle = '#121218'; c.beginPath(); c.roundRect(1188, 620, 96, 240, 10); c.fill();
    c.fillStyle = 'rgba(160,120,255,0.15)'; c.fillRect(1196, 630, 80, 220);
    // side table for the food printer
    c.fillStyle = '#2a2a36'; c.beginPath(); c.roundRect(30, 640, 320, 22, 6); c.fill();
    c.fillRect(50, 660, 16, 200); c.fillRect(314, 660, 16, 200);
    c.font = '800 13px Orbitron, Arial'; c.fillStyle = '#9ff4ff'; c.textAlign = 'center'; c.fillText('HOME FOOD PRINTER', 190, 690);
    return (this.roomCache = cv);
  },
};
