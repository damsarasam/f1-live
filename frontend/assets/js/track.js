// Circuit maps: fastest-lap replay and live car positions.
import { h, s, icon, teamColour, lapTime } from "./ui.js";

const W = 1000;
const PAD = 40;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fit [x, y] points into the viewBox; returns a projector and the viewBox height. */
function fit(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const scale = (W - PAD * 2) / Math.max(maxX - minX, 1);
  const height = Math.min(Math.max((maxY - minY) * scale + PAD * 2, 320), 760);
  const yScale = Math.min(scale, (height - PAD * 2) / Math.max(maxY - minY, 1));
  const k = Math.min(scale, yScale);
  const offX = (W - (maxX - minX) * k) / 2;
  const offY = (height - (maxY - minY) * k) / 2;
  // Telemetry y grows upwards; SVG y grows downwards
  return { project: (x, y) => [offX + (x - minX) * k, height - (offY + (y - minY) * k)], height };
}

function pathFrom(points, project) {
  return points.map(([x, y], i) => { const [px, py] = project(x, y); return `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`; }).join("") + "Z";
}

// Slow → fast: blue, broadcast red, yellow
const STOPS = [[76, 111, 255], [225, 6, 0], [255, 209, 46]];
function speedColour(t) {
  const x = Math.min(Math.max(t, 0), 1) * (STOPS.length - 1);
  const i = Math.min(Math.floor(x), STOPS.length - 2);
  const f = x - i;
  const c = STOPS[i].map((v, j) => Math.round(v + (STOPS[i + 1][j] - v) * f));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/** Fastest lap replay. data: /fastest-lap payload. */
export function lapReplay(data) {
  const pts = data.points; // [x, y, speed, t]
  const { project, height } = fit(pts);
  const speeds = pts.map((p) => p[2]);
  const minS = Math.min(...speeds), maxS = Math.max(...speeds);
  const duration = pts[pts.length - 1][3];

  const segs = s("g");
  const lines = [];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = project(pts[i - 1][0], pts[i - 1][1]);
    const [x2, y2] = project(pts[i][0], pts[i][1]);
    const line = s("line", { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1),
      stroke: speedColour((pts[i][2] - minS) / (maxS - minS || 1)), "stroke-width": 6, "stroke-linecap": "round", opacity: 0 });
    lines.push(line);
    segs.append(line);
  }
  const car = s("g", { class: "replay-car" }, s("circle", { r: 9 }), s("circle", { r: 3.5, fill: teamColour(data.driver.colour) || "#e10600" }));
  const [sx, sy] = project(pts[0][0], pts[0][1]);
  const startLine = s("circle", { cx: sx, cy: sy, r: 5, fill: "none", stroke: "#fff", "stroke-width": 2 });
  const svg = s("svg", { viewBox: `0 0 ${W} ${height}`, role: "img", "aria-label": `Track map of ${data.driver.name}'s fastest lap, coloured by speed from ${minS} to ${maxS} km/h` },
    s("path", { class: "track-outline", d: pathFrom(pts, project) }), segs, startLine, car);

  const speedOut = h("dd", {}, "--", h("small", {}, "km/h"));
  const clockOut = h("dd", {}, "0:00.000");
  const playBtn = h("button", { class: "btn", type: "button" });
  let rate = 4, t = 0, last = null, playing = false, frame = null, shown = 0;

  function draw(time) {
    // Reveal segments up to `time` (time only moves forward; play() resets) and place the car by interpolation
    let i = shown;
    while (i < lines.length && pts[i + 1][3] <= time) { lines[i].setAttribute("opacity", 1); i++; }
    shown = i;
    const k = Math.min(i, pts.length - 2);
    const a = pts[k], b = pts[k + 1];
    const f = b[3] > a[3] ? Math.min(Math.max((time - a[3]) / (b[3] - a[3]), 0), 1) : 0;
    const [x, y] = project(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
    car.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    speedOut.firstChild.textContent = Math.round(a[2] + (b[2] - a[2]) * f);
    // Telemetry stops a fraction before the line; scale so the clock ends on the official lap time
    clockOut.textContent = lapTime(Math.min(time, duration) * (data.lap_seconds / duration));
  }
  function setButton() {
    playBtn.replaceChildren(icon(playing ? "pause" : t >= duration ? "replay" : "play"), playing ? "Pause" : t >= duration ? "Replay" : "Play");
    playBtn.setAttribute("aria-label", playing ? "Pause lap replay" : "Play lap replay");
  }
  function tick(now) {
    if (last !== null) t = Math.min(t + ((now - last) / 1000) * rate, duration);
    last = now;
    draw(t);
    if (t >= duration) { playing = false; setButton(); return; }
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (t >= duration) { t = 0; shown = 0; lines.forEach((l) => l.setAttribute("opacity", 0)); }
    playing = true; last = null; setButton(); frame = requestAnimationFrame(tick);
  }
  function pause() { playing = false; cancelAnimationFrame(frame); setButton(); }
  playBtn.addEventListener("click", () => (playing ? pause() : play()));

  const rates = h("div", { class: "seg", role: "group", "aria-label": "Replay speed" },
    [1, 4, 10].map((r) => h("button", { type: "button", "aria-pressed": String(r === rate), onclick: (e) => {
      rate = r; for (const b of e.currentTarget.parentNode.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
    } }, `${r}×`)));

  const el = h("div", { class: "track panel" },
    h("dl", { class: "track-readout" },
      h("div", { class: "readout readout-driver" }, h("dt", {}, "Fastest lap"), h("dd", {}, h("i", { "--team": teamColour(data.driver.colour) }), data.driver.code)),
      h("div", { class: "readout" }, h("dt", {}, "Lap time"), h("dd", {}, data.lap_time)),
      h("div", { class: "readout" }, h("dt", {}, "Top speed"), h("dd", {}, data.top_speed, h("small", {}, "km/h"))),
      h("div", { class: "readout" }, h("dt", {}, "Replay clock"), clockOut),
      h("div", { class: "readout" }, h("dt", {}, "Car speed"), speedOut),
    ),
    svg,
    h("div", { class: "track-foot" },
      h("div", { class: "speed-scale" }, h("span", {}, `${Math.round(minS)}`), h("span", { "aria-hidden": "true" }), h("span", {}, `${Math.round(maxS)} km/h`)),
      h("div", { class: "replay-controls" }, playBtn, rates),
    ),
  );

  if (reducedMotion()) { t = duration; draw(duration); setButton(); }
  else {
    setButton();
    // Start the replay once the map scrolls into view
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); play(); }
    }, { threshold: 0.35 });
    requestAnimationFrame(() => io.observe(svg));
  }
  el.destroy = () => cancelAnimationFrame(frame);
  return el;
}

/** Live/latest car positions on the circuit outline. Call .update(cars) to move them. */
export function liveMap({ outline, cars }) {
  const basis = outline.length > 10 ? outline : cars.map((c) => [c.x, c.y]);
  const { project, height } = fit(basis);
  const carsLayer = s("g");
  const svg = s("svg", { viewBox: `0 0 ${W} ${height}`, role: "img", "aria-label": "Circuit map with car positions" },
    outline.length > 10 ? s("path", { class: "track-outline", d: pathFrom(outline, project) }) : null,
    outline.length > 10 ? s("path", { class: "track-outline-inner", d: pathFrom(outline, project) }) : null,
    carsLayer);
  const markers = new Map();

  function update(list) {
    const seen = new Set();
    for (const c of list) {
      if (c.x === null || c.y === null) continue;
      seen.add(c.number);
      const [x, y] = project(c.x, c.y);
      let g = markers.get(c.number);
      if (!g) {
        g = s("g", { class: "track-car" },
          s("line", { class: "track-leader", x1: 0, y1: 0, x2: 0, y2: 0 }),
          s("circle", { r: 8, fill: teamColour(c.colour) || "#888" }),
          s("text", { x: 12, y: -10 }, c.code || c.number));
        g.pos = [0, 0];
        markers.set(c.number, g);
        carsLayer.append(g);
        g.style.transition = "none";
        requestAnimationFrame(() => (g.style.transition = ""));
      }
      g.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      g.pos = [x, y];
    }
    for (const [n, g] of markers) if (!seen.has(n)) { g.remove(); markers.delete(n); }
    placeLabels();
  }

  // Greedy label placement: try positions around each marker until its code
  // overlaps no label already placed; far positions get a leader line
  function placeLabels() {
    const list = [...markers.values()].sort((a, b) => a.pos[0] - b.pos[0]);
    // Every car's marker is an obstacle as well as every label already placed
    const markerSize = list.length ? parseFloat(getComputedStyle(list[0].querySelector("text")).fontSize) * 0.75 || 10 : 10;
    const markerBoxes = list.map((g) => [g.pos[0] - markerSize, g.pos[1] - markerSize, markerSize * 2, markerSize * 2]);
    const placed = [];
    for (const g of list) {
      const text = g.querySelector("text");
      const leader = g.querySelector(".track-leader");
      const fontSize = parseFloat(getComputedStyle(text).fontSize) || 13;
      const w = (text.textContent.length * 0.62 + 0.3) * fontSize;
      const hgt = fontSize;
      const r = fontSize * 0.9;
      const candidates = [
        [r, -r * 0.8], [r, r * 1.6], [-r - w, -r * 0.8], [-r - w, r * 1.6],
        [r * 1.6, -r * 2.4], [-r * 1.6 - w, -r * 2.4], [r * 1.6, r * 3.2], [-r * 1.6 - w, r * 3.2],
        [-w / 2, -r * 3.4], [-w / 2, r * 4.2],
      ];
      let chosen = candidates[0], index = 0;
      for (let i = 0; i < candidates.length; i++) {
        const [dx, dy] = candidates[i];
        const box = [g.pos[0] + dx, g.pos[1] + dy - hgt, w, hgt * 1.15];
        const hits = (b) => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1];
        if (!placed.some(hits) && !markerBoxes.some(hits)) {
          chosen = candidates[i]; index = i; break;
        }
      }
      placed.push([g.pos[0] + chosen[0], g.pos[1] + chosen[1] - hgt, w, hgt * 1.15]);
      text.setAttribute("x", chosen[0].toFixed(1));
      text.setAttribute("y", chosen[1].toFixed(1));
      const far = index >= 4;
      leader.setAttribute("x2", far ? (chosen[0] + (chosen[0] < 0 ? w : 0)).toFixed(1) : 0);
      leader.setAttribute("y2", far ? (chosen[1] - hgt * 0.35).toFixed(1) : 0);
    }
  }
  const el = h("div", { class: "track panel" }, svg);
  // Labels need computed font sizes, so lay out once the map is in the document
  requestAnimationFrame(() => update(cars));
  update(cars);
  el.update = update;
  return el;
}

/**
 * Full-bleed looping replay for the landing hero. Calls onFrame({speed, clock})
 * every frame so HUD readouts outside the SVG can follow the car.
 */
// The whole lap shows faintly from the first frame so the speed colours read at a glance
const GHOST = 0.32;

export function heroReplay(data, { onFrame = () => {}, rate = 4, loops = Infinity } = {}) {
  const pts = data.points;
  const { project, height } = fit(pts);
  const speeds = pts.map((p) => p[2]);
  const minS = Math.min(...speeds), maxS = Math.max(...speeds);
  const duration = pts[pts.length - 1][3];
  const toLapClock = (t) => t * (data.lap_seconds / duration);

  // Two layers of the same segments: the ghost group fades the whole lap as one
  // layer (per-segment opacity would bead where round caps overlap), and the
  // live layer paints each segment at full strength behind the car
  const lines = [];
  const ghost = s("g", { opacity: GHOST });
  const segs = s("g");
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = project(pts[i - 1][0], pts[i - 1][1]);
    const [x2, y2] = project(pts[i][0], pts[i][1]);
    const attrs = { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1),
      stroke: speedColour((pts[i][2] - minS) / (maxS - minS || 1)), "stroke-width": 7, "stroke-linecap": "round" };
    ghost.append(s("line", attrs));
    const line = s("line", { ...attrs, opacity: 0 });
    lines.push(line);
    segs.append(line);
  }
  const car = s("g", { class: "replay-car" }, s("circle", { r: 11 }), s("circle", { r: 4.5, fill: teamColour(data.driver.colour) || "#e10600" }));
  const svg = s("svg", { class: "hero-circuit", viewBox: `0 0 ${W} ${height}`, preserveAspectRatio: "xMidYMid meet", role: "img",
    "aria-label": `${data.driver.name}'s fastest lap replaying around the circuit, coloured by speed from ${minS} to ${maxS} km/h` },
    s("path", { class: "track-outline hero-outline", d: pathFrom(pts, project) }), ghost, segs, car);

  let t = 0, last = null, shown = 0, frame = null, holdUntil = 0, laps = 0, running = false;
  function place(time) {
    let i = shown;
    while (i < lines.length && pts[i + 1][3] <= time) { lines[i].setAttribute("opacity", 1); i++; }
    shown = i;
    const k = Math.min(i, pts.length - 2);
    const a = pts[k], b = pts[k + 1];
    const f = b[3] > a[3] ? Math.min(Math.max((time - a[3]) / (b[3] - a[3]), 0), 1) : 0;
    const [x, y] = project(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
    car.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    onFrame({ speed: Math.round(a[2] + (b[2] - a[2]) * f), clock: toLapClock(Math.min(time, duration)) });
  }
  function reset() { t = 0; shown = 0; lines.forEach((l) => l.setAttribute("opacity", 0)); }
  function tick(now) {
    if (now < holdUntil) { last = now; frame = requestAnimationFrame(tick); return; }
    if (t >= duration) { reset(); }
    if (last !== null) t = Math.min(t + ((now - last) / 1000) * rate, duration);
    last = now;
    place(t);
    // Hold the completed lap on screen before the next loop
    if (t >= duration) {
      // After the last lap, rest on the completed trace
      if (++laps >= loops) { running = false; frame = null; return; }
      holdUntil = now + 2500;
    }
    frame = requestAnimationFrame(tick);
  }

  svg.minSpeed = Math.round(minS);
  svg.maxSpeed = Math.round(maxS);
  svg.rate = rate;
  svg.start = () => {
    if (reducedMotion()) { place(duration); return; }
    if (laps >= loops) { laps = 0; reset(); }
    cancelAnimationFrame(frame); last = null; running = true; frame = requestAnimationFrame(tick);
  };
  svg.stop = () => { cancelAnimationFrame(frame); running = false; };
  svg.isRunning = () => running;
  return svg;
}
