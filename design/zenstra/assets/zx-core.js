/* Zenstra core: theme switching and motion preferences, shared by every page.
   The <head> of each page sets data-theme before first paint; this file wires
   the toggle and exposes ZX.reduce for the motion scripts. */
(function () {
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ZX = (window.ZX = window.ZX || {});
  ZX.reduce = mq.matches;
  if (ZX.reduce) root.classList.add('reduce');

  ZX.isDark = function () {
    var t = root.dataset.theme;
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  ZX.cssVar = function (name) { return getComputedStyle(root).getPropertyValue(name).trim(); };

  var listeners = [];
  ZX.onTheme = function (fn) { listeners.push(fn); };

  function apply(next) {
    root.dataset.theme = next;
    try { localStorage.setItem('zx-theme', next); } catch (e) {}
    listeners.forEach(function (fn) { fn(next); });
  }

  // Circular reveal from the toggle where View Transitions exist.
  ZX.toggleTheme = function (evt) {
    var next = ZX.isDark() ? 'light' : 'dark';
    if (!document.startViewTransition || ZX.reduce) { apply(next); return; }
    var x = evt && evt.clientX != null ? evt.clientX : innerWidth - 40;
    var y = evt && evt.clientY != null ? evt.clientY : 32;
    var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var vt = document.startViewTransition(function () { apply(next); });
    vt.ready.then(function () {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-theme-toggle]');
    if (t) ZX.toggleTheme(e);
  });

  // If the motion script fails to start, never leave content hidden.
  setTimeout(function () { if (!ZX.motionReady) root.classList.add('reveal-all'); }, 2500);
})();
