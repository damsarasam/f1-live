// Space hardware and bodies, modelled after real ones (generic, unbranded):
// a heavy-lift launcher with two side boosters, the ASTRAEUS mining craft,
// a capture net, a rubble-pile asteroid shaped like Bennu, a textured Earth
// and a starfield. Launcher units: 1 = 10 m. Craft units: 1 = 1 m.
import * as THREE from "three";
import { lathe, strut } from "./geometry.js";
import { rocketSkin, metal, satin, rng, fbm3, noise3 } from "./materials.js";

const R = 0.183; // 3.66 m core diameter

// ---------- Engines and plumes ----------
function engineCluster(mats, count = 9) {
  const g = new THREE.Group();
  const bell = lathe([[0.016, 0], [0.02, -0.02], [0.034, -0.06], [0.046, -0.1]], 24);
  const ring = [[0, 0]];
  for (let i = 0; i < count - 1; i++) { const a = (i / (count - 1)) * Math.PI * 2; ring.push([Math.cos(a) * 0.125, Math.sin(a) * 0.125]); }
  for (const [x, z] of ring) { const m = new THREE.Mesh(bell, mats.bell); m.position.set(x, 0, z); g.add(m); }
  return g;
}

/** Exhaust plume: a hot core and a softer envelope, flickering; expands in vacuum */
export function plume({ length = 1.2, radius = 0.16 } = {}) {
  const uniforms = { uTime: { value: 0 }, uVacuum: { value: 0 }, uPower: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uVacuum;
      void main(){ vUv = uv; vec3 p = position;
        // In vacuum the plume flares wide just past the nozzle
        float k = 1.0 - uv.y; p.xz *= 1.0 + uVacuum * k * 2.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uTime, uVacuum, uPower;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float along = 1.0 - vUv.y;                       // 0 at the nozzle, 1 at the tail
        float edge = pow(abs(dot(vN, vV)), 1.6);         // brighter through the middle of the cone
        float flick = 0.85 + 0.15 * sin(uTime * 60.0 + along * 30.0) * h(floor(uTime * 24.0));
        // Shock diamonds in the dense core at sea level
        float diamonds = (1.0 - uVacuum) * 0.35 * pow(0.5 + 0.5 * cos(along * 38.0), 6.0) * smoothstep(0.6, 0.0, along);
        vec3 hot = vec3(1.0, 0.96, 0.85), warm = vec3(1.0, 0.55, 0.18);
        vec3 col = mix(hot, warm, smoothstep(0.0, 0.55, along)) + diamonds;
        float a = edge * smoothstep(1.0, 0.05, along) * flick * uPower * mix(0.95, 0.35, uVacuum);
        // A white-hot throat just past the nozzle, then the glowing exhaust
        float throat = smoothstep(0.18, 0.0, along) * 1.5;
        gl_FragColor = vec4(col * a * (2.4 + throat), a);
      }`,
  });
  // Nozzle-wide at y = 0, widening downstream to the tail at y = -length
  const geo = new THREE.CylinderGeometry(radius * 0.32, radius, length, 32, 24, true);
  geo.translate(0, -length / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.userData.uniforms = uniforms;
  m.frustumCulled = false;
  return m;
}

function gridFin(mat) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.13), mat);
  g.add(frame);
  for (let i = -2; i <= 2; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.13), mat); a.position.x = i * 0.022; a.rotation.y = 0.78; g.add(a);
  }
  return g;
}

function firstStage(mats, { nose = false } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[R, 0.0], [R, 4.2]], 48), mats.skin));
  // Octaweb skirt and the nine engines under it
  g.add(new THREE.Mesh(lathe([[R * 0.98, -0.02], [R, 0.06]], 48), mats.black));
  const engines = engineCluster(mats); engines.position.y = -0.02; g.add(engines);
  // Folded landing legs
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.025), mats.black);
    leg.position.set(Math.cos(a) * (R + 0.01), 0.52, Math.sin(a) * (R + 0.01)); leg.rotation.y = -a + Math.PI / 2;
    g.add(leg);
  }
  // Grid fins, stowed flat against the top of the stage
  const fins = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * (R + 0.01), 4.06, Math.sin(a) * (R + 0.01));
    pivot.rotation.y = -a;
    const fin = gridFin(mats.titanium); fin.position.x = 0.06; fin.rotation.z = Math.PI / 2;
    pivot.add(fin); g.add(pivot); fins.push({ pivot, fin });
  }
  if (nose) g.add(new THREE.Mesh(lathe([[R, 4.2], [R * 0.98, 4.42], [R * 0.78, 4.66], [R * 0.4, 4.86], [0.001, 4.94]], 48), mats.noseSkin));
  g.userData.fins = fins;
  return g;
}

export function launchVehicle({ boosters = true } = {}) {
  const mats = {
    skin: rocketSkin({ soot: 0.42, seams: 12 }),
    noseSkin: rocketSkin({ soot: 0, seams: 2 }),
    upperSkin: rocketSkin({ soot: 0, seams: 5 }),
    fairing: rocketSkin({ soot: 0, seams: 3, color: "#f4f5f6" }),
    black: satin(0x16171a, 0.55),
    titanium: metal(0x6e6a66, 0.5),
    bell: metal(0x4a4440, 0.45),
  };
  const lv = new THREE.Group();
  lv.name = "launch-vehicle";
  const core = firstStage(mats);
  // Interstage: black, hiding the upper stage's vacuum nozzle
  core.add(new THREE.Mesh(lathe([[R, 4.2], [R, 4.85]], 48), mats.black));
  lv.add(core);

  const upper = new THREE.Group();
  upper.add(new THREE.Mesh(lathe([[R, 4.85], [R, 6.15]], 48), mats.upperSkin));
  upper.add(new THREE.Mesh(lathe([[0.16, 4.3], [0.12, 4.55], [0.06, 4.82], [0.05, 4.85]], 32), metal(0x3a3633, 0.35)));
  // Payload fairing: two clamshell halves around the spacecraft
  const profile = [[R, 6.15], [0.262, 6.32], [0.262, 6.8], [0.24, 7.02], [0.19, 7.24], [0.11, 7.4], [0.001, 7.47]];
  const halves = [0, Math.PI].map((phi) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(lathe(profile, 48, phi, Math.PI), mats.fairing);
    m.material.side = THREE.DoubleSide;
    pivot.add(m); upper.add(pivot);
    return pivot;
  });
  const payloadMount = new THREE.Group(); payloadMount.position.y = 6.25;
  upper.add(payloadMount);
  const mvacPlume = plume({ length: 1.4, radius: 0.14 }); mvacPlume.position.y = 4.3; mvacPlume.visible = false;
  upper.add(mvacPlume);
  lv.add(upper);

  const side = [];
  if (boosters) for (const z of [-0.4, 0.4]) {
    const b = firstStage(mats, { nose: true });
    b.position.z = z;
    for (const y of [0.4, 3.9]) b.add(strut([0, y, -Math.sign(z) * R], [0, y, -Math.sign(z) * (0.4 - R)], 0.012, mats.black, 1));
    lv.add(b); side.push(b);
  }
  // Sea-level plumes under each first stage
  const plumes = [core, ...side].map((st) => { const p = plume({ length: 3.6, radius: 0.24 }); p.position.y = -0.1; st.add(p); return p; });
  lv.userData = { core, upper, boosters: side, fairing: halves, payloadMount, plumes, mvacPlume, coreFins: core.userData.fins };
  return lv;
}

// ---------- ASTRAEUS mining craft (detailed model in craft.js) ----------
export { miningCraft } from "./craft.js";

// ---------- Capture net ----------
/**
 * A square net, `n` knots a side. set(state) places every knot between its
 * flat, spreading flight shape and wrapped around a sphere (the asteroid).
 */
export function captureNet(n = 22) {
  const knots = n * n;
  const pos = new Float32Array(knots * 3);
  const idx = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i * n + j;
    if (i < n - 1) idx.push(k, k + n);
    if (j < n - 1) idx.push(k, k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xe9e4d6, transparent: true, opacity: 0.9 }));
  lines.frustumCulled = false;
  const weights = new THREE.Group();
  const wMat = metal(0x8d939b, 0.35);
  const corners = [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1], [0, (n - 1) >> 1], [n - 1, (n - 1) >> 1], [(n - 1) >> 1, 0], [(n - 1) >> 1, n - 1]];
  corners.forEach(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), wMat); weights.add(m); });
  const group = new THREE.Group(); group.add(lines, weights);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();
  /**
   * from: launch point; to: sphere centre; radius: sphere radius;
   * fly 0..1 (flight from launcher to target), size: open width, wrap 0..1
   */
  group.userData.set = ({ from, to, radius, fly, size, wrap, time = 0 }) => {
    const dir = b.copy(to).sub(from).normalize();
    up.set(0, 1, 0); if (Math.abs(dir.y) > 0.9) up.set(1, 0, 0);
    side.crossVectors(dir, up).normalize(); up.crossVectors(side, dir).normalize();
    // The net's centre flies to the near surface of the sphere
    const hit = a.copy(to).addScaledVector(dir, -radius);
    const centre = from.clone().lerp(hit, fly);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const u = (i / (n - 1)) * 2 - 1, v = (j / (n - 1)) * 2 - 1;
      const rad = Math.min(1, Math.hypot(u, v) / Math.SQRT2);
      // Flight: a flat sheet that bellies back as it opens, rippling slightly
      const belly = (1 - rad * rad) * size * 0.18 * (1 - wrap);
      const ripple = Math.sin(time * 6 + u * 4 + v * 3) * 0.03 * size * (1 - wrap);
      const fx = centre.x + side.x * u * size / 2 + up.x * v * size / 2 - dir.x * (belly + ripple);
      const fy = centre.y + side.y * u * size / 2 + up.y * v * size / 2 - dir.y * (belly + ripple);
      const fz = centre.z + side.z * u * size / 2 + up.z * v * size / 2 - dir.z * (belly + ripple);
      // Wrapped: the same knot laid on the sphere, angle from the contact point growing with distance
      const ang = Math.hypot(u, v) * 1.25, az = Math.atan2(v, u);
      const sx = -Math.cos(ang), sl = Math.sin(ang);
      const wx = to.x + (dir.x * sx + (side.x * Math.cos(az) + up.x * Math.sin(az)) * sl) * radius * 1.04;
      const wy = to.y + (dir.y * sx + (side.y * Math.cos(az) + up.y * Math.sin(az)) * sl) * radius * 1.04;
      const wz = to.z + (dir.z * sx + (side.z * Math.cos(az) + up.z * Math.sin(az)) * sl) * radius * 1.04;
      // The centre touches first; the weighted edges wrap round after
      const k = Math.min(1, Math.max(0, wrap * 1.7 - rad * 0.7));
      const e = k * k * (3 - 2 * k);
      pos.set([fx + (wx - fx) * e, fy + (wy - fy) * e, fz + (wz - fz) * e], (i * n + j) * 3);
    }
    geo.attributes.position.needsUpdate = true;
    corners.forEach(([i, j], c) => { const w = weights.children[c]; w.position.fromArray(pos, (i * n + j) * 3); w.lookAt(to); });
  };
  group.userData.knot = (i, j, out = new THREE.Vector3()) => out.fromArray(pos, (i * n + j) * 3);
  group.userData.n = n;
  return group;
}

// ---------- Asteroid: a dark rubble pile with a spinning-top shape, like Bennu ----------
function icosphere(detail) {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  // Weld the duplicated vertices so displaced normals stay smooth
  const src = ico.attributes.position, map = new Map(), verts = [], index = [];
  for (let i = 0; i < src.count; i++) {
    const x = src.getX(i), y = src.getY(i), z = src.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let id = map.get(key);
    if (id === undefined) { id = verts.length / 3; map.set(key, id); verts.push(x, y, z); }
    index.push(id);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(index);
  return geo;
}

export function asteroid({ radius = 1, seed = 3, detail = 48, boulders = 700 } = {}) {
  const geo = icosphere(detail);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const rand = rng(seed);
  const craters = Array.from({ length: 9 }, () => {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    return { d: new THREE.Vector3(k * Math.cos(th), u, k * Math.sin(th)), r: 0.12 + rand() * 0.22, depth: 0.03 + rand() * 0.04 };
  });
  const n = new THREE.Vector3();
  const shapeAt = (v) => {
    // Spinning-top: an equatorial ridge, flattened toward the poles
    const lat = Math.abs(v.y);
    let r = 0.86 + 0.2 * Math.pow(1 - lat, 2.4);
    r += (fbm3(v.x * 1.3 + 4, v.y * 1.3, v.z * 1.3, 4, seed) - 0.5) * 0.16;
    r += (fbm3(v.x * 4.5, v.y * 4.5, v.z * 4.5, 4, seed + 3) - 0.5) * 0.06;
    // Ridged detail: rubble and fractured blocks
    r += (1 - Math.abs(noise3(v.x * 14, v.y * 14, v.z * 14, seed + 9) * 2 - 1)) * 0.012;
    for (const c of craters) {
      const d = Math.acos(Math.min(1, v.dot(c.d))) / c.r;
      if (d < 1.3) r += d < 1 ? -c.depth * (1 - d * d) : c.depth * 0.35 * (1 - (d - 1) / 0.3);
    }
    return r;
  };
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    const r = shapeAt(n) * radius;
    p.setXYZ(i, n.x * r, n.y * r, n.z * r);
    // Albedo: very dark carbonaceous grey with brighter and darker patches
    const a = 0.04 + (fbm3(n.x * 3, n.y * 3, n.z * 3, 3, seed + 20) - 0.5) * 0.035 + (noise3(n.x * 30, n.y * 30, n.z * 30, seed) - 0.5) * 0.016;
    col.set([a * 1.02, a, a * 0.97], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.25 });
  const rock = new THREE.Group();
  rock.name = "asteroid";
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = body.receiveShadow = true;
  rock.add(body);

  // Boulders: power-law sizes, a few large blocks and many small ones
  const bGeo = new THREE.IcosahedronGeometry(1, 1);
  const bp = bGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { n.fromBufferAttribute(bp, i); n.multiplyScalar(0.75 + noise3(n.x * 3, n.y * 3, n.z * 3, 5) * 0.5); bp.setXYZ(i, n.x, n.y, n.z); }
  bGeo.computeVertexNormals();
  const inst = new THREE.InstancedMesh(bGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, envMapIntensity: 0.25 }), boulders);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < boulders; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    n.set(k * Math.cos(th), u, k * Math.sin(th));
    const size = radius * (0.006 + 0.07 * Math.pow(rand(), 7));
    const r = shapeAt(n) * radius - size * 0.15; // half-buried in the regolith
    q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
    sc.set(size * (0.8 + rand() * 0.5), size * (0.6 + rand() * 0.4), size * (0.8 + rand() * 0.5));
    m4.compose(n.clone().multiplyScalar(r), q, sc);
    inst.setMatrixAt(i, m4);
    const a = 0.035 + rand() * 0.035 + (rand() < 0.04 ? 0.09 : 0); // the odd bright boulder
    inst.setColorAt(i, c.setRGB(a * 1.02, a, a * 0.97));
  }
  inst.castShadow = inst.receiveShadow = true;
  rock.add(inst);
  rock.userData.radius = radius * 1.02;
  rock.userData.surface = (dir) => dir.clone().normalize().multiplyScalar(shapeAt(dir.clone().normalize()) * radius);
  return rock;
}

// ---------- Earth: day map, night lights on the dark side, clouds and atmosphere ----------
// Earth textures share one manager so a still frame can be redrawn once they arrive
const textures = new THREE.LoadingManager();
const waiting = new Set();
let texturesReady = false;
textures.onLoad = () => { texturesReady = true; waiting.forEach((cb) => cb()); waiting.clear(); };
/** Run cb when the Earth textures have loaded (at once if they already have) */
export function whenTexturesLoaded(cb) { if (texturesReady) cb(); else waiting.add(cb); }

export function earthGlobe(radius = 2, { sun = new THREE.Vector3(1, 0.3, 0.6) } = {}) {
  const loader = new THREE.TextureLoader(textures);
  const load = (f, color = true) => { const t = loader.load(`/assets/textures/${f}`); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const sunDir = { value: sun.clone().normalize() };
  const g = new THREE.Group();
  g.name = "earth";
  const mat = new THREE.MeshPhongMaterial({
    map: load("earth_atmos_2048.jpg"), specularMap: load("earth_specular_2048.jpg", false), normalMap: load("earth_normal_2048.jpg", false),
    normalScale: new THREE.Vector2(0.8, 0.8), specular: new THREE.Color(0x2a3440), shininess: 18,
    emissive: new THREE.Color(0xffc98a), emissiveMap: load("earth_lights_2048.png"), emissiveIntensity: 1.3,
  });
  // City lights only on the night side
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSun = sunDir;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWN;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWN = normalize(mat3(modelMatrix) * normal);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWN; uniform vec3 uSun;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0 - smoothstep(-0.2, 0.15, dot(vWN, uSun));");
  };
  const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), mat);
  g.add(globe);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.008, 96, 72),
    new THREE.MeshLambertMaterial({ map: load("earth_clouds_1024.png"), transparent: true, opacity: 0.85, depthWrite: false }));
  g.add(clouds);
  // Atmosphere: a thin blue limb, brightest where it is sunlit
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.045, 96, 72), new THREE.ShaderMaterial({
    uniforms: { uSun: sunDir, uFade: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vW; uniform vec3 uSun; uniform float uFade;
      void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(vN, v)), 3.0);
        float lit = smoothstep(-0.3, 0.5, dot(vN, uSun));
        vec3 c = vec3(0.32, 0.62, 1.0) * rim * (0.15 + 1.6 * lit) * uFade; gl_FragColor = vec4(c, rim * uFade); }`,
  }));
  g.add(atmo);
  g.userData = { globe, clouds, atmo, sunDir: sunDir.value, material: mat };
  return g;
}

/** Stars with natural magnitudes and colour temperatures, sized in pixels */
export function stars(count = 4000, radius = 300, seed = 11) {
  const rand = rng(seed);
  const pos = new Float32Array(count * 3), size = new Float32Array(count), col = new Float32Array(count * 3);
  const temps = [[0.75, 0.82, 1], [1, 1, 1], [1, 0.95, 0.85], [1, 0.82, 0.62]];
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    pos.set([k * Math.cos(th) * radius, u * radius, k * Math.sin(th) * radius], i * 3);
    const mag = Math.pow(rand(), 9); // most are faint
    size[i] = 0.6 + mag * 2.6;
    const t = temps[Math.floor(rand() * temps.length)], b = 0.35 + mag * 0.65;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: Math.min(devicePixelRatio || 1, 2) } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uPx; void main(){ vC = color; gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC, a); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
