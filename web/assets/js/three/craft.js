// The ASTRAEUS prospecting craft, laid out the way nuclear-electric spacecraft
// are: a compact sensor and payload module at the front, a deployable lattice
// boom carrying heat radiators, and a fission reactor behind a conical shadow
// shield at the back with gridded ion engines. Two circular origami solar
// arrays (flasher fold) add power. No chemical or cold-gas thrusters: attitude
// is held by internal reaction wheels. Generic concept.
// Units: 1 = 1 m. +x is the nose, +y up, ±z the solar arrays.
import * as THREE from "three";
import { lathe, strut } from "./geometry.js";
import { metal, satin, glow, carbon } from "./materials.js";

const BOOM = 4.4;          // deployed boom length
const NOSE = 2.35;         // front of the payload module
const R = 0.62;            // payload module radius (hexagonal)

// ---------- Textures drawn once ----------
let tex = null;
function textures() {
  if (tex) return tex;
  const make = (w, hgt, paint) => {
    const c = document.createElement("canvas"); c.width = w; c.height = hgt;
    paint(c.getContext("2d"), w, hgt);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  tex = {
    // Ceramic-white hull panels with seams, a dark sensor band and a cyan line
    hull: make(768, 512, (g, w, h) => {
      g.fillStyle = "#e7e9ec"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(40,48,58,0.5)"; g.lineWidth = 2;
      for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); }
      for (const y of [90, 250, 420]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = "#15181c"; g.fillRect(0, 300, w, 34);
      g.fillStyle = "#00c3ff"; g.fillRect(0, 344, w, 3);
    }),
    // Radiator: pale panel crossed by the coolant tubes
    radiator: make(256, 512, (g, w, h) => {
      g.fillStyle = "#d9dde2"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(90,100,112,0.55)"; g.lineWidth = 3;
      for (let x = 12; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = "rgba(70,78,88,0.7)"; g.fillRect(0, h - 10, w, 10);
    }),
    // Circular array: rings of cells cut by the flasher's spiral creases
    solar: make(1024, 1024, (g, w) => {
      const c = w / 2;
      g.fillStyle = "#0b1631"; g.fillRect(0, 0, w, w);
      for (let r = 100; r < c; r += 30) {
        const n = Math.round((2 * Math.PI * r) / 34);
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.86) / n) * Math.PI * 2;
          g.beginPath(); g.arc(c, c, r + 26, a0, a1); g.arc(c, c, r + 2, a1, a0, true); g.closePath();
          g.fillStyle = (i + r) % 3 ? "#1a2e66" : "#142556"; g.fill();
        }
      }
      g.strokeStyle = "rgba(200,210,230,0.55)"; g.lineWidth = 3;
      for (let k = 0; k < 12; k++) {
        g.beginPath();
        for (let r = 100; r <= c; r += 6) { const a = (k / 12) * Math.PI * 2 + (r / c) * 0.9; const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; r === 100 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = "rgba(220,225,235,0.85)"; g.lineWidth = 8; g.beginPath(); g.arc(c, c, c - 6, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#9aa1a9"; g.beginPath(); g.arc(c, c, 100, 0, Math.PI * 2); g.fill();
    }),
  };
  return tex;
}

/**
 * Circular origami array (flasher pattern): spiral gores round a hub.
 * fold 1 = wrapped into a short drum round the hub, 0 = a flat disc of radius `r` in the x-z plane.
 */
function flasher(mat, r = 1.6) {
  const RINGS = 14, COLS = 72, SEG = 6;
  const n = (RINGS + 1) * (COLS + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  const hub = 0.2 * r;
  for (let i = 0; i <= RINGS; i++) for (let j = 0; j <= COLS; j++) {
    const rr = (hub + (i / RINGS) * (r - hub)) / r, a = (j / COLS) * Math.PI * 2;
    uv.set([0.5 + Math.cos(a) * rr * 0.5, 0.5 + Math.sin(a) * rr * 0.5], (i * (COLS + 1) + j) * 2);
  }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < COLS; j++) {
    const k = i * (COLS + 1) + j;
    idx.push(k, k + COLS + 1, k + 1, k + 1, k + COLS + 1, k + COLS + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.fold = (f) => {
    for (let i = 0; i <= RINGS; i++) for (let j = 0; j <= COLS; j++) {
      const u = i / RINGS, a0 = (j / COLS) * Math.PI * 2;
      const zig = Math.abs(((j % SEG) / SEG) - 0.5) * 2;   // the pleats between gores
      const flatR = hub + u * (r - hub);
      // Folding wraps every gore round the hub and stacks it along the axis
      const rad = flatR * (1 - f) + (hub + 0.04 + zig * 0.05) * f;
      const ang = a0 + f * u * 2.4;
      const up = f * u * (r - hub) * 0.5 + (1 - f) * zig * 0.015 * u;
      pos.set([Math.cos(ang) * rad, up, Math.sin(ang) * rad], (i * (COLS + 1) + j) * 3);
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  mesh.userData.fold(0);
  return mesh;
}

/** Gridded ion engine: a short drum with a grid face; its faint beam runs along -x */
function ionEngine(mats) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.26, 32).rotateZ(Math.PI / 2), mats.titanium));
  const grid = new THREE.Mesh(new THREE.CircleGeometry(0.18, 32), mats.grid); grid.rotation.y = -Math.PI / 2; grid.position.x = -0.132; g.add(grid);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.17, 32), mats.ion); ring.rotation.y = -Math.PI / 2; ring.position.x = -0.135; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.55, 3.4, 32, 1, true).rotateZ(Math.PI / 2).translate(-1.83, 0, 0), mats.beam);
  beam.frustumCulled = false; beam.visible = false; g.add(beam);
  g.userData.beam = beam;
  return g;
}

export function miningCraft() {
  const T = textures();
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uPower: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float uPower;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.5);
        float a = edge * smoothstep(0.0, 0.9, vUv.y) * uPower * 0.5; gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * a, a); }`,
  });
  const mats = {
    hull: new THREE.MeshStandardMaterial({ map: T.hull, roughness: 0.42, metalness: 0.05, flatShading: true }),
    dark: satin(0x15181c, 0.5),
    trim: metal(0x9aa1a9, 0.32),
    titanium: metal(0x7f7b76, 0.42),
    truss: carbon({ repeat: 2, tint: 0x2a2d31 }),
    radiator: new THREE.MeshStandardMaterial({ map: T.radiator, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide }),
    solar: new THREE.MeshPhysicalMaterial({ map: T.solar, roughness: 0.25, metalness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide }),
    shield: metal(0x55595f, 0.5),
    reactor: metal(0xb9a37a, 0.35),
    grid: metal(0x3b3f45, 0.45),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x03060c, roughness: 0.03, metalness: 0.3, clearcoat: 1 }),
    joint: satin(0xeceef0, 0.45),
    ion: glow(0x3b7dff, 0),
    pad: metal(0x6d7178, 0.5),
    laser: glow(0x00c3ff, 1.5),
    beam: beamMat,
  };
  const craft = new THREE.Group();
  craft.name = "astraeus-craft";
  const add = (o, parent = craft) => { parent.add(o); return o; };

  // ---------- Payload module: a hexagonal prism tapering to the sensor nose ----------
  const profile = [[0.42, 0.05], [0.58, 0.18], [R, 0.45], [R, 1.75], [0.55, 2.1], [0.36, NOSE]];
  const body = new THREE.Mesh(lathe(profile, 6), mats.hull); body.rotation.z = -Math.PI / 2; add(body);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 6).rotateZ(Math.PI / 2).translate(0.05, 0, 0), mats.dark));

  // Nose: the net launcher, its folded net in the centre and four corner barrels
  const launcher = new THREE.Group(); launcher.position.set(NOSE, 0, 0); add(launcher);
  launcher.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 6).rotateZ(Math.PI / 2), mats.dark));
  launcher.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32).rotateZ(Math.PI / 2).translate(0.04, 0, 0), mats.titanium));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 14).rotateZ(-Math.PI / 2), mats.trim);
    b.position.set(0.04, Math.cos(a) * 0.2, Math.sin(a) * 0.2); launcher.add(b);
  }

  // Autonomous tracking: a gimballed head with lidar, plus two navigation cameras
  const trackerMount = new THREE.Group(); trackerMount.position.set(1.85, R * 0.86, 0); add(trackerMount);
  trackerMount.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 20).translate(0, 0.05, 0), mats.titanium));
  const trackerHead = new THREE.Group(); trackerHead.position.y = 0.16; trackerMount.add(trackerHead);
  trackerHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mats.dark));
  const lidar = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), mats.lens); lidar.rotation.y = Math.PI / 2; lidar.position.x = 0.1; trackerHead.add(lidar);
  const tracker = new THREE.Object3D(); tracker.position.x = 0.12; trackerHead.add(tracker);
  for (const z of [-0.3, 0.3]) {
    const cam = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), mats.lens);
    cam.rotation.y = Math.PI / 2 - 0.45 * Math.sign(z); cam.position.set(2.12, 0.18, z); add(cam);
  }

  // Communications: a dish for Earth, and a laser terminal underneath for craft-to-craft relay
  const hga = new THREE.Group(); hga.position.set(0.85, R * 0.86, 0); add(hga);
  hga.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 16).translate(0, 0.1, 0), mats.trim));
  const dishPivot = new THREE.Group(); dishPivot.position.y = 0.22; hga.add(dishPivot);
  const dish = new THREE.Mesh(lathe(Array.from({ length: 10 }, (_, i) => { const r = (i / 9) * 0.42; return [r, (r * r) / 1.2]; }), 40), mats.joint);
  dish.material.side = THREE.DoubleSide; dishPivot.add(dish);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; dishPivot.add(strut([Math.cos(a) * 0.36, 0.1, Math.sin(a) * 0.36], [0, 0.28, 0], 0.006, mats.trim, 1)); }
  const crosslink = new THREE.Group(); crosslink.position.set(0.4, -R * 0.86, 0); add(crosslink);
  crosslink.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20).translate(0, -0.08, 0), mats.titanium));
  const aperture = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), mats.laser); aperture.rotation.x = Math.PI / 2; aperture.position.y = -0.165; crosslink.add(aperture);
  const relay = new THREE.Object3D(); relay.position.y = -0.17; crosslink.add(relay);

  // ---------- Circular origami solar arrays either side ----------
  const wings = [-1, 1].map((s) => {
    const root = new THREE.Group(); root.position.set(1.0, 0, R * 0.86 * s); add(root);
    const mast = new THREE.Group(); root.add(mast);
    mast.add(strut([0, 0, 0], [0, 0, 0.55 * s], 0.025, mats.trim, 1));
    mast.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16).translate(0, 0.02, 0.55 * s), mats.titanium));
    const sheet = flasher(mats.solar, 1.6);
    sheet.position.set(0, 0.02, (0.55 + 1.6) * s); mast.add(sheet);
    return { root, mast, sheet, s };
  });

  // ---------- Deployable boom with radiators ----------
  const boom = new THREE.Group(); add(boom);
  const truss = new THREE.Group(); boom.add(truss);
  const corners = [0, 1, 2].map((i) => { const a = Math.PI / 2 + (i / 3) * Math.PI * 2; return [Math.cos(a) * 0.22, Math.sin(a) * 0.22]; });
  const bays = 9, bay = BOOM / bays;
  for (const [y, z] of corners) truss.add(strut([0, y, z], [-BOOM, y, z], 0.018, mats.truss, 1));
  for (let b = 0; b < bays; b++) {
    const x0 = -b * bay, x1 = -(b + 1) * bay;
    corners.forEach(([y, z], i) => {
      const [y2, z2] = corners[(i + 1) % 3];
      truss.add(strut([x0, y, z], [x0, y2, z2], 0.01, mats.truss, 1));
      truss.add(strut([x0, y, z], [x1, y2, z2], 0.008, mats.truss, 1));
    });
  }
  // Radiators fan out above and below the boom, inside the shield's shadow
  const radiators = [-1, 1].map((s) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(BOOM * 0.8, 1.4), mats.radiator);
    panel.position.set(-BOOM * 0.47, s * 0.93, 0); add(panel, boom);
    return { panel, s };
  });

  // ---------- Power and propulsion at the back ----------
  const aft = new THREE.Group(); add(aft, boom);
  // Shadow shield: narrows toward the reactor so its shadow covers everything in front
  aft.add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.38, 0.45, 40).rotateZ(Math.PI / 2).translate(-0.22, 0, 0), mats.shield));
  aft.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 24).rotateZ(Math.PI / 2).translate(-0.8, 0, 0), mats.reactor));
  aft.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2).translate(-1.15, 0, 0), mats.reactor));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.16), mats.titanium);
    fin.position.set(-0.8, Math.cos(a) * 0.36, Math.sin(a) * 0.36); fin.rotation.x = -a; aft.add(fin);
  }
  const engines = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const y = Math.cos(a) * 0.72, z = Math.sin(a) * 0.72;
    aft.add(strut([-0.35, 0, 0], [-1.1, y, z], 0.03, mats.trim, 1));
    const e = ionEngine(mats); e.position.set(-1.2, y, z); aft.add(e); engines.push(e);
  }

  // ---------- Autonomous arm: six joints and a three-finger gripper near the nose ----------
  const housing = (r, l, shape = (g) => g) => new THREE.Mesh(shape(new THREE.CylinderGeometry(r, r, l, 20)), mats.joint);
  const link = (len) => strut([0.05, 0, 0], [len, 0, 0], 0.035, mats.truss, 1);
  const arm = new THREE.Group(); arm.position.set(1.95, -0.45, 0); add(arm);
  const j0 = new THREE.Group(); arm.add(j0);
  j0.add(housing(0.08, 0.08, (g) => g.translate(0, -0.04, 0)));
  const j1 = new THREE.Group(); j1.position.y = -0.09; j0.add(j1);
  const h1 = housing(0.07, 0.15); h1.rotation.x = Math.PI / 2; j1.add(h1); j1.add(link(0.85));
  const j2 = new THREE.Group(); j2.position.x = 0.9; j1.add(j2);
  const h2 = housing(0.06, 0.13); h2.rotation.x = Math.PI / 2; j2.add(h2); j2.add(link(0.75));
  const j3 = new THREE.Group(); j3.position.x = 0.8; j2.add(j3);
  const h3 = housing(0.05, 0.11); h3.rotation.x = Math.PI / 2; j3.add(h3);
  const j4 = new THREE.Group(); j4.position.x = 0.06; j3.add(j4);
  j4.add(housing(0.045, 0.1, (g) => g.rotateZ(Math.PI / 2).translate(0.05, 0, 0)));
  const j5 = new THREE.Group(); j5.position.x = 0.12; j4.add(j5);
  j5.add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.05, 6).rotateZ(Math.PI / 2), mats.titanium));
  const fingers = [0, 1, 2].map((i) => {
    const f = new THREE.Group(); f.rotation.x = (i / 3) * Math.PI * 2;
    const knuckle = new THREE.Group(); knuckle.position.set(0.02, 0.045, 0); f.add(knuckle);
    knuckle.add(strut([0, 0, 0], [0.12, 0.02, 0], 0.011, mats.trim, 1));
    knuckle.add(strut([0.12, 0.02, 0], [0.2, -0.03, 0], 0.009, mats.trim, 1));
    j5.add(f); return knuckle;
  });
  const tip = new THREE.Object3D(); tip.position.x = 0.2; j5.add(tip);

  // ---------- Landing legs: hinged near the nose, folded back along the hull ----------
  // The craft lands nose-first, so the reactor and radiators stand clear of the dust
  const legs = [0, 1, 2, 3].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const out = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
    const hinge = new THREE.Group(); hinge.position.set(1.75, 0, 0).addScaledVector(out, R + 0.03);
    // Local x along the hull, local y outward from the axis
    hinge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), out, new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), out)));
    add(hinge);
    const swing = new THREE.Group(); hinge.add(swing);
    swing.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mats.titanium));
    swing.add(strut([0, 0, 0], [-1.6, 0, 0], 0.028, mats.trim, 1));
    const foot = new THREE.Group(); foot.position.x = -1.6; swing.add(foot);
    foot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.04, 24).rotateZ(Math.PI / 2), mats.pad));
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.3, 10).rotateZ(-Math.PI / 2).translate(0.15, 0, 0), mats.titanium); foot.add(spike);
    return { swing, foot, spike };
  });

  craft.userData = {
    wings, hga, dishPivot, launcher, arm, tip, tracker, relay,
    netOrigin: new THREE.Vector3(NOSE + 0.25, 0, 0),
    /** Ion engine power, 0..1 */
    setThrust(k) {
      mats.ion.emissiveIntensity = 1.6 * k; beamMat.uniforms.uPower.value = k;
      engines.forEach((e) => { e.userData.beam.visible = k > 0.01; });
    },
    /** 0 = stowed for launch (boom retracted, arrays and radiators folded), 1 = fully deployed */
    deploy(d) {
      const len = 0.9 + (BOOM - 0.9) * d;
      truss.scale.x = len / BOOM;
      aft.position.x = -len;
      radiators.forEach(({ panel }) => { panel.scale.set(len / BOOM, 0.12 + 0.88 * d, 1); panel.position.x = -len * 0.47; });
      for (const { mast, sheet } of wings) { sheet.userData.fold(1 - d); mast.scale.setScalar(0.35 + 0.65 * d); }
      hga.scale.setScalar(0.6 + 0.4 * d);
    },
    /** Arm: 0 folded along the belly, 1 reaching forward past the nose */
    reach(k) {
      j1.rotation.z = Math.PI * 0.97 * (1 - k) - 0.25 * k;
      j2.rotation.z = -2.9 * (1 - k) + 0.1 * k;
      j3.rotation.z = 0.2 * (1 - k) - 0.3 * k;
      j4.rotation.x = k * 0.6;
    },
    /** Gripper: 0 open, 1 closed */
    grip(k) { fingers.forEach((f) => { f.rotation.z = 0.5 - k * 0.75; }); },
    /** Legs: 0 folded back along the hull, 1 swung forward past the nose for landing */
    setLegs(k, { spike = 0 } = {}) {
      for (const { swing, foot, spike: sp } of legs) {
        swing.rotation.z = -k * 2.75;
        foot.rotation.z = k * 2.75;
        sp.scale.x = 0.2 + 0.8 * spike;
      }
    },
    /** How far ahead of the craft origin the footpads touch down when the legs are out */
    landingReach: 1.75 + 1.6 * Math.cos(Math.PI - 2.75) + 0.05,
  };
  craft.userData.deploy(1); craft.userData.reach(0); craft.userData.grip(0); craft.userData.setLegs(0); craft.userData.setThrust(0);
  return craft;
}
