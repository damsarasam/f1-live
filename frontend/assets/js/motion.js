// Scroll motion for the AeroLabs AI page: line reveals, fade-up reveals,
// clip wipes, count-ups and light parallax. Transform and opacity only;
// everything resolves to its final state under reduced motion.

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Content is visible by default; the hidden starting states only apply once motion is known to run. */
export function enableMotion() {
  if (!reducedMotion()) document.documentElement.classList.add("motion-ready");
}

/** Wrap each <br>-separated line of a heading so it can rise out of a mask. */
export function splitLines(el) {
  const lines = [[]];
  for (const node of [...el.childNodes]) {
    if (node.nodeName === "BR") lines.push([]);
    else lines.at(-1).push(node);
  }
  el.replaceChildren(...lines.map((nodes, i) => {
    const inner = document.createElement("span");
    inner.className = "al-line-inner";
    inner.style.setProperty("--i", i);
    inner.append(...nodes);
    const line = document.createElement("span");
    line.className = "al-line";
    line.append(inner);
    return line;
  }));
  el.classList.add("al-split");
  // Two frames so the hidden state paints before the transition starts
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
}

/**
 * Elements with [data-reveal] get .is-in once they enter the viewport.
 * Siblings revealed together are staggered through --i.
 */
export function observeReveals(root) {
  const items = [...root.querySelectorAll("[data-reveal]")];
  if (reducedMotion()) { items.forEach((el) => el.classList.add("is-in")); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    entering.forEach((el, i) => {
      el.style.setProperty("--i", i);
      el.classList.add("is-in");
      io.unobserve(el);
      el.dispatchEvent(new CustomEvent("revealed"));
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
  items.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/** Count a number up once it is visible. Call set(value) whenever the real value arrives. */
export function counter(el) {
  let target = null, shown = false, done = false;
  const run = () => {
    if (done || target === null || !shown) return;
    done = true;
    if (reducedMotion() || !Number.isFinite(target)) { el.textContent = target; return; }
    const start = performance.now(), duration = 1200;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      // Strong ease-out: fast start, settles on the value
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { shown = true; io.disconnect(); run(); } }, { threshold: 0.4 });
  io.observe(el);
  return { set(v) { target = v; if (!shown) el.textContent = reducedMotion() ? v : 0; run(); }, stop: () => io.disconnect() };
}

/** Light scroll parallax: the element drifts against the scroll by `factor` of its offset from centre. */
export function parallax(el, factor = 0.08) {
  if (reducedMotion()) return () => {};
  let frame = null;
  const update = () => {
    frame = null;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const offset = r.top + r.height / 2 - innerHeight / 2;
    el.style.transform = `translate3d(0, ${(-offset * factor).toFixed(1)}px, 0)`;
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener("scroll", onScroll, { passive: true });
  update();
  return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
}
