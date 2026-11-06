// The engine blueprint: a cut-away side elevation of the nuclear-electric drive,
// a detail cut through one ion engine, and how the energy flows from reactor to
// thrust. Drawn as SVG so it stays sharp at any size. Hovering or focusing a
// legend entry lights up the matching part of the drawing, and the reverse.
// REVIEW: a concept drawing, not to scale; no dimensions or ratings are given.
import { h } from "../ui.js";

const PARTS = [
  ["Ion engines", "Four gridded engines around the reactor, the only engines on board. Detail A shows one cut open."],
  ["Reactor core", "Fuel elements where fission makes heat. Nothing burns; there is no flame."],
  ["Reflector and control drums", "The reflector bounces neutrons back into the core. Each drum is lined on one side with a neutron absorber; turning the drums sets the reactor's power."],
  ["Heat pipes and converters", "Heat pipes carry heat out of the core to the converters around it, which turn part of that heat into electricity."],
  ["Shadow shield", "A layered shield, narrow at the reactor and wider forward, so its shadow covers the whole craft in front of it."],
  ["Propellant tank and feed lines", "Holds the propellant and meters it out to the four engines."],
  ["Power processing", "Turns the reactor's electricity into the steady high voltages the engines need."],
  ["Boom", "A deployable lattice. Distance cuts radiation too, so the boom works with the shield."],
  ["Radiators", "Only part of the heat becomes electricity. The rest must be radiated into space, which is why the radiators are the largest surfaces on the craft."],
  ["Sensor module", "Flight computer, radio, laser relay and tracking sensors, at the far end from the reactor."],
  ["Reaction wheels", "Spinning wheels that turn the craft without thrusters or propellant."],
  ["Origami solar arrays", "Folded flat for launch, opened into discs in flight: extra power, most of all near the Sun."],
];

const DETAIL = [
  ["Discharge chamber", "Propellant gas is ionised here: electrons knock electrons off its atoms, leaving a glowing plasma."],
  ["Magnet rings", "Rings of alternating poles keep the electrons spiralling near the wall, so each one ionises more gas before it is lost."],
  ["Hollow cathode", "Supplies the electrons that ionise the propellant."],
  ["Propellant inlet", "Gas from the tank, metered into the chamber."],
  ["Screen grid", "Holds the plasma back and lines the ions up with thousands of small holes."],
  ["Accelerator grid", "Held strongly negative. The voltage between the two grids pulls the ions through at very high speed."],
  ["Ion beam", "The exhaust. Throwing it backward pushes the craft forward, gently but for months."],
  ["Neutralizer", "Adds electrons to the beam, so the craft does not build up a charge and pull its own ions back."],
];

const LETTERS = "ABCDEFGH";

// A numbered callout: a ring with its label and a leader line to the part
const callout = (x, y, tx, ty, label) => `
  <line class="bp-lead" x1="${x}" y1="${y + (ty > y ? 13 : -13)}" x2="${tx}" y2="${ty}"/>
  <circle class="bp-tag" cx="${x}" cy="${y}" r="13"/>
  <text class="bp-tag-t" x="${x}" y="${y + 4}">${label}</text>`;

const part = (n, body, tag) => `<g class="bp-part" data-part="${n}">${body}${tag}</g>`;

// Lattice: two chords with alternating diagonals
function truss(x0, x1, y0, y1, step) {
  let d = `M${x0},${y0}H${x1}M${x0},${y1}H${x1}`;
  for (let x = x0, up = true; x < x1; x += step, up = !up) d += `M${x},${up ? y1 : y0}L${Math.min(x + step, x1)},${up ? y0 : y1}M${x},${y0}V${y1}`;
  return `<path d="${d}"/>`;
}

// Radiator panel with its coolant loops
function radiator(x, y, w, hgt) {
  let d = "";
  for (let yy = y + 12; yy < y + hgt - 6; yy += 12) d += `M${x + 8},${yy}H${x + w - 8}`;
  return `<rect class="bp-fill" x="${x}" y="${y}" width="${w}" height="${hgt}" rx="2"/><path class="bp-fine" d="${d}"/>`;
}

function engineCut(x, y) {
  // A small gridded engine in section: chamber, grids at the exit (left), plume
  return `<path class="bp-plume" d="M${x},${y + 6} L${x - 130},${y - 22} L${x - 130},${y + 82} L${x},${y + 54} Z"/>
    <path class="bp-fill" d="M${x},${y} H${x + 58} Q${x + 80},${y} ${x + 80},${y + 30} Q${x + 80},${y + 60} ${x + 58},${y + 60} H${x} Z"/>
    <path class="bp-fine" d="M${x + 4},${y + 4}V${y + 56}M${x + 9},${y + 4}V${y + 56}" stroke-dasharray="4 3"/>
    <path class="bp-fine" d="M${x + 80},${y + 30}H${x + 66}"/>`;
}

function elevation() {
  const fuel = Array.from({ length: 7 }, (_, i) => `M302,${230 + i * 10}H408`).join("");
  const hatch = Array.from({ length: 11 }, (_, i) => `M${304 + i * 10},188V200M${304 + i * 10},320V332`).join("");
  const s = [
    // 1 Ion engines, top and bottom (the other two are behind and in front of the reactor)
    part(1, engineCut(150, 140) + engineCut(150, 320)
      + `<path class="bp-fine" d="M230,170L292,226M230,350L292,294"/>`, callout(190, 38, 190, 140, 1)),
    // 2 Reactor core: fuel elements
    part(2, `<rect class="bp-core" x="300" y="224" width="110" height="72" rx="3"/><path class="bp-fine" d="${fuel}"/>`, callout(355, 502, 355, 296, 2)),
    // 3 Vessel, reflector and control drums
    part(3, `<path class="bp-fill" d="M290,205 A55,55 0 0 0 290,315 Z"/>
      <rect class="bp-hatch" x="290" y="205" width="130" height="14"/><rect class="bp-hatch" x="290" y="301" width="130" height="14"/>
      <rect class="bp-line" x="290" y="205" width="130" height="110"/>
      <g class="bp-drum"><rect x="318" y="207" width="28" height="10" rx="5"/><rect x="368" y="207" width="28" height="10" rx="5"/>
      <rect x="318" y="303" width="28" height="10" rx="5"/><rect x="368" y="303" width="28" height="10" rx="5"/></g>
      <path class="bp-absorb" d="M318,212h28v5h-28zM368,212h28v5h-28zM318,303h28v5h-28zM368,303h28v5h-28z"/>`, callout(330, 38, 330, 207, 3)),
    // 4 Heat pipes out to the converters around the reactor
    part(4, `<rect class="bp-fill" x="300" y="186" width="110" height="16"/><rect class="bp-fill" x="300" y="318" width="110" height="16"/>
      <path class="bp-fine" d="${hatch}"/>
      <path class="bp-heat" d="M322,226V200M355,226V200M388,226V200M322,294V320M355,294V320M388,294V320"/>`, callout(400, 38, 400, 186, 4)),
    // 5 Shadow shield, in section, two layers
    part(5, `<polygon class="bp-hatch" points="432,195 492,110 492,410 432,325"/>
      <polyline class="bp-fine" points="462,152 462,368"/>`, callout(462, 38, 462, 153, 5)),
    // 6 Propellant tank and the feed lines round the shield to the engines
    part(6, `<rect class="bp-fill" x="510" y="228" width="80" height="64" rx="32"/>
      <path class="bp-feed" d="M530,228V96H200V140M530,292V424H200V380"/>`, callout(550, 502, 550, 292, 6)),
    // 7 Power processing
    part(7, `<rect class="bp-fill" x="604" y="232" width="50" height="56" rx="2"/>
      <path class="bp-fine" d="M612,244h34M612,256h34M612,268h34M612,280h22"/>`, callout(629, 38, 629, 232, 7)),
    // 8 Boom
    part(8, `<g class="bp-line">${truss(656, 1000, 248, 272, 34)}</g>`, callout(672, 502, 672, 272, 8)),
    // 9 Radiators above and below the boom
    part(9, radiator(690, 150, 290, 86) + radiator(690, 284, 290, 86)
      + `<path class="bp-fine" d="M760,236V248M910,236V248M760,272V284M910,272V284"/>`, callout(835, 38, 835, 150, 9)),
    // 10 Sensor module
    part(10, `<polygon class="bp-fill" points="1000,205 1120,205 1165,240 1165,280 1120,315 1000,315"/>
      <rect class="bp-line" x="1010" y="216" width="38" height="28" rx="2"/><path class="bp-fine" d="M1016,224h26M1016,232h26M1016,240h16"/>
      <circle class="bp-line" cx="1150" cy="260" r="6"/><path class="bp-fine" d="M1165,260h16"/>`, callout(1140, 38, 1140, 220, 10)),
    // 11 Reaction wheels
    part(11, [1030, 1066, 1102].map((cx) => `<circle class="bp-line" cx="${cx}" cy="287" r="12"/><circle class="bp-fine" cx="${cx}" cy="287" r="3"/>`).join(""), callout(1066, 502, 1066, 299, 11)),
    // 12 Origami solar arrays, seen edge-on, with their fold lines
    part(12, `<rect class="bp-fill" x="1066" y="70" width="7" height="135"/><rect class="bp-fill" x="1066" y="315" width="7" height="135"/>
      <path class="bp-fine" d="${Array.from({ length: 8 }, (_, i) => `M1062,${82 + i * 16}h15M1062,${327 + i * 16}h15`).join("")}"/>`, callout(1069, 38, 1069, 70, 12)),
  ];
  return `<svg class="bp-svg" viewBox="0 0 1200 545" role="img" aria-labelledby="bp-main-t">
    <title id="bp-main-t">Cut-away side view of the ASTRAEUS craft: ion engines and reactor at the back, shadow shield, propellant tank and power processing, the boom with radiators, and the sensor module with reaction wheels and solar arrays at the front</title>
    <defs>
      <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,0H0V20" class="bp-grid"/></pattern>
      <pattern id="bp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V7" class="bp-hatch-l"/></pattern>
      <linearGradient id="bp-plume" x1="1" x2="0"><stop offset="0" stop-color="#7fe0ff" stop-opacity="0.55"/><stop offset="1" stop-color="#7fe0ff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1200" height="545" fill="url(#bp-grid)"/>
    <path class="bp-zone" d="M492,110 L600,0 H1200 V545 H600 L492,410 Z"/>
    <path class="bp-axis" d="M10,260H1190"/>
    <text class="bp-t" x="540" y="196">SHIELDED ZONE</text>
    <text class="bp-t" x="20" y="108">← THRUST</text>
    <text class="bp-t bp-t-end" x="1190" y="538">DIRECTION OF TRAVEL →</text>
    ${s.join("")}
  </svg>`;
}

function detail() {
  const beam = Array.from({ length: 9 }, (_, i) => { const y = 92 + i * 20, spread = (y - 170) * 0.35; return `M184,${y}L30,${y + spread}`; }).join("");
  const s = [
    part("a", `<path class="bp-fill" d="M200,70 H470 Q540,70 540,170 Q540,270 470,270 H200 Z"/><ellipse class="bp-plasma" cx="370" cy="170" rx="150" ry="78"/>`, callout(300, 322, 300, 270, "A")),
    part("b", [260, 340, 420].map((x, i) => `<rect class="${i % 2 ? "bp-mag-s" : "bp-mag-n"}" x="${x}" y="62" width="26" height="16"/><rect class="${i % 2 ? "bp-mag-n" : "bp-mag-s"}" x="${x}" y="262" width="26" height="16"/>`).join(""), callout(353, 22, 353, 62, "B")),
    part("c", `<rect class="bp-line" x="482" y="161" width="88" height="18" rx="3"/><circle class="bp-glow" cx="482" cy="170" r="7"/>`, callout(610, 200, 570, 176, "C")),
    part("d", `<path class="bp-feed" d="M624,118H560Q540,118 536,128"/>`, callout(610, 90, 600, 118, "D")),
    part("e", `<path class="bp-grid-e" d="M200,72V268"/>`, callout(215, 322, 200, 268, "E")),
    part("f", `<path class="bp-grid-f" d="M186,72V268"/>`, callout(170, 322, 186, 268, "F")),
    part("g", `<path class="bp-beam" d="${beam}"/>`, callout(60, 322, 60, 236, "G")),
    part("h", `<rect class="bp-line" x="120" y="24" width="44" height="14" rx="3" transform="rotate(20 142 31)"/><path class="bp-e" d="M128,46 Q110,70 104,96"/>`, callout(86, 22, 118, 30, "H")),
  ];
  return `<svg class="bp-svg" viewBox="0 0 640 345" role="img" aria-labelledby="bp-detail-t">
    <title id="bp-detail-t">One gridded ion engine cut open: discharge chamber with magnet rings, hollow cathode and propellant inlet at the back, two grids at the front, the ion beam, and the neutralizer beside it</title>
    <defs><radialGradient id="bp-plasma"><stop offset="0" stop-color="#9b7bff" stop-opacity="0.5"/><stop offset="1" stop-color="#9b7bff" stop-opacity="0"/></radialGradient></defs>
    <rect width="640" height="345" fill="url(#bp-grid)"/>
    <path class="bp-axis" d="M10,170H630"/>
    ${s.join("")}
  </svg>`;
}

const legend = (items, keys, cls) => h("ol", { class: `bp-legend ${cls}` },
  ...items.map(([name, text], i) => h("li", { "data-part": keys[i], tabindex: "0" },
    h("span", { class: "bp-key" }, String(keys[i]).toUpperCase()), h("b", {}, name), h("p", {}, text))));

const FLOW = [["Fission heat", "Reactor core"], ["Electricity", "Converters"], ["High voltage", "Power processing"], ["Thrust", "Ion engines"]];

// Link a drawing and its legend: hovering or focusing either side lights the part on both
function wire(scope) {
  const set = (key) => {
    scope.classList.toggle("has-hot", key != null);
    scope.querySelectorAll("[data-part]").forEach((el) => el.classList.toggle("is-hot", el.dataset.part === key));
  };
  scope.querySelectorAll("[data-part]").forEach((el) => {
    el.addEventListener("pointerenter", () => set(el.dataset.part));
    el.addEventListener("pointerleave", () => set(null));
    el.addEventListener("focus", () => set(el.dataset.part));
    el.addEventListener("blur", () => set(null));
  });
}

function sheet(cls, svg, title, ref) {
  const draw = h("div", { class: "bp-draw" });
  draw.innerHTML = svg;
  return h("figure", { class: `bp-sheet ${cls}` }, draw,
    h("figcaption", { class: "bp-block" },
      h("span", {}, title), h("span", {}, ref), h("span", {}, "Concept · not to scale")));
}

export function engineBlueprint(sectionHead) {
  const main = h("div", { class: "bp-set", "data-reveal": true },
    sheet("bp-sheet-main", elevation(), "ASTRAEUS · Nuclear-electric drive", "Section A–A · side elevation"),
    legend(PARTS, PARTS.map((_, i) => String(i + 1)), "bp-legend-main"));
  const cut = h("div", { class: "bp-set bp-set-detail", "data-reveal": true },
    sheet("bp-sheet-detail", detail(), "Detail A · gridded ion engine", "Cut along its axis"),
    legend(DETAIL, LETTERS.toLowerCase().split(""), "bp-legend-detail"));
  const flow = h("div", { class: "bp-flow", "data-reveal": true },
    h("p", { class: "a-mono" }, "Energy flow"),
    h("ol", {}, ...FLOW.map(([what, where]) => h("li", {}, h("b", {}, what), h("span", {}, where)))),
    h("p", { class: "bp-flow-waste" }, h("b", {}, "Waste heat"), " goes the other way: through the coolant loops to the radiators, and out into space as infrared light."));
  [main, cut].forEach(wire);
  return h("section", { class: "bp", id: "blueprint" },
    sectionHead("Blueprint", "Inside the drive"),
    h("p", { class: "bp-intro" }, "The craft cut open along its length, with one ion engine cut through in detail. Hover or tap a part to find it in the drawing."),
    main, cut, flow);
}
