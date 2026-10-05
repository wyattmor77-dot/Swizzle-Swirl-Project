/* =========================================================
   AI FOOD FACTORY — GAME CONTROLLER
   Game loop:  customer arrives → order ticket → customize →
   AI analysis + 3D print cutscene → serve → reaction →
   score → next customer.
   ========================================================= */
const $ = (id) => document.getElementById(id);
const PATIENCE_SECONDS = 75;

const Game = {
  phase: 'start',
  money: 0,
  served: 0,
  ratings: [],
  history: [],      // { customerId, foodId, tags, avoided, stars } — used by the AI insight system
  orderNo: 0,
  level: 1,
  visitIdx: 0,
  lastCustomerId: null,
  customer: null,
  order: null,
  made: null,
  build: null,
  job: null,
  elapsed: 0,
  mood: 'neutral',
  insight: null,
  impatientShown: false,
};

const printer = new Printer($('printerCanvas'));
const customerCtx = $('customerCanvas').getContext('2d');
customerCtx.scale(2, 2);

/* ---------------- stage scaling (responsive) ---------------- */
function fitStage() {
  const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
  const x = (window.innerWidth - 1600 * s) / 2;
  const y = (window.innerHeight - 900 * s) / 2;
  $('stage').style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}
window.addEventListener('resize', fitStage);
fitStage();

/* ---------------- camera ---------------- */
function camera(cx, cy, s, sx = 800, sy = 450) {
  $('world').style.transform = cx == null ? '' : `translate(${sx - cx * s}px, ${sy - cy * s}px) scale(${s})`;
}
const CAM = {
  printer: () => camera(1300, 505, 1.08, 1050, 450),
  closeUp: () => camera(1240, 525, 1.36, 1060, 450),
  reset: () => camera(null),
};

/* ---------------- helpers ---------------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unlockedFoods = () => FOODS.filter((f) => f.unlock <= Game.level);
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function say(text, ms) {
  const b = $('bubble');
  b.textContent = text;
  hide(b); void b.offsetWidth; show(b);
  clearTimeout(say.timer);
  if (ms) say.timer = setTimeout(() => hide(b), ms);
}

function toast(html, ms = 2600) {
  const t = $('toast');
  t.innerHTML = html;
  hide(t); void t.offsetWidth; show(t);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => hide(t), ms);
}

function updateHud() {
  $('money').textContent = `$${Game.money.toLocaleString()}`;
  $('ordersServed').textContent = Game.served;
  $('avgRating').textContent = Game.ratings.length ? `★ ${(Game.ratings.reduce((a, b) => a + b, 0) / Game.ratings.length).toFixed(1)}` : '–';
  const lvl = LEVELS[Game.level - 1];
  $('levelNum').textContent = `LVL ${lvl.level}`;
  $('levelTitle').textContent = lvl.title.toUpperCase();
  renderMenu();
}

function renderMenu() {
  $('menuList').innerHTML = FOODS.map((f) => `<div class="${f.unlock > Game.level ? 'locked' : ''}"><span>${f.emoji} ${f.name}</span><b>${f.unlock > Game.level ? '🔒' : '$' + f.price * 10}</b></div>`).join('');
}

/* ---------------- customer ---------------- */
function drawCustomerNow(t) {
  if (Game.customer) drawCustomer(customerCtx, Game.customer.look, Game.mood, t);
}

function chooseCustomer() {
  let id;
  if (Game.visitIdx < SCRIPTED_VISITS.length) id = SCRIPTED_VISITS[Game.visitIdx];
  else {
    const returning = [...new Set(Game.history.map((h) => h.customerId))].filter((c) => c !== Game.lastCustomerId);
    const pool = CUSTOMERS.filter((c) => c.id !== Game.lastCustomerId);
    id = returning.length && Math.random() < 0.45 ? pick(returning) : pick(pool).id;
  }
  Game.visitIdx++;
  Game.lastCustomerId = id;
  return CUSTOMER_BY_ID[id];
}

function chooseFood(customer) {
  const open = unlockedFoods();
  // after a level-up, show off the newly unlocked foods
  const fresh = open.filter((f) => f.unlock === Game.level && Game.level > 1 && !Game.history.some((h) => h.foodId === f.id));
  if (fresh.length && Math.random() < 0.6) return pick(fresh);
  const favs = open.filter((f) => customer.favs.includes(f.id));
  return pick(favs.length ? favs : open);
}

async function nextCustomer() {
  Game.phase = 'arriving';
  const customer = chooseCustomer();
  const food = chooseFood(customer);
  const sel = AI.generateOrder(customer, food, Game.level);
  Game.orderNo++;
  Game.customer = customer;
  Game.mood = 'neutral';
  Game.order = { customerId: customer.id, customerName: customer.name, foodId: food.id, sel, name: AI.orderName(food, sel) };
  Game.made = { foodId: null, sel: null };
  Game.elapsed = 0;
  Game.impatientShown = false;
  Game.insight = AI.insightFor(customer.id, Game.history);
  $('customerName').textContent = customer.name;

  const el = $('customer');
  el.classList.add('walking');
  el.classList.remove('offstage');
  await wait(1450);
  el.classList.remove('walking');
  Sound.play('arrive');

  const returning = Game.history.some((h) => h.customerId === customer.id);
  const lines = customer.look.type === 'robot' ? DIALOGUE.robot : returning ? DIALOGUE.returning : DIALOGUE.greet;
  say(pick(lines).replace('{food}', Game.order.name.toLowerCase()).replace('{FOOD}', Game.order.name.toUpperCase()));
  renderTicket();
  Game.phase = 'ordering';
  if (Game.insight) setTimeout(showInsight, 700);
}

function showInsight() {
  const ins = Game.insight;
  if (!ins || !['ordering', 'customizing'].includes(Game.phase)) return;
  const el = $('insight');
  el.innerHTML = `
    <span class="x" onclick="hide($('insight'))">✕</span>
    <h4>🧠 AI CUSTOMER INSIGHT</h4>
    <p><b>${Game.customer.name}</b> has visited ${ins.visits} time${ins.visits > 1 ? 's' : ''} before.</p>
    <p>This customer ${ins.text}.</p>
    <div class="rec">Recommended customization: ${ins.rec}</div>
    <div class="consent">🔒 Preference memory is ON — ${Game.customer.name} gave permission to remember past orders.</div>`;
  if (Game.phase === 'ordering') show(el);
  Sound.play('recipe');
}

/* ---------------- ticket ---------------- */
function renderTicket() {
  const o = Game.order;
  const food = FOOD_BY_ID[o.foodId];
  $('ticketNo').textContent = `ORDER #${String(Game.orderNo).padStart(3, '0')}`;
  $('ticketWho').textContent = `${o.customerName.toUpperCase()}'S ORDER`;
  $('ticketEmoji').textContent = food.emoji;
  $('ticketFood').textContent = o.name.toUpperCase();
  $('ticketLines').innerHTML = AI.ticketLines(food, o.sel).map((l) => `<li class="${l.ok ? 'yes' : 'no'}">${l.text}</li>`).join('');
  $('ticketStatus').textContent = 'Click START ORDER to build this food';
  show($('startOrderBtn'));
  hide($('serveBtn'));
  $('patienceFill').style.width = '100%';
  show($('ticket'));
}

/* ---------------- customizer ---------------- */
function openCustomizer() {
  Sound.play('click');
  Game.phase = 'customizing';
  hide($('bubble'));
  hide($('insight'));
  hide($('startOrderBtn'));
  $('ticketStatus').textContent = 'Build the food in the Food Station ◀';
  renderFoodGrid();
  renderGroups();
  show($('customizer'));
}

function renderFoodGrid() {
  $('foodGrid').innerHTML = FOODS.map((f) => {
    const locked = f.unlock > Game.level;
    const selected = Game.made.foodId === f.id;
    return `<div class="food-card ${locked ? 'locked' : ''} ${selected ? 'selected' : ''}" data-food="${f.id}" title="${locked ? 'Unlocks at level ' + f.unlock : f.name}">
      <span class="em">${f.emoji}</span>${locked ? 'LVL ' + f.unlock : f.name}</div>`;
  }).join('');
}

function selectFood(id) {
  const food = FOOD_BY_ID[id];
  if (!food || food.unlock > Game.level) return;
  Sound.play('toggle');
  Game.made = { foodId: id, sel: AI.defaultSelection(food) };
  renderFoodGrid();
  renderGroups();
}

function renderGroups() {
  const box = $('groups');
  const sug = $('aiSuggest');
  if (!Game.made.foodId) {
    box.innerHTML = '<div class="empty-hint">⬆ Select the food the customer ordered</div>';
    hide(sug);
    $('printBtn').disabled = true;
    $('layerCount').textContent = '';
    return;
  }
  const food = FOOD_BY_ID[Game.made.foodId];
  const tag = Game.insight && Game.insight.tag;
  box.innerHTML = food.groups.map((g) => `
    <div class="group">
      <h3>${g.label.toUpperCase()} <small>(${g.type === 'single' ? 'pick one' : 'pick any'})</small></h3>
      <div class="opts">${g.options.map((o) => {
        const on = g.type === 'single' ? Game.made.sel[g.id] === o.id : Game.made.sel[g.id].includes(o.id);
        const ai = tag && o.tags.includes(tag) ? '<span class="ai-badge">AI PICK</span>' : '';
        return `<button class="opt ${g.type === 'multi' ? 'multi' : ''} ${on ? 'on' : ''}" data-group="${g.id}" data-opt="${o.id}">${o.label}${ai}</button>`;
      }).join('')}</div>
    </div>`).join('');
  const hasTagged = tag && food.groups.some((g) => g.options.some((o) => o.tags.includes(tag)));
  if (hasTagged) {
    sug.innerHTML = `🧠 <span><b>AI suggests:</b> ${Game.insight.rec} for ${Game.customer.name} (learned from past orders)</span><button class="btn primary" id="applyAi">APPLY</button>`;
    show(sug);
  } else hide(sug);
  const n = buildFood(food, Game.made.sel).layers.length;
  $('layerCount').textContent = `🧱 ${n} layers to print`;
  $('printBtn').disabled = false;
}

function toggleOption(groupId, optId) {
  const food = FOOD_BY_ID[Game.made.foodId];
  const g = food.groups.find((x) => x.id === groupId);
  if (g.type === 'single') Game.made.sel[groupId] = optId;
  else {
    const cur = Game.made.sel[groupId];
    Game.made.sel[groupId] = cur.includes(optId) ? cur.filter((x) => x !== optId) : g.options.map((o) => o.id).filter((id) => id === optId || cur.includes(id));
  }
  Sound.play('toggle');
  renderGroups();
}

function applyAiSuggestion() {
  const food = FOOD_BY_ID[Game.made.foodId];
  const tag = Game.insight.tag;
  for (const g of food.groups) {
    const tagged = g.options.filter((o) => o.tags.includes(tag));
    if (!tagged.length) continue;
    if (g.type === 'single') Game.made.sel[g.id] = tagged[tagged.length - 1].id;
    else Game.made.sel[g.id] = g.options.map((o) => o.id).filter((id) => Game.made.sel[g.id].includes(id) || tagged.some((t) => t.id === id));
  }
  Sound.play('recipe');
  renderGroups();
}

/* ---------------- printing cutscene ---------------- */
function startPrint() {
  if (!Game.made.foodId || Game.phase !== 'customizing') return;
  Sound.play('startup');
  Game.phase = 'printing';
  const food = FOOD_BY_ID[Game.made.foodId];
  Game.build = buildFood(food, Game.made.sel);
  Game.printSeconds = Game.elapsed;
  const analysis = AI.analyze(Game.order, Game.made, Game.build);
  hide($('customizer'));
  hide($('insight'));
  $('ticketStatus').textContent = 'AI printer is working...';
  $('stage').classList.add('cinematic');
  CAM.printer();

  // AI panel
  $('aiSteps').innerHTML = '';
  hide($('aiRecipe'));
  $('aiRecipeMeta').textContent = `Confidence ${analysis.confidence}% · ${Game.build.layers.length} layers · est. ${analysis.printSeconds}s`;
  $('aiLayers').innerHTML = Game.build.layers.map((L) => `<li><i style="background:${CARTRIDGES[L.ing.cart].color}"></i>${L.ing.name}</li>`).join('');
  show($('aiPanel'));
  show($('skipBtn'));

  const steps = $('aiSteps');
  const finishStep = (i) => {
    const li = steps.children[i];
    if (!li || li.dataset.done) return;
    li.dataset.done = '1';
    li.querySelector('.ico').className = 'ico ok';
    const st = analysis.steps[i];
    li.insertAdjacentHTML('beforeend', `<span class="res ${st.warn ? 'warn' : ''}">→ ${st.result}</span>`);
  };

  Game.job = new PrintJob(printer, Game.build, analysis, AI.orderName(food, Game.made.sel), (ev, i, skipped) => {
    const quiet = skipped;
    switch (ev) {
      case 'step':
        if (i > 0) finishStep(i - 1);
        steps.insertAdjacentHTML('beforeend', `<li><span class="ico spin"></span> ${analysis.steps[i].text}</li>`);
        if (!quiet) Sound.play('analyze');
        break;
      case 'recipe':
        finishStep(analysis.steps.length - 1);
        show($('aiRecipe'));
        if (!quiet) Sound.play('recipe');
        break;
      case 'printStart':
        if (!quiet) { Sound.play('servo'); CAM.closeUp(); }
        break;
      case 'layer': {
        const lis = $('aiLayers').children;
        for (let k = 0; k < lis.length; k++) lis[k].className = k < i ? 'done' : k === i ? 'now' : '';
        if (!quiet) Sound.play('layer');
        break;
      }
      case 'finalize':
        [...$('aiLayers').children].forEach((li) => (li.className = 'done'));
        if (!quiet) Sound.play('servo');
        break;
      case 'complete':
        if (!quiet) { printer.state.flash = 1; printer.sparkle(PLATFORM.x, PLATFORM.y - 80, 40); Sound.play('complete'); CAM.printer(); }
        break;
      case 'transfer':
        if (!quiet) Sound.play('whoosh');
        break;
      case 'cameraOut':
        if (quiet) Sound.play('complete');
        hide($('skipBtn'));
        hide($('aiPanel'));
        $('stage').classList.remove('cinematic');
        CAM.reset();
        break;
      case 'end':
        Game.job = null;
        Game.phase = 'ready';
        $('ticketStatus').textContent = '✅ Food is ready on the output tray!';
        show($('serveBtn'));
        printer.sparkle(TRAY.x, TRAY.y - 30, 20);
        break;
    }
  });
}

function skipPrint() {
  if (Game.job) { Sound.play('click'); Game.job.skip(); }
}

/* ---------------- serving + reaction ---------------- */
async function serveFood() {
  if (Game.phase !== 'ready') return;
  Game.phase = 'serving';
  hide($('serveBtn'));
  Sound.play('whoosh');
  const plate = $('plateCanvas');
  renderFoodToCanvas(plate, Game.build);
  // start the plate on the printer's output tray, then fly it to the customer
  plate.style.transition = 'none';
  Object.assign(plate.style, { left: '1424px', top: '612px', width: '120px', height: '100px' });
  show(plate);
  printer.clearTray();
  void plate.offsetWidth;
  plate.style.transition = '';
  Object.assign(plate.style, { left: '250px', top: '495px', width: '180px', height: '150px' });
  await wait(900);

  const result = AI.score(Game.order, Game.made, Game.printSeconds);
  result.madeFoodId = Game.made.foodId;
  const reaction = AI.reaction(Game.customer, Game.order, result);
  Game.mood = reaction.mood;
  say(reaction.text);
  if (result.stars >= 4) { $('customer').classList.add('bounce'); Sound.play('happy'); } else Sound.play('sad');
  setTimeout(() => $('customer').classList.remove('bounce'), 1000);

  // record + reward
  const food = FOOD_BY_ID[Game.order.foodId];
  const learnt = AI.orderTags(food, Game.order.sel);
  Game.history.push({ customerId: Game.customer.id, foodId: food.id, tags: learnt.tags, avoided: learnt.avoided, stars: result.stars });
  Game.money += result.earned;
  Game.served++;
  Game.ratings.push(result.stars);
  const prevLevel = Game.level;
  Game.level = LEVELS.filter((l) => Game.served >= l.ordersNeeded).pop().level;
  Game.leveledUp = Game.level > prevLevel;

  await wait(1700);
  showResults(result, reaction, learnt);
}

function showResults(result, reaction, learnt) {
  Game.phase = 'results';
  renderFoodToCanvas($('resultFood'), Game.build);
  $('resultQuote').textContent = `${Game.customer.name}: “${reaction.text}”`;
  $('resultTitle').textContent = result.stars >= 5 ? 'PERFECT ORDER!' : result.stars >= 4 ? 'GREAT JOB!' : result.stars >= 3 ? 'ORDER COMPLETE' : 'NEEDS IMPROVEMENT';
  $('accText').textContent = `${Math.round(result.accuracy * 100)}%`;
  $('speedText').textContent = `${Math.round(result.seconds)}s`;
  $('accFill').style.width = '0%';
  $('speedFill').style.width = '0%';
  $('stars').innerHTML = [1, 2, 3, 4, 5].map((i) => (i <= result.stars ? `<span class="lit" style="animation-delay:${0.25 + i * 0.15}s">★</span>` : '<span>★</span>')).join('');

  const d = result.details;
  const items = [];
  if (result.wrongFood) items.push(`Wrong food: made ${FOOD_BY_ID[result.madeFoodId].name}, ordered ${FOOD_BY_ID[Game.order.foodId].name}`);
  else {
    d.missing.forEach((m) => items.push(`Missing: ${m}`));
    d.extra.forEach((m) => items.push(`Not ordered: ${m}`));
    d.wrong.forEach((w) => items.push(`${w.group}: wanted ${w.want}, got ${w.got}`));
  }
  $('mistakes').innerHTML = items.length ? items.map((t) => `<li>${t}</li>`).join('') : '<li class="good">✓ Every ingredient matched the ticket!</li>';
  $('earnedBreakdown').innerHTML = `Order $${result.base} + speed bonus $${result.speedBonus}${result.tip ? ` + tip $${result.tip}` : ''}`;
  const tagText = [...new Set(learnt.tags)].map((t) => (TAG_INFO[t] ? TAG_INFO[t].rec.toLowerCase() : null)).filter(Boolean);
  $('learned').textContent = tagText.length
    ? `🧠 AI preference memory (with permission) noted ${Game.customer.name}'s choices: ${tagText.join(', ')}.`
    : `🧠 AI preference memory updated for ${Game.customer.name} (with permission).`;
  show($('results'));

  requestAnimationFrame(() => {
    $('accFill').style.width = `${result.accuracy * 100}%`;
    $('speedFill').style.width = `${Math.max(4, result.speed * 100)}%`;
  });
  // count up the earnings
  const target = result.earned;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / 900);
    $('earned').textContent = `$${Math.round(target * k)}`;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => { Sound.play('money'); updateHud(); $('money').classList.remove('bump'); void $('money').offsetWidth; $('money').classList.add('bump'); }, 700);
}

async function nextOrder() {
  if (Game.phase !== 'results') return;
  Sound.play('click');
  Game.phase = 'leaving';
  hide($('results'));
  hide($('ticket'));
  hide($('plateCanvas'));
  const el = $('customer');
  el.classList.add('walking', 'leaving');
  say('Bye! 👋', 1200);
  if (Game.leveledUp) {
    const lvl = LEVELS[Game.level - 1];
    const newFoods = FOODS.filter((f) => f.unlock === Game.level).map((f) => `${f.emoji} ${f.name}`).join('  ');
    setTimeout(() => { Sound.play('levelUp'); toast(`LEVEL ${lvl.level} — ${lvl.title.toUpperCase()}!<small>New recipes unlocked: ${newFoods}</small>`, 3600); }, 400);
    Game.leveledUp = false;
  }
  await wait(1500);
  el.style.transition = 'none';
  el.classList.remove('leaving', 'walking');
  el.classList.add('offstage');
  void el.offsetWidth;
  el.style.transition = '';
  hide($('bubble'));
  nextCustomer();
}

/* ---------------- start screen showcase: a mini printer demo ---------------- */
const Showcase = {
  c: $('startFood').getContext('2d'),
  build: null, t: 0, i: 0,
  next() {
    const f = FOODS[this.i++ % FOODS.length];
    const sel = AI.defaultSelection(f);
    this.build = buildFood(f, sel);
    this.t = 0;
  },
  update(dt) {
    if (!this.build) this.next();
    this.t += dt;
    const N = this.build.layers.length, per = 0.28;
    const reveal = this.build.layers.map((_, i) => Math.max(0, Math.min(1, (this.t - i * per) / per)));
    const c = this.c;
    c.clearRect(0, 0, 420, 300);
    oval(c, 210, 262, 150, 26, 0, 'rgba(64,232,255,0.18)');
    c.beginPath(); c.ellipse(210, 262, 150, 26, 0, 0, Math.PI * 2); c.strokeStyle = 'rgba(64,232,255,0.7)'; c.lineWidth = 2; c.stroke();
    const s = fitScale(this.build, 300, 230);
    drawFood(c, this.build, 210, 258 - this.build.bottom * s * 0.6, s, reveal);
    if (this.t > N * per + 1.6) this.next();
  },
};

/* ---------------- main loop ---------------- */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const modalOpen = !$('aboutModal').classList.contains('hidden') || !$('ethicsModal').classList.contains('hidden');

  if (Game.phase === 'start') Showcase.update(dt);
  if (Game.job) Game.job.update(dt);
  printer.update(dt);
  printer.draw();
  drawCustomerNow(t);

  if ((Game.phase === 'ordering' || Game.phase === 'customizing') && !modalOpen) {
    Game.elapsed += dt;
    const left = Math.max(0, 1 - Game.elapsed / PATIENCE_SECONDS);
    $('patienceFill').style.width = `${left * 100}%`;
    $('patienceFill').classList.toggle('low', left < 0.3);
    $('timer').textContent = `${Math.floor(Game.elapsed)}s`;
    if (left === 0 && !Game.impatientShown) { Game.impatientShown = true; Game.mood = 'sad'; if (Game.phase === 'ordering') say('Um... is my food coming?', 2500); }
  }
  requestAnimationFrame(loop);
}

/* ---------------- events ---------------- */
function startGame() {
  Sound.init();
  Sound.play('click');
  hide($('startScreen'));
  Game.phase = 'starting';
  updateHud();
  setTimeout(nextCustomer, 400);
}

$('startBtn').onclick = startGame;
$('startOrderBtn').onclick = openCustomizer;
$('printBtn').onclick = startPrint;
$('skipBtn').onclick = skipPrint;
$('serveBtn').onclick = serveFood;
$('nextBtn').onclick = nextOrder;
const openModal = (id) => { Sound.play('click'); show($(id)); };
$('aboutBtn').onclick = $('aboutBtn2').onclick = () => openModal('aboutModal');
$('ethicsBtn').onclick = $('ethicsBtn2').onclick = () => openModal('ethicsModal');
$('soundBtn').onclick = () => { const on = Sound.toggle(); $('soundBtn').textContent = on ? '🔊' : '🔇'; };
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => { Sound.play('click'); hide(b.closest('.overlay')); }));
document.querySelectorAll('#aboutModal, #ethicsModal').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) hide(o); }));

$('foodGrid').addEventListener('click', (e) => { const card = e.target.closest('.food-card'); if (card) selectFood(card.dataset.food); });
$('groups').addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (b) toggleOption(b.dataset.group, b.dataset.opt); });
$('aiSuggest').addEventListener('click', (e) => { if (e.target.id === 'applyAi') applyAiSuggestion(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hide($('aboutModal')); hide($('ethicsModal')); }
  if ((e.key === ' ' || e.key === 'Enter') && Game.job) { e.preventDefault(); skipPrint(); }
});

renderMenu();
requestAnimationFrame(loop);
