// AeroLabs AI website: home, About, Vision and Blog.
import * as home from "./views/aerolabs.js";
import * as pages from "./views/pages.js";
import { initNav } from "./nav.js";
import { url, wireAppLinks } from "./config.js";
import { smoothScroll, scrollToTarget } from "./smooth.js";

const main = document.getElementById("main");
let cleanup = null;
let renderId = 0;

const ROUTES = [
  { re: /^\/$/, view: home, title: "AeroLabs AI", params: () => ({}) },
  { re: /^\/about\/?$/, top: "about", view: pages, title: "About", params: () => ({ page: "about" }) },
  { re: /^\/vision\/?$/, top: "vision", view: pages, title: "Vision", params: () => ({ page: "vision" }) },
  { re: /^\/blog\/?$/, top: "blog", view: pages, title: "Blog", params: () => ({ page: "blog" }) },
  { re: /^\/vectra\/?$/, top: "vectra", view: pages, title: "VECTRA", params: () => ({ page: "vectra" }) },
  { re: /^\/astraeus\/?$/, top: "astraeus", view: pages, title: "ASTRAEUS", params: () => ({ page: "astraeus" }) },
];
const TITLE = (t) => (t === "AeroLabs AI" ? t : `${t} · AeroLabs AI`);

// /vectra and /astraeus explain the products here; deeper product addresses
// (and the old /f1…) belong to the apps themselves
function legacyRedirect() {
  const m = location.pathname.match(/^\/(vectra|f1)(\/.+)$/) || location.pathname.match(/^\/(f1)\/?$/);
  if (m) location.replace(url("vectra", m[2] || "/"));
  else if (/^\/astraeus\/.+/.test(location.pathname)) location.replace(url("astraeus", "/"));
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
