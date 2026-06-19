import * as THREE from "three";
import { createCollisionWorld, type CollisionObstacle } from "./collision";
import { createPrDemoController } from "./demo";
import { createFootstepTrail } from "./footsteps";
import { populateNature } from "./nature";
import { createSkySystem } from "./sky";
import { heightAt, makeHorizonLandforms, makeTerrain } from "./terrain";
import "./style.css";

declare global {
  interface Window {
    __centauriDebug?: {
      obstacles: CollisionObstacle[];
      getPlayer: () => { x: number; y: number; z: number };
      setPlayer: (x: number, z: number) => void;
      attemptMove: (x: number, z: number) => { x: number; z: number };
      isBlockedAt: (x: number, z: number) => boolean;
      terrainHeightAt: (x: number, z: number) => number;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root");
}

const params = new URLSearchParams(window.location.search);
const isDemo = params.get("demo") === "pr";
const enableCollisionDebug = params.get("test") === "collision";

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
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(0, 6, 24);

const clock = new THREE.Clock();
const keys = new Set<string>();
const player = {
  yaw: 0,
  pitch: -0.12,
  position: new THREE.Vector3(0, 5.2, 24),
  velocity: new THREE.Vector3(),
};

const collisionWorld = createCollisionWorld();
const sky = createSkySystem(scene, camera, isDemo);

scene.add(makeTerrain());
scene.add(makeHorizonLandforms());

const { floraGroup } = populateNature(scene, heightAt, collisionWorld.addObstacle);
const footsteps = createFootstepTrail(scene, heightAt, collisionWorld.isBlockedAt);
const prDemo = createPrDemoController(camera, heightAt, collisionWorld.resolveMove, (position, delta) => {
  footsteps.walk(position, delta);
});

if (enableCollisionDebug) {
  window.__centauriDebug = {
    obstacles: collisionWorld.obstacles.map((obstacle) => ({ ...obstacle })),
    getPlayer: () => ({ x: player.position.x, y: player.position.y, z: player.position.z }),
    setPlayer: (x: number, z: number) => {
      player.position.set(x, heightAt(x, z) + 2.2, z);
      player.velocity.set(0, 0, 0);
    },
    attemptMove: (x: number, z: number) => {
      collisionWorld.resolveMove(player.position, new THREE.Vector3(x, 0, z));
      player.position.y = heightAt(player.position.x, player.position.z) + 2.2;
      return { x: player.position.x, z: player.position.z };
    },
    isBlockedAt: collisionWorld.isBlockedAt,
    terrainHeightAt: heightAt,
  };
}

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
window.addEventListener("pointerdown", () => {
  dragging = true;
});
window.addEventListener("pointerup", () => {
  dragging = false;
});
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
  collisionWorld.resolveMove(player.position, player.velocity.clone().multiplyScalar(delta));
  player.position.y = heightAt(player.position.x, player.position.z) + 2.2;
  footsteps.walk(player.position, delta);

  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function animate(): void {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (isDemo) prDemo.update(elapsed, delta);
  else updateExploration(delta);

  footsteps.update(delta);
  sky.update(elapsed);
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
