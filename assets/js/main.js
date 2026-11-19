/* SurvivedAI landing page: small progressive enhancements. No dependencies.
 * Everything here is optional: without JS the page renders complete
 * (the phone demo shows its finished, offline answer). */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const settleHooks = [];
  // Used by tools/shoot.cjs to put every animated piece in its final state.
  window.__settle = () => settleHooks.forEach((fn) => fn());

  /* ---------------------------------------------------------------------
   * Header: solid background once the page has scrolled.
   * ------------------------------------------------------------------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------------
   * Embers drifting up through the hero still (canvas 2D, warm sprites).
   * ------------------------------------------------------------------- */
  const canvas = document.getElementById('embers');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d', { alpha: true });
    const host = canvas.parentElement;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = true;
    const particles = [];
    const palette = [[255, 214, 150], [255, 170, 90], [250, 120, 60], [240, 68, 36]];
    const sprites = palette.map(([r, g, b]) => {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const c = s.getContext('2d');
      const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,245,225,1)');
      grd.addColorStop(0.18, `rgba(${r},${g},${b},0.95)`);
      grd.addColorStop(0.45, `rgba(${r},${g},${b},0.28)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grd;
      c.fillRect(0, 0, 64, 64);
      return s;
    });
    const rand = (a, b) => a + Math.random() * (b - a);

    function measure() {
      const r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    function spawn(p, initial) {
      // Most embers rise off the glowing bot (left-centre of the still), the rest drift up from below.
      if (Math.random() < 0.6) {
        p.x = w * rand(0.08, 0.5);
        p.y = h * rand(0.35, 0.7);
        p.vy = rand(-60, -22);
        p.size = rand(1, 3.2);
      } else {
        p.x = rand(0, w);
        p.y = h + rand(0, 40);
        p.vy = rand(-48, -16);
        p.size = rand(0.8, 2.2);
      }
      p.vx = rand(-8, 12);
      p.life = 0;
      p.maxLife = rand(2.4, 6.5);
      p.phase = rand(0, Math.PI * 2);
      p.sway = rand(6, 24);
      p.sprite = sprites[(Math.random() * sprites.length) | 0];
      if (initial) { p.life = rand(0, p.maxLife); p.y += p.vy * p.life; }
      return p;
    }
    function populate() {
      const n = Math.max(30, Math.min(110, Math.round((w * h) / 9000)));
      particles.length = 0;
      for (let i = 0; i < n; i++) particles.push(spawn({}, true));
    }
    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        if (dt) {
          p.life += dt;
          if (p.life > p.maxLife || p.y < -20) { spawn(p, false); continue; }
          p.phase += dt * 1.6;
          p.x += (p.vx + Math.sin(p.phase) * p.sway) * dt;
          p.y += p.vy * dt;
        }
        const t = p.life / p.maxLife;
        ctx.globalAlpha = Math.min(1, t * 5) * (1 - t) * (1 - t) * 0.9;
        const s = p.size * 6 * (1 - t * 0.5);
        ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      cancelAnimationFrame(raf);
      if (reduceMotion.matches || !visible || document.hidden) { draw(0); return; }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    measure(); populate(); start();
    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { measure(); populate(); start(); }, 150);
    }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(host);
    }
    document.addEventListener('visibilitychange', start);
    reduceMotion.addEventListener?.('change', start);
  }

  /* ---------------------------------------------------------------------
   * Hero: rotating situation (word + matching still, crossfaded in sync).
   * Only the first still loads up front; the rest load after window load.
   * Reduced motion: stays on the first situation.
   * ------------------------------------------------------------------- */
  const shots = [...document.querySelectorAll('.hero__shot')];
  const rotWords = [...document.querySelectorAll('.rot__word')];
  const rotBars = document.getElementById('rot-bars');
  if (shots.length > 1 && rotWords.length === shots.length) {
    const HOLD = 2800;
    const bars = rotBars ? [...rotBars.children] : [];
    let idx = 0, timer = 0, heroVisible = true, loaded = false, frozen = false;

    const ready = (i) => {
      const img = shots[i].querySelector('img');
      return img && img.currentSrc && img.complete && img.naturalWidth > 0;
    };
    function loadRest() {
      if (loaded) return;
      loaded = true;
      shots.slice(1).forEach((pic) => {
        pic.querySelectorAll('[data-srcset]').forEach((el) => { el.srcset = el.dataset.srcset; delete el.dataset.srcset; });
        const img = pic.querySelector('img');
        if (img && img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
      });
    }
    function show(i, animateBar = true) {
      const prev = idx;
      idx = i;
      shots.forEach((s, k) => s.classList.toggle('is-on', k === i));
      rotWords.forEach((w, k) => {
        w.classList.toggle('is-on', k === i);
        w.classList.toggle('is-out', k === prev && k !== i);
      });
      bars.forEach((b, k) => {
        b.classList.remove('is-on');
        b.classList.toggle('is-done', k < i);
      });
      if (bars[i]) {
        rotBars.classList.toggle('is-static', !animateBar);
        void bars[i].offsetWidth; // restart the progress fill
        bars[i].classList.add('is-on');
      }
    }
    function tick() {
      const next = (idx + 1) % shots.length;
      if (ready(next)) show(next);
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (frozen || reduceMotion.matches || !heroVisible || document.hidden) return;
      timer = setTimeout(tick, HOLD);
    }
    if (rotBars) rotBars.style.setProperty('--rot-ms', `${HOLD}ms`);

    if (reduceMotion.matches) {
      show(0, false);
    } else {
      const begin = () => { loadRest(); show(0); schedule(); };
      if (document.readyState === 'complete') begin();
      else window.addEventListener('load', begin, { once: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; schedule(); })
          .observe(document.querySelector('.hero'));
      }
      document.addEventListener('visibilitychange', schedule);
    }
    reduceMotion.addEventListener?.('change', () => { if (reduceMotion.matches) { clearTimeout(timer); show(0, false); } else schedule(); });

    // Screenshot hooks (tools/shoot.cjs): jump to a situation and hold it.
    window.__hero = async (i) => {
      loadRest();
      clearTimeout(timer);
      frozen = true;
      const img = shots[i].querySelector('img');
      if (img && !img.complete) await new Promise((r) => img.addEventListener('load', r, { once: true }));
      show(i, false);
    };
    settleHooks.push(() => { frozen = true; clearTimeout(timer); show(0, false); });
  }

  /* ---------------------------------------------------------------------
   * Live phone demo: download -> airplane mode -> ask -> answer streams in.
   * Starts when the phone scrolls into view. Reduced motion: final state.
   * ------------------------------------------------------------------- */
  const phone = document.getElementById('phone');
  const textEl = document.getElementById('answer-text');
  const typedEl = document.getElementById('composer-typed');
  const steps = [...document.querySelectorAll('#demo-steps .step')];
  const replay = document.getElementById('demo-replay');
  if (phone && textEl && typedEl) {
    const question = phone.querySelector('.chat__user').textContent.trim();

    // Wrap each word of the answer in a span so it can stream in without reflow.
    const words = [];
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.textContent.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = part;
        words.push(s);
        frag.appendChild(s);
      }
      node.replaceWith(frag);
    }

    let timers = [];
    let running = false;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    function setStep(n, ms) {
      steps.forEach((li, i) => {
        li.classList.toggle('is-active', i + 1 === n);
        li.classList.toggle('is-done', i + 1 < n || n === 4);
        if (ms) li.style.setProperty('--step-ms', `${ms}ms`);
      });
    }
    function finish() {
      clear();
      running = false;
      phone.dataset.net = 'off';
      phone.dataset.state = 'done';
      typedEl.textContent = '';
      words.forEach((wd) => wd.classList.add('on'));
      setStep(4);
      replay?.classList.remove('is-hidden');
    }
    function play() {
      if (reduceMotion.matches) { finish(); return; }
      clear();
      running = true;
      replay?.classList.add('is-hidden');
      words.forEach((wd) => wd.classList.remove('on'));
      typedEl.textContent = '';

      // 1. Online, model downloaded.
      phone.dataset.net = 'on';
      phone.dataset.state = 'online';
      setStep(1, 1300);
      // 2. Airplane mode.
      later(() => {
        phone.dataset.net = 'off';
        phone.dataset.state = 'offline';
        setStep(2, 1200);
      }, 1400);
      // 3. Type the question into the composer.
      later(() => {
        phone.dataset.state = 'asking';
        setStep(3, question.length * 22 + 1050 + words.length * 68);
        let i = 0;
        const typeQ = () => {
          typedEl.textContent = question.slice(0, ++i);
          if (i < question.length) later(typeQ, 22);
          else later(send, 350);
        };
        typeQ();
      }, 2700);
      // 4. Send, think, then stream the answer word by word.
      function send() {
        typedEl.textContent = '';
        phone.dataset.state = 'thinking';
        later(() => {
          phone.dataset.state = 'answering';
          let k = 0;
          const next = () => {
            words[k++]?.classList.add('on');
            if (k < words.length) later(next, 55 + Math.random() * 40);
            else later(finish, 400);
          };
          next();
        }, 700);
      }
    }

    settleHooks.push(finish);
    replay?.addEventListener('click', play);
    reduceMotion.addEventListener?.('change', () => { if (reduceMotion.matches) finish(); });

    if (!reduceMotion.matches && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !running) {
          io.disconnect();
          play();
        }
      }, { threshold: 0.55 });
      io.observe(phone);
    } else {
      finish();
    }
  }

  /* ---------------------------------------------------------------------
   * Shorts reel: prev/next buttons (the reel also scrolls natively).
   * ------------------------------------------------------------------- */
  const reel = document.getElementById('reel');
  if (reel) {
    const btns = document.querySelectorAll('.reel__btn');
    const update = () => {
      const max = reel.scrollWidth - reel.clientWidth - 2;
      btns.forEach((b) => {
        b.disabled = b.dataset.dir === '-1' ? reel.scrollLeft <= 2 : reel.scrollLeft >= max;
      });
    };
    btns.forEach((b) => b.addEventListener('click', () => {
      const card = reel.querySelector('.clip');
      const step = card ? card.getBoundingClientRect().width + 18 : 300;
      reel.scrollBy({ left: Number(b.dataset.dir) * step * 2, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }));
    reel.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------
   * Close the mobile menu popover after choosing a link.
   * ------------------------------------------------------------------- */
  const menu = document.getElementById('mobile-menu');
  if (menu && typeof menu.hidePopover === 'function') {
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.hidePopover(); });
  }

  /* ---------------------------------------------------------------------
   * WAITLIST (placeholder). When a waitlist form exists, wire it here, e.g.:
   * const form = document.getElementById('waitlist');
   * form?.addEventListener('submit', async (e) => {
   *   e.preventDefault();
   *   const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
   *   form.dataset.state = res.ok ? 'done' : 'error';
   * });
   * ------------------------------------------------------------------- */
})();
