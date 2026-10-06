/* =========================================================
   AI FOOD FACTORY — PROCEDURAL RENDERER
   Draws every food layer-by-layer on a 2D canvas using
   simple "extruded" shapes to fake 3D depth, plus the
   customer avatars. No image assets are needed.
   ========================================================= */

const PERSPECTIVE = 0.32; // how squashed circles are (camera looks slightly down)

/* ---------- colour + random helpers ---------- */
function hexToRgb(hex) {
  if (hex.startsWith('rgb')) return hex.match(/[\d.]+/g).slice(0, 3).map(Number);
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// f > 0 lightens towards white, f < 0 darkens towards black
function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  return `rgb(${Math.round((t - r) * p + r)},${Math.round((t - g) * p + g)},${Math.round((t - b) * p + b)})`;
}
function alpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const RAINBOW = ['#ff4d6d', '#ffd84a', '#4fd06a', '#3fa9ff', '#a66cff', '#ffffff', '#ff8a3d'];

/* ---------- path builders: each returns fn(ctx, y) that traces a closed outline at height y ---------- */
function pEllipse(rx, ry, cx = 0) {
  return (c, y) => { c.beginPath(); c.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); };
}
function pBlob(rx, ry, amp, freq, phase = 0, cx = 0) {
  return (c, y) => {
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      const k = 1 + amp * Math.sin(a * freq + phase);
      const x = cx + Math.cos(a) * rx * k;
      const yy = y + Math.sin(a) * ry * k;
      if (i) c.lineTo(x, yy); else c.moveTo(x, yy);
    }
    c.closePath();
  };
}
function pSuper(rx, ry, n = 4, cx = 0) {
  return (c, y) => {
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = cx + rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
      const yy = y + ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
      if (i) c.lineTo(x, yy); else c.moveTo(x, yy);
    }
    c.closePath();
  };
}
function pDiamond(rx, ry, cx = 0) {
  return (c, y) => {
    c.beginPath();
    c.moveTo(cx - rx, y); c.lineTo(cx, y - ry); c.lineTo(cx + rx, y); c.lineTo(cx, y + ry);
    c.closePath();
  };
}
function pCapsule(hw, hh) {
  return (c, y) => {
    c.beginPath();
    c.moveTo(-hw + hh, y - hh);
    c.lineTo(hw - hh, y - hh);
    c.arc(hw - hh, y, hh, -Math.PI / 2, Math.PI / 2);
    c.lineTo(-hw + hh, y + hh);
    c.arc(-hw + hh, y, hh, Math.PI / 2, (Math.PI * 3) / 2);
    c.closePath();
  };
}
function pRing(outer, innerRx, innerRy) {
  return (c, y) => {
    outer(c, y);
    c.moveTo(innerRx, y);
    c.ellipse(0, y, innerRx, innerRy, 0, 0, Math.PI * 2, true);
  };
}

function sideGrad(c, cx, w, color) {
  const g = c.createLinearGradient(cx - w, 0, cx + w, 0);
  g.addColorStop(0, shade(color, -0.5));
  g.addColorStop(0.3, shade(color, -0.12));
  g.addColorStop(0.62, shade(color, 0.1));
  g.addColorStop(1, shade(color, -0.55));
  return g;
}
function topGrad(c, cx, y, w, color, light = 0.28) {
  const g = c.createRadialGradient(cx - w * 0.3, y - w * 0.12, w * 0.05, cx, y, w * 1.1);
  g.addColorStop(0, shade(color, light));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.18));
  return g;
}
// Fake 3D: stack copies of an outline to make the side, then draw the top face.
function extrude(c, path, y, h, color, opts = {}) {
  const cx = opts.cx || 0, w = opts.w || 120;
  c.fillStyle = opts.side || sideGrad(c, cx, w, color);
  for (let k = 0; k < h; k += 1.5) { path(c, y - k); c.fill('nonzero'); }
  path(c, y - h);
  c.fillStyle = opts.top || topGrad(c, cx, y - h, w, color);
  c.fill('nonzero');
}
function dot(c, x, y, r, color) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
function oval(c, x, y, rx, ry, rot, color) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
function drips(c, list, color) {
  c.fillStyle = color;
  for (const [x, y0, len, w] of list) {
    const r = w / 2;
    c.beginPath();
    c.moveTo(x - r, y0);
    c.lineTo(x - r, y0 + len - r);
    c.arc(x, y0 + len - r, r, Math.PI, 0, true);
    c.lineTo(x + r, y0);
    c.closePath();
    c.fill();
  }
}
function dome(c, y, rx, ry, hh, color) {
  c.beginPath(); c.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = shade(color, -0.35); c.fill();
  c.beginPath();
  c.ellipse(0, y, rx, hh, 0, Math.PI, Math.PI * 2);
  c.ellipse(0, y, rx, ry, 0, 0, Math.PI);
  c.closePath();
  const g = c.createRadialGradient(-rx * 0.32, y - hh * 0.7, 6, 0, y - hh * 0.25, rx * 1.15);
  g.addColorStop(0, shade(color, 0.45));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.38));
  c.fillStyle = g;
  c.fill();
  oval(c, -rx * 0.33, y - hh * 0.66, rx * 0.28, hh * 0.15, -0.4, 'rgba(255,255,255,0.22)');
}
function grillMarks(c, path, y, color) {
  c.save(); path(c, y); c.clip();
  c.strokeStyle = alpha(shade(color, -0.6), 0.75); c.lineWidth = 6; c.lineCap = 'round';
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 34 - 34, y - 34); c.lineTo(i * 34 + 34, y + 34); c.stroke(); }
  c.restore();
}
function sprinkleRect(c, x, y, rot, color, w = 9, h = 3) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = color;
  c.beginPath();
  if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, h / 2); else c.rect(-w / 2, -h / 2, w, h);
  c.fill();
  c.restore();
}

/* =========================================================
   SHAPES. Each shape: h = height it adds to the stack,
   up/down = how far it draws above/below its base (for the
   layer-by-layer reveal), w = half width.
   draw(c, y, ing, L) draws at base height y.
   front(c, y, ing, L) (optional) draws after all layers so
   containers (taco shell, fry box, cone...) sit in front.
   ========================================================= */
const SHAPES = {
  bunBottom: { h: 24, up: 58, down: 34, w: 110,
    draw(c, y, ing) { extrude(c, pEllipse(104, 33), y, 24, ing.color, { w: 104, top: topGrad(c, 0, y - 24, 104, '#f5d39b', 0.2) }); } },

  bunTop: { h: 0, up: 78, down: 36, w: 110,
    draw(c, y, ing, L) {
      dome(c, y, 108, 34, 74, ing.color);
      if (!ing.seeds) return;
      const r = mulberry32(77);
      for (let i = 0; i < 18; i++) {
        const u = r() * 1.6 - 0.8, v = 0.3 + r() * 0.62;
        const x = u * 108 * 0.92, sy = y - 74 * Math.sqrt(1 - u * u) * v;
        oval(c, x, sy, 4.6, 2.3, u * 0.9, '#fff3d0');
      }
    } },

  patty: { h: 22, up: 62, down: 40, w: 116,
    draw(c, y, ing, L) {
      extrude(c, pBlob(112, 36, 0.03, 13, L.seed), y, 22, ing.color, { w: 112, top: topGrad(c, 0, y - 22, 112, shade(ing.color, 0.05), 0.15) });
      const r = mulberry32(L.seed);
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9;
        dot(c, Math.cos(a) * 104 * d, y - 22 + Math.sin(a) * 32 * d, 1.5 + r() * 2.5, r() > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,200,160,0.18)');
      }
      if (L.marks) grillMarks(c, pBlob(112, 36, 0.03, 13, L.seed), y - 22, ing.color);
    } },

  crispy: { h: 26, up: 72, down: 46, w: 128,
    draw(c, y, ing, L) {
      extrude(c, pBlob(122, 40, 0.07, 9, L.seed % 7), y, 26, ing.color, { w: 122 });
      const r = mulberry32(L.seed);
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.92;
        dot(c, Math.cos(a) * 112 * d, y - 26 + Math.sin(a) * 36 * d, 1.5 + r() * 2.5, r() > 0.5 ? shade(ing.color, 0.35) : shade(ing.color, -0.3));
      }
      if (L.marks && ing.cook === 'grill') grillMarks(c, pBlob(122, 40, 0.07, 9, L.seed % 7), y - 26, ing.color);
    } },

  grilled: { h: 18, up: 56, down: 38, w: 112,
    draw(c, y, ing) {
      const path = pBlob(110, 35, 0.025, 5);
      extrude(c, path, y, 18, ing.color, { w: 110 });
      c.save(); path(c, y - 18); c.clip();
      c.strokeStyle = shade(ing.color, -0.55); c.lineWidth = 7; c.lineCap = 'round';
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 34 - 30, y - 50); c.lineTo(i * 34 + 30, y + 10); c.stroke(); }
      c.restore();
    } },

  cheeseSlice: { h: 6, up: 48, down: 64, w: 126,
    draw(c, y, ing, L) {
      const rot = L.idx % 2 ? 0.18 : -0.05;
      c.save(); c.translate(0, y); c.scale(1, 1); c.rotate(rot * 0.3); c.translate(0, -y);
      const ye = (x) => y + 42 * (1 - Math.abs(x) / 122);
      drips(c, [[-78, ye(-78) - 4, 22, 13], [-28, ye(-28) - 4, 16, 11], [36, ye(36) - 4, 26, 13], [88, ye(88) - 4, 14, 10]], shade(ing.color, -0.1));
      extrude(c, pDiamond(122, 42), y, 6, ing.color, { w: 122 });
      const r = mulberry32(L.seed);
      if (ing.holes) for (let i = 0; i < 7; i++) oval(c, (r() - 0.5) * 140, y - 6 + (r() - 0.5) * 36, 7 + r() * 5, 3 + r() * 2, 0, shade(ing.color, -0.18));
      if (ing.specks) for (let i = 0; i < 26; i++) dot(c, (r() - 0.5) * 150, y - 6 + (r() - 0.5) * 40, 1.6, r() > 0.5 ? '#d33' : '#3a3');
      c.restore();
    } },

  lettuce: { h: 8, up: 56, down: 54, w: 132,
    draw(c, y, ing, L) {
      extrude(c, pBlob(126, 41, 0.09, 14, L.idx), y, 8, ing.color, { w: 126, side: shade(ing.color, -0.25) });
      c.strokeStyle = shade(ing.color, 0.35); c.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 26, y - 8); c.quadraticCurveTo(i * 34, y - 8 + (i % 2 ? 18 : -18), i * 44, y - 8 + (i % 2 ? 28 : -26)); c.stroke(); }
    } },

  slices: { h: 10, up: 34, down: 28, w: 112,
    draw(c, y, ing) {
      const spots = [[-58, -5], [58, -5], [0, 7]];
      for (const [x, dy] of spots) {
        extrude(c, pEllipse(48, 16, x), y + dy, 10, ing.color, { cx: x, w: 48 });
        oval(c, x, y + dy - 10, 40, 13, 0, ing.inner);
        c.strokeStyle = shade(ing.inner, -0.2); c.lineWidth = 2;
        for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y + dy - 10); c.lineTo(x + Math.cos(k * 2.1) * 36, y + dy - 10 + Math.sin(k * 2.1) * 11); c.stroke(); }
        for (let k = 0; k < 6; k++) oval(c, x + Math.cos(k + 0.5) * 22, y + dy - 10 + Math.sin(k + 0.5) * 7, 3, 1.6, k, ing.shape === 'slices' && ing.color === '#e8443a' ? '#ffe08a' : '#f4ffe0');
      }
    } },

  pickles: { h: 5, up: 20, down: 26, w: 110,
    draw(c, y, ing) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const x = Math.cos(a) * 66, yy = y + Math.sin(a) * 20;
        extrude(c, pEllipse(20, 7, x), yy, 4, ing.color, { cx: x, w: 20 });
        dot(c, x - 5, yy - 4, 1.8, shade(ing.color, 0.4)); dot(c, x + 6, yy - 5, 1.8, shade(ing.color, 0.4));
      }
    } },

  onion: { h: 4, up: 18, down: 22, w: 110,
    draw(c, y, ing) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 1.1;
        const x = Math.cos(a) * 58, yy = y + Math.sin(a) * 18 - 2;
        c.beginPath(); c.ellipse(x, yy, 22, 7, 0, 0, Math.PI * 2);
        c.strokeStyle = ing.color; c.lineWidth = 5; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.6; c.stroke();
      }
    } },

  sauce: { h: 3, up: 40, down: 56, w: 104,
    draw(c, y, ing) {
      drips(c, [[-60, y + 22, 18, 10], [-10, y + 28, 24, 11], [44, y + 24, 14, 9], [80, y + 14, 12, 8]], ing.color);
      extrude(c, pBlob(98, 31, 0.05, 7), y, 3, ing.color, { w: 98, side: shade(ing.color, -0.2) });
      oval(c, -30, y - 12, 34, 7, -0.1, 'rgba(255,255,255,0.35)');
    } },

  deli: { h: 9, up: 54, down: 48, w: 126,
    draw(c, y, ing, L) {
      extrude(c, pBlob(122, 39, 0.07, 6, 0), y, 4, ing.color, { w: 122 });
      extrude(c, pBlob(114, 36, 0.08, 7, 1.3), y - 4, 5, ing.color, { w: 114 });
      c.strokeStyle = shade(ing.color, 0.3); c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, y - 9, 30 + i * 20, 9 + i * 6, 0, 3.6, 5.6); c.stroke(); }
    } },

  bread: { h: 18, up: 68, down: 50, w: 124,
    draw(c, y, ing, L) {
      const path = pSuper(120, 46, 5);
      extrude(c, path, y, 18, ing.crust, { w: 120, top: topGrad(c, 0, y - 18, 120, ing.color, 0.15) });
      path(c, y - 18); c.strokeStyle = ing.crust; c.lineWidth = 7; c.stroke();
      const r = mulberry32(L.seed);
      for (let i = 0; i < 30; i++) dot(c, (r() - 0.5) * 190, y - 18 + (r() - 0.5) * 66, 1.5, shade(ing.color, -0.15));
    } },

  /* ---------- pizza ---------- */
  pizzaDough: { h: 10, up: 60, down: 50, w: 150,
    draw(c, y, ing) {
      extrude(c, pEllipse(148, 47), y, 10, ing.color, { w: 148 });
      c.beginPath(); c.ellipse(0, y - 10, 139, 43, 0, 0, Math.PI * 2);
      c.strokeStyle = shade(ing.color, -0.2); c.lineWidth = 14; c.stroke();
      c.strokeStyle = shade(ing.color, 0.25); c.lineWidth = 3; c.stroke();
    } },
  pizzaSauce: { h: 2, up: 46, down: 44, w: 130,
    draw(c, y, ing) { extrude(c, pBlob(126, 40, 0.02, 9), y, 2, ing.color, { w: 126 }); } },
  pizzaCheese: { h: 2, up: 46, down: 44, w: 128,
    draw(c, y, ing, L) {
      extrude(c, pBlob(122, 39, 0.045, 11, L.idx * 2), y, 2, ing.color, { w: 122 });
      const r = mulberry32(L.seed);
      for (let i = 0; i < 18; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.88;
        oval(c, Math.cos(a) * 112 * d, y - 2 + Math.sin(a) * 34 * d, 6 + r() * 6, 2.5 + r() * 2, 0, i < 5 ? 'rgba(190,120,40,0.35)' : 'rgba(255,255,255,0.45)');
      }
    } },
  scatter: { h: 1, up: 44, down: 42, w: 120,
    draw(c, y, ing, L) {
      const counts = { pepperoni: 9, mushroom: 8, pepper: 9, olive: 10, pineapple: 8, leaf: 7, flake: 70 };
      const r = mulberry32(hashStr(ing.item) + 3);
      const pts = [];
      for (let i = 0; i < counts[ing.item]; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.9;
        pts.push([Math.cos(a) * 104 * d, y + Math.sin(a) * 32 * d, r()]);
      }
      pts.sort((p, q) => p[1] - q[1]);
      for (const [x, yy, k] of pts) {
        switch (ing.item) {
          case 'pepperoni':
            extrude(c, pEllipse(15, 5.5, x), yy, 2.5, ing.color, { cx: x, w: 15 });
            dot(c, x - 4, yy - 3, 1.2, 'rgba(80,0,0,0.6)'); dot(c, x + 5, yy - 2, 1.2, 'rgba(80,0,0,0.6)');
            break;
          case 'mushroom':
            c.fillStyle = shade(ing.color, 0.2); c.fillRect(x - 3, yy - 6, 6, 7);
            c.beginPath(); c.ellipse(x, yy - 6, 10, 7, 0, Math.PI, Math.PI * 2); c.fillStyle = shade(ing.color, -0.15); c.fill();
            break;
          case 'pepper':
            c.beginPath(); c.arc(x, yy, 8, Math.PI * 0.15, Math.PI * 1.15); c.strokeStyle = ing.color; c.lineWidth = 4; c.stroke();
            break;
          case 'olive':
            c.beginPath(); c.ellipse(x, yy, 7, 3.6, 0, 0, Math.PI * 2); c.strokeStyle = ing.color; c.lineWidth = 3.5; c.stroke();
            break;
          case 'pineapple':
            c.beginPath(); c.moveTo(x - 9, yy + 3); c.lineTo(x + 9, yy + 3); c.lineTo(x + 2, yy - 6); c.closePath();
            c.fillStyle = ing.color; c.fill(); c.strokeStyle = shade(ing.color, -0.25); c.lineWidth = 1; c.stroke();
            break;
          case 'leaf':
            oval(c, x, yy - 1, 10, 4.5, k * 3, ing.color);
            break;
          case 'flake':
            c.fillStyle = ing.color; c.fillRect(x, yy - 1, 2.2, 2.2);
            break;
        }
      }
    } },

  /* ---------- tacos ---------- */
  tacoShell: { h: 92, up: 106, down: 6, w: 124,
    draw(c, y, ing) {
      c.beginPath(); c.ellipse(10, y - 100, 120, 92, 0, 0, Math.PI); c.closePath();
      c.fillStyle = shade(ing.color, -0.3); c.fill();
      oval(c, 4, y - 95, 116, 11, 0, 'rgba(70,40,15,0.75)');
      SHAPES.tacoShell.front(c, y, ing);
    },
    front(c, y, ing) {
      c.beginPath(); c.ellipse(0, y - 92, 120, 92, 0, 0, Math.PI); c.closePath();
      const g = c.createLinearGradient(0, y - 92, 0, y);
      g.addColorStop(0, shade(ing.color, 0.2)); g.addColorStop(1, shade(ing.color, -0.28));
      c.fillStyle = g; c.fill();
      const r = mulberry32(5);
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI, d = 0.2 + r() * 0.72;
        dot(c, Math.cos(a) * 112 * d, y - 92 + Math.sin(a) * 86 * d, ing.spots ? 4 + r() * 4 : 1.6, ing.spots ? 'rgba(160,100,40,0.35)' : 'rgba(150,90,20,0.45)');
      }
      c.beginPath(); c.moveTo(-118, y - 92); c.lineTo(118, y - 92);
      c.strokeStyle = shade(ing.color, 0.35); c.lineWidth = 4; c.stroke();
    } },
  tacoFill: { h: 9, up: 26, down: 14, w: 116,
    draw(c, y, ing, L) {
      const r = mulberry32(L.seed);
      const n = { meat: 17, beans: 28, shred: 46, cube: 24, dollop: 0 }[ing.item];
      for (let i = 0; i < n; i++) {
        const x = -104 + ((i + r() * 0.8) / n) * 208, yy = y - r() * 10;
        if (ing.item === 'meat') { dot(c, x, yy + 2, 12, shade(ing.color, -0.3)); dot(c, x, yy, 11, ing.color); dot(c, x - 3, yy - 4, 3, shade(ing.color, 0.3)); }
        if (ing.item === 'beans') oval(c, x, yy, 6, 4, r(), r() > 0.3 ? ing.color : '#5a3d3d');
        if (ing.item === 'shred') { c.strokeStyle = r() > 0.3 ? ing.color : shade(ing.color, 0.3); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); const a = -Math.PI / 2 + (r() - 0.5) * 2.2; c.moveTo(x, yy + 6); c.lineTo(x + Math.cos(a) * 15, yy + 6 + Math.sin(a) * 15); c.stroke(); }
        if (ing.item === 'cube') { c.save(); c.translate(x, yy); c.rotate(r()); c.fillStyle = r() > 0.4 ? ing.color : shade(ing.color, 0.25); c.fillRect(-5, -5, 10, 10); c.restore(); }
      }
      if (ing.item === 'dollop') {
        for (const [x, yy, rr] of [[-34, y + 2, 16], [30, y, 15], [0, y - 6, 22]]) {
          pBlob(rr, rr * 0.8, 0.08, 5, x, x)(c, yy);
          c.fillStyle = topGrad(c, x, yy, rr, ing.color, 0.3); c.fill();
          oval(c, x - rr * 0.3, yy - rr * 0.35, rr * 0.35, rr * 0.18, -0.3, 'rgba(255,255,255,0.45)');
        }
      }
    } },

  /* ---------- hot dog ---------- */
  hotdogBun: { h: 24, up: 68, down: 44, w: 160,
    draw(c, y, ing) {
      extrude(c, pCapsule(152, 42), y, 24, ing.color, { w: 152, top: topGrad(c, 0, y - 24, 152, shade(ing.color, 0.15), 0.2) });
      oval(c, 0, y - 24, 136, 19, 0, shade(ing.color, -0.28));
    } },
  sausage: { h: 8, up: 30, down: 30, w: 170,
    draw(c, y, ing) {
      extrude(c, pCapsule(166, 17), y + 10, 18, ing.color, { w: 166 });
      c.beginPath(); c.moveTo(-140, y - 14); c.lineTo(140, y - 14);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke();
    } },
  hdDots: { h: 2, up: 18, down: 18, w: 160,
    draw(c, y, ing, L) {
      const r = mulberry32(L.seed);
      const n = ing.big ? 12 : 30;
      for (let i = 0; i < n; i++) {
        const x = -140 + (i + r()) * (280 / n), yy = y + (r() - 0.5) * 22;
        if (ing.big) { c.beginPath(); c.ellipse(x, yy, 8, 4, 0, 0, Math.PI * 2); c.strokeStyle = ing.color; c.lineWidth = 3; c.stroke(); dot(c, x, yy, 2, '#f6f2c0'); }
        else { c.fillStyle = ing.color; c.fillRect(x - 3, yy - 3, 6, 6); }
      }
    } },
  zigzag: { h: 2, up: 18, down: 18, w: 160,
    draw(c, y, ing) {
      const flip = ing.phase ? -1 : 1;
      c.beginPath();
      for (let i = 0; i <= 16; i++) { const x = -140 + i * 17.5, yy = y + (i % 2 ? -9 : 9) * flip; if (i) c.lineTo(x, yy); else c.moveTo(x, yy); }
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = shade(ing.color, -0.25); c.lineWidth = 8; c.stroke();
      c.strokeStyle = ing.color; c.lineWidth = 6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.6; c.stroke();
    } },

  /* ---------- fries & nuggets ---------- */
  friesBox: { h: 0, up: 152, down: 8, w: 150,
    draw(c, y, ing) {
      c.beginPath(); c.moveTo(-82, y - 132); c.lineTo(82, y - 132); c.lineTo(62, y); c.lineTo(-62, y); c.closePath();
      c.fillStyle = shade(ing.color, -0.4); c.fill();
      oval(c, 0, y - 120, 76, 12, 0, 'rgba(40,0,0,0.5)');
      SHAPES.friesBox.front(c, y, ing);
    },
    front(c, y, ing) {
      c.beginPath(); c.moveTo(-82, y - 120); c.quadraticCurveTo(0, y - 90, 82, y - 120);
      c.lineTo(62, y + 2); c.quadraticCurveTo(0, y + 10, -62, y + 2); c.closePath();
      c.fillStyle = sideGrad(c, 0, 82, ing.color); c.fill();
      c.beginPath(); c.moveTo(-82, y - 120); c.quadraticCurveTo(0, y - 90, 82, y - 120);
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; c.stroke();
      dot(c, 0, y - 48, 22, '#ffd84a');
      c.fillStyle = '#c4161f'; c.font = 'bold 20px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('AI', 0, y - 47);
    } },
  fries: { h: 0, up: 216, down: -28, w: 150,
    draw(c, y, ing, L) {
      const r = mulberry32(31);
      const sticks = [];
      for (let i = 0; i < ing.count; i++) {
        const x = -64 + ((i + 0.5) / ing.count) * 128 + (r() - 0.5) * 8;
        sticks.push([x, y - 128 - r() * 46 - ing.len, (r() - 0.5) * 0.35, r()]);
      }
      sticks.sort((p, q) => p[3] - q[3]);
      c.lineCap = 'butt';
      for (const [x, top, lean] of sticks) {
        const bx = x - lean * 40, by = y - 30;
        c.beginPath(); c.moveTo(bx, by); c.lineTo(x, top);
        c.strokeStyle = shade(ing.color, -0.3); c.lineWidth = 13; c.stroke();
        c.strokeStyle = ing.color; c.lineWidth = 9; c.stroke();
        c.beginPath(); c.moveTo(bx - 2, by); c.lineTo(x - 2, top + 3);
        c.strokeStyle = shade(ing.color, 0.4); c.lineWidth = 2.5; c.stroke();
      }
    } },
  sprinkle: { h: 0, up: 216, down: -110, w: 150,
    draw(c, y, ing) {
      const r = mulberry32(9);
      for (let i = 0; i < 80; i++) dot(c, (r() - 0.5) * 140, y - 120 - r() * 80, 1.3 + r() * 1.2, ing.color === '#ffffff' ? (i % 3 ? '#ffffff' : '#d8d8d8') : ing.color);
    } },
  dipCup: { h: 0, up: 40, down: 76, w: 150,
    draw(c, y, ing, L, build) {
      const slots = build.food.dipSlots || [[110, 10]];
      const [sx, sy] = slots[L.idx % slots.length];
      extrude(c, pEllipse(27, 9, sx), y + sy, 18, '#f2f4f7', { cx: sx, w: 27, top: '#ffffff' });
      oval(c, sx, y + sy - 18, 22, 7, 0, ing.color);
      oval(c, sx - 7, y + sy - 20, 7, 2, 0, 'rgba(255,255,255,0.5)');
    } },
  nugTray: { h: 12, up: 58, down: 46, w: 136,
    draw(c, y, ing) {
      extrude(c, pSuper(132, 44, 4), y, 12, ing.color, { w: 132 });
      pSuper(118, 38, 4)(c, y - 12); c.fillStyle = '#fdf6e3'; c.fill();
    } },
  nuggets: { h: 0, up: 44, down: 40, w: 120,
    draw(c, y, ing) {
      const r = mulberry32(ing.count * 13);
      const pts = [];
      const cols = ing.count > 6 ? 4 : 3, rows = Math.ceil(ing.count / cols);
      for (let i = 0; i < ing.count; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * 52 + (row % 2 ? 14 : -6) + (r() - 0.5) * 8;
        const yy = y - 2 + (row - (rows - 1) / 2) * 20 + (r() - 0.5) * 4;
        pts.push([x, yy, r() * 6]);
      }
      pts.sort((p, q) => p[1] - q[1]);
      for (const [x, yy, ph] of pts) {
        extrude(c, pBlob(24, 15, 0.12, 5, ph, x), yy, 10, ing.color, { cx: x, w: 24 });
        dot(c, x - 6, yy - 13, 2, shade(ing.color, 0.35)); dot(c, x + 7, yy - 9, 1.8, shade(ing.color, -0.25));
      }
    } },

  /* ---------- donut ---------- */
  donutRing: { h: 36, up: 80, down: 44, w: 116,
    draw(c, y, ing) {
      extrude(c, pRing(pEllipse(112, 40), 38, 13), y, 36, ing.color, { w: 112 });
      const hg = c.createLinearGradient(0, y - 49, 0, y - 23);
      hg.addColorStop(0, shade(ing.color, -0.6)); hg.addColorStop(1, shade(ing.color, -0.25));
      oval(c, 0, y - 36, 38, 13, 0, hg);
    } },
  glaze: { h: 3, up: 44, down: 42, w: 110,
    draw(c, y, ing) {
      extrude(c, pRing(pBlob(104, 36, 0.05, 10), 46, 16), y, 3, ing.color, { w: 104 });
      c.beginPath(); c.ellipse(0, y - 3, 78, 25, 0, Math.PI * 1.08, Math.PI * 1.55);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
    } },
  donutSprinkles: { h: 0, up: 42, down: 40, w: 110,
    draw(c, y, ing) {
      const r = mulberry32(ing.chips ? 41 : 42);
      for (let i = 0; i < 48; i++) {
        const a = r() * Math.PI * 2, d = 0.5 + r() * 0.4;
        const x = Math.cos(a) * 104 * d, yy = y + Math.sin(a) * 36 * d;
        if (ing.chips) { c.beginPath(); c.moveTo(x - 4, yy + 3); c.lineTo(x + 4, yy + 3); c.lineTo(x, yy - 4); c.closePath(); c.fillStyle = '#3b2314'; c.fill(); }
        else sprinkleRect(c, x, yy, r() * 3, RAINBOW[i % RAINBOW.length]);
      }
    } },

  /* ---------- ice cream ---------- */
  cone: { h: 124, up: 142, down: 4, w: 70,
    draw(c, y, ing) {
      oval(c, 0, y - 124, 60, 15, 0, shade(ing.color, -0.2));
      oval(c, 0, y - 124, 52, 11, 0, shade(ing.color, -0.45));
      SHAPES.cone.front(c, y, ing);
    },
    front(c, y, ing) {
      c.save();
      c.beginPath(); c.moveTo(0, y + 2); c.lineTo(-60, y - 124); c.ellipse(0, y - 124, 60, 15, 0, Math.PI, 0, true); c.closePath();
      c.fillStyle = sideGrad(c, 0, 60, ing.color); c.fill(); c.clip();
      c.strokeStyle = shade(ing.color, -0.35); c.lineWidth = 2;
      for (let i = -8; i <= 8; i++) {
        c.beginPath(); c.moveTo(i * 16 - 70, y - 150); c.lineTo(i * 16 + 70, y + 10); c.stroke();
        c.beginPath(); c.moveTo(i * 16 + 70, y - 150); c.lineTo(i * 16 - 70, y + 10); c.stroke();
      }
      c.restore();
    } },
  iceCup: { h: 72, up: 90, down: 14, w: 70,
    draw(c, y, ing) {
      oval(c, 0, y - 72, 64, 15, 0, shade(ing.color, -0.25));
      oval(c, 0, y - 72, 57, 11, 0, '#e8f6ff');
      SHAPES.iceCup.front(c, y, ing);
    },
    front(c, y, ing) {
      c.save();
      c.beginPath(); c.moveTo(-64, y - 72); c.ellipse(0, y - 72, 64, 15, 0, Math.PI, 0, true); c.lineTo(42, y); c.ellipse(0, y, 42, 10, 0, 0, Math.PI); c.closePath();
      c.fillStyle = sideGrad(c, 0, 64, ing.color); c.fill(); c.clip();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 20 - 5, y - 75); c.lineTo(i * 20 + 5, y - 75); c.lineTo(i * 13 + 3, y + 12); c.lineTo(i * 13 - 3, y + 12); c.closePath(); c.fill(); }
      c.restore();
    } },
  scoop: { h: 60, up: 100, down: 2, w: 66,
    draw(c, y, ing, L) {
      const rr = L.idx === 0 ? 58 : 52, cy = y - 36;
      for (let i = 0; i < 9; i++) { const a = Math.PI * (0.12 + (i / 8) * 0.76); dot(c, Math.cos(a) * (rr - 6), cy + Math.sin(a) * (rr - 6), 12, shade(ing.color, -0.12)); }
      c.beginPath(); c.arc(0, cy, rr, 0, Math.PI * 2);
      const g = c.createRadialGradient(-rr * 0.35, cy - rr * 0.4, 4, 0, cy, rr * 1.1);
      g.addColorStop(0, shade(ing.color, 0.5)); g.addColorStop(0.5, ing.color); g.addColorStop(1, shade(ing.color, -0.28));
      c.fillStyle = g; c.fill();
      if (ing.chips) { const r = mulberry32(L.seed); for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85; dot(c, Math.cos(a) * rr * d, cy + Math.sin(a) * rr * d, 2.4, '#3b2314'); } }
      oval(c, -rr * 0.35, cy - rr * 0.45, rr * 0.28, rr * 0.14, -0.5, 'rgba(255,255,255,0.4)');
    } },
  scoopSyrup: { h: 0, up: 48, down: 14, w: 66,
    draw(c, y, ing) {
      const cy = y + 24, rr = 58;
      c.save(); c.beginPath(); c.arc(0, cy, rr + 1, 0, Math.PI * 2); c.clip();
      c.fillStyle = ing.color; c.fillRect(-rr, cy - rr - 2, rr * 2, rr * 0.6);
      drips(c, [[-40, cy - rr * 0.5, 30, 12], [-14, cy - rr * 0.45, 42, 13], [12, cy - rr * 0.45, 26, 12], [38, cy - rr * 0.5, 36, 12]], ing.color);
      oval(c, -18, cy - rr + 9, 18, 4, -0.2, 'rgba(255,255,255,0.35)');
      c.restore();
    } },
  whipped: { h: 30, up: 60, down: 10, w: 50,
    draw(c, y, ing) {
      const tiers = [[44, y + 2, 9], [33, y - 10, 9], [22, y - 21, 8], [9, y - 30, 6]];
      for (const [rx, yy, hh] of tiers) extrude(c, pBlob(rx, rx * 0.34, 0.1, 8), yy, hh, '#f4f4f4', { w: rx, top: topGrad(c, 0, yy - hh, rx, '#ffffff', 0) });
    } },
  scoopSprinkles: { h: 0, up: 38, down: 10, w: 60,
    draw(c, y) {
      const r = mulberry32(55);
      for (let i = 0; i < 34; i++) {
        const a = Math.PI + r() * Math.PI, d = Math.sqrt(r()) * 0.85;
        sprinkleRect(c, Math.cos(a) * 50 * d, y + 28 + Math.sin(a) * 50 * d, r() * 3, RAINBOW[i % RAINBOW.length], 8, 3);
      }
    } },
  cherry: { h: 0, up: 46, down: 4, w: 30,
    draw(c, y, ing) {
      c.beginPath(); c.moveTo(0, y - 20); c.quadraticCurveTo(4, y - 38, 14, y - 44);
      c.strokeStyle = '#4b6b1e'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.arc(0, y - 10, 13, 0, Math.PI * 2);
      const g = c.createRadialGradient(-4, y - 15, 2, 0, y - 10, 14);
      g.addColorStop(0, '#ff6b7f'); g.addColorStop(1, ing.color);
      c.fillStyle = g; c.fill();
      oval(c, -4, y - 15, 4, 2.4, -0.5, 'rgba(255,255,255,0.7)');
    } },

  /* ---------- pancakes ---------- */
  plate: { h: 6, up: 56, down: 52, w: 156,
    draw(c, y) {
      extrude(c, pEllipse(152, 49), y, 6, '#dfe7f0', { w: 152, top: '#ffffff' });
      c.beginPath(); c.ellipse(0, y - 6, 120, 38, 0, 0, Math.PI * 2); c.strokeStyle = 'rgba(120,150,190,0.3)'; c.lineWidth = 2; c.stroke();
    } },
  pancake: { h: 16, up: 54, down: 40, w: 118,
    draw(c, y, ing, L) {
      extrude(c, pBlob(114, 37, 0.018, 7, L.idx * 1.7), y, 16, shade(ing.color, -0.08), { w: 114, top: topGrad(c, 0, y - 16, 114, shade(ing.color, 0.08), 0.25) });
      c.beginPath(); c.ellipse(0, y - 16, 96, 30, 0, 0, Math.PI * 2); c.strokeStyle = 'rgba(150,80,20,0.25)'; c.lineWidth = 3; c.stroke();
    } },
  butter: { h: 0, up: 30, down: 10, w: 30,
    draw(c, y, ing) { extrude(c, pDiamond(24, 9), y - 2, 12, ing.color, { w: 24 }); } },
  syrupTop: { h: 0, up: 34, down: 74, w: 118,
    draw(c, y, ing) {
      drips(c, [[-80, y + 4, 40, 13], [-34, y + 14, 56, 14], [22, y + 16, 34, 13], [70, y + 8, 50, 12]], ing.color);
      pBlob(86, 28, 0.1, 6)(c, y);
      c.fillStyle = ing.color; c.fill();
      oval(c, -26, y - 8, 30, 6, -0.1, 'rgba(255,255,255,0.35)');
    } },
  fruit: { h: 0, up: 30, down: 28, w: 100,
    draw(c, y, ing) {
      const r = mulberry32(hashStr(ing.item));
      const n = { straw: 6, blue: 12, banana: 7 }[ing.item];
      const pts = [];
      for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85; pts.push([Math.cos(a) * 72 * d, y + Math.sin(a) * 22 * d]); }
      pts.sort((p, q) => p[1] - q[1]);
      for (const [x, yy] of pts) {
        if (ing.item === 'straw') {
          c.beginPath(); c.moveTo(x - 11, yy - 8); c.quadraticCurveTo(x, yy - 16, x + 11, yy - 8); c.quadraticCurveTo(x + 8, yy + 6, x, yy + 9); c.quadraticCurveTo(x - 8, yy + 6, x - 11, yy - 8);
          c.fillStyle = ing.color; c.fill();
          for (let k = 0; k < 5; k++) dot(c, x - 5 + (k % 3) * 5, yy - 5 + Math.floor(k / 3) * 6, 1, '#ffe08a');
          c.fillStyle = '#3f9a2a'; c.fillRect(x - 5, yy - 15, 10, 4);
        } else if (ing.item === 'blue') {
          c.beginPath(); c.arc(x, yy, 7, 0, Math.PI * 2);
          const g = c.createRadialGradient(x - 2, yy - 3, 1, x, yy, 8); g.addColorStop(0, '#7f8ff0'); g.addColorStop(1, ing.color);
          c.fillStyle = g; c.fill();
        } else {
          extrude(c, pEllipse(13, 5, x), yy, 3, ing.color, { cx: x, w: 13 });
          dot(c, x, yy - 3, 2, '#c8b060');
        }
      }
    } },

  /* ---------- cupcake ---------- */
  liner: { h: 64, up: 82, down: 14, w: 70,
    draw(c, y, ing) {
      oval(c, 0, y - 64, 62, 18, 0, shade(ing.color, -0.35));
      SHAPES.liner.front(c, y, ing);
    },
    front(c, y, ing) {
      c.save();
      c.beginPath(); c.moveTo(-62, y - 64); c.ellipse(0, y - 64, 62, 18, 0, Math.PI, 0, true); c.lineTo(46, y); c.ellipse(0, y, 46, 12, 0, 0, Math.PI); c.closePath();
      c.fillStyle = sideGrad(c, 0, 62, ing.color); c.fill(); c.clip();
      c.strokeStyle = shade(ing.color, -0.3); c.lineWidth = 2;
      for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(i * 10.5, y - 50); c.lineTo(i * 8, y + 14); c.stroke(); }
      c.restore();
    } },
  cakeTop: { h: 26, up: 48, down: 20, w: 70,
    draw(c, y, ing) { dome(c, y, 66, 18, 44, ing.color); } },
  frosting: { h: 58, up: 72, down: 26, w: 76,
    draw(c, y, ing) {
      const tiers = [[72, y + 6, 14], [56, y - 10, 13], [40, y - 25, 12], [24, y - 38, 10], [9, y - 50, 8]];
      for (const [rx, yy, hh] of tiers) extrude(c, pBlob(rx, rx * 0.32, 0.08, 10), yy, hh, ing.color, { w: rx, top: topGrad(c, 0, yy - hh, rx, ing.color, 0.35) });
    } },
  cupSprinkles: { h: 0, up: 6, down: 60, w: 70,
    draw(c, y) {
      const r = mulberry32(61);
      for (let i = 0; i < 40; i++) {
        const d = r() * 58, half = 6 + d * 1.05;
        sprinkleRect(c, (r() * 2 - 1) * half * 0.9, y + d, r() * 3, RAINBOW[i % RAINBOW.length], 8, 3);
      }
    } },
};

/* =========================================================
   FOOD BUILDING
   ========================================================= */

// Turn the player's selection into the ordered list of ingredient IDs to print.
function resolveLayers(food, sel) {
  const out = [];
  for (const step of food.printing) {
    if (typeof step === 'string') { out.push(step); continue; }
    const g = food.groups.find((gr) => gr.id === step.group);
    const chosen = g.type === 'single' ? g.options.filter((o) => o.id === sel[g.id]) : g.options.filter((o) => sel[g.id].includes(o.id));
    for (const o of chosen) out.push(...(step.key ? o[step.key] || [] : o.layers));
  }
  return out;
}

// Colour of an ingredient after cooking (d: 0 raw, 1 perfect, >1 overcooked)
function lerpColor(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  t = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function cookedColor(ing, d) {
  if (!ing.colors || d == null) return ing.color;
  const [raw, perfect, burnt] = ing.colors;
  return d <= 1 ? lerpColor(raw, perfect, Math.pow(d, 0.8)) : lerpColor(perfect, burnt, (d - 1) / 0.5);
}

// Position each layer in the stack. items: [{ id, cook?, marks? }] in the order they were added.
// Returns a "build" object that every station, the printer and the plates can draw.
function buildFromItems(food, items) {
  let cursor = 0;
  const counts = {};
  const layers = items.map((item, i) => {
    const base = INGREDIENTS[item.id];
    const ing = item.cook != null ? { ...base, color: cookedColor(base, item.cook) } : base;
    const shape = SHAPES[ing.shape];
    counts[ing.shape] = (counts[ing.shape] ?? -1) + 1;
    const L = { id: item.id, ing, shape, y: cursor, idx: counts[ing.shape], seed: hashStr(item.id) + i * 97, top: cursor - shape.up, bottom: cursor + shape.down, marks: item.marks ?? (item.cook > 0.55) };
    cursor -= shape.h;
    return L;
  });
  if (!layers.length) return { food, items, layers, top: -40, bottom: 40, halfW: 120 };
  const top = Math.min(...layers.map((l) => l.top));
  const bottom = Math.max(...layers.map((l) => l.bottom));
  const halfW = Math.max(...layers.map((l) => l.shape.w || 120));
  return { food, items, layers, top, bottom, halfW };
}
function buildFood(food, sel) {
  return buildFromItems(food, resolveLayers(food, sel).map((id) => ({ id })));
}

// Side order of fries (cooked in the fryer, seasoned at the fry station)
const SIDE_FRIES_FOOD = { id: 'fries', name: 'Fries', dipSlots: [[118, 8]] };
function buildSideFries(side) {
  const items = [{ id: 'friesBox' }, { id: 'friesReg', cook: side.cook }];
  const s = SIDES.fries.seasons.find((x) => x.id === side.season);
  if (s && s.ing) items.push({ id: s.ing });
  return buildFromItems(SIDE_FRIES_FOOD, items);
}

function drawLayer(c, L, build, p, which) {
  const fn = L.shape[which];
  if (!fn) return;
  if (L.offsetY) { c.save(); c.translate(0, L.offsetY); c.globalAlpha *= Math.max(0, 1 + L.offsetY / 200); fn(c, L.y, L.ing, L, build); c.restore(); return; }
  if (p >= 1) { fn(c, L.y, L.ing, L, build); return; }
  c.save();
  const cut = L.bottom - (L.bottom - L.top) * p;
  c.beginPath(); c.rect(-600, cut, 1200, 1200); c.clip();
  fn(c, L.y, L.ing, L, build);
  c.restore();
}

// reveal: optional array of 0..1 per layer (how much of each layer is printed)
function drawFood(c, build, x, y, s, reveal, shadow = true) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (shadow && build.layers.length && (!reveal || reveal[0] > 0)) {
    const sw = build.halfW * 1.05, sy = Math.max(10, build.bottom - 6);
    const g = c.createRadialGradient(0, sy, 4, 0, sy, sw);
    g.addColorStop(0, 'rgba(10,25,45,0.32)'); g.addColorStop(1, 'rgba(10,25,45,0)');
    c.save(); c.scale(1, 0.3); c.fillStyle = g; c.beginPath(); c.arc(0, sy / 0.3, sw, 0, Math.PI * 2); c.fill(); c.restore();
  }
  build.layers.forEach((L, i) => { const p = reveal ? reveal[i] : 1; if (p > 0) drawLayer(c, L, build, p, 'draw'); });
  build.layers.forEach((L, i) => { const p = reveal ? reveal[i] : 1; if (p > 0) drawLayer(c, L, build, p, 'front'); });
  c.restore();
}

// Scale so the food fits inside a box of the given size.
function fitScale(build, maxW, maxH) {
  return Math.min(1, maxW / (build.halfW * 2), maxH / (build.bottom - build.top));
}

// Render a food centred in a canvas (used for the serving plate and result screen).
function renderFoodToCanvas(canvas, build, clear = true) {
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  if (clear) c.clearRect(0, 0, W, H);
  if (!build.layers.length) return;
  const s = fitScale(build, W * 0.9, H * 0.86);
  const cy = H / 2 - ((build.top + build.bottom) / 2) * s;
  drawFood(c, build, W / 2, cy, s);
}

/* ---------- drink cup ---------- */
function drawDrink(c, x, y, s, drink, fill, opts = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const H = 150, top = 52, bot = 38;
  oval(c, 0, 4, 48, 12, 0, 'rgba(10,25,45,0.25)');
  // cup body
  const body = () => { c.beginPath(); c.moveTo(-top, -H); c.lineTo(top, -H); c.lineTo(bot, 0); c.ellipse(0, 0, bot, 10, 0, 0, Math.PI); c.closePath(); };
  body(); c.fillStyle = 'rgba(230,245,255,0.55)'; c.fill();
  if (drink && fill > 0) {
    c.save(); body(); c.clip();
    const ly = -H * Math.min(1, fill);
    const g = c.createLinearGradient(-top, 0, top, 0);
    g.addColorStop(0, shade(drink.color, -0.3)); g.addColorStop(0.4, shade(drink.color, 0.15)); g.addColorStop(1, shade(drink.color, -0.35));
    c.fillStyle = g; c.fillRect(-top, ly, top * 2, H + 20);
    const lw = bot + (top - bot) * Math.min(1, fill);
    oval(c, 0, ly, lw, 8, 0, shade(drink.color, 0.25));
    for (let i = 0; i < 9; i++) dot(c, ((i * 37) % 60) - 30, ly + 14 + ((i * 53 + (opts.t || 0) * 60) % Math.max(10, H * fill - 18)), 2, 'rgba(255,255,255,0.55)');
    c.restore();
  }
  // fill line
  if (opts.line) { const ly = -H * DRINK_TARGET; c.setLineDash([6, 5]); c.strokeStyle = '#ff4d8d'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-top + 4, ly); c.lineTo(top - 4, ly); c.stroke(); c.setLineDash([]); }
  body(); c.strokeStyle = 'rgba(120,160,200,0.8)'; c.lineWidth = 2.5; c.stroke();
  // sleeve with logo
  c.save(); body(); c.clip();
  c.fillStyle = '#ffffff'; c.fillRect(-top, -H * 0.62, top * 2, 44);
  c.fillStyle = '#19d3f0'; c.fillRect(-top, -H * 0.62, top * 2, 5); c.fillRect(-top, -H * 0.62 + 39, top * 2, 5);
  c.fillStyle = '#12304a'; c.font = '800 15px Orbitron, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(drink ? drink.label : 'AI FOOD', 0, -H * 0.62 + 22);
  c.restore();
  oval(c, -top * 0.45, -H * 0.5, 6, 40, 0.1, 'rgba(255,255,255,0.35)');
  if (opts.lid) {
    extrude(c, pEllipse(top + 4, 13), -H + 2, 8, '#e8eef5', { w: top, top: '#f6f9fc' });
    c.strokeStyle = '#ff4d8d'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(8, -H - 8); c.lineTo(22, -H - 70); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, -H - 10); c.lineTo(19, -H - 68); c.stroke();
  }
  c.restore();
}

/* ---------- ingredient icons for station bins (cached as images) ---------- */
const ICON_CACHE = {};
function ingredientIcon(id, cook) {
  const key = id + (cook != null ? '@' + cook.toFixed(2) : '');
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 120;
  const food = { id: 'icon', dipSlots: [[0, -10]] };
  const b = buildFromItems(food, [{ id, cook }]);
  const zoom = { scatter: 2.2, hdDots: 1.8, zigzag: 1.6, tacoFill: 1.9, sprinkle: 1.6, donutSprinkles: 1.5, scoopSprinkles: 1.8, cupSprinkles: 1.8, fruit: 2, pickles: 1.5, onion: 1.5, butter: 2.2, cherry: 1.8, dipCup: 2.4 }[INGREDIENTS[id].shape];
  if (zoom) {
    const c = cv.getContext('2d');
    const s = (cv.width * 0.9 * zoom) / (b.halfW * 2);
    const cy = cv.height / 2 - ((b.top + b.bottom) / 2) * s;
    c.save(); c.beginPath(); c.roundRect(6, 6, cv.width - 12, cv.height - 12, 16); c.clip();
    drawFood(c, b, cv.width / 2, cy, s, null, false);
    c.restore();
  } else renderFoodToCanvas(cv, b);
  return (ICON_CACHE[key] = cv.toDataURL());
}

/* =========================================================
   CUSTOMER AVATARS (original simple characters)
   mood: neutral | happy | ecstatic | sad | angry | wow
   ========================================================= */
function drawCustomer(c, look, mood, t, opts = {}) {
  c.clearRect(0, 0, 260, 420);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const blink = t % 3.7 < 0.13;
  const breathe = Math.sin(t * 2.1) * 2;
  if (look.type === 'robot') return drawRobot(c, look, mood, t, blink, breathe);

  const hx = 130, hy = 150 + breathe * 0.6, hr = 60;
  const happy = mood === 'happy' || mood === 'ecstatic';
  const tilt = happy ? Math.sin(t * 6) * 0.05 : Math.sin(t * 0.9) * 0.025;

  // back hair
  c.save(); c.translate(hx, hy); c.rotate(tilt); c.translate(-hx, -hy);
  c.fillStyle = look.hair;
  if (look.hairStyle === 'long') { c.beginPath(); c.roundRect(hx - 70, hy - 50, 140, 175, 50); c.fill(); }
  if (look.hairStyle === 'puffs') { dot(c, hx - 64, hy - 48, 34, look.hair); dot(c, hx + 64, hy - 48, 34, look.hair); }
  if (look.hairStyle === 'bun') dot(c, hx, hy - 72, 28, look.hair);
  c.restore();

  // body + clothing pattern
  drawTorso(c, look, hx, breathe);
  // arms resting towards the counter
  for (const sgn of opts.raiseRight ? [-1] : [-1, 1]) {
    c.strokeStyle = shade(look.shirt, -0.12); c.lineWidth = 30;
    c.beginPath(); c.moveTo(hx + sgn * 80, 280 + breathe); c.quadraticCurveTo(hx + sgn * 104, 330, hx + sgn * 70, 372); c.stroke();
    dot(c, hx + sgn * 66, 374, 17, shade(look.skin, -0.04));
    dot(c, hx + sgn * 62, 370, 6, shade(look.skin, 0.12));
  }
  // neck
  c.fillStyle = shade(look.skin, -0.18); c.fillRect(hx - 18, 196 + breathe * 0.6, 36, 60);

  c.save(); c.translate(hx, hy); c.rotate(tilt); c.translate(-hx, -hy);
  // ears + head with shading
  dot(c, hx - hr + 2, hy + 6, 13, shade(look.skin, -0.08));
  dot(c, hx + hr - 2, hy + 6, 13, shade(look.skin, -0.08));
  c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI * 2);
  const g = c.createRadialGradient(hx - 22, hy - 26, 6, hx, hy, hr * 1.1);
  g.addColorStop(0, shade(look.skin, 0.2)); g.addColorStop(0.7, look.skin); g.addColorStop(1, shade(look.skin, -0.16));
  c.fillStyle = g; c.fill();
  if (look.acc === 'beard') {
    c.fillStyle = look.hair; c.beginPath();
    c.moveTo(hx - hr + 4, hy + 4); c.quadraticCurveTo(hx - hr + 8, hy + hr + 6, hx, hy + hr + 6); c.quadraticCurveTo(hx + hr - 8, hy + hr + 6, hx + hr - 4, hy + 4);
    c.quadraticCurveTo(hx + 30, hy + 30, hx, hy + 22); c.quadraticCurveTo(hx - 30, hy + 30, hx - hr + 4, hy + 4); c.fill();
  }

  // front hair
  c.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 'short': case 'long': case 'puffs': case 'bun':
      c.beginPath(); c.ellipse(hx, hy - 30, hr + 4, 40, 0, Math.PI, Math.PI * 2); c.quadraticCurveTo(hx + 20, hy - 30, hx - hr - 4, hy - 30); c.fill();
      break;
    case 'spiky':
      c.beginPath(); c.moveTo(hx - hr - 4, hy - 20);
      for (let i = 0; i <= 7; i++) { const x = hx - hr + (i * (hr * 2)) / 7; c.lineTo(x - 8, hy - 58 - (i % 2 ? 22 : 8)); c.lineTo(x + 2, hy - 40); }
      c.lineTo(hx + hr + 4, hy - 20); c.quadraticCurveTo(hx, hy - 50, hx - hr - 4, hy - 20); c.fill();
      break;
    case 'curly':
      for (let i = 0; i < 11; i++) { const a = Math.PI + (i / 10) * Math.PI; dot(c, hx + Math.cos(a) * (hr - 2), hy - 10 + Math.sin(a) * (hr - 4), 17, look.hair); }
      break;
  }
  // hair highlight
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 5;
  c.beginPath(); c.arc(hx - 8, hy - 30, hr - 14, Math.PI * 1.15, Math.PI * 1.45); c.stroke();

  // face
  const eyeY = hy + 2;
  const brow = { angry: 0.35, sad: -0.3, wow: -0.15 }[mood] || 0;
  c.strokeStyle = shade(look.hair, -0.1); c.lineWidth = 5;
  c.beginPath(); c.moveTo(hx - 34, eyeY - 22 - brow * 10); c.lineTo(hx - 12, eyeY - 22 + brow * 10); c.stroke();
  c.beginPath(); c.moveTo(hx + 34, eyeY - 22 - brow * 10); c.lineTo(hx + 12, eyeY - 22 + brow * 10); c.stroke();
  if (blink || mood === 'ecstatic') {
    c.strokeStyle = '#2b2b2b'; c.lineWidth = 4;
    for (const sgn of [-1, 1]) { c.beginPath(); c.arc(hx + sgn * 22, eyeY + (mood === 'ecstatic' ? 4 : 0), 8, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  } else {
    const look2 = Math.sin(t * 0.7) * 2;
    for (const sgn of [-1, 1]) {
      oval(c, hx + sgn * 22, eyeY, 10, mood === 'wow' ? 13 : 11, 0, '#ffffff');
      dot(c, hx + sgn * 22 + 1 + look2, eyeY + 1, 6, '#2b2b2b');
      dot(c, hx + sgn * 22 + 3 + look2, eyeY - 2, 2, '#ffffff');
    }
  }
  c.beginPath(); c.moveTo(hx - 2, eyeY + 8); c.quadraticCurveTo(hx + 6, eyeY + 18, hx - 2, eyeY + 20);
  c.strokeStyle = shade(look.skin, -0.25); c.lineWidth = 3; c.stroke();
  dot(c, hx - 36, hy + 24, 9, 'rgba(255,110,120,0.22)');
  dot(c, hx + 36, hy + 24, 9, 'rgba(255,110,120,0.22)');
  drawMouth(c, hx, hy + 34, mood, '#5a2222');

  // accessories
  if (look.acc === 'glasses') {
    c.strokeStyle = '#222'; c.lineWidth = 3.5;
    c.fillStyle = 'rgba(180,230,255,0.18)';
    for (const sgn of [-1, 1]) { c.beginPath(); c.roundRect(hx + sgn * 22 - 15, eyeY - 12, 30, 24, 8); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(hx - 7, eyeY); c.lineTo(hx + 7, eyeY); c.stroke();
  }
  if (look.acc === 'cap') {
    c.fillStyle = look.accColor;
    c.beginPath(); c.ellipse(hx, hy - 38, hr + 2, 36, 0, Math.PI, Math.PI * 2); c.closePath(); c.fill();
    c.fillStyle = shade(look.accColor, -0.25);
    c.beginPath(); c.ellipse(hx + 34, hy - 38, 52, 10, 0.05, 0, Math.PI * 2); c.fill();
    dot(c, hx, hy - 72, 5, shade(look.accColor, -0.3));
    c.fillStyle = '#fff'; c.font = '900 16px Arial'; c.textAlign = 'center'; c.fillText('AI', hx - 6, hy - 48);
  }
  if (look.acc === 'headphones') {
    c.strokeStyle = '#333'; c.lineWidth = 9;
    c.beginPath(); c.arc(hx, hy - 4, hr + 6, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.fillStyle = look.accColor || '#fff';
    for (const sgn of [-1, 1]) { c.beginPath(); c.roundRect(hx + sgn * (hr + 2) - 12, hy - 16, 24, 40, 10); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 3; c.stroke(); }
  }
  c.restore();
}

function drawTorso(c, look, hx, breathe) {
  const y0 = 250 + breathe;
  c.save();
  c.beginPath(); c.roundRect(hx - 92, y0, 184, 220, 60);
  const g = c.createLinearGradient(hx - 92, 0, hx + 92, 0);
  g.addColorStop(0, shade(look.shirt, -0.18)); g.addColorStop(0.45, shade(look.shirt, 0.08)); g.addColorStop(1, shade(look.shirt, -0.22));
  c.fillStyle = g; c.fill(); c.clip();
  const dark = shade(look.shirt, -0.28), light = shade(look.shirt, 0.35);
  switch (look.pattern) {
    case 'hoodie':
      c.fillStyle = dark; c.beginPath(); c.ellipse(hx, y0 + 4, 64, 26, 0, 0, Math.PI); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(hx - 14, y0 + 20); c.lineTo(hx - 16, y0 + 70); c.moveTo(hx + 14, y0 + 20); c.lineTo(hx + 16, y0 + 70); c.stroke();
      c.fillStyle = dark; c.beginPath(); c.roundRect(hx - 50, y0 + 110, 100, 50, 14); c.fill();
      break;
    case 'stripes':
      c.fillStyle = light; for (let i = 0; i < 6; i++) c.fillRect(hx - 92, y0 + 30 + i * 30, 184, 12);
      break;
    case 'stars':
      for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.font = '18px Arial'; c.fillText('★', hx - 80 + (i % 3) * 60 + (Math.floor(i / 3) % 2) * 25, y0 + 50 + Math.floor(i / 3) * 50); }
      break;
    case 'jacket':
      c.fillStyle = '#f4f6fa'; c.beginPath(); c.moveTo(hx - 30, y0); c.lineTo(hx + 30, y0); c.lineTo(hx + 14, y0 + 220); c.lineTo(hx - 14, y0 + 220); c.fill();
      c.fillStyle = dark; c.beginPath(); c.moveTo(hx - 30, y0); c.lineTo(hx - 6, y0 + 70); c.lineTo(hx - 40, y0 + 40); c.fill(); c.beginPath(); c.moveTo(hx + 30, y0); c.lineTo(hx + 6, y0 + 70); c.lineTo(hx + 40, y0 + 40); c.fill();
      break;
    case 'cardigan':
      c.fillStyle = '#fff6e0'; c.fillRect(hx - 24, y0, 48, 220);
      for (let i = 0; i < 4; i++) dot(c, hx + 30, y0 + 40 + i * 32, 5, dark);
      break;
    case 'sport':
      c.fillStyle = '#ffffff'; c.fillRect(hx - 92, y0 + 60, 184, 14); c.fillStyle = dark; c.fillRect(hx - 92, y0 + 76, 184, 6);
      c.fillStyle = '#fff'; c.font = '900 26px Arial'; c.textAlign = 'center'; c.fillText('07', hx, y0 + 130);
      break;
    default:
      c.fillStyle = dark; c.beginPath(); c.moveTo(hx - 30, y0); c.lineTo(hx, y0 + 40); c.lineTo(hx + 30, y0); c.closePath(); c.fill();
  }
  c.restore();
}

function drawMouth(c, x, y, mood, color) {
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 5;
  c.beginPath();
  switch (mood) {
    case 'happy': c.arc(x, y - 8, 16, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); break;
    case 'ecstatic':
      c.moveTo(x - 20, y - 4); c.quadraticCurveTo(x, y + 26, x + 20, y - 4); c.closePath(); c.fill();
      c.fillStyle = '#ff8a9a'; c.beginPath(); c.ellipse(x, y + 7, 8, 4, 0, 0, Math.PI * 2); c.fill();
      break;
    case 'sad': c.arc(x, y + 12, 14, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); break;
    case 'angry': c.moveTo(x - 14, y + 4); c.quadraticCurveTo(x, y - 6, x + 14, y + 4); c.stroke(); break;
    case 'wow': c.ellipse(x, y + 2, 8, 11, 0, 0, Math.PI * 2); c.fill(); break;
    default: c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.stroke();
  }
}

function drawRobot(c, look, mood, t, blink, breathe = 0) {
  const hx = 130, hy = 150 + breathe * 0.5 + Math.sin(t * 3) * 1.5;
  // body
  c.fillStyle = look.shirt; c.beginPath(); c.roundRect(hx - 90, 250, 180, 220, 40); c.fill();
  c.fillStyle = shade(look.shirt, 0.25); c.beginPath(); c.roundRect(hx - 40, 290, 80, 50, 10); c.fill();
  for (let i = 0; i < 3; i++) dot(c, hx - 22 + i * 22, 315, 7, ['#ff4d6d', '#ffd84a', '#3ff2ff'][i]);
  c.fillStyle = '#6d8296'; c.fillRect(hx - 14, 205, 28, 50);
  // antenna
  c.strokeStyle = '#6d8296'; c.lineWidth = 5; c.beginPath(); c.moveTo(hx, hy - 60); c.lineTo(hx, hy - 92); c.stroke();
  dot(c, hx, hy - 96, 9, Math.sin(t * 6) > 0 ? look.eye : '#ff4d6d');
  // head
  c.beginPath(); c.roundRect(hx - 70, hy - 62, 140, 120, 30);
  const g = c.createLinearGradient(hx - 70, 0, hx + 70, 0);
  g.addColorStop(0, shade(look.body, -0.25)); g.addColorStop(0.4, shade(look.body, 0.25)); g.addColorStop(1, shade(look.body, -0.3));
  c.fillStyle = g; c.fill();
  dot(c, hx - 72, hy, 12, '#6d8296'); dot(c, hx + 72, hy, 12, '#6d8296');
  // visor
  c.fillStyle = '#10202e'; c.beginPath(); c.roundRect(hx - 52, hy - 36, 104, 68, 18); c.fill();
  c.strokeStyle = look.eye; c.fillStyle = look.eye; c.lineWidth = 5; c.shadowColor = look.eye; c.shadowBlur = 12;
  for (const s of [-1, 1]) {
    c.beginPath();
    if (blink) { c.moveTo(hx + s * 22 - 9, hy - 8); c.lineTo(hx + s * 22 + 9, hy - 8); c.stroke(); }
    else if (mood === 'happy' || mood === 'ecstatic') { c.arc(hx + s * 22, hy - 4, 10, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else if (mood === 'sad' || mood === 'angry') { c.moveTo(hx + s * 22 - 10, hy - 14 + (mood === 'angry' ? s * 6 : -s * 6)); c.lineTo(hx + s * 22 + 10, hy - 14 - (mood === 'angry' ? s * 6 : -s * 6)); c.stroke(); dot(c, hx + s * 22, hy - 4, 5, look.eye); }
    else { c.arc(hx + s * 22, hy - 8, mood === 'wow' ? 10 : 7, 0, Math.PI * 2); c.fill(); }
  }
  drawMouth(c, hx, hy + 16, mood === 'neutral' ? 'neutral' : mood, look.eye);
  c.shadowBlur = 0;
}
