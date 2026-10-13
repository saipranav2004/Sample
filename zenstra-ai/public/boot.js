/* Runs in <head> before the page paints: marks JS on, applies the saved theme and
   reduced motion, and decides whether the opening sequence plays. It plays on the
   home page, once per tab (or with ?intro=1); landing on any other page marks it as
   seen. A file rather than inline script, so the CSP can forbid inline scripts. */
(function () {
  var r = document.documentElement, intro = location.pathname === '/' || location.pathname === '/index.html';
  r.classList.add('js');
  try { var t = localStorage.getItem('zx-theme'); if (t) r.setAttribute('data-theme', t); } catch (e) {}
  var red = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (red) r.classList.add('reduce');
  var seen = false;
  try { seen = sessionStorage.getItem('zx5-intro') === '1'; } catch (e) {}
  if (intro) { if (!red && (!seen || /[?&]intro=1/.test(location.search))) r.classList.add('intro-play'); }
  else { try { sessionStorage.setItem('zx5-intro', '1'); } catch (e) {} }
  // If the app never starts, show the page instead of a stuck intro.
  setTimeout(function () { if (!window.__v5ok) { r.classList.remove('intro-play'); r.classList.add('reveal-all'); } }, 7000);
})();
