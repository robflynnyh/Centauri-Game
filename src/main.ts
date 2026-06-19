import * as THREE from "three";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

const params = new URLSearchParams(window.location.search);
const isDemo = params.get("demo") === "pr";

app.innerHTML = `
  <div class="hud">
    <section class="hud__title">
      <h1>Centauri Field Note 001</h1>
      <p>Unknown planet. Thin air. Singing mineral flora, glassy spring water. WASD to walk, drag to look. Add <code>?demo=pr</code> for the deterministic PR flythrough.</p>
    </section>
    <div class="hud__badge">${isDemo ? "PR demo mode" : "exploration mode"}</div>
  </div>
`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x4654b5);
scene.fog = new THREE.FogExp2(0x49396f, 0.024);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0, 6, 24);

const clock = new THREE.Clock();
const keys = new Set<string>();
const player = {
  yaw: 0,
  pitch: -0.12,
  position: new THREE.Vector3(0, 5.2, 24),
  velocity: new THREE.Vector3(),
};

const hemi = new THREE.HemisphereLight(0xfff2c1, 0x191040, 1.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffc78f, 2.6);
sun.position.set(-24, 42, 16);
scene.add(sun);

const moon = new THREE.DirectionalLight(0x9ab7ff, 1.2);
moon.position.set(30, 15, -20);
scene.add(moon);

function makeSkyDome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(180, 24, 14);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      horizonColour: { value: new THREE.Color(0xff8ecf) },
      middleColour: { value: new THREE.Color(0x6aa8ff) },
      zenithColour: { value: new THREE.Color(0x191044) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 horizonColour;
      uniform vec3 middleColour;
      uniform vec3 zenithColour;

      void main() {
        float height = clamp(normalize(vWorldPosition).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 lowSky = mix(horizonColour, middleColour, smoothstep(0.18, 0.58, height));
        vec3 sky = mix(lowSky, zenithColour, smoothstep(0.62, 1.0, height));
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  return new THREE.Mesh(geometry, material);
}

scene.add(makeSkyDome());

function heightAt(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const island = Math.max(0, 1 - Math.pow(d / 58, 2.7));
  const ridges = Math.sin(x * 0.23) * Math.cos(z * 0.19) * 1.6;
  const alienPulse = Math.sin((x + z) * 0.08) * 0.9 + Math.sin(Math.hypot(x, z) * 0.35) * 0.75;
  return island * (ridges + alienPulse + 8.5) - 3.2;
}

function makeTerrain(): THREE.Mesh {
  const size = 120;
  const segments = 96;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colours: number[] = [];
  const colour = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = heightAt(x, z);
    positions.setY(i, y);

    const altitude = THREE.MathUtils.clamp((y + 2) / 12, 0, 1);
    const mineral = (Math.sin(x * 0.41) + Math.cos(z * 0.37) + 2) / 4;
    colour.setHSL(0.58 + mineral * 0.17, 0.45, 0.18 + altitude * 0.22);
    colours.push(colour.r, colour.g, colour.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return new THREE.Mesh(geometry, material);
}

scene.add(makeTerrain());

const floraGroup = new THREE.Group();
scene.add(floraGroup);

const natureGroup = new THREE.Group();
scene.add(natureGroup);

const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xff6fb5, emissive: 0x7b1f4c, roughness: 0.8 });
const stalkMaterial = new THREE.MeshStandardMaterial({ color: 0x8ae1d2, emissive: 0x0d4c53, roughness: 0.9 });
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5140a8, emissive: 0x120b38, roughness: 0.95 });
const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x7cff9b, emissive: 0x1f6a44, roughness: 0.82, flatShading: true });
const canopyAccentMaterial = new THREE.MeshStandardMaterial({ color: 0xffc766, emissive: 0x784015, roughness: 0.78, flatShading: true });
const reedMaterial = new THREE.MeshStandardMaterial({ color: 0xb8ff6a, emissive: 0x315a13, roughness: 0.9 });
const bloomMaterial = new THREE.MeshStandardMaterial({ color: 0xf86eff, emissive: 0x7a197c, roughness: 0.75 });
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x68f4ff,
  emissive: 0x155c74,
  transparent: true,
  opacity: 0.7,
  roughness: 0.28,
  metalness: 0.05,
  side: THREE.DoubleSide,
});
const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x7466ff, emissive: 0x201060, roughness: 1 });

function addFlora(seed: number): void {
  const angle = seed * 2.399963;
  const radius = 8 + ((seed * 17) % 43);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = heightAt(x, z);

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 2.6 + (seed % 5) * 0.35, 5), stalkMaterial);
  stalk.position.set(x, y + 1.2, z);
  stalk.rotation.z = Math.sin(seed) * 0.18;
  floraGroup.add(stalk);

  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + (seed % 4) * 0.12, 0), markerMaterial);
  cap.position.set(x, y + 2.8 + (seed % 3) * 0.18, z);
  cap.rotation.set(seed * 0.12, seed * 0.2, seed * 0.07);
  floraGroup.add(cap);
}

for (let i = 1; i <= 74; i += 1) {
  addFlora(i);
}

function addAlienTree(x: number, z: number, scale: number, lean: number): void {
  const y = heightAt(x, z);
  const tree = new THREE.Group();
  tree.position.set(x, y, z);
  tree.rotation.y = x * 0.11 + z * 0.07;
  tree.scale.setScalar(scale);

  const trunkLeanX = Math.sin(lean) * 0.08;
  const lowerTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.56, 3.7, 6), trunkMaterial);
  lowerTrunk.position.set(trunkLeanX, 1.78, 0);
  lowerTrunk.rotation.z = lean * 0.07;
  tree.add(lowerTrunk);

  const upperTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.35, 5), trunkMaterial);
  upperTrunk.position.set(trunkLeanX * 1.6, 3.92, 0);
  upperTrunk.rotation.z = lean * 0.05;
  tree.add(upperTrunk);

  const lowerCrown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 0), canopyAccentMaterial);
  lowerCrown.position.set(trunkLeanX * 1.5, 3.88, 0);
  lowerCrown.scale.set(1.28, 0.48, 1.22);
  lowerCrown.rotation.set(0.12, lean, 0.04);
  tree.add(lowerCrown);

  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), canopyMaterial);
  crown.position.set(trunkLeanX * 1.8, 4.38, 0);
  crown.scale.set(1.5, 0.76, 1.48);
  crown.rotation.set(0.16, lean, -0.04);
  tree.add(crown);

  const collar = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), canopyAccentMaterial);
  collar.position.set(trunkLeanX * 1.5, 4.05, 0);
  collar.scale.set(0.9, 0.5, 0.9);
  collar.rotation.set(0.12, lean, -0.06);
  tree.add(collar);

  for (let i = 0; i < 5; i += 1) {
    const bead = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + i * 0.012, 0), bloomMaterial);
    const angle = i * 1.34 + lean;
    bead.position.set(trunkLeanX + Math.cos(angle) * 0.68, 3.66 - i * 0.2, Math.sin(angle) * 0.68);
    tree.add(bead);
  }

  natureGroup.add(tree);
}

const treePlacements = [
  { x: -7, z: 11, scale: 0.86, lean: -0.8 },
  { x: 9, z: 7, scale: 1.05, lean: 0.45 },
  { x: 15, z: -5, scale: 0.92, lean: 0.9 },
  { x: -17, z: -10, scale: 1.16, lean: -0.35 },
  { x: 23, z: 15, scale: 0.82, lean: 0.2 },
  { x: -25, z: 16, scale: 0.94, lean: -1.0 },
  { x: 2, z: -21, scale: 1.08, lean: 0.72 },
  { x: 32, z: -18, scale: 0.78, lean: -0.62 },
  { x: -33, z: -2, scale: 0.88, lean: 0.58 },
];

treePlacements.forEach(({ x, z, scale, lean }) => addAlienTree(x, z, scale, lean));

function addGroundSprout(seed: number): void {
  const angle = seed * 2.13;
  const radius = 5 + ((seed * 29) % 49);
  const x = Math.cos(angle) * radius + Math.sin(seed * 0.7) * 2.4;
  const z = Math.sin(angle) * radius + Math.cos(seed * 0.41) * 2.4;
  const y = heightAt(x, z);
  const sprout = new THREE.Group();
  sprout.position.set(x, y + 0.08, z);
  sprout.rotation.y = angle;

  const bladeCount = 3 + (seed % 4);
  for (let i = 0; i < bladeCount; i += 1) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8 + (seed % 5) * 0.09, 4), reedMaterial);
    const bladeAngle = (i / bladeCount) * Math.PI * 2;
    blade.position.set(Math.cos(bladeAngle) * 0.18, 0.36, Math.sin(bladeAngle) * 0.18);
    blade.rotation.set(0.22 + i * 0.06, 0, bladeAngle);
    sprout.add(blade);
  }

  if (seed % 3 === 0) {
    const bloom = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + (seed % 4) * 0.035, 0), bloomMaterial);
    bloom.position.y = 0.88;
    bloom.rotation.set(seed * 0.18, seed * 0.33, seed * 0.12);
    sprout.add(bloom);
  }

  natureGroup.add(sprout);
}

for (let i = 1; i <= 120; i += 1) {
  addGroundSprout(i);
}

function addPool(x: number, z: number, radius: number, colourShift: number): void {
  const y = heightAt(x, z) + 0.16;
  const pool = new THREE.Group();
  pool.position.set(x, y, z);
  pool.rotation.y = colourShift;

  const water = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), waterMaterial.clone());
  const waterMat = water.material as THREE.MeshStandardMaterial;
  waterMat.color.offsetHSL(colourShift * 0.02, 0, 0);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.45, 0.78, 1);
  pool.add(water);

  const innerGlow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.56, 14),
    new THREE.MeshBasicMaterial({ color: 0xbaffff, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
  );
  innerGlow.rotation.x = -Math.PI / 2;
  innerGlow.position.y = 0.03;
  innerGlow.scale.set(1.3, 0.68, 1);
  pool.add(innerGlow);

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const rim = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 4) * 0.06, 0), stoneMaterial);
    rim.position.set(Math.cos(angle) * radius * 1.28, 0.1, Math.sin(angle) * radius * 0.72);
    rim.rotation.set(i * 0.2, i * 0.3, i * 0.17);
    pool.add(rim);
  }

  natureGroup.add(pool);
}

addPool(5.5, 7.5, 3.4, 0.1);
addPool(-18, -3, 2.5, 0.45);
addPool(21, -15, 2.2, 0.8);

const streamPoints = [
  new THREE.Vector3(-12, heightAt(-12, 7) + 0.22, 7),
  new THREE.Vector3(-6, heightAt(-6, 8) + 0.24, 8),
  new THREE.Vector3(0, heightAt(0, 6) + 0.25, 6),
  new THREE.Vector3(5.5, heightAt(5.5, 7.5) + 0.25, 7.5),
  new THREE.Vector3(11, heightAt(11, 4) + 0.22, 4),
];
const stream = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(streamPoints), 80, 0.18, 6, false), waterMaterial);
stream.renderOrder = 1;
natureGroup.add(stream);

for (let i = 0; i < 34; i += 1) {
  const angle = i * 1.71;
  const radius = 10 + ((i * 23) % 50);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = heightAt(x, z);
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + (i % 5) * 0.28, 0), stoneMaterial);
  stone.position.set(x, y + 0.7, z);
  stone.rotation.set(i * 0.2, i * 0.4, i * 0.1);
  scene.add(stone);
}

const skyRing = new THREE.Mesh(
  new THREE.TorusGeometry(42, 0.06, 8, 160),
  new THREE.MeshBasicMaterial({ color: 0xffd37e })
);
skyRing.position.set(0, 30, -20);
skyRing.rotation.x = Math.PI / 2.7;
scene.add(skyRing);

const celestialGroup = new THREE.Group();
scene.add(celestialGroup);

type CelestialBody = {
  angle: number;
  height: number;
  distance: number;
  radius: number;
  colour: number;
  halo: number;
  ring?: boolean;
};

const celestialBodies: CelestialBody[] = [
  { angle: -0.86, height: 46, distance: 118, radius: 8.4, colour: 0xff75c9, halo: 0x57225d, ring: true },
  { angle: -0.42, height: 25, distance: 128, radius: 3.6, colour: 0xb8f7ff, halo: 0x265b7b },
  { angle: 0.08, height: 56, distance: 132, radius: 5.8, colour: 0xf6ee9d, halo: 0x6f5428, ring: true },
  { angle: 0.48, height: 33, distance: 125, radius: 2.8, colour: 0x94ffca, halo: 0x21584c },
  { angle: 0.9, height: 42, distance: 122, radius: 4.4, colour: 0xca96ff, halo: 0x3f2a70 },
  { angle: 1.32, height: 24, distance: 130, radius: 2.3, colour: 0xffb183, halo: 0x6d352c },
  { angle: 1.72, height: 62, distance: 135, radius: 6.9, colour: 0x83d3ff, halo: 0x223a75, ring: true },
  { angle: 2.24, height: 30, distance: 120, radius: 3.2, colour: 0xfff4c8, halo: 0x66552c },
  { angle: 2.78, height: 47, distance: 128, radius: 4.9, colour: 0xff8ba7, halo: 0x66284a },
  { angle: 3.3, height: 29, distance: 126, radius: 2.6, colour: 0x91ffe8, halo: 0x1c5d60 },
  { angle: 3.86, height: 53, distance: 132, radius: 7.6, colour: 0xf79bff, halo: 0x4c2266, ring: true },
  { angle: 4.42, height: 34, distance: 124, radius: 3.1, colour: 0xffdf74, halo: 0x6b521e },
];

function addCelestialBody(body: CelestialBody, index: number): void {
  const group = new THREE.Group();
  const x = Math.sin(body.angle) * body.distance;
  const z = Math.cos(body.angle) * body.distance;
  group.position.set(x, body.height, z);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(body.radius * 1.72, 18),
    new THREE.MeshBasicMaterial({
      color: body.halo,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  group.add(halo);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(body.radius, 16),
    new THREE.MeshBasicMaterial({
      color: body.colour,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  group.add(disc);

  const moonlet = new THREE.Mesh(
    new THREE.CircleGeometry(body.radius * 0.18, 10),
    new THREE.MeshBasicMaterial({
      color: 0xf8fff5,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  moonlet.position.set(body.radius * (1.25 + (index % 3) * 0.22), body.radius * (0.35 - (index % 2) * 0.5), 0.02);
  group.add(moonlet);

  if (body.ring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(body.radius * 1.32, body.radius * 0.055, 6, 48),
      new THREE.MeshBasicMaterial({ color: 0xfff1bd, transparent: true, opacity: 0.72, depthWrite: false })
    );
    ring.rotation.z = 0.42 + index * 0.16;
    ring.scale.y = 0.24;
    group.add(ring);
  }

  group.lookAt(camera.position);
  celestialGroup.add(group);
}

celestialBodies.forEach(addCelestialBody);

const audio = new AudioContext();
let audioStarted = false;

function startAudio(): void {
  if (audioStarted) return;
  audioStarted = true;
  const master = audio.createGain();
  master.gain.value = 0.035;
  master.connect(audio.destination);

  [55, 82.5, 110, 165].forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.75 : 0.22;
    oscillator.connect(gain).connect(master);
    oscillator.start();
  });
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  void audio.resume();
  startAudio();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("pointerdown", () => startAudio());

let dragging = false;
window.addEventListener("pointerdown", () => { dragging = true; });
window.addEventListener("pointerup", () => { dragging = false; });
window.addEventListener("pointermove", (event) => {
  if (!dragging || isDemo) return;
  player.yaw -= event.movementX * 0.003;
  player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.003, -1.1, 0.6);
});

function updateExploration(delta: number): void {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const wish = new THREE.Vector3();

  if (keys.has("KeyW")) wish.add(forward.clone().multiplyScalar(-1));
  if (keys.has("KeyS")) wish.add(forward);
  if (keys.has("KeyA")) wish.add(right.clone().multiplyScalar(-1));
  if (keys.has("KeyD")) wish.add(right);

  if (wish.lengthSq() > 0) wish.normalize();
  player.velocity.lerp(wish.multiplyScalar(8), 1 - Math.exp(-delta * 6));
  player.position.addScaledVector(player.velocity, delta);
  player.position.y = heightAt(player.position.x, player.position.z) + 2.2;

  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updateDemo(elapsed: number): void {
  const radius = 24 - Math.sin(elapsed * 0.35) * 4;
  const angle = elapsed * 0.16 + 0.2;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  const y = heightAt(x, z) + 5.1 + Math.sin(elapsed * 0.7) * 1.0;
  camera.position.set(x, y, z);
  camera.lookAt(4 + Math.sin(elapsed * 0.22) * 3, 6.8 + Math.sin(elapsed * 0.31) * 1.2, 6 + Math.cos(elapsed * 0.18) * 3);
}

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (isDemo) updateDemo(elapsed);
  else updateExploration(delta);

  skyRing.rotation.z = elapsed * 0.035;
  celestialGroup.children.forEach((child, index) => {
    child.lookAt(camera.position);
    child.rotation.z += Math.sin(elapsed * 0.12 + index) * 0.0008;
  });
  floraGroup.children.forEach((child, index) => {
    child.position.y += Math.sin(elapsed * 1.6 + index) * 0.0018;
    child.rotation.y += delta * 0.18;
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
