// A generic, unbranded Formula 1 car to the 2026 rules at true scale (metres):
// 3.4 m wheelbase, 1.9 m wide, narrower 18-inch tyres, active front and rear
// wing flaps, no beam wing. Nose points +x, the
// ground is y = 0, z is across the car. Its body is also described as a set of
// simple solids (`collider`) so the wind-tunnel flow can be computed around it.
import * as THREE from "three";
import { loft, wing, plate, floorPlate, strut, tube, lathe, tyreProfile } from "./geometry.js";
import { carbon, paint, satin, metal, rubber, glow } from "./materials.js";

export const CAR = { length: 5.5, frontAxle: 1.55, rearAxle: -1.85, tyreR: 0.36, track: 0.8 };

function wheelAssembly({ r = 0.36, halfW = 0.15, rimR = 0.232, side = 1, mats }) {
  const g = new THREE.Group();
  // Built around +y, then turned so the axle is z
  const spin = new THREE.Group();
  const tyre = new THREE.Mesh(lathe(tyreProfile(rimR, r, halfW), 72), mats.rubber);
  tyre.castShadow = true;
  spin.add(tyre);
  // Compound stripe on the outer sidewall
  const stripe = new THREE.Mesh(new THREE.RingGeometry(r * 0.79, r * 0.81, 72), mats.stripe);
  stripe.rotation.x = -Math.PI / 2; stripe.position.y = halfW * 1.005 * side;
  if (side < 0) stripe.rotation.x = Math.PI / 2;
  spin.add(stripe);
  // Rim barrel and the flat aero wheel cover
  spin.add(new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, halfW * 1.75, 48, 1, true), mats.rim));
  const cover = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.98, 48), mats.cover);
  cover.rotation.x = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  cover.position.y = halfW * 0.86 * side;
  spin.add(cover);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 6), mats.nut);
  hub.position.y = halfW * 0.88 * side;
  spin.add(hub);
  spin.rotation.x = Math.PI / 2;
  g.add(spin);
  g.userData.spin = spin;
  return g;
}

export function f1Car({ body = 0x1b1e23, accent = 0x00c3ff } = {}) {
  const car = new THREE.Group();
  car.name = "f1-car";
  const mats = {
    body: paint(body, { metalness: 0.45, roughness: 0.28 }),
    accent: paint(accent, { metalness: 0.3, roughness: 0.3 }),
    carbon: carbon({ repeat: 10 }),
    dark: satin(0x0c0d0f, 0.6),
    rubber: rubber(),
    stripe: satin(0xf2f2f2, 0.5),
    rim: metal(0x2a2c31, 0.35),
    cover: carbon({ repeat: 3 }),
    nut: paint(accent, { metalness: 0.8, roughness: 0.25 }),
    steel: metal(0x9ea3aa, 0.28),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.05, metalness: 0.9, clearcoat: 1 }),
    helmet: paint(0xf4f5f7, { metalness: 0.1, roughness: 0.25 }),
    rain: glow(0xff0000, 1.1),
  };
  const add = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; car.add(m); return m; };

  // ---------- Survival cell and nose: high, sharp-shouldered chassis, slim nose ----------
  add(loft([
    { x: 2.80, w: 0.10, top: 0.25, bot: 0.15, n: 2.6 },
    { x: 2.45, w: 0.18, top: 0.33, bot: 0.14, n: 3.0 },
    { x: 2.05, w: 0.26, top: 0.44, bot: 0.12, n: 3.4 },
    { x: 1.55, w: 0.36, top: 0.55, bot: 0.11, n: 3.8 },
    { x: 1.00, w: 0.50, top: 0.61, bot: 0.09, n: 3.8 },
    { x: 0.50, w: 0.62, top: 0.63, bot: 0.07, n: 3.6 },
    { x: 0.00, w: 0.66, top: 0.60, bot: 0.06, n: 3.4 },
    { x: -0.40, w: 0.60, top: 0.64, bot: 0.06, n: 3.2 },
    { x: -0.90, w: 0.46, top: 0.60, bot: 0.06, n: 3.0 },
    { x: -1.40, w: 0.32, top: 0.50, bot: 0.08, n: 2.8 },
    { x: -1.90, w: 0.20, top: 0.40, bot: 0.12, n: 2.6 },
    { x: -2.30, w: 0.14, top: 0.33, bot: 0.18, n: 2.6 },
  ], { steps: 120 }), mats.body);
  // A cyan stripe down the nose and along the chassis spine
  add(loft([
    { x: 2.70, w: 0.03, top: 0.272, bot: 0.262, n: 2 },
    { x: 1.55, w: 0.05, top: 0.556, bot: 0.546, n: 2 },
    { x: 0.80, w: 0.05, top: 0.622, bot: 0.612, n: 2 },
  ], { steps: 40, ring: 10 }), mats.accent, false);
  // Slim engine cover: a triangular roll hoop, the airbox and a short fin
  add(loft([
    { x: -0.20, w: 0.20, top: 0.93, bot: 0.60, n: 2.0 },
    { x: -0.50, w: 0.24, top: 0.95, bot: 0.58, n: 2.1 },
    { x: -1.00, w: 0.13, top: 0.82, bot: 0.56, n: 2.4 },
    { x: -1.60, w: 0.05, top: 0.66, bot: 0.52, n: 2.6 },
    { x: -2.10, w: 0.02, top: 0.52, bot: 0.44, n: 2.6 },
  ], { steps: 60 }), mats.body);
  const intake = add(new THREE.CircleGeometry(1, 3), mats.dark, false);
  intake.scale.set(0.08, 0.12, 1); intake.rotation.set(0, Math.PI / 2, -Math.PI / 2); intake.position.set(-0.195, 0.83, 0);
  // Cooling exit at the tail of the engine cover
  const exit = add(new THREE.CircleGeometry(1, 24), mats.dark, false);
  exit.scale.set(0.06, 0.045, 1); exit.rotation.y = -Math.PI / 2; exit.position.set(-2.12, 0.42, 0);
  // Cockpit opening, driver's helmet and visor
  const opening = add(new THREE.CircleGeometry(1, 40), mats.dark, false);
  opening.scale.set(0.4, 0.24, 1); opening.rotation.x = -Math.PI / 2; opening.position.set(0.16, 0.612, 0);
  const helmet = add(new THREE.SphereGeometry(0.135, 32, 24), mats.helmet);
  helmet.scale.set(1.08, 1, 0.92); helmet.position.set(0.1, 0.71, 0);
  const visor = add(new THREE.SphereGeometry(0.137, 32, 12, -0.9, 1.8, 1.15, 0.5), mats.visor);
  visor.scale.copy(helmet.scale); visor.position.copy(helmet.position);
  add(new THREE.BoxGeometry(0.1, 0.03, 0.045), mats.dark).position.set(-0.46, 0.965, 0);

  // ---------- Sidepods: a raised letterbox inlet, a deep undercut and a steep downwash ramp ----------
  for (const s of [-1, 1]) {
    add(loft([
      { x: 0.84, w: 0.26, top: 0.60, bot: 0.40, cz: 0.60 * s, n: 4.2, nb: 4.2 },
      { x: 0.58, w: 0.34, top: 0.62, bot: 0.27, cz: 0.62 * s, n: 3.8, nb: 3.0 },
      { x: 0.08, w: 0.34, top: 0.56, bot: 0.15, cz: 0.60 * s, n: 3.4, nb: 2.6 },
      { x: -0.55, w: 0.26, top: 0.40, bot: 0.10, cz: 0.50 * s, n: 2.8 },
      { x: -1.15, w: 0.17, top: 0.25, bot: 0.08, cz: 0.37 * s, n: 2.4 },
      { x: -1.70, w: 0.06, top: 0.14, bot: 0.08, cz: 0.26 * s, n: 2.4 },
    ], { steps: 80 }), mats.body);
    const inlet = add(new THREE.PlaneGeometry(0.22, 0.17), mats.dark, false);
    inlet.rotation.y = Math.PI / 2; inlet.position.set(0.845, 0.5, 0.6 * s);
    // Matte carbon on the undercut, where liveries leave the structure bare
    add(loft([
      { x: 0.74, w: 0.2, top: 0.36, bot: 0.30, cz: 0.6 * s, n: 2 },
      { x: 0.20, w: 0.26, top: 0.24, bot: 0.17, cz: 0.6 * s, n: 2 },
      { x: -0.40, w: 0.2, top: 0.15, bot: 0.11, cz: 0.5 * s, n: 2 },
    ], { steps: 40, ring: 16 }), mats.carbon, false);
    // The cyan sweep follows the downwash ramp
    add(loft([
      { x: 0.80, w: 0.04, top: 0.612, bot: 0.598, cz: 0.66 * s, n: 2 },
      { x: 0.10, w: 0.05, top: 0.575, bot: 0.56, cz: 0.66 * s, n: 2 },
      { x: -0.55, w: 0.04, top: 0.415, bot: 0.40, cz: 0.56 * s, n: 2 },
      { x: -1.15, w: 0.02, top: 0.265, bot: 0.252, cz: 0.40 * s, n: 2 },
    ], { steps: 40, ring: 12 }), mats.accent, false);
    // Mirrors on stalks from the sidepod shoulder
    add(new THREE.BoxGeometry(0.07, 0.05, 0.14), mats.body).position.set(0.55, 0.73, 0.45 * s);
    car.add(strut([0.58, 0.62, 0.34 * s], [0.55, 0.71, 0.42 * s], 0.012, mats.body, 0.5));
  }

  // ---------- Floor: narrower, with a floor-edge wing and a larger diffuser ----------
  const edge = [[1.30, 0.25], [1.05, 0.52], [0.75, 0.88], [-1.35, 0.85], [-1.48, 0.56], [-2.32, 0.5]];
  const outline = [...edge, ...edge.slice().reverse().map(([x, z]) => [x, -z])];
  add(floorPlate(outline, 0.018, 0.035), mats.carbon);
  for (const s of [-1, 1]) {
    add(plate([[0.75, 0.035], [-1.35, 0.035], [-1.35, 0.08], [0.6, 0.07]], 0.008, 0.86 * s), mats.carbon);
    add(wing({ chord: 0.12, span: 0.9, thick: 0.08, camber: 0.06, le: 0.45, y: 0.1, aoa: 0.2, cz: 0.8 * s }), mats.carbon);
  }
  const ramp = add(new THREE.BoxGeometry(0.85, 0.012, 0.98), mats.carbon);
  ramp.position.set(-1.92, 0.2, 0); ramp.rotation.z = -0.38;
  for (const z of [-0.46, -0.16, 0.16, 0.46]) add(plate([[-1.55, 0.04], [-2.32, 0.04], [-2.32, 0.34], [-1.58, 0.05]], 0.006, z), mats.carbon);

  // ---------- Front wing: narrower, a main plane and two flaps; the top flap moves (active aero) ----------
  add(wing({ chord: 0.36, span: 1.8, thick: 0.09, camber: 0.05, le: 2.86, y: 0.085, aoa: 0.04 }), mats.carbon);
  const activeFront = [];
  for (const s of [-1, 1]) {
    add(wing({ chord: 0.2, span: 0.7, thick: 0.08, camber: 0.07, le: 2.56, y: 0.14, aoa: 0.3, cz: 0.53 * s }), mats.carbon);
    const flap = new THREE.Group(); flap.position.set(2.4, 0.2, 0);
    flap.add(new THREE.Mesh(wing({ chord: 0.16, span: 0.7, thick: 0.08, camber: 0.07, le: 0, y: 0, aoa: 0.55, cz: 0.53 * s }), mats.accent));
    car.add(flap); activeFront.push(flap);
    // Rounded endplate, swept back at the top
    add(plate([[2.9, 0.05], [2.36, 0.05], [2.32, 0.2], [2.44, 0.29], [2.72, 0.24], [2.9, 0.12]], 0.01, 0.905 * s), mats.carbon);
    add(plate([[2.6, 0.16], [2.42, 0.15], [2.45, 0.09], [2.6, 0.09]], 0.01, 0.07 * s), mats.carbon);
  }

  // ---------- Rear wing: no beam wing; main plane and active flap on a swan-neck pylon ----------
  add(wing({ chord: 0.38, span: 0.95, thick: 0.1, camber: 0.08, le: -2.18, y: 0.82, aoa: 0.12 }), mats.carbon);
  const activeRear = new THREE.Group(); activeRear.position.set(-2.48, 0.9, 0);
  activeRear.add(new THREE.Mesh(wing({ chord: 0.21, span: 0.95, thick: 0.09, camber: 0.07, le: 0, y: 0, aoa: 0.5 }), mats.body));
  car.add(activeRear);
  for (const s of [-1, 1]) {
    // Endplates rounded at the top corners, cut away low where the beam wing used to be
    add(plate([[-2.16, 0.6], [-2.16, 0.86], [-2.24, 0.97], [-2.64, 0.99], [-2.7, 0.9], [-2.7, 0.66], [-2.5, 0.58]], 0.012, 0.485 * s), mats.carbon);
    add(tube([[-2.16, 0.62, 0.485 * s], [-2.16, 0.86, 0.485 * s], [-2.24, 0.97, 0.485 * s], [-2.64, 0.99, 0.485 * s], [-2.7, 0.9, 0.485 * s]], 0.009, 30), mats.accent, false);
    add(new THREE.BoxGeometry(0.012, 0.18, 0.008), mats.rain, false).position.set(-2.705, 0.78, 0.493 * s);
  }
  // Swan-neck pylon: rises from the gearbox and hooks over the main plane
  add(tube([[-2.28, 0.34, 0], [-2.38, 0.62, 0], [-2.36, 0.96, 0], [-2.26, 0.99, 0], [-2.24, 0.93, 0]], 0.022, 40), mats.carbon);
  add(new THREE.BoxGeometry(0.02, 0.05, 0.12), mats.rain, false).position.set(-2.4, 0.28, 0);
  car.userData.activeAero = (open) => {
    // Straight-line mode: both flaps ease toward flat
    activeFront.forEach((f) => { f.rotation.z = -open * 0.35; });
    activeRear.rotation.z = -open * 0.45;
  };

  // ---------- Halo ----------
  for (const s of [-1, 1]) add(tube([[-0.12, 0.60, 0.29 * s], [-0.03, 0.76, 0.3 * s], [0.22, 0.84, 0.26 * s], [0.44, 0.85, 0.13 * s], [0.53, 0.85, 0]], 0.024), mats.body);
  add(tube([[0.53, 0.85, 0], [0.62, 0.78, 0], [0.73, 0.64, 0]], 0.026, 24), mats.body);

  // ---------- Suspension and wheels ----------
  const wheels = [];
  const axle = (x, halfW, s, rear) => {
    const z = CAR.track * s, r = CAR.tyreR;
    const w = wheelAssembly({ r, halfW, side: s, mats });
    w.position.set(x, r, z);
    car.add(w); wheels.push(w);
    // Upright and brake duct inside the wheel
    add(new THREE.BoxGeometry(0.16, 0.22, 0.08), mats.carbon).position.set(x, r, z - (halfW + 0.03) * s);
    const inboard = (rear ? 0.2 : 0.17) * s, hub = z - (halfW + 0.05) * s;
    const fore = x + 0.25, aft = x - 0.22;
    for (const [y0, y1] of [[0.47, 0.48], [0.25, 0.2]]) {
      car.add(strut([fore, y0, inboard], [x, y1, hub], 0.016, mats.carbon));
      car.add(strut([aft, y0, inboard], [x, y1, hub], 0.016, mats.carbon));
    }
    // Push/pull rod and track rod
    car.add(strut([x, 0.2, hub], [x - 0.05 * Math.sign(x), 0.52, inboard * 0.8], 0.014, mats.steel, 0.9));
    car.add(strut([x + 0.12, 0.33, inboard], [x + 0.1, 0.34, hub], 0.011, mats.steel, 0.9));
  };
  // 2026 tyres: narrower than before, front and rear
  for (const s of [-1, 1]) { axle(CAR.frontAxle, 0.14, s, false); axle(CAR.rearAxle, 0.175, s, true); }
  car.userData.wheels = wheels;
  car.userData.radius = CAR.tyreR;
  return car;
}

/**
 * The car as simple solids for the flow solver: each returns a signed distance
 * (negative inside). Rough on purpose: the flow only needs the shape the air sees.
 */
export function carCollider() {
  const ell = (cx, cy, cz, rx, ry, rz) => (p) => {
    const x = (p.x - cx) / rx, y = (p.y - cy) / ry, z = (p.z - cz) / rz;
    const k = Math.sqrt(x * x + y * y + z * z);
    return (k - 1) * Math.min(rx, ry, rz);
  };
  const box = (cx, cy, cz, hx, hy, hz) => (p) => {
    const dx = Math.abs(p.x - cx) - hx, dy = Math.abs(p.y - cy) - hy, dz = Math.abs(p.z - cz) - hz;
    const o = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
    return o + Math.min(Math.max(dx, dy, dz), 0);
  };
  const cyl = (cx, cy, cz, r, hz) => (p) => {
    const d = Math.hypot(p.x - cx, p.y - cy) - r, dz = Math.abs(p.z - cz) - hz;
    return Math.min(Math.max(d, dz), 0) + Math.hypot(Math.max(d, 0), Math.max(dz, 0));
  };
  const parts = [
    ell(0.2, 0.36, 0, 2.6, 0.32, 0.4),          // survival cell and nose
    ell(-0.7, 0.8, 0, 0.75, 0.2, 0.16),         // airbox
    box(0.1, 0.62, 0, 0.12, 0.2, 0.15),         // helmet and halo
    ell(-0.25, 0.38, 0.55, 1.15, 0.24, 0.2), ell(-0.25, 0.38, -0.55, 1.15, 0.24, 0.2), // sidepods
    box(-0.3, 0.05, 0, 1.15, 0.03, 0.9),        // floor
    box(2.6, 0.17, 0, 0.27, 0.12, 0.92),        // front wing
    box(-2.45, 0.88, 0, 0.28, 0.12, 0.49),      // rear wing
    box(-2.2, 0.3, 0, 0.3, 0.12, 0.3),          // gearbox and diffuser
  ];
  for (const s of [-1, 1]) {
    parts.push(cyl(CAR.frontAxle, CAR.tyreR, CAR.track * s, CAR.tyreR, 0.15));
    parts.push(cyl(CAR.rearAxle, CAR.tyreR, CAR.track * s, CAR.tyreR, 0.19));
  }
  return (p) => { let d = Infinity; for (const f of parts) { const v = f(p); if (v < d) d = v; } return d; };
}
