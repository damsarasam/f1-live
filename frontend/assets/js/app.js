// Client-side router: real URLs (/f1/sessions/2025/3/R) served by the same shell.
import * as aerolabs from "./views/aerolabs.js";
import * as home from "./views/home.js";
import * as sessions from "./views/sessions.js";
import * as live from "./views/live.js";
import * as strategy from "./views/strategy.js";
import { api } from "./api.js";

const main = document.getElementById("main");
let cleanup = null;
let renderId = 0;

// section picks the header and visual world: the AeroLabs AI company page or F1 Data Hub
const ROUTES = [
  { re: /^\/$/, section: "aerolabs", view: aerolabs, title: "AeroLabs AI", params: () => ({}) },
  { re: /^\/f1\/?$/, section: "f1", nav: "f1", view: home, title: "F1 Data Hub", params: () => ({}) },
  { re: /^\/f1\/sessions(?:\/(\d{4})(?:\/(\d+)(?:\/(FP1|FP2|FP3|SQ|S|Q|R))?)?)?\/?$/, nav: "sessions", view: sessions, title: "Sessions",
    params: (m) => ({ year: m[1] && Number(m[1]), round: m[2] && Number(m[2]), code: m[3] }) },
  { re: /^\/f1\/live\/?$/, nav: "live", view: live, title: "Live", params: () => ({}) },
  { re: /^\/f1\/strategy(?:\/(\d{4})(?:\/(\d+))?)?\/?$/, nav: "strategy", view: strategy, title: "Strategy",
    params: (m) => ({ year: m[1] && Number(m[1]), round: m[2] && Number(m[2]) }) },
];

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  route();
}

async function route() {
  const id = ++renderId;
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  // Paths from before F1 Data Hub moved under /f1
  if (/^\/(sessions|live|strategy)(\/|$)/.test(location.pathname)) {
    history.replaceState({}, "", `/f1${location.pathname}`);
  }
  const path = location.pathname;
  const match = ROUTES.map((r) => [r, path.match(r.re)]).find(([, m]) => m);
  for (const a of document.querySelectorAll("[data-nav]")) {
    a.toggleAttribute("aria-current", match && a.dataset.nav === match[0].nav);
    if (match && a.dataset.nav === match[0].nav) a.setAttribute("aria-current", "page");
  }
  if (!match) {
    main.innerHTML = "";
    main.append(Object.assign(document.createElement("p"), { className: "muted", textContent: "That page doesn't exist." }));
    return;
  }
  const [r, m] = match;
  document.body.dataset.section = r.section || "f1";
  // Browser chrome follows each world's ground colour
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", r.section === "aerolabs" ? "#000000" : "#0B0B10");
  document.title = r.section === "aerolabs" ? r.title : r.title === "F1 Data Hub" ? "F1 Data Hub · AeroLabs AI" : `${r.title} · F1 Data Hub · AeroLabs AI`;
  // Each navigation renders into its own container, so a slow earlier render
  // that finishes late writes into a detached node instead of this page
  const view = document.createElement("div");
  main.replaceChildren(view);
  const result = await r.view.render(view, r.params(m), navigate);
  if (id === renderId && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
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
    navigate(target);
    window.scrollTo({ top: 0 });
  } else if (a.hash) {
    history.replaceState({}, "", target);
    document.getElementById(a.hash.slice(1))?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return;
  } else {
    window.scrollTo({ top: 0 });
  }
  main.focus({ preventScroll: true });
});
window.addEventListener("popstate", route);
route();

// Show a live dot in the nav while a session is running
api("/live", { cache: false }).then((b) => {
  document.querySelector(".nav-live-dot").hidden = !b.session?.live;
}).catch(() => {});
