import { api } from "../api.js";
import { h, icon, stripHeader, sectionHead, loading, errorState, tower, tyre, lapTime, state } from "../ui.js";
import { liveMap } from "../track.js";

export function boardTower(board, { limit } = {}) {
  const rows = (limit ? board.tower.slice(0, limit) : board.tower).map((r) => ({
    key: r.number, position: r.position, code: r.code, name: `${r.first} ${r.last}`, colour: r.colour,
    value: [
      r.compound ? h("span", { class: "tyre-label" }, tyre(r.compound), r.tyre_age !== null ? h("span", { class: "dim" }, `${r.tyre_age}L`) : null) : null,
      lapTime(r.last_lap),
    ],
  }));
  return rows;
}

export function sessionTitle(session) {
  return `${session.location || session.country} · ${session.name}`;
}

function weatherBand(w) {
  if (!w) return null;
  const item = (ico, label, value, unit) => h("div", {}, icon(ico), h("dl", {}, h("dt", {}, label), h("dd", {}, value ?? "--", unit && value !== null ? h("small", {}, unit) : null)));
  return h("dl", { class: "weather", "aria-label": "Track weather" },
    item("temp", "Air", w.air_temperature, "°C"),
    item("track", "Track", w.track_temperature, "°C"),
    item("drop", "Humidity", w.humidity, "%"),
    item("wind", "Wind", w.wind_speed, "m/s"),
    item("rain", "Rain", w.rainfall === null || w.rainfall === undefined ? null : (Number(w.rainfall) > 0 ? "Yes" : "No"), null));
}

export async function render(main) {
  main.replaceChildren(loading("Connecting to timing…", "Fetching the latest session from OpenF1."));
  let board;
  try {
    board = await api("/live", { cache: false });
  } catch (err) {
    main.replaceChildren(errorState(err, { retry: () => render(main) }));
    return;
  }
  if (!board.session) { main.replaceChildren(state({ title: "No recent session found", body: "OpenF1 hasn't published a session yet this season." })); return; }

  const s = board.session;
  const towerEl = h("div", { class: "tower", role: "table", "aria-label": "Timing tower" });
  const updated = h("span", { class: "muted" });
  const map = board.cars.length ? liveMap(board) : null;

  function paint(b) {
    tower(boardTower(b), { valueLabel: "Tyre · last lap", container: towerEl });
    updated.textContent = `Updated ${new Date(b.updated).toLocaleTimeString()}`;
    if (map) map.update(b.cars);
  }

  main.replaceChildren(
    stripHeader({
      tag: s.live ? h("span", { class: "live-badge" }, h("span", { class: "nav-live-dot" }), "Live") : "Latest",
      title: sessionTitle(s),
      meta: [h("span", {}, h("b", {}, s.year)), h("span", {}, s.circuit),
        h("span", {}, s.live ? "In progress" : `Finished ${new Date(s.end).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`)],
      aside: updated,
    }),
    weatherBand(board.weather),
    h("div", { class: "grid-board" },
      h("section", {}, sectionHead("Timing tower", { note: s.live ? `Refreshes every ${board.refresh} s` : "Final order" }),
        board.tower.length ? towerEl : state({ title: "Waiting for positions", body: "The tower fills in as soon as OpenF1 publishes positions." })),
      h("section", {}, sectionHead("Circuit", { note: s.live ? "Car positions, live" : "Car positions on the final lap" }),
        map || state({ title: "No position data", body: "Car positions appear here during a session." })),
    ),
  );
  paint(board);

  if (!s.live) return;
  // Poll while the session runs; stop when the view changes
  let timer = setInterval(async () => {
    try { paint(await api("/live", { cache: false })); } catch { /* keep showing the last good board */ }
  }, (board.refresh || 20) * 1000);
  return () => clearInterval(timer);
}
