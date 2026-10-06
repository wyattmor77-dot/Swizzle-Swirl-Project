/* =========================================================
   AI FOOD FACTORY — SIMULATED AI ASSISTANT
   "HUMANS CREATE. AI ASSISTS. AUTOMATION FINISHES."
   The player does the cooking. This programmed logic plays
   the role of an AI assistant: it reads orders, recommends
   cooking times and stacking order, scans the finished food
   for mistakes, plans the 3D printer's synthesis sequence and
   personalises suggestions from a customer's past orders.
   It is NOT a trained machine-learning model and needs no
   internet connection or API key.
   ========================================================= */
const AI = {
  /* ---------- orders ---------- */
  defaultSelection(food) {
    const sel = {};
    for (const g of food.groups) sel[g.id] = g.type === 'single' ? g.default : [...g.default];
    return sel;
  },

  generateOrder(customer, food, level) {
    const sel = this.defaultSelection(food);
    const changeChance = 0.2 + Math.min(level, 6) * 0.06;
    for (const g of food.groups) {
      if (g.type === 'single') {
        if (Math.random() < changeChance) sel[g.id] = g.options[Math.floor(Math.random() * g.options.length)].id;
        // customers are consistent: they pick options matching their favourite tag
        const liked = g.options.filter((o) => o.tags.some((t) => customer.prefs.includes(t)));
        if (liked.length) sel[g.id] = liked[Math.floor(Math.random() * liked.length)].id;
        const cur = g.options.find((o) => o.id === sel[g.id]);
        if (cur.tags.some((t) => customer.avoid.includes(t))) sel[g.id] = g.default;
      } else {
        const set = new Set(sel[g.id]);
        for (const o of g.options) if (Math.random() < changeChance * 0.8) { if (set.has(o.id)) set.delete(o.id); else set.add(o.id); }
        for (const o of g.options) {
          if (o.tags.some((t) => customer.prefs.includes(t)) && Math.random() < 0.75) set.add(o.id);
          if (o.tags.some((t) => customer.avoid.includes(t))) set.delete(o.id);
        }
        sel[g.id] = g.options.map((o) => o.id).filter((id) => set.has(id));
      }
    }
    return sel;
  },

  orderName(food, sel) {
    return food.displayName ? food.displayName(sel) : food.name;
  },

  // Ticket rows like a real kitchen ticket: { label, values:[{text, no}] }
  ticketRows(order) {
    const food = FOOD_BY_ID[order.foodId];
    const rows = [];
    const cooks = resolveLayers(food, order.sel).filter((id) => INGREDIENTS[id].cook && INGREDIENTS[id].cook !== 'oven');
    if (cooks.length || food.id === 'pizza') rows.push({ label: food.id === 'pizza' ? 'Bake' : food.id === 'tacos' ? 'Heat' : 'Cook', values: [{ text: food.id === 'tacos' ? 'WARM SHELL' : 'PERFECT' }] });
    for (const g of food.groups) {
      if (g.type === 'single') {
        const o = g.options.find((x) => x.id === order.sel[g.id]);
        rows.push({ label: g.label, values: [{ text: o.layers.length ? o.label.toUpperCase() : 'NONE', no: !o.layers.length }] });
      } else {
        const vals = [];
        for (const o of g.options) {
          if (order.sel[g.id].includes(o.id)) vals.push({ text: o.label.toUpperCase() });
          else if (g.default.includes(o.id)) vals.push({ text: `NO ${o.label.toUpperCase()}`, no: true });
        }
        if (!vals.length) vals.push({ text: 'NONE', no: true });
        rows.push({ label: g.label, values: vals });
      }
    }
    return rows;
  },

  // Customizations that differ from the standard recipe (shown by the AI scan)
  customizations(order) {
    const food = FOOD_BY_ID[order.foodId];
    const out = [];
    for (const g of food.groups) {
      if (g.type === 'single') {
        if (order.sel[g.id] !== g.default) { const o = g.options.find((x) => x.id === order.sel[g.id]); out.push(o.layers.length ? o.label : `No ${g.label.toLowerCase()}`); }
      } else {
        for (const o of g.options) {
          const on = order.sel[g.id].includes(o.id), def = g.default.includes(o.id);
          if (on && !def) out.push(`+${o.label}`);
          if (!on && def) out.push(`No ${o.label.toLowerCase()}`);
        }
      }
    }
    return out;
  },

  // AI-recommended stacking order for the order (what the printer will follow)
  recommendedStack(order) {
    return resolveLayers(FOOD_BY_ID[order.foodId], order.sel).map((id) => INGREDIENTS[id].name);
  },

  /* ---------- comparisons ---------- */
  compareItems(order, main) {
    const food = FOOD_BY_ID[order.foodId];
    if (!main || main.foodId !== order.foodId) return { foodOk: false, accuracy: 0, missing: [], extra: [], matched: 0 };
    const req = resolveLayers(food, order.sel);
    const got = main.items.map((i) => i.id);
    const count = (arr) => arr.reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {});
    const R = count(req), G = count(got);
    let matched = 0, extraN = 0;
    const missing = [], extra = [];
    for (const id of new Set([...req, ...got])) {
      const r = R[id] || 0, g = G[id] || 0;
      matched += Math.min(r, g);
      if (r > g) for (let k = 0; k < r - g; k++) missing.push(INGREDIENTS[id].name);
      if (g > r) { extraN += g - r; for (let k = 0; k < g - r; k++) extra.push(INGREDIENTS[id].name); }
    }
    return { foodOk: true, accuracy: matched / (req.length + extraN), missing, extra, matched, total: req.length };
  },

  cooking(main, side) {
    const items = [...(main ? main.cookItems : [])];
    if (side) items.push({ name: 'Fries', q: side.q, label: side.label });
    if (!items.length) return { score: 1, applicable: false, issues: [], items };
    const score = items.reduce((a, i) => a + i.q, 0) / items.length;
    const issues = items.filter((i) => i.q < 0.85).map((i) => `${i.name}: ${i.label}`);
    return { score, applicable: true, issues, items };
  },

  presentation(main) {
    if (!main) return { score: 0, issues: ['Nothing was made'] };
    const food = FOOD_BY_ID[main.foodId];
    const ids = main.items.map((i) => i.id);
    let score = 1;
    const issues = [];
    if (!baseIdsFor(food).includes(ids[0])) { score -= 0.35; issues.push('Base is not at the bottom'); }
    const last = food.printing[food.printing.length - 1];
    let tops = [];
    if (typeof last === 'string' && /Top|top/.test(INGREDIENTS[last].name + INGREDIENTS[last].shape)) tops = [last];
    if (typeof last === 'object' && last.key === 'top') tops = food.groups.find((g) => g.id === last.group).options.flatMap((o) => o.top || []);
    if (tops.length) {
      const hasTop = ids.slice(1).some((id) => tops.includes(id));
      if (!hasTop) { score -= 0.2; issues.push('Missing the top layer'); }
      else if (!tops.includes(ids[ids.length - 1])) { score -= 0.3; issues.push(`${INGREDIENTS[ids.find((id, i) => i > 0 && tops.includes(id))].name} should go on top`); }
    }
    if (food.id === 'pizza') {
      const sauce = ids.findIndex((id) => INGREDIENTS[id].shape === 'pizzaSauce'), cheese = ids.indexOf('mozzarella');
      if (sauce > -1 && cheese > -1 && sauce > cheese) { score -= 0.15; issues.push('Sauce should go under the cheese'); }
    }
    if (ids.includes('cherry') && ids[ids.length - 1] !== 'cherry') { score -= 0.15; issues.push('The cherry goes on top'); }
    return { score: Math.max(0.3, score), issues };
  },

  drinkScore(drink) {
    if (!drink) return 0;
    if (drink.overflow > 0) return 0.5;
    return Math.max(0.4, 1 - Math.abs(drink.fill - DRINK_TARGET) * 3);
  },

  /* ---------- AI quality control scan (after cooking/assembly) ---------- */
  qualityCheck(order, main) {
    const food = FOOD_BY_ID[order.foodId];
    const cmp = this.compareItems(order, main);
    const ck = this.cooking(main, null);
    const pr = this.presentation(main);
    const custom = this.customizations(order);
    const checks = [];
    checks.push(cmp.foodOk ? { ok: true, text: `Correct food: ${food.name}` } : { ok: false, text: 'Wrong food detected', detail: `Ticket says ${food.name}, scan found ${FOOD_BY_ID[main.foodId].name}` });
    if (cmp.foodOk) {
      const fine = !cmp.missing.length && !cmp.extra.length;
      checks.push(fine ? { ok: true, text: 'Correct ingredients', detail: `${cmp.matched}/${cmp.total} layers match the ticket` }
        : { ok: false, text: 'Ingredient mismatch', detail: [cmp.missing.length ? `Missing: ${cmp.missing.join(', ')}` : '', cmp.extra.length ? `Not ordered: ${cmp.extra.join(', ')}` : ''].filter(Boolean).join(' · ') });
    }
    checks.push(!ck.applicable ? { ok: true, text: 'Cooking: none required' }
      : !ck.issues.length ? { ok: true, text: 'Cooking temperature acceptable', detail: ck.items.map((i) => `${i.name}: ${i.label}`).join(' · ') }
      : { ok: false, text: 'Cooking issue detected', detail: ck.issues.join(' · ') });
    checks.push({ ok: true, text: 'Order customization detected', detail: custom.length ? custom.join(', ') : 'Standard recipe' });
    checks.push(!pr.issues.length ? { ok: true, text: 'Presentation acceptable' } : { ok: false, text: 'Presentation issue', detail: pr.issues.join(' · ') });
    const score = cmp.foodOk ? 0.5 * cmp.accuracy + 0.3 * ck.score + 0.2 * pr.score : 0.15;
    return { checks, score, cmp, ck, pr };
  },

  /* ---------- final evaluation when the order is served ---------- */
  evaluate(order, out, seconds) {
    const food = FOOD_BY_ID[order.foodId];
    const cmp = this.compareItems(order, out.main);
    // accuracy across every item on the tray
    let accSum = cmp.accuracy, accW = 1;
    const extras = [];
    if (order.side) { accW += 0.35; accSum += 0.35 * (out.side ? (out.side.season === order.side.season ? 1 : 0.6) : 0); if (!out.side) extras.push('Missing side: fries'); else if (out.side.season !== order.side.season) extras.push(`Fries seasoning: wanted ${order.side.season}`); }
    if (order.drink) { accW += 0.35; accSum += 0.35 * (out.drink ? (out.drink.id === order.drink ? 1 : 0.4) : 0); if (!out.drink) extras.push('Missing drink'); else if (out.drink.id !== order.drink) extras.push(`Drink: wanted ${DRINK_BY_ID[order.drink].name}`); }
    if (!order.side && out.side) { accW += 0.1; extras.push('Fries were not ordered'); }
    if (!order.drink && out.drink) { accW += 0.1; extras.push('Drink was not ordered'); }
    const accuracy = accSum / accW;
    const ck = this.cooking(cmp.foodOk ? out.main : null, order.side ? out.side : null);
    const cooking = cmp.foodOk ? ck.score : 0.3;
    const cookedItems = resolveLayers(food, order.sel).filter((id) => INGREDIENTS[id].cook).length;
    const par = 30 + cookedItems * 14 + (order.side ? 14 : 0) + (order.drink ? 8 : 0) + (food.id === 'pizza' ? 18 : 0);
    const speed = seconds <= par ? 1 : Math.max(0.3, 1 - ((seconds - par) / (par * 1.5)) * 0.7);
    const pr = this.presentation(out.main);
    let presentation = cmp.foodOk ? pr.score : 0.4;
    if (order.drink && out.drink) presentation = presentation * 0.75 + this.drinkScore(out.drink) * 0.25;
    let total = 0.4 * accuracy + 0.25 * cooking + 0.15 * speed + 0.2 * presentation;
    if (!cmp.foodOk) total *= 0.45;
    let stars = total >= 0.92 ? 5 : total >= 0.8 ? 4 : total >= 0.65 ? 3 : total >= 0.45 ? 2 : 1;
    // badly cooked or badly assembled food can't get a top rating
    if (cooking < 0.5 || accuracy < 0.7) stars = Math.min(stars, 3);
    else if (cooking < 0.8 || accuracy < 0.9) stars = Math.min(stars, 4);
    const value = food.price * 10 + (order.side ? SIDES.fries.price * 10 : 0) + (order.drink ? DRINK_PRICE * 10 : 0);
    const base = Math.round(value * total);
    const tip = stars === 5 ? 30 : stars === 4 ? 15 : 0;
    return {
      accuracy, cooking, cookingApplicable: ck.applicable, speed, presentation, total, stars, base, tip, earned: base + tip, seconds, par,
      xp: stars * 20 + 10, foodOk: cmp.foodOk, missing: cmp.missing, extra: cmp.extra, cookIssues: ck.issues, presIssues: cmp.foodOk ? pr.issues : [], extras,
      madeFoodId: out.main ? out.main.foodId : null,
    };
  },

  reaction(customer, order, r) {
    const food = FOOD_BY_ID[order.foodId];
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const fill = (s) => s.replace('{food}', food.name.toLowerCase());
    if (!r.foodOk) return { mood: 'angry', text: pick(DIALOGUE.wrongFood).replace('{food}', food.name.toLowerCase()).replace('{other}', r.madeFoodId ? FOOD_BY_ID[r.madeFoodId].name.toLowerCase() : 'nothing') };
    if (r.stars >= 5) return { mood: 'ecstatic', text: fill(pick(customer.lines.happy)) };
    if (r.missing.length) return { mood: 'sad', text: pick(DIALOGUE.missing).replace('{item}', r.missing[0].toLowerCase()) };
    if (r.extra.length) return { mood: 'sad', text: pick(DIALOGUE.extra).replace('{item}', r.extra[0].toLowerCase().replace(/ (cheese|sauce)$/, '')) };
    if (r.cookIssues.length) return { mood: 'sad', text: /UNDER|RAW|NOT FLIPPED/.test(r.cookIssues[0]) ? pick(DIALOGUE.undercooked) : pick(DIALOGUE.overcooked) };
    if (r.extras.length && /Missing/.test(r.extras[0])) return { mood: 'sad', text: pick(DIALOGUE.missingItem).replace('{item}', /drink/i.test(r.extras[0]) ? 'drink' : 'fries') };
    if (r.stars === 4) return { mood: 'happy', text: pick(DIALOGUE.good) };
    if (r.stars === 3) return { mood: 'neutral', text: pick(DIALOGUE.okay) };
    return { mood: 'sad', text: fill(pick(customer.lines.sad)) };
  },

  /* ---------- 3D printer synthesis plan ---------- */
  synthesisPlan(order, main, build, qcScore, insight) {
    const cmp = this.compareItems(order, main);
    const diffs = cmp.foodOk ? cmp.missing.length + cmp.extra.length : null;
    const carts = [];
    build.layers.forEach((l) => { if (carts[carts.length - 1] !== l.ing.cart) carts.push(l.ing.cart); });
    return {
      steps: [
        { text: 'Receiving recipe from the game...', result: `${build.layers.length} layers downloaded` },
        { text: 'Converting game food to real ingredients...', result: 'Recipe verified ✓' },
        { text: 'Optimizing synthesis sequence...', result: carts.map((k) => CARTRIDGES[k].label).join(' → ') },
        { text: 'Calibrating cartridges...', result: `${new Set(carts).size} cartridges ready` },
        { text: 'Checking allergies & food safety...', result: 'Safe to eat ✓' },
        { text: 'Beginning synthesis...', result: 'Printing layer by layer' },
      ],
      confidence: (95.5 + Math.random() * 4).toFixed(1),
      quality: Math.round(qcScore * 100),
    };
  },

  /* ---------- personalisation (learns only from this customer's own history) ---------- */
  insightFor(customerId, history) {
    const past = history.filter((h) => h.customerId === customerId);
    if (past.length < 2) return null;
    const counts = {};
    for (const h of past) for (const t of new Set(h.tags)) counts[t] = (counts[t] || 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2 && TAG_INFO[best[0]]) return { tag: best[0], visits: past.length, count: best[1], text: TAG_INFO[best[0]].text, rec: TAG_INFO[best[0]].rec };
    return null;
  },

  orderTags(food, sel) {
    const tags = [], avoided = [];
    for (const g of food.groups) {
      const chosen = g.type === 'single' ? [sel[g.id]] : sel[g.id];
      for (const o of g.options) {
        if (chosen.includes(o.id)) tags.push(...o.tags);
        else if (o.tags.includes('onion')) avoided.push('onion');
      }
    }
    return { tags: tags.filter((t) => t !== 'onion'), avoided };
  },
};
