// A Three.js stage bound to one host element: sizing, a render loop that only
// runs while visible, pause/resume for the page's motion control, and a single
// still frame under reduced motion. Scenes are lit physically: filmic tone
// mapping, and either studio reflections (wind tunnel) or bare sunlight (space).
import * as THREE from "three";
import { RoomEnvironment } from "../../vendor/three/RoomEnvironment.js";

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Checked once per page load; the probe context is released straight away
let webgl = null;
export function webglAvailable() {
  if (webgl === null) {
    try {
      const c = document.createElement("canvas");
      const gl = window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"));
      webgl = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { webgl = false; }
  }
  return webgl;
}

/**
 * onFrame(time, dt) is called before each render; time is seconds of running
 * (paused time excluded); dt is 0 on one-off draws. stillTime is the moment
 * drawn under reduced motion. env: "studio" adds soft reflections, "space" none.
 */
export function createStage(host, { fov = 35, onFrame = () => {}, stillTime = 0, label = "", env = "studio", exposure = 1, shadows = false, far = 400 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.setClearColor(0x000000, 0);
  if (shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  const canvas = renderer.domElement;
  canvas.className = "stage-canvas";
  canvas.setAttribute("role", "img");
  if (label) canvas.setAttribute("aria-label", label);
  host.append(canvas);

  const scene = new THREE.Scene();
  let envMap = null;
  if (env === "studio") {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
  }
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, far);
  let time = 0, last = null, frame = null, visible = false, paused = false, disposed = false;

  function draw() {
    // Late callbacks (texture loads, scroll) may arrive after the page has gone
    if (disposed) return;
    onFrame(time, 0);
    renderer.render(scene, camera);
  }
  function loop(now) {
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    onFrame(time, dt || 1e-4);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  }
  function sync() {
    const run = !disposed && visible && !paused && !document.hidden && !reducedMotion();
    if (run && frame === null) { last = null; frame = requestAnimationFrame(loop); }
    if (!run && frame !== null) { cancelAnimationFrame(frame); frame = null; }
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (frame === null) { if (reducedMotion()) time = stillTime; draw(); }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: "100px" });
  io.observe(host);
  const onVis = () => sync();
  document.addEventListener("visibilitychange", onVis);

  return {
    scene, camera, renderer, canvas,
    pause() { paused = true; sync(); },
    resume() { paused = false; sync(); },
    isRunning: () => frame !== null,
    /** Re-render now (used by scroll-driven scenes while the loop is idle). */
    draw,
    /** Jump to a moment and draw it */
    seek(t) { time = t; draw(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame); frame = null; ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        [].concat(o.material || []).forEach((m) => { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose?.(); });
      });
      envMap?.dispose();
      // Release the GPU context now: browsers cap live contexts (~16) and fail past it
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}

/** Easing helpers shared by the scenes */
export const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
export const smooth = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };
export const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
export const easeInOut = (v) => { const x = clamp01(v); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
/** Progress of t through the window [a, b], clamped to 0..1 */
export const span = (t, a, b) => clamp01((t - a) / (b - a));
export const lerp = (a, b, t) => a + (b - a) * t;
