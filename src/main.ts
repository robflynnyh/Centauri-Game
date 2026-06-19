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
      <p>Unknown planet. Thin air. Singing mineral flora. WASD to walk, drag to look. Add <code>?demo=pr</code> for the deterministic PR flythrough.</p>
    </section>
    <div class="hud__badge">${isDemo ? "PR demo mode" : "exploration mode"}</div>
  </div>
`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1020);
scene.fog = new THREE.FogExp2(0x15152c, 0.028);

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

  const positions = geometry.attributes.position;
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

const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xff6fb5, emissive: 0x7b1f4c, roughness: 0.8 });
const stalkMaterial = new THREE.MeshStandardMaterial({ color: 0x8ae1d2, emissive: 0x0d4c53, roughness: 0.9 });
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

  if (keys.has("KeyW")) wish.add(forward.multiplyScalar(-1));
  if (keys.has("KeyS")) wish.add(forward);
  if (keys.has("KeyA")) wish.add(right.multiplyScalar(-1));
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
  const radius = 28 - Math.sin(elapsed * 0.35) * 5;
  const angle = elapsed * 0.16;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  const y = heightAt(x, z) + 5.5 + Math.sin(elapsed * 0.7) * 1.2;
  camera.position.set(x, y, z);
  camera.lookAt(Math.sin(elapsed * 0.22) * 4, 5.4, Math.cos(elapsed * 0.18) * 4);
}

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (isDemo) updateDemo(elapsed);
  else updateExploration(delta);

  skyRing.rotation.z = elapsed * 0.035;
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
