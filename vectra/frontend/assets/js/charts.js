// Stint bars and the speed comparison chart.
import { h, s, compound, teamColour } from "./ui.js";

function stintBlock(st, style) {
  const c = compound(st.compound);
  const laps = st.end - st.start + 1;
  const name = st.compound.charAt(0) + st.compound.slice(1).toLowerCase();
  return h("span", {
    class: "stint", style, "--c": c.color, "data-light": String(c.light),
    title: `${name}: laps ${st.start}–${st.end} (${laps} laps)`,
  }, c.letter);
}

/** Tyre stints per driver across the session. data: /stints payload. */
export function stintChart(data) {
  const total = data.total_laps;
  const ticks = [];
  const step = total > 40 ? 10 : 5;
  // Stop short of the end so the last tick never collides with the total
  for (let lap = step; lap <= total - step / 2; lap += step) ticks.push(lap);
  const rows = data.drivers.flatMap((d) => [
    h("span", { class: "stints-code", title: d.name }, d.code),
    h("div", { class: "stints-track" }, d.stints.map((st) => stintBlock(st, {
      left: `${((st.start - 1) / total) * 100}%`, width: `${((st.end - st.start + 1) / total) * 100}%`,
    }))),
  ]);
  return h("div", { class: "stints panel" },
    h("div", { class: "stints-grid", role: "img", "aria-label": `Tyre stints for ${data.drivers.length} drivers over ${total} laps` },
      rows,
      h("span"),
      h("div", { class: "stints-axis", "aria-hidden": "true" },
        h("span", { style: { left: "0%", transform: "none" } }, "Lap 1"),
        ticks.map((lap) => h("span", { style: { left: `${((lap - 1) / total) * 100}%` } }, lap)),
        h("span", { style: { right: "0", transform: "none" } }, total)),
    ),
  );
}

/** A strategy plan as one bar; stints: [{compound, laps}], total: race laps. */
export function planBar(stints, total) {
  const sum = stints.reduce((n, st) => n + st.laps, 0) || 1;
  const scale = Math.min(sum, total || sum);
  let lap = 1;
  return h("div", { class: "plan-bar" }, stints.map((st) => {
    const block = stintBlock({ compound: st.compound, start: lap, end: lap + st.laps - 1 }, { width: `calc(${(st.laps / scale) * 100}% - 2px)` });
    lap += st.laps;
    return block;
  }));
}

/** Two speed traces over lap distance with a hover crosshair. data: /compare payload. */
export function compareChart(data) {
  const [a, b] = data.drivers;
  const H = 320, R = 12, T = 12, B = 30;
  const maxD = Math.max(a.distance.at(-1) || 0, b.distance.at(-1) || 0) || 1;
  const allS = [...a.speed, ...b.speed];
  const minS = Math.floor(Math.min(...allS) / 50) * 50;
  const maxS = Math.ceil(Math.max(...allS) / 50) * 50;
  const colourA = teamColour(a.colour) || "#4c6fff";
  let colourB = teamColour(b.colour) || "#e10600";
  const sameTeam = colourA.toLowerCase() === colourB.toLowerCase();
  if (sameTeam) colourB = "#f4f4f7";

  const tip = h("div", { class: "compare-tip", hidden: true });
  const plot = h("div", { class: "compare-plot" });
  const at = (d, dist) => {
    let lo = 0, hi = d.distance.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (d.distance[mid] < dist) lo = mid + 1; else hi = mid; }
    return d.speed[lo];
  };

  // Drawn in real pixels at the container's width, so text never stretches
  function draw(W) {
    const L = W < 500 ? 34 : 46;
    const x = (d) => L + (d / maxD) * (W - L - R);
    const y = (v) => T + (1 - (v - minS) / (maxS - minS || 1)) * (H - T - B);
    const path = (d) => d.distance.map((dist, i) => `${i ? "L" : "M"}${x(dist).toFixed(1)} ${y(d.speed[i]).toFixed(1)}`).join("");
    const grid = [];
    for (let v = minS; v <= maxS; v += 50) {
      grid.push(s("line", { class: "gridline", x1: L, x2: W - R, y1: y(v), y2: y(v) }), s("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, v));
    }
    const kmStep = W < 500 ? 2000 : 1000;
    const xTicks = [];
    for (let d = 0; d <= maxD; d += kmStep) xTicks.push(s("text", { x: x(d), y: H - 8, "text-anchor": d === 0 ? "start" : "middle" }, d === 0 ? "0" : `${d / 1000} km`));
    const cross = s("line", { class: "crosshair", y1: T, y2: H - B, visibility: "hidden" });
    const dotA = s("circle", { r: 4, fill: colourA, visibility: "hidden" });
    const dotB = s("circle", { r: 4, fill: colourB, visibility: "hidden" });
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
      "aria-label": `Speed over distance for ${a.code} and ${b.code} on their fastest laps` },
      s("g", { class: "axis" }, grid, xTicks),
      s("path", { class: "compare-line", d: path(a), stroke: colourA }),
      s("path", { class: "compare-line", d: path(b), stroke: colourB, "stroke-dasharray": sameTeam ? "6 4" : null }),
      cross, dotA, dotB);

    function leave() { [cross, dotA, dotB].forEach((n) => n.setAttribute("visibility", "hidden")); tip.hidden = true; }
    svg.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      if (px < L || px > W - R) return leave();
      const dist = ((px - L) / (W - L - R)) * maxD;
      const sa = at(a, dist), sb = at(b, dist);
      cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
      dotA.setAttribute("cx", px); dotA.setAttribute("cy", y(sa)); dotA.setAttribute("visibility", "visible");
      dotB.setAttribute("cx", px); dotB.setAttribute("cy", y(sb)); dotB.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.replaceChildren(
        h("div", { class: "muted" }, `${(dist / 1000).toFixed(2)} km`),
        h("div", {}, h("b", { style: { color: colourA } }, a.code), ` ${sa} km/h`),
        h("div", {}, h("b", { style: { color: colourB } }, b.code), ` ${sb} km/h`),
      );
      tip.style.left = `${px > W / 2 ? px - 170 : px + 16}px`;
    });
    svg.addEventListener("pointerleave", leave);
    plot.replaceChildren(svg);
  }

  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width && width !== lastWidth) { lastWidth = width; draw(width); }
  }).observe(plot);

  const legend = h("div", { class: "legend" },
    [[a, colourA, false], [b, colourB, sameTeam]].map(([d, c, dashed]) => h("span", { class: "tyre-label" },
      s("svg", { width: 26, height: 6, "aria-hidden": "true" },
        s("line", { x1: 0, x2: 26, y1: 3, y2: 3, stroke: c, "stroke-width": 3, "stroke-dasharray": dashed ? "6 4" : null })),
      h("b", { style: { color: c } }, d.code), d.lap_time ? `${d.lap_time} (lap ${d.lap_number})` : "no timed lap")));
  return h("div", { class: "compare-chart" }, plot, tip, legend);
}
