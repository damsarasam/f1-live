// Landing page for the AeroLabs AI F1 section: a real lap replays across the hero.
import { api } from "../api.js";
import { h, icon, tower, teamColour, lights, state, lapTime } from "../ui.js";
import { heroReplay } from "../track.js";
import { stintChart, planBar } from "../charts.js";
import { boardTower } from "./live.js";

/** Most recent race that finished at least three hours ago, this season or last. */
export async function latestRace() {
  const cutoff = Date.now() - 3 * 3600e3;
  for (const year of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
    const sch = await api(`/schedule/${year}`).catch(() => null);
    if (!sch) continue;
    for (let i = sch.events.length - 1; i >= 0; i--) {
      const race = sch.events[i].sessions.find((x) => x.code === "R");
      if (race && new Date(race.date) < cutoff) return { year, event: sch.events[i] };
    }
  }
  return null;
}

/** Next event with a session still to come, this season then next. */
export async function nextEvent() {
  const now = new Date();
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    const sch = await api(`/schedule/${year}`).catch(() => null);
    if (!sch) continue;
    for (const ev of sch.events) {
      const next = ev.sessions.find((x) => new Date(x.date) > now);
      if (next) return { year, event: ev, session: next };
    }
  }
  return null;
}

function countdown(target) {
  const out = h("b", { class: "hero-cd-time" });
  const tick = () => {
    let secs = Math.max(0, Math.floor((new Date(target.session.date) - new Date()) / 1000));
    const d = Math.floor(secs / 86400); secs -= d * 86400;
    const hrs = Math.floor(secs / 3600); secs -= hrs * 3600;
    const m = Math.floor(secs / 60);
    out.replaceChildren(d, h("small", {}, "d"), String(hrs).padStart(2, "0"), h("small", {}, "h"), String(m).padStart(2, "0"), h("small", {}, "m"));
  };
  tick();
  const timer = setInterval(tick, 30000);
  const el = h("div", { class: "hero-cd" }, h("span", {}, `Next · ${target.event.name} · ${target.session.name}`), out);
  el.stop = () => clearInterval(timer);
  return el;
}

function readout(label, value, unit) {
  const dd = h("dd", {}, value, unit ? h("small", {}, unit) : null);
  return { el: h("div", {}, h("dt", {}, label), dd), dd };
}

function band({ tag, title, body, action, visual, flip }) {
  return h("section", { class: `land-band${flip ? " is-flip" : ""}` },
    h("div", { class: "land-copy" },
      h("div", { class: "band-strip" }, h("span", { class: "strip-tag" }, tag), h("div", { class: "strip-title" }, h("h2", {}, title))),
      h("p", {}, body), action),
    h("div", { class: "land-visual" }, visual));
}

export async function render(main) {
  const cleanups = [];
  const races = latestRace();
  const upcoming = nextEvent();

  // ---------- Hero shell: copy and actions render immediately ----------
  const stage = h("div", { class: "hero-stage" }, h("div", { class: "hero-wait" }, lights()));
  const driverOut = readout("Fastest lap", "--");
  const speedOut = readout("Car speed", "--", "km/h");
  const clockOut = readout("Replay ×4", "0:00.000");
  const scaleOut = h("div", { class: "hero-scale", hidden: true });
  const podium = h("div", { class: "hero-pod", "aria-label": "Latest race podium" });
  const cdSlot = h("div", { class: "hero-cd-slot" });
  const sessionsLink = h("a", { class: "hero-cta-main", href: "/f1/sessions", "data-link": true }, "Past sessions", icon("arrow"));

  const hero = h("section", { class: "hero", "aria-label": "F1 Data Hub" },
    stage,
    h("dl", { class: "hero-hud" }, driverOut.el, speedOut.el, clockOut.el, scaleOut),
    cdSlot,
    h("div", { class: "hero-copy" },
      h("div", { class: "hero-strip" },
        h("span", { class: "strip-tag" }, "F1"),
        h("div", { class: "strip-title" }, h("h1", {}, "Every lap, decoded."))),
      h("p", { class: "hero-lede" }, "Replay the fastest lap of recent Grands Prix, read the timing tower and see which tyre strategies won, rebuilt from open race data."),
      h("ul", { class: "hero-chips", "aria-label": "Access" }, h("li", {}, "Free"), h("li", {}, "No login"), h("li", {}, "No F1 TV needed"))),
    podium,
    h("nav", { class: "hero-cta", "aria-label": "Explore F1 Data Hub" },
      sessionsLink,
      h("a", { href: "/f1/live", "data-link": true }, "Live board", icon("arrow")),
      h("a", { class: "hero-cta-strategy", href: "/f1/strategy", "data-link": true }, "Strategy", icon("arrow"))),
  );

  // ---------- Below the fold: each area proves itself with real data ----------
  const stintSlot = h("div", { class: "sk-block skeleton panel" });
  const towerSlot = h("div", { class: "sk-block skeleton panel", style: { height: "220px" } });
  const planSlot = h("div", { class: "sk-block skeleton panel", style: { height: "220px" } });
  const sessionsBandLink = h("a", { class: "btn btn-primary", href: "/f1/sessions", "data-link": true }, "Explore past sessions", icon("arrow"));
  const strategyTitle = h("span", {}, "Know what wins next");
  const strategyBandLink = h("a", { class: "btn", href: "/f1/strategy", "data-link": true }, "Strategy history", icon("arrow"));

  main.replaceChildren(
    hero,
    band({
      tag: "Sessions",
      title: "Replay any session",
      body: "Results for every session since 2018. From 2022 on, each session adds a fastest-lap replay coloured by speed, every driver's tyre stints and head-to-head speed traces.",
      action: sessionsBandLink, visual: stintSlot,
    }),
    band({
      tag: "Timing",
      title: "Follow race weekends live",
      body: "A timing tower with tyres and tyre age, track weather and car positions. While a session runs it refreshes every 20 seconds, whenever OpenF1 opens its live feed to free users.",
      action: h("a", { class: "btn", href: "/f1/live", "data-link": true }, "Live board", icon("arrow")),
      visual: towerSlot, flip: true,
    }),
    band({
      tag: "Strategy",
      title: strategyTitle,
      body: "The tyre plans the top five used at each Grand Prix over the last three seasons, ranked by how often they finished on top.",
      action: strategyBandLink, visual: planSlot,
    }),
    h("section", { class: "land-facts", "aria-label": "About the data" },
      h("div", {}, h("b", {}, "Free and open"), h("span", {}, "No account, no subscription. Built on FastF1 and OpenF1 open data.")),
      h("div", {}, h("b", {}, "Coverage"), h("span", {}, "Results from 2018. Laps, replays and telemetry from 2022 on: 2023 onwards via OpenF1, 2022 via FastF1.")),
      h("div", {}, h("b", {}, "Unofficial"), h("span", {}, "An AeroLabs AI project, not associated with Formula 1 companies."))),
    h("aside", { class: "land-next" },
      h("span", { class: "land-next-label" }, "Also from AeroLabs AI"),
      h("b", {}, "Aerospace"),
      h("span", {}, "Asteroid mining. Under construction.")),
  );

  // ---------- Fill in data ----------
  upcoming.then((next) => {
    if (!next) return;
    const cd = countdown(next);
    cleanups.push(cd.stop);
    cdSlot.replaceChildren(cd);
    const href = `/f1/strategy/${next.year}/${next.event.round}`;
    hero.querySelector(".hero-cta-strategy").setAttribute("href", href);
    strategyBandLink.setAttribute("href", href);
    strategyTitle.textContent = `Know what wins in ${next.event.country}`;
    api(`/strategy/${next.year}/${next.event.round}`).then((st) => {
      const total = st.plans.reduce((n, p) => n + p.count, 0);
      planSlot.className = "panel land-plans";
      planSlot.style.height = "";
      planSlot.replaceChildren(st.plans.length ? h("div", { class: "plans" }, st.plans.slice(0, 4).map((p, i) => {
        const avg = p.compounds.map((c, j) => ({ compound: c, laps: Math.round(p.examples.reduce((n, e) => n + e.laps[j], 0) / p.examples.length) }));
        const laps = Math.round(p.examples.reduce((n, e) => n + e.total, 0) / p.examples.length);
        return h("div", { class: `plan${i === 0 ? " is-top" : ""}` },
          h("span", { class: "plan-share" }, Math.round(p.share * 100), h("small", {}, "%")),
          h("div", {}, planBar(avg, laps)),
          h("span", { class: "plan-meta" }, h("b", {}, p.stops === 1 ? "1 stop" : `${p.stops} stops`), h("br"), `${p.count} of ${total} top-5 finishes`));
      })) : state({ title: "No strategy history for this race yet" }));
    }).catch(() => planSlot.replaceChildren(state({ title: "Strategy history is loading slowly", body: "Open Strategy to load it." })));
  });

  api("/live", { cache: false }).then((board) => {
    towerSlot.className = "panel land-tower";
    towerSlot.style.height = "";
    towerSlot.replaceChildren(board.tower.length
      ? tower(boardTower(board, { limit: 6 }), { valueLabel: "Tyre · last lap" })
      : state({ title: "No positions published yet" }));
  }).catch(() => towerSlot.replaceChildren(state({ title: "Live board unavailable right now" })));

  races.then(async (latest) => {
    if (!latest) { stage.replaceChildren(); return; }
    const base = `/sessions/${latest.year}/${latest.event.round}/R`;
    sessionsLink.setAttribute("href", `/f1${base}`);
    sessionsBandLink.setAttribute("href", `/f1${base}`);

    api(base).then((res) => {
      const lead = res.results[0]?.laps;
      podium.replaceChildren(
        h("p", { class: "hero-pod-title" }, `${res.event} · Race`),
        tower(res.results.slice(0, 3).map((r) => ({
          key: r.number, position: r.position, code: r.code, colour: r.colour, name: r.last,
          value: r.position === 1 ? r.time : r.time && r.laps === lead ? `+${r.time.startsWith("0:") ? Number(r.time.slice(2)).toFixed(3) : r.time}` : r.status,
        })), { valueLabel: "Gap" }));
    }).catch(() => {});

    api(`${base}/stints`).then((st) => {
      stintSlot.className = "";
      stintSlot.replaceChildren(stintChart({ ...st, drivers: st.drivers.slice(0, 10) }));
    }).catch(() => stintSlot.replaceChildren(state({ title: "Tyre stints unavailable for this race" })));

    try {
      const lap = await api(`${base}/fastest-lap`);
      driverOut.dd.replaceChildren(h("i", { "--team": teamColour(lap.driver.colour) }), lap.driver.code);
      const replay = heroReplay(lap, {
        onFrame: ({ speed, clock }) => {
          speedOut.dd.firstChild.textContent = speed;
          clockOut.dd.firstChild.textContent = lapTime(clock);
        },
      });
      scaleOut.replaceChildren(h("dt", {}, "Speed key"),
        h("dd", {}, h("span", {}, replay.minSpeed), h("i", { "aria-hidden": "true" }), h("span", {}, `${replay.maxSpeed} km/h`)));
      scaleOut.hidden = false;
      stage.replaceChildren(replay);
      replay.start();
      cleanups.push(replay.stop);
    } catch {
      stage.replaceChildren();
    }
  });

  return () => cleanups.forEach((fn) => fn());
}
