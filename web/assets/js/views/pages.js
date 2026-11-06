// About, Vision, Blog and the VECTRA and ASTRAEUS explainers. Written only from what AeroLabs AI
// has stated about itself and what the products do today.
// REVIEW: draft copy for the owner to confirm; no team, history or numbers are claimed.
// Images (assets/img) are stills rendered from the 3D models and screenshots of VECTRA itself.
import { h, icon } from "../ui.js";
import { enableMotion, splitLines, observeReveals } from "../motion.js";
import { url } from "../config.js";

// Same-site links go through the router; links to the other apps are full addresses
const internal = (href) => (href.startsWith("/") ? true : null);

const img = (file, alt, cls = "") => h("img", { class: cls, src: `/assets/img/${file}`, alt, decoding: "async" });
const mono = (text, cls = "") => h("p", { class: `a-mono ${cls}`.trim() }, text);
/** A button out to one of the apps */
const appButton = (app, path, text, cls = "a-btn a-btn-light") => h("a", { class: cls, href: url(app, path) }, text, icon("arrow"));
const arrowLink = (href, text, cls = "a-link") => h("a", { class: cls, href, "data-link": internal(href) }, text, icon("arrow"));

// ---------- Blocks ----------
function cover({ image, alt, label, title, lede, actions }) {
  const h1 = h("h1", { id: "p-title" }, ...title.flatMap((line, i) => (i ? [h("br"), line] : [line])));
  const el = h("header", { class: "p-cover" },
    h("div", { class: "p-cover-media" }, img(image, alt, "p-cover-img")),
    h("div", { class: "p-cover-copy" },
      mono(label, "p-cover-label"),
      h1,
      h("div", { class: "p-cover-side" },
        h("p", { class: "p-cover-lede", "data-reveal": true }, lede),
        actions ? h("div", { class: "a-actions", "data-reveal": true }, ...actions) : null)));
  return { el, h1 };
}

const statement = ({ label, text }) => h("section", { class: "p-statement", "data-reveal": true },
  mono(label), h("p", {}, text));

const split = ({ label, title, body, image, alt, link, flip }) => h("section", { class: `p-split${flip ? " is-flip" : ""}` },
  h("figure", { class: "p-split-media", "data-reveal": "clip" }, img(image, alt)),
  h("div", { class: "p-split-copy", "data-reveal": true },
    mono(label),
    h("h2", {}, title),
    ...body.map((t) => h("p", {}, t)),
    link ? arrowLink(link[0], link[1]) : null));

const tiles = ({ label, items }) => h("section", { class: "p-tiles" },
  h("header", { class: "p-section-head" }, mono(label)),
  h("div", { class: "p-tile-grid" }, ...items.map((t) => h("a", { class: "p-tile", href: t.href, "data-link": internal(t.href), "data-reveal": true },
    h("div", { class: "p-tile-media" }, img(t.image, t.alt)),
    h("div", { class: "p-tile-copy" },
      h("div", { class: "p-tile-top" }, mono(t.status, t.live ? "is-live" : "is-dev"), h("span", { class: "p-tile-arrow" }, icon("arrow"))),
      h("h3", {}, t.name),
      h("p", { class: "p-tile-kind" }, t.kind),
      h("p", { class: "p-tile-text" }, t.text))))));

const numbered = ({ label, items }) => h("section", { class: "p-numbered" },
  h("header", { class: "p-section-head" }, mono(label)),
  h("ol", {}, ...items.map(([title, text], i) => h("li", { "data-reveal": true },
    h("span", { class: "p-num" }, String(i + 1).padStart(2, "0")),
    h("h3", {}, title),
    h("p", {}, text)))));

const band = ({ tone, label, title, text, actions }) => h("section", { class: `a-band a-band-${tone}` },
  h("div", { class: "a-band-inner" },
    mono(label, "a-band-label"),
    h("h2", { "data-reveal": true }, title),
    h("div", { class: "a-band-side", "data-reveal": true }, h("p", {}, text), h("div", { class: "a-actions" }, ...actions))));

// ---------- Pages ----------
const VECTRA_TILE = {
  href: "/vectra", image: "vectra-car.png", alt: "Rendering of an F1 car", status: "● Live", live: true,
  name: "VECTRA", kind: "Motorsport intelligence",
  text: "Session replays, timing, tyre strategy and telemetry comparisons from live and historical Formula 1 data. Free in the browser.",
};
const ASTRAEUS_TILE = {
  href: "/astraeus", image: "astraeus-craft.png", alt: "Rendering of the ASTRAEUS spacecraft", status: "● In development",
  name: "ASTRAEUS", kind: "Autonomous Asteroid Mining & Resource Intelligence",
  text: "Beyond Earth. Within reach. Our aerospace venture. More when it's ready to fly.",
};

const PAGES = {
  vectra: () => {
    const c = cover({
      image: "tunnel.jpg", alt: "An F1 car in a wind tunnel with smoke streamlines", label: "VECTRA · Motorsport intelligence",
      title: ["VECTRA"],
      lede: "Formula 1 race analysis in the browser, rebuilt from open timing and telemetry data. Free, with no account.",
      actions: [appButton("vectra", "/", "Open VECTRA", "a-btn a-btn-red"), arrowLink("#vectra-what", "How it works")],
    });
    return [c, [
      h("div", { id: "vectra-what" }, statement({ label: "01 — What it is",
        text: "VECTRA turns raw Formula 1 timing and telemetry into analysis you can read at a glance: what happened in a session, how each strategy played out and where races are won." })),
      split({ label: "02 — Sessions", title: "Every session, replayed",
        body: ["Pick any Grand Prix and session. The fastest lap replays around the circuit, coloured by speed, beside the full classification.",
          "Tyre stints show every driver's strategy lap by lap, and a head-to-head view lays two drivers' speed traces over each other."],
        image: "vectra-session.png", alt: "VECTRA's session page: the classification beside a fastest-lap replay coloured by speed",
        link: [url("vectra", "/sessions"), "Open Sessions"] }),
      split({ label: "03 — Live", title: "The race as it runs", flip: true,
        body: ["During a session the live board keeps the timing tower, tyres, last laps, weather and car positions on the circuit up to date.",
          "Between sessions it shows the latest result and counts down to the next one."],
        image: "vectra-live.png", alt: "VECTRA's live board: the timing tower beside car positions on the circuit",
        link: [url("vectra", "/live"), "Open the live board"] }),
      split({ label: "04 — Strategy", title: "Ten seasons of strategy",
        body: ["For each Grand Prix, VECTRA reads the last ten editions and turns them into four calls: the tyre plans that won, the pit window and whether the undercut works, the odds of a safety car, and where to harvest energy and attack.",
          "The energy view is estimated from the throttle and speed on the fastest lap, and says so."],
        image: "vectra-strategy.png", alt: "VECTRA's energy and attack view: a circuit map with full-throttle zones, overtakes and where energy ran out",
        link: [url("vectra", "/strategy"), "Open Strategy"] }),
      numbered({ label: "05 — Built on open data", items: [
        ["Open data", "Results, laps, timing and telemetry from FastF1 and OpenF1, the public Formula 1 data sources."],
        ["Honest about gaps", "Lap-by-lap data covers recent seasons; when something isn't available, VECTRA says why instead of guessing."],
        ["Free in the browser", "No account, no subscription and nothing to install."],
      ] }),
      band({ tone: "stone", label: "VECTRA", title: "Start with the latest race", text: "Replay the fastest lap, read the timing and see how the strategies played out.",
        actions: [appButton("vectra", "/", "Open VECTRA", "a-btn a-btn-dark"), arrowLink("/astraeus", "Discover ASTRAEUS")] }),
    ]];
  },
  astraeus: () => {
    const c = cover({
      image: "capture.jpg", alt: "The ASTRAEUS craft holding an asteroid in its net", label: "ASTRAEUS · In development",
      title: ["Beyond Earth.", "Within reach."],
      lede: "Autonomous Asteroid Mining & Resource Intelligence: AeroLabs AI's aerospace venture, a concept in development.",
      actions: [appButton("astraeus", "/", "Visit ASTRAEUS", "a-btn a-btn-light"), arrowLink("#astraeus-why", "Why it matters")],
    });
    return [c, [
      h("div", { id: "astraeus-why" }, statement({ label: "01 — The problem", text: "Earth Shouldn't Pay the Price for Human Progress." })),
      split({ label: "02 — The solution", title: "Mine beyond Earth. Protect our home.",
        body: ["Growing demand for critical minerals drives resource-intensive mining, environmental destruction, habitat loss and pressure on Earth's finite ecosystems.",
          "Autonomous space mining could unlock extraterrestrial resources, support humanity's expansion into space and help reduce our reliance on Earth's natural reserves."],
        image: "earth.jpg", alt: "Earth with major mining regions marked" }),
      split({ label: "03 — The mission", title: "From launch to a signal home", flip: true,
        body: ["A fully reusable launcher carries a fleet of craft to orbit. Its bay door rolls up and the craft leave one by one, each unfolding for the cruise.",
          "Each one tracks its asteroid on its own, then nets the small ones or lands on the ones too massive to catch, takes samples and sends its findings back to Earth."],
        image: "launch.jpg", alt: "The reusable launcher climbing above Earth", link: [url("astraeus", "/#mission"), "Follow the mission"] }),
      split({ label: "04 — The fleet", title: "Many asteroids at once",
        body: ["The craft spread across an asteroid field, each scanning its own target to find out what it contains.",
          "When one can't see Earth, its message hops craft to craft by laser link until one of them can send it home."],
        image: "fleet.jpg", alt: "The ASTRAEUS fleet prospecting several asteroids, one landed on a large asteroid" }),
      split({ label: "05 — The craft", title: "Built for the long cruise", flip: true,
        body: ["Nuclear-electric propulsion: a compact fission reactor powers ion engines, with a shield and a long boom keeping its radiation away from the electronics.",
          "Circular origami solar arrays, autonomous tracking, a six-joint arm, and a net or four landing legs for each kind of asteroid."],
        image: "astraeus-craft.png", alt: "The ASTRAEUS craft: sensor module, radiator boom, reactor and ion engines, two circular solar arrays" }),
      numbered({ label: "06 — Where it stands", items: [
        ["A concept", "ASTRAEUS is in development. The craft and mission shown here are design concepts, not flight hardware."],
        ["No dates yet", "There are no launches, partners or timelines to announce."],
        ["More when it's ready", "Updates will come here and on the ASTRAEUS site when it's ready to fly."],
      ] }),
      band({ tone: "bone", label: "ASTRAEUS", title: "Follow the mission", text: "See the full mission, step by step, on the ASTRAEUS site.",
        actions: [appButton("astraeus", "/", "Visit ASTRAEUS", "a-btn a-btn-dark"), arrowLink("/vectra", "Explore VECTRA")] }),
    ]];
  },
  about: () => {
    const c = cover({
      image: "capture.jpg", alt: "A spacecraft that has netted an asteroid", label: "About",
      title: ["About", "AeroLabs AI"],
      lede: "AeroLabs AI brings aerodynamics and artificial intelligence to two frontiers: the race track and space.",
    });
    return [c, [
      statement({ label: "01 — Mission",
        text: "An advanced motorsport intelligence platform focused on real-time race analytics, aerodynamic strategy optimisation and AI-driven performance modelling." }),
      split({ label: "What we do", title: "Racing, read from its data",
        body: ["Using historical and live Formula 1 data, AeroLabs AI delivers dynamic race visualisations, predictive strategy insights and decision support designed to mirror next-generation racing technology."],
        image: "tunnel.jpg", alt: "An F1 car in a wind tunnel with smoke streamlines", link: [url("vectra", "/"), "Open VECTRA"] }),
      tiles({ label: "02 — Products", items: [VECTRA_TILE, ASTRAEUS_TILE] }),
      numbered({ label: "03 — How we work", items: [
        ["Open data", "VECTRA is built on public Formula 1 results, timing and telemetry from FastF1 and OpenF1."],
        ["Honest about gaps", "When a session's data isn't available, the site says why instead of showing an error."],
        ["Free in the browser", "No account, no subscription and nothing to install."],
      ] }),
      band({ tone: "bone", label: "AeroLabs AI", title: "See it working", text: "Open the race hub, or follow the mission to the asteroids.",
        actions: [appButton("vectra", "/", "Open VECTRA", "a-btn a-btn-dark"), appButton("astraeus", "/", "Visit ASTRAEUS", "a-btn a-btn-ghost-dark")] }),
    ]];
  },
  vision: () => {
    const c = cover({
      image: "launch.jpg", alt: "A launch vehicle climbing above Earth", label: "Vision",
      title: ["Intelligence from", "the track to orbit"],
      lede: "Predict the future of racing. Engineer the future of space.",
    });
    return [c, [
      statement({ label: "Our vision",
        text: "Both frontiers are problems of flow, prediction and autonomy. The same thinking that reads a race from its telemetry can guide a craft to an asteroid." }),
      split({ label: "01 — On the track", title: "Data read faster than the competition",
        body: ["Racing is decided by data read faster than the competition. VECTRA starts with clear, readable race analysis today, and grows toward predictive strategy and AI-driven performance modelling."],
        image: "tunnel.jpg", alt: "An F1 car in a wind tunnel", link: [url("vectra", "/"), "Open VECTRA"] }),
      split({ label: "02 — Beyond Earth", title: "Earth shouldn't pay the price", flip: true,
        body: ["Growing demand for critical minerals drives resource-intensive mining and pressure on Earth's finite ecosystems.",
          "Autonomous space mining could unlock extraterrestrial resources, support humanity's expansion into space and help reduce our reliance on Earth's natural reserves."],
        image: "earth.jpg", alt: "Earth with mining regions marked" }),
      split({ label: "03 — Within reach", title: "ASTRAEUS",
        body: ["Autonomous Asteroid Mining & Resource Intelligence. AeroLabs AI's aerospace venture. More when it's ready to fly."],
        image: "capture.jpg", alt: "A spacecraft that has netted an asteroid", link: [url("astraeus", "/"), "Discover ASTRAEUS"] }),
      band({ tone: "stone", label: "AeroLabs AI", title: "Engineer the future of space", text: "Follow the mission, or explore the racing intelligence that is live today.",
        actions: [appButton("astraeus", "/", "Visit ASTRAEUS", "a-btn a-btn-dark"), appButton("vectra", "/", "Open VECTRA", "a-btn a-btn-ghost-dark")] }),
    ]];
  },
};

function blog() {
  const title = h("h1", { id: "p-title" }, "Blog");
  return [{ el: h("header", { class: "a-doc-head" }, title,
    h("p", { class: "a-doc-lede", "data-reveal": true }, "Notes from the track and from orbit. The first posts are on their way."),
    h("div", { class: "a-actions a-doc-actions", "data-reveal": true },
      appButton("vectra", "/", "Open VECTRA", "a-btn a-btn-red"),
      appButton("astraeus", "/", "Visit ASTRAEUS", "a-btn a-btn-light"))), h1: title }, []];
}

export async function render(main, { page }) {
  const [head, blocks] = page === "blog" ? blog() : PAGES[page]();
  main.replaceChildren(h("div", { class: page === "blog" ? "a-site a-doc" : "a-site p-page" }, head.el, ...blocks));
  enableMotion();
  splitLines(head.h1);
  main.querySelectorAll(".p-cover [data-reveal]").forEach((el) => el.classList.add("is-in"));
  return observeReveals(main);
}
