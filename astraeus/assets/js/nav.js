// Site header: a plain black bar. On phones it slides away while you scroll
// down and comes back as soon as you scroll up; the Menu button opens a
// full-screen sheet.

const phone = matchMedia("(max-width: 760px)");

export function initNav() {
  const header = document.querySelector(".site-nav");
  const btn = header.querySelector(".nav-menu-btn");
  const sheet = header.querySelector(".nav-sheet");

  const setSheet = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    header.classList.toggle("sheet-open", open);
    document.documentElement.classList.toggle("nav-locked", open);
    if (open) { sheet.hidden = false; header.classList.remove("is-hidden"); }
    else setTimeout(() => { if (!header.classList.contains("sheet-open")) sheet.hidden = true; }, 300);
  };
  btn.addEventListener("click", () => setSheet(btn.getAttribute("aria-expanded") !== "true"));
  header.addEventListener("keydown", (e) => { if (e.key === "Escape" && header.classList.contains("sheet-open")) { setSheet(false); btn.focus(); } });

  // Hide on the way down, return on the way up (phones only); a hairline once scrolled
  let lastY = scrollY, travel = 0;
  const onScroll = () => {
    const y = scrollY, dy = y - lastY;
    lastY = y;
    header.classList.toggle("is-scrolled", y > 8);
    if (!phone.matches || header.classList.contains("sheet-open")) { header.classList.remove("is-hidden"); return; }
    // A little hysteresis so small jitters don't flicker the bar
    travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
    if (y < 64) header.classList.remove("is-hidden");
    else if (travel > 24) header.classList.add("is-hidden");
    else if (travel < -12) header.classList.remove("is-hidden");
  };
  addEventListener("scroll", onScroll, { passive: true });
  phone.addEventListener("change", onScroll);
  onScroll();
  // Keyboard users never lose the bar
  header.addEventListener("focusin", () => header.classList.remove("is-hidden"));

  // Footer groups: always open on wider screens, folded behind "+" on phones
  const groups = [...document.querySelectorAll(".ft-group")];
  const syncFooter = () => groups.forEach((g) => { g.open = !phone.matches; });
  groups.forEach((g) => g.querySelector("summary").addEventListener("click", (e) => { if (!phone.matches) e.preventDefault(); }));
  phone.addEventListener("change", syncFooter);
  syncFooter();

  return {
    /** Called after each navigation */
    update() { setSheet(false); header.classList.remove("is-hidden"); },
  };
}
