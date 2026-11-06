// Scroll-driven 3D stories for the ASTRAEUS page. Each scene reads a progress
// value (0..1) from the page, so scrolling back plays the story backwards.
import * as THREE from "three";
import { createStage, smooth, span, lerp, easeInOut, clamp01 } from "./stage.js";
import { miningCraft, asteroid, captureNet, earthGlobe, stars, whenTexturesLoaded } from "./space.js";
import { starship } from "./starship.js";

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function sunlight(scene, dir, { intensity = 4, shadows = false } = {}) {
  const key = new THREE.DirectionalLight(0xfff4e6, intensity);
  key.position.copy(dir).multiplyScalar(40);
  if (shadows) {
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 90 });
    key.shadow.bias = -0.0005;
  }
  scene.add(key, key.target, new THREE.AmbientLight(0x0b0e14, 0.5));
  return key;
}

/** Points with a soft glow and an expanding ring, for places on a globe */
function siteMarkers(positions) {
  const n = positions.length / 3;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const phase = new Float32Array(n), on = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = (i * 0.618) % 1;
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aOn", new THREE.BufferAttribute(on, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uPx: { value: Math.min(devicePixelRatio || 1, 2) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aPhase; attribute float aOn; varying float vP; varying float vOn; varying float vFacing; uniform float uPx;
      void main(){ vP = aPhase; vOn = aOn; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normalize(position)); vFacing = smoothstep(0.0, 0.3, dot(n, normalize(-mv.xyz)));
        gl_PointSize = 54.0 * uPx * (0.4 + aOn * 0.6); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vP; varying float vOn; varying float vFacing; uniform float uTime, uFade;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float core = smoothstep(0.09, 0.02, d) * 1.6 + smoothstep(0.3, 0.0, d) * 0.45;
        float r = fract(uTime * 0.5 + vP); float ring = smoothstep(0.025, 0.0, abs(d - 0.06 - r * 0.38)) * (1.0 - r);
        float a = (core + ring * 0.9) * vOn * vFacing * uFade;
        gl_FragColor = vec4(vec3(1.0, 0.5, 0.12) * a, min(a, 1.0)); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.userData.on = on;
  return pts;
}

// Major mining regions (lat, lon): iron ore, copper, cobalt, nickel, rare earths, gold, bauxite
const MINES = [
  [-22, 118], [-30.7, 121.5], [-20.7, 139.5], [-24.3, -69.1], [-22.3, -68.9], [-10.7, 25.5], [-12.5, 27.6], [-26.2, 28],
  [41.8, 110], [43, 106.9], [28, 115], [67.9, 20.2], [69.3, 88.2], [58, 60], [-6, -50.2], [40, -117], [40.5, -112.1],
  [46.5, -81], [-4, 137.1], [-2.5, 121.5], [11, -14], [-15.5, -47.5], [52.5, 66], [-33.5, -70.5],
];
function latLon(lat, lon, r) {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) / 180) * Math.PI;
  return v3(-Math.cos(phi) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(phi) * Math.sin(th) * r);
}

/**
 * The problem and the solution. Earth turns; through the problem, extraction
 * sites light up and spread across the continents. Through the solution they
 * fade as the view pulls back to a craft that has netted an asteroid.
 */
export function earthStory(host, getProgress) {
  const small = innerWidth < 760;
  const sunDir = v3(-0.75, 0.25, 0.6).normalize();
  const earth = earthGlobe(2.2, { sun: sunDir });
  earth.rotation.z = 0.41; // axial tilt
  // Clusters of sites around each region; they light up one by one through the problem
  const perSite = 9, pos = new Float32Array(MINES.length * perSite * 3);
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const order = [];
  MINES.forEach(([lat, lon], i) => {
    for (let k = 0; k < perSite; k++) {
      const p = latLon(lat + r() * (k ? 7 : 0), lon + r() * (k ? 9 : 0), 2.205);
      pos.set([p.x, p.y, p.z], (i * perSite + k) * 3);
      order.push(k + i * 0.37); // the first site in each region appears early, the spread follows
    }
  });
  const rank = order.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const sites = siteMarkers(pos);
  earth.userData.globe.add(sites);

  const rock = asteroid({ radius: 0.55, seed: 13, detail: small ? 28 : 40, boulders: small ? 120 : 260 });
  const craft = miningCraft(); craft.scale.setScalar(0.11);
  const net = captureNet(16);
  const ROCK = v3(5.2, 1.0, 2.2);
  rock.position.copy(ROCK);
  const sky = stars(small ? 2500 : 5000, 300, 4);
  let shown = 0;
  const stage = createStage(host, {
    fov: 34, env: "studio", stillTime: 0, exposure: 1,
    label: "Earth with mining sites spreading across it, then a spacecraft that has netted an asteroid",
    onFrame(t, dt) {
      const goal = getProgress();
      shown = dt ? shown + (goal - shown) * Math.min(1, dt * 5) : goal;
      const p = shown;
      earth.userData.globe.rotation.y = 2.2 + p * 1.6 + t * 0.015;
      earth.userData.clouds.rotation.y = earth.userData.globe.rotation.y * 1.04 + t * 0.004;
      // Problem: sites appear and spread; solution: they fade
      const grow = smooth(span(p, 0.04, 0.44)), heal = smooth(span(p, 0.56, 0.86));
      const lit = Math.floor(rank.length * grow);
      const on = sites.userData.on;
      for (let i = 0; i < rank.length; i++) on[rank[i]] = i < lit ? 1 : 0;
      sites.geometry.attributes.aOn.needsUpdate = true;
      sites.material.uniforms.uFade.value = 1 - heal;
      sites.material.uniforms.uTime.value = t;
      // The craft and its captured asteroid come into view for the solution
      const away = smooth(span(p, 0.5, 0.8));
      rock.visible = craft.visible = net.visible = away > 0.01;
      rock.rotation.set(t * 0.05, t * 0.08 + p, 0);
      craft.position.copy(ROCK).add(v3(-1.6, 0.25, 0.6));
      craft.lookAt(ROCK); craft.rotateY(-Math.PI / 2);
      craft.updateMatrixWorld(true);
      const from = craft.userData.netOrigin.clone().applyMatrix4(craft.matrixWorld);
      net.userData.set({ from, to: ROCK, radius: 0.56, fly: 1, size: 1.4, wrap: smooth(span(p, 0.62, 0.84)), time: t });
      // Camera: close on Earth for the problem, then back and across to the asteroid
      const cam = v3(lerp(0, 3.2, away), lerp(0.6, 1.6, away), lerp(small ? 9 : 7.2, small ? 12 : 9.5, away));
      stage.camera.position.copy(cam);
      stage.camera.lookAt(lerp(small ? 0 : -1.3, 2.6, away), lerp(0.1, 0.7, away), lerp(0, 0.8, away));
    },
  });
  sunlight(stage.scene, sunDir, { intensity: 3.2 });
  stage.scene.environmentIntensity = 0.2;
  stage.scene.add(sky, earth, rock, craft, net);
  whenTexturesLoaded(() => { if (!stage.isRunning()) stage.draw(); });
  return stage;
}

/** Soft additive puffs: dust, exhaust, cold gas */
function puffCloud(count, color, size) {
  const pos = new Float32Array(count * 3), alpha = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aAlpha; uniform float uSize; varying float vA; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * (0.5 + aAlpha) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; uniform vec3 uColor; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uColor * a, a); }`,
  }));
  pts.frustumCulled = false;
  return { pts, pos, alpha, geo, count, commit() { geo.attributes.position.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true; } };
}

/**
 * The mission, in ten beats: lift-off, hot staging, fleet dispatched, target
 * detected, net capture, stabilise, sample, signal home, a question, coming soon.
 * Beats 0-2 fly over Earth (1 unit = 10 m); beats 3-9 are in deep space at
 * the asteroid (1 unit = 1 m). The view dips to black between the two.
 */
export function missionStory(host, getProgress) {
  const BEATS = 10, small = innerWidth < 760;
  const sunDir = v3(-0.6, 0.45, 0.65).normalize();

  // ---------- Near Earth ----------
  const near = new THREE.Group();
  const EARTH_R = 60;
  const planet = earthGlobe(EARTH_R, { sun: sunDir });
  planet.position.set(6, -EARTH_R - 4, -26);
  // Tip the pole away so the view looks down on lit continents, not the ice cap
  planet.rotation.x = 1.15;
  planet.userData.globe.rotation.set(0, 3.3, 0);
  planet.userData.clouds.rotation.copy(planet.userData.globe.rotation);
  // A fully reusable two-stage launcher, scaled to the old stack's height in the frame
  const lv = starship(); lv.scale.setScalar(0.62);
  const { booster, ship, door, payloadMount, boosterPlume, boostbackPlume, shipPlumes, vent } = lv.userData;
  // A fleet of four craft, folded for launch and stacked in the bay, noses toward the door
  const FLEET = 4;
  const bayInfo = lv.userData.bay;
  const fleet = Array.from({ length: FLEET }, (_, i) => {
    const c = miningCraft(); c.scale.setScalar(0.1); c.rotation.y = Math.PI; c.userData.deploy(0);
    const home = v3(0.28, 0.16 + i * ((bayInfo.height - 0.3) / (FLEET - 1)), 0);
    c.position.copy(home); payloadMount.add(c);
    return { c, home, drift: v3(-1, (i - 1.5) * 0.35, (i % 2 ? 1 : -1) * (0.3 + i * 0.12)).normalize() };
  });
  near.add(planet, lv);

  // ---------- Deep space ----------
  const deep = new THREE.Group();
  const craft = miningCraft();
  craft.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const ROCK = v3(12, 0, -3), RR = 3.2;
  const rock = asteroid({ radius: RR, seed: 7, detail: small ? 36 : 56, boulders: small ? 300 : 650 });
  rock.position.copy(ROCK);
  const net = captureNet(small ? 16 : 22);
  const tetherGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
  const tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: 0xe9e4d6, transparent: true, opacity: 0.85 }));
  tether.frustumCulled = false;
  const farEarth = earthGlobe(2.4, { sun: sunDir });
  farEarth.position.set(-70, 18, -150);
  // Lidar: a scanning cone from the sensor turret to the target
  const scanMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uOn;
      void main(){ float sweep = smoothstep(0.08, 0.0, abs(fract(vUv.x - uTime * 0.35) - 0.5) - 0.42);
        float rings = pow(0.5 + 0.5 * sin((1.0 - vUv.y) * 60.0 - uTime * 8.0), 12.0);
        float a = (0.05 + 0.35 * sweep + 0.25 * rings) * uOn * smoothstep(0.0, 0.15, 1.0 - vUv.y);
        gl_FragColor = vec4(vec3(0.0, 0.76, 1.0) * a, a); }`,
  });
  const scanCone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 48, 1, true), scanMat);
  // Signal to Earth: pulses along the antenna's line of sight
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uOn;
      void main(){ float pulse = pow(0.5 + 0.5 * sin(vUv.y * 40.0 + uTime * 6.0), 16.0);
        float a = (0.04 + 0.6 * pulse) * uOn * (1.0 - vUv.y * 0.6);
        gl_FragColor = vec4(vec3(0.55, 0.88, 1.0) * a, a); }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 1, 24, 1, true), beamMat);
  // The research-centre question: a dashed outline of a station module
  const ghost = new THREE.Group();
  const dashed = new THREE.LineDashedMaterial({ color: 0x00c3ff, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0 });
  const addOutline = (geo, pos, rot) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 10), dashed); l.computeLineDistances(); l.position.copy(pos); if (rot) l.rotation.copy(rot); ghost.add(l); };
  addOutline(new THREE.CylinderGeometry(1.6, 1.6, 7, 24, 1), v3(0, 0, 0), new THREE.Euler(0, 0, Math.PI / 2));
  addOutline(new THREE.CylinderGeometry(0.9, 0.9, 2, 16, 1), v3(4.4, 0, 0), new THREE.Euler(0, 0, Math.PI / 2));
  addOutline(new THREE.TorusGeometry(3.4, 0.35, 8, 32), v3(-1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0));
  addOutline(new THREE.BoxGeometry(0.1, 7, 2.4), v3(-2.4, 0, 0));
  const dust = puffCloud(small ? 120 : 260, 0x8f877d, 120);
  deep.add(craft, rock, net, tether, farEarth, scanCone, beam, ghost, dust.pts);

  const sky = stars(small ? 3000 : 6000, 600, 2);

  // Deep-space positions
  const craftAt = (p) => {
    const approach = easeInOut(span(p, 0.3, 0.4));
    const pos = v3(lerp(-14, 2, approach), lerp(2.5, 0.4, approach), lerp(8, 1.2, approach));
    // Close in to arm's length for the sample, then back off
    const inward = smooth(span(p, 0.6, 0.66)) * (1 - smooth(span(p, 0.68, 0.72)));
    // Close enough for the arm (it reaches ~3.7 m ahead of the craft's origin) to touch the surface
    const contact = ROCK.clone().add(v3(-RR - 3.3, 0.6, 0.4));
    return pos.lerp(contact, inward);
  };
  let spin = 0, lastT = 0;
  const qContact = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  const look = v3(0, 0, 0), eye = v3(0, 0, 0), tmp = v3(0, 0, 0), knot = v3(0, 0, 0), mid = v3(0, 0, 0);
  // One framing per beat: [look-at, camera offset]; the camera eases into each over the first half of its beat
  const FRAMES = [
    () => [lv.localToWorld(v3(0, 6, 0)), v3(4.5, 2.4, 12.5)],
    () => [lv.localToWorld(v3(0, 7.8, 0)), v3(4.2, 1.8, 11.5)],
    // Face the bay (the ship's -x side, pitched over) from a three-quarter angle
    () => [ship.localToWorld(v3(-0.9, 2.0, 0)), v3(-2.3, -0.5, 2.6)],
    () => [craft.position.clone().lerp(ROCK, 0.45), v3(-6, 3, 16)],
    () => [craft.position.clone().lerp(ROCK, 0.55), v3(-2, 4, 15)],
    () => [craft.position.clone().lerp(ROCK, 0.5), v3(2, 2.5, 14)],
    () => [craft.position.clone().lerp(ROCK, 0.35), v3(-3, 1.5, 9)],
    () => { const d = farEarth.position.clone().sub(craft.position).normalize(); return [craft.position.clone().addScaledVector(d, 6), d.clone().multiplyScalar(-15).add(v3(0, 2.5, 0))]; },
    () => [craft.position.clone().add(v3(-5, 1, -2)), v3(-2, 4, 22)],
    () => [craft.position.clone().lerp(ROCK, 0.5), v3(-4, 7, 38)],
  ];
  const frameCamera = (p, stage) => {
    const i = Math.min(BEATS - 1, Math.floor(p * BEATS));
    const k = smooth((p * BEATS - i) / 0.5);
    // Cross the Earth/deep-space cut without blending positions from the other set
    const prev = i === 3 ? i : Math.max(0, i - 1);
    const [l1, o1] = FRAMES[i](), [l0, o0] = FRAMES[prev]();
    look.copy(l0).lerp(l1, k);
    eye.copy(look).add(o0.lerp(o1, k).multiplyScalar(Math.max(1, 1.15 / stage.camera.aspect)));
    stage.camera.position.copy(eye);
    stage.camera.lookAt(look);
  };
  let shown = 0;

  const stage = createStage(host, {
    fov: 38, env: "studio", shadows: true, stillTime: 0, exposure: 1, far: 2000,
    label: "Mission story: launch, hot staging, a fleet dispatched from the cargo bay, asteroid capture, sampling and signalling Earth",
    onFrame(t, dt) {
      const goal = getProgress();
      shown = dt ? shown + (goal - shown) * Math.min(1, dt * 5) : goal;
      const p = shown;
      const beat = (i) => span(p, i / BEATS, (i + 1) / BEATS);
      const inDeep = p >= 0.3;
      near.visible = !inDeep; deep.visible = inDeep;
      // A dip to black across the cut from Earth orbit to the asteroid
      stage.renderer.toneMappingExposure = 1 - smooth(1 - Math.abs(p - 0.3) / 0.02) * 1;

      if (!inDeep) {
        // ---- 0 Lift-off: climbing, pitching over in a gravity turn ----
        const climb = clamp01(p / 0.3);
        lv.position.set(climb * climb * 14, climb * 46, 0);
        // Earth stays beneath the climb, the horizon flattening as the vehicle rises
        planet.position.y = -EARTH_R - 4 + lv.position.y * 0.82;
        lv.rotation.z = -climb * 0.55;
        // ---- 1 Hot staging: the ship lights up while still attached, then the booster flips for home ----
        const b1 = beat(1);
        const light = span(b1, 0.05, 0.25), part = smooth(span(b1, 0.2, 0.9)), flip = smooth(span(b1, 0.35, 0.95));
        vent.emissiveIntensity = 3.5 * Math.sin(Math.PI * clamp01(light * 1.4)) * (b1 < 0.5 ? 1 : 0);
        ship.position.y = lv.userData.heights.ship + part * 3.2;
        booster.position.set(-part * 0.6, lv.userData.heights.booster / 2 - part * 2.2, 0);
        booster.rotation.z = flip * Math.PI * 0.95;
        booster.visible = p < 0.2 || b1 < 0.999;
        lv.userData.setFins(smooth(span(b1, 0.3, 0.6)));
        boosterPlume.visible = p < 0.1 + 0.022;
        boostbackPlume.visible = flip > 0.6 && b1 < 0.98;
        // ---- 2 Fleet dispatched: in orbit the door rolls up and the craft slide out one by one ----
        const b2 = beat(2);
        const coast = smooth(span(b2, 0, 0.2)), open = smooth(span(b2, 0.15, 0.35));
        // The ship pitches over into orbit, its bay toward the camera
        ship.rotation.z = coast * 1.05;
        door.userData.roll(open);
        fleet.forEach(({ c, home, drift }, i) => {
          // Top craft first; each slides out along the rails, then drifts clear and starts to unfold
          const go = smooth(span(b2, 0.35 + i * 0.13, 0.62 + i * 0.13));
          const out = Math.min(go, 0.35) / 0.35, away = Math.max(0, go - 0.35) / 0.65;
          c.position.copy(home).add(v3(-out * 0.55, 0, 0)).addScaledVector(drift, away * 1.8);
          c.userData.deploy(smooth(span(away, 0.4, 1)) * 0.7);
          c.rotation.set(0, Math.PI, away * 0.3 * (i % 2 ? 1 : -1));
        });        // Engines: the booster's 33 to staging; the ship's from hot staging to orbit
        for (const pl of [boosterPlume, boostbackPlume, ...shipPlumes]) pl.userData.uniforms.uTime.value = t;
        boosterPlume.userData.uniforms.uVacuum.value = smooth(climb * 1.2);
        boostbackPlume.userData.uniforms.uVacuum.value = 1;
        const shipBurn = b1 > 0.05 && p < 0.2 + 0.1 * 0.2;
        shipPlumes.forEach((pl) => { pl.visible = shipBurn; pl.userData.uniforms.uVacuum.value = 0.9; pl.userData.uniforms.uPower.value = smooth(light); });
        planet.userData.clouds.rotation.y = planet.userData.globe.rotation.y + t * 0.002;
      } else {
        // ---- Deep space ----
        craft.position.copy(craftAt(p));
        craft.userData.deploy(smooth(span(p, 0.3, 0.36)));
        craft.lookAt(ROCK); craft.rotateY(-Math.PI / 2);
        craft.updateMatrixWorld(true);
        // Tumble, damped by the thrusters in beat 5
        const calm = smooth(beat(5));
        const rate = 0.35 * (1 - calm * 0.95);
        spin += Math.max(0, t - lastT) * rate;
        lastT = t;
        rock.rotation.set(spin * 0.6 + p * 2, spin + p * 3 * (1 - calm), spin * 0.2);
        // 3 Target detected: lidar cone from the turret
        const det = beat(3);
        scanMat.uniforms.uOn.value = Math.sin(Math.PI * clamp01(det * 1.15)) * (p < 0.4 ? 1 : 0);
        scanMat.uniforms.uTime.value = t;
        const turret = craft.userData.tracker.getWorldPosition(v3(0, 0, 0));
        const toRock = tmp.copy(ROCK).sub(turret);
        const len = toRock.length();
        scanCone.scale.set(RR * 1.15, len, RR * 1.15);
        scanCone.position.copy(turret).addScaledVector(toRock, 0.5);
        scanCone.quaternion.setFromUnitVectors(v3(0, -1, 0), toRock.clone().normalize());
        scanCone.visible = scanMat.uniforms.uOn.value > 0.01;
        // 4 Net capture
        const b4 = beat(4);
        const fly = easeInOut(span(b4, 0, 0.5)), wrap = smooth(span(b4, 0.45, 1));
        net.visible = tether.visible = p >= 0.4;
        if (net.visible) {
          const from = craft.userData.netOrigin.clone().applyMatrix4(craft.matrixWorld);
          net.userData.set({ from, to: ROCK, radius: RR * 0.98, fly, size: lerp(0.8, RR * 2.6, fly), wrap, time: t });
          if (p < 0.47) { qContact.copy(rock.quaternion); net.quaternion.identity(); net.position.set(0, 0, 0); }
          else {
            net.quaternion.copy(rock.quaternion).multiply(qInv.copy(qContact).invert());
            net.position.copy(ROCK).sub(tmp.copy(ROCK).applyQuaternion(net.quaternion));
          }
          net.updateMatrixWorld(true);
          const n = net.userData.n;
          net.userData.knot(n >> 1, n >> 1, knot).applyMatrix4(net.matrixWorld);
          const taut = smooth(span(p, 0.5, 0.56));
          const arr = tetherGeo.attributes.position.array;
          for (let i = 0; i < 24; i++) {
            const u = i / 23;
            mid.copy(from).lerp(knot, u);
            mid.y -= Math.sin(Math.PI * u) * (1 - taut) * 0.8 * fly;
            arr.set([mid.x, mid.y, mid.z], i * 3);
          }
          tetherGeo.attributes.position.needsUpdate = true;
        }
        // 5 Stabilise: the ion engines pull steadily on the taut tether while the tumble dies away
        const b5 = beat(5);
        craft.userData.setThrust(Math.max(smooth(span(p, 0.31, 0.33)) * (1 - smooth(span(p, 0.38, 0.4))), Math.sin(Math.PI * b5) * (b5 > 0 && b5 < 1 ? 0.8 : 0)));
        // 6 Sample: the arm reaches the surface; dust lifts where it touches
        const b6 = beat(6);
        craft.userData.reach(smooth(span(b6, 0.1, 0.6)) * (1 - smooth(span(b6, 0.85, 1))));
        craft.userData.grip(smooth(span(b6, 0.55, 0.7)));
        const touch = span(b6, 0.55, 1);
        dust.pts.visible = touch > 0 && touch < 1;
        if (dust.pts.visible) {
          const head = v3(0, 0, 0);
          craft.userData.tip.getWorldPosition(head);
          for (let i = 0; i < dust.count; i++) {
            const a = clamp01(touch * 1.4 - (i / dust.count) * 0.4);
            const dir = v3(Math.sin(i * 12.9898), Math.cos(i * 4.1414) * 0.6 + 0.4, Math.sin(i * 7.77)).normalize();
            const outward = head.clone().sub(ROCK).normalize();
            dir.add(outward).normalize();
            dust.pos.set([head.x + dir.x * a * 1.8, head.y + dir.y * a * 1.8, head.z + dir.z * a * 1.8], i * 3);
            dust.alpha[i] = (1 - a) * 0.5 * (a > 0 ? 1 : 0);
          }
          dust.commit();
        }
        // 7 Signal home: the dish turns to Earth, pulses run along the beam
        const b7 = beat(7);
        const dish = craft.userData.dishPivot;
        const dishWorld = v3(0, 0, 0); dish.getWorldPosition(dishWorld);
        const toEarth = farEarth.position.clone().sub(dishWorld);
        const aim = smooth(span(b7, 0, 0.4));
        const localDir = toEarth.clone().normalize().transformDirection(craft.matrixWorld.clone().invert());
        dish.quaternion.slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), localDir), aim);
        beamMat.uniforms.uOn.value = smooth(span(b7, 0.35, 0.55)) * (1 - smooth(span(p, 0.8, 0.83)));
        beamMat.uniforms.uTime.value = t;
        beam.visible = beamMat.uniforms.uOn.value > 0.01;
        if (beam.visible) {
          const L = toEarth.length();
          beam.scale.set(1, L, 1);
          beam.position.copy(dishWorld).addScaledVector(toEarth, 0.5);
          beam.quaternion.setFromUnitVectors(v3(0, -1, 0), toEarth.clone().normalize());
        }
        // 8 The question: a dashed station module draws in beside the craft
        const ask = smooth(beat(8)) * (1 - smooth(span(p, 0.95, 1)) * 0.5);
        dashed.opacity = 0.75 * ask;
        ghost.visible = ask > 0.01;
        ghost.position.copy(craft.position).add(v3(-9, 3.5, -5));
        ghost.rotation.y = 0.5 + t * 0.03;
        farEarth.userData.globe.rotation.y = t * 0.01;
      }
      frameCamera(p, stage);
    },
  });
  sunlight(stage.scene, sunDir, { intensity: 4, shadows: true });
  stage.scene.environmentIntensity = 0.22;
  stage.scene.add(sky, near, deep);
  whenTexturesLoaded(() => { if (!stage.isRunning()) stage.draw(); });
  return stage;
}

export { lerp };
