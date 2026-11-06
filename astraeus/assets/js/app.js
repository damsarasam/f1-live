// ASTRAEUS: the aerospace venture. The overview tells the whole mission; the
// topic pages go deeper into catching, the lab, the carrier and the engine.
import * as astraeus from "./views/astraeus.js";
import * as topics from "./views/topics.js";
import { initNav } from "./nav.js";
import { url, wireAppLinks } from "./config.js";
import { smoothScroll, scrollToTarget } from "./smooth.js";

const main = document.getElementById("main");
let cleanup = null;
let renderId = 0;

const ROUTES = [
  { re: /^\/$/, view: astraeus, title: "ASTRAEUS", params: () => ({}) },
  { re: /^\/catching\/?$/, nav: "catching", view: topics, title: "Asteroid catching", params: () => ({ page: "catching" }) },
  { re: /^\/lab\/?$/, nav: "lab", view: topics, title: "Asteroid lab", params: () => ({ page: "lab" }) },
  { re: /^\/carrier\/?$/, nav: "carrier", view: topics, title: "Spaceship carrier", params: () => ({ page: "carrier" }) },
  { re: /^\/engine\/?$/, nav: "engine", view: topics, title: "Engine", params: () => ({ page: "engine" }) },
  { re: /^\/blog\/?$/, nav: "blog", view: topics, title: "Blog", params: () => ({ page: "blog" }) },
];
const TITLE = (t) => (t === "ASTRAEUS" ? "ASTRAEUS · AeroLabs AI" : `${t} · ASTRAEUS · AeroLabs AI`);

// The page used to live at /astraeus on the company site
function legacyRedirect() {
  if (/^\/astraeus\/?$/.test(location.pathname)) history.replaceState({}, "", "/" + location.hash);
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
smoothScroll(true);
route();
