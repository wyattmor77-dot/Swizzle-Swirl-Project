/* =========================================================
   AI FOOD FACTORY — GAME CONTROLLER
   customer arrives → ticket → TAKE ORDER → cook at the
   stations → AI quality check → plate → serve → reaction →
   score → (optional) PRINT IT IN REAL LIFE → next customer
   ========================================================= */
const $ = (id) => document.getElementById(id);

const Game = {
  phase: 'start',
  money: 0, served: 0, ratings: [], history: [], orderNo: 0, level: 1, visitIdx: 0, lastCustomerId: null,
  customer: null, order: null, insight: null, elapsed: 0, mood: 'neutral', job: null, printed: null,
  view: 'front', chatterT: 0, impatientShown: false, leveledUp: false, patience: 90,
};

const customerCtx = $('customerCanvas').getContext('2d');
customerCtx.scale(2, 2);
Kitchen.init();
Irl.init();

/* ---------------- stage scaling (responsive) ---------------- */
function fitStage() {
  const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
  $('stage').style.transform = `translate(${(window.innerWidth - 1600 * s) / 2}px, ${(window.innerHeight - 900 * s) / 2}px) scale(${s})`;
}
window.addEventListener('resize', fitStage);
fitStage();

/* ---------------- camera ---------------- */
function camera(cx, cy, s, sx = 800, sy = 450) {
  $('world').style.transform = cx == null ? '' : `translate(${sx - cx * s}px, ${sy - cy * s}px) scale(${s})`;
}


/* ---------------- helpers ---------------- */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const pct = (v) => `${Math.round(v * 100)}%`;
const STATION_UNLOCK = { front: 1, grill: 1, prep: 1, fryer: 2, drinks: 2, pizza: 3, taco: 4, dessert: 6 };

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
Game.notify = (text) => {
  const n = document.createElement('div');
  n.className = 'note-pop';
  n.textContent = text;
  $('notify').appendChild(n);
  while ($('notify').children.length > 3) $('notify').firstChild.remove();
  setTimeout(() => n.remove(), 3200);
};

function updateHud() {
  $('money').textContent = `$${Game.money.toLocaleString()}`;
  $('ordersServed').textContent = Game.served;
  $('avgRating').textContent = Game.ratings.length ? `★ ${(Game.ratings.reduce((a, b) => a + b, 0) / Game.ratings.length).toFixed(1)}` : '–';
  const lvl = LEVELS[Game.level - 1], next = LEVELS[Game.level];
  $('levelNum').textContent = `LVL ${lvl.level}`;
  $('levelTitle').textContent = lvl.title.toUpperCase();
  $('xpFill').style.width = next ? `${((Game.served - lvl.ordersNeeded) / (next.ordersNeeded - lvl.ordersNeeded)) * 100}%` : '100%';
  renderMenu();
}
function renderMenu() {
  $('menuList').innerHTML = FOODS.map((f) => `<div class="${f.unlock > Game.level ? 'locked' : ''}"><span>${f.emoji} ${f.name}</span><b>${f.unlock > Game.level ? '🔒' : '$' + f.price * 10}</b></div>`).join('')
    + `<div class="${Game.level < 2 ? 'locked' : ''}"><span>🍟 Fries · 🥤 Drinks</span><b>${Game.level < 2 ? '🔒' : '$50/$30'}</b></div>`;
}

/* =========================================================
   CUSTOMERS & ORDERS
   ========================================================= */
function chooseVisit() {
  if (Game.visitIdx < SCRIPTED_VISITS.length) {
    const v = SCRIPTED_VISITS[Game.visitIdx++];
    return { customer: CUSTOMER_BY_ID[v.c], food: FOOD_BY_ID[v.food], sel: v.sel, side: !!v.side, drink: !!v.drink };
  }
  Game.visitIdx++;
  const returning = [...new Set(Game.history.map((h) => h.customerId))].filter((c) => c !== Game.lastCustomerId);
  const pool = CUSTOMERS.filter((c) => c.id !== Game.lastCustomerId);
  const customer = returning.length && Math.random() < 0.45 ? CUSTOMER_BY_ID[pick(returning)] : pick(pool);
  const open = FOODS.filter((f) => f.unlock <= Game.level);
  const fresh = open.filter((f) => f.unlock === Game.level && Game.level > 1 && !Game.history.some((h) => h.foodId === f.id));
  const favs = open.filter((f) => customer.favs.includes(f.id));
  const food = fresh.length && Math.random() < 0.6 ? pick(fresh) : pick(favs.length ? favs : open);
  const comboFood = ['burger', 'hotdog', 'chickensandwich', 'nuggets', 'sandwich'].includes(food.id);
  return { customer, food, side: Game.level >= 2 && comboFood && Math.random() < 0.5, drink: Game.level >= 2 && Math.random() < 0.55 };
}

async function nextCustomer() {
  Game.phase = 'arriving';
  const v = chooseVisit();
  const { customer, food } = v;
  const sel = v.sel ? JSON.parse(JSON.stringify(v.sel)) : AI.generateOrder(customer, food, Game.level);
  Game.orderNo++;
  Game.customer = customer;
  Game.lastCustomerId = customer.id;
  Game.mood = 'neutral';
  Game.order = {
    customerId: customer.id, customerName: customer.name, foodId: food.id, sel, name: AI.orderName(food, sel),
    side: v.side ? { id: 'fries', season: customer.prefs.includes('spicy') ? 'cajun' : Math.random() < 0.8 ? 'salt' : 'plain' } : null,
    drink: v.drink ? pick(DRINKS).id : null,
  };
  Game.elapsed = 0; Game.plated = null; Game.mainResult = null; Game.impatientShown = false; Game.chatterT = 0;
  Game.patience = 60 + resolveLayers(food, sel).filter((id) => INGREDIENTS[id].cook).length * 25 + (v.side ? 25 : 0) + (v.drink ? 15 : 0);
  Game.insight = AI.insightFor(customer.id, Game.history);
  Kitchen.resetOrder();
  renderTray();
  $('customerName').textContent = customer.name;

  const el = $('customer');
  el.classList.add('walking');
  el.classList.remove('offstage');
  const steps = setInterval(() => Sound.play('step'), 340);
  await wait(1450);
  clearInterval(steps);
  el.classList.remove('walking');
  Sound.play('arrive');

  const returning = Game.history.some((h) => h.customerId === customer.id);
  const line = returning && customer.look.type !== 'robot' ? pick([...DIALOGUE.returning, ...customer.lines.greet]) : pick(customer.lines.greet);
  let text = line.replace('{food}', Game.order.name.toLowerCase());
  const extras = [Game.order.side && 'fries', Game.order.drink && `a ${DRINK_BY_ID[Game.order.drink].name}`].filter(Boolean);
  if (extras.length) text += ` With ${extras.join(' and ')}!`;
  say(text);
  renderTicket();
  setRightCol('front');
  show($('rightCol'));
  show($('takeOrderBtn')); hide($('serveBtn'));
  Game.phase = 'ordering';
  if (Game.insight) setTimeout(showInsight, 700);
}

function showInsight() {
  const ins = Game.insight;
  if (!ins || !['ordering', 'cooking'].includes(Game.phase)) return;
  $('insight').innerHTML = `
    <span class="x" onclick="hide($('insight'))">✕</span>
    <h4>🧠 AI CUSTOMER INSIGHT</h4>
    <p><b>${Game.customer.name}</b> has visited ${ins.visits} time${ins.visits > 1 ? 's' : ''} before.</p>
    <p>This customer ${ins.text}.</p>
    <div class="rec">Recommended customization: ${ins.rec}</div>
    <div class="consent">🔒 Preference memory is ON — ${Game.customer.name} gave permission to remember past orders. Look for <b>AI PICK</b> tags at the stations.</div>`;
  show($('insight'));
  Sound.play('confirm');
  clearTimeout(showInsight.timer);
  showInsight.timer = setTimeout(() => hide($('insight')), 9000);
}

/* ---------------- ticket ---------------- */
function renderTicket() {
  const o = Game.order, food = FOOD_BY_ID[o.foodId];
  $('ticketNo').textContent = `ORDER #${String(Game.orderNo).padStart(3, '0')}`;
  $('ticketWho').textContent = o.customerName.toUpperCase();
  $('ticketEmoji').textContent = food.emoji;
  $('ticketFood').textContent = o.name.toUpperCase();
  $('ticketRows').innerHTML = AI.ticketRows(o).map((r) => `<div class="t-row"><label>${r.label}:</label><div>${r.values.map((v) => `<span class="${v.no ? 'no' : ''}">${v.text}</span>`).join('')}</div></div>`).join('');
  updateTicketStatus(true);
  $('patienceFill').style.width = '100%';
  $('patienceFill').classList.remove('low');
  $('timer').textContent = '0s';
  $('ticketTime').textContent = '00:00';
}
function updateTicketStatus(force) {
  const o = Game.order;
  if (!o) return;
  const mainState = Game.plated ? 'done' : Kitchen.main ? 'qc' : '';
  const sideDone = !!Kitchen.side, drinkDone = !!Kitchen.drinkOut;
  const sig = `${Game.orderNo}|${mainState}|${sideDone}|${drinkDone}`;
  if (!force && sig === updateTicketStatus.sig) return;
  updateTicketStatus.sig = sig;
  $('ticketMainCheck').className = mainState === 'done' ? 'chk on' : 'chk';
  let h = '';
  if (o.side) h += `<div class="t-extra ${sideDone ? 'done' : ''}"><label>SIDE:</label><span>🍟 FRIES (${SIDES.fries.seasons.find((s) => s.id === o.side.season).label.toUpperCase()})</span><i>${sideDone ? '✓' : ''}</i></div>`;
  if (o.drink) h += `<div class="t-extra ${drinkDone ? 'done' : ''}"><label>DRINK:</label><span>🥤 ${DRINK_BY_ID[o.drink].name.toUpperCase()}</span><i>${drinkDone ? '✓' : ''}</i></div>`;
  $('ticketExtras').innerHTML = h;
}
function setRightCol(mode) {
  const el = $('rightCol');
  const hidden = el.classList.contains('hidden');
  el.className = `right-col ${mode}${hidden ? ' hidden' : ''}`;
}

/* =========================================================
   STATIONS & NAVIGATION
   ========================================================= */
function takeOrder() {
  if (Game.phase !== 'ordering') return;
  Sound.play('orderBell');
  hide($('takeOrderBtn'));
  hide($('bubble'));
  Game.phase = 'cooking';
  Game.elapsed = 0;
  show($('stationBar'));
  const first = STATIONS.find((s) => s.id !== 'front' && stationStatus(s.id).needed);
  goStation(first ? first.id : 'prep');
  Game.notify('🤖 AI: the stations you need are highlighted below.');
}

function goStation(id) {
  if (Game.phase === 'printing' || STATION_UNLOCK[id] > Game.level) { Sound.play('error'); return; }
  if (!['cooking', 'ready', 'serving'].includes(Game.phase) && id !== 'front') return;
  if (Game.view !== id) Sound.play('tab');
  Game.view = id;
  Kitchen.show(id);
  if (id === 'front') { hide($('kitchen')); setRightCol('front'); }
  else { show($('kitchen')); setRightCol('docked'); hide($('insight')); }
  renderStationBar(true);
}
function goStationRaw(id) { Game.view = id; Kitchen.show(id); hide($('kitchen')); setRightCol('front'); renderStationBar(true); }

// What does the current order still need at each station?
function stationStatus(id) {
  const o = Game.order;
  const st = { needed: false, done: false, busy: false, label: '' };
  if (!o || !['cooking', 'ready', 'serving'].includes(Game.phase)) return st;
  const food = FOOD_BY_ID[o.foodId];
  const req = resolveLayers(food, o.sel);
  const mainDone = !!(Kitchen.main || Game.plated);
  const left = Kitchen.neededCooked();
  if (id === 'grill') {
    const any = req.some((x) => INGREDIENTS[x].cook === 'grill');
    st.needed = any && !mainDone && left.some((x) => INGREDIENTS[x].cook === 'grill');
    st.done = any && !st.needed;
    st.busy = Kitchen.grill.on && Kitchen.grill.slots.some(Boolean);
  } else if (id === 'fryer') {
    const any = req.some((x) => INGREDIENTS[x].cook === 'fryer');
    st.needed = (any && !mainDone && left.some((x) => INGREDIENTS[x].cook === 'fryer')) || (!!o.side && !Kitchen.side);
    st.done = (any || !!o.side) && !st.needed;
    st.busy = Kitchen.fryer.baskets.some((b) => b.item && b.down);
  } else if (id === food.station) {
    st.needed = !mainDone;
    st.done = mainDone;
    st.busy = (id === 'pizza' && Kitchen.pizza.stage === 'oven') || (id === 'taco' && !!Kitchen.warmer);
  } else if (id === 'drinks') {
    st.needed = !!o.drink && !Kitchen.drinkOut;
    st.done = !!o.drink && !!Kitchen.drinkOut;
  } else if (id === 'front') {
    st.needed = Game.phase === 'ready';
    st.label = Game.phase === 'ready' ? 'SERVE!' : '';
  }
  return st;
}

function renderStationBar(force) {
  const html = STATIONS.map((s, i) => {
    const locked = STATION_UNLOCK[s.id] > Game.level;
    const st = stationStatus(s.id);
    const chip = locked ? `🔒 LVL ${STATION_UNLOCK[s.id]}` : st.label || (st.busy ? '🔥 COOKING' : st.needed ? 'NEEDED' : st.done ? '✓ DONE' : '');
    const cls = [Game.view === s.id ? 'active' : '', locked ? 'locked' : '', st.needed ? 'needed' : '', st.done ? 'done' : '', st.busy ? 'busy' : ''].join(' ');
    return `<button class="st-btn ${cls}" data-station="${s.id}" title="${s.desc} (key ${i + 1})"><span class="st-icon">${s.icon}</span><span class="st-label">${s.label}</span>${chip ? `<span class="st-chip">${chip}</span>` : ''}</button>`;
  }).join('');
  if (force || html !== renderStationBar.last) { $('stationBar').innerHTML = html; renderStationBar.last = html; }
}

/* ---------------- AI assist panel ---------------- */
function aiAdvice() {
  const o = Game.order;
  if (!o) return { next: '', tips: [] };
  const food = FOOD_BY_ID[o.foodId];
  const tips = [];
  let next = '';
  if (Game.phase === 'ordering') return { next: 'Read the ticket, then press TAKE ORDER.', tips: [`I'll guide you through the ${o.name.toLowerCase()}.`, 'HUMANS CREATE · AI ASSISTS · AUTOMATION FINISHES'] };
  if (Game.phase === 'serving' || Game.phase === 'results') return { next: 'Serving the customer...', tips: [] };
  if (Game.phase === 'ready') {
    const left = [o.side && !Kitchen.side && 'fries at the FRYER', o.drink && !Kitchen.drinkOut && `a ${DRINK_BY_ID[o.drink].name} at DRINKS`].filter(Boolean);
    return { next: left.length ? `Main is plated! Still needed: ${left.join(' and ')}.` : 'Everything is ready — SERVE the order at the FRONT!', tips: ['Serving fast earns a speed bonus.', 'After serving you can PRINT IT IN REAL LIFE 🖨'] };
  }
  if (Kitchen.qc) return { next: 'Scanning your food for mistakes...', tips: ['You can fix problems before printing.'] };
  const left = Kitchen.neededCooked();
  const onGrill = Kitchen.grill.slots.filter(Boolean);
  const inFryer = Kitchen.fryer.baskets.filter((b) => b.item);
  if (onGrill.length) {
    const it = onGrill[0], ing = INGREDIENTS[it.id];
    const v = it.s[it.down];
    next = !Kitchen.grill.on ? 'Turn on the grill! 🔥' : it.flips === 0 ? (v >= 0.9 ? `FLIP the ${ing.name} now!` : `Cooking side 1 of the ${ing.name} (${Math.round(Math.min(v, 1) * 100)}%)`) : it.s[0] >= 0.9 && it.s[1] >= 0.9 ? `TAKE the ${ing.name} off the grill!` : `Cooking side 2 (${Math.round(Math.min(v, 1) * 100)}%)`;
    tips.push(`Recommended: ~${ing.time}s per side, flip once in the green zone.`);
  } else if (inFryer.length) {
    const b = inFryer[0], ing = INGREDIENTS[b.item.id];
    next = !b.down ? `Drop the basket to fry the ${ing.name}.` : b.item.cook >= 0.9 ? `LIFT the basket — ${ing.name} is ready!` : `Frying ${ing.name} (${Math.round(b.item.cook * 100)}%)`;
    tips.push(`Recommended fry time: ~${ing.time}s.`);
  } else if (left.length) {
    const ing = INGREDIENTS[left[0]];
    next = `Cook a ${ing.raw || ing.name} at the ${ing.cook.toUpperCase()}.`;
    tips.push(ing.cook === 'grill' ? `Recommended: ~${ing.time}s per side, flip once.` : `Recommended fry time: ~${ing.time}s, lift in the green zone.`);
  } else if (Kitchen.dump) {
    next = 'Season and box the fries at the FRY STATION.';
  } else if (food.station === 'pizza') {
    const p = Kitchen.pizza;
    next = { empty: 'Place a dough ball at the PIZZA station.', ball: 'Stretch the dough until it is round.', top: 'Add sauce, cheese and toppings, then bake.', oven: `Baking... take it out in the green zone (~${INGREDIENTS.dough.time}s).`, baked: 'Press FINISH for the AI quality check.' }[p.stage];
  } else if (food.station === 'taco' && !Kitchen.builds.taco.foodId) {
    next = Kitchen.warmer ? 'Move the warm shell to the holder.' : 'Warm a taco shell at the TACO station.';
    tips.push(`Shells need about ${INGREDIENTS.hardShell.time}s on the warmer.`);
  } else {
    const b = Kitchen.builds[food.station];
    next = b && b.items.length ? `Keep building at ${food.station.toUpperCase()}, then press FINISH.` : `Build the ${food.name.toLowerCase()} at the ${food.station.toUpperCase()} station.`;
  }
  if (o.side && !Kitchen.side && !Kitchen.dump && !inFryer.some((b) => b.item.id === 'friesReg')) tips.push(`Side order: fry the fries (${SIDES.fries.seasons.find((s) => s.id === o.side.season).label}).`);
  if (o.drink && !Kitchen.drinkOut) tips.push(`Pour a ${DRINK_BY_ID[o.drink].name} at DRINKS — stop at the line.`);
  tips.push(`Stack order: ${AI.recommendedStack(o).join(' → ')}`);
  if (Game.insight) tips.push(`Personal touch: ${o.customerName} ${Game.insight.text}.`);
  return { next, tips };
}
function renderAiAssist() {
  const a = aiAdvice();
  const html = `<div class="aa-next"><label>NEXT STEP</label>${a.next}</div>${a.tips.slice(0, 3).map((t) => `<div class="aa-tip">💡 ${t}</div>`).join('')}`;
  if (html !== renderAiAssist.last) { $('aiAssistBody').innerHTML = html; renderAiAssist.last = html; }
}

/* ---------------- serving tray on the counter ---------------- */
function renderTray() {
  const cv = $('trayCanvas'), c = cv.getContext('2d');
  c.setTransform(2, 0, 0, 2, 0, 0);
  c.clearRect(0, 0, 420, 160);
  c.fillStyle = 'rgba(10,30,60,0.25)'; c.beginPath(); c.ellipse(210, 140, 200, 16, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1f55cc'; c.beginPath(); c.roundRect(14, 108, 392, 30, 16); c.fill();
  c.fillStyle = '#5fa0ff'; c.beginPath(); c.roundRect(20, 100, 380, 30, 14); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(40, 104, 340, 3);
  if (Kitchen.side) drawFood(c, buildSideFries(Kitchen.side), 70, 120, 0.42);
  if (Game.plated) drawFood(c, Game.plated, 205, 118, fitScale(Game.plated, 170, 110) * 0.95);
  if (Kitchen.drinkOut) drawDrink(c, 350, 124, 0.62, DRINK_BY_ID[Kitchen.drinkOut.id], Kitchen.drinkOut.fill, { lid: true });
}
Game.onItemReady = () => { renderTray(); updateTicketStatus(true); };
Game.onQC = () => { renderStationBar(true); };

/* =========================================================
   PLATING (the AI check passed → food goes on the tray)
   ========================================================= */
Game.plateMain = function () {
  const main = Kitchen.main;
  if (!main) return;
  const food = FOOD_BY_ID[main.foodId];
  Game.qcScore = AI.qualityCheck(Game.order, main).score;
  Game.plated = buildFromItems(food, main.items);
  Game.mainResult = { ...main };
  if (main.station === 'pizza') Kitchen.pizza = { stage: 'empty', stretch: 0, items: [], bake: 0, wobble: 0 };
  else Kitchen.builds[main.station] = { foodId: null, items: [] };
  Kitchen.main = null;
  Game.phase = 'ready';
  renderTray();
  Sound.play('place');
  show($('serveBtn'));
  updateTicketStatus(true);
  renderStationBar(true);
  const left = [Game.order.side && !Kitchen.side && 'fries', Game.order.drink && !Kitchen.drinkOut && 'drink'].filter(Boolean);
  if (left.length) Game.notify(`🍽 ${food.name} plated! Still need: ${left.join(' + ')}`);
  else { Game.notify(`🍽 ${food.name} plated! Serve it at the front.`); goStation('front'); }
};

/* =========================================================
   SERVING, REACTION, RESULTS
   ========================================================= */
async function serveOrder() {
  if (Game.phase !== 'ready') return;
  if (Game.view !== 'front') goStation('front');
  Game.phase = 'serving';
  hide($('serveBtn'));
  Sound.play('whoosh');
  $('trayCanvas').classList.remove('served'); void $('trayCanvas').offsetWidth; $('trayCanvas').classList.add('served');
  await wait(700);
  Sound.play('place');
  await wait(300);

  const out = { main: Game.mainResult, side: Kitchen.side, drink: Kitchen.drinkOut };
  const r = AI.evaluate(Game.order, out, Game.elapsed);
  const reaction = AI.reaction(Game.customer, Game.order, r);
  Game.mood = reaction.mood;
  say(reaction.text);
  showHearts(r.stars);
  if (r.stars >= 4) { $('customer').classList.add('bounce'); Sound.play('happy'); } else Sound.play('sad');
  setTimeout(() => $('customer').classList.remove('bounce'), 1000);

  const food = FOOD_BY_ID[Game.order.foodId];
  const learnt = AI.orderTags(food, Game.order.sel);
  Game.history.push({ customerId: Game.customer.id, foodId: food.id, tags: learnt.tags, avoided: learnt.avoided, stars: r.stars });
  Game.money += r.earned;
  Game.served++;
  Game.ratings.push(r.stars);
  const prev = Game.level;
  Game.level = LEVELS.filter((l) => Game.served >= l.ordersNeeded).pop().level;
  Game.leveledUp = Game.level > prev;
  hide($('stationBar'));
  await wait(1900);
  showResults(r, reaction, learnt);
}

function showHearts(n) {
  const h = $('hearts');
  h.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}" style="animation-delay:${i * 0.12}s">${i < n ? '❤️' : '🤍'}</span>`).join('');
  hide(h); void h.offsetWidth; show(h);
  setTimeout(() => hide(h), 2600);
}

function showResults(r, reaction, learnt) {
  Game.phase = 'results';
  const cv = $('resultFood'), c = cv.getContext('2d');
  c.clearRect(0, 0, 400, 300);
  const b = Game.plated;
  const s = fitScale(b, 230, 200);
  drawFood(c, b, 200, 215 - b.bottom * s, s);
  if (Kitchen.side) drawFood(c, buildSideFries(Kitchen.side), 62, 280, 0.42);
  if (Kitchen.drinkOut) drawDrink(c, 345, 288, 0.62, DRINK_BY_ID[Kitchen.drinkOut.id], Kitchen.drinkOut.fill, { lid: true });
  $('resultQuote').textContent = `${Game.customer.name}: “${reaction.text}”`;
  $('resultHearts').innerHTML = Array.from({ length: 5 }, (_, i) => (i < r.stars ? '❤️' : '🤍')).join('');
  $('resultTitle').textContent = r.stars >= 5 ? 'PERFECT ORDER!' : r.stars >= 4 ? 'GREAT JOB!' : r.stars >= 3 ? 'ORDER COMPLETE' : 'NEEDS IMPROVEMENT';
  const metrics = [['acc', r.accuracy], ['cook', r.cooking], ['speed', r.speed], ['pres', r.presentation]];
  metrics.forEach(([k, v]) => { $('m-' + k).style.width = '0%'; $('t-' + k).textContent = pct(v); $('m-' + k).className = v >= 0.9 ? 'good' : v >= 0.7 ? 'ok' : 'bad'; });
  if (!r.cookingApplicable) $('t-cook').textContent = 'N/A';
  $('t-total').textContent = '0%';
  $('stars').innerHTML = [1, 2, 3, 4, 5].map((i) => (i <= r.stars ? `<span class="lit" style="animation-delay:${0.9 + i * 0.15}s">★</span>` : '<span>★</span>')).join('');
  const items = [];
  if (!r.foodOk) items.push(`Wrong food: made ${r.madeFoodId ? FOOD_BY_ID[r.madeFoodId].name : 'nothing'}, ordered ${FOOD_BY_ID[Game.order.foodId].name}`);
  r.missing.forEach((m) => items.push(`Missing: ${m}`));
  r.extra.forEach((m) => items.push(`Not ordered: ${m}`));
  r.cookIssues.forEach((m) => items.push(`Cooking — ${m}`));
  r.presIssues.forEach((m) => items.push(m));
  r.extras.forEach((m) => items.push(m));
  if (r.speed < 1) items.push(`Took ${Math.round(r.seconds)}s (target ${r.par}s)`);
  $('mistakes').innerHTML = items.length ? items.slice(0, 6).map((t) => `<li>${t}</li>`).join('') : '<li class="good">✓ Flawless — every detail matched the ticket!</li>';
  $('earnedBreakdown').innerHTML = `Order $${r.base}${r.tip ? ` + tip $${r.tip}` : ''}`;
  $('xpGain').textContent = `+${r.xp} XP`;
  const tagText = [...new Set(learnt.tags)].map((t) => (TAG_INFO[t] ? TAG_INFO[t].rec.toLowerCase() : null)).filter(Boolean);
  $('learned').textContent = tagText.length ? `🧠 AI preference memory (with permission) noted ${Game.customer.name}'s choices: ${tagText.join(', ')}.` : `🧠 AI preference memory updated for ${Game.customer.name} (with permission).`;
  $('printIrlBtn').disabled = false;
  $('printIrlBtn').innerHTML = '🖨 PRINT IT IN REAL LIFE ▶';
  $('irlOffer').classList.remove('done');
  Game.lastResult = r;
  show($('results'));
  metrics.forEach(([k, v], i) => setTimeout(() => { $('m-' + k).style.width = `${Math.max(3, v * 100)}%`; Sound.play('tick'); }, 150 + i * 160));
  const t0 = performance.now() + 500;
  const tick = (now) => {
    const k = Math.max(0, Math.min(1, (now - t0) / 1100));
    $('earned').textContent = `+$${Math.round(r.earned * k)}`;
    $('t-total').textContent = pct(r.total * k);
    if (k < 1 && Game.phase === 'results') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  for (let i = 1; i <= r.stars; i++) setTimeout(() => Sound.play('star', i), 900 + i * 150);
  setTimeout(() => { Sound.play('money'); updateHud(); $('money').classList.remove('bump'); void $('money').offsetWidth; $('money').classList.add('bump'); }, 1700);
}

async function nextOrder() {
  if (Game.phase !== 'results') return;
  Sound.play('click');
  Game.phase = 'leaving';
  hide($('results'));
  hide($('rightCol'));
    Kitchen.resetOrder();
  renderTray();
  updateHud();
  const el = $('customer');
  el.classList.add('walking', 'leaving');
  say('Bye! 👋', 1200);
  const steps = setInterval(() => Sound.play('step'), 340);
  if (Game.leveledUp) {
    const lvl = LEVELS[Game.level - 1];
    setTimeout(() => { Sound.play('levelUp'); toast(`LEVEL ${lvl.level} — ${lvl.title.toUpperCase()}!<small>Unlocked: ${lvl.unlocks}</small>`, 3800); }, 400);
    Game.leveledUp = false;
  }
  await wait(1500);
  clearInterval(steps);
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
  c: $('startFood').getContext('2d'), build: null, t: 0, i: 0,
  next() { const f = FOODS[this.i++ % FOODS.length]; this.build = buildFood(f, AI.defaultSelection(f)); this.t = 0; },
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

/* =========================================================
   MAIN LOOP
   ========================================================= */
let last = performance.now();
let uiTimer = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const modalOpen = !$('aboutModal').classList.contains('hidden') || !$('ethicsModal').classList.contains('hidden');
  try {
    if (Game.phase === 'start') Showcase.update(dt);
    if (Game.job) Game.job.update(dt);
    if (!modalOpen) Kitchen.update(dt);
    if (Irl.active) { Irl.update(dt); Irl.draw(t); }
    if (Game.view === 'front') {
      drawCustomer(customerCtx, Game.customer ? Game.customer.look : CUSTOMERS[0].look, Game.mood, t);
    } else Kitchen.draw();

    if (['cooking', 'ready'].includes(Game.phase) && !modalOpen) {
      Game.elapsed += dt;
      const left = Math.max(0, 1 - Game.elapsed / Game.patience);
      $('patienceFill').style.width = `${left * 100}%`;
      $('patienceFill').classList.toggle('low', left < 0.3);
      $('timer').textContent = `${Math.floor(Game.elapsed)}s`;
      if (left === 0 && !Game.impatientShown) { Game.impatientShown = true; Game.mood = 'sad'; say(pick(DIALOGUE.impatient), 3000); Game.notify(`😟 ${Game.customer.name} is getting impatient!`); }
      Game.chatterT += dt;
      if (Game.chatterT > 22 && Game.view === 'front' && left > 0) { Game.chatterT = 0; say(pick(['Mmm, smells futuristic!', 'I love this game restaurant!', 'Take your time, chef!', 'I can hear it sizzling!']), 2500); }
    }
    uiTimer += dt;
    if (uiTimer > 0.15 && Game.order) {
      uiTimer = 0;
      renderStationBar();
      renderAiAssist();
      updateTicketStatus();
      const mm = Math.floor(Game.elapsed / 60), ss = Math.floor(Game.elapsed % 60);
      $('ticketTime').textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      if (Game.phase === 'ready') {
        const missing = [Game.order.side && !Kitchen.side && 'fries', Game.order.drink && !Kitchen.drinkOut && 'drink'].filter(Boolean);
        const html = missing.length ? `SERVE ORDER 🍽<small>still missing: ${missing.join(' + ')}</small>` : 'SERVE ORDER 🍽';
        if ($('serveBtn').innerHTML !== html) $('serveBtn').innerHTML = html;
      }
    }
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(loop);
}

/* =========================================================
   EVENTS
   ========================================================= */
function startGame() {
  Sound.start();
  Sound.play('click');
  hide($('startScreen'));
  Game.phase = 'starting';
  updateHud();
  setTimeout(nextCustomer, 400);
}

$('startBtn').onclick = startGame;
$('takeOrderBtn').onclick = takeOrder;
$('serveBtn').onclick = serveOrder;
$('nextBtn').onclick = nextOrder;
$('printIrlBtn').onclick = () => {
  if (Game.phase !== 'results' || !Game.plated) return;
  Sound.play('click');
  hide($('results'));
  Game.phase = 'irl';
  const main = Game.mainResult;
  const plan = AI.synthesisPlan(Game.order, main, Game.plated, Game.qcScore || 1, Game.insight);
  Irl.start(Game.plated, Game.order, plan);
};
Game.afterIrl = (skipped) => {
  Game.phase = 'results';
  $('printIrlBtn').disabled = true;
  $('printIrlBtn').innerHTML = '✓ PRINTED &amp; EATEN!';
  $('irlOffer').classList.add('done');
  show($('results'));
  if (!skipped) Sound.play('money');
};
$('stationBar').addEventListener('click', (e) => { const b = e.target.closest('[data-station]'); if (b) goStation(b.dataset.station); });
const openModal = (id) => { Sound.play('click'); show($(id)); };
$('aboutBtn').onclick = $('aboutBtn2').onclick = () => openModal('aboutModal');
$('ethicsBtn').onclick = $('ethicsBtn2').onclick = () => openModal('ethicsModal');
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => { Sound.play('click'); hide(b.closest('.overlay')); }));
document.querySelectorAll('#aboutModal, #ethicsModal').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) hide(o); }));

// volume panel
$('soundBtn').onclick = () => { Sound.play('click'); $('volumePanel').classList.toggle('hidden'); };
document.querySelectorAll('[data-vol]').forEach((inp) => {
  inp.value = Sound.volume[inp.dataset.vol];
  inp.oninput = () => Sound.setVolume(inp.dataset.vol, +inp.value);
});
const syncMute = () => { $('soundBtn').textContent = Sound.enabled ? '🔊' : '🔇'; $('muteBtn').textContent = Sound.enabled ? 'MUTE ALL' : 'UNMUTE'; };
$('muteBtn').onclick = () => { Sound.toggleMute(); syncMute(); };
syncMute();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { hide($('aboutModal')); hide($('ethicsModal')); hide($('volumePanel')); }
  if ((e.key === ' ' || e.key === 'Enter') && Irl.active) { e.preventDefault(); Irl.finish(true); }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= STATIONS.length && ['cooking', 'ready'].includes(Game.phase)) goStation(STATIONS[n - 1].id);
});

renderMenu();
renderTray();
requestAnimationFrame(loop);
