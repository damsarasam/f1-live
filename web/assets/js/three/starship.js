// A fully reusable super-heavy launcher in the stainless-steel style: a
// 71 m booster with 33 engines, chines and grid fins, a vented hot-staging
// ring, and a 52 m ship with six engines, four flaps, black heat tiles on its
// windward side and a payload bay with a roll-up door. Generic and unbranded. Units: 1 = 10 m,
// +y up, base at y = 0. Windward (tiled) side faces +x, the door faces -x.
import * as THREE from "three";
import { lathe, plate } from "./geometry.js";
import { steelSkin, metal, satin, glow } from "./materials.js";
import { plume } from "./space.js";

const R = 0.45;           // 9 m diameter
const BOOSTER_H = 7.1, RING_H = 0.2, SHIP_BASE = BOOSTER_H + RING_H;

function bells(mats, rings, { scale = 1, vac = false } = {}) {
  const g = new THREE.Group();
  const sea = lathe([[0.022, 0], [0.026, -0.03], [0.04, -0.07], [0.058, -0.12]], 20);
  const big = lathe([[0.03, 0], [0.04, -0.06], [0.09, -0.2], [0.11, -0.26]], 24);
  for (const [n, r, off = 0, kind = "sea"] of rings) {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      const m = new THREE.Mesh(kind === "vac" && vac ? big : sea, mats.bell);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.scale.setScalar(scale);
      g.add(m);
    }
  }
  return g;
}

function gridFin(mat) {
  const g = new THREE.Group();
  const w = 0.2, d = 0.16;
  for (const [x, z, sx, sz] of [[0, -d / 2, w, 0.01], [0, d / 2, w, 0.01], [-w / 2, 0, 0.01, d], [w / 2, 0, 0.01, d]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.025, sz), mat); b.position.set(x, 0, z); g.add(b);
  }
  for (let i = -3; i <= 3; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, d * 1.35), mat); a.position.x = i * 0.026; a.rotation.y = 0.785; g.add(a);
  }
  g.scale.z = 0.72;
  return g;
}

/** A flap: a plate from the hull outward, hinged on the hull line, tiled on its windward face */
function flap(mats, { y0, y1, reach, tip }, side) {
  const pivot = new THREE.Group();
  const shape = [[0, 0], [0, y1 - y0], [reach, y1 - y0 - tip], [reach, tip * 0.3]];
  const m = new THREE.Mesh(plate(shape.map(([r, y]) => [r, y]), 0.014), [mats.tile, mats.steel]);
  // Built in the x-y plane; turn it to stick out along ±z from the hull
  m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  pivot.add(m);
  pivot.position.set(0.05, y0, side * (R - 0.02));
  return pivot;
}

export function starship() {
  const mats = {
    boosterSkin: steelSkin({ soot: 0.3, rings: 34 }),
    shipSkin: steelSkin({ soot: 0.06, rings: 26, tiles: true }),
    steel: metal(0xc9cdd2, 0.3),
    tile: satin(0x16171a, 0.85),
    bell: metal(0x5a524c, 0.4),
    dark: satin(0x0d0e10, 0.6),
    vent: glow(0xff8a2a, 0),
  };
  const stack = new THREE.Group();
  stack.name = "starship";

  // ---------- Booster (pivots about its middle so it can flip) ----------
  const booster = new THREE.Group(); booster.position.y = BOOSTER_H / 2;
  const bBody = new THREE.Group(); bBody.position.y = -BOOSTER_H / 2; booster.add(bBody);
  bBody.add(new THREE.Mesh(lathe([[R * 0.96, -0.02], [R, 0.12], [R, BOOSTER_H]], 64), mats.boosterSkin));
  bBody.add(new THREE.Mesh(new THREE.CircleGeometry(R * 0.96, 48).rotateX(Math.PI / 2).translate(0, -0.02, 0), mats.dark));
  // 33 engines: 3 in the centre, 10 in a ring, 20 round the edge
  const bEngines = bells(mats, [[3, 0.08], [10, 0.2, 0.3], [20, 0.37, 0.1]]);
  bEngines.position.y = -0.02; bBody.add(bEngines);
  // Chines down the lower body
  for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.06), mats.steel);
    c.position.set(Math.cos(a) * (R + 0.02), 1.4, Math.sin(a) * (R + 0.02)); c.rotation.y = -a; bBody.add(c);
  }
  // Grid fins near the top, stowed against the hull until separation
  const fins = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * R, BOOSTER_H - 0.45, Math.sin(a) * R); pivot.rotation.y = -a;
    const fin = gridFin(mats.steel); fin.position.x = 0.11; pivot.add(fin); bBody.add(pivot);
    return { pivot, fin };
  });
  // Hot-staging ring: a dark band with vent slots that glow while the ship's engines fire
  const ring = new THREE.Group(); ring.position.y = BOOSTER_H;
  ring.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, RING_H, 64, 1, true).translate(0, RING_H / 2, 0), mats.dark));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.008, RING_H * 0.62, 0.07), mats.vent);
    slot.position.set(Math.cos(a) * (R + 0.003), RING_H / 2, Math.sin(a) * (R + 0.003)); slot.rotation.y = -a; ring.add(slot);
  }
  bBody.add(ring);
  const boosterPlume = plume({ length: 4.2, radius: 0.55 }); boosterPlume.position.y = -0.14; bBody.add(boosterPlume);
  const boostbackPlume = plume({ length: 1.2, radius: 0.12 }); boostbackPlume.position.y = -0.14; boostbackPlume.visible = false; bBody.add(boostbackPlume);
  stack.add(booster);

  // ---------- Ship ----------
  const ship = new THREE.Group(); ship.position.y = SHIP_BASE;
  const profile = [[R * 0.97, 0], [R, 0.06], [R, 3.25], [R * 0.985, 3.6], [R * 0.93, 3.95], [R * 0.8, 4.3], [R * 0.6, 4.62], [R * 0.34, 4.88], [0.001, 5.0]];
  ship.add(new THREE.Mesh(lathe(profile, 72), mats.shipSkin));
  ship.add(new THREE.Mesh(new THREE.CircleGeometry(R * 0.97, 48).rotateX(Math.PI / 2), mats.dark));
  // Six engines: three sea-level in the middle, three vacuum bells round them
  const sEngines = bells(mats, [[3, 0.09], [3, 0.27, Math.PI / 3, "vac"]], { vac: true });
  ship.add(sEngines);
  const flaps = {
    aft: [-1, 1].map((s) => flap(mats, { y0: 0.15, y1: 1.45, reach: 0.34, tip: 0.18 }, s)),
    fwd: [-1, 1].map((s) => flap(mats, { y0: 3.75, y1: 4.35, reach: 0.2, tip: 0.16 }, s)),
  };
  [...flaps.aft, ...flaps.fwd].forEach((f) => ship.add(f));
  // Payload bay on the leeward side, closed by a roll-up door: slats that slide up into a drum housing.
  // The hull skin is cut away over the opening (alpha map) so the bay can be seen when the door rolls up.
  const DOOR_Y = 1.45, DOOR_H = 1.1, DOOR_W = 0.42, SLATS = 22;
  const span = DOOR_W / 2 / R;                                   // half the door's angle round the hull
  const vAt = (y) => 0.125 + ((y - 0.06) / 3.19) * 0.125;        // lathe v for a height on the straight barrel
  const cut = document.createElement("canvas"); cut.width = 256; cut.height = 1024;
  const cg = cut.getContext("2d");
  cg.fillStyle = "#fff"; cg.fillRect(0, 0, 256, 1024); cg.fillStyle = "#000";
  // -x on a three.js lathe is phi = 3π/2, u = 0.75
  cg.fillRect((0.75 - span / (Math.PI * 2)) * 256, vAt(DOOR_Y) * 1024, (span / Math.PI) * 256, (vAt(DOOR_Y + DOOR_H) - vAt(DOOR_Y)) * 1024);
  const alpha = new THREE.CanvasTexture(cut); alpha.flipY = false;
  mats.shipSkin.alphaMap = alpha; mats.shipSkin.alphaTest = 0.5; mats.shipSkin.needsUpdate = true;
  // The bay: dark walls seen through the opening
  const bayDepth = 0.75;
  const bayMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8, metalness: 0.3, side: THREE.BackSide });
  const bay = new THREE.Mesh(new THREE.BoxGeometry(bayDepth, DOOR_H, DOOR_W * 0.98), bayMat);
  bay.position.set(-R + bayDepth / 2 + 0.01, DOOR_Y + DOOR_H / 2, 0); ship.add(bay);
  // Deck rails the craft ride out on
  for (let i = 1; i < 4; i++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bayDepth, 0.008, DOOR_W * 0.9), mats.steel);
    rail.position.set(-R + bayDepth / 2, DOOR_Y + (i / 4) * DOOR_H, 0); ship.add(rail);
  }
  // Door frame and the drum housing above it
  const frameMat = mats.dark;
  for (const z of [-DOOR_W / 2, DOOR_W / 2]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, DOOR_H + 0.04, 0.02), frameMat); f.position.set(-R - 0.005, DOOR_Y + DOOR_H / 2, z); ship.add(f); }
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, DOOR_W + 0.04, 24, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), mats.steel);
  housing.position.set(-R, DOOR_Y + DOOR_H + 0.045, 0); ship.add(housing);
  // Slats, bottom to top; rolling up moves each one up and into the housing
  const door = new THREE.Group(); ship.add(door);
  const slatH = DOOR_H / SLATS;
  const slats = Array.from({ length: SLATS }, (_, i) => {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.01, slatH * 0.9, DOOR_W), mats.steel);
    slat.position.set(-R - 0.004, DOOR_Y + (i + 0.5) * slatH, 0); door.add(slat);
    return { slat, y: DOOR_Y + (i + 0.5) * slatH };
  });
  const top = DOOR_Y + DOOR_H;
  door.userData.roll = (k) => {
    const lift = k * DOOR_H;
    slats.forEach(({ slat, y }) => { const ny = y + lift; slat.position.y = Math.min(ny, top - slatH / 2); slat.visible = ny < top; });
  };
  door.userData.roll(0);
  const payloadMount = new THREE.Group(); payloadMount.position.set(-R, DOOR_Y, 0); ship.add(payloadMount);
  const shipPlumes = [-1, 0, 1].map((i) => {
    const p = plume({ length: 1.6, radius: 0.12 });
    const a = i * (2 * Math.PI / 3); p.position.set(Math.cos(a) * 0.09, -0.08, Math.sin(a) * 0.09); p.visible = false;
    ship.add(p); return p;
  });
  stack.add(ship);

  stack.userData = {
    booster, ship, fins, flaps, door, payloadMount, boosterPlume, boostbackPlume, shipPlumes, vent: mats.vent,
    bay: { x: -R, y: DOOR_Y, height: DOOR_H, width: DOOR_W, depth: bayDepth },
    heights: { booster: BOOSTER_H, ship: SHIP_BASE, top: SHIP_BASE + 5 },
    /** Stow (0) or deploy (1) the booster's grid fins */
    setFins(k) { fins.forEach(({ fin }) => { fin.rotation.z = (Math.PI / 2) * (1 - k); fin.position.x = 0.012 + 0.1 * k; }); },
  };
  stack.userData.setFins(0);
  return stack;
}
