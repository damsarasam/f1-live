// Race tactics beyond tyres: pit window and undercut, safety car odds, and
// energy deployment with attack zones. data: /strategy/{year}/{round}/tactics payload.
import { h, s } from "./ui.js";
import { fitTrack } from "./track.js";

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const stat = (value, unit, label) => h("div", { class: "tac-stat" }, h("b", {}, value, unit ? h("small", {}, unit) : null), h("span", {}, label));
const call = (text) => h("p", { class: "tac-call" }, h("span", {}, "Call"), text);
const editions = (data) => data.seasons.filter((x) => x.status === "ok").map((x) => x.year);

// ---------- Pit window and undercut ----------
export function pitPanel(data) {
  const p = data.pit;
  if (!p) return null;
  const max = Math.max(...p.bins.map((b) => b.stops), 1);
  const swaps = p.undercuts + p.overcuts;
  const verdict = swaps < 3
    ? `Track position rules: in ${p.duels} close pit battles the order held ${p.held} times. Stop when the tyres demand it, not to attack.`
    : p.undercuts > p.overcuts
      ? `Undercut works here: stopping first beat the car ahead in ${p.undercuts} of ${swaps} position swaps. Box early if you're within two places.`
      : p.overcuts > p.undercuts
        ? `Overcut works here: staying out longer won ${p.overcuts} of ${swaps} swaps. Hold track position and let the rival stop first.`
        : `Undercut and overcut split evenly (${p.undercuts}–${p.overcuts}). The pit stop itself decides it.`;
  return h("section", { class: "tac" },
    h("div", { class: "tac-stats" },
      stat(p.lane_loss ?? "—", "s", "Pit lane time loss"),
      stat(`${Math.round(p.peak.from * 100)}–${Math.round(p.peak.to * 100)}`, "%", "Busiest stop window, race distance"),
      stat(p.undercuts, "", "Undercuts won"),
      stat(p.overcuts, "", "Overcuts won")),
    call(verdict),
    h("div", { class: "tac-panel" },
      h("p", { class: "tac-label" }, `When the field stopped · ${p.stops} stops`),
      h("div", { class: "tac-bins", role: "img", "aria-label": "Pit stops by share of race distance" },
        p.bins.map((b) => h("div", { class: `tac-bin${b === p.peak || b.stops === p.peak.stops ? " is-peak" : ""}`, title: `${Math.round(b.from * 100)}–${Math.round(b.to * 100)}%: ${b.stops} stops` },
          h("i", { style: { height: `${(b.stops / max) * 100}%` } }), h("span", {}, b.stops || "")))),
      h("div", { class: "tac-axis" }, h("span", {}, "Start"), h("span", {}, "Half distance"), h("span", {}, "Finish"))),
    p.examples.length ? h("div", { class: "tac-panel" },
      h("p", { class: "tac-label" }, "Position swaps through the stops"),
      h("ul", { class: "tac-duels" }, p.examples.map((d) => h("li", {},
        h("b", { class: d.result === "undercut" ? "is-under" : "is-over" }, d.result),
        h("span", {}, `${d.first} stopped lap ${d.lap}, ${d.second} ${d.gap_laps} lap${d.gap_laps > 1 ? "s" : ""} later: ${d.result === "undercut" ? d.first : d.second} came out ahead`))))) : null,
    h("p", { class: "tac-note" }, `From ${editions(data).join(", ")}. A close battle is two cars within two places when the first one stops; the second stops within six laps.`));
}

// ---------- Safety car ----------
export function safetyPanel(data) {
  const sf = data.safety;
  if (!sf) return null;
  const red = sf.editions.filter((e) => e.red_flag).length;
  const early = sf.editions.flatMap((e) => e.periods.filter((x) => x.kind !== "RED" && x.share < 0.15)).length;
  const verdict = sf.sc_races + sf.vsc_races === 0
    ? "No safety car in recent editions: plan the race on pace and tyres alone."
    : `${pct(Math.max(sf.sc_races, sf.vsc_races), sf.races)}% of recent races were neutralised. ${early ? "Opening laps are the danger zone; " : ""}keep a stop flexible so a safety car turns a 20-second pit stop into a cheap one.`;
  const kinds = { SC: "Safety car", VSC: "Virtual safety car", RED: "Red flag" };
  return h("section", { class: "tac" },
    h("div", { class: "tac-stats" },
      stat(`${sf.sc_races}/${sf.races}`, "", "Races with a safety car"),
      stat(`${sf.vsc_races}/${sf.races}`, "", "Races with a virtual safety car"),
      stat(`${red}/${sf.races}`, "", "Races red-flagged"),
      stat(pct(Math.max(sf.sc_races, sf.vsc_races), sf.races), "%", "Chance of a neutralisation")),
    call(verdict),
    h("div", { class: "tac-panel" },
      h("p", { class: "tac-label" }, "When it happened"),
      h("div", { class: "tac-timelines" }, sf.editions.map((e) => h("div", { class: "tac-timeline" },
        h("span", { class: "tac-year" }, e.year),
        h("div", { class: "tac-track" },
          e.periods.map((x) => h("i", {
            class: `is-${x.kind.toLowerCase()}`,
            style: { left: `${((x.start - 1) / e.total_laps) * 100}%`, width: x.kind === "RED" ? "3px" : `${Math.max(1, ((x.end - x.start + 1) / e.total_laps) * 100)}%` },
            title: `${kinds[x.kind]}: lap ${x.start}${x.end > x.start ? `–${x.end}` : ""}${x.stopped?.length ? `. Stopped: ${x.stopped.join(", ")}` : ""}`,
          }))),
        h("span", { class: "tac-laps" }, `${e.total_laps} laps`)))),
      h("div", { class: "tac-legend" }, ["sc", "vsc", "red"].map((k) => h("span", {}, h("i", { class: `is-${k}` }), kinds[k.toUpperCase()])))),
    h("div", { class: "tac-panel" },
      h("p", { class: "tac-label" }, "Who used it for a cheap stop"),
      h("ul", { class: "tac-duels" }, sf.editions.flatMap((e) => e.periods.filter((x) => x.kind !== "RED" && x.stopped.length).map((x) => h("li", {},
        h("b", { class: `k-${x.kind.toLowerCase()}` }, `${e.year} · ${x.kind}`),
        h("span", {}, `Lap ${x.start}: ${x.stopped.join(", ")}`)))))));
}

// ---------- Energy and attack ----------
export function energyPanel(data) {
  const a = data.attack;
  if (!a || !a.outline?.length) return null;
  const { project, height, width } = fitTrack(a.outline);
  const pts = a.outline.map(([x, y, f]) => [...project(x, y), f]);
  const at = (f) => { let best = pts[0]; for (const p of pts) if (Math.abs(p[2] - f) < Math.abs(best[2] - f)) best = p; return best; };
  const seg = (from, to) => pts.filter((p) => p[2] >= from && p[2] <= to).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  const outline = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + "Z";
  const zones = [...a.zones].sort((x, y) => x.from - y.from);
  const clips = zones.filter((z) => z.clip);
  const best = a.attack[0];
  const map = s("svg", { viewBox: `0 0 ${width} ${height}`, class: "tac-map", role: "img", "aria-label": `Circuit map with ${zones.length} full-throttle zones and ${a.all_overtakes} overtakes` },
    s("path", { d: outline, class: "tac-map-base" }),
    zones.map((z) => s("path", { d: seg(z.from, z.to), class: `tac-map-zone${best && z.index === best.index ? " is-best" : ""}` })),
    a.spots.map((f) => { const [x, y] = at(f); return s("circle", { cx: x, cy: y, r: 7, class: "tac-map-pass" }); }),
    clips.map((z) => { const [x, y] = at(z.clip_at); return s("g", { class: "tac-map-clip" }, s("circle", { cx: x, cy: y, r: 13 }), s("text", { x, y: y + 5, "text-anchor": "middle" }, "!")); }),
    zones.map((z) => { const [x, y] = at((z.from + z.to) / 2); return s("g", { class: "tac-map-label" }, s("rect", { x: x - 16, y: y - 16, width: 32, height: 32 }), s("text", { x, y: y + 6, "text-anchor": "middle" }, z.index)); }),
  );
  const verdict = best
    ? `Attack on zone ${best.index}: ${best.overtakes} of ${a.all_overtakes} passes happened there or into the corner after it. ${clips.length ? `Electric deployment ran out on ${clips.map((z) => `zone ${z.index}`).join(", ")}: harvest before and save the boost for the attack zone.` : "No sign of deployment running out on the fastest lap: the battery lasts a full straight here, so boost on exit to carry the speed."}`
    : "No clear attack zone in the data.";
  return h("section", { class: "tac" },
    h("div", { class: "tac-stats" },
      stat(zones.length, "", "Full-throttle zones"),
      stat(Math.round(zones.reduce((n, z) => n + z.seconds, 0) / a.lap_seconds * 100), "%", "Of the lap flat out"),
      stat(clips.length, "", "Where energy ran out"),
      stat(a.all_overtakes, "", `Overtakes, ${a.overtake_years.at(-1)}–${a.overtake_years[0]}`)),
    call(verdict),
    h("div", { class: "tac-energy" },
      h("div", { class: "tac-panel" }, map,
        h("div", { class: "tac-legend" },
          h("span", {}, h("i", { class: "is-zone" }), "Full throttle"),
          h("span", {}, h("i", { class: "is-best" }), "Best attack zone"),
          h("span", {}, h("i", { class: "is-pass" }), "Overtake"),
          h("span", {}, h("i", { class: "is-clip" }), "Energy ran out"))),
      h("ol", { class: "tac-zones" }, zones.map((z) => h("li", { class: best && z.index === best.index ? "is-best" : "" },
        h("span", { class: "tac-zone-n" }, z.index),
        h("div", {},
          h("b", {}, `${z.seconds} s flat out · ${z.top_speed} km/h`),
          h("span", {}, `${z.overtakes} overtake${z.overtakes === 1 ? "" : "s"}${z.clip ? ` · speed fell ${z.clip_loss} km/h before the brakes: deployment ran out` : ""}`)))))),
    h("p", { class: "tac-note" }, `Estimated from throttle and speed on the fastest lap of ${a.year} (${a.driver}, ${a.lap_seconds.toFixed(3)} s). Energy running out means speed fell while the throttle stayed fully open. Overtakes from ${a.overtake_years.join(", ")}, excluding lap 1 and places swapped in the pit lane.`));
}
