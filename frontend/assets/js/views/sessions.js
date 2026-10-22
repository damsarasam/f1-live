import { api } from "../api.js";
import { h, calendar, yearSelect, stripHeader, sectionHead, loading, errorState, skeletonTower, tower, state, fmtDate } from "../ui.js";
import { lapReplay } from "../track.js";
import { stintChart, compareChart } from "../charts.js";

const SESSION_LABELS = { FP1: "FP1", FP2: "FP2", FP3: "FP3", SQ: "Sprint Quali", S: "Sprint", Q: "Qualifying", R: "Race" };

export function started(session) {
  return new Date(session.date) <= new Date();
}

/** Most recent session that has already started in `events`. */
export function latestStarted(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const done = events[i].sessions.filter(started);
    if (done.length) return { round: events[i].round, code: done.at(-1).code };
  }
  return null;
}

function towerValue(row, code, leaderLaps) {
  if (code === "Q" || code === "SQ") {
    const idx = [2, 1, 0].find((i) => row.q[i]);
    return idx === undefined ? h("span", { class: "dim" }, row.status || "No time") : [h("span", { class: "dim" }, `Q${idx + 1}`), row.q[idx]];
  }
  if (code === "R" || code === "S") {
    const points = row.points ? h("span", { class: "dim" }, `${row.points} pts`) : null;
    if (row.position === 1 && row.time) return [row.time, points];
    // Lapped cars carry a time within their own lap; the useful number is laps down
    const down = leaderLaps && row.laps !== null ? leaderLaps - row.laps : 0;
    if (row.status === "Lapped" || (row.time && down > 0)) return [`+${down} lap${down === 1 ? "" : "s"}`, points];
    if (row.time) return [`+${row.time.startsWith("0:") ? Number(row.time.slice(2)).toFixed(3) : row.time}`, points];
    return [h("span", { class: "dim" }, row.status || "—"), points];
  }
  return row.time || h("span", { class: "dim" }, "—");
}

export async function render(main, params, navigate) {
  const now = new Date();
  let year = params.year || now.getFullYear();
  let schedule = await api(`/schedule/${year}`).catch(() => null);
  let pick = params.round ? { round: params.round, code: params.code || "R" } : schedule && latestStarted(schedule.events);
  if (!params.year && !pick) {
    // Early in a season nothing has run yet; fall back to last season
    year -= 1;
    schedule = await api(`/schedule/${year}`);
    pick = latestStarted(schedule.events);
  }
  if (!schedule) { main.replaceChildren(errorState(new Error("Couldn't load the season schedule."), { retry: () => render(main, params, navigate) })); return; }
  if (!params.round && pick) { navigate(`/f1/sessions/${year}/${pick.round}/${pick.code}`, { replace: true }); return; }

  const event = schedule.events.find((e) => e.round === pick?.round);
  const go = (y, r, c) => navigate(`/f1/sessions/${y}/${r}/${c}`);

  const picker = h("div", { class: "picker" },
    h("div", { class: "picker-row" },
      yearSelect(year, async (y) => {
        const sch = await api(`/schedule/${y}`);
        const p = latestStarted(sch.events) || { round: 1, code: "R" };
        go(y, p.round, p.code);
      }),
      event ? h("div", { class: "seg", role: "group", "aria-label": "Session" },
        event.sessions.map((sess) => h("button", {
          type: "button", "aria-pressed": String(sess.code === pick.code), disabled: !started(sess),
          title: started(sess) ? sess.name : `${sess.name} hasn't started yet`,
          onclick: () => go(year, event.round, sess.code),
        }, SESSION_LABELS[sess.code] || sess.code))) : null,
    ),
    calendar(schedule.events, pick?.round, (round) => {
      const ev = schedule.events.find((e) => e.round === round);
      const done = ev.sessions.filter(started);
      const code = done.find((x) => x.code === "R") ? "R" : done.at(-1)?.code || "R";
      go(year, round, code);
    }, { isEnabled: (ev) => ev.sessions.some(started) }),
  );

  const body = h("div", {}, loading("Loading session…", "The first load of a session can take up to 20 seconds while timing data is fetched."));
  main.replaceChildren(picker, body);
  if (!event) { body.replaceChildren(state({ title: "Pick a Grand Prix", body: "Choose a round from the calendar above." })); return; }

  let data;
  try {
    data = await api(`/sessions/${year}/${pick.round}/${pick.code}`);
  } catch (err) {
    body.replaceChildren(errorState(err, { retry: () => render(main, params, navigate) }));
    return;
  }

  const base = `/sessions/${year}/${pick.round}/${pick.code}`;
  const mapSlot = h("div", {}, h("div", { class: "sk-block skeleton panel" }));
  const stintSlot = h("div", {}, skeletonTower(6));
  const compareSlot = h("div", {});
  const sourceNote = data.lap_source === "openf1" ? "Laps and telemetry from OpenF1" : data.lap_source === "fastf1" ? "Laps and telemetry from FastF1" : null;

  body.replaceChildren(
    stripHeader({
      tag: `R${String(data.round).padStart(2, "0")}`,
      title: data.event,
      meta: [h("span", {}, h("b", {}, data.session)), h("span", {}, fmtDate(data.date)), h("span", {}, `${data.location}, ${data.country}`)],
    }),
    h("div", { class: "grid-board" },
      h("section", {},
        sectionHead("Classification"),
        data.results.length
          ? tower(data.results.map((r) => ({
            key: r.number, position: r.position, code: r.code, name: `${r.first} ${r.last}`, colour: r.colour,
            value: towerValue(r, pick.code, data.results[0]?.laps), out: r.position === null,
          })), { valueLabel: pick.code === "Q" || pick.code === "SQ" ? "Best" : pick.code === "R" || pick.code === "S" ? "Time / gap" : "Time" })
          : state({ title: "No classification published", body: "Results for practice sessions aren't always available from the open data sources." }),
      ),
      h("section", {}, sectionHead("Fastest lap", { note: sourceNote }), mapSlot),
    ),
    h("section", { class: "section" }, sectionHead("Tyre stints", { note: "Compound letters: S soft, M medium, H hard, I intermediate, W wet" }), stintSlot),
    h("section", { class: "section" }, sectionHead("Speed comparison", { note: "Each driver's fastest lap" }), compareSlot),
  );

  api(`${base}/fastest-lap`).then((lap) => mapSlot.replaceChildren(lapReplay(lap)))
    .catch((err) => mapSlot.replaceChildren(errorState(err)));
  api(`${base}/stints`).then((st) => stintSlot.replaceChildren(stintChart(st)))
    .catch((err) => stintSlot.replaceChildren(errorState(err)));

  // Speed comparison: default to the top two classified drivers
  const drivers = data.results;
  if (drivers.length < 2) { compareSlot.replaceChildren(state({ title: "Not enough drivers to compare" })); return; }
  const pickA = h("select", { class: "select", "aria-label": "First driver" }, drivers.map((d, i) => h("option", { value: d.number, selected: i === 0 }, `${d.code} · ${d.last}`)));
  const pickB = h("select", { class: "select", "aria-label": "Second driver" }, drivers.map((d, i) => h("option", { value: d.number, selected: i === 1 }, `${d.code} · ${d.last}`)));
  const chartSlot = h("div", {});
  const panel = h("div", { class: "compare panel" },
    h("div", { class: "picker-row", style: { marginBottom: "14px" } },
      h("label", { class: "field" }, "Driver", pickA), h("label", { class: "field" }, "Against", pickB)),
    chartSlot);
  compareSlot.replaceChildren(panel);
  async function loadCompare() {
    if (pickA.value === pickB.value) { chartSlot.replaceChildren(state({ title: "Pick two different drivers" })); return; }
    chartSlot.replaceChildren(h("div", { class: "sk-block skeleton", style: { height: "320px" } }));
    try {
      const cmp = await api(`${base}/compare?drivers=${pickA.value},${pickB.value}`);
      const missing = cmp.drivers.filter((d) => !d.speed.length).map((d) => d.code);
      chartSlot.replaceChildren(missing.length
        ? state({ title: "No timed lap to compare", body: `${missing.join(" and ")} set no timed lap in this session.` })
        : compareChart(cmp));
    } catch (err) {
      chartSlot.replaceChildren(errorState(err, { retry: loadCompare }));
    }
  }
  pickA.addEventListener("change", loadCompare);
  pickB.addEventListener("change", loadCompare);
  loadCompare();
}
