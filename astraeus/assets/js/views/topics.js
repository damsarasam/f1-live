// ASTRAEUS topic pages: asteroid catching, the asteroid lab, the spaceship
// carrier, the engine and the blog. Each is a deep dive: a looping 3D frame, a
// summary, the sequence step by step, the design choices, the real missions
// that have already shown each idea, and what is still open.
// REVIEW: ASTRAEUS is a concept; nothing here is a specification or a schedule.
// The "Already shown in space" entries are public mission history.
import { h, icon } from "../ui.js";
import { enableMotion, splitLines, observeReveals } from "../motion.js";
import { webglAvailable } from "../three/stage.js";
import { motionControl, mountScene } from "./scene-kit.js";
import { url } from "../config.js";
import { engineBlueprint } from "./blueprint.js";

const mono = (text, cls = "") => h("p", { class: `a-mono ${cls}`.trim() }, text);
const img = (file, alt) => h("img", { src: `/assets/img/${file}`, alt, decoding: "async" });

const PAGES = {
  catching: {
    title: ["Asteroid", "catching"], label: "Asteroid catching",
    lede: "Two ways to take hold of an asteroid: net the small ones, land on the ones too massive to catch.",
    scene: "asteroidCapture", hud: ["Capture sequence", "Simulation"],
    summary: "Small asteroids tumble, have almost no gravity and can't be grabbed. So the craft finds its target, matches its motion, wraps it in a net on a tether and calms the spin. Asteroids too big to net get a lander instead.",
    steps: [
      ["Find and track", "Lidar and navigation cameras on a gimballed head pick the asteroid out against the stars, measure its size, shape and spin, and keep it locked while the craft closes in. All of it happens on board: a signal from Earth can take many minutes to arrive.", "track.jpg", "The craft's lidar beam sweeping a small asteroid"],
      ["Net", "A net folded in the nose fires on four weighted corners. The weights pull it open in flight; it meets the asteroid centre-first, then the corners wrap round behind. A tether keeps the net tied to the craft.", "net.jpg", "A net spreading in front of the asteroid on its tether"],
      ["Steady", "Once the tether is taut, the ion engines pull gently and steadily against it. Little by little the tumble dies away until the asteroid and the craft move together.", "steady.jpg", "The asteroid wrapped in the net, tether taut to the craft"],
      ["Land instead", "When an asteroid is too massive to net, four legs swing forward past the nose and the craft comes down nose-first. Anchor spikes in the footpads hold it to a surface whose gravity is too weak to keep it there, and the reactor and radiators stay high above the dust.", "land.jpg", "A craft standing nose-down on a large asteroid on four legs"],
    ],
    design: [
      ["A net, not a claw", "A net forgives a poor aim, wraps any shape and spreads the load over the whole rock."],
      ["Nose-first landing", "The legs sit at the sensor end, so the long boom points away from the surface."],
      ["Anchors", "With so little gravity, a lander that isn't anchored can bounce straight back off."],
      ["Autonomy", "Tracking, capture and touchdown run on board; Earth is too far away to steer them live."],
    ],
    proven: [
      ["2005", "Hayabusa", "Touched down on asteroid Itokawa and later returned the first asteroid grains to Earth."],
      ["2014", "Philae", "Landed on a comet, but its anchoring harpoons didn't fire and it bounced: why anchors matter."],
      ["2018", "RemoveDEBRIS", "Fired a net in orbit and captured a target, showing net capture works in space."],
      ["2019", "Hayabusa2", "Made two touchdowns on asteroid Ryugu and brought samples home in 2020."],
      ["2020", "OSIRIS-REx", "Collected a sample from asteroid Bennu; its surface turned out to be loose rubble that barely resisted."],
    ],
    open: ["How large an asteroid a net can hold", "How fast a tumble can still be caught", "How loose or solid each target's surface is"],
    band: ["Next: what's inside", "Every catch or landing ends with a sample. The asteroid lab is about what it tells us.", "/lab", "Asteroid lab"],
  },
  lab: {
    title: ["Asteroid", "lab"], label: "Asteroid lab",
    lede: "Finding out what an asteroid contains before anything is mined: scans from a distance, samples up close, and the question of a lab in space.",
    scene: "fleetSurvey", hud: ["Fleet · prospecting", "Relay · craft to craft to Earth"],
    summary: "Not every asteroid is worth the trip. The lab is the work of telling them apart: survey many from a distance, look closely at the promising ones, take samples and get the findings home.",
    steps: [
      ["Survey from a distance", "Each craft circles its own asteroid and maps it with lidar and cameras: its shape, spin, craters and boulders.", "scan.jpg", "A craft scanning an asteroid with its lidar"],
      ["Read the light", "Sunlight reflected off an asteroid carries the fingerprints of what it's made of. Splitting that light into its colours is how carbon-rich, stony and metal-rich asteroids are told apart.", "fleet.jpg", "The fleet spread across several asteroids, each scanning its own"],
      ["Samples up close", "On a netted or landed asteroid, the arm collects surface material for a closer look than any scan can give.", "land.jpg", "A landed craft working the surface with its arm"],
    ],
    design: [
      ["Many targets", "A fleet compares several asteroids in one mission instead of betting everything on one."],
      ["Relay", "A craft that can't see Earth passes its findings craft to craft by laser link until one can."],
      ["Work on site", "The open question: analysing samples at the asteroid rather than flying them home first."],
      ["An onboard research centre?", "A lab in space, at the asteroid. A concept for now."],
    ],
    proven: [
      ["2001", "NEAR Shoemaker", "Became the first spacecraft to land on an asteroid, Eros, after a year mapping it from orbit."],
      ["2011–2018", "Dawn", "Orbited Vesta and then Ceres, the two largest bodies in the asteroid belt, and mapped what they are made of."],
      ["2020", "Hayabusa2", "Returned samples from Ryugu that contain water-bearing minerals and organic compounds."],
      ["2023", "OSIRIS-REx", "Delivered its sample of Bennu to Earth: carbon-rich and full of water-bearing clays."],
      ["2023", "Psyche", "Launched toward a metal-rich asteroid, due to arrive in 2029."],
    ],
    open: ["Which instruments each craft carries", "What can be analysed on site and what must come home", "How findings are checked before anyone acts on them"],
    band: ["How the fleet gets there", "A reusable carrier takes the whole fleet to orbit in one launch.", "/carrier", "Spaceship carrier"],
  },
  carrier: {
    title: ["Spaceship", "carrier"], label: "Spaceship carrier",
    lede: "A fully reusable two-stage launcher that carries the fleet to orbit and releases it, one craft at a time.",
    scene: "missionStory", loop: [0, 0.285, 20], hud: ["Launch · hot staging · dispatch", "Simulation"],
    summary: "One launch, the whole fleet. A reusable booster and ship lift the folded craft to orbit; the ship opens its bay and sets them free one by one, then both stages are built to fly again.",
    steps: [
      ["Lift-off", "A stainless-steel booster and ship climb out together, tipping over gradually onto the path to orbit.", "launch.jpg", "The launcher climbing above Earth"],
      ["Hot staging", "The ship lights its engines while it is still attached; a vented ring between the stages lets the exhaust out. The booster drops away, opens its grid fins, flips and heads home.", "staging.jpg", "The ship pulling away as the booster turns for home"],
      ["Open the bay", "In orbit the ship tips over and its bay door rolls up into a housing above the opening, like a shutter. The fleet is stacked inside, folded for launch.", "bay.jpg", "The ship's open bay with folded craft stacked inside"],
      ["Dispatch", "The craft slide out along deck rails, top first, and drift clear before they start unfolding their booms and solar arrays.", "dispatch.jpg", "Craft leaving the bay one after another"],
    ],
    design: [
      ["Fully reusable", "Both stages are built to come back, so a launch costs far less than building a new rocket."],
      ["Stainless steel", "Steel copes with the heat of re-entry and the cold of deep space; heat tiles cover the side that faces the air."],
      ["A roll-up door", "It needs no room to swing open and keeps the opening clear for the craft to leave."],
      ["Folded craft", "Booms retracted and arrays wrapped into drums, so several craft fit in one bay."],
    ],
    proven: [
      ["1962", "Titan II", "First flew with hot staging: its second stage lit while still attached to the first."],
      ["1981–2011", "Space Shuttle", "Carried satellites and spacecraft to orbit in a payload bay with opening doors."],
      ["2015", "Booster landings", "An orbital-class booster landed upright after launch for the first time; reflown boosters followed from 2017."],
      ["2017", "PSLV-C37", "Released 104 satellites from a single rocket, one after another."],
    ],
    open: ["How many craft one bay carries", "The final door and rail design", "Whether the ship refuels in orbit before heading on"],
    band: ["The drive that takes them", "How each craft crosses the distance to its asteroid.", "/engine", "Engine"],
  },
  engine: {
    title: ["Nuclear-electric", "propulsion"], label: "Engine",
    lede: "A compact fission reactor makes electricity; gridded ion engines turn it into a gentle, long-lasting push for the cruise between asteroids.",
    scene: "engineShowcase", blueprint: true, hud: ["Nuclear-electric drive", "Simulation"],
    summary: "Chemical rockets push hard for minutes. Ion engines push very gently for months, using a fraction of the propellant. Far from the Sun, sunlight is too weak to power them well, so a small reactor provides the electricity instead.",
    steps: [
      ["The reactor", "A compact fission reactor at the very back of the craft makes heat; the fins around it convert that heat into electricity for the engines and everything else on board.", "reactor.jpg", "The reactor end of the craft: reactor, shield and four ion engines"],
      ["Shield, boom and radiators", "A cone-shaped shield narrows toward the reactor so its shadow covers the rest of the craft. A long lattice boom adds distance, and the large panels along it shed the reactor's waste heat into space.", "engine-side.jpg", "The whole craft side-on: sensor module, boom with radiators, reactor"],
      ["Origami solar arrays", "Two circular arrays, folded in the flasher pattern, open into wide discs. They add power, most of all closer to the Sun.", "arrays.jpg", "The sensor module with its two circular origami solar arrays"],
    ],
    design: [
      ["Ion engines", "They accelerate charged particles to very high speed: a push about the weight of a sheet of paper that can run for months."],
      ["Why nuclear", "Sunlight fades fast with distance from the Sun; a reactor makes the same power anywhere."],
      ["Distance and shadow", "The shield and boom together keep radiation away from the electronics in the sensor module."],
      ["No small thrusters", "Steering is done by spinning wheels inside the craft, so the ion engines are the only engines."],
    ],
    proven: [
      ["1965", "SNAP-10A", "The first nuclear reactor operated in space, powering a satellite in Earth orbit."],
      ["1995", "Space Flyer Unit", "Deployed a solar array folded with the Miura origami pattern."],
      ["1998", "Deep Space 1", "The first spacecraft to use an ion engine as its main propulsion."],
      ["2003–2005", "Prometheus", "A NASA study of a nuclear-electric spacecraft for Jupiter's moons, stopped before it flew."],
      ["2007–2018", "Dawn", "Used ion engines to orbit two different worlds in the asteroid belt, Vesta and Ceres."],
    ],
    open: ["The reactor's size and power", "The propellant the ion engines use", "The radiator area and the launch safety approvals a reactor needs"],
    band: ["See the whole mission", "From lift-off to a signal home, step by step.", "/#mission", "The mission"],
  },
};

/** The ASTRAEUS blog: nothing posted yet */
function blog(main) {
  const title = h("h1", { id: "p-title" }, "Blog");
  main.replaceChildren(h("div", { class: "a-site a-doc" },
    h("header", { class: "a-doc-head" }, title,
      h("p", { class: "a-doc-lede", "data-reveal": true }, "Notes from the ASTRAEUS mission as it takes shape. The first posts are on their way."),
      h("div", { class: "a-actions a-doc-actions", "data-reveal": true },
        h("a", { class: "a-btn a-btn-light", href: "/", "data-link": true }, "The mission", icon("arrow")),
        h("a", { class: "a-btn a-btn-ghost", href: url("web", "/blog") }, "AeroLabs AI blog", icon("arrow"))))));
  enableMotion();
  splitLines(title);
  return observeReveals(main);
}

async function mount(host, page) {
  if (!webglAvailable()) { host.classList.add("is-static"); return null; }
  if (page.loop) {
    // A scroll story played on a timer: run through its first steps, hold, then start again
    const [from, to, seconds] = page.loop;
    const story = await import("../three/story.js");
    const t0 = performance.now();
    return story[page.scene](host, () => {
      const k = ((performance.now() - t0) / 1000 % seconds) / seconds;
      return from + (to - from) * Math.min(1, k / 0.85);
    });
  }
  return mountScene(host, page.scene);
}

const sectionHead = (label, title) => h("header", { class: "t-head" }, mono(label), title ? h("h2", { "data-reveal": true }, title) : null);

export async function render(main, { page: key }) {
  if (key === "blog") return blog(main);
  const page = PAGES[key];
  const stops = [];
  const stage = h("div", { class: "a-stage" });
  const title = h("h1", { id: "t-title" }, ...page.title.flatMap((line, i) => (i ? [h("br"), line] : [line])));
  const hero = h("section", { class: "a-hero", "aria-labelledby": "t-title" },
    h("div", { class: "a-frame a-frame-hero" }, stage,
      h("div", { class: "a-hud", "aria-hidden": "true" }, mono(page.hud[0], "a-hud-tl"), mono(page.hud[1], "a-hud-br"))),
    h("div", { class: "a-hero-copy" },
      title,
      h("div", { class: "a-hero-side" },
        h("p", { class: "a-lede", "data-reveal": true }, page.lede),
        h("a", { class: "a-cue", href: "#how", "data-link": true, "data-reveal": true }, "How it works", icon("arrow")))));

  const summary = h("section", { class: "p-statement", id: "how", "data-reveal": true }, mono("In short"), h("p", {}, page.summary));

  // Step by step: each stage with its own illustration, alternating sides
  const steps = h("section", { class: "t-steps" },
    sectionHead("Step by step"),
    ...page.steps.map(([name, text, file, alt], i) => h("article", { class: `p-split${i % 2 ? " is-flip" : ""}` },
      h("figure", { class: "p-split-media", "data-reveal": "clip" }, img(file, alt)),
      h("div", { class: "p-split-copy", "data-reveal": true },
        mono(String(i + 1).padStart(2, "0")),
        h("h2", {}, name),
        h("p", {}, text)))));

  const design = h("section", { class: "p-numbered" },
    sectionHead("Design choices", "Why it's built this way"),
    h("ol", { class: "t-four" }, ...page.design.map(([t, d], i) => h("li", { "data-reveal": true },
      h("span", { class: "p-num" }, String(i + 1).padStart(2, "0")), h("h3", {}, t), h("p", {}, d)))));

  const proven = h("section", { class: "t-proven" },
    sectionHead("Already shown in space", "Built on missions that flew"),
    h("ul", {}, ...page.proven.map(([year, name, text]) => h("li", { "data-reveal": true },
      h("span", { class: "t-year" }, year), h("b", {}, name), h("p", {}, text)))),
    h("p", { class: "t-note" }, "Public mission history, for context. ASTRAEUS is not connected to these missions."));

  const open = h("section", { class: "t-open" },
    sectionHead("Still open", "Not decided yet"),
    h("ul", {}, ...page.open.map((t) => h("li", { "data-reveal": true }, t))),
    h("p", { class: "t-note" }, "ASTRAEUS is a concept in development. The craft and mission shown here are designs, not flight hardware, and there are no launch dates."));

  const [bandTitle, bandText, bandHref, bandCta] = page.band;
  const band = h("section", { class: "a-band a-band-bone" },
    h("div", { class: "a-band-inner" },
      mono("ASTRAEUS", "a-band-label"),
      h("h2", { "data-reveal": true }, bandTitle),
      h("div", { class: "a-band-side", "data-reveal": true },
        h("p", {}, bandText),
        h("div", { class: "a-actions" },
          h("a", { class: "a-btn a-btn-dark", href: bandHref, "data-link": true }, bandCta, icon("arrow")),
          h("a", { class: "a-link", href: url("web", "/astraeus") }, "About ASTRAEUS", icon("arrow"))))));

  main.replaceChildren(h("div", { class: "a-site p-page" }, hero, summary, steps, page.blueprint ? engineBlueprint(sectionHead) : null, design, proven, open, band));
  enableMotion();
  splitLines(title);
  stops.push(observeReveals(main));
  hero.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));

  const scene = await mount(stage, page);
  if (scene) {
    stops.push(() => scene.dispose());
    const control = motionControl([scene]);
    if (control.el) { hero.querySelector(".a-frame").append(control.el); stops.push(control.stop); }
  }
  return () => stops.forEach((stop) => stop());
}
