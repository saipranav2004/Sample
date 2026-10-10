/* Zenstra site forms: demo requests, document requests, newsletter.
 * Any <form data-api="/api/..."> is validated in the browser, posted as JSON
 * to the lead API, and answered with the server's own field messages, a
 * reference number and, for demos, an instant booking calendar when one is
 * configured. Works without the motion scripts and on every page.
 */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var forms = $$('form[data-api]');
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOADED = Date.now();
  var PREVIEW = location.protocol === 'file:';

  // Campaign attribution from the landing page, kept for the visit.
  var TRACK = (function () {
    var key = 'zx-attribution', saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) {}
    var q = new URLSearchParams(location.search), utm = {};
    ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) { var v = q.get('utm_' + k); if (v) utm[k] = v.slice(0, 100); });
    if (!saved || Object.keys(utm).length) {
      saved = { utm: Object.keys(utm).length ? utm : (saved && saved.utm) || {}, referrer: (saved && saved.referrer) || (document.referrer && document.referrer.indexOf(location.origin) !== 0 ? document.referrer.slice(0, 500) : '') };
      try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch (e) {}
    }
    return saved;
  })();

  // Instant feedback only; the server has the full list and the final say.
  var FREE = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|web|mail|zoho|yandex|qq|163|126|fastmail|hey|duck|mailinator|guerrillamail|10minutemail|yopmail|tempmail|temp-mail)\.[a-z.]+$/i;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var MSG = { required: 'Required.', email: 'Enter an email address like name@company.com.', free: 'Use your work email so we can prepare for your environment.', state: 'Choose a state.' };

  var config = null;
  function getConfig() {
    if (config) return config;
    config = PREVIEW ? Promise.resolve({}) : fetch('/api/config', { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    return config;
  }

  // Cloudflare Turnstile, only when the API says a site key is configured.
  var tsLoad = null;
  function turnstile(form) {
    var box = $('[data-turnstile]', form);
    if (!box) return;
    getConfig().then(function (c) {
      if (!c.turnstileSiteKey) return;
      if (!tsLoad) tsLoad = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
      tsLoad.then(function () {
        box.hidden = false;
        form._ts = window.turnstile.render(box, { sitekey: c.turnstileSiteKey, action: form.getAttribute('data-kind') || 'form', size: 'flexible', theme: 'auto', callback: function (t) { form._tsToken = t; }, 'expired-callback': function () { form._tsToken = ''; } });
      }).catch(function () {});
    });
  }

  function fieldOf(el) { return el.closest('.field') || el.closest('.consent') || el.parentElement; }
  function setError(el, msg) {
    var f = fieldOf(el), err = f && $('.err', f);
    if (f) f.classList.toggle('invalid', !!msg);
    if (err) err.textContent = msg || '';
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err && err.id) el.setAttribute('aria-describedby', err.id);
  }
  function check(el) {
    if (el.disabled || el.type === 'checkbox' || el.name === 'website') return '';
    var v = (el.value || '').trim();
    if (el.required && !v) return el.name === 'region' ? MSG.state : MSG.required;
    if (el.type === 'email' && v) {
      if (!EMAIL.test(v)) return MSG.email;
      if (el.hasAttribute('data-work') && FREE.test(v)) return MSG.free;
    }
    return '';
  }

  // Fields shown only for some answers, e.g. US state.
  function conditions(form) {
    $$('[data-show-if]', form).forEach(function (box) {
      var parts = box.getAttribute('data-show-if').split('='), src = form.elements[parts[0]];
      var sync = function () {
        var on = src && src.value === parts[1];
        box.hidden = !on;
        $$('input, select, textarea', box).forEach(function (el) { el.disabled = !on; if (!on) setError(el, ''); });
      };
      if (src) src.addEventListener('change', sync);
      sync();
    });
  }

  function message(form, text, kind) {
    var m = $('[data-form-msg]', form);
    if (!m) { m = document.createElement('p'); m.className = 'form-msg'; m.setAttribute('data-form-msg', ''); m.setAttribute('role', 'alert'); var b = $('button[type=submit]', form); (b && b.parentNode === form ? form : (b ? b.parentNode : form)).insertBefore(m, b && b.parentNode ? b : null); }
    m.className = 'form-msg' + (kind ? ' ' + kind : '');
    m.hidden = !text;
    m.textContent = '';
    if (text && typeof text === 'object') m.appendChild(text); else m.textContent = text || '';
  }

  function fallbackText(form, lead) {
    var mail = form.getAttribute('data-fallback-email') || 'hello@zenstra.ai';
    var span = document.createElement('span');
    span.appendChild(document.createTextNode(lead + ' '));
    var a = document.createElement('a'); a.href = 'mailto:' + mail; a.textContent = mail;
    span.appendChild(a); span.appendChild(document.createTextNode('.'));
    return span;
  }

  function payload(form) {
    var data = {}, arrays = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled || el.type === 'submit' || el.type === 'button') return;
      // Turnstile adds its own hidden input; the token is sent separately below.
      if (el.closest('[data-turnstile]')) return;
      if (el.type === 'checkbox') {
        if (el.hasAttribute('data-bool')) data[el.name] = el.checked;
        else { arrays[el.name] = arrays[el.name] || []; if (el.checked) arrays[el.name].push(el.value); }
        return;
      }
      data[el.name] = (el.value || '').trim();
    });
    Object.keys(arrays).forEach(function (k) { data[k] = arrays[k]; });
    data.elapsedMs = Math.min(86400000, Date.now() - LOADED);
    var token = form._tsToken;
    if (window.turnstile && form._ts != null) { try { token = window.turnstile.getResponse(form._ts) || token; } catch (e) {} }
    if (token) data.turnstileToken = token;
    if (TRACK.utm && Object.keys(TRACK.utm).length) data.utm = TRACK.utm;
    if (TRACK.referrer) data.referrer = TRACK.referrer;
    data.page = location.origin + location.pathname;
    return data;
  }

  function busy(form, on) {
    var b = $('button[type=submit]', form);
    form.setAttribute('aria-busy', on ? 'true' : 'false');
    if (!b) return;
    if (on) { b._label = b.innerHTML; b.disabled = true; b.textContent = 'Sending…'; }
    else if (b._label) { b.disabled = false; b.innerHTML = b._label; }
  }

  function success(form, data, res) {
    var ok = form.parentElement.querySelector('[data-success]');
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'lead_submitted', form: form.getAttribute('data-kind'), ref: res.ref }); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('zx:lead', { detail: { kind: form.getAttribute('data-kind'), ref: res.ref } })); } catch (e) {}
    if (!ok) { form.reset(); message(form, 'Thanks. Your request reference is ' + res.ref + '.', 'ok'); return; }
    var set = function (sel, v) { $$(sel, ok).forEach(function (el) { el.textContent = v; }); };
    set('[data-who]', (data.firstName || (data.name || '').split(' ')[0] || 'there'));
    set('[data-email]', data.email || '');
    set('[data-ref]', res.ref || '');
    var book = $('[data-booking]', ok);
    if (book && res.bookingUrl && /^https:\/\//.test(res.bookingUrl)) {
      var frame = $('iframe', book), link = $('[data-booking-link]', book);
      if (frame) frame.src = res.bookingUrl;
      if (link) link.href = res.bookingUrl;
      book.hidden = false;
      var later = $('[data-no-booking]', ok); if (later) later.hidden = true;
    }
    form.hidden = true; ok.hidden = false;
    if (!REDUCE && ok.animate) {
      ok.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      var path = $('.check path, .success path', ok);
      if (path && path.getTotalLength) { var L = path.getTotalLength(); path.style.strokeDasharray = L; path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 200, fill: 'both' }); }
    }
    var h = $('h2, h3', ok); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    var top = ok.getBoundingClientRect().top;
    // The page may use smooth scrolling (Lenis), which owns the scroll position.
    if (top < 80 || top > innerHeight * 0.6) {
      var lenis = window.ZX && window.ZX.lenis;
      if (lenis && lenis.scrollTo) lenis.scrollTo(ok, { offset: -Math.max(96, (innerHeight - ok.offsetHeight) / 2), immediate: REDUCE });
      else ok.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'center' });
    }
  }

  forms.forEach(function (form) {
    form.setAttribute('novalidate', '');
    conditions(form);
    turnstile(form);
    var tried = false;
    // Forms inside dialogs are reset when reopened; clear our messages too.
    form.addEventListener('reset', function () {
      tried = false; message(form, '');
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name) setError(el, ''); });
      setTimeout(function () { conditions(form); });
    });
    $$('input, select, textarea', form).forEach(function (el, i) {
      var err = fieldOf(el) && $('.err', fieldOf(el));
      if (err && !err.id) err.id = (form.id || 'f' + forms.indexOf(form)) + '-err-' + i;
      el.addEventListener('blur', function () { if (tried || el.value) setError(el, check(el)); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') setError(el, check(el)); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      tried = true;
      message(form, '');
      var first = null;
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name && !el.required) return;
        var m = check(el); setError(el, m);
        if (m && !first) first = el;
      });
      if (first) { first.focus(); message(form, 'Please check the highlighted fields.', 'bad'); return; }
      if (PREVIEW) { message(form, 'Preview mode: this form sends when the site runs on its server (see zenstra-site/README.md).', 'bad'); return; }

      var data = payload(form);
      busy(form, true);
      fetch(form.getAttribute('data-api'), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (r) {
          busy(form, false);
          if (r.status === 201 && r.body.ok) return success(form, data, r.body);
          if (r.status === 422 && r.body.fields) {
            var firstBad = null;
            Object.keys(r.body.fields).forEach(function (name) { var el = form.elements[name]; if (el && el.length && !el.tagName) el = el[0]; if (el) { setError(el, r.body.fields[name]); if (!firstBad) firstBad = el; } });
            if (firstBad) firstBad.focus();
            return message(form, r.body.message || 'Please check the highlighted fields.', 'bad');
          }
          if (r.status === 400 && r.body.error === 'verification_failed') { if (window.turnstile && form._ts != null) window.turnstile.reset(form._ts); form._tsToken = ''; return message(form, r.body.message, 'bad'); }
          if (r.status === 429) return message(form, 'Too many requests from your network. Please wait a minute and try again.', 'bad');
          message(form, fallbackText(form, 'We could not send your request just now. Please try again, or email us at'), 'bad');
        })
        .catch(function () {
          busy(form, false);
          message(form, fallbackText(form, 'We could not reach our servers. Check your connection and try again, or email us at'), 'bad');
        });
    });

    // Newsletter confirmation links come back with ?subscribed=1 or =invalid.
    if (form.getAttribute('data-kind') === 'newsletter') {
      var s = new URLSearchParams(location.search).get('subscribed');
      if (s === '1') message(form, 'You are subscribed. Thank you for confirming.', 'ok');
      else if (s === 'invalid') message(form, 'That confirmation link is invalid or has expired. Subscribe again to get a new one.', 'bad');
    }
  });
})();
