/* =========================================================
   AI FOOD FACTORY — SIMULATED AI SYSTEM
   This is programmed logic that *demonstrates* what an AI
   system could do (order analysis, recipe/print planning,
   personalisation). It is not a real machine-learning model
   and needs no API key or internet connection.
   ========================================================= */
const AI = {
  /* ---------- order generation (customers decide what they want) ---------- */
  defaultSelection(food) {
    const sel = {};
    for (const g of food.groups) sel[g.id] = g.type === 'single' ? g.default : [...g.default];
    return sel;
  },

  generateOrder(customer, food, level) {
    const sel = this.defaultSelection(food);
    const changeChance = 0.25 + level * 0.08;
    for (const g of food.groups) {
      if (g.type === 'single') {
        if (Math.random() < changeChance) sel[g.id] = g.options[Math.floor(Math.random() * g.options.length)].id;
        // customers are consistent: always pick an option matching their favourite tag
        const liked = g.options.filter((o) => o.tags.some((t) => customer.prefs.includes(t)));
        if (liked.length) sel[g.id] = liked[Math.floor(Math.random() * liked.length)].id;
        const cur = g.options.find((o) => o.id === sel[g.id]);
        if (cur.tags.some((t) => customer.avoid.includes(t))) sel[g.id] = g.default;
      } else {
        let set = new Set(sel[g.id]);
        for (const o of g.options) if (Math.random() < changeChance * 0.8) set.has(o.id) ? set.delete(o.id) : set.add(o.id);
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

  // Readable checklist for the order ticket
  ticketLines(food, sel) {
    const lines = [];
    for (const g of food.groups) {
      if (g.type === 'single') {
        const o = g.options.find((x) => x.id === sel[g.id]);
        const none = o.layers.length === 0;
        lines.push({ ok: !none, text: none ? `No ${g.label}` : `${g.label}: ${o.label}` });
      } else {
        for (const o of g.options) {
          if (sel[g.id].includes(o.id)) lines.push({ ok: true, text: o.label });
          else if (g.default.includes(o.id)) lines.push({ ok: false, text: `No ${o.label}` });
        }
      }
    }
    return lines;
  },

  /* ---------- comparison & scoring ---------- */
  compare(order, made) {
    const food = FOOD_BY_ID[order.foodId];
    const details = { missing: [], extra: [], wrong: [] };
    if (made.foodId !== order.foodId) return { accuracy: 0, wrongFood: true, total: 1, correct: 0, details };
    let total = 0, correct = 0;
    for (const g of food.groups) {
      if (g.type === 'single') {
        total++;
        if (order.sel[g.id] === made.sel[g.id]) correct++;
        else {
          const want = g.options.find((o) => o.id === order.sel[g.id]);
          const got = g.options.find((o) => o.id === made.sel[g.id]);
          details.wrong.push({ group: g.label, want: want.label, got: got.label, wantTags: want.tags });
        }
      } else {
        for (const o of g.options) {
          total++;
          const w = order.sel[g.id].includes(o.id), m = made.sel[g.id].includes(o.id);
          if (w === m) correct++;
          else if (w) details.missing.push(o.label);
          else details.extra.push(o.label);
        }
      }
    }
    return { accuracy: correct / total, wrongFood: false, total, correct, details };
  },

  score(order, made, secondsTaken) {
    const cmp = this.compare(order, made);
    const food = FOOD_BY_ID[order.foodId];
    const speed = secondsTaken <= 20 ? 1 : secondsTaken >= 70 ? 0 : 1 - (secondsTaken - 20) / 50;
    const satisfaction = cmp.accuracy * 0.8 + speed * 0.2 * cmp.accuracy;
    let stars = Math.max(1, Math.min(5, Math.round(satisfaction * 5)));
    if (cmp.accuracy === 1) stars = Math.max(stars, 4);
    if (cmp.accuracy < 1) stars = Math.min(stars, 4);
    if (cmp.wrongFood) stars = 1;
    const base = Math.round(food.price * 10 * cmp.accuracy);
    const speedBonus = Math.round(food.price * 3 * speed * cmp.accuracy);
    const tip = stars >= 5 ? 25 : stars === 4 ? 10 : 0;
    return { ...cmp, speed, stars, base, speedBonus, tip, earned: base + speedBonus + tip, seconds: secondsTaken };
  },

  reaction(customer, order, result) {
    const food = FOOD_BY_ID[order.foodId];
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (result.wrongFood) {
      return { mood: 'angry', text: pick(DIALOGUE.wrongFood).replace('{food}', food.name.toLowerCase()).replace('{other}', FOOD_BY_ID[result.madeFoodId].name.toLowerCase()) };
    }
    if (result.stars >= 5) return { mood: 'ecstatic', text: customer.look.type === 'robot' ? 'BEEP BOOP! 10/10. MAXIMUM SATISFACTION.' : pick(DIALOGUE.perfect) };
    const d = result.details;
    const cheeseMiss = d.wrong.find((w) => w.wantTags.includes('extra-cheese'));
    if (cheeseMiss) return { mood: 'sad', text: pick(DIALOGUE.missingCheese) };
    if (result.stars === 4) return { mood: 'happy', text: pick(DIALOGUE.good) };
    if (d.missing.length) return { mood: 'sad', text: pick(DIALOGUE.missing).replace('{item}', d.missing[0].toLowerCase()) };
    if (d.extra.length) return { mood: 'sad', text: pick(DIALOGUE.extra).replace('{item}', d.extra[0].toLowerCase()) };
    if (d.wrong.length) return { mood: result.stars >= 3 ? 'neutral' : 'sad', text: `Hmm, I wanted ${d.wrong[0].want.toLowerCase()}, not ${d.wrong[0].got.toLowerCase()}.` };
    return { mood: result.stars >= 3 ? 'neutral' : 'sad', text: pick(result.stars >= 3 ? DIALOGUE.okay : DIALOGUE.bad) };
  },

  /* ---------- AI analysis for the printer cutscene ---------- */
  analyze(order, made, build) {
    const cmp = this.compare(order, made);
    const diffs = cmp.wrongFood ? null : cmp.details.missing.length + cmp.details.extra.length + cmp.details.wrong.length;
    const layerCount = build.layers.length;
    const carts = [...new Set(build.layers.map((l) => l.ing.cart))];
    return {
      steps: [
        { text: 'Analyzing customer order...', result: `${order.customerName}: ${order.name}` },
        { text: 'Identifying ingredients...', result: `${layerCount} layers detected` },
        { text: 'Optimizing food structure...', result: 'Stable stack ✓' },
        { text: 'Calculating printing sequence...', result: `${carts.length} cartridges` },
        {
          text: 'Checking customization...',
          result: cmp.wrongFood ? '⚠ Different food than ticket — human operator decision kept'
            : diffs === 0 ? 'Matches customer ticket ✓'
            : `⚠ ${diffs} difference${diffs > 1 ? 's' : ''} from ticket — human operator decision kept`,
          warn: cmp.wrongFood || diffs > 0,
        },
        { text: 'Generating food...', result: 'Recipe ready' },
      ],
      confidence: (96 + Math.random() * 3.5).toFixed(1),
      printSeconds: (layerCount * 0.6 + 1.2).toFixed(1),
    };
  },

  /* ---------- personalisation (learns only from this customer's own history) ---------- */
  insightFor(customerId, history) {
    const past = history.filter((h) => h.customerId === customerId);
    if (past.length < 2) return null;
    const counts = {};
    for (const h of past) for (const t of new Set(h.tags)) counts[t] = (counts[t] || 0) + 1;
    const avoids = {};
    for (const h of past) for (const t of h.avoided) avoids[t] = (avoids[t] || 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2 && TAG_INFO[best[0]]) {
      return { tag: best[0], visits: past.length, count: best[1], text: TAG_INFO[best[0]].text, rec: TAG_INFO[best[0]].rec };
    }
    return null;
  },

  // tags present in an order (used to learn preferences)
  orderTags(food, sel) {
    const tags = [];
    const avoided = [];
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
