// Shared DOM helpers and broadcast components.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.startsWith("--")) el.style.setProperty(key, value);
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null) continue;
    el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child) el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// One stroke family for every icon: 24 grid, 1.75 stroke, square caps.
const ICONS = {
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  temp: '<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 10v6"/>',
  track: '<path d="M3 17c2-6 5-10 9-10s4 4 7 4 2-4 2-4"/><path d="M3 17h7"/>',
  drop: '<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3"/>',
  rain: '<path d="M7 16a4 4 0 0 1-.5-8 6 6 0 0 1 11.3 1.5A3.5 3.5 0 0 1 17.5 16"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17v.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
export function icon(name) {
  const span = document.createElement("span");
  span.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" aria-hidden="true">${ICONS[name]}</svg>`;
  return span.firstChild;
}

export const COMPOUNDS = {
  SOFT: { color: "var(--soft)", hex: "#e8002d", letter: "S", light: false },
  MEDIUM: { color: "var(--medium)", hex: "#ffd12e", letter: "M", light: true },
  HARD: { color: "var(--hard)", hex: "#f0f0ec", letter: "H", light: true },
  INTERMEDIATE: { color: "var(--inter)", hex: "#43b02a", letter: "I", light: false },
  WET: { color: "var(--wet)", hex: "#0067ad", letter: "W", light: false },
};
export function compound(name) {
  return COMPOUNDS[(name || "").toUpperCase()] || { color: "var(--faint)", hex: "#8b8ba1", letter: "?", light: false };
}

export function tyre(name, { label = false } = {}) {
  const c = compound(name);
  const title = name ? name.charAt(0) + name.slice(1).toLowerCase() : "Unknown";
  const disc = h("span", { class: "tyre", "--c": c.color, title, "aria-label": `${title} tyre`, role: "img" }, c.letter);
  return label ? h("span", { class: "tyre-label" }, disc, title) : disc;
}

export function teamColour(hex) {
  return hex ? `#${String(hex).replace("#", "")}` : null;
}

export function lapTime(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "--";
  const m = Math.floor(seconds / 60);
  return `${m}:${(seconds - m * 60).toFixed(3).padStart(6, "0")}`;
}

export function fmtDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString(undefined, opts);
}

export function stripHeader({ tag, title, meta = [], aside }) {
  return h("header", { class: "strip" },
    tag ? h("span", { class: "strip-tag" }, tag) : null,
    h("div", { class: "strip-title" }, h("h1", {}, title)),
    meta.length ? h("div", { class: "strip-meta" }, meta) : null,
    aside ? h("div", { class: "strip-aside" }, aside) : null,
  );
}

export function sectionHead(title, { note, tools } = {}) {
  return h("div", { class: "section-head" },
    h("h2", {}, title),
    note ? h("span", { class: "note" }, note) : null,
    tools ? h("div", { class: "tools" }, tools) : null,
  );
}

export function state({ title, body, kind = "info", action }) {
  return h("div", { class: `state state-${kind}`, role: kind === "error" ? "alert" : "status" },
    icon(kind === "error" ? "alert" : kind === "lock" ? "lock" : "info"),
    h("div", {}, h("b", {}, title), body ? h("p", {}, body) : null, action || null),
  );
}

export function lights() {
  return h("div", { class: "lights", "aria-hidden": "true" },
    Array.from({ length: 5 }, () => h("span", {}, h("i"), h("i"))));
}

export function loading(title, body) {
  return h("div", { class: "loading", role: "status", "aria-live": "polite" }, lights(), h("div", {}, h("b", {}, title), body ? h("p", {}, body) : null));
}

export function skeletonTower(rows = 10) {
  return h("div", { class: "tower", "aria-hidden": "true" }, Array.from({ length: rows }, () => h("div", { class: "sk-row skeleton" })));
}

/** Readable explanation for an API failure. */
export function errorState(err, { retry } = {}) {
  const action = retry ? h("button", { class: "btn", onclick: retry }, icon("replay"), "Try again") : null;
  if (err?.code === "no_lap_data") {
    return state({
      kind: "lock",
      title: "Lap data isn't available for this session",
      body: "Formula 1's timing archive now needs an F1 TV login. The free OpenF1 source covers 2023 onwards, and FastF1's mirror covers 2022 and some earlier seasons. Results are still shown.",
    });
  }
  if (err?.code === "restricted") {
    return state({ kind: "lock", title: "Live data is restricted right now", body: `${err.message} The free OpenF1 tier opens up again shortly after the session ends.`, action });
  }
  if (err?.code === "busy") {
    return state({ kind: "error", title: "The data provider is busy", body: "Too many requests reached OpenF1 in the last minute. Wait a moment and try again.", action });
  }
  return state({ kind: "error", title: "Couldn't load this data", body: err?.message || "Something went wrong.", action });
}

/**
 * Timing tower. rows: {position, code, name, colour, value (node|string), out}
 * Rows are keyed by driver so a re-render can slide them to new positions.
 */
export function tower(rows, { valueLabel = "Time", container } = {}) {
  const el = container || h("div", { class: "tower", role: "table", "aria-label": "Timing tower" });
  const before = new Map([...el.querySelectorAll(".tower-row")].map((r) => [r.dataset.key, r.getBoundingClientRect().top]));
  el.replaceChildren(
    h("div", { class: "tower-head", role: "row" },
      h("span", { role: "columnheader" }, "Pos"), h("span"), h("span", { role: "columnheader" }, "Driver"), h("span", { role: "columnheader", class: "tower-name-head" }, ""),
      h("span", { role: "columnheader" }, valueLabel)),
    ...rows.map((r) => h("div", {
      class: `tower-row${r.position === 1 ? " is-leader" : ""}${r.out ? " is-out" : ""}`, role: "row", "data-key": r.key ?? r.code,
    },
      h("span", { class: "tower-pos", role: "cell" }, r.position ?? "–"),
      h("span", { class: "tower-team", "--team": teamColour(r.colour), "aria-hidden": "true" }),
      h("span", { class: "tower-code", role: "cell" }, r.code),
      h("span", { class: "tower-name", role: "cell" }, r.name || ""),
      h("span", { class: "tower-value", role: "cell" }, r.value ?? ""),
    )),
  );
  // FLIP: rows that changed position slide from where they were
  if (before.size && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const row of el.querySelectorAll(".tower-row")) {
      const prev = before.get(row.dataset.key);
      if (prev === undefined) continue;
      const delta = prev - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 2) continue;
      row.style.transition = "none";
      row.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => { row.style.transition = ""; row.style.transform = ""; });
    }
  }
  return el;
}

/** Season calendar strip; events from /api/schedule. */
export function calendar(events, selected, onSelect, { isEnabled = () => true } = {}) {
  const strip = h("div", { class: "calendar", role: "group", "aria-label": "Grand Prix" },
    events.map((ev) => h("button", {
      type: "button", "aria-pressed": String(ev.round === selected), disabled: !isEnabled(ev),
      onclick: () => onSelect(ev.round),
    },
      h("span", { class: "cal-round" }, `R${String(ev.round).padStart(2, "0")}`),
      h("span", { class: "cal-name" }, ev.country),
      h("span", { class: "cal-date" }, fmtDate(ev.date, { day: "numeric", month: "short" })),
    )));
  requestAnimationFrame(() => strip.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" }));
  return strip;
}

export function yearSelect(value, onChange, { min = 2018, max = new Date().getFullYear() } = {}) {
  const select = h("select", { class: "select", onchange: (e) => onChange(Number(e.target.value)) },
    Array.from({ length: max - min + 1 }, (_, i) => max - i).map((y) => h("option", { value: y, selected: y === value }, y)));
  return h("label", { class: "field" }, "Season", select);
}

/** Pick black or white text for a background hex. */
export function readableOn(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}
