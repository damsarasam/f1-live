// Physically based materials with procedural canvas textures: carbon fibre,
// gloss paint, tyre rubber, gold and silver insulation foil, solar cells and a
// launch vehicle's painted skin with engine soot. Nothing is downloaded.
import * as THREE from "three";

// ---------- Deterministic value noise ----------
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function hash(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, y, oct = 5, seed = 0) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * noise2(x * f, y * f, seed + i * 13); f *= 2; amp *= 0.5; }
  return sum;
}
/** 3D value noise for displacing geometry */
function hash3(x, y, z, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 191.3 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm3(x, y, z, oct = 5, seed = 0) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * noise3(x * f, y * f, z * f, seed + i * 7); f *= 2.03; amp *= 0.5; }
  return sum;
}

function canvas(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  return c;
}
function tex(c, { color = false, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
/** Grey-scale canvas from a function f(x, y) -> 0..1 */
function field(w, h, f) {
  return canvas(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, f(x, y) * 255)), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

// ---------- Carbon fibre: 2x2 twill weave under clear coat ----------
function weaveCanvas() {
  return field(128, 128, (x, y) => {
    const cell = 16, cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const over = ((cx + cy) >> 1) % 2 === 0;
    const fx = (x % cell) / cell, fy = (y % cell) / cell;
    const along = over ? fx : fy;
    // Each tow is brighter in its middle: the strands catch the light
    return 0.35 + 0.45 * Math.sin(Math.PI * along) * (over ? 1 : 0.8);
  });
}
export function carbon({ repeat = 6, tint = 0x111214 } = {}) {
  const t = once("weave", weaveCanvas);
  const bump = tex(t, { repeat: [repeat, repeat] });
  const map = tex(t, { color: true, repeat: [repeat, repeat] });
  return new THREE.MeshPhysicalMaterial({
    color: tint, map, bumpMap: bump, bumpScale: 0.6, roughness: 0.42, metalness: 0.15,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.35,
  });
}

/** Gloss automotive paint with a fine metallic flake */
export function paint(color, { metalness = 0.35, roughness = 0.32 } = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: 1, clearcoatRoughness: 0.04 });
}
export function satin(color, roughness = 0.55) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1 });
}
export function metal(color = 0xb8bcc2, roughness = 0.3) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 1 });
}
export function rubber() {
  const n = once("rubber", () => field(256, 32, (x, y) => 0.5 + 0.5 * fbm2(x / 6, y / 6, 3, 9) * 0.6));
  return new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9, metalness: 0, roughnessMap: tex(n), bumpMap: tex(n), bumpScale: 0.2 });
}
export function glow(color, intensity = 2) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });
}
export function glass() {
  return new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1, opacity: 0.9, transparent: true });
}

// ---------- Spacecraft insulation: crinkled multi-layer foil ----------
function crinkleCanvas(seed) {
  return field(256, 256, (x, y) => {
    // Ridged noise reads as creased foil
    const n = fbm2(x / 22, y / 22, 5, seed);
    const r = 1 - Math.abs(n * 2 - 1);
    return 0.25 + 0.75 * Math.pow(r, 2.2);
  });
}
export function foil(kind = "gold") {
  const c = once("crinkle", () => crinkleCanvas(4));
  const bump = tex(c, { repeat: [1.4, 1.4] }), rough = tex(c, { repeat: [1.4, 1.4] });
  return new THREE.MeshStandardMaterial({
    color: kind === "gold" ? 0xf0c25a : 0xd4d7dc, metalness: 1, roughness: 0.26,
    bumpMap: bump, bumpScale: 1.1, roughnessMap: rough,
  });
}

/**
 * Multi-layer insulation blanket: crinkled film, quilted with stitch rows and
 * edged with tape, the way flight blankets are sewn. kind: gold | silver | black
 */
export function mli(kind = "gold", { repeat = 1 } = {}) {
  const base = { gold: [0.86, 0.62, 0.22], silver: [0.82, 0.83, 0.85], black: [0.06, 0.06, 0.07] }[kind];
  const c = once(`mli-${kind}`, () => {
    const W = 512;
    return canvas(W, W, (g) => {
      const img = g.createImageData(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        // Soft, broad wrinkles with fine crease lines, as stretched film catches light
        const n = fbm2(x / 70, y / 55, 4, 4), r = 1 - Math.abs(n * 2 - 1);
        const crease = 1 - Math.abs(fbm2(x / 22, y / 30, 3, 11) * 2 - 1);
        let k = 0.82 + 0.22 * Math.pow(r, 2.5) + 0.12 * Math.pow(crease, 8) + (noise2(x / 2, y / 2, 9) - 0.5) * 0.03;
        // Quilting: rows of stitches every 128 px, small dimples where the thread pulls the film in
        const qx = x % 128, qy = y % 128;
        if ((qx < 2 || qy < 2) && (x + y) % 6 < 3) k *= 0.55;
        if (Math.hypot(qx - 64, qy - 64) < 5) k *= 0.8;
        // Tape along the blanket edges
        if (x < 10 || y < 10 || x > W - 11 || y > W - 11) k = 0.95;
        const i = (y * W + x) * 4;
        img.data[i] = Math.min(255, base[0] * k * 255); img.data[i + 1] = Math.min(255, base[1] * k * 255); img.data[i + 2] = Math.min(255, base[2] * k * 255); img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  });
  const map = tex(c, { color: true, repeat: [repeat, repeat] }), bump = tex(c, { repeat: [repeat, repeat] });
  return new THREE.MeshStandardMaterial({
    map, bumpMap: bump, bumpScale: 0.5, metalness: kind === "black" ? 0.2 : 0.9, roughness: kind === "black" ? 0.6 : 0.22,
  });
}

/** Spacecraft radiator: white optical-solar-reflector tiles in a grid */
export function radiator() {
  const c = once("radiator", () => canvas(256, 256, (g) => {
    g.fillStyle = "#e9ecef"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(60,70,80,0.35)"; g.lineWidth = 1.5;
    for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  }));
  return new THREE.MeshStandardMaterial({ map: tex(c, { color: true, repeat: [2, 2] }), roughness: 0.18, metalness: 0.1 });
}

// ---------- Solar array: cells, busbars and the gaps between strings ----------
export function solarCells({ cols = 8, rows = 4 } = {}) {
  const c = once("solar", () => canvas(512, 256, (g, w, h) => {
    g.fillStyle = "#c8ccd2"; g.fillRect(0, 0, w, h);
    const cw = w / 16, ch = h / 8;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) {
      const x = i * cw + 2, y = j * ch + 2;
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, "#0d1b3a"); grad.addColorStop(1, "#15275a");
      g.fillStyle = grad; g.fillRect(x, y, cw - 4, ch - 4);
      g.strokeStyle = "rgba(190,200,220,0.35)"; g.lineWidth = 1;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + (k * (cw - 4)) / 4, y); g.lineTo(x + (k * (cw - 4)) / 4, y + ch - 4); g.stroke(); }
    }
  }));
  const map = tex(c, { color: true, repeat: [cols / 16, rows / 8] });
  return new THREE.MeshPhysicalMaterial({ map, metalness: 0.4, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1 });
}

// ---------- Launch vehicle skin: white paint, panel seams, soot toward the engines ----------
/** v runs 0 (base) to 1 (top) along a lathe; soot covers the lower `soot` fraction. */
export function rocketSkin({ soot = 0.35, color = "#eef0f2", seams = 14 } = {}) {
  const key = `skin-${soot}-${color}-${seams}`;
  const c = once(key, () => canvas(256, 1024, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    // Horizontal tank-section seams
    g.fillStyle = "rgba(0,0,0,0.12)";
    for (let i = 1; i < seams; i++) g.fillRect(0, (i / seams) * h, w, 2);
    // Engine soot: streaked, heaviest at the base, ragged upper edge
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = y / h; // canvas row 0 is the rocket's base (flipY is off below)
      for (let x = 0; x < w; x++) {
        const streak = fbm2(x / 9, y / 140, 4, 2);
        const edge = soot + (streak - 0.5) * 0.18;
        const k = Math.max(0, Math.min(1, (edge - v) / 0.12));
        const i = (y * w + x) * 4;
        const dirt = 0.15 + 0.5 * fbm2(x / 30, y / 30, 3, 5);
        for (let ch = 0; ch < 3; ch++) img.data[i + ch] = img.data[i + ch] * (1 - k * (0.92 - dirt * 0.4));
      }
    }
    g.putImageData(img, 0, 0);
  }));
  const map = tex(c, { color: true });
  map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping;
  map.flipY = false; // canvas row 0 maps to v = 0 (the rocket's base)
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.48, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 });
}

/**
 * Stainless-steel launcher skin: brushed steel with ring welds every `rings`,
 * engine soot over the lowest `soot` fraction, and (tiles) black hexagonal
 * heat-shield tiles over the windward half of the circumference (u 0..0.5).
 * Canvas row 0 is the base of the lathe (flipY off).
 */
export function steelSkin({ soot = 0, rings = 20, tiles = false } = {}) {
  const key = `steel-${soot}-${rings}-${tiles}`;
  const make = () => {
    const W = 512, H = 1024;
    const color = canvas(W, H, (g) => {
      const img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = y / H, u = x / W, i = (y * W + x) * 4;
        // Brushed steel: fine vertical grain, faint panel-to-panel tint shifts
        let c = 0.72 + (noise2(x / 1.5, y / 60, 1) - 0.5) * 0.08 + (noise2(Math.floor(u * 12), Math.floor(v * rings), 4) - 0.5) * 0.06;
        if ((v * rings) % 1 < 0.012) c *= 0.7; // weld seam
        // Engine soot, streaked up from the base
        const edge = soot + (fbm2(x / 10, y / 160, 4, 2) - 0.5) * 0.12;
        const k = Math.max(0, Math.min(1, (edge - v) / 0.1));
        c *= 1 - k * (0.75 - 0.3 * fbm2(x / 25, y / 25, 3, 5));
        let r = c, gg = c * 1.01, b = c * 1.03;
        if (tiles && u < 0.5) {
          // Hex tiles: offset rows, dark grey with thin gaps
          const ty = y / 9, row = Math.floor(ty), tx = x / 9 + (row % 2) * 0.5;
          const fx = tx % 1, fy = ty % 1;
          const gap = fx < 0.08 || fy < 0.1;
          const t = gap ? 0.03 : 0.07 + (noise2(Math.floor(tx), row, 7) - 0.5) * 0.03;
          // Soft edge where the tiles meet the bare steel
          const blend = Math.min(1, Math.min(u, 0.5 - u) * 60);
          r = r + (t - r) * blend; gg = gg + (t - gg) * blend; b = b + (t - b) * blend;
        }
        img.data[i] = r * 255; img.data[i + 1] = gg * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
    // Tiles are matte ceramic, the steel is metal
    const metalC = canvas(W, H, (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); if (tiles) { g.fillStyle = "#000"; g.fillRect(0, 0, W / 2, H); } });
    const roughC = canvas(W, H, (g) => { g.fillStyle = "#4d4d4d"; g.fillRect(0, 0, W, H); if (tiles) { g.fillStyle = "#e0e0e0"; g.fillRect(0, 0, W / 2, H); } });
    return { color, metalC, roughC };
  };
  const { color, metalC, roughC } = once(key, make);
  const set = (c, isColor) => { const t = tex(c, { color: isColor }); t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false; return t; };
  return new THREE.MeshStandardMaterial({
    map: set(color, true), metalnessMap: set(metalC), roughnessMap: set(roughC),
    metalness: 1, roughness: 1, envMapIntensity: 1.4,
  });
}

/** Rolling road: a dark steel belt with fine lateral grain, scrolled by the scene */
export function belt() {
  const c = once("belt", () => field(64, 512, (x, y) => 0.08 + 0.05 * noise2(x / 3, y / 1.5, 3) + (y % 64 < 2 ? 0.12 : 0)));
  const map = tex(c, { color: true, repeat: [4, 6] });
  return { material: new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0.1, color: 0x2c3035, envMapIntensity: 0.1 }), map };
}

/** Round soft sprite for particles and stars */
export function dot() {
  return once("dot", () => {
    const c = canvas(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    });
    const t = new THREE.CanvasTexture(c);
    return t;
  });
}
