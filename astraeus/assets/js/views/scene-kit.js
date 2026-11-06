// Helpers for the 3D scenes: a pause control, lazy scene mounting and pin progress.
import { h, icon } from "../ui.js";
import { webglAvailable, reducedMotion } from "../three/stage.js";

/** Glass "Pause motion" control for every looping scene on a page (WCAG 2.2.2). */
export function motionControl(stages) {
  if (reducedMotion() || !stages.length) return { el: null, stop: () => {} };
  let paused = false;
  const btn = h("button", { class: "motion-toggle", type: "button", "aria-pressed": "false" });
  const label = () => {
    btn.replaceChildren(icon(paused ? "play" : "pause"), paused ? "Play motion" : "Pause motion");
    btn.setAttribute("aria-pressed", String(paused));
  };
  btn.addEventListener("click", () => {
    paused = !paused;
    stages.forEach((st) => (paused ? st.pause() : st.resume()));
    label();
  });
  label();
  return { el: btn, stop: () => btn.remove() };
}

/** A host for a 3D scene; the scene module loads only when WebGL is available. */
export async function mountScene(host, factory, ...args) {
  if (!webglAvailable()) { host.classList.add("is-static"); return null; }
  const scenes = await import("../three/scenes.js");
  return scenes[factory](host, ...args);
}

/** Progress (0..1) of the page scrolling through a tall section with a sticky pin */
export function pinProgress(section) {
  const r = section.getBoundingClientRect();
  return Math.min(Math.max(-r.top / ((r.height - innerHeight) || 1), 0), 1);
}
