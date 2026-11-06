// Geometry builders for realistic vehicles: bodies lofted through
// superellipse cross-sections, wings extruded from NACA 4-digit airfoils,
// struts between two points and swept tubes.
import * as THREE from "three";

const cr = (p0, p1, p2, p3, t) => {
  // Uniform Catmull-Rom: smooth through every control value
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/**
 * A body lofted along x through cross-sections
 * { x, w, top, bot, mid?, cz?, n?, nb? }: w is full width, top/bot absolute
 * heights, mid the height of the widest point, n/nb the superellipse
 * exponents above/below it (2 = ellipse, larger = boxier).
 */
export function loft(sections, { steps = 64, ring = 48, caps = true } = {}) {
  const keys = ["x", "w", "top", "bot", "mid", "cz", "n", "nb"];
  const S = sections.map((s) => ({ cz: 0, n: 2.6, nb: 3.2, mid: s.bot + (s.top - s.bot) * 0.42, ...s }));
  const at = (u) => {
    const f = u * (S.length - 1), i = Math.min(S.length - 2, Math.floor(f)), t = f - i;
    const g = (k) => cr(S[Math.max(0, i - 1)][k], S[i][k], S[i + 1][k], S[Math.min(S.length - 1, i + 2)][k], t);
    return Object.fromEntries(keys.map((k) => [k, g(k)]));
  };
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const s = at(i / steps);
    for (let j = 0; j <= ring; j++) {
      const th = (j / ring) * Math.PI * 2;
      const c = Math.cos(th), sn = Math.sin(th);
      const z = s.cz + (s.w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / s.n);
      const y = sn >= 0 ? s.mid + (s.top - s.mid) * Math.pow(Math.abs(sn), 2 / s.n)
        : s.mid - (s.mid - s.bot) * Math.pow(Math.abs(sn), 2 / s.nb);
      pos.push(s.x, y, z);
      uv.push(j / ring, i / steps);
    }
  }
  const row = ring + 1;
  for (let i = 0; i < steps; i++) for (let j = 0; j < ring; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  if (caps) {
    for (const [i, flip] of [[0, false], [steps, true]]) {
      const s = at(i / steps);
      const centre = pos.length / 3;
      pos.push(s.x, s.mid, s.cz); uv.push(0.5, i / steps);
      for (let j = 0; j < ring; j++) {
        const a = i * row + j;
        if (flip) idx.push(centre, a, a + 1); else idx.push(centre, a + 1, a);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** NACA 4-digit section outline: chord 1 from leading edge (x=0) to trailing edge (x=1) */
export function naca(camber = 0.04, pos = 0.4, thick = 0.12, n = 40) {
  const upper = [], lower = [];
  for (let i = 0; i <= n; i++) {
    const b = (i / n) * Math.PI, x = (1 - Math.cos(b)) / 2; // cosine spacing packs the nose
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < pos ? (camber / pos ** 2) * (2 * pos * x - x * x) : (camber / (1 - pos) ** 2) * (1 - 2 * pos + 2 * pos * x - x * x);
    const dy = x < pos ? (2 * camber / pos ** 2) * (pos - x) : (2 * camber / (1 - pos) ** 2) * (pos - x);
    const th = Math.atan(dy);
    upper.push([x - yt * Math.sin(th), yc + yt * Math.cos(th)]);
    lower.push([x + yt * Math.sin(th), yc - yt * Math.cos(th)]);
  }
  return [...upper, ...lower.reverse().slice(1, -1)];
}

/**
 * A wing element: airfoil of `chord`, extruded `span` along z (centred on
 * cz), leading edge at x = le pointing +x (into the oncoming air), pitched
 * nose-down by `aoa` radians. Downforce wings use inverted camber.
 */
export function wing({ chord = 0.3, span = 1, thick = 0.1, camber = 0.06, le = 0, y = 0, cz = 0, aoa = 0, inverted = true }) {
  const pts = naca(camber, 0.4, thick);
  const shape = new THREE.Shape();
  pts.forEach(([px, py], i) => {
    // Chord runs from the leading edge back toward -x; inverted flips the camber down
    const x = -px * chord, yy = (inverted ? -py : py) * chord;
    const ca = Math.cos(aoa), sa = Math.sin(aoa);
    // Pitch about the leading edge: positive aoa raises the trailing edge (more downforce)
    const rx = x * ca + yy * sa, ry = -x * sa + yy * ca;
    if (i === 0) shape.moveTo(rx, ry); else shape.lineTo(rx, ry);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false, steps: 1 });
  geo.translate(le, y, cz - span / 2);
  geo.computeVertexNormals();
  return geo;
}

/** A flat plate from an x-y outline, `thick` deep in z, centred on cz */
export function plate(points, thick = 0.012, cz = 0) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.3, bevelSize: thick * 0.3, bevelSegments: 2, curveSegments: 16 });
  geo.translate(0, 0, cz - thick / 2);
  return geo;
}

/** A flat plate from an x-z outline (a floor), `thick` deep in y with its underside at y */
export function floorPlate(points, thick = 0.02, y = 0) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  return geo;
}

/** A strut from a to b; `flat` < 1 squashes it into an aerofoil-like blade */
export function strut(a, b, r = 0.015, material, flat = 0.4) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const geo = new THREE.CylinderGeometry(r, r, len, 10, 1);
  geo.scale(1, 1, flat);
  const m = new THREE.Mesh(geo, material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

/** A tube swept through points */
export function tube(points, r = 0.02, segs = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  return new THREE.TubeGeometry(curve, segs, r, 12, false);
}

/** Lathe around +y from [radius, y] pairs (base to top) */
export function lathe(points, segs = 48, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs, phiStart, phiLength);
}

/**
 * Tyre cross-section for a lathe: [radius, axial] from the inner bead out
 * along the sidewall, round the shoulder, across the tread and back.
 */
export function tyreProfile(rIn, rOut, halfW, corner = 0.06) {
  const pts = [[rIn, -halfW * 0.9], [rIn + (rOut - rIn) * 0.45, -halfW * 1.0]];
  const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * (i / 10); pts.push([cx + Math.cos(a) * corner, cy + Math.sin(a) * corner]); } };
  arc(rOut - corner, -halfW + corner, -Math.PI / 2, 0);
  arc(rOut - corner, halfW - corner, 0, Math.PI / 2);
  pts.push([rIn + (rOut - rIn) * 0.45, halfW * 1.0], [rIn, halfW * 0.9]);
  return pts;
}
