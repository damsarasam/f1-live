import { api } from "../api.js";
import { h, calendar, yearSelect, stripHeader, sectionHead, loading, errorState, state, teamColour } from "../ui.js";
import { planBar } from "../charts.js";

const STATUS = {
  "not held": "This Grand Prix wasn't held that season.",
  "no lap data": "No lap data is available for that season.",
  unavailable: "That race couldn't be loaded.",
};

function upcoming(events) {
  const today = new Date();
  return (events.find((e) => new Date(e.date) >= today) || events.at(-1)).round;
}

export async function render(main, params, navigate) {
  const year = params.year || new Date().getFullYear();
  let schedule;
  try { schedule = await api(`/schedule/${year}`); } catch (err) { main.replaceChildren(errorState(err, { retry: () => render(main, params, navigate) })); return; }
  if (!params.round) { navigate(`/f1/strategy/${year}/${upcoming(schedule.events)}`, { replace: true }); return; }
  const event = schedule.events.find((e) => e.round === params.round);

  const body = h("div", {}, loading("Analysing three seasons of strategy…", "Loading each past race takes a few seconds the first time."));
  main.replaceChildren(
    h("div", { class: "picker" },
      h("div", { class: "picker-row" }, yearSelect(year, (y) => navigate(`/f1/strategy/${y}`), { min: 2021, max: new Date().getFullYear() + 1 })),
      calendar(schedule.events, params.round, (r) => navigate(`/f1/strategy/${year}/${r}`))),
    body,
  );
  if (!event) { body.replaceChildren(state({ title: "Pick a Grand Prix", body: "Choose a round from the calendar above." })); return; }

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
    : state({ title: "No strategy data", body: "None of the last three editions of this race have lap data available." });

  const years = h("div", { class: "years" }, data.races.map((race) => h("section", { class: "year panel" },
    h("h3", {}, race.year, race.total_laps ? h("span", {}, `${race.total_laps} laps`) : null),
    race.status === "ok"
      ? race.finishers.map((f) => h("div", { class: "finisher" },
        h("span", { class: "pos" }, f.position),
        h("span", { class: "tower-code", style: { boxShadow: `inset 3px 0 0 ${teamColour(f.colour) || "transparent"}`, paddingLeft: "8px" } }, f.code),
        planBar(f.stints, race.total_laps)))
      : h("p", { class: "muted" }, STATUS[race.status] || race.status))));

  body.replaceChildren(
    stripHeader({ tag: `R${String(event.round).padStart(2, "0")}`, title: event.name, meta: [h("span", {}, h("b", {}, "Strategy history")), h("span", {}, `${year - 3}–${year - 1}, top five finishers`)] }),
    h("section", {}, sectionHead("Plans that worked", { note: "Share of top-five finishes, bar shows average stint lengths" }), plans),
    h("section", { class: "section" }, sectionHead("By season"), years),
  );
}
