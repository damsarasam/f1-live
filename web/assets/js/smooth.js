// Inertial smooth scrolling (Lenis) for the AeroLabs AI pages, where scroll
// drives the 3D stories. Off under reduced motion and on VECTRA's data pages.
import Lenis from "../vendor/lenis/lenis.mjs";

let lenis = null, frame = null;
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function smoothScroll(on) {
  if (on && !lenis && !reduce()) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); frame = requestAnimationFrame(raf); };
    frame = requestAnimationFrame(raf);
  } else if (!on && lenis) {
    cancelAnimationFrame(frame); lenis.destroy(); lenis = null;
  }
}

/** Scroll to an element or y, smoothly when Lenis runs */
export function scrollToTarget(target, { immediate = false } = {}) {
  if (lenis) { lenis.scrollTo(target, { immediate, offset: 0, duration: immediate ? 0 : 1.4 }); return; }
  if (typeof target === "number") window.scrollTo({ top: target });
  else target?.scrollIntoView({ behavior: immediate || reduce() ? "auto" : "smooth" });
}
