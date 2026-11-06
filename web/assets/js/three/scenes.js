// The site's looping 3D scenes. Each returns its stage so the page can pause it.
import * as THREE from "three";
import { MeshSurfaceSampler } from "../../vendor/three/MeshSurfaceSampler.js";
import { createStage, smooth, span, clamp01, lerp, easeInOut, easeOut } from "./stage.js";
import { f1Car, carCollider } from "./f1car.js";
import { miningCraft, asteroid, captureNet, stars, earthGlobe } from "./space.js";
import { starship } from "./starship.js";
import { carStreamlines, carSeeds, smokeMaterial, streamlineMesh, smokeParticles } from "./flow.js";
import { belt, dot, metal, satin } from "./materials.js";

/** `count` points spread over a group's surfaces (area-weighted, deterministic) */
export function samplePoints(group, count, seed = 1234) {
  group.updateMatrixWorld(true);
  const parts = [];
  group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.material?.isShaderMaterial) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    parts.push(g.attributes.position.array);
    g.dispose();
  });
  const all = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of parts) { all.set(a, off); off += a.length; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(all, 3));
  let s = seed;
  const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).setRandomGenerator(random).build();
  const out = new Float32Array(count * 3), p = new THREE.Vector3();
  for (let i = 0; i < count; i++) { sampler.sample(p); out.set([p.x, p.y, p.z], i * 3); }
  geo.dispose();
  // Sorted nose to tail so two clouds can be paired point for point
  const idx = Array.from({ length: count }, (_, i) => i).sort((a, b) => out[b * 3] - out[a * 3]);
  const sorted = new Float32Array(count * 3);
  idx.forEach((j, i) => sorted.set(out.subarray(j * 3, j * 3 + 3), i * 3));
  return sorted;
}

/** Give every material in a group a shared clipping plane */
function clipWith(group, plane) {
  group.traverse((o) => {
    for (const m of [].concat(o.material || [])) { m.clippingPlanes = [plane]; m.clipShadows = true; }
  });
}

// ---------- The wind tunnel hall: everything in it can fade away ----------
function tunnelHall() {
  const g = new THREE.Group();
  const fades = [];
  const fade = (m, base = 1) => { m.transparent = true; fades.push([m, base]); return m; };
  // The hall floor is dark; only the model's shadow shows on it
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), fade(new THREE.ShadowMaterial({ opacity: 0.55 }), 0.55));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002; floor.receiveShadow = true;
  g.add(floor);
  const road = belt();
  const beltMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.3), fade(road.material));
  beltMesh.rotation.x = -Math.PI / 2; beltMesh.position.set(-0.3, 0, 0); beltMesh.receiveShadow = true;
  road.map.repeat.set(6, 1.4); road.map.rotation = Math.PI / 2;
  g.add(beltMesh);
  // Turntable rim and belt rails
  const rim = new THREE.Mesh(new THREE.RingGeometry(3.55, 3.58, 128), fade(new THREE.MeshBasicMaterial({ color: 0x1a1c20 })));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.001; g.add(rim);
  const railMat = fade(metal(0x5a5f66, 0.35));
  for (const z of [-1.17, 1.17]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.02, 0.04), railMat); rail.position.set(-0.3, 0.01, z); g.add(rail);
  }
  g.userData.road = road;
  /** 1 = the hall is here, 0 = gone */
  g.userData.presence = (k) => { fades.forEach(([m, base]) => { m.opacity = base * k; }); g.visible = k > 0.005; };
  return g;
}

/** Stars streaming past a moving vehicle: points in a long box, wrapped as they slide by */
function starStream(count = 1500, { length = 90, inner = 5, outer = 45 } = {}) {
  const pos = new Float32Array(count * 3), size = new Float32Array(count);
  let s = 77; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rad = inner + Math.pow(r(), 0.7) * (outer - inner);
    pos.set([(r() - 0.5) * length, Math.sin(a) * rad, Math.cos(a) * rad - 10], i * 3);
    size[i] = 0.6 + Math.pow(r(), 6) * 2.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uShift: { value: 0 }, uLen: { value: length }, uOpacity: { value: 0 }, uPx: { value: Math.min(devicePixelRatio || 1, 2) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float size; uniform float uShift, uLen, uPx; varying float vB;
      void main(){ vec3 p = position; p.x = mod(p.x - uShift + uLen * 0.5, uLen) - uLen * 0.5;
        vB = smoothstep(uLen * 0.5, uLen * 0.3, abs(p.x)) * (0.45 + size * 0.25);
        gl_PointSize = size * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uOpacity; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vB * uOpacity; gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * a, a); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/**
 * Main-page hero: an F1 car in a wind tunnel with smoke streamlines computed
 * round it. The car re-forms, nose to tail, into a launcher, and the tunnel
 * falls away: the steel launcher flies on through space over Earth, engines burning,
 * stars streaming past. Then back again. 14.6 s loop.
 * onPhase(name) fires as the scene changes: "car" | "morph" | "rocket".
 */
export function windTunnel(host, { onPhase = () => {}, view = null } = {}) {
  const small = innerWidth < 760;
  const N = small ? 5000 : 11000;
  const hall = tunnelHall();
  const car = f1Car();
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // The fully reusable steel launcher, flying nose-first along +x, its 33 booster engines burning
  const lv = starship();
  const engine = lv.userData.boosterPlume;
  engine.scale.set(1, 0.9, 1);
  engine.userData.uniforms.uVacuum.value = 0.35;
  const model = new THREE.Group();
  // 123 m stack shown at the same 6 m as the car it re-forms from
  lv.rotation.z = -Math.PI / 2; lv.scale.setScalar(0.5);
  model.add(lv);
  const AXIS_Y = 0.7;
  model.position.set(-2.95, AXIS_Y, 0);

  // Space: streaming stars, a fixed sky beyond them, Earth's limb below
  const stream = starStream(small ? 900 : 1800);
  const sky = stars(small ? 1500 : 3000, 200, 8);
  sky.material.transparent = true;
  const sunDir = new THREE.Vector3(-0.5, 0.55, 0.65).normalize();
  const planet = earthGlobe(34, { sun: sunDir });
  planet.position.set(-4, -46, -34);
  planet.rotation.x = 1.0;
  planet.userData.globe.rotation.y = 3.4;
  const planetMats = [];
  planet.traverse((o) => { if (o.material) { o.material.transparent = true; planetMats.push([o.material, o.material.opacity ?? 1]); } });
  const sun = new THREE.DirectionalLight(0xfff2e0, 0); sun.position.copy(sunDir).multiplyScalar(30);

  // Clipping planes sweep nose to tail: one body dissolves behind one, the other forms behind the other
  const carPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);
  const lvPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -10);
  clipWith(car, carPlane); clipWith(model, lvPlane);

  // Flow round the car: computed once
  const carLines = carStreamlines(carCollider(), { seeds: carSeeds() });
  const carSmoke = smokeMaterial();
  const carFlow = streamlineMesh(carLines, carSmoke);
  const carPuffs = smokeParticles(carLines, { count: small ? 500 : 1100 });

  // Morph cloud: car surface points paired with launcher surface points, nose to tail
  model.updateMatrixWorld(true);
  const A = samplePoints(car, N, 7), B = samplePoints(model, N, 9);
  const pos = new Float32Array(N * 3), alpha = new Float32Array(N);
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  cloudGeo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  const cloud = new THREE.Points(cloudGeo, new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 22 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aAlpha; uniform float uSize; varying float vA; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; gl_FragColor = vec4(vec3(0.6, 0.9, 1.0) * a, a); }`,
  }));
  cloud.frustumCulled = false;

  // Tunnel lighting: a big soft key overhead, cool rim lights, low fill
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(1.5, 9, 3); key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.radius = 6; key.shadow.bias = -0.0004;
  const rimL = new THREE.DirectionalLight(0x9fd8ff, 1.2); rimL.position.set(-6, 2.5, -4);
  const rimR = new THREE.DirectionalLight(0xffffff, 0.6); rimR.position.set(-5, 2, 5);
  const fill = new THREE.HemisphereLight(0x3a4250, 0x050506, 0.3);

  let phase = "", beltPos = 0, starShift = 0;
  // 0-5 car · 5-7.6 the car re-forms into the launcher · 7.6-12 through space · 12-14.6 back
  const X0 = 3.25, X1 = -3.0, SWEEP = 1.5, FLIGHT = 0.95, MORPH = SWEEP + FLIGHT + 0.15, BACK = 12, LOOP = BACK + MORPH;
  const setPhase = (name) => { if (name !== phase) { phase = name; onPhase(name); } };
  const keep = (plane, side, x) => {
    if (side === "below") { plane.normal.set(-1, 0, 0); plane.constant = x; }
    else { plane.normal.set(1, 0, 0); plane.constant = -x; }
  };

  const stage = createStage(host, {
    fov: 28, stillTime: 3.2, env: "studio", shadows: true, exposure: 1.05, far: 600,
    label: "An F1 car in a wind tunnel with smoke flowing over it re-forms into a rocket that flies on through space",
    onFrame(t, dt) {
      const p = t % LOOP;
      const forward = p >= 5 && p < 5 + MORPH, reverse = p >= BACK;
      const morphing = forward || reverse;
      const k = forward ? p - 5 : reverse ? p - BACK : 0;
      const leaving = forward ? car : model, arriving = forward ? model : car;
      const leavePlane = forward ? carPlane : lvPlane, arrivePlane = forward ? lvPlane : carPlane;
      const dissolveX = lerp(X0, X1, clamp01(k / SWEEP));
      const buildX = lerp(X0, X1, clamp01((k - FLIGHT) / SWEEP));
      const inSpace = p >= 5 + MORPH && p < BACK;
      if (morphing) {
        keep(leavePlane, "below", dissolveX);
        keep(arrivePlane, "above", buildX);
        leaving.visible = k < SWEEP + 0.05;
        arriving.visible = k > FLIGHT - 0.05;
      } else {
        keep(carPlane, "below", 10); keep(lvPlane, "above", -10);
        car.visible = !inSpace; model.visible = inSpace;
      }

      // Points leave as the dissolve line passes them and land as the build line reaches their target
      cloud.visible = morphing;
      if (morphing) {
        const from = forward ? A : B, to = forward ? B : A;
        for (let i = 0; i < N; i++) {
          const j = i * 3;
          const leave = ((X0 - from[j]) / (X0 - X1)) * SWEEP;
          const land = Math.max(leave + 0.25, FLIGHT + ((X0 - to[j]) / (X0 - X1)) * SWEEP);
          const u = clamp01((k - leave) / (land - leave));
          const e = easeInOut(u);
          const lift = Math.sin(Math.PI * e);
          pos[j] = lerp(from[j], to[j], e) - lift * 0.3;
          pos[j + 1] = lerp(from[j + 1], to[j + 1], e) + lift * (0.18 + 0.12 * Math.sin(i * 1.7));
          pos[j + 2] = lerp(from[j + 2], to[j + 2], e) + lift * 0.1 * Math.sin(i * 2.3);
          alpha[i] = k < leave ? 0 : u < 1 ? 0.9 : Math.max(0, 0.9 - (k - land) * 3);
        }
        cloudGeo.attributes.position.needsUpdate = true; cloudGeo.attributes.aAlpha.needsUpdate = true;
      }

      // How far we are into space (0 = tunnel, 1 = space)
      const space = forward ? smooth(span(k, 0.4, SWEEP + FLIGHT)) : reverse ? 1 - smooth(span(k, 0.2, SWEEP + 0.6)) : inSpace ? 1 : 0;
      hall.userData.presence(1 - space);
      key.intensity = 2.4 * (1 - space); fill.intensity = 0.3 * (1 - space);
      rimL.intensity = 1.2 * (1 - space * 0.6); rimR.intensity = 0.6 * (1 - space);
      sun.intensity = 3.6 * space;
      stage.scene.environmentIntensity = lerp(0.55, 0.18, space);
      stage.scene.fog.far = lerp(26, 900, space); stage.scene.fog.near = lerp(12, 800, space);
      stream.material.uniforms.uOpacity.value = space; sky.material.opacity = space;
      stream.visible = sky.visible = planet.visible = space > 0.01;
      planetMats.forEach(([m, base]) => { if (m.uniforms?.uFade) m.uniforms.uFade.value = space; else m.opacity = base * space; });
      planet.userData.globe.rotation.y = 3.4 + t * 0.004;
      // The launcher flies on: stars slide past, the engine burns
      starShift += (dt || 0) * 14 * space;
      stream.material.uniforms.uShift.value = starShift;
      engine.visible = model.visible && space > 0.3;
      engine.userData.uniforms.uTime.value = t;
      engine.userData.uniforms.uPower.value = smooth(span(space, 0.3, 0.9));
      model.position.y = AXIS_Y + Math.sin(t * 0.6) * 0.03 * space;
      model.rotation.x = Math.sin(t * 0.4) * 0.02 * space;

      // The car's smoke belongs to the tunnel
      const smoke = forward ? 1 - smooth(span(k, 0, SWEEP * 0.7)) : reverse ? smooth(span(k, FLIGHT, FLIGHT + SWEEP)) : inSpace ? 0 : 1;
      carSmoke.uniforms.uOpacity.value = smoke; carPuffs.material.uniforms.uOpacity.value = smoke;
      carFlow.visible = carPuffs.visible = smoke > 0.01;
      carSmoke.uniforms.uTime.value = t;
      if (carFlow.visible) carPuffs.userData.update(t);

      // Rolling road runs at air speed while the car is on it; wheels turn with it
      beltPos += (dt || 0) * 1.6 * smoke;
      hall.userData.road.map.offset.x = -beltPos;
      car.userData.wheels.forEach((w) => { w.userData.spin.rotation.y = beltPos * 9; });
      car.position.y = Math.sin(t * 31) * 0.0015 * smoke;

      setPhase(morphing ? "morph" : inSpace ? "rocket" : "car");
      // Camera: a slow drift round the front three-quarter; narrow frames pull back
      const az = 0.72 + Math.sin(t * 0.09) * 0.12;
      const d = 9.6 * Math.max(1, 1.45 / stage.camera.aspect);
      stage.camera.position.set(Math.cos(az) * d * 0.62, 1.55 + Math.sin(t * 0.13) * 0.12, Math.sin(az) * d);
      stage.camera.lookAt(0.1, 0.45, 0);
      if (view) { stage.camera.position.set(...view[0]); stage.camera.lookAt(...view[1]); }
    },
  });
  stage.renderer.localClippingEnabled = true;
  stage.scene.fog = new THREE.Fog(0x000000, 12, 26);
  stage.scene.add(sky, stream, planet, hall, car, model, carFlow, carPuffs, cloud, key, rimL, rimR, fill, sun, sun.target);
  return stage;
}

// ---------- Shared: a lidar tracking cone and craft-to-craft relay links ----------
export function trackingBeam(color = 0x00c3ff) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uColor: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uOn; uniform vec3 uColor;
      void main(){ float sweep = smoothstep(0.08, 0.0, abs(fract(vUv.x - uTime * 0.35) - 0.5) - 0.42);
        float rings = pow(0.5 + 0.5 * sin((1.0 - vUv.y) * 50.0 - uTime * 8.0), 12.0);
        float a = (0.04 + 0.3 * sweep + 0.22 * rings) * uOn * smoothstep(0.0, 0.15, 1.0 - vUv.y);
        gl_FragColor = vec4(uColor * a, a); }`,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 48, 1, true), mat);
  cone.frustumCulled = false;
  const dir = new THREE.Vector3();
  /** from, to: world points; radius at the target; on 0..1 */
  cone.userData.aim = (from, to, radius, on, t) => {
    dir.copy(to).sub(from);
    const len = dir.length();
    cone.scale.set(radius, len, radius);
    cone.position.copy(from).addScaledVector(dir, 0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    mat.uniforms.uOn.value = on; mat.uniforms.uTime.value = t;
    cone.visible = on > 0.01;
  };
  return cone;
}

/** A relay link: a faint line with a bright packet travelling along it */
function relayLink() {
  const g = new THREE.Group();
  const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00c3ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  line.frustumCulled = false;
  const packet = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x00c3ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(line, packet, halo);
  /** a, b: world points; k: packet progress 0..1 (outside: hidden); size: packet radius */
  g.userData.set = (a, b, k, size, active) => {
    const arr = geo.attributes.position.array; arr.set([a.x, a.y, a.z, b.x, b.y, b.z]); geo.attributes.position.needsUpdate = true;
    line.material.opacity = active ? 0.45 : 0.12;
    const show = k >= 0 && k <= 1;
    packet.visible = halo.visible = show;
    if (show) { packet.position.copy(a).lerp(b, k); halo.position.copy(packet.position); packet.scale.setScalar(size); halo.scale.setScalar(size * 3); }
  };
  return g;
}

/** Sunlight for space scenes: one hard key, a faint blue bounce, near-black fill */
function spaceLights(scene, { sun = [-6, 3, 5], small = false } = {}) {
  const key = new THREE.DirectionalLight(0xfff4e6, 4.2); key.position.set(...sun); key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
  key.shadow.bias = -0.0005;
  const bounce = new THREE.DirectionalLight(0x6f9bd8, 0.25); bounce.position.set(4, -3, -2);
  scene.add(key, key.target, bounce, new THREE.AmbientLight(0x0b0e14, 0.6));
  return key;
}

/**
 * Products section, scrubbed by scroll (progress 0..1): the car drops in seen
 * from above, the camera swings down to its front three-quarter, then it drives
 * out; the ASTRAEUS craft flies in and unfolds its solar wings.
 */
export function productShowcase(host, getProgress) {
  const small = innerWidth < 760;
  const car = f1Car();
  const craft = miningCraft();
  craft.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.5 }));
  shadow.rotation.x = -Math.PI / 2; shadow.receiveShadow = true;
  const sky = stars(small ? 1200 : 2600, 160, 5);
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3, 10, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.radius = 5;
  const sun = new THREE.DirectionalLight(0xfff2e0, 0); sun.position.set(-8, 4, 6);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.1); rim.position.set(-6, 3, -5);
  const fill = new THREE.HemisphereLight(0x39414d, 0x050506, 0.35);
  let shown = 0;
  const target = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();
  const stage = createStage(host, {
    fov: 30, env: "studio", shadows: true, stillTime: 0, exposure: 1.05,
    label: "An F1 car, then the ASTRAEUS spacecraft unfolding its solar arrays",
    onFrame(t, dt) {
      const goal = getProgress();
      shown = dt ? shown + (goal - shown) * Math.min(1, dt * 6) : goal;
      const p = shown;
      // ----- VECTRA: 0 - 0.5 -----
      const drop = smooth(span(p, 0, 0.1));
      const swing = easeInOut(span(p, 0.06, 0.36));
      const exit = Math.pow(span(p, 0.4, 0.5), 2);
      car.visible = p < 0.5;
      car.position.set(exit * 14, (1 - drop) * 2.5, 0);
      car.rotation.y = (1 - swing) * 0.0;
      car.userData.wheels.forEach((w) => { w.userData.spin.rotation.y = -(p * 60 + exit * 40); });
      shadow.visible = car.visible;
      // ----- ASTRAEUS: 0.5 - 1 -----
      const arrive = easeInOut(span(p, 0.5, 0.64));
      const unfold = smooth(span(p, 0.58, 0.8));
      craft.visible = p > 0.48;
      craft.userData.deploy(unfold);
      craft.position.set(lerp(-3, 0, arrive), lerp(4, 1.2, arrive), lerp(-14, 0, arrive));
      craft.rotation.set(lerp(0.6, 0.12, arrive), lerp(-2.2, -0.5, arrive) + span(p, 0.64, 1) * 0.9 + Math.sin(t * 0.3) * 0.03, lerp(0.4, -0.08, arrive));
      // Lighting crossfades from the studio to hard sunlight
      const space = smooth(span(p, 0.46, 0.56));
      key.intensity = 2.6 * (1 - space); fill.intensity = 0.35 * (1 - space); sun.intensity = 4.2 * space;
      stage.scene.environmentIntensity = lerp(0.55, 0.22, space);
      sky.material.opacity = space; sky.visible = space > 0.01;
      // ----- Camera -----
      if (p < 0.5) {
        // From straight overhead (nose up the screen) down to a low front three-quarter
        const el = lerp(Math.PI / 2 - 0.02, 0.2, swing), az = lerp(Math.PI / 2, 0.75, swing);
        const fit = Math.max(1, 1.2 / stage.camera.aspect);
        const d = lerp(13, 9.2, swing) * fit;
        target.set(0, lerp(0.2, 0.45, swing), 0);
        stage.camera.position.set(target.x + Math.cos(el) * Math.cos(az) * d, target.y + Math.sin(el) * d, target.z + Math.cos(el) * Math.sin(az) * d);
        up.set(1, 0, 0).lerp(new THREE.Vector3(0, 1, 0), smooth(span(swing, 0, 0.6))).normalize();
        stage.camera.up.copy(up);
      } else {
        target.set(0, 1.2, 0);
        const d = 17 * Math.max(1, 1.2 / stage.camera.aspect), az = 0.9 + span(p, 0.5, 1) * 0.35;
        stage.camera.position.set(Math.cos(az) * d * 0.8, 3.2, Math.sin(az) * d);
        stage.camera.up.set(0, 1, 0);
      }
      // Keep the subject clear of the product card: left of centre on wide
      // screens, above it on tall ones
      if (stage.camera.aspect > 1.2) {
        side.subVectors(target, stage.camera.position).cross(stage.camera.up).normalize();
        target.addScaledVector(side, p < 0.5 ? 1.3 : 2.2);
      } else {
        target.addScaledVector(stage.camera.up, p < 0.5 ? -0.9 : -1.6);
      }
      stage.camera.lookAt(target);
    },
  });
  sky.material.transparent = true;
  stage.scene.add(car, craft, shadow, sky, key, sun, rim, fill);
  return stage;
}

/**
 * ASTRAEUS hero: the craft closes on a small tumbling asteroid, fires its net,
 * the net wraps the rock, the tether tightens and thrusters stop the tumble.
 * 16 s loop.
 */
export function asteroidCapture(host) {
  const small = innerWidth < 760;
  const rock = asteroid({ radius: 3.2, seed: 7, detail: small ? 36 : 56, boulders: small ? 300 : 650 });
  const craft = miningCraft();
  craft.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const net = captureNet(small ? 16 : 22);
  const tetherGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
  const tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: 0xe9e4d6, transparent: true, opacity: 0.85 }));
  tether.frustumCulled = false;
  const lidar = trackingBeam();
  const sky = stars(small ? 2000 : 4500, 300, 21);
  const ROCK = new THREE.Vector3(6.5, 0.2, -1.5);
  rock.position.copy(ROCK);
  const tumble = new THREE.Euler();
  const launch = new THREE.Vector3(), knot = new THREE.Vector3(), mid = new THREE.Vector3(), tmp = new THREE.Vector3();
  const LOOP = 16;
  const qContact = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  let spin = 0, lastP = 0;
  const stage = createStage(host, {
    fov: 32, env: "studio", shadows: true, stillTime: 9, exposure: 1,
    label: "A nuclear-electric spacecraft tracks a small tumbling asteroid, nets it and pulls the spin out of it",
    onFrame(t, dt) {
      const p = t % LOOP;
      if (p < lastP) spin = 0;
      lastP = p;
      // Approach and brake (0-4), net out (4-5.2), wrap (5.2-7), tighten (7-8.5), de-spin (8.5-12), hold (12-14), fade (14-16)
      const approach = easeInOut(span(p, 0, 4));
      craft.position.set(lerp(-11, -4.2, approach), lerp(1.4, 0.4, approach) + Math.sin(t * 0.5) * 0.03, lerp(3, 0.8, approach));
      craft.lookAt(ROCK); craft.rotateY(-Math.PI / 2);
      craft.updateMatrixWorld(true);
      // Tumble: fast, then damped by the pull on the tether
      const rate = 0.45 * (1 - smooth(span(p, 8.5, 12)) * 0.94);
      spin += (dt || 0) * rate;
      tumble.set(spin * 0.7, spin, spin * 0.3);
      if (!dt) tumble.set(p * 0.3, p * 0.42, p * 0.12);
      rock.rotation.copy(tumble);
      // Net: flies out opening, then wraps the rock
      launch.copy(craft.userData.netOrigin).applyMatrix4(craft.matrixWorld);
      const fly = easeInOut(span(p, 4, 5.4)), wrap = smooth(span(p, 5.2, 7.2));
      net.visible = tether.visible = p > 4 && p < 15.2;
      if (net.visible) {
        const rr = rock.userData.radius * 0.96;
        net.userData.set({ from: launch, to: ROCK, radius: rr, fly, size: lerp(0.8, rr * 2.6, smooth(span(p, 4, 5.4))), wrap, time: t });
        // Once it touches, the net turns with the rock about the rock's centre
        if (p < 5.6 || !dt) { qContact.copy(rock.quaternion); net.quaternion.identity(); net.position.set(0, 0, 0); }
        else {
          net.quaternion.copy(rock.quaternion).multiply(qInv.copy(qContact).invert());
          net.position.copy(ROCK).sub(tmp.copy(ROCK).applyQuaternion(net.quaternion));
        }
        net.updateMatrixWorld(true);
        // Tether from the launcher to the net's centre knot, sagging until it is pulled taut
        const n = net.userData.n;
        net.userData.knot(n >> 1, n >> 1, knot).applyMatrix4(net.matrixWorld);
        const sag = (1 - smooth(span(p, 7, 8.5))) * 0.6 * fly;
        const arr = tetherGeo.attributes.position.array;
        for (let i = 0; i < 24; i++) {
          const u = i / 23;
          mid.copy(launch).lerp(knot, u);
          mid.y -= Math.sin(Math.PI * u) * sag;
          arr.set([mid.x, mid.y, mid.z], i * 3);
        }
        tetherGeo.attributes.position.needsUpdate = true;
      }
      // Ion engines: the approach, then a long pull on the taut tether that takes the spin out
      const cruise = 1 - smooth(span(p, 2.6, 3.6));
      const pull = smooth(span(p, 8.5, 9.2)) * (1 - smooth(span(p, 11.4, 12)));
      craft.userData.setThrust(Math.max(cruise, pull * 0.8));
      // Autonomous tracking: the lidar locks on through the approach
      craft.userData.tracker.getWorldPosition(tmp);
      lidar.userData.aim(tmp, ROCK, rock.userData.radius * 1.1, Math.sin(Math.PI * span(p, 0.4, 4.4)), t);
      // Fade out and in around the loop seam
      stage.renderer.toneMappingExposure = p < 0.8 ? smooth(p / 0.8) : 1 - smooth(span(p, 14.6, 15.8));
      // Camera: a slow cinematic dolly past the pair
      const cx = lerp(-7, -2.5, smooth(p / LOOP));
      stage.camera.position.set(cx, 4.2 + Math.sin(t * 0.1) * 0.3, 21 * Math.max(1, 1.6 / stage.camera.aspect));
      stage.camera.lookAt(lerp(-2.5, 0.5, smooth(p / LOOP)), 0, -0.5);
    },
  });
  spaceLights(stage.scene, { sun: [-12, 6, 1.5], small });
  stage.scene.environmentIntensity = 0.22;
  stage.scene.add(sky, rock, craft, net, tether, lidar);
  return stage;
}

/**
 * The ASTRAEUS fleet prospecting a field of asteroids: each craft tracks and
 * scans its own target to learn what it contains; one has landed on an
 * asteroid too massive to catch and is sampling it. Out of sight of Earth,
 * a craft's message hops craft to craft until one can reach home. 20 s loop.
 */
export function fleetSurvey(host) {
  const small = innerWidth < 760;
  const sky = stars(small ? 2000 : 4500, 900, 31);
  const field = new THREE.Group();
  // The big one (landed on) and four smaller targets
  const big = asteroid({ radius: 13, seed: 19, detail: small ? 44 : 60, boulders: small ? 400 : 900 });
  big.position.set(0, -13, 0); field.add(big);
  const targets = [
    { at: [-34, 6, -10], r: 3.2, seed: 3 },
    { at: [-12, 16, -32], r: 4.2, seed: 8 },
    { at: [26, 10, -26], r: 3.6, seed: 12 },
    { at: [40, -4, 8], r: 2.8, seed: 27 },
  ].map(({ at, r, seed }) => {
    const rock = asteroid({ radius: r, seed, detail: small ? 28 : 40, boulders: small ? 80 : 180 });
    rock.position.set(...at); field.add(rock); return rock;
  });
  const prep = (c) => { c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return c; };
  // Surveyors: one per small asteroid, holding station at a few radii and circling slowly
  const surveyors = targets.map((rock, i) => {
    const craft = prep(miningCraft()); field.add(craft);
    const beam = trackingBeam(i % 2 ? 0x7cf7c9 : 0x00c3ff); field.add(beam);
    return { craft, rock, beam, phase: i * 1.7, dist: rock.userData.radius + 9 };
  });
  // The lander: nose down on the big asteroid, legs out, arm sampling
  const lander = prep(miningCraft());
  const up = new THREE.Vector3(0.25, 1, 0.15).normalize();
  const ground = big.userData.surface(up).add(big.position);
  lander.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), up.clone().negate());
  lander.position.copy(ground).addScaledVector(up, lander.userData.landingReach + 0.05);
  lander.userData.setLegs(1, { spike: 1 });
  field.add(lander);
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(80 * 3), 3)),
    new THREE.PointsMaterial({ color: 0x8f877d, size: 0.14, map: dot(), transparent: true, depthWrite: false }));
  dust.frustumCulled = false; field.add(dust);
  // Earth, far off; the big asteroid stands between it and the furthest surveyor
  const earth = earthGlobe(12, { sun: new THREE.Vector3(-0.5, 0.6, 0.6).normalize() });
  earth.position.set(-200, 0, -170); field.add(earth);
  // Relay chain: the far surveyor (no line of sight) → surveyor → lander → surveyor → surveyor → Earth
  const chain = [surveyors[3].craft, surveyors[2].craft, lander, surveyors[1].craft, surveyors[0].craft];
  const links = chain.map(() => { const l = relayLink(); field.add(l); return l; });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), tip = new THREE.Vector3();
  const LOOP = 20;

  const stage = createStage(host, {
    fov: 36, env: "studio", shadows: true, stillTime: 6, exposure: 1, far: 2000,
    label: "A fleet of spacecraft prospects several asteroids, one landed on a large asteroid, relaying messages to Earth craft to craft",
    onFrame(t) {
      const p = t % LOOP;
      surveyors.forEach((sv, i) => {
        const ang = sv.phase + t * 0.05;
        const pos = c.set(Math.cos(ang) * sv.dist, Math.sin(ang * 0.7) * 2, Math.sin(ang) * sv.dist).add(sv.rock.position);
        sv.craft.position.copy(pos);
        sv.craft.lookAt(sv.rock.position); sv.craft.rotateY(-Math.PI / 2);
        sv.craft.updateMatrixWorld(true);
        sv.rock.rotation.set(t * 0.05 * (i + 1), t * 0.08, 0);
        // Each scan sweeps for a few seconds, staggered across the fleet
        const on = Math.max(0, Math.sin(Math.PI * (((p + i * 4) % 10) / 10))) ** 2;
        sv.craft.userData.tracker.getWorldPosition(a);
        sv.beam.userData.aim(a, sv.rock.position, sv.rock.userData.radius * 1.15, on, t + i);
        sv.craft.userData.setThrust(0);
      });
      // The lander's arm works the surface
      const work = (p % 10) / 10;
      lander.userData.reach(0.75 + 0.25 * Math.sin(work * Math.PI * 2));
      lander.userData.grip(work > 0.4 && work < 0.8 ? 1 : 0.2);
      lander.updateMatrixWorld(true);
      lander.userData.tip.getWorldPosition(tip);
      const arr = dust.geometry.attributes.position.array;
      for (let i = 0; i < 80; i++) {
        const k = ((i * 0.618) + t * 0.3) % 1;
        arr.set([tip.x + Math.sin(i * 12.9) * k * 1.2 + up.x * k * 1.4, tip.y + Math.cos(i * 4.1) * k * 0.6 + up.y * k * 1.4, tip.z + Math.sin(i * 7.7) * k * 1.2 + up.z * k * 1.4], i * 3);
      }
      dust.geometry.attributes.position.needsUpdate = true;
      dust.material.opacity = 0.55 * (work > 0.4 && work < 0.9 ? 1 : 0.2);
      // A message passes down the chain hop by hop, then Earth
      const hop = (p % 10) / 10 * chain.length;     // which hop the packet is on
      chain.forEach((from, i) => {
        from.userData.relay.getWorldPosition(a);
        if (i + 1 < chain.length) chain[i + 1].userData.relay.getWorldPosition(b);
        else b.copy(earth.position);
        const k = hop - i;
        links[i].userData.set(a, b, k, i + 1 === chain.length ? 0.9 : 0.35, k >= 0 && k <= 1);
      });
      earth.userData.globe.rotation.y = t * 0.01;
      big.rotation.y = 0;
      // Camera: a slow arc over the field
      const az = 0.55 + Math.sin(t * 0.04) * 0.25, d = 95 * Math.max(1, 1.2 / stage.camera.aspect);
      stage.camera.position.set(Math.cos(az) * d, 38, Math.sin(az) * d);
      stage.camera.lookAt(4, 0, -6);
    },
  });
  const sun = spaceLights(stage.scene, { sun: [-14, 16, 8], small });
  sun.target.position.set(0, 0, -8); sun.position.set(-60, 70, 40);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 }); sun.shadow.camera.updateProjectionMatrix();
  stage.scene.environmentIntensity = 0.22;
  stage.scene.add(sky, field);
  return stage;
}

export { clamp01, dot };
