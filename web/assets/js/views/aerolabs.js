// AeroLabs AI main page. A hero where an F1 car in a wind tunnel re-forms
// into a launcher that flies on through space; a pinned products section scrubbed by scroll (VECTRA, then
// ASTRAEUS) behind a giant wordmark; and a closing call to the latest race.
import { h, icon, fmtDate } from "../ui.js";
import { enableMotion, splitLines, observeReveals } from "../motion.js";
import { webglAvailable, reducedMotion } from "../three/stage.js";
import { url } from "../config.js";

/** Most recent race that finished at least three hours ago, from VECTRA's data service */
async function latestRace() {
  const cutoff = Date.now() - 3 * 3600e3;
  for (const year of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
    const sch = await fetch(url("vectra", `/api/schedule/${year}`)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!sch) continue;
    for (let i = sch.events.length - 1; i >= 0; i--) {
      const race = sch.events[i].sessions.find((x) => x.code === "R");
      if (race && new Date(race.date) < cutoff) return { year, event: sch.events[i] };
    }
  }
  return null;
}

/** Glass "Pause motion" control for every looping scene on a page (WCAG 2.2.2). */
export function motionControl(stages) {
  if (reducedMotion() || !stages.length) return { el: null, stop: () => {} };
  let paused = false;
  const btn = h("button", { class: "motion-toggle", type: "button", "aria-pressed": "false" });
  const label = () => {
    btn.replaceChildren(icon(paused ? "play" : "pause"), paused ? "Play motion" : "Pause motion");
    btn.setAttribute("aria-pressed", String(paused));
  };
  btn.addEventListener("click", () => {
    paused = !paused;
    stages.forEach((st) => (paused ? st.pause() : st.resume()));
    label();
  });
  label();
  return { el: btn, stop: () => btn.remove() };
}

/** A host for a 3D scene; the scene module loads only when WebGL is available. */
export async function mountScene(host, factory, ...args) {
  if (!webglAvailable()) { host.classList.add("is-static"); return null; }
  const scenes = await import("../three/scenes.js");
  return scenes[factory](host, ...args);
}

/** Progress (0..1) of the page scrolling through a tall section with a sticky pin */
export function pinProgress(section) {
  const r = section.getBoundingClientRect();
  return Math.min(Math.max(-r.top / ((r.height - innerHeight) || 1), 0), 1);
}

const mono = (text, cls = "") => h("p", { class: `a-mono ${cls}`.trim() }, text);

// What the hero's labels read as the scene changes
const REGIMES = {
  car: { where: "Wind tunnel", what: "F1 car · rolling road" },
  morph: { where: "Re-forming", what: "Track to orbit" },
  rocket: { where: "Earth orbit", what: "Launcher · engine burning" },
};

const PRODUCTS = [
  {
    key: "vectra", name: "VECTRA", kind: "Motorsport intelligence",
    text: "Race analytics from live and historical Formula 1 data: fastest-lap replays coloured by speed, timing towers, tyre strategies and head-to-head telemetry. Free in the browser.",
    href: url("vectra", "/"), cta: "Open VECTRA",
  },
  {
    key: "astraeus", name: "ASTRAEUS", kind: "Autonomous Asteroid Mining & Resource Intelligence",
    tagline: "Beyond Earth. Within reach.",
    text: "AeroLabs AI's aerospace venture. More when it's ready to fly.",
    href: url("astraeus", "/"), cta: "Visit ASTRAEUS",
  },
];

export async function render(main) {
  const stops = [];

  // ---------- 1. Hero: the wind tunnel ----------
  const tunnel = h("div", { class: "a-stage" });
  const hud = { where: mono(REGIMES.car.where, "a-hud-tl"), what: mono(REGIMES.car.what, "a-hud-br") };
  const title = h("h1", { id: "a-title" }, "Intelligence from", h("br"), "the track to orbit");
  const hero = h("section", { class: "a-hero", "aria-labelledby": "a-title" },
    h("div", { class: "a-frame a-frame-hero" }, tunnel, h("div", { class: "a-hud", "aria-hidden": "true" }, hud.where, hud.what)),
    h("div", { class: "a-hero-copy" },
      title,
      h("div", { class: "a-hero-side" },
        h("p", { class: "a-lede", "data-reveal": true }, "Predict the future of racing. Engineer the future of space."),
        h("a", { class: "a-cue", href: "#products", "data-link": true, "data-reveal": true }, "Our products", icon("arrow")))));

  // ---------- 2. Products: pinned and scrubbed by scroll ----------
  const showStage = h("div", { class: "a-show-stage" });
  const words = PRODUCTS.map((p) => h("span", { class: "a-word", "data-word": p.key }, p.name));
  const counter = h("span", { class: "a-count" }, "01 / 02");
  const ticks = h("div", { class: "a-ticks", "aria-hidden": "true" }, ...Array.from({ length: 10 }, () => h("i")));
  const cards = PRODUCTS.map((p, i) => h("article", { class: "a-card", "data-card": p.key, "aria-labelledby": `a-${p.key}` },
    h("header", { class: "a-card-head" }, mono(`● ${p.key === "vectra" ? "Live" : "In development"}`), mono(`0${i + 1} / 02`)),
    h("h3", { id: `a-${p.key}` }, p.name),
    h("p", { class: "a-card-kind" }, p.kind),
    p.tagline ? h("p", { class: "a-card-tag" }, p.tagline) : null,
    h("p", { class: "a-card-text" }, p.text),
    h("div", { class: "a-card-actions" },
      h("a", { class: `a-btn ${p.key === "vectra" ? "a-btn-red" : "a-btn-light"}`, href: p.href }, p.cta, icon("arrow")),
      h("a", { class: "a-link", href: `/${p.key}`, "data-link": true }, "How it works", icon("arrow")))));
  const pin = h("div", { class: "a-pin is-vectra" },
    h("div", { class: "a-words", "aria-hidden": "true" }, ...words),
    showStage,
    h("header", { class: "a-show-head" }, h("h2", { id: "products-title", class: "a-mono" }, "Our products"), counter),
    h("div", { class: "a-cards" }, ...cards, ticks),
    mono("Precision in every line", "a-show-foot"));
  const products = h("section", { class: "a-show", id: "products", "aria-labelledby": "products-title" }, pin);

  // ---------- 3. Closing: the latest race ----------
  const raceMeta = mono("VECTRA · Latest race", "a-band-label");
  const raceLink = h("a", { class: "a-btn a-btn-dark", href: url("vectra", "/") }, "Open VECTRA", icon("arrow"));
  const closing = h("section", { class: "a-band a-band-stone", "aria-labelledby": "a-closing-title" },
    h("div", { class: "a-band-inner" },
      raceMeta,
      h("h2", { id: "a-closing-title", "data-reveal": true }, "Start with the latest race"),
      h("div", { class: "a-band-side", "data-reveal": true },
        h("p", {}, "Replay the fastest lap, read the timing and see how the strategies played out."),
        raceLink)));

  main.replaceChildren(h("div", { class: "a-site" }, hero, products, closing));
  enableMotion();
  splitLines(title);
  stops.push(observeReveals(main));
  hero.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));

  // Latest race: name the event and link straight to its session
  latestRace().then((latest) => {
    if (!latest) return;
    const { year, event } = latest;
    const race = event.sessions.find((x) => x.code === "R");
    raceMeta.textContent = `VECTRA · Latest race · ${event.name} · ${fmtDate(race.date)}`;
    raceLink.setAttribute("href", url("vectra", `/sessions/${year}/${event.round}/R`));
    raceLink.firstChild.textContent = `Open the ${event.name}`;
  }).catch(() => {});

  // Products scroll: which product is showing, the wordmark wipe, the progress ticks
  let showP = 0, current = "vectra";
  const onScroll = () => {
    showP = pinProgress(products);
    const mode = showP < 0.5 ? "vectra" : "astraeus";
    if (mode !== current) {
      current = mode;
      pin.classList.toggle("is-vectra", mode === "vectra");
      pin.classList.toggle("is-astraeus", mode === "astraeus");
      counter.textContent = mode === "vectra" ? "01 / 02" : "02 / 02";
    }
    cards.forEach((c) => { const on = c.dataset.card === mode; c.inert = !on; c.setAttribute("aria-hidden", String(!on)); });
    // Each wordmark wipes in from the left and out to the right as its product leaves
    const wipe = (a, b) => Math.min(Math.max((showP - a) / (b - a), 0), 1);
    const vOut = wipe(0.42, 0.5), aIn = wipe(0.5, 0.6);
    words[0].style.clipPath = `inset(0 0 0 ${vOut * 100}%)`;
    words[1].style.clipPath = `inset(0 ${(1 - aIn) * 100}% 0 0)`;
    [...ticks.children].forEach((t, i) => t.classList.toggle("is-on", i / 10 < showP));
  };
  addEventListener("scroll", onScroll, { passive: true });
  stops.push(() => removeEventListener("scroll", onScroll));
  onScroll();

  const [tunnelScene, showScene] = await Promise.all([
    mountScene(tunnel, "windTunnel", {
      onPhase(phase) {
        const r = REGIMES[phase];
        hud.where.textContent = r.where; hud.what.textContent = r.what;
        tunnel.closest(".a-frame").dataset.phase = phase;
      },
    }),
    mountScene(showStage, "productShowcase", () => showP),
  ]);
  const stages = [tunnelScene, showScene].filter(Boolean);
  stops.push(...stages.map((st) => () => st.dispose()));
  // The showcase follows the scroll even when its loop is idle
  if (showScene) {
    const follow = () => { if (!showScene.isRunning()) showScene.draw(); };
    addEventListener("scroll", follow, { passive: true });
    stops.push(() => removeEventListener("scroll", follow));
  }
  const control = motionControl(tunnelScene ? [tunnelScene] : []);
  if (control.el) { hero.querySelector(".a-frame").append(control.el); stops.push(control.stop); }

  return () => stops.forEach((stop) => stop());
}
