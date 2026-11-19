/* SurvivedAI landing page: small progressive enhancements. No dependencies. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
   * Ember particles around the hero flame (canvas 2D).
   * The flame mark itself is never transformed; embers rise around it.
   * ------------------------------------------------------------------- */
  const canvas = document.getElementById('embers');
  const flame = document.getElementById('hero-flame');
  if (canvas && flame && canvas.getContext) {
    const ctx = canvas.getContext('2d', { alpha: true });
    const hero = canvas.parentElement;
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, visible = true;
    let emitter = { x: 0, y: 0, w: 0, h: 0 };
    const particles = [];

    // Pre-rendered glow sprites (warm palette, from hot amber to flame orange).
    const palette = [
      [255, 214, 150], [255, 170, 90], [250, 120, 60], [240, 68, 36],
    ];
    const sprites = palette.map(([r, g, b]) => {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const c = s.getContext('2d');
      const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, `rgba(255,245,225,1)`);
      grd.addColorStop(0.18, `rgba(${r},${g},${b},0.95)`);
      grd.addColorStop(0.45, `rgba(${r},${g},${b},0.28)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grd;
      c.fillRect(0, 0, 64, 64);
      return s;
    });

    const rand = (a, b) => a + Math.random() * (b - a);

    function measure() {
      const rect = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const f = flame.getBoundingClientRect();
      emitter = { x: f.left - rect.left, y: f.top - rect.top, w: f.width, h: f.height };
    }

    function spawn(p, initial) {
      const fromFlame = Math.random() < 0.72;
      if (fromFlame) {
        // Emit from the flame's upper/middle body, biased toward its center.
        p.x = emitter.x + emitter.w * (0.5 + (Math.random() + Math.random() - 1) * 0.42);
        p.y = emitter.y + emitter.h * rand(0.15, 0.75);
        p.vy = rand(-70, -26);
        p.size = rand(1.2, 3.6);
      } else {
        // Ambient embers drifting up from the bottom of the hero.
        p.x = rand(0, w);
        p.y = h + rand(0, 40);
        p.vy = rand(-50, -18);
        p.size = rand(0.8, 2.4);
      }
      p.vx = rand(-10, 10);
      p.life = 0;
      p.maxLife = rand(2.4, 6.5);
      p.phase = rand(0, Math.PI * 2);
      p.sway = rand(6, 26);
      p.sprite = sprites[(Math.random() * sprites.length) | 0];
      if (initial) {
        p.life = rand(0, p.maxLife);
        p.y += p.vy * p.life;
      }
      return p;
    }

    function count() {
      const area = w * h;
      return Math.max(40, Math.min(170, Math.round(area / 9000)));
    }

    function populate() {
      const n = count();
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
        const alpha = Math.min(1, t * 5) * (1 - t) * (1 - t);
        const s = p.size * 6 * (1 - t * 0.5);
        ctx.globalAlpha = alpha;
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
      if (reduceMotion.matches || !visible || document.hidden) {
        draw(0); // static fallback: one still frame of embers
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    measure();
    populate();
    start();
    // Re-measure once the hero entrance animation has settled.
    setTimeout(measure, 1600);

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { measure(); populate(); start(); }, 150);
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        start();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', start);
    reduceMotion.addEventListener?.('change', start);
  }

  /* ---------------------------------------------------------------------
   * "Airplane mode" toggle in the hero (uses View Transitions when present).
   * ------------------------------------------------------------------- */
  const toggle = document.getElementById('net-toggle');
  const visual = document.querySelector('.hero__visual');
  if (toggle && visual) {
    toggle.addEventListener('click', () => {
      const airplane = toggle.getAttribute('aria-pressed') !== 'true';
      const apply = () => {
        toggle.setAttribute('aria-pressed', String(airplane));
        visual.dataset.network = airplane ? 'off' : 'on';
      };
      if (document.startViewTransition && !reduceMotion.matches) {
        document.startViewTransition(apply);
      } else {
        apply();
      }
    });
  }

  /* ---------------------------------------------------------------------
   * Close the mobile menu popover after choosing a link.
   * ------------------------------------------------------------------- */
  const menu = document.getElementById('mobile-menu');
  if (menu && typeof menu.hidePopover === 'function') {
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) menu.hidePopover();
    });
  }

  /* ---------------------------------------------------------------------
   * WAITLIST (placeholder). When the waitlist form is added to index.html
   * (see the WAITLIST FORM PLACEHOLDER comment), wire submission here, e.g.:
   *
   * const form = document.getElementById('waitlist');
   * form?.addEventListener('submit', async (e) => {
   *   e.preventDefault();
   *   const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
   *   form.dataset.state = res.ok ? 'done' : 'error';
   * });
   * ------------------------------------------------------------------- */
})();
