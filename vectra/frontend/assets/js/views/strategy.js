import { api, forget } from "../api.js";
import { h, calendar, yearSelect, stripHeader, sectionHead, loading, errorState, state, teamColour } from "../ui.js";
import { planBar } from "../charts.js";
import { pitPanel, safetyPanel, energyPanel } from "../tactics.js";

const STATUS = {
  "not held": "This Grand Prix wasn't held that season.",
  "no lap data": "No lap data is available for that season.",
  unavailable: "That race couldn't be loaded.",
};

function upcoming(events) {
  const today = new Date();
  return (events.find((e) => new Date(e.date) >= today) || events.at(-1)).round;
}

let lastRace = null;

export async function render(main, params, navigate) {
  const year = params.year || new Date().getFullYear();
  let schedule;
  try { schedule = await api(`/schedule/${year}`); } catch (err) { main.replaceChildren(errorState(err, { retry: () => render(main, params, navigate) })); return; }
  if (!params.round) { navigate(`/strategy/${year}/${upcoming(schedule.events)}`, { replace: true }); return; }
  const event = schedule.events.find((e) => e.round === params.round);

  const body = h("div", {}, loading("Analysing ten seasons of strategy…", "Each past race loads the first time you open this Grand Prix; that can take a minute."));
  main.replaceChildren(
    h("div", { class: "picker" },
      h("div", { class: "picker-row" }, yearSelect(year, (y) => navigate(`/strategy/${y}`), { min: 2021, max: new Date().getFullYear() + 1 })),
      calendar(schedule.events, params.round, (r) => navigate(`/strategy/${year}/${r}`))),
    body,
  );
  if (!event) { body.replaceChildren(state({ title: "Pick a Grand Prix", body: "Choose a round from the calendar above." })); return; }

  // One race's analysis at a time: drop the previous race's responses from memory
  const here = `/strategy/${year}/${params.round}`;
  if (lastRace && lastRace !== here) forget(lastRace);
  lastRace = here;

  let data;
  try { data = await api(`/strategy/${year}/${params.round}`); } catch (err) { body.replaceChildren(errorState(err, { retry: () => render(main, params, navigate) })); return; }

  const totalFinishes = data.plans.reduce((n, p) => n + p.count, 0);
  const plans = data.plans.length
    ? h("div", { class: "plans" }, data.plans.map((p, i) => {
      // Average stint lengths across the drivers who ran this plan
      const avg = p.compounds.map((c, j) => ({ compound: c, laps: Math.round(p.examples.reduce((n, e) => n + e.laps[j], 0) / p.examples.length) }));
      const total = Math.round(p.examples.reduce((n, e) => n + e.total, 0) / p.examples.length);
      const who = p.examples.map((e) => `${e.code} P${e.position} ${e.year}`).join(", ");
      return h("div", { class: `plan${i === 0 ? " is-top" : ""}` },
        h("span", { class: "plan-share" }, Math.round(p.share * 100), h("small", {}, "%")),
        h("div", {}, planBar(avg, total)),
        h("span", { class: "plan-meta", title: who }, h("b", {}, p.stops === 0 ? "No stop" : `${p.stops} stop${p.stops > 1 ? "s" : ""}`), h("br"), `${p.count} of ${totalFinishes} top-5 finishes`));
    }))
    : state({ title: "No strategy data", body: "None of the last ten editions of this race have lap data available." });

  // Seasons without data share one line instead of a card each
  const missing = data.races.filter((r) => r.status !== "ok");
  const missingNote = missing.length
    ? h("p", { class: "muted years-missing" }, Object.entries(missing.reduce((g, r) => { const why = STATUS[r.status] || r.status; (g[why] ||= []).push(r); return g; }, {}))
      .map(([why, rs]) => `${rs.map((r) => r.year).sort().join(", ")}: ${why}`).join(" · "))
    : null;
  const years = h("div", { class: "years" }, data.races.filter((r) => r.status === "ok").map((race) => h("section", { class: "year panel" },
    h("h3", {}, race.year, race.total_laps ? h("span", {}, `${race.total_laps} laps`) : null),
    race.status === "ok"
      ? race.finishers.map((f) => h("div", { class: "finisher" },
        h("span", { class: "pos" }, f.position),
        h("span", { class: "tower-code", style: { boxShadow: `inset 3px 0 0 ${teamColour(f.colour) || "transparent"}`, paddingLeft: "8px" } }, f.code),
        planBar(f.stints, race.total_laps)))
      : h("p", { class: "muted" }, STATUS[race.status] || race.status))));

  // Four strategies, one tab each; the three beyond tyres load on demand
  const tyres = h("div", {},
    h("section", {}, sectionHead("Plans that worked", { note: "Share of top-five finishes, bar shows average stint lengths" }), plans),
    h("section", { class: "section" }, sectionHead("By season", { note: `${data.races.length - missing.length} of ${data.races.length} editions have lap data` }), years, missingNote));
  const TABS = [
    ["tyres", "Tyres", "Which compounds and how many stops won"],
    ["pit", "Pit window", "When to stop, and whether the undercut works"],
    ["safety", "Safety car", "How often the race gets neutralised"],
    ["energy", "Energy & attack", "Where to harvest, where to boost and pass"],
  ];
  const panel = h("div", { class: "tac-body" }, tyres);
  let tactics = null;
  const loadTactics = () => tactics ??= api(`/strategy/${year}/${params.round}/tactics`);
  const show = async (key) => {
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === key)));
    const [, title, note] = TABS.find((t) => t[0] === key);
    if (key === "tyres") { panel.replaceChildren(tyres); return; }
    panel.replaceChildren(sectionHead(title, { note }), loading("Reading ten seasons of race data…", "Pit stops, race control and telemetry take a few seconds the first time."));
    try {
      const data = await loadTactics();
      if (tabs.querySelector('[aria-pressed="true"]').dataset.tab !== key) return;
      const view = { pit: pitPanel, safety: safetyPanel, energy: energyPanel }[key](data);
      panel.replaceChildren(sectionHead(title, { note }), view || state({ title: "Not enough data", body: "None of the last ten editions of this race have the data this needs. Pit, safety car and energy data starts in 2023." }));
    } catch (err) {
      tactics = null;
      panel.replaceChildren(sectionHead(title, { note }), errorState(err, { retry: () => show(key) }));
    }
  };
  const tabs = h("div", { class: "seg tac-tabs", role: "group", "aria-label": "Strategy" },
    TABS.map(([key, label]) => h("button", { type: "button", "data-tab": key, "aria-pressed": String(key === "tyres"), onclick: () => show(key) }, label)));

  body.replaceChildren(
    stripHeader({ tag: `R${String(event.round).padStart(2, "0")}`, title: event.name, meta: [h("span", {}, h("b", {}, "Strategy")), h("span", {}, `Last 10 editions · ${year - 10}–${year - 1}`)] }),
    tabs,
    panel,
  );
  // Start the slower analysis in the background so the other tabs open quickly
  loadTactics().catch(() => { tactics = null; });
}
