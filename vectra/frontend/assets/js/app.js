// VECTRA: Formula 1 race analysis. Real URLs (/sessions/2025/3/R) served by one shell.
import * as home from "./views/home.js";
import * as sessions from "./views/sessions.js";
import * as live from "./views/live.js";
import * as strategy from "./views/strategy.js";
import { api } from "./api.js";
import { initNav } from "./nav.js";
import { url, wireAppLinks } from "./config.js";
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function scrollToTarget(target, { immediate = false } = {}) {
  if (typeof target === "number") window.scrollTo({ top: target });
  else target?.scrollIntoView({ behavior: immediate || reduce() ? "auto" : "smooth" });
}

const main = document.getElementById("main");
let cleanup = null;
let renderId = 0;

const ROUTES = [
  { re: /^\/$/, nav: "vectra", view: home, title: "VECTRA", params: () => ({}) },
  { re: /^\/sessions(?:\/(\d{4})(?:\/(\d+)(?:\/(FP1|FP2|FP3|SQ|S|Q|R))?)?)?\/?$/, nav: "sessions", view: sessions, title: "Sessions",
    params: (m) => ({ year: m[1] && Number(m[1]), round: m[2] && Number(m[2]), code: m[3] }) },
  { re: /^\/live\/?$/, nav: "live", view: live, title: "Live", params: () => ({}) },
  { re: /^\/strategy(?:\/(\d{4})(?:\/(\d+))?)?\/?$/, nav: "strategy", view: strategy, title: "Strategy",
    params: (m) => ({ year: m[1] && Number(m[1]), round: m[2] && Number(m[2]) }) },
];
const TITLE = (t) => (t === "VECTRA" ? "VECTRA · AeroLabs AI" : `${t} · VECTRA · AeroLabs AI`);

// Older addresses: /f1… (F1 Data Hub) and /vectra… (inside the company site)
function legacyRedirect() {
  const p = location.pathname;
  const m = p.match(/^\/(vectra|f1)(\/.*)?$/);
  if (m) history.replaceState({}, "", (m[2] || "/") + location.hash);
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  route();
}

function markCurrent(r) {
  for (const a of document.querySelectorAll("[data-nav]")) {
    if (r?.nav === a.dataset.nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  for (const a of document.querySelectorAll("[data-section-nav]")) {
    if (r?.top === a.dataset.sectionNav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

async function route() {
  const id = ++renderId;
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  legacyRedirect();
  const path = location.pathname;
  const match = ROUTES.map((r) => [r, path.match(r.re)]).find(([, m]) => m);
  markCurrent(match?.[0]);
  if (!match) {
    main.innerHTML = "";
    main.append(Object.assign(document.createElement("p"), { className: "muted not-found", textContent: "That page doesn't exist." }));
    return;
  }
  const [r, m] = match;
  document.title = TITLE(r.title);
  // Each navigation renders into its own container, so a slow earlier render
  // that finishes late writes into a detached node instead of this page
  const view = document.createElement("div");
  main.replaceChildren(view);
  const result = await r.view.render(view, r.params(m), navigate);
  wireAppLinks(view);
  if (id === renderId && location.hash) scrollToTarget(document.getElementById(location.hash.slice(1)), { immediate: true });
  nav.update();
  // A newer navigation may have started while this one awaited data
  if (id === renderId) cleanup = result;
  else if (typeof result === "function") result();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const target = a.pathname + a.hash;
  if (a.pathname !== location.pathname) {
    scrollToTarget(0, { immediate: true });
    navigate(target);
  } else if (a.hash) {
    history.replaceState({}, "", target);
    scrollToTarget(document.getElementById(a.hash.slice(1)));
    return;
  } else {
    scrollToTarget(0);
  }
  main.focus({ preventScroll: true });
});
window.addEventListener("popstate", route);
document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
wireAppLinks();

const nav = initNav();
route();

// Show a live dot on the Live link while a session is running
api("/live", { cache: false }).then((b) => {
  document.querySelector(".nav-live-dot").hidden = !b.session?.live;
}).catch(() => {});
