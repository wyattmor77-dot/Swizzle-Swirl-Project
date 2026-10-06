/* =========================================================
   AI FOOD FACTORY — COMPATIBILITY
   Small polyfills so the game also runs on older browsers
   (e.g. older school Chromebooks), plus an on-screen error
   message instead of a silently frozen game.
   ========================================================= */
(function () {
  // Canvas roundRect (Chrome < 99, Safari < 16, Firefox < 112)
  const P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (P && !P.roundRect) {
    P.roundRect = function (x, y, w, h, r) {
      r = Math.max(0, Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y); this.arcTo(x + w, y, x + w, y + r, r);
      this.lineTo(x + w, y + h - r); this.arcTo(x + w, y + h, x + w - r, y + h, r);
      this.lineTo(x + r, y + h); this.arcTo(x, y + h, x, y + h - r, r);
      this.lineTo(x, y + r); this.arcTo(x, y, x + r, y, r);
      this.closePath();
      return this;
    };
  }
  if (!Array.prototype.at) {
    Array.prototype.at = function (i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; };
  }
  // Show startup errors on screen so a broken game is never silent
  window.addEventListener('error', function (e) {
    if (document.getElementById('aff-error')) return;
    const d = document.createElement('div');
    d.id = 'aff-error';
    d.style.cssText = 'position:fixed;left:10px;right:10px;bottom:10px;z-index:99999;padding:12px 16px;border-radius:12px;background:#b3123f;color:#fff;font:700 15px Arial,sans-serif';
    d.textContent = 'Oops, something went wrong: ' + (e.message || 'unknown error') + ' — try updating your browser (Chrome, Edge or Firefox) and reload.';
    document.body.appendChild(d);
  });
})();
