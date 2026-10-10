/* HudHudMessage effects layer: the living hero shader, the 3D invoice, the odometer,
   magnetic buttons and spotlight cards. Plain WebGL and vanilla JS, no libraries.
   Everything rests when off-screen, pauses on hidden tabs, and honours reduced motion. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const HH = window.HH = window.HH || {};

  /* ---------- 1. ODOMETER: rupee amounts roll like a mechanical counter ---------- */
  HH.odo = function (el, value, prefix = '₹') {
    const str = prefix + Math.round(value).toLocaleString('en-IN');
    if (el.dataset.v === str) return;
    el.dataset.v = str;
    el.setAttribute('aria-label', str);
    const chars = [...str];
    // rebuild the skeleton when the shape (length or comma positions) changes
    const shape = chars.map(c => /\d/.test(c) ? 'd' : c).join('');
    if (el.dataset.shape !== shape) {
      el.dataset.shape = shape;
      el.innerHTML = chars.map(c => /\d/.test(c)
        ? '<span class="od" aria-hidden="true"><span class="od-col">' + '0123456789'.split('').map(n => '<span>' + n + '</span>').join('') + '</span></span>'
        : '<span class="od-s" aria-hidden="true">' + c + '</span>').join('');
      void el.offsetWidth;
    }
    let i = 0;
    chars.forEach(c => { if (!/\d/.test(c)) return; const col = el.querySelectorAll('.od-col')[i++]; col.style.transform = 'translateY(' + (-+c * 10) + '%)'; });
  };

  /* ---------- 2. HEADLINE: masked character rise ---------- */
  const h1 = $('.h-hero');
  if (h1 && !h1.dataset.split) {
    h1.dataset.split = '1';
    const full = h1.textContent.replace(/\s+/g, ' ').trim();
    let ci = 0;
    h1.innerHTML = '<span class="sr">' + full + '</span>' + full.split(' ').map(word =>
      '<span class="w" aria-hidden="true">' + [...word].map(ch => '<span class="ch" style="--i:' + (ci++) + '">' + ch + '</span>').join('') + '</span>').join(' ');
  }

  /* ---------- 3. TICKER: duplicate until it is wider than any screen ---------- */
  $$('.ticker-track').forEach(t => { const base = t.innerHTML; while (t.scrollWidth < 2800) t.insertAdjacentHTML('beforeend', base); t.insertAdjacentHTML('beforeend', t.innerHTML); });

  /* ---------- 4. THE LIVING HERO: a hand-written WebGL shader ---------- */
  const canvas = $('#field');
  const hero = $('.hero');
  let gl, prog, uRes, uTime, uMouse, uHeat, raf = null, visible = true, t0 = performance.now();
  let mouse = [0.15, 0.1], mouseT = [0.15, 0.1], heat = 0, heatT = 0;
  HH.setHeat = v => { heatT = v; wake(); };

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform float heat;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y;
 float tt=t*.035;
 vec2 q=vec2(fbm(p*1.5+vec2(0.,tt)),fbm(p*1.5+vec2(5.2,-tt)));
 vec2 w=vec2(fbm(p*1.9+q*1.7+vec2(1.7,9.2)+tt*1.2),fbm(p*1.9+q*1.7+vec2(8.3,2.8)-tt));
 float f=fbm(p*1.3+w*2.1);
 vec3 night=vec3(.020,.105,.080),deep=vec3(.045,.215,.160),green=vec3(.095,.36,.25),mint=vec3(.55,.91,.72),crest=vec3(.96,.50,.17);
 vec3 col=mix(night,deep,smoothstep(.2,.7,f));
 col=mix(col,green,smoothstep(.58,.95,f)*.7);
 float c=1.-smoothstep(0.,.045,abs(fract(f*7.-tt*1.5)-.5));
 col+=mint*c*.12*smoothstep(.3,.85,f);
 float ember=pow(smoothstep(.5,1.,w.x*f*1.75),2.5);
 col+=crest*ember*heat*.6;
 col+=crest*c*.10*heat*smoothstep(.55,.9,w.y);
 float md=length(p-m);col+=mint*.07*exp(-md*md*5.);
 col*=1.-.6*pow(length(uv-vec2(.6,.48)),1.6);
 col+=(h(gl_FragCoord.xy+t)-.5)*.018;
 gl_FragColor=vec4(col,1.);
}`;

  function initGL() {
    if (!canvas) return false;
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    uRes = gl.getUniformLocation(prog, 'r'); uTime = gl.getUniformLocation(prog, 't'); uMouse = gl.getUniformLocation(prog, 'm'); uHeat = gl.getUniformLocation(prog, 'heat');
    return true;
  }
  function size() {
    const dpr = Math.min(1.5, devicePixelRatio || 1) * 0.6;          // render at reduced resolution: the field is soft by design
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  function draw(now) {
    size();
    mouse[0] += (mouseT[0] - mouse[0]) * 0.05; mouse[1] += (mouseT[1] - mouse[1]) * 0.05;
    heat += (heatT - heat) * 0.06;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.uniform1f(uHeat, heat);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const STILL = matchMedia('(max-width: 720px), (orientation: portrait) and (pointer: coarse)');
  const animated = () => !RM.matches && !STILL.matches && !document.hidden && visible;
  function loop(now) { raf = null; draw(now); if (animated()) raf = requestAnimationFrame(loop); }
  function wake() { if (gl && raf === null) raf = requestAnimationFrame(loop); }
  if (initGL()) {
    document.documentElement.classList.add('gl');
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) wake(); }).observe(hero);
    document.addEventListener('visibilitychange', wake);
    RM.addEventListener('change', wake);
    addEventListener('resize', wake);
    hero.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouseT = [(e.clientX - r.left - r.width / 2) / r.height, -(e.clientY - r.top - r.height / 2) / r.height];
      wake();
    });
    wake();
  }

  /* ---------- 5. THE 3D INVOICE: tilts toward the cursor, catches the light ---------- */
  const inv = $('.invoice'), art = $('.hero-art');
  if (inv && art) {
    let tx = 0, ty = 0, cx = 0, cy = 0, tr = null;
    const step = () => {
      cx += (tx - cx) * 0.1; cy += (ty - cy) * 0.1;
      inv.style.setProperty('--tx', cx.toFixed(3)); inv.style.setProperty('--ty', cy.toFixed(3));
      tr = (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(step) : null;
    };
    const go = () => { if (tr === null) tr = requestAnimationFrame(step); };
    hero.addEventListener('pointermove', e => {
      if (!FINE.matches || RM.matches) return;
      const r = inv.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
      go();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; go(); });
  }

  /* ---------- 6. MAGNETIC BUTTONS and SPOTLIGHT CARDS ---------- */
  $$('.btn').forEach(b => {
    b.addEventListener('pointermove', e => {
      if (!FINE.matches || RM.matches) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      b.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      b.classList.add('mag');
    });
    b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', 0); b.style.setProperty('--my', 0); });
  });
  $$('.card, .gains li, .chart, .calc-card').forEach(c => c.addEventListener('pointermove', e => {
    if (!FINE.matches) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--sx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--sy', (e.clientY - r.top) + 'px');
  }));

  /* ---------- 7. GIANT FOOTER WORDMARK: letters rise when it arrives ---------- */
  const giant = $('.giant');
  if (giant) {
    const word = giant.textContent.trim();
    giant.innerHTML = [...word].map((ch, i) => '<span style="--i:' + i + '">' + ch + '</span>').join('');
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { giant.classList.add('in'); o.disconnect(); } }, { threshold: 0.3 }).observe(giant);
  }
})();
