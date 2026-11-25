/* ==========================================================================
   GRONEWS · «La señal de Guerrero» · script.js
   Sin librerías externas. Todo el contenido es visible por defecto; el JS solo lo mejora.
   Índice: 0 Config · 1 Utilidades · 2 WhatsApp · 3 Cargador · 4 Encabezado/menú
           5 Texto (split/palabras) · 6 Reveal · 7 Contadores/ecualizador · 8 Bucle de scroll
           9 Hero (canvas, tilt, rotador) · 10 Pantalla TV · 11 Mapa · 12 Interacciones · 13 Formulario · 14 Arranque
   ========================================================================== */
(() => {
  'use strict';

  /* 0 · CONFIG -------------------------------------------------------------
     Única fuente del número de WhatsApp (formato internacional sin «+»).
     Si queda vacío: se ocultan botón flotante, enlaces y envío del formulario. */
  const WHATSAPP_NUMBER = '527449091613';

  const root = document.documentElement;
  root.classList.add('js-ready'); // le dice al CSS (y al respaldo inline) que el JS cargó

  /* 1 · UTILIDADES -------------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let vh = window.innerHeight;
  let vw = window.innerWidth;
  let docH = document.documentElement.scrollHeight;
  let dirty = true;

  /* 2 · WHATSAPP ---------------------------------------------------------- */
  function waUrl(text) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
  }
  function initWhatsApp() {
    const els = $$('[data-wa]');
    if (!WHATSAPP_NUMBER) {
      els.forEach((el) => { el.hidden = true; });
      const btn = $('#formBtn');
      if (btn) btn.hidden = true;
      return;
    }
    els.forEach((a) => {
      a.href = waUrl(a.dataset.wa);
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* 3 · CARGADOR (el cronograma completo también está en CSS) -------------- */
  function initLoader() {
    const countEl = $('#loaderCount');
    const t0 = performance.now();
    const D = 1500;
    (function step(now) {
      const t = clamp((now - t0) / D);
      if (countEl) countEl.textContent = pad(Math.round(smooth(t) * 100));
      if (t < 1) requestAnimationFrame(step);
    })(t0);
    setTimeout(() => root.classList.add('is-ready'), 1700);
    setTimeout(() => { if (!root.classList.contains('is-ready')) root.classList.add('is-ready'); }, 3000);
    setTimeout(() => { const l = $('#loader'); if (l) l.style.display = 'none'; }, 2600);
  }

  /* 4 · ENCABEZADO Y MENÚ MÓVIL ------------------------------------------- */
  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;
    const set = (open) => {
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      root.classList.toggle('menu-open', open);
    };
    burger.addEventListener('click', () => set(!menu.classList.contains('is-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a') || e.target === menu) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1024) set(false); });
  }

  /* 5 · TEXTO: letras del H1 y palabras del manifiesto -------------------- */
  function splitChars(el) {
    const text = el.textContent.trim();
    let n = 0;
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    text.split(' ').forEach((word, wi, arr) => {
      const w = document.createElement('span');
      w.className = 'word';
      Array.from(word).forEach((c) => {
        const cm = document.createElement('span');
        cm.className = 'cm';
        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.style.setProperty('--i', n++);
        ch.textContent = c;
        cm.appendChild(ch);
        w.appendChild(cm);
      });
      wrap.appendChild(w);
      if (wi < arr.length - 1) wrap.appendChild(document.createTextNode(' '));
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(wrap);
  }

  function wrapWords(p) {
    const words = [];
    const walk = (node, key) => {
      const out = document.createDocumentFragment();
      node.childNodes.forEach((ch) => {
        if (ch.nodeType === 3) {
          ch.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { out.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'w' + (key ? ' key' : '');
            s.textContent = tok;
            out.appendChild(s);
            words.push(s);
          });
        } else if (ch.nodeType === 1) {
          out.appendChild(walk(ch, key || ch.classList.contains('key')));
        }
      });
      return out;
    };
    const frag = walk(p, false);
    p.textContent = '';
    p.appendChild(frag);
    return words;
  }

  /* 6 · REVEAL con IntersectionObserver + respaldo por geometría ---------- */
  const pending = new Set();
  let io = null;

  function reveal(el) {
    if (el.classList.contains('is-in')) return;
    el.classList.add('is-in');
    pending.delete(el);
    if (io) io.unobserve(el);
    $$('[data-count]', el).forEach(startCount);
    if (el.matches('[data-count]')) startCount(el);
  }
  function geoReveal() {
    if (!pending.size) return;
    const h = window.innerHeight;
    pending.forEach((el) => {
      const r = el.getBoundingClientRect();
      if ((r.width || r.height) && r.bottom > 0 && r.top < h * 0.94) reveal(el);
    });
  }
  function initReveal() {
    const els = $$('[data-reveal], .mask, .wordmark');
    els.forEach((e) => pending.add(e));
    if (reduce) { els.forEach(reveal); return; }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) reveal(en.target); });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      els.forEach((e) => io.observe(e));
    }
    geoReveal();
    setTimeout(geoReveal, 2000);
    setTimeout(geoReveal, 4000);
    window.addEventListener('load', () => setTimeout(geoReveal, 300));
  }

  /* 7 · CONTADORES Y ECUALIZADOR ------------------------------------------ */
  function startCount(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.from || 0);
    if (reduce) { el.textContent = String(to); return; }
    const D = 1600;
    el.textContent = String(from);
    requestAnimationFrame((t0) => {
      (function step(now) {
        const t = clamp((now - t0) / D);
        const e = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
        el.textContent = String(Math.round(lerp(from, to, e)));
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  function initEqualizer() {
    $$('[data-eq]').forEach((box) => {
      const n = Number(box.dataset.eq) || 24;
      for (let i = 0; i < n; i++) {
        const b = document.createElement('i');
        b.style.setProperty('--h', (0.25 + Math.random() * 0.75).toFixed(2));
        b.style.setProperty('--s', (0.8 + Math.random() * 1.1).toFixed(2) + 's');
        b.style.setProperty('--o', (-Math.random() * 2).toFixed(2) + 's');
        box.appendChild(b);
      }
    });
  }

  /* 8 · BUCLE ÚNICO DE SCROLL --------------------------------------------- */
  const header = $('#header');
  const progressBar = $('#progressBar');
  const railTime = $('#railTime');
  const railItems = $$('.rail__list li');
  const navLinks = $$('.nav a');
  const waFloat = $('#waFloat');
  const hero = $('#inicio');
  const manifest = $('#manifiesto');
  const screenEl = $('#senal');
  const cover = $('#cobertura');
  const track = $('#coverTrack');
  const timeline = $('#timeline');
  const wordmark = $('#wordmark');
  const footer = $('#pie');
  const coverNow = $('#coverNow');
  const coverBar = $('#coverBar');
  const slides = $$('.slide');
  const stepNodes = $$('.step__node');
  const secIds = ['inicio', 'manifiesto', 'cifras', 'cobertura', 'senal', 'mapa', 'proceso', 'alianzas', 'facebook', 'contacto'];
  const secEls = secIds.map((id) => document.getElementById(id));
  const progEls = $$('[data-prog]').map((el) => ({ el, mode: el.dataset.prog, p: -1 }));
  let words = [];
  let litCount = -1;
  let coverOn = false;
  let maxX = 0;
  let activeSec = -1;
  let tickerAnims = [];
  let rate = 1;
  let appliedRate = 1;
  let lastY = -1;

  function calcP(s) {
    const r = s.el.getBoundingClientRect();
    if (s.mode === 'sticky') return clamp(-r.top / Math.max(1, r.height - vh));
    if (s.mode === 'line') return clamp((vh * 0.55 - r.top) / Math.max(1, r.height));
    return clamp((vh - r.top) / (r.height * 0.7 + vh * 0.3));
  }

  function setupCover() {
    if (!cover || !track) return;
    const want = window.innerWidth >= 1024 && !reduce;
    cover.classList.toggle('is-pinned', want);
    coverOn = want;
    track.style.transform = '';
    slides.forEach((s) => s.style.removeProperty('--ry'));
    cover.style.removeProperty('--pin-h');
    if (want) {
      maxX = Math.max(0, track.scrollWidth - window.innerWidth);
      cover.style.setProperty('--pin-h', Math.round(maxX + window.innerHeight * 1.1) + 'px');
    }
  }

  function measure() {
    vh = window.innerHeight;
    vw = window.innerWidth;
    setupCover();
    docH = document.documentElement.scrollHeight;
    dirty = true;
  }

  function updateCover() {
    if (!coverOn) return;
    const r = cover.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, cover.offsetHeight - vh));
    track.style.transform = 'translate3d(' + (-p * maxX).toFixed(1) + 'px,0,0)';
    slides.forEach((s) => {
      const left = s.getBoundingClientRect().left;
      const k = clamp((left - vw * 0.6) / (vw * 0.4));
      s.style.setProperty('--ry', (-14 * k).toFixed(2) + 'deg');
    });
    const idx = Math.round(p * (slides.length - 1)) + 1;
    if (coverNow) coverNow.textContent = pad(idx);
    if (coverBar) coverBar.style.transform = 'scaleX(' + (0.2 + 0.8 * p).toFixed(3) + ')';
  }

  function onProg(s, p) {
    if (s.el === manifest) {
      const lit = Math.round(clamp(p / 0.82) * words.length);
      if (lit !== litCount) {
        litCount = lit;
        words.forEach((w, i) => w.classList.toggle('on', i < lit));
      }
      manifest.classList.toggle('is-end', p > 0.88);
    } else if (s.el === screenEl) {
      const t = smooth(clamp(p / 0.7));
      screenEl.style.setProperty('--t', t.toFixed(4));
      screenEl.classList.toggle('is-lower', p > 0.55);
      screenEl.classList.toggle('is-final', p > 0.85);
    } else if (s.el === timeline) {
      const r = timeline.getBoundingClientRect();
      const front = r.top + p * r.height;
      stepNodes.forEach((n) => {
        const nr = n.getBoundingClientRect();
        n.classList.toggle('is-lit', nr.top + nr.height / 2 <= front);
      });
    }
  }

  function update(y, moved) {
    // Barra de progreso, timecode del riel
    const pageP = clamp(y / Math.max(1, docH - vh));
    if (progressBar) progressBar.style.transform = 'scaleX(' + pageP.toFixed(4) + ')';
    if (railTime) {
      const sec = Math.round(pageP * 720);
      railTime.textContent = '00:' + pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
    }
    if (header) header.classList.toggle('is-small', y > 80);
    if (waFloat) waFloat.classList.toggle('is-visible', y > (hero ? hero.offsetHeight * 0.8 : 400));

    // Progreso por sección → variable CSS --p
    if (!reduce) {
      progEls.forEach((s) => {
        const p = calcP(s);
        if (Math.abs(p - s.p) > 0.0004 || s.p < 0) {
          s.p = p;
          s.el.style.setProperty('--p', p.toFixed(4));
          onProg(s, p);
        }
      });
      updateCover();
    }

    // Sección activa (riel y menú)
    let active = 0;
    secEls.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= vh * 0.45) active = i; });
    if (active !== activeSec) {
      activeSec = active;
      railItems.forEach((li, i) => li.classList.toggle('is-active', i === active));
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + secIds[active]));
    }

    // Brillo del wordmark según el scroll del pie
    if (footer && wordmark) {
      const r = footer.getBoundingClientRect();
      const p = clamp((vh - r.top) / (r.height + vh * 0.2));
      wordmark.style.setProperty('--sh', (p * 150 - 20).toFixed(1));
    }

    if (moved) geoReveal();
  }

  function frame(now) {
    const y = window.scrollY;
    const moved = y !== lastY;
    // Velocidad del ticker según la velocidad del scroll (tope 4×)
    if (tickerAnims.length && !reduce) {
      const dv = lastY < 0 ? 0 : Math.abs(y - lastY);
      const target = 1 + Math.min(3, dv / 10);
      rate += (target - rate) * 0.08;
      if (Math.abs(rate - appliedRate) > 0.02) {
        appliedRate = rate;
        tickerAnims.forEach((a) => { try { a.playbackRate = rate; } catch (e) { /* sin soporte */ } });
      }
    }
    if (moved || dirty) update(y, moved);
    lastY = y;
    dirty = false;
    stepTilt();
    stepTv(now);
    requestAnimationFrame(frame);
  }

  /* 9 · HERO: tilt 3D, red de señal, rotador, timecode -------------------- */
  const stageInner = $('#stageInner');
  let tgtRX = 0, tgtRY = 0, curRX = 0, curRY = 0;

  function initTilt() {
    if (!stageInner || reduce || !hero) return;
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const r = hero.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        tgtRY = nx * 10;
        tgtRX = -ny * 10;
      });
      hero.addEventListener('pointerleave', () => { tgtRX = 0; tgtRY = 0; });
    } else if ('DeviceOrientationEvent' in window && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null || e.beta == null) return;
        tgtRY = clamp(e.gamma, -30, 30) / 3;
        tgtRX = -clamp(e.beta - 45, -30, 30) / 3;
      });
    }
  }
  function stepTilt() {
    if (!stageInner || reduce) return;
    curRX = lerp(curRX, tgtRX, 0.08);
    curRY = lerp(curRY, tgtRY, 0.08);
    if (Math.abs(curRX - tgtRX) > 0.01 || Math.abs(curRY - tgtRY) > 0.01) {
      stageInner.style.transform = 'rotateX(' + curRX.toFixed(2) + 'deg) rotateY(' + curRY.toFixed(2) + 'deg)';
    }
  }

  function initNet() {
    const c = $('#net');
    if (!c || !hero) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const LINK = 130;
    const PTR = 150;
    let W = 1, H = 1, dpr = 1;
    let nodes = [];
    let packets = [];
    let edges = [];
    const pointer = { x: -999, y: -999, on: false };
    let running = false;
    let inView = true;
    let last = 0;

    const mk = () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: 1.3 + Math.random() * 1.2 });

    function resize() {
      W = Math.max(1, hero.clientWidth);
      H = Math.max(1, hero.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp(W / 18, 28, 90));
      while (nodes.length < n) nodes.push(mk());
      nodes.length = n;
      nodes.forEach((p) => { p.x = clamp(p.x, 0, W); p.y = clamp(p.y, 0, H); });
      const want = W < 700 ? 6 : 8;
      while (packets.length < want) packets.push({ a: -1, b: -1, t: 1, sp: 0.01 });
      packets.length = want;
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      edges = [];
      // movimiento
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (pointer.on) {
          const dx = pointer.x - p.x, dy = pointer.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < PTR && d > 1) { p.vx += (dx / d) * 0.012 * dt; p.vy += (dy / d) * 0.012 * dt; }
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 0.7) { p.vx *= 0.7 / sp; p.vy *= 0.7 / sp; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
      // líneas
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.strokeStyle = 'rgba(62,193,255,' + ((1 - d / LINK) * 0.38).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
            edges.push(i, j);
          }
        }
        if (pointer.on) {
          const d = Math.hypot(pointer.x - nodes[i].x, pointer.y - nodes[i].y);
          if (d < PTR) {
            ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - d / PTR) * 0.5).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
          }
        }
      }
      // nodos
      ctx.fillStyle = 'rgba(159,220,255,.85)';
      for (let i = 0; i < nodes.length; i++) {
        ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r, 0, 6.2832); ctx.fill();
      }
      // paquetes que viajan por las aristas
      packets.forEach((k) => {
        if (k.t >= 1 || !nodes[k.a] || !nodes[k.b]) {
          if (edges.length >= 2) {
            const e = Math.floor(Math.random() * (edges.length / 2)) * 2;
            k.a = edges[e]; k.b = edges[e + 1]; k.t = 0; k.sp = 0.006 + Math.random() * 0.008;
          } else { return; }
        }
        k.t += k.sp * dt;
        const A = nodes[k.a], B = nodes[k.b];
        if (!A || !B) return;
        const x = lerp(A.x, B.x, clamp(k.t)), y = lerp(A.y, B.y, clamp(k.t));
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(62,193,255,.95)');
        g.addColorStop(1, 'rgba(62,193,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.2832); ctx.fill();
      });
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(2.5, (now - last) / 16.67);
      last = now;
      draw(dt);
      requestAnimationFrame(loop);
    }
    function sync() {
      const want = inView && !document.hidden && !reduce;
      if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
      else if (!want) running = false;
    }

    resize();
    draw(1);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); draw(0); }, 150); });
    if (!reduce) {
      hero.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const r = c.getBoundingClientRect();
        pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = true;
      });
      hero.addEventListener('pointerleave', () => { pointer.on = false; });
      document.addEventListener('visibilitychange', sync);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((en) => { inView = en[0].isIntersecting; sync(); }).observe(hero);
      }
      sync();
    }
  }

  function initRotator() {
    const el = $('#rotWord');
    if (!el || reduce) return;
    const list = ['Acapulco', 'Guerrero', 'Tu colonia', 'Tu comunidad', 'Tu historia'];
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      el.classList.add('is-out');
      setTimeout(() => {
        i = (i + 1) % list.length;
        el.textContent = list[i];
        el.classList.remove('is-out');
        el.classList.add('is-pre');
        void el.offsetWidth; // fuerza el reflujo para que la transición arranque
        el.classList.remove('is-pre');
      }, 430);
    }, 2600);
  }

  function initChipTimecode() {
    const el = $('#chipTc');
    if (!el) return;
    const t0 = Date.now();
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      el.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* 10 · PANTALLA TV: timecode con cuadros y tercio inferior --------------- */
  const tvTc = $('#tvTc');
  let tvVisible = false;
  let tvLast = '';
  function initTv() {
    if (!screenEl) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { tvVisible = en[0].isIntersecting; }).observe(screenEl);
    }
    const line = $('#lowerLine');
    if (line && !reduce) {
      const list = ['Con la gente', 'Con contexto', 'A tiempo', 'Desde Acapulco'];
      let i = 0;
      setInterval(() => {
        if (document.hidden || !tvVisible) return;
        line.classList.add('is-swap');
        setTimeout(() => { i = (i + 1) % list.length; line.textContent = list[i]; line.classList.remove('is-swap'); }, 360);
      }, 2500);
    }
  }
  function stepTv(now) {
    if (!tvTc || !tvVisible || reduce) return;
    const total = Math.floor(now / 40); // 25 cuadros por segundo
    const ff = total % 25;
    const s = Math.floor(total / 25);
    const txt = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + ':' + pad(ff);
    if (txt !== tvLast) { tvLast = txt; tvTc.textContent = txt; }
  }

  /* 11 · MAPA: chips ↔ nodos ---------------------------------------------- */
  function initMap() {
    const nodes = {};
    $$('.node').forEach((n) => { nodes[n.dataset.node] = n; });
    const btns = $$('.chips button');
    let hover = null;
    let pinned = null;
    const refresh = () => {
      Object.keys(nodes).forEach((k) => nodes[k].classList.toggle('is-lit', k === hover || k === pinned));
      btns.forEach((b) => b.classList.toggle('is-on', b.dataset.node === hover || b.dataset.node === pinned));
    };
    btns.forEach((b) => {
      const k = b.dataset.node;
      b.addEventListener('mouseenter', () => { hover = k; refresh(); });
      b.addEventListener('mouseleave', () => { hover = null; refresh(); });
      b.addEventListener('focus', () => { hover = k; refresh(); });
      b.addEventListener('blur', () => { hover = null; refresh(); });
      b.addEventListener('click', () => { pinned = pinned === k ? null : k; refresh(); });
    });
    Object.keys(nodes).forEach((k) => {
      nodes[k].addEventListener('mouseenter', () => { hover = k; refresh(); });
      nodes[k].addEventListener('mouseleave', () => { hover = null; refresh(); });
      nodes[k].addEventListener('click', () => { pinned = pinned === k ? null : k; refresh(); });
    });
  }

  /* 12 · INTERACCIONES: foco de cursor, botones magnéticos, tilt, ticker ---- */
  function initInteractions() {
    if (finePointer && !reduce) {
      $$('.dark').forEach((sec) => {
        sec.addEventListener('pointerenter', () => sec.classList.add('has-pointer'));
        sec.addEventListener('pointerleave', () => sec.classList.remove('has-pointer'));
        sec.addEventListener('pointermove', (e) => {
          const r = sec.getBoundingClientRect();
          sec.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          sec.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
      $$('[data-magnetic]').forEach((b) => {
        b.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = b.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
          const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
          b.style.translate = (x * 6).toFixed(1) + 'px ' + (y * 6).toFixed(1) + 'px';
        });
        b.addEventListener('pointerleave', () => { b.style.translate = ''; });
      });
      $$('[data-tilt]').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
        });
        el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
      });
    }
    // Animaciones CSS del ticker (para acelerarlas con el scroll)
    if (!reduce) {
      tickerAnims = $$('.ticker__track').map((t) => (t.getAnimations ? t.getAnimations()[0] : null)).filter(Boolean);
    }
  }

  function initWaTip() {
    if (!waFloat || !WHATSAPP_NUMBER) return;
    setTimeout(() => {
      waFloat.classList.add('show-tip');
      setTimeout(() => waFloat.classList.remove('show-tip'), 5000);
    }, 6000);
  }

  /* 13 · FORMULARIO → WHATSAPP -------------------------------------------- */
  function initForm() {
    const form = $('#form');
    if (!form) return;
    const nombre = $('#f-nombre');
    const motivo = $('#f-motivo');
    const mensaje = $('#f-mensaje');
    const btn = $('#formBtn');
    const label = btn ? $('.btn__label', btn) : null;
    const original = label ? label.textContent : '';
    const setErr = (input, id, msg) => {
      const box = document.getElementById(id);
      if (box) box.textContent = msg;
      input.closest('.field').classList.toggle('is-error', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    [nombre, mensaje].forEach((inp) => inp.addEventListener('input', () => {
      setErr(inp, inp === nombre ? 'err-nombre' : 'err-mensaje', '');
    }));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = nombre.value.trim();
      const m = mensaje.value.trim();
      let first = null;
      if (n.length < 2) { setErr(nombre, 'err-nombre', 'Dinos tu nombre para saber con quién hablamos.'); first = first || nombre; } else setErr(nombre, 'err-nombre', '');
      if (m.length < 5) { setErr(mensaje, 'err-mensaje', 'Cuéntanos en pocas palabras qué quieres compartir.'); first = first || mensaje; } else setErr(mensaje, 'err-mensaje', '');
      if (first) { first.focus(); return; }
      if (!WHATSAPP_NUMBER) return;

      const text = 'Hola Gronews, soy ' + n + '. ' + motivo.value + '. ' + m;
      if (btn && label) {
        label.textContent = '¡Listo! Abriendo WhatsApp…';
        if (!$('.check', btn)) {
          btn.insertAdjacentHTML('afterbegin', '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>');
        }
        btn.classList.add('is-sent');
      }
      const a = document.createElement('a');
      a.href = waUrl(text);
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        if (btn && label) { label.textContent = original; btn.classList.remove('is-sent'); }
        form.reset();
      }, 4500);
    });
  }

  /* 14 · ARRANQUE --------------------------------------------------------- */
  function init() {
    initWhatsApp();
    initLoader();
    initMenu();

    const line1 = $('[data-split]');
    if (line1) splitChars(line1);

    const mp = $('[data-words]');
    if (mp) words = wrapWords(mp);
    if (reduce) {
      words.forEach((w) => w.classList.add('on'));
      if (manifest) manifest.classList.add('is-end');
      if (screenEl) { screenEl.style.setProperty('--t', '1'); screenEl.classList.add('is-lower', 'is-final'); }
      stepNodes.forEach((n) => n.classList.add('is-lit'));
    }

    initEqualizer();
    initReveal();
    initTilt();
    initNet();
    initRotator();
    initChipTimecode();
    initTv();
    initMap();
    initInteractions();
    initForm();
    initWaTip();

    measure();
    window.addEventListener('resize', () => { measure(); geoReveal(); }, { passive: true });
    window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
    window.addEventListener('load', () => { measure(); setTimeout(measure, 800); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
