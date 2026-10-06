/* =========================================================
   AI FOOD FACTORY — KITCHEN STATIONS
   The hands-on cooking part of the game:
     GRILL   — patties, chicken, franks, pancakes (flip once!)
     FRYER   — fries, crispy chicken, nuggets, donuts
     PIZZA   — dough → stretch → toppings → oven
     TACO    — warm the shell → fillings
     PREP    — burgers, sandwiches, hot dogs, nuggets
     DESSERT — ice cream, donuts, pancakes, cupcakes
     DRINKS  — fountain machine (hold to fill)
   Each station is drawn on one canvas (equipment, food,
   particles) with real HTML buttons laid over it.
   Cooking keeps running even when you look at another station.
   ========================================================= */
const KW = 1600, KH = 760, KDPR = 1.5;
const GRILL_SLOTS = [455, 680, 905, 1130];
const VATS = [490, 810];

// Which food each base ingredient starts, per build station
const BUILD_STATIONS = ['prep', 'taco', 'dessert'];
function stationFoods(station) { return FOODS.filter((f) => f.station === station && f.unlock <= Game.level); }
function baseIdsFor(food) {
  const first = food.printing[0];
  if (typeof first === 'string') return [first];
  const g = food.groups.find((x) => x.id === first.group);
  return g.options.flatMap((o) => o.layers.slice(0, 1));
}
// All ingredient ids that can go on a food (except its base), in a sensible bin order
function binIdsFor(food) {
  const ids = [];
  const push = (id) => { if (!ids.includes(id)) ids.push(id); };
  food.printing.forEach((step, i) => {
    if (typeof step === 'string') { if (i > 0) push(step); return; }
    const g = food.groups.find((x) => x.id === step.group);
    if (i === 0 && !step.key) return; // the base group
    g.options.forEach((o) => (step.key ? o[step.key] || [] : o.layers).forEach(push));
  });
  return ids;
}
const ingName = (id) => INGREDIENTS[id].name;

const Kitchen = {
  station: 'front',
  uid: 1,
  floaters: [],
  particles: [],
  bgCache: {},
  lastHtml: '',
  t: 0,

  /* ---------------- per-order state ---------------- */
  resetOrder() {
    this.holding = [];
    this.grill = { on: false, slots: [null, null, null, null] };
    this.fryer = { baskets: [{ item: null, down: false, y: 0 }, { item: null, down: false, y: 0 }] };
    this.dump = null;
    this.pizza = { stage: 'empty', stretch: 0, items: [], bake: 0, inOven: false, ovenOn: false, baked: false, wobble: 0 };
    this.warmer = null;
    this.builds = { prep: { foodId: null, items: [] }, taco: { foodId: null, items: [] }, dessert: { foodId: null, items: [] } };
    this.drinkState = { cup: false, flavor: null, fill: 0, pouring: false, overflow: 0 };
    this.main = null;      // finished main food waiting for the AI check
    this.side = null;      // boxed fries
    this.drinkOut = null;  // finished drink
    this.qc = null;        // AI quality check overlay state
    this.floaters = [];
    this.particles = [];
    this.dropAnim = null;
    this.lastHtml = '';
    Sound.stopAllLoops();
  },

  init() {
    this.canvas = document.getElementById('kitchenCanvas');
    this.c = this.canvas.getContext('2d');
    this.ui = document.getElementById('stationUI');
    this.resetOrder();
    this.ui.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      this.act(b.dataset.act, b.dataset.arg);
    });
    // hold-to-fill for the drink fountain
    this.ui.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-hold="fill"]')) this.startPour(); });
    window.addEventListener('pointerup', () => this.stopPour());
    window.addEventListener('pointercancel', () => this.stopPour());
  },

  show(station) {
    if (station !== this.station) { this.floaters = []; this.particles = []; }
    this.station = station;
    this.lastHtml = '';
  },

  floater(text, x, y, color = '#ffffff', size = 34, key = null) {
    if (key) this.floaters = this.floaters.filter((f) => f.key !== key);
    this.floaters.push({ text, x, y, color, size, life: 1.6, max: 1.6, key });
  },
  puff(x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const p = { x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 40, life: 1 + Math.random() * 1.2, kind, r: 8 + Math.random() * 10 };
      if (kind === 'flour') { p.vx = (Math.random() - 0.5) * 160; p.vy = -60 - Math.random() * 80; p.r = 3 + Math.random() * 5; p.life = 0.8; }
      if (kind === 'spark') { p.vx = (Math.random() - 0.5) * 200; p.vy = -80 - Math.random() * 120; p.r = 2 + Math.random() * 2; p.life = 0.6; }
      this.particles.push(p);
    }
  },
  notifyAway(station, text) {
    if (this.station !== station && ['cooking', 'ready'].includes(Game.phase)) Game.notify(`${STATIONS.find((s) => s.id === station).icon} ${text}`);
  },

  /* ---------------- order helpers ---------------- */
  orderFood() { return Game.order ? FOOD_BY_ID[Game.order.foodId] : null; },
  required() { const f = this.orderFood(); return f ? resolveLayers(f, Game.order.sel) : []; },
  neededCooked() {
    // cooked ingredients the order needs, minus ones already cooked/cooking/used
    const need = this.required().filter((id) => INGREDIENTS[id].cook === 'grill' || INGREDIENTS[id].cook === 'fryer');
    const have = [
      ...this.holding.map((h) => h.id),
      ...this.grill.slots.filter(Boolean).map((s) => s.id),
      ...this.fryer.baskets.filter((b) => b.item).map((b) => b.item.id),
      ...Object.values(this.builds).flatMap((b) => b.items.map((i) => i.id)),
      ...(this.main ? this.main.items.map((i) => i.id) : []),
    ];
    const left = [...need];
    for (const h of have) { const k = left.indexOf(h); if (k >= 0) left.splice(k, 1); }
    return left;
  },
  holdingCount(id) { return this.holding.filter((h) => h.id === id).length; },

  /* =========================================================
     ACTIONS (from buttons)
     ========================================================= */
  act(act, arg) {
    const [st, what] = act.split('.');
    const fn = this.actions[st] && this.actions[st][what];
    if (fn) fn.call(this, arg);
    this.lastHtml = '';
  },

  actions: {
    grill: {
      ignite() {
        this.grill.on = !this.grill.on;
        Sound.play(this.grill.on ? 'ignite' : 'click');
        this.floater(this.grill.on ? 'GRILL ON 🔥' : 'GRILL OFF', 790, 240, this.grill.on ? '#ffb347' : '#cfe6ff');
      },
      place(id) {
        const i = this.grill.slots.findIndex((s) => !s);
        if (i < 0) { Sound.play('error'); this.floater('GRILL FULL', 790, 330, '#ff6b81'); return; }
        this.grill.slots[i] = { uid: this.uid++, id, s: [0, 0], down: 0, flips: 0, warned: {} };
        Sound.play('place');
        if (this.grill.on) Sound.play('sizzleBurst');
        this.floater('PLACED', GRILL_SLOTS[i], 340, '#ffffff');
        if (!this.grill.on) setTimeout(() => this.floater('Turn the grill on! 🔥', 790, 230, '#ffd84a', 26), 300);
      },
      flip(i) {
        const it = this.grill.slots[+i];
        if (!it) return;
        it.down = 1 - it.down; it.flips++; it.flipAnim = 0.45;
        Sound.play('flip');
        this.floater('FLIPPED!', GRILL_SLOTS[+i], 320, '#9ff4ff');
        this.puff(GRILL_SLOTS[+i], 360, 6, 'steam');
      },
      take(i) {
        const it = this.grill.slots[+i];
        if (!it) return;
        const res = cookResult(it);
        this.holding.push({ uid: it.uid, id: it.id, cook: (it.s[0] + it.s[1]) / 2, marks: true, q: res.score, label: res.label, color: res.color });
        this.grill.slots[+i] = null;
        Sound.play(res.label === 'PERFECT' ? 'perfect' : res.score < 0.5 ? 'burnt' : 'place');
        this.floater(res.label === 'PERFECT' ? 'PERFECT COOK!' : res.label + '!', GRILL_SLOTS[+i], 330, res.color, 40);
      },
    },
    fryer: {
      load(id) {
        const b = this.fryer.baskets.find((x) => !x.item);
        if (!b) { Sound.play('error'); this.floater('BASKETS FULL', 650, 300, '#ff6b81'); return; }
        b.item = { uid: this.uid++, id, cook: 0, warned: {} };
        Sound.play('place');
        this.floater('LOADED', VATS[this.fryer.baskets.indexOf(b)], 230, '#ffffff');
      },
      drop(i) {
        const b = this.fryer.baskets[+i];
        if (!b.item) return;
        b.down = true;
        Sound.play('basketDown');
        this.floater('FRYING...', VATS[+i], 260, '#ffd84a');
        this.puff(VATS[+i], 340, 10, 'steam');
      },
      lift(i) {
        const b = this.fryer.baskets[+i];
        if (!b.item) return;
        b.down = false;
        const res = cookResult(b.item);
        Sound.play('basketUp');
        setTimeout(() => Sound.play(res.label === 'PERFECT' ? 'perfect' : res.score < 0.5 ? 'burnt' : 'place'), 150);
        this.floater(res.label === 'PERFECT' ? 'PERFECT FRY!' : res.label + '!', VATS[+i], 250, res.color, 40);
        if (b.item.id === 'friesReg') this.dump = { cook: b.item.cook, q: res.score, label: res.label };
        else this.holding.push({ uid: b.item.uid, id: b.item.id, cook: b.item.cook, q: res.score, label: res.label, color: res.color });
        b.item = null;
      },
      season(season) {
        if (!this.dump) return;
        this.side = { id: 'fries', season, cook: this.dump.cook, q: this.dump.q, label: this.dump.label };
        this.dump = null;
        Sound.play(season === 'plain' ? 'place' : 'sprinkle');
        setTimeout(() => Sound.play('confirm'), 200);
        this.floater('FRIES BOXED ✓', 1137, 420, '#2fcf6a', 36);
        Game.onItemReady('side');
      },
    },
    pizza: {
      dough() {
        const p = this.pizza;
        if (p.stage !== 'empty') { Sound.play('error'); this.floater('Finish this pizza first', 450, 420, '#ff6b81', 26); return; }
        p.stage = 'ball'; p.stretch = 0; p.items = [{ id: 'dough' }];
        Sound.play('place');
        this.floater('DOUGH PLACED', 450, 470, '#ffffff');
      },
      stretch() {
        const p = this.pizza;
        if (p.stage !== 'ball') return;
        p.stretch = Math.min(1, p.stretch + 0.25); p.wobble = 1;
        Sound.play('stretch'); Sound.play('flour');
        this.puff(450, 560, 14, 'flour');
        if (p.stretch >= 1) { p.stage = 'top'; this.floater('PERFECT SHAPE!', 450, 440, '#2fcf6a', 38); Sound.play('perfect'); }
        else this.floater(`STRETCHING ${Math.round(p.stretch * 100)}%`, 450, 420, '#ffffff', 28, 'add');
      },
      add(id) {
        const p = this.pizza;
        if (p.stage !== 'top') { Sound.play('error'); this.floater(p.stage === 'ball' ? 'Stretch the dough first!' : 'Start with dough!', 450, 420, '#ff6b81', 26); return; }
        p.items.push({ id });
        this.dropAnim = { station: 'pizza', t: 0 };
        Sound.play(INGREDIENTS[id].shape === 'pizzaSauce' ? 'squirt' : INGREDIENTS[id].shape === 'scatter' ? 'sprinkle' : 'plop');
        this.floater(`${ingName(id).toUpperCase()} ADDED`, 450, 400, '#ffffff', 26, 'add');
      },
      oven() {
        const p = this.pizza;
        if (p.stage !== 'top') return;
        p.stage = 'oven'; p.bake = 0; p.ovenOn = true; p.warned = {};
        Sound.play('ovenDoor');
        this.floater('INTO THE OVEN!', 1077, 300, '#ffb347', 34);
      },
      takeOut() {
        const p = this.pizza;
        if (p.stage !== 'oven') return;
        p.stage = 'baked'; p.ovenOn = false;
        const res = cookResult({ cook: p.bake });
        p.result = res;
        p.items = p.items.map((it) => (INGREDIENTS[it.id].colors ? { ...it, cook: p.bake } : it));
        Sound.play('ovenDoor');
        setTimeout(() => Sound.play(res.label === 'PERFECT' ? 'perfect' : 'warn'), 200);
        this.floater(res.label === 'PERFECT' ? 'PERFECT BAKE!' : res.label + '!', 450, 420, res.color, 40);
      },
      undo() {
        const p = this.pizza;
        if (p.stage === 'top' && p.items.length > 1) { p.items.pop(); Sound.play('trash'); }
      },
      trash() {
        this.pizza = { stage: 'empty', stretch: 0, items: [], bake: 0, inOven: false, ovenOn: false, baked: false, wobble: 0 };
        Sound.play('trash');
        this.floater('TRASHED', 450, 450, '#ff6b81');
      },
      finish() {
        const p = this.pizza;
        if (p.stage !== 'baked') return;
        Kitchen.finishMain('pizza', 'pizza', p.items, { cookItems: [{ name: 'Pizza bake', q: p.result.score, label: p.result.label }] });
      },
    },
    taco: {
      shell(id) {
        if (this.warmer) { Sound.play('error'); this.floater('Warmer is busy', 250, 380, '#ff6b81', 26); return; }
        if (this.builds.taco.foodId) { Sound.play('error'); this.floater('Taco already started', 745, 420, '#ff6b81', 26); return; }
        this.warmer = { id, cook: 0, warned: {} };
        Sound.play('place'); Sound.play('sizzleBurst');
        this.floater('WARMING...', 250, 380, '#ffd84a');
      },
      toHolder() {
        if (!this.warmer) return;
        const res = cookResult(this.warmer);
        this.builds.taco = { foodId: 'tacos', items: [{ id: this.warmer.id, cook: this.warmer.cook, q: res.score, label: res.label }] };
        this.warmer = null;
        Sound.play('place');
        this.floater(res.label === 'PERFECT' ? 'PERFECTLY WARM!' : res.label + '!', 745, 430, res.color, 34);
        this.dropAnim = { station: 'taco', t: 0 };
      },
    },
    build: {
      add(id) { Kitchen.buildAdd(id); },
      undo() {
        const b = this.builds[this.station];
        if (!b || !b.items.length) return;
        const it = b.items.pop();
        if (it.uid) this.holding.push(it); // cooked items go back to the heat lamp
        if (!b.items.length) b.foodId = null;
        Sound.play('trash');
        this.floater('REMOVED', 560, 430, '#ffb3c7', 28);
      },
      trash() {
        const b = this.builds[this.station];
        b.items.forEach((it) => { if (it.uid) this.holding.push(it); });
        this.builds[this.station] = { foodId: null, items: [] };
        Sound.play('trash');
        this.floater('CLEARED', 560, 450, '#ff6b81');
      },
      finish() {
        const b = this.builds[this.station];
        if (!b.foodId || b.items.length < 2) { Sound.play('error'); return; }
        const cookItems = b.items.filter((i) => i.q != null).map((i) => ({ name: ingName(i.id), q: i.q, label: i.label }));
        Kitchen.finishMain(this.station, b.foodId, b.items, { cookItems });
      },
    },
    drink: {
      cup() { if (this.drinkState.cup || this.drinkOut) return; this.drinkState.cup = true; Sound.play('place'); this.floater('CUP PLACED', 655, 470, '#ffffff'); },
      flavor(id) { const d = this.drinkState; if (d.fill > 0) { Sound.play('error'); this.floater('Cup already has a drink', 655, 420, '#ff6b81', 26); return; } d.flavor = id; Sound.play('toggle'); },
      lid() {
        const d = this.drinkState;
        if (!d.cup || d.fill < 0.1) return;
        this.drinkOut = { id: d.flavor, fill: d.fill, overflow: d.overflow };
        this.drinkState = { cup: false, flavor: null, fill: 0, pouring: false, overflow: 0 };
        Sound.play('lid'); setTimeout(() => Sound.play('confirm'), 150);
        this.floater('DRINK READY ✓', 655, 420, '#2fcf6a', 38);
        Game.onItemReady('drink');
      },
      dump() { this.drinkState = { cup: this.drinkState.cup, flavor: null, fill: 0, pouring: false, overflow: 0 }; Sound.play('trash'); },
    },
    qc: {
      fix() { Kitchen.qc = null; Kitchen.main = null; Sound.play('click'); },
      send() { Sound.play('confirm'); Kitchen.qc = null; Game.plateMain(); },
    },
  },

  buildAdd(id) {
    const st = this.station;
    const b = this.builds[st];
    const ing = INGREDIENTS[id];
    // first item decides which food is being built
    if (!b.foodId) {
      const food = stationFoods(st).find((f) => baseIdsFor(f).includes(id));
      if (!food) return;
      b.foodId = food.id;
    }
    let item = { id };
    if (ing.cook === 'grill' || ing.cook === 'fryer') {
      const k = this.holding.findIndex((h) => h.id === id);
      if (k < 0) { Sound.play('error'); this.floater(`Cook it first at the ${ing.cook.toUpperCase()}!`, 560, 420, '#ff6b81', 28); if (!b.items.length) b.foodId = null; return; }
      item = this.holding.splice(k, 1)[0];
    }
    b.items.push(item);
    this.dropAnim = { station: st, t: 0 };
    const sh = ing.shape;
    Sound.play(['sauce', 'syrupTop', 'scoopSyrup', 'zigzag', 'pizzaSauce'].includes(sh) ? 'squirt' : ['sprinkle', 'scoopSprinkles', 'donutSprinkles', 'cupSprinkles', 'scatter', 'hdDots'].includes(sh) ? 'sprinkle' : 'plop');
    this.floater(`${ing.name.toUpperCase()} ADDED`, 560, 420, '#ffffff', 26, 'add');
  },

  finishMain(station, foodId, items, extra) {
    this.main = { station, foodId, items: items.map((i) => ({ ...i })), cookItems: extra.cookItems || [] };
    this.qc = { t: 0, result: AI.qualityCheck(Game.order, this.main), shown: 0, done: false };
    Sound.play('scanStart');
    Game.onQC();
  },

  startPour() {
    const d = this.drinkState;
    if (this.station !== 'drinks' || !d.cup || !d.flavor) { if (this.station === 'drinks') { Sound.play('error'); this.floater(!d.cup ? 'Place a cup first' : 'Pick a flavor first', 655, 420, '#ff6b81', 26); } return; }
    d.pouring = true;
    Sound.play('pourStart');
  },
  stopPour() {
    const d = this.drinkState;
    if (!d || !d.pouring) return;
    d.pouring = false;
    const err = Math.abs(d.fill - DRINK_TARGET);
    if (d.overflow > 0) this.floater('OVERFLOW!', 655, 420, '#ff6b81', 36);
    else if (err < 0.05) { this.floater('PERFECT POUR!', 655, 420, '#2fcf6a', 36); Sound.play('perfect'); }
    else if (d.fill < DRINK_TARGET) this.floater('A BIT LOW', 655, 420, '#ffd84a', 30);
    else this.floater('A BIT FULL', 655, 420, '#ffd84a', 30);
  },

  /* =========================================================
     UPDATE (runs every frame, on every screen)
     ========================================================= */
  update(dt) {
    this.t += dt;
    if (!this.grill) return;
    const paused = !['cooking', 'ready'].includes(Game.phase);
    const here = (st) => (this.station === st ? 1 : 0.3);

    // ---- grill ----
    let grillItems = 0;
    this.grill.slots.forEach((it, i) => {
      if (!it) return;
      grillItems++;
      if (it.flipAnim > 0) it.flipAnim -= dt;
      if (!this.grill.on || paused) return;
      const ing = INGREDIENTS[it.id];
      it.s[it.down] += dt / ing.time;
      const v = it.s[it.down], x = GRILL_SLOTS[i];
      if (Math.random() < dt * (v > 1.2 ? 9 : 3)) this.puff(x, 350, 1, v > 1.2 ? 'smoke' : 'steam');
      const w = it.warned;
      const key = (k) => `${k}${it.flips}`;
      if (v >= 0.9 && !w[key('p')]) {
        w[key('p')] = 1;
        const other = it.s[1 - it.down];
        const msg = it.flips === 0 ? 'FLIP!' : other >= 0.75 ? 'PERFECT! TAKE IT OFF' : 'FLIP AGAIN!';
        this.floater(msg, x, 320, '#2fcf6a', 34); Sound.play('ding');
        this.notifyAway('grill', `${ing.name}: ${msg}`);
      }
      if (v >= 1.13 && !w[key('o')]) { w[key('o')] = 1; this.floater('OVERCOOKING!', x, 320, '#ff9a3d', 34); Sound.play('warn'); this.notifyAway('grill', `${ing.name} is overcooking!`); }
      if (v >= 1.38 && !w[key('b')]) { w[key('b')] = 1; this.floater('BURNT!', x, 320, '#ff4d6d', 40); Sound.play('burnt'); }
    });
    Sound.loop('sizzle', this.grill.on ? (0.12 + grillItems * 0.18) * here('grill') : 0);

    // ---- fryer ----
    let frying = 0;
    this.fryer.baskets.forEach((b, i) => {
      const target = b.down ? 1 : 0;
      b.y += (target - b.y) * Math.min(1, dt * 8);
      if (!b.item || !b.down || paused) return;
      frying++;
      const ing = INGREDIENTS[b.item.id];
      b.item.cook += dt / ing.time;
      const v = b.item.cook, x = VATS[i], w = b.item.warned;
      if (Math.random() < dt * 5) this.puff(x, 330, 1, 'steam');
      if (v >= 0.9 && !w.p) { w.p = 1; this.floater('PERFECT! LIFT IT', x, 240, '#2fcf6a', 32); Sound.play('ding'); this.notifyAway('fryer', `${ing.name}: ready to lift!`); }
      if (v >= 1.13 && !w.o) { w.o = 1; this.floater('OVERCOOKING!', x, 240, '#ff9a3d', 32); Sound.play('warn'); this.notifyAway('fryer', `${ing.name} is overcooking!`); }
      if (v >= 1.38 && !w.b) { w.b = 1; this.floater('BURNT!', x, 240, '#ff4d6d', 40); Sound.play('burnt'); }
    });
    Sound.loop('fryer', frying ? (0.25 + frying * 0.2) * here('fryer') : 0);

    // ---- pizza oven ----
    const p = this.pizza;
    if (p.wobble > 0) p.wobble = Math.max(0, p.wobble - dt * 3);
    if (p.stage === 'oven' && !paused) {
      p.bake += dt / INGREDIENTS.dough.time;
      const w = p.warned;
      if (p.bake >= 0.9 && !w.p) { w.p = 1; this.floater('PERFECT! TAKE IT OUT', 1077, 300, '#2fcf6a', 30); Sound.play('ding'); this.notifyAway('pizza', 'Pizza is perfectly baked!'); }
      if (p.bake >= 1.13 && !w.o) { w.o = 1; this.floater('OVERCOOKING!', 1077, 300, '#ff9a3d', 32); Sound.play('warn'); this.notifyAway('pizza', 'Pizza is overcooking!'); }
      if (p.bake >= 1.38 && !w.b) { w.b = 1; this.floater('BURNT!', 1077, 300, '#ff4d6d', 40); Sound.play('burnt'); }
    }
    Sound.loop('oven', p.stage === 'oven' ? 0.5 * here('pizza') : 0);

    // ---- taco warmer ----
    if (this.warmer && !paused) {
      this.warmer.cook += dt / INGREDIENTS[this.warmer.id].time;
      const w = this.warmer.warned, v = this.warmer.cook;
      if (v >= 0.9 && !w.p) { w.p = 1; this.floater('WARM! MOVE TO HOLDER', 250, 380, '#2fcf6a', 28); Sound.play('ding'); this.notifyAway('taco', 'Taco shell is warm!'); }
      if (v >= 1.13 && !w.o) { w.o = 1; this.floater('GETTING TOO HOT!', 250, 380, '#ff9a3d', 28); Sound.play('warn'); }
    }

    // ---- drink fountain ----
    const d = this.drinkState;
    if (d.pouring) {
      d.fill += dt * 0.3;
      if (d.fill > 1) { d.overflow += dt; d.fill = 1; }
    }
    Sound.loop('pour', d.pouring ? 0.6 : 0);

    // ---- effects ----
    for (const f of this.floaters) { f.life -= dt; f.y -= dt * 40; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const q of this.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; if (q.kind === 'flour' || q.kind === 'spark') q.vy += 260 * dt; else q.r += dt * 10; }
    this.particles = this.particles.filter((q) => q.life > 0).slice(-220);
    if (this.dropAnim) { this.dropAnim.t += dt * 4; if (this.dropAnim.t >= 1) this.dropAnim = null; }

    // ---- AI quality-check animation ----
    if (this.qc && !this.qc.done) {
      this.qc.t += dt;
      const n = Math.min(this.qc.result.checks.length, Math.floor((this.qc.t - 0.5) / 0.45) + 1);
      if (n > this.qc.shown && this.qc.t > 0.5) { this.qc.shown = n; Sound.play(this.qc.result.checks[n - 1].ok ? 'check' : 'alert'); }
      if (Math.random() < dt * 10) Sound.play('scanBeep');
      if (this.qc.t > 0.5 + this.qc.result.checks.length * 0.45 + 0.4) { this.qc.done = true; Sound.play('confirm'); }
    }
    Sound.loop('scan', this.qc && !this.qc.done ? 0.5 : 0);
  },

  /* =========================================================
     DRAWING
     ========================================================= */
  draw() {
    const c = this.c;
    c.setTransform(KDPR, 0, 0, KDPR, 0, 0);
    const st = this.station;
    if (st === 'front') return;
    c.drawImage(this.background(st), 0, 0, KW, KH);
    this['draw_' + st](c, this.t);
    // particles
    for (const q of this.particles) {
      const a = Math.min(1, q.life);
      if (q.kind === 'steam') { c.fillStyle = `rgba(255,255,255,${0.22 * a})`; }
      else if (q.kind === 'smoke') { c.fillStyle = `rgba(60,60,60,${0.35 * a})`; }
      else if (q.kind === 'flour') { c.fillStyle = `rgba(255,255,255,${0.8 * a})`; }
      else if (q.kind === 'spark') { c.fillStyle = `rgba(255,190,80,${a})`; }
      c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill();
    }
    if (this.qc) this.drawScan(c);
    for (const f of this.floaters) {
      const a = Math.min(1, f.life / 0.4), sc = 1 + Math.max(0, f.life - (f.max - 0.15)) * 3;
      c.save(); c.globalAlpha = a; c.translate(f.x, f.y); c.scale(sc, sc);
      c.font = `900 ${f.size}px Nunito, "Segoe UI", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 7; c.strokeStyle = 'rgba(8,20,40,0.85)'; c.strokeText(f.text, 0, 0);
      c.fillStyle = f.color; c.fillText(f.text, 0, 0);
      c.restore();
    }
    this.renderUI();
  },

  drawScan(c) {
    const area = this.foodArea();
    if (!area) return;
    const t = this.qc.t;
    const y = area.y - area.h + ((t * 0.9) % 1) * (area.h + 40);
    c.save();
    c.fillStyle = 'rgba(10,40,70,0.25)'; c.fillRect(area.x - area.w / 2, area.y - area.h, area.w, area.h + 40);
    c.strokeStyle = 'rgba(64,232,255,0.25)'; c.lineWidth = 1;
    for (let gx = area.x - area.w / 2; gx < area.x + area.w / 2; gx += 22) { c.beginPath(); c.moveTo(gx, area.y - area.h); c.lineTo(gx, area.y + 40); c.stroke(); }
    c.shadowColor = '#40e8ff'; c.shadowBlur = 20;
    c.strokeStyle = '#7ff6ff'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(area.x - area.w / 2, y); c.lineTo(area.x + area.w / 2, y); c.stroke();
    const g = c.createLinearGradient(0, y - 60, 0, y);
    g.addColorStop(0, 'rgba(64,232,255,0)'); g.addColorStop(1, 'rgba(64,232,255,0.35)');
    c.fillStyle = g; c.fillRect(area.x - area.w / 2, y - 60, area.w, 60);
    // corner brackets
    c.shadowBlur = 0; c.strokeStyle = '#40e8ff'; c.lineWidth = 4;
    const L = 30, x0 = area.x - area.w / 2, x1 = area.x + area.w / 2, y0 = area.y - area.h, y1 = area.y + 40;
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, yy, sx, sy]) => { c.beginPath(); c.moveTo(x, yy + sy * L); c.lineTo(x, yy); c.lineTo(x + sx * L, yy); c.stroke(); });
    c.restore();
  },
  foodArea() {
    switch (this.station) {
      case 'pizza': return { x: 450, y: 600, w: 440, h: 200 };
      case 'taco': return { x: 745, y: 640, w: 380, h: 280 };
      case 'prep': case 'dessert': return { x: 560, y: 640, w: 380, h: 320 };
      default: return null;
    }
  },

  /* ---------- static backgrounds (cached) ---------- */
  background(st) {
    if (this.bgCache[st]) return this.bgCache[st];
    const cv = document.createElement('canvas'); cv.width = KW * KDPR; cv.height = KH * KDPR;
    const c = cv.getContext('2d'); c.scale(KDPR, KDPR);
    const theme = {
      grill: ['#dfe7ef', '#c9d4e0', '#9fb0c2'], fryer: ['#e4ebf2', '#cdd8e3', '#9fb0c2'], pizza: ['#f3e1cf', '#e7c9ad', '#b88a66'],
      taco: ['#d9f3ef', '#b9e6df', '#f2a65a'], prep: ['#eef3f8', '#dbe5ef', '#a9bccf'], dessert: ['#fbe8f2', '#f3d2e4', '#d9a3c4'], drinks: ['#e6f3ff', '#cfe4f8', '#8fb2d4'],
    }[st];
    // wall + tiles
    const wg = c.createLinearGradient(0, 0, 0, KH); wg.addColorStop(0, theme[0]); wg.addColorStop(1, theme[1]);
    c.fillStyle = wg; c.fillRect(0, 0, KW, KH);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2;
    for (let y = 0; y < 480; y += 34) for (let x = (y / 34) % 2 ? -34 : 0; x < KW; x += 68) { c.strokeRect(x, y, 68, 34); }
    c.fillStyle = 'rgba(0,0,0,0.04)'; for (let y = 0; y < 480; y += 34) c.fillRect(0, y + 32, KW, 2);
    // floor
    const fg = c.createLinearGradient(0, 700, 0, KH); fg.addColorStop(0, '#5b6f88'); fg.addColorStop(1, '#3a4a5e');
    c.fillStyle = fg; c.fillRect(0, 700, KW, 60);
    // right side darker panel behind the ticket
    const rg = c.createLinearGradient(1275, 0, 1600, 0); rg.addColorStop(0, '#16304d'); rg.addColorStop(1, '#0d1f35');
    c.fillStyle = rg; c.fillRect(1275, 0, 325, KH);
    c.fillStyle = 'rgba(64,232,255,0.6)'; c.fillRect(1275, 0, 4, KH);
    this['bg_' + st](c, theme);
    return (this.bgCache[st] = cv);
  },

  /* ---------- reusable equipment drawing ---------- */
  steel(c, x, y, w, h, r = 18, tone = '#c3cfdc') {
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, shade(tone, 0.35)); g.addColorStop(0.08, tone); g.addColorStop(0.9, shade(tone, -0.15)); g.addColorStop(1, shade(tone, -0.3));
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1;
    for (let i = 0; i < w; i += 6) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i + 30, y + h); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(40,60,90,0.35)'; c.lineWidth = 2; c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke();
  },
  plate(c, x, y, text, color = '#12304a', size = 18) {
    c.save();
    c.font = `800 ${size}px Orbitron, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 30;
    c.fillStyle = '#0b1a2e'; c.beginPath(); c.roundRect(x - w / 2, y - size, w, size * 2, 10); c.fill();
    c.shadowColor = '#40e8ff'; c.shadowBlur = 10; c.fillStyle = '#bff8ff'; c.fillText(text, x, y + 1);
    c.restore();
  },
  neon(c, x, y, text, color, size = 34) {
    c.save(); c.font = `800 ${size}px Orbitron, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = color; c.shadowBlur = 18; c.fillStyle = shade(color, 0.6); c.fillText(text, x, y); c.restore();
  },
  fridge(c, title, cold = true) {
    this.steel(c, 24, 60, 260, 640, 20, '#b7c5d4');
    c.fillStyle = cold ? '#d9f3ff' : '#fff3e0';
    c.beginPath(); c.roundRect(40, 110, 228, 570, 14); c.fill();
    const gg = c.createLinearGradient(40, 0, 268, 0); gg.addColorStop(0, 'rgba(255,255,255,0.5)'); gg.addColorStop(0.3, 'rgba(255,255,255,0)'); gg.addColorStop(1, 'rgba(160,210,240,0.25)');
    c.fillStyle = gg; c.fillRect(40, 110, 228, 570);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#9fb3c8'; c.fillRect(44, 238 + i * 142, 220, 6); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(44, 238 + i * 142, 220, 2); }
    c.fillStyle = '#0b1a2e'; c.beginPath(); c.roundRect(40, 70, 228, 32, 10); c.fill();
    c.font = '800 15px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#bff8ff'; c.fillText(title, 154, 92);
    c.fillStyle = '#8b9bb0'; c.fillRect(270, 300, 8, 160);
  },
  holdingShelf(c, x, w) {
    this.steel(c, x, 184, w, 18, 6, '#aebdcc');
    for (let i = 0; i < 3; i++) {
      const lx = x + w * (0.18 + i * 0.32);
      c.fillStyle = '#56687e'; c.fillRect(lx - 2, 70, 4, 26);
      c.fillStyle = '#2b3a4d'; c.beginPath(); c.moveTo(lx - 40, 116); c.lineTo(lx + 40, 116); c.lineTo(lx + 24, 92); c.lineTo(lx - 24, 92); c.closePath(); c.fill();
    }
    c.font = '800 12px Orbitron, sans-serif'; c.textAlign = 'left'; c.fillStyle = '#4b5d72';
    c.fillText('HEAT LAMP · COOKED & READY', x + 10, 220);
  },
  drawHolding(c, x, w) {
    const t = this.t;
    for (let i = 0; i < 3; i++) {
      const lx = x + w * (0.18 + i * 0.32);
      const g = c.createRadialGradient(lx, 120, 4, lx, 150, 90);
      g.addColorStop(0, `rgba(255,120,60,${0.45 + Math.sin(t * 3 + i) * 0.05})`); g.addColorStop(1, 'rgba(255,120,60,0)');
      c.fillStyle = g; c.fillRect(lx - 100, 110, 200, 80);
      oval(c, lx, 114, 28, 5, 0, '#ffb07a');
    }
    const items = this.holding;
    items.slice(0, 7).forEach((h, i) => {
      const ix = x + 70 + i * ((w - 100) / 6.5);
      drawFood(c, buildFromItems({ id: 'h' }, [{ id: h.id, cook: h.cook, marks: h.marks }]), ix, 172, 0.36);
      c.font = '800 10px Nunito, sans-serif'; c.textAlign = 'center';
      c.fillStyle = h.color || '#2fcf6a'; c.fillText(h.label, ix, 200);
    });
    if (!items.length) { c.font = '700 13px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(75,93,114,0.7)'; c.fillText('(empty)', x + w / 2, 170); }
  },
  meter(c, x, y, w, v, label) {
    // cooking meter with zones: raw → cooked → PERFECT → overcooked → burnt (0 .. 1.5)
    const max = 1.5, h = 14;
    const zones = [[0, 0.4, '#ff6b81'], [0.4, 0.75, '#ffb35c'], [0.75, 0.9, '#ffe066'], [0.9, 1.13, '#2fcf6a'], [1.13, 1.38, '#ffb35c'], [1.38, 1.5, '#5a2a2a']];
    c.fillStyle = '#0b1a2e'; c.beginPath(); c.roundRect(x - 3, y - 3, w + 6, h + 6, 8); c.fill();
    for (const [a, b, col] of zones) { c.fillStyle = col; c.fillRect(x + (a / max) * w, y, ((b - a) / max) * w, h); }
    const px = x + Math.min(1, v / max) * w;
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(px, y - 2); c.lineTo(px - 7, y - 12); c.lineTo(px + 7, y - 12); c.closePath(); c.fill();
    c.fillRect(px - 1.5, y, 3, h);
    if (label) { c.font = '800 11px Orbitron, sans-serif'; c.textAlign = 'left'; c.fillStyle = '#dff9ff'; c.fillText(label, x, y + h + 14); }
  },
  screen(c, x, y, w, h, lines, color = '#7ff6ff') {
    c.fillStyle = '#06192b'; c.beginPath(); c.roundRect(x, y, w, h, 10); c.fill();
    c.strokeStyle = 'rgba(64,232,255,0.6)'; c.lineWidth = 2; c.stroke();
    c.save(); c.shadowColor = color; c.shadowBlur = 6;
    lines.forEach((ln, i) => {
      c.font = i === 0 ? '800 16px Orbitron, Consolas, monospace' : '700 13px Consolas, monospace';
      c.fillStyle = typeof ln === 'object' ? ln.color : i === 0 ? color : '#d6fbff';
      c.textAlign = 'center'; c.fillText(typeof ln === 'object' ? ln.text : ln, x + w / 2, y + 24 + i * 19);
    });
    c.restore();
  },
  drawItem(c, id, cook, x, y, s, marks) {
    drawFood(c, buildFromItems({ id: 'i', dipSlots: [[0, 0]] }, [{ id, cook, marks }]), x, y, s);
  },

  /* =========================================================
     GRILL
     ========================================================= */
  bg_grill(c) {
    this.fridge(c, 'COLD STORAGE ❄');
    // hood
    this.steel(c, 310, 0, 960, 70, 0, '#b7c5d4');
    c.fillStyle = 'rgba(64,232,255,0.8)'; c.fillRect(310, 68, 960, 4);
    this.holdingShelf(c, 330, 920);
    // grill surface
    c.fillStyle = '#2a2f36';
    c.beginPath(); c.moveTo(350, 250); c.lineTo(1230, 250); c.lineTo(1270, 470); c.lineTo(310, 470); c.closePath(); c.fill();
    this.steel(c, 300, 236, 980, 20, 6, '#9fb0c2');
    // body
    this.steel(c, 300, 466, 980, 236, 16, '#b7c5d4');
    GRILL_SLOTS.forEach((x, i) => {
      c.fillStyle = '#56687e'; c.beginPath(); c.arc(x, 664, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#dfe8f2'; c.beginPath(); c.arc(x, 664, 14, 0, Math.PI * 2); c.fill();
      c.font = '800 10px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#4b5d72'; c.fillText(`ZONE ${i + 1}`, x, 696);
    });
    this.plate(c, 790, 30, 'AI SMART GRILL', '#fff', 16);
  },
  draw_grill(c, t) {
    const on = this.grill.on;
    // fridge contents
    this.rawShelf(c, ['beefPatty', 'chickenPatty', 'veggiePatty', 'grilledChicken', 'beefFrank', 'chickenFrank', 'veggieDog', 'pancake']);
    this.drawHolding(c, 330, 920);
    // grates + heat
    c.save();
    c.beginPath(); c.moveTo(350, 250); c.lineTo(1230, 250); c.lineTo(1270, 470); c.lineTo(310, 470); c.closePath(); c.clip();
    if (on) {
      GRILL_SLOTS.forEach((x, i) => {
        const g = c.createRadialGradient(x, 400, 10, x, 400, 170);
        g.addColorStop(0, `rgba(255,120,30,${0.55 + Math.sin(t * 9 + i) * 0.08})`); g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g; c.fillRect(x - 180, 250, 360, 220);
      });
      for (let i = 0; i < 40; i++) {
        const fx = 330 + i * 24 + Math.sin(t * 5 + i) * 3, fh = 14 + Math.sin(t * 13 + i * 1.7) * 6;
        c.fillStyle = i % 2 ? 'rgba(255,190,60,0.8)' : 'rgba(255,110,30,0.8)';
        c.beginPath(); c.moveTo(fx - 6, 472); c.quadraticCurveTo(fx, 472 - fh * 2, fx + 6, 472); c.fill();
      }
    }
    c.strokeStyle = on ? '#6b4a3a' : '#4a525c'; c.lineWidth = 7;
    for (let i = 0; i < 26; i++) { const x0 = 360 + i * 34; c.beginPath(); c.moveTo(x0, 252); c.lineTo(x0 - 40 + i * 3.1, 468); c.stroke(); }
    c.strokeStyle = on ? 'rgba(255,140,80,0.35)' : 'rgba(255,255,255,0.12)'; c.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const x0 = 358 + i * 34; c.beginPath(); c.moveTo(x0, 252); c.lineTo(x0 - 40 + i * 3.1, 468); c.stroke(); }
    c.restore();

    // items on the grill
    this.grill.slots.forEach((it, i) => {
      const x = GRILL_SLOTS[i];
      if (!it) { oval(c, x, 400, 70, 20, 0, 'rgba(255,255,255,0.04)'); return; }
      const up = it.s[1 - it.down];
      const jump = it.flipAnim > 0 ? Math.sin((1 - it.flipAnim / 0.45) * Math.PI) * 50 : 0;
      c.save(); c.translate(0, -jump);
      if (it.flipAnim > 0) { c.translate(x, 400); c.scale(1, Math.abs(Math.cos((1 - it.flipAnim / 0.45) * Math.PI))); c.translate(-x, -400); }
      this.drawItem(c, it.id, up, x, 412, 0.72, up > 0.55);
      c.restore();
      // meters for side 1 / side 2
      c.fillStyle = 'rgba(8,20,40,0.78)'; c.beginPath(); c.roundRect(x - 100, 262, 200, 72, 12); c.fill();
      this.meter(c, x - 88, 282, 176, it.s[0], `SIDE 1 ${it.down === 0 && on ? '🔥' : ''}`);
      this.meter(c, x - 88, 300 + 14, 176, it.s[1], null);
      c.font = '800 11px Orbitron, sans-serif'; c.textAlign = 'right'; c.fillStyle = '#dff9ff';
      c.fillText(`SIDE 2 ${it.down === 1 && on ? '🔥' : ''}`, x + 88, 296 + 14);
      // front display
      const down = it.s[it.down];
      const status = !on ? 'GRILL OFF' : it.flips === 0 && down >= 0.9 ? 'FLIP NOW!' : it.flips > 0 && it.s[0] >= 0.9 && it.s[1] >= 0.9 ? 'TAKE IT OFF!' : 'COOKING...';
      const band = cookBand(down);
      this.screen(c, x - 95, 486, 190, 72, [INGREDIENTS[it.id].name.toUpperCase(), { text: status, color: status.includes('!') ? '#9dffb0' : '#d6fbff' }, { text: `SIDE ${it.flips === 0 ? 1 : 2}: ${band.label}`, color: band.color }], '#7ff6ff');
    });
    // knob glow
    if (on) GRILL_SLOTS.forEach((x) => oval(c, x, 664, 24, 24, 0, 'rgba(255,140,40,0.25)'));
  },
  rawShelf(c, ids) {
    const needed = this.neededCooked();
    ids.forEach((id, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 98 + col * 112, y = 212 + row * 142;
      if (needed.includes(id)) {
        c.save(); c.shadowColor = '#ff4d8d'; c.shadowBlur = 18; c.strokeStyle = '#ff4d8d'; c.lineWidth = 3;
        c.beginPath(); c.roundRect(x - 52, y - 92, 104, 128, 12); c.stroke(); c.restore();
      }
      this.drawItem(c, id, 0, x, y - 10, 0.36, false);
    });
  },

  /* =========================================================
     FRYER
     ========================================================= */
  bg_fryer(c) {
    this.fridge(c, 'FREEZER ❄');
    this.steel(c, 310, 0, 690, 70, 0, '#b7c5d4');
    c.fillStyle = 'rgba(64,232,255,0.8)'; c.fillRect(310, 68, 690, 4);
    this.holdingShelf(c, 330, 650);
    // fryer body
    this.steel(c, 320, 300, 660, 402, 18, '#b7c5d4');
    VATS.forEach((x) => {
      c.fillStyle = '#3a4350'; c.beginPath(); c.ellipse(x, 360, 146, 42, 0, 0, Math.PI * 2); c.fill();
    });
    this.plate(c, 650, 30, 'AI DEEP FRYER', '#fff', 16);
    // fry dump / seasoning station
    this.steel(c, 1006, 300, 262, 402, 18, '#c3cfdc');
    c.fillStyle = '#9fb0c2'; c.beginPath(); c.roundRect(1022, 330, 230, 150, 14); c.fill();
    c.fillStyle = '#dfe8f2'; c.beginPath(); c.roundRect(1030, 338, 214, 134, 10); c.fill();
    this.plate(c, 1137, 270, 'FRY STATION', '#fff', 13);
  },
  draw_fryer(c, t) {
    this.rawShelf(c, ['friesReg', 'crispyChicken', 'spicyChicken', 'nug6', 'nug10', 'donutClassic', 'donutChoc']);
    this.drawHolding(c, 330, 650);
    this.fryer.baskets.forEach((b, i) => {
      const x = VATS[i];
      const active = b.item && b.down;
      // oil
      const og = c.createRadialGradient(x - 40, 350, 10, x, 360, 140);
      og.addColorStop(0, active ? '#ffd56a' : '#f1c45a'); og.addColorStop(1, active ? '#d48a1e' : '#c9922e');
      c.fillStyle = og; c.beginPath(); c.ellipse(x, 360, 134, 36, 0, 0, Math.PI * 2); c.fill();
      const nb = active ? 26 : 5;
      for (let k = 0; k < nb; k++) {
        const a = (k * 2.4 + t * (active ? 3 : 0.6)) % (Math.PI * 2), r = ((k * 37) % 100) / 100;
        const bx = x + Math.cos(a) * 120 * r, by = 360 + Math.sin(a) * 30 * r, br = 2 + ((t * 6 + k) % 1) * (active ? 6 : 3);
        c.strokeStyle = 'rgba(255,250,220,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.stroke();
      }
      // basket
      const by = 230 + b.y * 110;
      c.save();
      c.fillStyle = 'rgba(180,195,210,0.35)'; c.beginPath(); c.roundRect(x - 100, by, 200, 80, 10); c.fill();
      if (b.item) this.drawBasketFood(c, b.item, x, by + 58);
      c.strokeStyle = '#7d8fa3'; c.lineWidth = 3; c.beginPath(); c.roundRect(x - 100, by, 200, 80, 10); c.stroke();
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(90,110,130,0.7)';
      for (let k = 1; k < 10; k++) { c.beginPath(); c.moveTo(x - 100 + k * 20, by); c.lineTo(x - 100 + k * 20, by + 80); c.stroke(); }
      for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - 100, by + k * 20); c.lineTo(x + 100, by + k * 20); c.stroke(); }
      c.strokeStyle = '#2b3a4d'; c.lineWidth = 8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, by); c.lineTo(x, by - 40); c.lineTo(x + 40, by - 60); c.stroke();
      c.restore();
      // oil surface over the lowered basket
      if (b.y > 0.3) {
        c.save(); c.globalAlpha = 0.75 * b.y;
        c.fillStyle = '#e8a83a'; c.beginPath(); c.ellipse(x, 360, 134, 36, 0, 0, Math.PI); c.fill();
        c.restore();
      }
      // front display + meter
      const label = b.item ? cookResult(b.item).label : '';
      this.screen(c, x - 130, 420, 260, 76, b.item ? [INGREDIENTS[b.item.id].name.toUpperCase(), b.down ? `FRYING... ${Math.round(b.item.cook * INGREDIENTS[b.item.id].time)}s` : b.item.cook > 0 ? 'BASKET RAISED' : 'READY TO DROP', { text: label, color: cookResult(b.item).color }] : [`BASKET ${i + 1}`, 'EMPTY', 'Load from freezer ◀']);
      if (b.item) this.meter(c, x - 120, 512, 240, b.item.cook, null);
    });
    // dump station
    if (this.dump) {
      const items = [{ id: 'friesReg', cook: this.dump.cook }];
      drawFood(c, buildFromItems({ id: 'd' }, items), 1137, 470, 0.6);
      c.font = '800 13px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillStyle = cookResult(this.dump).color; c.fillText(this.dump.label, 1137, 500);
    } else {
      c.font = '700 14px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#4b5d72';
      c.fillText(this.side ? '✓ Fries boxed for the order' : 'Lift cooked fries here', 1137, 410);
    }
    if (this.side) drawFood(c, buildSideFries(this.side), 1137, 690, 0.42);
  },
  drawBasketFood(c, item, x, y) {
    const ing = INGREDIENTS[item.id];
    const col = cookedColor(ing, item.cook);
    if (item.id === 'friesReg') {
      for (let k = 0; k < 26; k++) {
        const fx = x - 85 + (k * 37) % 170, fy = y - 8 - ((k * 13) % 30);
        c.save(); c.translate(fx, fy); c.rotate(((k * 47) % 10) / 10 - 0.5);
        c.fillStyle = shade(col, -0.2); c.fillRect(-4, -26, 8, 52); c.fillStyle = col; c.fillRect(-3, -25, 6, 50); c.restore();
      }
    } else if (item.id.startsWith('nug')) {
      this.drawItem(c, item.id, item.cook, x, y - 4, 0.75);
    } else {
      this.drawItem(c, item.id, item.cook, x, y + 4, item.id.startsWith('donut') ? 0.55 : 0.6, false);
    }
  },

  /* =========================================================
     PIZZA
     ========================================================= */
  bg_pizza(c) {
    // ingredient rail
    this.steel(c, 20, 60, 1240, 170, 16, '#9fb0c2');
    this.neon(c, 450, 602, '🍕 PIZZA LAB', '#ff6b4d', 22);
    // prep table
    const tg = c.createLinearGradient(0, 430, 0, 480); tg.addColorStop(0, '#f8f2ea'); tg.addColorStop(1, '#d9cbb8');
    c.fillStyle = tg; c.beginPath(); c.roundRect(24, 430, 850, 60, 14); c.fill();
    this.steel(c, 34, 486, 830, 216, 12, '#b7c5d4');
    // wooden peel
    c.fillStyle = '#c99054'; c.beginPath(); c.ellipse(450, 470, 230, 52, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b37a3e'; c.fillRect(670, 460, 190, 22);
    // oven
    this.steel(c, 892, 250, 370, 452, 22, '#4b5868');
    c.fillStyle = '#111a24'; c.beginPath(); c.roundRect(918, 300, 318, 200, 18); c.fill();
    this.plate(c, 1077, 278, 'AI SMART OVEN', '#fff', 13);
  },
  draw_pizza(c, t) {
    const p = this.pizza;
    // dough on the peel
    if (p.stage !== 'empty' && p.stage !== 'oven') {
      const base = p.stretch < 1 && p.stage === 'ball';
      if (base) {
        const s = 0.35 + p.stretch * 0.65, wob = Math.sin(t * 30) * p.wobble * 0.05;
        if (p.stretch === 0) {
          const g = c.createRadialGradient(430, 440, 6, 450, 455, 70); g.addColorStop(0, '#fff6e0'); g.addColorStop(1, '#e8c98a');
          c.fillStyle = g; c.beginPath(); c.ellipse(450, 455, 66, 46, 0, 0, Math.PI * 2); c.fill();
        } else {
          c.save(); c.translate(450, 470); c.scale(s * (1 + wob), s * (1 - wob));
          drawFood(c, buildFromItems({ id: 'p' }, [{ id: 'dough', cook: 0 }]), 0, 0, 1.25, null, false);
          c.restore();
        }
      } else {
        const b = buildFromItems(FOOD_BY_ID.pizza, p.items.map((it) => ({ ...it, cook: INGREDIENTS[it.id].colors ? (p.stage === 'baked' ? p.bake : 0) : undefined })));
        this.applyDrop(b, 'pizza');
        drawFood(c, b, 450, 478, 1.25);
      }
    } else if (p.stage === 'empty') {
      c.font = '800 22px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(80,50,20,0.55)'; c.fillText('Click DOUGH BALL to start ▲', 450, 476);
    }
    // oven
    const baking = p.stage === 'oven';
    const glow = baking ? 0.55 + Math.sin(t * 4) * 0.08 : 0.08;
    const og = c.createRadialGradient(1077, 420, 10, 1077, 400, 200);
    og.addColorStop(0, `rgba(255,140,40,${glow})`); og.addColorStop(1, 'rgba(255,80,20,0)');
    c.fillStyle = og; c.fillRect(918, 300, 318, 200);
    c.strokeStyle = baking ? '#ff7a2e' : '#3a4656'; c.lineWidth = 4;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(940, 320 + k * 8); c.lineTo(1214, 320 + k * 8); c.stroke(); }
    if (baking) {
      const b = buildFromItems(FOOD_BY_ID.pizza, p.items.map((it) => ({ ...it, cook: INGREDIENTS[it.id].colors ? p.bake : undefined })));
      drawFood(c, b, 1077, 452, 0.85);
      if (Math.random() < 0.2) this.puff(1077, 330, 1, 'steam');
    }
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(930, 300); c.lineTo(990, 300); c.lineTo(950, 500); c.lineTo(918, 500); c.closePath(); c.fill();
    c.strokeStyle = '#8b9bb0'; c.lineWidth = 6; c.beginPath(); c.roundRect(918, 300, 318, 200, 18); c.stroke();
    this.screen(c, 930, 512, 294, 70, baking ? ['BAKING 230°C', `${Math.round(p.bake * INGREDIENTS.dough.time)}s`, { text: cookResult({ cook: p.bake }).label, color: cookResult({ cook: p.bake }).color }]
      : p.stage === 'baked' ? ['DONE', 'Pizza removed', { text: p.result.label, color: p.result.color }] : ['OVEN READY', 'Preheated to 230°C', '']);
    if (baking) this.meter(c, 940, 592, 274, p.bake, null);
  },

  /* =========================================================
     TACO
     ========================================================= */
  bg_taco(c) {
    this.steel(c, 20, 60, 1240, 170, 16, '#9fb0c2');
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#f2a65a' : '#2fbfae'; c.fillRect(20 + i * 104, 236, 104, 10); }
    this.neon(c, 1130, 300, '🌮 TACO', '#ff8a3d', 28);
    // warmer (comal)
    this.steel(c, 40, 420, 420, 282, 18, '#b7c5d4');
    c.fillStyle = '#2a2f36'; c.beginPath(); c.ellipse(250, 470, 180, 54, 0, 0, Math.PI * 2); c.fill();
    this.plate(c, 250, 385, 'SHELL WARMER', '#fff', 13);
    // holder table
    const tg = c.createLinearGradient(0, 600, 0, 650); tg.addColorStop(0, '#f8f2ea'); tg.addColorStop(1, '#d9cbb8');
    c.fillStyle = tg; c.beginPath(); c.roundRect(500, 600, 500, 50, 14); c.fill();
    this.steel(c, 510, 646, 480, 56, 10, '#b7c5d4');
  },
  draw_taco(c, t) {
    const w = this.warmer;
    const hot = 0.4 + Math.sin(t * 3) * 0.05;
    const g = c.createRadialGradient(250, 470, 10, 250, 470, 180);
    g.addColorStop(0, `rgba(255,120,40,${hot})`); g.addColorStop(1, 'rgba(255,80,20,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(250, 470, 178, 52, 0, 0, Math.PI * 2); c.fill();
    if (w) {
      this.drawItem(c, w.id, w.cook, 250, 488, 0.72);
      if (Math.random() < 0.08) this.puff(250, 420, 1, 'steam');
      this.screen(c, 80, 530, 340, 62, [ingName(w.id).toUpperCase(), { text: cookResult(w).label, color: cookResult(w).color }]);
      this.meter(c, 100, 604, 300, w.cook, null);
    } else {
      this.screen(c, 80, 530, 340, 62, ['WARMER READY', 'Pick a shell from the rail ▲']);
    }
    // taco holder
    c.strokeStyle = '#8b9bb0'; c.lineWidth = 8; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(560, 612); c.lineTo(620, 560); c.lineTo(680, 612); c.lineTo(810, 612); c.lineTo(870, 560); c.lineTo(930, 612); c.stroke();
    const b = this.builds.taco;
    if (b.items.length) {
      const build = buildFromItems(FOOD_BY_ID.tacos, b.items);
      this.applyDrop(build, 'taco');
      drawFood(c, build, 745, 612, 1.2);
    } else {
      c.font = '800 20px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(30,60,80,0.5)'; c.fillText('Warm a shell, then move it here', 745, 540);
    }
  },

  /* =========================================================
     PREP + DESSERT (assembly counters)
     ========================================================= */
  bg_prep(c) { this.assemblyBg(c, '#a9bccf', '🍔 PREP & ASSEMBLY', '#19d3f0'); },
  bg_dessert(c) { this.assemblyBg(c, '#e3b5d0', '🍨 DESSERT BAR', '#ff5fa2'); },
  assemblyBg(c, tone, title, neon) {
    this.steel(c, 20, 60, 1050, 256, 16, tone);
    // shelves with jars on the right
    this.steel(c, 1090, 60, 172, 256, 16, tone);
    for (let i = 0; i < 6; i++) {
      const jx = 1120 + (i % 3) * 52, jy = 120 + Math.floor(i / 3) * 110;
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.roundRect(jx - 18, jy, 36, 60, 8); c.fill();
      c.fillStyle = RAINBOW[(i * 2) % RAINBOW.length]; c.fillRect(jx - 14, jy + 26, 28, 30);
      c.fillStyle = '#56687e'; c.fillRect(jx - 20, jy - 8, 40, 10);
    }
    // counter
    const tg = c.createLinearGradient(0, 560, 0, 610); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#d4dfea');
    c.fillStyle = tg; c.beginPath(); c.roundRect(20, 560, 1250, 56, 14); c.fill();
    this.steel(c, 30, 612, 1230, 90, 10, '#b7c5d4');
    this.neon(c, 470, 668, title, neon, 26);
    // plate / board
    c.fillStyle = 'rgba(0,0,0,0.08)'; c.beginPath(); c.ellipse(560, 600, 230, 34, 0, 0, Math.PI * 2); c.fill();
  },
  draw_prep(c, t) { this.drawAssembly(c, t, 'prep'); },
  draw_dessert(c, t) { this.drawAssembly(c, t, 'dessert'); },
  drawAssembly(c, t, st) {
    const b = this.builds[st];
    // serving board
    extrude(c, pEllipse(200, 30, 560), 596, 8, '#e8eef5', { cx: 560, w: 200, top: '#ffffff' });
    if (b.items.length) {
      const build = buildFromItems(FOOD_BY_ID[b.foodId], b.items);
      this.applyDrop(build, st);
      const s = Math.min(1.25, fitScale(build, 420, 250) * 1.08);
      drawFood(c, build, 560, 592 - Math.max(0, build.bottom - 20) * s, s);
    } else {
      c.font = '800 22px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(30,60,90,0.45)';
      c.fillText('Pick a base to start ▲', 560, 520);
    }
  },
  applyDrop(build, st) {
    if (!this.dropAnim || this.dropAnim.station !== st || !build.layers.length) return;
    const L = build.layers[build.layers.length - 1];
    L.offsetY = -(1 - this.dropAnim.t) * (1 - this.dropAnim.t) * 160;
  },

  /* =========================================================
     DRINKS
     ========================================================= */
  bg_drinks(c) {
    this.steel(c, 300, 60, 710, 640, 30, '#c3cfdc');
    c.fillStyle = '#0b1a2e'; c.beginPath(); c.roundRect(330, 90, 650, 120, 18); c.fill();
    this.neon(c, 655, 116, 'AI DRINK FOUNTAIN', '#40e8ff', 22);
    // nozzle bar
    this.steel(c, 340, 250, 630, 50, 12, '#9fb0c2');
    DRINKS.forEach((d, i) => {
      const x = 430 + i * 150;
      c.fillStyle = '#56687e'; c.fillRect(x - 14, 296, 28, 26);
      c.fillStyle = '#2b3a4d'; c.beginPath(); c.moveTo(x - 10, 322); c.lineTo(x + 10, 322); c.lineTo(x + 6, 336); c.lineTo(x - 6, 336); c.closePath(); c.fill();
    });
    // drip tray
    c.fillStyle = '#56687e'; c.beginPath(); c.roundRect(340, 640, 630, 30, 8); c.fill();
    c.fillStyle = '#7d8fa3'; for (let i = 0; i < 30; i++) c.fillRect(350 + i * 21, 646, 12, 18);
    // cup stack
    this.steel(c, 1040, 300, 220, 400, 18, '#d4dfea');
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#eef4fa'; c.beginPath(); c.moveTo(1110, 360 + i * 14); c.lineTo(1190, 360 + i * 14); c.lineTo(1182, 470 + i * 14); c.lineTo(1118, 470 + i * 14); c.closePath(); c.fill(); c.strokeStyle = '#b6c6d6'; c.stroke(); }
    this.plate(c, 1150, 330, 'CUPS', '#fff', 13);
  },
  draw_drinks(c, t) {
    const d = this.drinkState;
    DRINKS.forEach((dr, i) => {
      const x = 430 + i * 150, sel = d.flavor === dr.id;
      c.save(); if (sel) { c.shadowColor = dr.color; c.shadowBlur = 20; }
      c.fillStyle = dr.color; c.beginPath(); c.arc(x, 274, 14, 0, Math.PI * 2); c.fill(); c.restore();
    });
    const cx = d.flavor ? 430 + DRINKS.findIndex((x) => x.id === d.flavor) * 150 : 655;
    if (d.cup) {
      if (d.pouring) {
        const dr = DRINK_BY_ID[d.flavor];
        c.strokeStyle = alpha(dr.color, 0.85); c.lineWidth = 8; c.setLineDash([14, 6]); c.lineDashOffset = -t * 300;
        c.beginPath(); c.moveTo(cx, 338); c.lineTo(cx, 640 - 150 * d.fill); c.stroke(); c.setLineDash([]);
      }
      drawDrink(c, cx, 640, 1, d.flavor ? DRINK_BY_ID[d.flavor] : null, d.fill, { line: true, t });
      if (d.overflow > 0) { c.fillStyle = alpha(DRINK_BY_ID[d.flavor].color, 0.6); c.beginPath(); c.ellipse(cx, 646, 90, 12, 0, 0, Math.PI * 2); c.fill(); }
    } else if (!this.drinkOut) {
      c.font = '800 20px Nunito, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(30,60,90,0.5)'; c.fillText('Place a cup ▶', 655, 560);
    }
    if (this.drinkOut) drawDrink(c, 1150, 690, 0.6, DRINK_BY_ID[this.drinkOut.id], this.drinkOut.fill, { lid: true });
  },

  /* =========================================================
     HTML CONTROLS laid over the canvas
     ========================================================= */
  renderUI() {
    if (this.qc) { this.renderQC(); return; }
    const html = this['ui_' + this.station] ? this['ui_' + this.station]() : '';
    if (html !== this.lastHtml) { this.ui.innerHTML = html; this.lastHtml = html; }
  },
  btn(act, label, x, y, w, h, cls = '', arg = '', disabled = false, extra = '') {
    return `<button class="kbtn ${cls}" data-act="${act}" data-arg="${arg}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${disabled ? 'disabled' : ''} ${extra}>${label}</button>`;
  },
  binHtml(act, id, x, y, w, h, opts = {}) {
    const ing = INGREDIENTS[id];
    const icon = ingredientIcon(id, opts.cook);
    const badge = opts.badge ? `<span class="bin-badge ${opts.badgeCls || ''}">${opts.badge}</span>` : '';
    const ai = opts.ai ? '<span class="bin-ai">AI PICK</span>' : '';
    return `<button class="bin ${opts.cls || ''}" data-act="${act}" data-arg="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${opts.disabled ? 'disabled' : ''} title="${opts.title || ing.name}">
      <img src="${icon}" alt="" draggable="false"><span class="bin-name">${opts.label || ing.name}</span>${badge}${ai}</button>`;
  },
  rawButtons(act, ids) {
    const needed = this.neededCooked();
    return ids.map((id, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 46 + col * 112, y = 116 + row * 142;
      const ing = INGREDIENTS[id];
      return `<button class="raw ${needed.includes(id) ? 'needed' : ''}" data-act="${act}" data-arg="${id}" style="left:${x}px;top:${y}px">${needed.includes(id) ? '<span class="bin-badge hot">NEEDED</span>' : ''}<span>${ing.raw || ing.name}</span></button>`;
    }).join('');
  },
  aiTag() { return Game.insight ? Game.insight.tag : null; },

  ui_grill() {
    let h = this.rawButtons('grill.place', ['beefPatty', 'chickenPatty', 'veggiePatty', 'grilledChicken', 'beefFrank', 'chickenFrank', 'veggieDog', 'pancake']);
    h += this.btn('grill.ignite', this.grill.on ? '⏻ GRILL OFF' : '🔥 IGNITE GRILL', 1050, 6, 200, 50, this.grill.on ? 'danger' : 'hot pulse');
    this.grill.slots.forEach((it, i) => {
      if (!it) return;
      const x = GRILL_SLOTS[i];
      const flipNow = it.flips === 0 && it.s[it.down] >= 0.9;
      const doneNow = it.s[0] >= 0.9 && it.s[1] >= 0.9;
      h += this.btn('grill.flip', '↻ FLIP', x - 96, 574, 92, 52, flipNow ? 'go pulse' : '', i);
      h += this.btn('grill.take', '✓ TAKE', x + 4, 574, 92, 52, doneNow ? 'go pulse' : '', i);
    });
    return h;
  },
  ui_fryer() {
    let h = this.rawButtons('fryer.load', ['friesReg', 'crispyChicken', 'spicyChicken', 'nug6', 'nug10', 'donutClassic', 'donutChoc']);
    this.fryer.baskets.forEach((b, i) => {
      const x = VATS[i];
      if (!b.item) return;
      if (!b.down) h += this.btn('fryer.drop', '▼ DROP BASKET', x - 110, 610, 220, 56, 'hot pulse', i);
      else h += this.btn('fryer.lift', '▲ LIFT BASKET', x - 110, 610, 220, 56, b.item.cook >= 0.9 ? 'go pulse' : '', i);
    });
    if (this.dump) {
      const order = Game.order && Game.order.side;
      SIDES.fries.seasons.forEach((s, i) => {
        const want = order && order.season === s.id;
        h += this.btn('fryer.season', `${s.id === 'salt' ? '🧂' : s.id === 'cajun' ? '🌶' : '🍟'} ${s.label.toUpperCase()}`, 1022, 520 + i * 58, 230, 50, want ? 'go' : '', s.id);
      });
    }
    return h;
  },
  ui_pizza() {
    const p = this.pizza;
    const tag = this.aiTag();
    const ids = ['dough', 'tomatoSauce', 'bbqSauce', 'pesto', 'mozzarella', 'pepperoni', 'mushrooms', 'peppers', 'olives', 'pineapple', 'basil', 'oregano'];
    let h = ids.map((id, i) => {
      const isDough = id === 'dough';
      const ai = tag && FOOD_BY_ID.pizza.groups.some((g) => g.options.some((o) => o.layers.includes(id) && o.tags.includes(tag)));
      return this.binHtml(isDough ? 'pizza.dough' : 'pizza.add', id, 30 + i * 102, 72, 96, 148, { label: isDough ? 'DOUGH BALL' : undefined, cls: isDough && p.stage === 'empty' ? 'pulse-bin' : '', disabled: isDough ? p.stage !== 'empty' : p.stage !== 'top', ai });
    }).join('');
    const tb = 'kbtn';
    if (p.stage === 'ball') h += this.btn('pizza.stretch', `👐 STRETCH DOUGH (${Math.round(p.stretch * 100)}%)`, 320, 630, 330, 58, 'go pulse');
    if (p.stage === 'top') {
      h += this.btn('pizza.undo', '↶ UNDO', 60, 630, 140, 58, '', '', p.items.length < 2);
      h += this.btn('pizza.oven', '🔥 INTO OVEN ▶', 520, 630, 300, 58, p.items.length > 1 ? 'hot pulse' : 'hot', '', p.items.length < 2);
    }
    if (p.stage === 'oven') h += this.btn('pizza.takeOut', '🧤 TAKE OUT', 960, 630, 236, 58, p.bake >= 0.9 ? 'go pulse' : '');
    if (p.stage === 'baked') h += this.btn('pizza.finish', '✓ FINISH → AI CHECK', 470, 630, 360, 58, 'go pulse');
    if (p.stage !== 'empty' && p.stage !== 'oven') h += this.btn('pizza.trash', '🗑', 214, 630, 70, 58, 'danger');
    void tb;
    return h;
  },
  ui_taco() {
    const tag = this.aiTag();
    const food = FOOD_BY_ID.tacos;
    const b = this.builds.taco;
    const ids = ['hardShell', 'softShell', ...binIdsFor(food)];
    let h = ids.map((id, i) => {
      const isShell = id === 'hardShell' || id === 'softShell';
      const ai = tag && food.groups.some((g) => g.options.some((o) => o.layers.includes(id) && o.tags.includes(tag)));
      return this.binHtml(isShell ? 'taco.shell' : 'build.add', id, 30 + i * 102, 72, 96, 148, { disabled: isShell ? !!(this.warmer || b.foodId) : !b.foodId, ai, cls: isShell && !this.warmer && !b.foodId ? 'pulse-bin' : '' });
    }).join('');
    if (this.warmer) h += this.btn('taco.toHolder', 'TO HOLDER ▶', 140, 640, 220, 54, this.warmer.cook >= 0.9 ? 'go pulse' : '');
    if (b.foodId) {
      h += this.btn('build.undo', '↶ UNDO', 1020, 470, 230, 54, '', '', b.items.length < 2);
      h += this.btn('build.trash', '🗑 START OVER', 1020, 534, 230, 54, 'danger');
      h += this.btn('build.finish', '✓ FINISH → AI CHECK', 1020, 610, 230, 80, 'go' + (b.items.length > 2 ? ' pulse' : ''), '', b.items.length < 2);
    }
    return h;
  },
  ui_prep() { return this.assemblyUI('prep'); },
  ui_dessert() { return this.assemblyUI('dessert'); },
  assemblyUI(st) {
    const b = this.builds[st];
    const tag = this.aiTag();
    let ids, act = 'build.add';
    let food = b.foodId ? FOOD_BY_ID[b.foodId] : null;
    if (!food) ids = stationFoods(st).flatMap((f) => baseIdsFor(f));
    else ids = binIdsFor(food);
    const perRow = 7, bw = 142, bh = 116;
    let h = ids.map((id, i) => {
      const x = 32 + (i % perRow) * (bw + 6), y = 70 + Math.floor(i / perRow) * (bh + 6);
      const ing = INGREDIENTS[id];
      const opts = {};
      if (!food) { const f = stationFoods(st).find((ff) => baseIdsFor(ff).includes(id)); opts.label = `${f.emoji} ${ing.name}`; opts.cls = 'base'; }
      if (ing.cook === 'grill' || ing.cook === 'fryer') {
        const n = this.holdingCount(id);
        opts.badge = n ? `${n} READY` : `COOK AT ${ing.cook.toUpperCase()}`;
        opts.badgeCls = n ? 'ok' : 'hot';
        opts.disabled = !n;
        const best = this.holding.find((hh) => hh.id === id);
        if (best) opts.cook = best.cook;
      }
      if (food && tag) opts.ai = food.groups.some((g) => g.options.some((o) => (o.layers.includes(id) || (o.top || []).includes(id)) && o.tags.includes(tag)));
      return this.binHtml(act, id, x, y, bw, bh, opts);
    }).join('');
    if (!ids.length) h += `<div class="station-hint" style="left:60px;top:150px">Nothing here unlocked yet — level up to unlock more recipes!</div>`;
    if (food) {
      h += this.btn('build.undo', '↶ UNDO', 1000, 380, 260, 54, '', '', !b.items.length);
      h += this.btn('build.trash', '🗑 START OVER', 1000, 444, 260, 54, 'danger');
      h += this.btn('build.finish', '✓ FINISH → AI CHECK', 1000, 620, 260, 76, 'go' + (b.items.length > 2 ? ' pulse' : ''), '', b.items.length < 2);
    }
    return h;
  },
  ui_drinks() {
    const d = this.drinkState;
    let h = DRINKS.map((dr, i) => `<button class="kbtn flavor ${d.flavor === dr.id ? 'on' : ''}" data-act="drink.flavor" data-arg="${dr.id}" style="left:${430 + i * 150 - 66}px;top:150px;width:132px;height:50px;--fc:${dr.color}">${dr.name.toUpperCase()}</button>`).join('');
    if (this.drinkOut) {
      h += `<div class="station-hint" style="left:1052px;top:520px;width:196px">✓ Drink ready on the serving tray</div>`;
      return h;
    }
    if (!d.cup) h += this.btn('drink.cup', '🥤 PLACE CUP', 1060, 620, 180, 60, 'go pulse');
    else {
      h += `<button class="kbtn fill ${d.flavor ? 'go' : ''}" data-hold="fill" style="left:1052px;top:520px;width:196px;height:90px">HOLD TO FILL<small>release at the pink line</small></button>`;
      h += this.btn('drink.lid', '✓ LID & STRAW', 1052, 622, 196, 56, d.fill > 0.1 && !d.pouring ? 'go pulse' : '', '', d.fill < 0.1);
      if (d.fill > 0) h += this.btn('drink.dump', '🗑', 980, 622, 60, 56, 'danger');
    }
    return h;
  },
  ui_front() { return ''; },

  renderQC() {
    const q = this.qc, r = q.result;
    let panel = this.ui.querySelector('.qc-panel');
    if (!panel || this.lastHtml !== 'QC') {
      this.ui.innerHTML = `<div class="qc-panel" style="left:${this.station === 'taco' ? 30 : 870}px">
        <div class="qc-title"><span class="pulse-dot"></span> AI QUALITY CONTROL</div>
        <div class="qc-sub">Scanning food...</div><ul></ul><div class="qc-end"></div></div>`;
      this.lastHtml = 'QC';
      panel = this.ui.querySelector('.qc-panel');
    }
    const ul = panel.querySelector('ul');
    while (ul.children.length < q.shown) {
      const ch = r.checks[ul.children.length];
      ul.insertAdjacentHTML('beforeend', `<li class="${ch.ok ? 'ok' : 'warn'}"><b>${ch.ok ? '✓' : '⚠'}</b> ${ch.text}${ch.detail ? `<small>${ch.detail}</small>` : ''}</li>`);
    }
    const end = panel.querySelector('.qc-end');
    if (q.done && !end.innerHTML) {
      panel.querySelector('.qc-sub').textContent = 'Scan complete';
      end.innerHTML = `<div class="qc-score"><label>AI SCORE</label><span>${Math.round(r.score * 100)}%</span></div>
        <div class="qc-ready">${r.score >= 0.6 ? 'READY TO SERVE' : 'AI RECOMMENDS FIXING THIS ORDER'}</div>
        <div class="qc-buttons"><button class="kbtn" data-act="qc.fix">↶ FIX IT</button><button class="kbtn go pulse" data-act="qc.send">🍽 PLATE IT ▶</button></div>`;
    }
  },
};

// Score a cooked item. Grill items cook one side at a time and must be flipped.
function cookResult(item) {
  if (item.s) {
    const b0 = cookBand(item.s[0]), b1 = cookBand(item.s[1]);
    const score = (b0.score + b1.score) / 2;
    const worst = b0.score <= b1.score ? b0 : b1;
    const label = item.flips === 0 && item.s[0] > 0.4 ? (item.s[0] > 1.13 ? 'BURNT SIDE' : 'NOT FLIPPED') : worst.label;
    return { score: item.flips === 0 ? Math.min(score, 0.45) : score, label, color: item.flips === 0 && item.s[0] > 0.4 ? '#ff9a3d' : worst.color };
  }
  const b = cookBand(item.cook);
  return { score: b.score, label: b.label, color: b.color };
}
