// Wind-tunnel flow, computed rather than drawn. Air arrives from +x and leaves
// toward -x, the way it meets a car's nose.
//
// Low speed (the car, ~50 m/s, as in F1 tunnels): streamlines are integrated
// through a velocity field built from the car's shape. The free stream is
// turned tangent to the body near its surface (no flow through walls), so
// lines rise ahead of the nose and part around the tyres. Bound vortices on the
// front and rear wings add their circulation: the inverted rear wing speeds the
// air beneath it and throws upwash behind; their tips shed trailing vortices
// that spiral downstream. Air leaving blunt surfaces (tyres, the back of the
// car) separates into a turbulent wake.
import * as THREE from "three";

const U = new THREE.Vector3(-1, 0, 0);

// ---------- Curl of a smooth noise field: divergence-free turbulence ----------
function pnoise(x, y, z) {
  return Math.sin(x * 1.7 + Math.sin(y * 2.3 + z * 0.7)) * Math.cos(y * 1.3 + Math.sin(z * 1.9 + x * 0.5)) +
    0.5 * Math.sin(z * 3.1 + Math.cos(x * 2.7 - y * 1.1));
}
function curl(p, out, f = 1) {
  const e = 0.05, x = p.x * f, y = p.y * f, z = p.z * f;
  const n = (a, b, c, o) => pnoise(a + o, b - o * 0.7, c + o * 1.3);
  const dy_z = (n(x, y + e, z, 31) - n(x, y - e, z, 31)) / (2 * e), dz_y = (n(x, y, z + e, 17) - n(x, y, z - e, 17)) / (2 * e);
  const dz_x = (n(x, y, z + e, 5) - n(x, y, z - e, 5)) / (2 * e), dx_z = (n(x + e, y, z, 31) - n(x - e, y, z, 31)) / (2 * e);
  const dx_y = (n(x + e, y, z, 17) - n(x - e, y, z, 17)) / (2 * e), dy_x = (n(x, y + e, z, 5) - n(x, y - e, z, 5)) / (2 * e);
  return out.set(dy_z - dz_y, dz_x - dx_z, dx_y - dy_x);
}

/** Velocity induced by a vortex line along z (2D, Lamb-Oseen core), limited to |z - cz| < half */
function boundVortex(p, out, { x, y, cz = 0, half, gamma, core = 0.08 }) {
  const dx = p.x - x, dy = p.y - y, r2 = dx * dx + dy * dy;
  const spanFall = Math.max(0, 1 - Math.pow(Math.abs(p.z - cz) / half, 6));
  const k = (gamma / (2 * Math.PI)) * (1 - Math.exp(-r2 / (core * core))) / Math.max(r2, 1e-6) * spanFall;
  out.x += -dy * k; out.y += dx * k;
}
/** Trailing vortex along -x from (x0, y0, z0), drifting by `drift` (dy per metre); sense ±1 */
function trailingVortex(p, out, { x0, y0, z0, gamma, core = 0.06, drift = 0, sense = 1 }) {
  if (p.x > x0) return;
  const run = x0 - p.x;
  const cy = y0 + drift * run, dy = p.y - cy, dz = p.z - z0, r2 = dy * dy + dz * dz;
  const c = core * (1 + run * 0.12); // the core spreads as it travels
  const ramp = Math.min(1, run / 0.15) * Math.exp(-run / 7);
  const k = sense * (gamma / (2 * Math.PI)) * (1 - Math.exp(-r2 / (c * c))) / Math.max(r2, 1e-6) * ramp;
  out.y += -dz * k; out.z += dy * k;
}

/**
 * Streamlines round the car. sdf(p) is the car's signed distance.
 * Returns [{ points: Float32Array, s: Float32Array (arc length), turb: Float32Array }]
 */
export function carStreamlines(sdf, { seeds, x0 = 4.4, x1 = -7, h = 0.018 } = {}) {
  const grad = new THREE.Vector3(), q = new THREE.Vector3(), v = new THREE.Vector3(), tmp = new THREE.Vector3(), c = new THREE.Vector3();
  const e = 0.012;
  const normal = (p) => {
    q.copy(p);
    const dx = sdf(q.set(p.x + e, p.y, p.z)) - sdf(q.set(p.x - e, p.y, p.z));
    const dy = sdf(q.set(p.x, p.y + e, p.z)) - sdf(q.set(p.x, p.y - e, p.z));
    const dz = sdf(q.set(p.x, p.y, p.z + e)) - sdf(q.set(p.x, p.y, p.z - e));
    return grad.set(dx, dy, dz).normalize();
  };
  // Wings: inverted aerofoils, so circulation runs clockwise seen from +z
  // (fast air underneath, upwash behind)
  const rear = { x: -2.38, y: 0.86, half: 0.5, gamma: -0.9, core: 0.12 };
  const front = [-1, 1].map((s) => ({ x: 2.55, y: 0.16, cz: 0.58 * s, half: 0.38, gamma: -0.6, core: 0.07 }));
  const tips = [
    // Rear wing tips: air spills from the high-pressure top round the tip to the underside
    ...[-1, 1].map((s) => ({ x0: -2.62, y0: 0.9, z0: 0.5 * s, gamma: 0.7, core: 0.06, drift: 0.09, sense: s })),
    // Front wing endplate vortices: run outboard of the front tyres
    ...[-1, 1].map((s) => ({ x0: 2.3, y0: 0.24, z0: 0.97 * s, gamma: 0.5, core: 0.045, drift: 0.02, sense: s })),
  ];

  const field = (p, turb, out) => {
    out.copy(U);
    for (const w of [rear, ...front]) boundVortex(p, out, w);
    for (const t of tips) trailingVortex(p, out, t);
    const d = sdf(p);
    if (d < 0.5) {
      const n = normal(p);
      const into = out.dot(n);
      // No flow through the body: the inward part of the velocity fades out near the wall
      if (into < 0) out.addScaledVector(n, -into * Math.exp(-Math.max(d, 0) / 0.11));
      if (d < 0.02) out.addScaledVector(n, (0.02 - d) * 25);
    }
    // The rolling road moves with the air: no boundary layer, flow stays above it
    if (p.y < 0.06 && out.y < 0) out.y *= p.y / 0.06;
    if (turb > 0.001) out.addScaledVector(curl(p, tmp, 2.2), 0.16 * turb);
    return out;
  };

  const lines = [];
  for (const seed of seeds) {
    const p = new THREE.Vector3(x0, seed[0], seed[1]);
    const pts = [], ss = [], tt = [];
    let s = 0, turb = 0;
    for (let i = 0; i < 2400 && p.x > x1; i++) {
      pts.push(p.x, p.y, p.z); ss.push(s); tt.push(turb);
      // Separation: leaving a blunt surface close in trips the line into the wake
      const d = sdf(p);
      if (d < 0.07 && p.x < 2.0) {
        const n = normal(p);
        if (n.x < -0.35) turb = Math.max(turb, Math.min(1, (0.07 - d) / 0.05) * (-n.x));
      }
      if (p.x < -2.5 && Math.abs(p.z) < 0.55 && p.y < 1.05) turb = Math.max(turb, 0.35 * Math.min(1, (-2.5 - p.x) / 0.4)); // rear-wing and diffuser wake
      turb *= p.x < -3 ? 0.9985 : 0.9995;
      // Midpoint (RK2) step
      field(p, turb, v).normalize();
      c.copy(p).addScaledVector(v, h / 2);
      field(c, turb, v).normalize();
      p.addScaledVector(v, h);
      if (p.y < 0.012) p.y = 0.012;
      s += h;
    }
    lines.push({ points: new Float32Array(pts), s: new Float32Array(ss), turb: new Float32Array(tt) });
  }
  return lines;
}

/** The smoke rake: a centre-plane fan over the car, then planes over the sidepods, tyres and beyond */
export function carSeeds() {
  const seeds = [];
  for (const y of [0.1, 0.2, 0.3, 0.42, 0.55, 0.68, 0.82, 0.98, 1.16]) seeds.push([y, 0]);
  for (const s of [-1, 1]) {
    for (const y of [0.14, 0.3, 0.46, 0.62, 0.8]) seeds.push([y, 0.55 * s]);
    for (const y of [0.12, 0.26, 0.42, 0.6, 0.85]) seeds.push([y, 0.86 * s]);
    for (const y of [0.2, 0.5, 0.9]) seeds.push([y, 1.18 * s]);
  }
  return seeds;
}

/**
 * Smoke-tracer material for streamlines: faint continuous trails with pulses
 * of smoke travelling at the flow speed. Wake segments shimmer and spread.
 */
export function smokeMaterial(color = 0xffffff) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSpeed: { value: 1 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aS; attribute float aTurb; attribute float aSeed;
      uniform float uTime, uSpeed; varying float vS; varying float vTurb; varying float vSeed;
      void main(){ vS = aS; vTurb = aTurb; vSeed = aSeed; vec3 p = position;
        float t = uTime * uSpeed;
        p.y += aTurb * 0.05 * sin(aS * 11.0 - t * 9.0 + aSeed * 3.0);
        p.z += aTurb * 0.05 * cos(aS * 9.0 - t * 7.0 + aSeed * 5.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime, uSpeed, uOpacity; uniform vec3 uColor; varying float vS; varying float vTurb; varying float vSeed;
      void main(){
        float t = uTime * uSpeed;
        float head = smoothstep(0.0, 0.6, vS);                  // smoke leaves the rake nozzle
        float tail = 1.0 - smoothstep(6.5, 11.0, vS);           // and diffuses away downstream
        float pulse = pow(0.5 + 0.5 * sin((vS - t * 1.8) * 2.6 + vSeed * 6.28), 10.0);
        float a = (0.3 + 0.7 * pulse) * head * tail * (1.0 - vTurb * 0.55) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
}

/** Lines from streamline data, sharing one smoke material */
export function streamlineMesh(lines, material) {
  const g = new THREE.Group();
  lines.forEach((l, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(l.points, 3));
    geo.setAttribute("aS", new THREE.BufferAttribute(l.s, 1));
    geo.setAttribute("aTurb", new THREE.BufferAttribute(l.turb, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(l.s.length).fill((i * 0.618) % 1), 1));
    const line = new THREE.Line(geo, material);
    line.frustumCulled = false;
    g.add(line);
  });
  return g;
}

/**
 * Smoke particles riding the streamlines: denser, softer puffs that grow in
 * the wake. update(time) moves them along their lines.
 */
export function smokeParticles(lines, { count = 900, speed = 1.8, size = 0.05 } = {}) {
  const pos = new Float32Array(count * 3), alpha = new Float32Array(count), scale = new Float32Array(count);
  const own = Array.from({ length: count }, (_, i) => ({ line: lines[i % lines.length], phase: (i * 0.7548) % 1 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size * 900 }, uOpacity: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aAlpha; attribute float aScale; uniform float uSize; varying float vA;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * aScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; uniform float uOpacity; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uOpacity; gl_FragColor = vec4(vec3(a), a); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t) => {
    for (let i = 0; i < count; i++) {
      const { line, phase } = own[i];
      const n = line.s.length, total = line.s[n - 1];
      const s = ((phase + t * speed / total) % 1) * total;
      const k = Math.min(n - 1, Math.floor(s / (total / (n - 1))));
      const turb = line.turb[k];
      pos[i * 3] = line.points[k * 3];
      pos[i * 3 + 1] = line.points[k * 3 + 1] + turb * 0.06 * Math.sin(t * 7 + i);
      pos[i * 3 + 2] = line.points[k * 3 + 2] + turb * 0.06 * Math.cos(t * 6 + i * 1.3);
      alpha[i] = 0.16 * Math.min(1, s / 0.5) * (1 - Math.min(1, s / 10)) * (1 - turb * 0.3);
      scale[i] = 1 + turb * 2.5;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true; geo.attributes.aScale.needsUpdate = true;
  };
  return pts;
}
