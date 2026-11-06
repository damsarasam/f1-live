// ASTRAEUS: the aerospace venture. A looping capture hero, then two scroll-told
// stories: the problem and the solution around Earth, and the mission in ten beats.
import { h, icon } from "../ui.js";
import { enableMotion, splitLines, observeReveals } from "../motion.js";
import { webglAvailable } from "../three/stage.js";
import { motionControl, mountScene, pinProgress } from "./scene-kit.js";
import { url } from "../config.js";

const mono = (text, cls = "") => h("p", { class: `a-mono ${cls}`.trim() }, text);

const CHAPTERS = [
  { id: "problem", label: "01 — The problem", title: "Earth Shouldn't Pay the Price for Human Progress.",
    text: "Growing demand for critical minerals drives resource-intensive mining, environmental destruction, habitat loss and pressure on Earth's finite ecosystems." },
  { id: "solution", label: "02 — The solution", title: "Mine Beyond Earth. Protect Our Home.",
    text: "Autonomous space mining could unlock extraterrestrial resources, support humanity's expansion into space and help reduce our reliance on Earth's natural reserves." },
];

const BEATS = [
  ["Lift-off", "A fully reusable super-heavy launcher climbs out over Earth with the prospecting craft aboard."],
  ["Hot staging", "The ship lights its engines while still attached; the booster flips and heads home."],
  ["Fleet dispatched", "In orbit the bay door rolls up and the fleet slides out one craft at a time, each unfolding its boom and arrays."],
  ["Target detected", "Lidar and cameras find the asteroid and lock on."],
  ["Net capture", "A net launches, spreads and wraps the tumbling rock."],
  ["Stabilise", "The ion engines pull steadily on the taut tether until the tumble stops."],
  ["Sample", "The arm reaches the surface and takes a sample."],
  ["Signal home", "The antenna turns to Earth and sends the findings back, or relays them through the fleet."],
  ["Next", "An onboard space research centre?"],
  ["Coming soon", "ASTRAEUS is in development. More when it's ready to fly."],
];

const CRAFT = [
  ["Nuclear-electric propulsion", "A compact fission reactor powers ion engines for the long, efficient cruise between asteroids. A conical shadow shield and a long boom keep its radiation away from the electronics; radiators along the boom shed its heat."],
  ["Origami solar arrays", "Two circular arrays, folded in the flasher pattern, pack into small drums for launch and open into wide discs of solar cells for extra power."],
  ["Autonomous tracking", "Lidar and navigation cameras on a gimballed head find, follow and lock onto asteroids without waiting for instructions from Earth."],
  ["Autonomous arm", "A six-joint arm with a three-finger gripper takes samples and works the surface on its own."],
  ["Net or legs", "A net in the nose for small asteroids; four legs that swing forward to land nose-first on the ones too massive to catch, keeping the reactor high above the dust."],
  ["A relay network", "When a craft can't see Earth, its message hops craft to craft by laser link until one of them can send it home."],
];

async function mountStory(host, factory, getProgress) {
  if (!webglAvailable()) { host.classList.add("is-static"); return null; }
  const story = await import("../three/story.js");
  return story[factory](host, getProgress);
}

export async function render(main) {
  const stops = [];

  // ---------- Hero ----------
  const heroStage = h("div", { class: "a-stage" });
  const title = h("h1", { id: "a-title" }, "Beyond Earth.", h("br"), "Within reach.");
  const hero = h("section", { class: "a-hero", "aria-labelledby": "a-title" },
    h("div", { class: "a-frame a-frame-hero" }, heroStage,
      h("div", { class: "a-hud", "aria-hidden": "true" },
        mono("ASTRAEUS · capture sequence", "a-hud-tl"), mono("Simulation", "a-hud-tr"),
        mono("Net + tether · nuclear-electric drive", "a-hud-bl"), mono("Target · small near-Earth asteroid", "a-hud-br"))),
    h("div", { class: "a-hero-copy" },
      title,
      h("div", { class: "a-hero-side" },
        h("p", { class: "a-lede", "data-reveal": true }, "Autonomous Asteroid Mining & Resource Intelligence"),
        h("a", { class: "a-cue", href: "#problem", "data-link": true, "data-reveal": true }, "The problem", icon("arrow")))));

  // ---------- Problem and solution: one pinned Earth, two chapters ----------
  const earthStage = h("div", { class: "a-story-stage" });
  const chapters = CHAPTERS.map((c) => h("article", { class: "a-chapter", id: c.id, "aria-labelledby": `${c.id}-title` },
    mono(c.label, "a-dim"), h("h2", { id: `${c.id}-title` }, c.title), h("p", {}, c.text)));
  const earthSection = h("section", { class: "a-story a-story-earth", "aria-label": "The problem and the solution" },
    h("div", { class: "a-story-pin" }, earthStage, h("div", { class: "a-chapters" }, ...chapters)));

  // ---------- Mission: one pinned scene, ten beats ----------
  const missionStage = h("div", { class: "a-story-stage" });
  const beats = BEATS.map(([name, text], i) => h("li", { class: "a-beat" },
    h("h3", {}, h("span", { class: "a-beat-num" }, String(i + 1).padStart(2, "0")), name), h("p", {}, text)));
  const steps = h("ol", { class: "a-steps", "aria-hidden": "true" }, ...BEATS.map(([name]) => h("li", {}, h("span", {}, name))));
  const missionSection = h("section", { class: "a-story a-story-mission", id: "mission", "aria-labelledby": "mission-title" },
    h("div", { class: "a-story-pin" },
      missionStage,
      h("div", { class: "a-mission-copy" }, h("h2", { id: "mission-title", class: "a-mono a-dim" }, "The mission"), h("ol", { class: "a-beats" }, ...beats)),
      steps));

  // ---------- Too massive to catch: the fleet lands instead, and the craft's design ----------
  const fleetStage = h("div", { class: "a-stage" });
  const fleet = h("section", { class: "a-fleet", id: "fleet", "aria-labelledby": "fleet-title" },
    h("div", { class: "a-fleet-head" },
      mono("The fleet", "a-dim"),
      h("h2", { id: "fleet-title", "data-reveal": true }, "Many asteroids at once"),
      h("p", { "data-reveal": true }, "Each craft tracks and scans its own asteroid to find out what it contains. One too massive to catch gets a lander instead. Out of sight of Earth, messages hop craft to craft until one can reach home.")),
    h("div", { class: "a-frame a-frame-fleet" }, fleetStage,
      h("div", { class: "a-hud", "aria-hidden": "true" }, mono("ASTRAEUS fleet · prospecting", "a-hud-tl"), mono("Relay · craft to craft to Earth", "a-hud-br"))),
    h("div", { class: "p-numbered a-craft" },
      h("header", { class: "p-section-head" }, mono("The craft")),
      h("ol", {}, ...CRAFT.map(([t, d], i) => h("li", { "data-reveal": true },
        h("span", { class: "p-num" }, String(i + 1).padStart(2, "0")), h("h3", {}, t), h("p", {}, d))))));

  // ---------- Closing ----------
  const closing = h("section", { class: "a-band a-band-bone", "aria-labelledby": "a-closing-title" },
    h("div", { class: "a-band-inner" },
      mono("ASTRAEUS · AeroLabs AI", "a-band-label"),
      h("h2", { id: "a-closing-title", "data-reveal": true }, "Engineer the future of space"),
      h("div", { class: "a-band-side", "data-reveal": true },
        h("p", {}, "ASTRAEUS is AeroLabs AI's aerospace venture. Read where it is heading, or explore the racing intelligence that is live today."),
        h("div", { class: "a-actions" },
          h("a", { class: "a-btn a-btn-dark", href: url("web", "/vision") }, "Our vision", icon("arrow")),
          h("a", { class: "a-link", href: url("vectra", "/") }, "Explore VECTRA", icon("arrow"))))));

  main.replaceChildren(h("div", { class: "a-site" }, hero, earthSection, missionSection, fleet, closing));
  enableMotion();
  splitLines(title);
  stops.push(observeReveals(main));
  hero.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));

  // Scroll positions drive the chapter and beat that are showing
  let earthP = 0, missionP = 0, shownChapter = -1, shownBeat = -1;
  const byScroll = [];
  const onScroll = () => {
    earthP = pinProgress(earthSection);
    missionP = pinProgress(missionSection);
    const chapter = earthP < 0.5 ? 0 : 1;
    if (chapter !== shownChapter) {
      shownChapter = chapter;
      chapters.forEach((c, i) => c.classList.toggle("is-current", i === chapter));
    }
    const beat = Math.min(BEATS.length - 1, Math.floor(missionP * BEATS.length));
    if (beat !== shownBeat) {
      shownBeat = beat;
      beats.forEach((b, i) => b.classList.toggle("is-current", i === beat));
      [...steps.children].forEach((s, i) => { s.classList.toggle("is-done", i < beat); s.classList.toggle("is-current", i === beat); });
    }
    // Idle (paused or reduced-motion) scenes still follow the scroll, one frame at a time
    byScroll.forEach((st) => { if (!st.isRunning()) st.draw(); });
  };
  addEventListener("scroll", onScroll, { passive: true });
  stops.push(() => removeEventListener("scroll", onScroll));
  onScroll();

  const [heroScene, earthScene, missionScene, fleetScene] = await Promise.all([
    mountScene(heroStage, "asteroidCapture"),
    mountStory(earthStage, "earthStory", () => earthP),
    mountStory(missionStage, "missionStory", () => missionP),
    mountScene(fleetStage, "fleetSurvey"),
  ]);
  byScroll.push(...[earthScene, missionScene].filter(Boolean));
  const stages = [heroScene, earthScene, missionScene, fleetScene].filter(Boolean);
  stops.push(...stages.map((st) => () => st.dispose()));
  // The hero and the fleet loop on their own; the stories move with the reader's scroll
  const control = motionControl([heroScene, fleetScene].filter(Boolean));
  if (control.el) { hero.querySelector(".a-frame").append(control.el); stops.push(control.stop); }

  return () => stops.forEach((stop) => stop());
}
