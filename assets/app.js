/* HudHudMessage landing page. Plain JS, no build step. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const RM = matchMedia('(prefers-reduced-motion: reduce)');

  /* page-in */
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('loaded')));

  /* pause loops on hidden tabs */
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ---------- mobile menu ---------- */
  const menu = $('.menu'), sheet = $('#sheet');
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    menu.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
    sheet.hidden = open;
  });
  $$('a', sheet).forEach(a => a.addEventListener('click', () => { sheet.hidden = true; menu.setAttribute('aria-expanded', 'false'); }));

  /* ---------- HERO: the bill, read as you scroll ---------- */
  const hero = $('.hero'), invoice = $('.invoice'), cue = $('.cue'), count = $('.count');
  const bands = $$('.hero .band').map((el, i, all) => ({
    el, a: +el.dataset.a, b: +el.dataset.b, first: i === 0, last: i === all.length - 1, o: -1, k: -1, live: null
  }));
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  const MQLS = GATES.map(q => matchMedia(q));
  let scrubOn = false, target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  const inv = { s: -1, f: -1, t: -1, cue: -1 };
  let lastCount = '', lastCountAt = 0;

  const heroProgress = () => {
    const r = hero.getBoundingClientRect();
    const range = r.height - innerHeight;
    return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  };
  const setVar = (el, name, v, cacheObj, key, eps = 0.004) => {
    if (Math.abs(cacheObj[key] - v) < eps && !(v === 0 || v === 1) ) return;
    if (cacheObj[key] === v) return;
    cacheObj[key] = v;
    el.style.setProperty(name, v.toFixed(3));
  };

  function render(p, now) {
    for (const bd of bands) {
      const f = Math.min(0.03, (bd.b - bd.a) / 3);
      const inO = bd.first ? 1 : smooth(p, bd.a, bd.a + f);
      const outO = bd.last ? 0 : smooth(p, bd.b - f, bd.b);
      const o = inO * (1 - outO);
      const ramp = 0.1;
      const k = bd.first ? 1 : clamp((p - bd.a) / ramp, 0, 1);
      setVar(bd.el, '--o', o, bd, 'o');
      setVar(bd.el, '--k', k, bd, 'k', 0.008);
      const live = o > 0.5;
      if (live !== bd.live) { bd.live = live; bd.el.classList.toggle('live', live); bd.el.toggleAttribute('inert', !live); }
    }
    const s = smooth(p, 0.20, 0.32), fl = smooth(p, 0.47, 0.57), t = smooth(p, 0.73, 0.81);
    setVar(invoice, '--s', s, inv, 's');
    setVar(invoice, '--f', fl, inv, 'f');
    setVar(invoice, '--t', t, inv, 't');
    setVar(cue, '--cue', clamp(p / 0.08, 0, 1), inv, 'cue');
    const label = t >= 0.999 ? inr(48997) : inr(48997 * t);
    if (label !== lastCount && (now - lastCountAt > 100 || t >= 0.999 || t === 0)) { lastCount = label; lastCountAt = now; count.textContent = label; }
  }

  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.14;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    render(shown, now);
  }
  function onScroll() {
    if (!scrubOn) return;
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }
  new IntersectionObserver(es => { heroOnScreen = es[0].isIntersecting; if (heroOnScreen) onScroll(); }).observe(hero);

  function pinHeroFinal() {
    bands.forEach(bd => { bd.el.style.removeProperty('--o'); bd.el.style.removeProperty('--k'); bd.el.removeAttribute('inert'); bd.el.classList.remove('live'); bd.o = bd.k = -1; bd.live = null; });
    ['--s', '--f', '--t'].forEach(v => invoice.style.removeProperty(v));
    inv.s = inv.f = inv.t = inv.cue = -1;
    count.textContent = inr(48997); lastCount = '';
  }
  const art = $('.hero-art');
  function fitInvoice() {
    invoice.classList.add('measure');
    const h = invoice.offsetHeight;
    invoice.classList.remove('measure');
    const fit = Math.min(1, (innerHeight - Math.max(88, innerHeight * 0.12) - 40) / h);
    art.style.setProperty('--ih', h + 'px');
    art.style.setProperty('--fit', fit.toFixed(3));
  }
  let fitT = null;
  addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => { if (scrubOn) fitInvoice(); }, 120); });
  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    document.documentElement.classList.add('scrub');
    fitInvoice();
    if (document.fonts) document.fonts.ready.then(() => { if (scrubOn) fitInvoice(); });
    bands.forEach(bd => { bd.o = bd.k = -1; bd.live = null; });
    addEventListener('scroll', onScroll, { passive: true });
    shown = target = heroProgress();
    render(shown, performance.now());
  }
  function disableScrub() {
    if (!scrubOn) { pinHeroFinal(); return; }
    scrubOn = false;
    document.documentElement.classList.remove('scrub');
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    pinHeroFinal();
  }
  function applyHeroMode() { if (MQLS.some(m => m.matches)) disableScrub(); else enableScrub(); }
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));
  applyHeroMode();

  /* ---------- entrances ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    setTimeout(() => e.target.classList.add('settled'), 1400);   // retire stagger delays
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  $$('.reveal, .leak, .steps, .ratecard').forEach(el => io.observe(el));

  /* ---------- CALCULATOR: read your own bill ---------- */
  const META_MKT = 0.8631, META_UTIL = 0.115;
  const msgs = $('#msgs'), price = $('#price'), upd = $('#upd');
  const out = { msgs: $('#msgs-o'), price: $('#price-o'), upd: $('#upd-o'), meta: $('#r-meta'), extra: $('#r-extra'), wrong: $('#r-wrong'), total: $('#r-total'), year: $('#r-year') };
  const seg = { meta: $('#seg-meta'), extra: $('#seg-extra'), wrong: $('#seg-wrong') };
  const penWrap = $('.calc .pen-wrap');
  let lastBill = 0, penTimer = null;
  const fill = el => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%');
  function calc() {
    const m = +msgs.value, pr = +price.value, u = +upd.value;
    const metaPart = m * META_MKT;
    const extra = m * Math.max(0, pr - META_MKT);
    const wrong = u * (META_MKT - META_UTIL);
    const total = extra + wrong;
    out.msgs.textContent = m.toLocaleString('en-IN');
    out.price.textContent = '₹' + pr.toFixed(2);
    out.upd.textContent = u.toLocaleString('en-IN');
    out.meta.textContent = inr(metaPart);
    out.extra.textContent = inr(extra);
    out.wrong.textContent = inr(wrong);
    out.total.textContent = inr(total);
    out.year.textContent = inr(total * 12);
    seg.meta.style.flexGrow = metaPart; seg.extra.style.flexGrow = extra; seg.wrong.style.flexGrow = wrong;
    [msgs, price, upd].forEach(fill);
    lastBill = m * pr + u * pr;
  }
  [msgs, price, upd].forEach(el => {
    el.addEventListener('input', () => { calc(); penWrap.classList.remove('drawn'); clearTimeout(penTimer); penTimer = setTimeout(() => penWrap.classList.add('drawn'), 700); });
  });
  calc();
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { setTimeout(() => penWrap.classList.add('drawn'), 500); o.disconnect(); } }, { threshold: 0.5 }).observe(penWrap);

  /* ---------- DATA: the comparison grows ---------- */
  const plot = $('#plot'), dotsEl = $('#dots'), rangeEl = $('#range'), nEl = $('#n-count'), emptyEl = $('#empty');
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(20261009);
  const X = v => clamp((v - 0.85) / 0.30, 0, 1) * 100;
  const dots = Array.from({ length: 30 }, (_, i) => {
    const spread = i < 7 ? 0.075 : 0.035;
    const g = (rng() + rng() + rng() - 1.5) / 1.5;
    const v = clamp(0.97 + g * spread * 1.6, 0.875, 1.12);
    const el = document.createElement('i');
    el.style.setProperty('--x', X(v).toFixed(2) + '%');
    el.style.setProperty('--y', (8 + rng() * 84).toFixed(1) + '%');
    dotsEl.appendChild(el);
    return { v, el };
  });
  let lastN = 0;
  function setN(n) {
    if (n === lastN) return; lastN = n;
    dots.forEach((d, i) => d.el.classList.toggle('on', i < n));
    nEl.textContent = n;
    const ok = n >= 8;
    emptyEl.style.setProperty('--eo', ok ? 0 : 1);
    if (ok) {
      const vs = dots.slice(0, n).map(d => d.v).sort((a, b) => a - b);
      const q = p => vs[Math.min(vs.length - 1, Math.max(0, Math.round(p * (vs.length - 1))))];
      const lo = q(0.25), hi = q(0.75);
      rangeEl.style.setProperty('--l', X(lo).toFixed(2) + '%');
      rangeEl.style.setProperty('--rw', Math.max(3, X(hi) - X(lo)).toFixed(2) + '%');
      rangeEl.style.setProperty('--ro', 1);
      rangeEl.querySelector('span').textContent = 'Typical ₹' + lo.toFixed(2) + ' to ₹' + hi.toFixed(2);
    } else rangeEl.style.setProperty('--ro', 0);
  }
  let dataRaf = null;
  function dataTick() {
    dataRaf = null;
    const r = plot.getBoundingClientRect();
    const p = clamp((innerHeight * 0.92 - r.top) / (innerHeight * 0.75), 0, 1);
    setN(1 + Math.round(p * 29));
  }
  const onDataScroll = () => { if (dataRaf === null) dataRaf = requestAnimationFrame(dataTick); };
  let dataOn = false;
  new IntersectionObserver(es => {
    const vis = es[0].isIntersecting;
    if (RM.matches) { setN(30); return; }
    if (vis && !dataOn) { dataOn = true; addEventListener('scroll', onDataScroll, { passive: true }); onDataScroll(); }
    if (!vis && dataOn) { dataOn = false; removeEventListener('scroll', onDataScroll); }
  }).observe(plot);

  /* ---------- reduced motion, live in both directions ---------- */
  function pinToFinalStates() {
    setN(30);
    penWrap.classList.add('drawn');
    $$('.reveal, .leak, .steps, .ratecard').forEach(el => el.classList.add('in', 'settled'));
  }
  if (RM.matches) pinToFinalStates();
  RM.addEventListener('change', e => { if (e.matches) pinToFinalStates(); else { lastN = 0; onDataScroll(); } applyHeroMode(); });

  /* ---------- pricing buttons pre-select the form ---------- */
  const want = $('#f-want'), billSel = $('#f-bill');
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => { want.value = b.dataset.pick; }));
  $('#calc-cta').addEventListener('click', () => {
    const b = lastBill;
    billSel.value = b < 50000 ? 'Under ₹50,000' : b < 150000 ? '₹50,000 to ₹1.5 lakh' : b < 500000 ? '₹1.5 lakh to ₹5 lakh' : 'Over ₹5 lakh';
  });

  /* ---------- footer phone (filled in when the number is set) ---------- */
  const ph = $('.phone');
  if (ph && ph.dataset.phone) {
    const digits = ph.dataset.phone.replace(/\D/g, '');
    ph.innerHTML = '<a href="tel:+' + digits + '">' + ph.dataset.phone + '</a> · <a href="https://wa.me/' + digits + '">WhatsApp</a>';
  }

  /* ---------- FORM: honest handling ---------- */
  // Set to a Formspree URL (https://formspree.io/f/xxxx) to receive submissions by email.
  // Left empty, the form opens the visitor's email app addressed to both founders.
  const LEADS_ENDPOINT = '';
  const form = $('#lead'), err = $('#f-err'), done = $('#f-done');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const req = ['#f-name', '#f-email', '#f-brand'].map(s => $(s));
    let bad = null;
    req.forEach(el => { const v = el.value.trim(); const ok = v && (el.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)); el.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = el; });
    if (bad) { err.textContent = 'Please fill in your name, a valid work email and your brand name.'; err.hidden = false; bad.focus(); return; }
    err.hidden = true;
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    if (LEADS_ENDPOINT) {
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const r = await fetch(LEADS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(r.status);
        $('.done-h').textContent = 'Got it, ' + data.name.split(' ')[0] + '. We\'ll reply within 2 working days.';
        done.querySelector('p:not(.done-h)').textContent = 'Watch for an email from aryan@hudhudmessage.com.';
        done.hidden = false; done.focus();
      } catch (_) {
        err.textContent = 'That didn\'t go through. Please email us at aryan@hudhudmessage.com.'; err.hidden = false;
      } finally { btn.disabled = false; btn.textContent = 'Get my free bill check'; }
      return;
    }
    const body = Object.entries({ Name: data.name, Email: data.email, Brand: data.brand, Provider: data.provider, 'Monthly bill': data.bill, 'Interested in': data.interest, Phone: data.phone || '-' }).map(([k, v]) => k + ': ' + v).join('\n');
    location.href = 'mailto:aryan@hudhudmessage.com?cc=raghav@hudhudmessage.com&subject=' + encodeURIComponent('Free bill check: ' + data.brand) + '&body=' + encodeURIComponent(body + '\n\nI\'ll share my last WhatsApp invoice when you reply.');
    $('#f-who').textContent = data.name.split(' ')[0];
    done.hidden = false; done.focus();
  });
})();
