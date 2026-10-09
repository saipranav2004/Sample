/* Zenstra v4 interactions and text motion. */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  var REDUCE = root.classList.contains('reduce');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var FX = window.ZXFX || null;
  var isDark = function () { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  var anim = function (el, kf, o) { return el.animate ? el.animate(kf, Object.assign({ fill: 'both', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }, o)) : null; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------------- Theme ---------------- */
  var themeListeners = [];
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      var apply = function () { root.setAttribute('data-theme', next); try { localStorage.setItem('zx-theme', next); } catch (e) {} themeListeners.forEach(function (f) { f(); }); };
      if (document.startViewTransition && !REDUCE) document.startViewTransition(apply); else apply();
    });
  });

  /* ---------------- Smooth scroll ---------------- */
  var lenis = null;
  if (!REDUCE && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  }
  var scrollToEl = function (el) { if (lenis) lenis.scrollTo(el, { offset: -80 }); else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' }); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]'); if (!a || a.getAttribute('href').length < 2) return;
    var t = document.getElementById(a.getAttribute('href').slice(1)); if (!t) return;
    e.preventDefault(); scrollToEl(t); history.replaceState(null, '', a.getAttribute('href'));
  });

  /* ---------------- Header ---------------- */
  var head = $('.head'), lastY = 0;
  var onScroll = function () {
    var y = window.scrollY;
    head.classList.toggle('scrolled', y > 8);
    if (!body.classList.contains('menu-open')) head.classList.toggle('hide', y > lastY && y > 400);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var menuBtn = $('.menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var open = !body.classList.contains('menu-open');
    body.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('menu-open')) menuBtn.click(); });

  /* ---------------- Text splitting ---------------- */
  // Splits an element's text into word wrappers (so lines never break mid-word)
  // and character spans. Keeps the full text available to assistive tech.
  function split(el, cls) {
    if (el._chars) return el._chars;
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    var chars = [];
    var walk = function (node, into) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { into.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.style.display = 'inline-block'; w.style.whiteSpace = 'nowrap';
            for (var i = 0; i < part.length; i++) { var c = document.createElement('span'); c.className = cls; c.textContent = part[i]; w.appendChild(c); chars.push(c); }
            into.appendChild(w);
          });
        } else if (n.nodeType === 1) {
          var clone = n.cloneNode(false); into.appendChild(clone); walk(n, clone);
        }
      });
    };
    var frag = document.createElement('span'); frag.setAttribute('aria-hidden', 'true');
    walk(el, frag);
    el.textContent = ''; el.appendChild(frag);
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = label; el.appendChild(sr);
    el._chars = chars; return chars;
  }

  /* ---------------- Typed headline with a gradient caret ---------------- */
  function typeIn(el, speed) {
    var chars = split(el, 'tc');
    el.classList.add('is-split');
    var caret = document.createElement('i'); caret.className = 'caret'; caret.setAttribute('aria-hidden', 'true'); el.appendChild(caret);
    var place = function (c, after) {
      var r = c.getBoundingClientRect(), b = el.getBoundingClientRect();
      caret.style.setProperty('--cx', (r.left - b.left + (after ? r.width + 4 : -2)) + 'px');
      caret.style.setProperty('--cy', (r.top - b.top + r.height * 0.08) + 'px');
      caret.style.height = (r.height * 0.84) + 'px';
    };
    return new Promise(function (resolve) {
      if (REDUCE || !chars.length) { chars.forEach(function (c) { c.style.opacity = 1; }); resolve(); return; }
      place(chars[0], false); caret.classList.add('on');
      var i = 0;
      var tick = function () {
        if (i >= chars.length) {
          caret.classList.add('blink');
          setTimeout(function () { caret.classList.remove('blink'); caret.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }); }, 1800);
          resolve(); return;
        }
        chars[i].style.opacity = 1; place(chars[i], true); i++;
        var ch = chars[i - 1].textContent;
        setTimeout(tick, speed + (/[,.]/.test(ch) ? 140 : 0) + (Math.random() * 18 - 9));
      };
      tick();
    });
  }

  /* ---------------- Rotating phrase (blur swap) ---------------- */
  function rotator(el, every) {
    var items = $$(':scope > span', el); if (items.length < 2) return;
    var idx = 0;
    var widthOf = function (s) { var on = s.classList.contains('on'); s.style.position = 'absolute'; var w = s.getBoundingClientRect().width; if (on) s.style.position = ''; return w; };
    var setW = function () { el.style.width = Math.ceil(widthOf(items[idx])) + 'px'; };
    items.forEach(function (s, i) { s.classList.toggle('on', i === 0); s.setAttribute('aria-hidden', i === 0 ? 'false' : 'true'); });
    setW(); window.addEventListener('resize', setW);
    if (REDUCE) return;
    setInterval(function () {
      if (document.hidden) return;
      var out = items[idx]; idx = (idx + 1) % items.length; var inn = items[idx];
      anim(out, [{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-0.35em)', filter: 'blur(10px)' }], { duration: 520 });
      out.classList.remove('on'); out.style.position = 'absolute'; out.setAttribute('aria-hidden', 'true');
      inn.classList.add('on'); inn.style.position = ''; inn.setAttribute('aria-hidden', 'false');
      anim(inn, [{ opacity: 0, transform: 'translateY(0.4em)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }], { duration: 760, delay: 120 });
      setW();
    }, every || 2800);
  }
  $$('[data-rot]').forEach(function (el) { rotator(el, +el.getAttribute('data-rot') || 2800); });

  /* ---------------- Hero background ---------------- */
  var heroField = null;
  var heroHost = $('.hero .field');
  var palette = function () { return isDark() ? ['#5b9dff', '#2cc0f5', '#ff7d73'] : ['#1667d9', '#12b0f0', '#f2675d']; };
  if (heroHost && FX) {
    heroField = new FX.RingField(heroHost, { colors: palette(), radius: +heroHost.getAttribute('data-radius') || 0.74, width: 0.14, center: [0, +heroHost.getAttribute('data-cy') || 0.02] });
    var maskEl = $('[data-mask]');
    if (maskEl && !heroField.failed) heroField.setMask(maskEl, 0.08);
    themeListeners.push(function () { heroField.setColors(palette()); });
  }

  /* ---------------- Intro, then hero ---------------- */
  function startHero() {
    var h = $('[data-typed]');
    if (heroField && !heroField.failed) heroField.start();
    var scope = h ? (h.closest('section') || body) : body;
    var done = function () { scope.classList.add('typed-done'); };
    if (!h) { done(); return; }
    wait(REDUCE ? 0 : 250).then(function () { return typeIn(h, +h.getAttribute('data-typed') || 42); }).then(done);
  }

  function runIntro() {
    var intro = $('.intro');
    if (!root.classList.contains('intro-play') || !intro) { startHero(); return; }
    try { sessionStorage.setItem('zx4-intro', '1'); } catch (e) {}
    if (lenis) lenis.stop();
    var brand = $('.intro-brand', intro), forW = $('.intro-for', intro), box = $('.intro-words', intro), words = $$('span', box);
    var finished = false;
    var finish = function () {
      if (finished) return; finished = true;
      var a = anim(intro, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease' });
      anim($('.intro-line', intro), [{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }], { duration: 650 });
      var end = function () { root.classList.remove('intro-play'); if (lenis) lenis.start(); };
      if (a) a.onfinish = end; else end();
      setTimeout(startHero, 220);
    };
    $('.intro-skip', intro).addEventListener('click', finish);
    intro.addEventListener('click', finish);
    window.addEventListener('keydown', finish, { once: true });
    var widthTo = function (w) { box.style.transition = 'width 520ms cubic-bezier(0.16, 1, 0.3, 1)'; box.style.width = w + 'px'; };
    var wW = function (s) { return s.getBoundingClientRect().width; };
    box.style.width = '0px';
    anim(brand, [{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 700 });
    anim(forW, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 300 });
    var seq = wait(450);
    words.forEach(function (w, i) {
      seq = seq.then(function () {
        if (finished) return;
        widthTo(wW(w));
        anim(w, [{ opacity: 0, transform: 'translateY(0.45em)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }], { duration: 560 });
        return wait(820);
      }).then(function () {
        if (finished) return;
        anim(w, [{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-0.4em)', filter: 'blur(10px)' }], { duration: 420 });
        return wait(i === words.length - 1 ? 260 : 120);
      });
    });
    seq.then(function () {
      if (finished) return;
      widthTo(0);
      anim(forW, [{ opacity: 1, maxWidth: '3em' }, { opacity: 0, maxWidth: '0em' }], { duration: 520 });
      return wait(900);
    }).then(finish);
  }

  /* ---------------- Statement typed by scroll ---------------- */
  $$('[data-scrub]').forEach(function (p) {
    var chars = split(p, 'sc'), n = chars.length, lit = 0;
    var caret = document.createElement('i'); caret.className = 'caret on'; caret.setAttribute('aria-hidden', 'true'); p.appendChild(caret);
    var place = function (c) {
      var r = c.getBoundingClientRect(), b = p.getBoundingClientRect();
      caret.style.setProperty('--cx', (r.right - b.left + 3) + 'px'); caret.style.setProperty('--cy', (r.top - b.top + r.height * 0.1) + 'px'); caret.style.height = (r.height * 0.8) + 'px';
    };
    if (REDUCE) { caret.remove(); return; }
    var update = function () {
      var r = p.getBoundingClientRect(), vh = innerHeight;
      var prog = Math.min(1, Math.max(0, (vh * 0.86 - r.top) / (r.height + vh * 0.32)));
      var target = Math.round(prog * n);
      if (target === lit) return;
      var a = Math.min(lit, target), b = Math.max(lit, target);
      for (var i = a; i < b; i++) chars[i].classList.toggle('lit', i < target);
      lit = target;
      caret.style.opacity = target > 0 && target < n ? 1 : 0;
      if (target > 0) place(chars[target - 1]);
    };
    window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update); update();
  });

  /* ---------------- Reveals ---------------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' }) : null;
  $$('[data-reveal]').forEach(function (el) {
    var d = el.getAttribute('data-delay'); if (d) el.style.transitionDelay = d + 'ms';
    if (io && !REDUCE) io.observe(el); else el.classList.add('in');
  });
  $$('[data-chars]').forEach(function (el) {
    var chars = split(el, 'cf');
    chars.forEach(function (c, i) { c.style.transitionDelay = Math.min(i * 7, 900) + 'ms'; });
    if (io && !REDUCE) io.observe(el); else el.classList.add('in');
  });

  /* ---------------- Count up ---------------- */
  $$('[data-count]').forEach(function (el) {
    var to = parseFloat(el.getAttribute('data-count')), dec = (el.getAttribute('data-count').split('.')[1] || '').length, pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    var set = function (v) { el.textContent = pre + v.toFixed(dec) + suf; };
    if (REDUCE || !io) { set(to); return; }
    set(0);
    var o = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return; o.disconnect();
      var t0 = performance.now(), dur = 1400;
      var step = function (now) { var k = Math.min(1, (now - t0) / dur); set(to * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    o.observe(el);
  });

  /* ---------------- Bubble wave ---------------- */
  $$('[data-bubbles]').forEach(function (wrap) {
    var row = $('.bubble-row', wrap); if (!row) return;
    row.innerHTML += row.innerHTML;
    var items = $$('.bubble', row), vis = false, phase = 0, last = 0;
    var pos = items.map(function (b) { return b.offsetLeft + b.offsetWidth / 2; });
    var span = row.scrollWidth / 2;
    var amp = 30;
    var draw = function (scrollX) {
      for (var i = 0; i < items.length; i++) {
        var x = pos[i] + scrollX;
        var y = Math.sin((x + phase) / 520 * Math.PI * 2) * amp;
        items[i].style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      }
    };
    var offset = function () {
      var r = wrap.getBoundingClientRect(), prog = 1 - (r.top + r.height) / (innerHeight + r.height);
      return -((phase * 0.35) % span) - prog * 260;
    };
    var frame = function (now) {
      if (!vis) return;
      var dt = last ? (now - last) / 1000 : 0; last = now;
      phase += dt * 80;
      var x = offset(); row.style.transform = 'translateX(' + x.toFixed(1) + 'px)'; draw(x);
      requestAnimationFrame(frame);
    };
    if (REDUCE) { draw(0); return; }
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; last = 0; if (vis) requestAnimationFrame(frame); }).observe(wrap);
  });

  /* ---------------- Product explorer ---------------- */
  $$('[data-explore]').forEach(function (sec) {
    var items = $$('[data-ex-item]', sec), shots = $$('.ex-shot', sec), dots = $$('.ex-dots i', sec);
    var set = function (i) {
      items.forEach(function (it, k) { it.classList.toggle('on', k === i); });
      shots.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    };
    set(0);
    if (!('IntersectionObserver' in window)) return;
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) set(items.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    items.forEach(function (it) { o.observe(it); });
  });

  /* ---------------- Custom cursor over media ---------------- */
  var cursor = null;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !REDUCE) {
    cursor = document.createElement('div'); cursor.className = 'cursor'; cursor.setAttribute('aria-hidden', 'true'); body.appendChild(cursor);
    var cx = -200, cy = -200, tx = -200, ty = -200, active = false;
    var loop = function () { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cursor.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)'; if (active || Math.abs(tx - cx) > 0.5) requestAnimationFrame(loop); else loopOn = false; };
    var loopOn = false;
    $$('[data-cursor]').forEach(function (el) {
      el.addEventListener('pointerenter', function (e) { active = true; cursor.textContent = el.getAttribute('data-cursor'); cx = tx = e.clientX; cy = ty = e.clientY; cursor.classList.add('on'); if (!loopOn) { loopOn = true; requestAnimationFrame(loop); } });
      el.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; });
      el.addEventListener('pointerleave', function () { active = false; cursor.classList.remove('on'); });
    });
  }

  /* ---------------- Morph panel ---------------- */
  $$('[data-morph]').forEach(function (panel) {
    var host = $('.field', panel), steps = $$('.step', panel);
    var shapes = steps.map(function (s) { return s.getAttribute('data-shape'); });
    var mf = FX && host ? new FX.MorphField(host, { shapes: shapes }) : null;
    var idx = 0, timer = null, barAnim = null, vis = false, paused = false;
    var go = function (i, user) {
      idx = i;
      steps.forEach(function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-selected', String(k === i)); });
      if (mf) mf.setShape(shapes[i]);
      if (barAnim) barAnim.cancel();
      var bar = $('.bar', steps[i]);
      if (!REDUCE && bar && !user) barAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 5200, fill: 'forwards' });
      clearTimeout(timer);
      if (!REDUCE && !user && vis) timer = setTimeout(function () { go((idx + 1) % steps.length); }, 5200);
    };
    steps.forEach(function (s, i) { s.addEventListener('click', function () { paused = true; go(i, true); }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      vis = es[0].isIntersecting;
      if (vis && !paused) go(idx); else clearTimeout(timer);
    }, { threshold: 0.35 }).observe(panel);
    go(0, true);
  });

  /* ---------------- Dot waves and CTA field ---------------- */
  if (FX) {
    $$('canvas[data-dots]').forEach(function (c, i) { new FX.DotWave(c, { phase: i * 1.7 }); });
    $$('.cta-panel .field').forEach(function (h) {
      var wide = h.clientWidth / Math.max(1, h.clientHeight);
      var f = new FX.RingField(h, { colors: ['#2f6bff', '#5b9dff', '#9fd8ff'], radius: 0.82, width: 0.18, center: [wide > 1.4 ? Math.min(wide - 0.9, 1.25) : 0, wide > 1.4 ? 0.05 : 0.45], grow: false, size: 8 });
      if (!f.failed) { var inner = h.parentElement.querySelector('.inner'); if (inner) f.setMask(inner, 0.12); f.start(); }
    });
  }

  /* ---------------- Agenda progress line ---------------- */
  $$('[data-agenda]').forEach(function (list) {
    var line = $('.prog', list); if (!line) return;
    if (REDUCE) { line.style.transform = 'scaleY(1)'; return; }
    var upd = function () { var r = list.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight * 0.72 - r.top) / r.height)); line.style.transform = 'scaleY(' + k.toFixed(3) + ')'; };
    window.addEventListener('scroll', upd, { passive: true }); upd();
  });

  /* ---------------- Footer wordmark lift ---------------- */
  var foot = $('[data-foot]');
  if (foot && !REDUCE) {
    var star = $('.lift-star', foot);
    var upd = function () {
      var r = foot.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight - r.top) / r.height));
      var e = 1 - Math.pow(1 - k, 2);
      if (star) star.style.transform = 'translateY(' + ((1 - e) * 0.9).toFixed(3) + 'em) rotate(' + ((1 - e) * -180).toFixed(1) + 'deg) scale(' + (0.4 + e * 0.6).toFixed(3) + ')';
    };
    window.addEventListener('scroll', upd, { passive: true }); upd();
  }

  /* ---------------- FAQ height ---------------- */
  $$('.faq details').forEach(function (d) {
    var s = $('summary', d), a = $('.a', d);
    s.addEventListener('click', function (e) {
      if (REDUCE || !a) return; e.preventDefault();
      if (d.open) { var h = a.offsetHeight; var x = a.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }); x.onfinish = function () { d.open = false; }; }
      else { d.open = true; var h2 = a.offsetHeight; a.animate([{ height: '0px', opacity: 0 }, { height: h2 + 'px', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }); }
    });
  });

  /* ---------------- Forms ---------------- */
  var FREE = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|gmx|mail)\./i;
  $$('form[data-validate]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      $$('.field', form).forEach(function (f) {
        var inp = $('input:not([type=checkbox]), select, textarea', f), err = $('.err', f); if (!inp) return;
        var msg = '';
        if (inp.required && !inp.value.trim()) msg = 'Required.';
        else if (inp.type === 'email' && inp.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value)) msg = 'Enter an email like name@company.com.';
        else if (inp.type === 'email' && inp.hasAttribute('data-work') && FREE.test(inp.value)) msg = 'Use your work email so we can prepare for your environment.';
        f.classList.toggle('invalid', !!msg); if (err) err.textContent = msg; inp.setAttribute('aria-invalid', String(!!msg));
        if (msg && !first) first = inp;
      });
      $$('.consent', form).forEach(function (c) { var cb = $('input', c); var bad = cb.required && !cb.checked; c.classList.toggle('invalid', bad); if (bad && !first) first = cb; });
      if (first) { first.focus(); return; }
      var ok = form.parentElement.querySelector('[data-success]'); if (!ok) return;
      form.hidden = true; ok.hidden = false;
      var who = $('[data-who]', ok), nm = $('input[name=first]', form); if (who && nm) who.textContent = nm.value.trim();
      if (!REDUCE) {
        anim(ok, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 700 });
        var path = $('.check path', ok); if (path) { var L = path.getTotalLength(); path.style.strokeDasharray = L; anim(path, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 200 }); }
      }
      var h = $('h2, h3', ok); if (h) { h.tabIndex = -1; h.focus(); }
    });
  });

  window.__v4ok = true;
  runIntro();
})();
