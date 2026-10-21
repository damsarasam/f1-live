// Wind-tunnel smoke: particles advected through a potential-flow field
// (uniform stream plus one doublet per body), released from a smoke rake.

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * bodies: [{ x, y, a, b }] in CSS pixels; a and b are the body's semi-axes.
 * Returns { el, resize(bodies), destroy() }.
 */
export function smokeTunnel({ lane = 24, speed = 1.5, density = 1, smokeAlpha = 0.6, lineAlpha = 0.13, runFor = Infinity, settledAlpha = lineAlpha, delay = 0 } = {}) {
  // Two layers: faint static streamlines underneath, fading smoke on top
  const root = document.createElement("div");
  root.className = "wt-canvas";
  root.setAttribute("aria-hidden", "true");
  const baseCanvas = document.createElement("canvas");
  const smokeCanvas = document.createElement("canvas");
  root.append(baseCanvas, smokeCanvas);
  const base = baseCanvas.getContext("2d");
  const ctx = smokeCanvas.getContext("2d");
  let w = 0, h = 0, dpr = 1, bodies = [], particles = [], frame = null, visible = true;
  // The smoke plays for runFor ms of visible time, then fades and leaves still streamlines
  let ran = 0, lastTick = null, settling = 0, settled = false, paused = false, delayTimer = null;
  const createdAt = performance.now();

  // Velocity at (x, y): the stream bends around each body as around a cylinder
  // mapped onto the body's ellipse, so the boundary stays a streamline
  function velocity(x, y) {
    let u = speed, v = 0;
    for (const bd of bodies) {
      const X = (x - bd.x) / bd.a, Y = (y - bd.y) / bd.b;
      const r2 = X * X + Y * Y;
      if (r2 < 1) return null;
      const r4 = r2 * r2;
      u += speed * -(X * X - Y * Y) / r4;
      v += speed * (bd.b / bd.a) * (-2 * X * Y) / r4;
    }
    return [u, v];
  }

  function lanes() {
    const ys = [];
    for (let y = lane / 2; y < h; y += lane) ys.push(y);
    return ys;
  }

  function spawn(p, anywhere) {
    const ys = lanes();
    p.x = anywhere ? Math.random() * w : -Math.random() * 40;
    p.y = ys[Math.floor(Math.random() * ys.length)] + (Math.random() - 0.5) * 1.5;
    p.life = 0;
  }

  // Static streamlines: integrate the field from each rake nozzle
  // Only lines that cross the whole section are drawn; ones that run into a
  // body at a stagnation point would show as a kink
  function drawStreamlines(alpha) {
    base.clearRect(0, 0, w, h);
    base.strokeStyle = `rgba(242, 242, 238, ${alpha})`;
    base.lineWidth = 1;
    for (const y0 of lanes()) {
      let x = 0, y = y0, heading = 0, sharp = false;
      const pts = [[x, y]];
      for (let i = 0; i < 4000 && x < w; i++) {
        const vel = velocity(x, y);
        if (!vel) break;
        // A line hugging a stagnation point folds into a cusp; drop it
        const angle = Math.atan2(vel[1], vel[0]);
        if (i > 0 && Math.abs(angle - heading) > 0.35) { sharp = true; break; }
        heading = angle;
        const len = Math.hypot(vel[0], vel[1]) || 1;
        x += (vel[0] / len) * 3; y += (vel[1] / len) * 3;
        pts.push([x, y]);
      }
      if (sharp || x < w) continue;
      base.beginPath();
      pts.forEach(([px, py], i) => (i ? base.lineTo(px, py) : base.moveTo(px, py)));
      base.stroke();
    }
  }

  function tick(now) {
    if (lastTick !== null) ran += now - lastTick;
    lastTick = now;
    // Fade old smoke out (to transparent, so the base streamlines stay visible)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0, 0, 0, ${settling ? 0.12 : 0.06})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    if (ran > runFor) {
      // Stop releasing smoke; after the trails have faded, rest on the still streamlines
      if (++settling > 50) { settled = true; ctx.clearRect(0, 0, w, h); drawStreamlines(settledAlpha); frame = null; return; }
      frame = requestAnimationFrame(tick);
      return;
    }
    ctx.strokeStyle = `rgba(242, 242, 238, ${smokeAlpha})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const p of particles) {
      const vel = velocity(p.x, p.y);
      if (!vel || p.x > w + 10 || p.y < -10 || p.y > h + 10) { spawn(p); continue; }
      const nx = p.x + vel[0], ny = p.y + vel[1];
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      p.x = nx; p.y = ny; p.life++;
    }
    ctx.stroke();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    frame = null;
    clearTimeout(delayTimer);
    delayTimer = null;
    lastTick = null;
    if (reducedMotion() || settled || paused) { ctx.clearRect(0, 0, w, h); drawStreamlines(settled || paused ? settledAlpha : Math.min(lineAlpha * 3, 0.4)); return; }
    drawStreamlines(lineAlpha);
    // Hold the smoke until the bodies have settled into their measured places
    const wait = delay - (performance.now() - createdAt);
    if (wait > 0) { delayTimer = setTimeout(start, wait); return; }
    if (visible && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function resize(nextBodies) {
    bodies = nextBodies;
    const rect = root.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    for (const [c, g] of [[baseCanvas, base], [smokeCanvas, ctx]]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const count = Math.round(((w * h) / 900) * density);
    particles = Array.from({ length: count }, () => { const p = {}; spawn(p, true); return p; });
    ctx.clearRect(0, 0, w, h);
    start();
  }

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); });
  io.observe(root);
  const onVisibility = () => start();
  document.addEventListener("visibilitychange", onVisibility);

  return {
    el: root,
    // Pausing rests the section on its still streamlines; resuming continues the run
    pause() { paused = true; start(); },
    resume() { paused = false; start(); },
    // True only while smoke is actually animating (or about to, after its start delay)
    isRunning: () => frame !== null || delayTimer !== null,
    resize,
    destroy() { cancelAnimationFrame(frame); clearTimeout(delayTimer); io.disconnect(); document.removeEventListener("visibilitychange", onVisibility); },
  };
}
