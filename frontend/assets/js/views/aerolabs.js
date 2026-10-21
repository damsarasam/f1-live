// AeroLabs AI company page: products shown like flight hardware, every figure from the live API.
import { api } from "../api.js";
import { h, s, icon, teamColour } from "../ui.js";
import { heroReplay } from "../track.js";
import { smokeTunnel } from "../flow.js";
import { enableMotion, splitLines, observeReveals, counter, parallax } from "../motion.js";
import { latestRace, nextEvent } from "./home.js";

const MISSION = "AeroLabs AI is an advanced motorsport intelligence platform focused on real time race analytics, aerodynamic strategy optimization and AI driven performance modeling. Leveraging historical and live Formula 1 data the platform delivers dynamic race visualizations, predictive strategy insights and decision support systems designed to mirror next generation racing technologies.";
const FIRST_SEASON = 2018;

// Irregular rock outline for the ASTRAEUS orbit diagram
function rockPath(x, y, r) {
  const bumps = [0.86, 0.95, 0.8, 0.92, 0.88, 0.97, 0.82, 0.9, 0.94, 0.84, 0.91, 0.87];
  return bumps.map((k, i) => {
    const t = (i / bumps.length) * Math.PI * 2;
    return `${i ? "L" : "M"}${(x + Math.cos(t) * r * k).toFixed(1)} ${(y + Math.sin(t) * r * k * 0.82).toFixed(1)}`;
  }).join("") + "Z";
}

function orbitDiagram() {
  // Generic orbital context, no mission data: the Sun, Earth's orbit, and a
  // near-Earth asteroid on an eccentric orbit that crosses it
  const sun = [330, 200];
  return s("svg", { class: "al-orbit", viewBox: "60 20 620 360", role: "img",
    "aria-label": "Diagram: Earth's orbit around the Sun, crossed by the eccentric orbit of a near-Earth asteroid" },
    s("circle", { cx: sun[0], cy: sun[1], r: 130, class: "al-orbit-earth" }),
    s("ellipse", { cx: 420, cy: 200, rx: 230, ry: 150, transform: "rotate(-14 420 200)", class: "al-orbit-path" }),
    s("circle", { cx: sun[0], cy: sun[1], r: 9, class: "al-orbit-sun" }),
    s("circle", { cx: sun[0] - 92, cy: sun[1] - 92, r: 6, class: "al-orbit-planet" }),
    s("path", { d: rockPath(636, 160, 16), class: "al-orbit-body" }),
    s("text", { x: sun[0] + 16, y: sun[1] + 5, class: "al-orbit-label" }, "Sun"),
    s("text", { x: sun[0] - 136, y: sun[1] - 104, class: "al-orbit-label" }, "Earth"),
    // Inside the ellipse, left of the body, so the dashed orbit never crosses the text
    s("text", { x: 612, y: 165, "text-anchor": "end", class: "al-orbit-label al-orbit-label-long" }, "Near-Earth asteroid"),
    s("text", { x: 612, y: 168, "text-anchor": "end", class: "al-orbit-label al-orbit-label-short" }, "Asteroid"));
}

const BODY_PAD = 56;

/** Sum of translate transforms on an element and its ancestors (reveals, parallax). */
function translateOf(el, stop) {
  let x = 0, y = 0;
  for (let n = el; n && n !== stop && n.nodeType === 1; n = n.parentElement) {
    const t = getComputedStyle(n).transform;
    if (t && t !== "none") { const m = new DOMMatrixReadOnly(t); x += m.m41; y += m.m42; }
  }
  return [x, y];
}

/**
 * Body of an element relative to a rect: an ellipse padded by a fixed amount
 * sideways, with its height solved so all four corners of the box clear the
 * curve ((w/2)/a)² + ((h/2)/b)² < 1. Measured where the element rests, not
 * where a reveal or parallax transform has it right now.
 */
function bodyOf(el, rect, stop) {
  const r = el.getBoundingClientRect();
  const [tx, ty] = translateOf(el, stop);
  const a = r.width / 2 + BODY_PAD;
  const k = (r.width / 2) / a;
  const b = (r.height / 2) / Math.sqrt(1 - k * k) * 1.06 + 8;
  return { x: r.left - tx - rect.left + r.width / 2, y: r.top - ty - rect.top + r.height / 2, a, b };
}

/** Wind-tunnel smoke behind a section; the listed elements are the bodies the flow parts around. */
function windTunnel(section, bodies, options) {
  const tunnel = smokeTunnel(options);
  tunnel.el.classList.add("al-tunnel");
  section.prepend(tunnel.el);
  const measure = () => {
    const rect = tunnel.el.getBoundingClientRect();
    if (rect.width && rect.height) tunnel.resize(bodies().filter(Boolean).map((el) => bodyOf(el, rect, section)));
  };
  const ro = new ResizeObserver(measure);
  ro.observe(section);
  // Bodies change size as content and fonts settle; re-measure once their reveal ends
  const timers = [];
  const onReveal = () => timers.push(setTimeout(measure, 1000));
  for (const el of bodies()) el?.addEventListener("revealed", onReveal);
  document.fonts?.ready.then(measure);
  return { measure, tunnel, stop: () => { ro.disconnect(); timers.forEach(clearTimeout); tunnel.destroy(); } };
}

function spec(value, label) {
  return h("div", { class: "al-spec" }, h("dd", {}, value), h("dt", {}, label));
}

function stat(value, label) {
  return h("div", { class: "al-stat", "data-reveal": true }, h("b", {}, value), h("span", {}, label));
}

function countdownText(date) {
  let secs = Math.max(0, Math.floor((new Date(date) - new Date()) / 1000));
  const d = Math.floor(secs / 86400); secs -= d * 86400;
  const hrs = Math.floor(secs / 3600); secs -= hrs * 3600;
  return [d, h("small", {}, "d "), String(hrs).padStart(2, "0"), h("small", {}, "h "), String(Math.floor(secs / 60)).padStart(2, "0"), h("small", {}, "m")];
}

export async function render(main) {
  const stops = [];
  let peekStage, peekCaption, title, motionToggle;

  const hero = h("section", { class: "al-hero", "aria-labelledby": "al-title" },
    title = h("h1", { id: "al-title" }, "Intelligence", h("br"), "from the track", h("br"), "to orbit"),
    h("p", { class: "al-hero-sub", "data-reveal": true }, "Race analytics from Formula 1 data today. Autonomous asteroid mining next."),
    h("div", { class: "al-actions", "data-reveal": true },
      h("a", { class: "al-btn al-btn-primary", href: "/f1", "data-link": true }, "Open F1 Data Hub"),
      h("a", { class: "al-btn", href: "#astraeus", "data-link": true }, "Discover ASTRAEUS")),
    h("figure", { class: "al-peek", "data-reveal": true },
      peekStage = h("div", { class: "al-peek-stage" }, h("p", { class: "al-loading", role: "status" }, "Loading the latest race lap…")),
      h("figcaption", { class: "al-caption al-peek-caption" },
        peekCaption = h("span"),
        motionToggle = h("button", { class: "al-text-btn", type: "button", hidden: true }, "Pause motion"))));

  // ---------- Products ----------
  const f1Visual = h("div", { class: "al-classification" }, h("p", { class: "al-loading", role: "status" }, "Loading the latest classification…"));
  const f1Specs = h("dl", { class: "al-specs" }, spec("--", "Fastest lap"), spec("--", "Top speed"), spec(`${FIRST_SEASON}+`, "Seasons covered"));
  const f1Caption = h("p", { class: "al-caption" });
  const products = h("section", { class: "al-products", "aria-labelledby": "al-products-title" },
    h("header", { class: "al-section-head al-centre", "data-reveal": true },
      h("h2", { id: "al-products-title" }, "Our products"),
      h("p", {}, "One live today, one on the way")),
    h("article", { class: "al-product", id: "f1" },
      h("div", { class: "al-product-copy", "data-reveal": true },
        h("h3", {}, "F1 Data Hub"),
        h("p", { class: "al-status al-status-live" }, h("i", { "aria-hidden": "true" }), "Live now"),
        f1Specs,
        h("p", { class: "al-product-text" }, "Fastest-lap replays coloured by speed, timing towers, tyre stints, head-to-head speed traces and the strategies that won each Grand Prix. Free in the browser, no login."),
        h("p", { class: "al-roadmap" }, "On the roadmap: AI-driven performance modelling and predictive strategy."),
        h("a", { class: "al-link", href: "/f1", "data-link": true }, "Explore F1 Data Hub", icon("arrow"))),
      h("figure", { class: "al-figure", "data-reveal": "clip" }, f1Visual, f1Caption)),
    h("article", { class: "al-product al-product-flip", id: "astraeus" },
      h("div", { class: "al-product-copy", "data-reveal": true },
        h("h3", {}, "ASTRAEUS"),
        h("p", { class: "al-status" }, h("i", { "aria-hidden": "true" }), "Under construction"),
        h("p", { class: "al-product-lede" }, "Autonomous Asteroid Mining & Resource Intelligence"),
        h("p", { class: "al-tagline" }, "Beyond Earth. Within reach."),
        h("p", { class: "al-product-text" }, "AeroLabs AI's aerospace venture. More when it's ready to fly.")),
      h("figure", { class: "al-figure", "data-reveal": "clip" }, h("div", { class: "al-visual" }, orbitDiagram()), h("p", { class: "al-caption" }, "Concept diagram"))),
  );

  // ---------- Live numbers ----------
  const stats = h("section", { class: "al-stats", "aria-label": "F1 Data Hub in numbers" },
    stat("--", "Grands Prix this season"),
    stat("--", "Drivers classified, latest race"),
    stat("--", "Laps, latest race"));

  const vision = h("section", { class: "al-vision", id: "vision", "aria-labelledby": "al-vision-title" },
    h("h2", { id: "al-vision-title", "data-reveal": true }, "Our vision"),
    h("p", { "data-reveal": true }, MISSION));

  // ---------- Latest from F1 Data Hub ----------
  const latestList = h("div", { class: "al-latest-list" });
  const latest = h("section", { class: "al-latest", "aria-labelledby": "al-latest-title" },
    h("header", { class: "al-section-head", "data-reveal": true },
      h("h2", { id: "al-latest-title" }, "Latest from F1 Data Hub"),
      h("a", { class: "al-btn al-btn-small", href: "/f1/sessions", "data-link": true }, "View all sessions")),
    latestList);

  const closingTitle = h("h2", { "data-reveal": true }, "Start with the latest race");
  const closingAction = h("a", { class: "al-btn al-btn-primary", href: "/f1", "data-link": true, "data-reveal": true }, "Open F1 Data Hub");
  const closing = h("section", { class: "al-closing al-centre" }, closingTitle, closingAction);

  main.replaceChildren(hero, products, stats, vision, latest, closing);

  // ---------- Motion ----------
  enableMotion();
  splitLines(title);
  stops.push(observeReveals(main));
  const counters = [...stats.querySelectorAll(".al-stat b")].map(counter);
  stops.push(...counters.map((c) => c.stop));
  stops.push(parallax(peekStage, 0.06));
  // Wind tunnel: smoke parts around the headline, the actions and the lap; and around the closing call
  // The lap's body is its drawn track outline, not the full-width stage around it
  const heroBodies = () => [title, hero.querySelector(".al-hero-sub"), ...hero.querySelectorAll(".al-actions .al-btn"), peekStage.querySelector(".hero-outline")];
  const tunnelOptions = { density: 0.7, smokeAlpha: 0.38, lineAlpha: 0.08, runFor: 10000, settledAlpha: 0.14, delay: 600 };
  const heroTunnel = windTunnel(hero, heroBodies, tunnelOptions);
  const closingTunnel = windTunnel(closing, () => [closingTitle, closingAction], tunnelOptions);
  stops.push(heroTunnel.stop, closingTunnel.stop);

  // ---------- Fill with live data ----------
  const sched = await api(`/schedule/${new Date().getFullYear()}`).catch(() => null);
  const setStat = (i, v) => counters[i].set(v);
  if (sched) setStat(0, sched.events.length);

  const [race, next] = await Promise.all([latestRace(), nextEvent()]);
  const items = [];
  if (race) {
    const base = `/sessions/${race.year}/${race.event.round}/R`;
    const [res, lap] = await Promise.all([api(base).catch(() => null), api(`${base}/fastest-lap`).catch(() => null)]);
    if (lap) {
      f1Specs.replaceChildren(spec(lap.lap_time, `Fastest lap · ${lap.driver.code}`), spec(h("span", {}, lap.top_speed, h("small", {}, " km/h")), "Top speed"), spec(`${FIRST_SEASON}+`, "Seasons covered"));
      const replay = heroReplay(lap, { loops: 1 });
      peekStage.replaceChildren(replay);
      peekCaption.textContent = `Live in F1 Data Hub: ${lap.driver.name}'s fastest lap, ${race.event.name}, ${lap.lap_time}. Real telemetry, replayed at 4×.`;
      replay.start();
      stops.push(replay.stop);
      requestAnimationFrame(heroTunnel.measure);
      // One control for every moving thing in the hero (WCAG 2.2.2). Its label always
      // describes what a click will do, read from what is actually running.
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const tunnels = [heroTunnel.tunnel, closingTunnel.tunnel];
        let paused = false;
        const moving = () => replay.isRunning() || tunnels.some((t) => t.isRunning());
        const label = () => { motionToggle.textContent = paused ? "Play motion" : moving() ? "Pause motion" : "Replay lap"; };
        motionToggle.hidden = false;
        motionToggle.addEventListener("click", () => {
          if (paused) { paused = false; replay.start(); tunnels.forEach((t) => t.resume()); }
          else if (moving()) { paused = true; replay.stop(); tunnels.forEach((t) => t.pause()); }
          else replay.start();
          label();
        });
        const labelTimer = setInterval(label, 500);
        stops.push(() => clearInterval(labelTimer));
        label();
      }
    } else {
      peekStage.replaceChildren();
    }
    if (res?.results?.length) {
      setStat(1, res.results.filter((r) => r.position).length);
      if (res.results[0].laps) setStat(2, res.results[0].laps);
      const lead = res.results[0].laps;
      f1Visual.replaceChildren(h("ol", { class: "al-rows", "aria-label": `${res.event} classification, top six` },
        res.results.slice(0, 6).map((r) => h("li", {},
          h("span", { class: "al-row-pos" }, r.position),
          h("i", { style: { background: teamColour(r.colour) || "#888" }, "aria-hidden": "true" }),
          h("b", {}, r.code),
          h("span", { class: "al-row-name" }, `${r.first} ${r.last}`),
          h("span", { class: "al-row-gap" }, r.position === 1 ? r.time : r.laps === lead && r.time ? `+${r.time.startsWith("0:") ? Number(r.time.slice(2)).toFixed(3) : r.time}` : r.status)))));
      f1Caption.textContent = `${res.event} classification, from F1 Data Hub.`;
      const podium = res.results.slice(0, 3).map((r) => h("span", { class: "al-podium" },
        h("i", { style: { background: teamColour(r.colour) || "#888" }, "aria-hidden": "true" }), `${r.position} ${r.code}`));
      items.push(h("a", { class: "al-latest-item", href: `/f1${base}`, "data-link": true },
        h("span", { class: "al-meta" }, new Date(res.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), h("em", {}, "Race")),
        h("b", {}, `${res.event}: result and replay`),
        h("span", { class: "al-podiums" }, podium)));
    }
  }
  if (next) {
    const cd = h("span", { class: "al-countdown" }, countdownText(next.session.date));
    const timer = setInterval(() => cd.replaceChildren(...countdownText(next.session.date)), 30000);
    stops.push(() => clearInterval(timer));
    items.push(h("a", { class: "al-latest-item", href: `/f1/strategy/${next.year}/${next.event.round}`, "data-link": true },
      h("span", { class: "al-meta" }, "Up next", h("em", {}, next.session.name)),
      h("b", {}, `${next.event.name}: strategy history`),
      cd));
  }
  // Never leave a stage on its loading line if a request failed
  if (f1Visual.querySelector(".al-loading")) f1Visual.replaceChildren(h("p", { class: "al-loading" }, "Classification unavailable right now."));
  if (peekStage.querySelector(".al-loading")) peekStage.replaceChildren();
  items.push(h("a", { class: "al-latest-item", href: "/f1/live", "data-link": true },
    h("span", { class: "al-meta" }, "Live", h("em", {}, "Timing")),
    h("b", {}, "Timing tower, tyres and track weather"),
    h("span", { class: "al-dim" }, "Refreshes during sessions")));
  items.forEach((item) => item.setAttribute("data-reveal", ""));
  latestList.replaceChildren(...items);
  stops.push(observeReveals(latestList));

  return () => stops.forEach((stop) => stop());
}
