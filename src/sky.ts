import * as THREE from "three";
import { normalizePlanetCoords, planetFrameAt, PLANET_RADIUS, type LocalPlanetPoint } from "./planet";

export type SkyDebugState = {
  longitude: number;
  latitude: number;
  sunDot: number;
  dayAmount: number;
  twilightAmount: number;
  localUpX: number;
  localUpY: number;
  localUpZ: number;
  sunDirectionX: number;
  sunDirectionY: number;
  sunDirectionZ: number;
  regionA: number;
  regionB: number;
  horizonTint: number;
  celestialYaw: number;
  celestialAltitude: number;
  ringTilt: number;
  ringAltitude: number;
  ringSpinOffset: number;
  meteorYaw: number;
  meteorRadiantAltitude: number;
  dayHorizonHex: number;
  nightHorizonHex: number;
};

type SkyLocationState = SkyDebugState & {
  frame: ReturnType<typeof planetFrameAt>;
  sunDirection: THREE.Vector3;
  antiSunDirection: THREE.Vector3;
};

export function createSkySystem(
  scene: THREE.Scene,
  camera: THREE.Camera,
  isDemo: boolean
): { update: (elapsed: number, location?: LocalPlanetPoint, templeInfluence?: number) => void; getDebugState: () => SkyDebugState } {
  const dayBackgroundColour = new THREE.Color(0x5d91ff);
  const nightBackgroundColour = new THREE.Color(0x171044);
  const dayFogColour = new THREE.Color(0x74e7ff);
  const dayFogAccentColour = new THREE.Color(0xff9ad6);
  const nightFogColour = new THREE.Color(0x251652);
  const nightFogAccentColour = new THREE.Color(0x6d4ee8);
  const activeFogColour = dayFogColour.clone();
  const templeBackgroundColour = new THREE.Color(0x2affd2);
  const templeFogColour = new THREE.Color(0xff67e7);
  const templeHorizonColour = new THREE.Color(0xe8ff72);
  const templeMiddleColour = new THREE.Color(0x5effd2);
  const templeUpperColour = new THREE.Color(0xba72ff);
  const templeZenithColour = new THREE.Color(0x321066);
  const worldFog = new THREE.FogExp2(activeFogColour.getHex(), 0.02);
  scene.background = dayBackgroundColour.clone();
  scene.fog = worldFog;
  let locationState = getSkyLocationState({ x: 0, z: 24 }, 0, isDemo);

  const hemi = new THREE.HemisphereLight(0xf2e9c8, 0x4e4671, 0.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd8a3, 0.22);
  sun.position.set(-24, 42, 16);
  scene.add(sun);

  const moon = new THREE.DirectionalLight(0xb6c5ff, 0.12);
  moon.position.set(30, 15, -20);
  scene.add(moon);

  const skyAnchor = new THREE.Group();
  skyAnchor.name = "camera-anchored-sky";
  scene.add(skyAnchor);

  const skyUniforms = {
    dayAmount: { value: 1 },
    twilightAmount: { value: 0 },
    templeInfluence: { value: 0 },
    localUp: { value: new THREE.Vector3(0, 1, 0) },
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    dayHorizonColour: { value: new THREE.Color(0xff9fd0) },
    dayMiddleColour: { value: new THREE.Color(0x78d2ff) },
    dayUpperColour: { value: new THREE.Color(0x6393ff) },
    dayZenithColour: { value: new THREE.Color(0x705ed8) },
    nightHorizonColour: { value: new THREE.Color(0x7d55b4) },
    nightMiddleColour: { value: new THREE.Color(0x2d3f9b) },
    nightUpperColour: { value: new THREE.Color(0x1d236f) },
    nightZenithColour: { value: new THREE.Color(0x120d35) },
  };

  skyAnchor.add(makeSkyDome(skyUniforms));

  const skyRing = new THREE.Mesh(
    new THREE.TorusGeometry(42, 0.06, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xffd37e })
  );
  skyRing.position.set(0, 30, -20);
  skyRing.rotation.x = Math.PI / 2.7;
  skyAnchor.add(skyRing);

  const celestialGroup = new THREE.Group();
  skyAnchor.add(celestialGroup);
  celestialBodies.forEach((body, index) => addCelestialBody(celestialGroup, camera, body, index));
  const starField = createStarField();
  skyAnchor.add(starField.points);
  const meteorField = createMeteorField(camera, isDemo);
  skyAnchor.add(meteorField.group);

  return {
    update: (elapsed, location = { x: 0, z: 24 }, templeInfluence = 0) => {
      locationState = getSkyLocationState(location, elapsed, isDemo);
      skyAnchor.position.copy(camera.position);
      const dayAmount = locationState.dayAmount;
      const nightAmount = 1 - THREE.MathUtils.smoothstep(dayAmount, 0.08, 0.36);
      const phaseAmount = THREE.MathUtils.clamp(templeInfluence, 0, 0.72);
      skyUniforms.dayAmount.value = THREE.MathUtils.clamp(dayAmount + phaseAmount * 0.16, 0, 1);
      skyUniforms.twilightAmount.value = locationState.twilightAmount;
      skyUniforms.templeInfluence.value = phaseAmount;
      skyUniforms.localUp.value.copy(locationState.frame.up);
      skyUniforms.sunDirection.value.copy(locationState.sunDirection);

      updateSkyPalette(skyUniforms, locationState);
      phaseSkyUniform(skyUniforms.dayHorizonColour.value, templeHorizonColour, phaseAmount);
      phaseSkyUniform(skyUniforms.dayMiddleColour.value, templeMiddleColour, phaseAmount);
      phaseSkyUniform(skyUniforms.dayUpperColour.value, templeUpperColour, phaseAmount);
      phaseSkyUniform(skyUniforms.dayZenithColour.value, templeZenithColour, phaseAmount);

      const locationDayBackground = dayBackgroundColour.clone().lerp(new THREE.Color(0x67ffc1), locationState.horizonTint * 0.14);
      const locationNightBackground = nightBackgroundColour.clone().lerp(new THREE.Color(0x2a2464), locationState.regionB * 0.22);
      (scene.background as THREE.Color).copy(locationNightBackground).lerp(locationDayBackground, dayAmount);
      (scene.background as THREE.Color).lerp(templeBackgroundColour, phaseAmount * 0.38);
      const fogPulse = Math.sin(elapsed * 0.16) * 0.5 + 0.5;
      const dayFog = dayFogColour
        .clone()
        .lerp(new THREE.Color(0x9bffd5), locationState.horizonTint * 0.22)
        .lerp(dayFogAccentColour, fogPulse * 0.32);
      const nightFog = nightFogColour
        .clone()
        .lerp(new THREE.Color(0x5c2b7b), locationState.regionA * 0.2)
        .lerp(nightFogAccentColour, fogPulse * 0.42);
      worldFog.color.copy(nightFog).lerp(dayFog, dayAmount);
      worldFog.color.lerp(templeFogColour, phaseAmount * 0.46);
      worldFog.density =
        THREE.MathUtils.lerp(0.031, 0.022, dayAmount) +
        locationState.twilightAmount * 0.003 +
        fogPulse * 0.0025;

      hemi.intensity = THREE.MathUtils.lerp(0.14, 0.35, dayAmount);
      sun.intensity = THREE.MathUtils.lerp(0.04, 0.22, dayAmount);
      moon.intensity = THREE.MathUtils.lerp(0.18, 0.08, dayAmount);

      updateSkyRing(skyRing, locationState, elapsed);
      celestialGroup.children.forEach((child, index) => updateCelestialBody(child, camera, celestialBodies[index], index, locationState, elapsed));
      starField.update(nightAmount, phaseAmount);
      meteorField.update(elapsed, nightAmount, locationState);
    },
    getDebugState: () => ({ ...locationState }),
  };
}

function phaseSkyUniform(target: THREE.Color, phased: THREE.Color, amount: number): void {
  target.lerp(phased, amount);
}

function getSkyLocationState(location: LocalPlanetPoint, elapsed: number, isDemo: boolean): SkyLocationState {
  const normalized = normalizePlanetCoords(location.x, location.z);
  const longitude = normalized.x / PLANET_RADIUS;
  const latitude = normalized.z / PLANET_RADIUS;
  const frame = planetFrameAt(normalized.x, normalized.z);
  const sunDirection = getSunDirection(elapsed, isDemo);
  const sunState = getLocationDayState(frame, sunDirection);
  const antiSunDirection = sunDirection.clone().multiplyScalar(-1);
  const regionA = Math.sin(longitude * 1.35 + latitude * 0.9) * 0.5 + 0.5;
  const regionB = Math.sin(longitude * 0.7 - latitude * 1.6 + Math.cos(longitude * 1.1)) * 0.5 + 0.5;
  const horizonTint = Math.cos(latitude * 2.2 - longitude * 0.45) * 0.5 + 0.5;
  const firstCelestialDirection = celestialBodies[0].direction;
  const celestialAzimuth = localAzimuth(firstCelestialDirection, frame);
  const celestialAltitude = firstCelestialDirection.dot(frame.up);
  const ringAltitude = ringDirection.dot(frame.up);
  const meteorRadiantAltitude = antiSunDirection.dot(frame.up);

  const dayHorizon = new THREE.Color(0xff9fd0).lerp(new THREE.Color(0xffc67a), horizonTint * 0.34);
  const nightHorizon = new THREE.Color(0x7d55b4).lerp(new THREE.Color(0x4bc4ce), regionB * 0.26);

  return {
    longitude,
    latitude,
    sunDot: sunState.sunDot,
    dayAmount: sunState.dayAmount,
    twilightAmount: sunState.twilightAmount,
    localUpX: frame.up.x,
    localUpY: frame.up.y,
    localUpZ: frame.up.z,
    sunDirectionX: sunDirection.x,
    sunDirectionY: sunDirection.y,
    sunDirectionZ: sunDirection.z,
    regionA,
    regionB,
    horizonTint,
    celestialYaw: celestialAzimuth,
    celestialAltitude,
    ringTilt: localAzimuth(ringDirection, frame),
    ringAltitude,
    ringSpinOffset: THREE.MathUtils.lerp(-0.55, 0.55, regionB),
    meteorYaw: localAzimuth(antiSunDirection, frame),
    meteorRadiantAltitude,
    dayHorizonHex: dayHorizon.getHex(),
    nightHorizonHex: nightHorizon.getHex(),
    frame,
    sunDirection,
    antiSunDirection,
  };
}

function getLocationDayState(
  frame: ReturnType<typeof planetFrameAt>,
  sunDirection: THREE.Vector3
): { sunDot: number; dayAmount: number; twilightAmount: number } {
  const sunDot = THREE.MathUtils.clamp(frame.up.dot(sunDirection), -1, 1);
  const dayAmount = THREE.MathUtils.smoothstep(sunDot, -0.16, 0.28);
  const twilightAmount = 1 - THREE.MathUtils.smoothstep(Math.abs(sunDot), 0.04, 0.28);
  return { sunDot, dayAmount, twilightAmount };
}

function localAzimuth(direction: THREE.Vector3, frame: ReturnType<typeof planetFrameAt>): number {
  return Math.atan2(direction.dot(frame.east), direction.dot(frame.localZ));
}

function getSunDirection(elapsed: number, isDemo: boolean): THREE.Vector3 {
  const cycleLength = isDemo ? 18 : 96;
  const phase = (elapsed / cycleLength + 0.18) % 1;
  const angle = phase * Math.PI * 2;
  return new THREE.Vector3(Math.sin(angle), Math.cos(angle), Math.sin(angle * 0.37) * 0.22).normalize();
}

function updateSkyPalette(skyUniforms: Record<string, { value: number | THREE.Color | THREE.Vector3 }>, state: SkyDebugState): void {
  ((skyUniforms.dayHorizonColour.value as THREE.Color)).set(0xff9fd0).lerp(new THREE.Color(0xffc67a), state.horizonTint * 0.34);
  ((skyUniforms.dayMiddleColour.value as THREE.Color)).set(0x78d2ff).lerp(new THREE.Color(0x90ffca), state.regionA * 0.2);
  ((skyUniforms.dayUpperColour.value as THREE.Color)).set(0x6393ff).lerp(new THREE.Color(0x8f75ff), state.regionB * 0.16);
  ((skyUniforms.dayZenithColour.value as THREE.Color)).set(0x705ed8).lerp(new THREE.Color(0x4fd0ff), state.regionA * 0.14);
  ((skyUniforms.nightHorizonColour.value as THREE.Color)).set(0x7d55b4).lerp(new THREE.Color(0x4bc4ce), state.regionB * 0.26);
  ((skyUniforms.nightMiddleColour.value as THREE.Color)).set(0x2d3f9b).lerp(new THREE.Color(0x572e88), state.horizonTint * 0.18);
  ((skyUniforms.nightUpperColour.value as THREE.Color)).set(0x1d236f).lerp(new THREE.Color(0x203c72), state.regionA * 0.16);
  ((skyUniforms.nightZenithColour.value as THREE.Color)).set(0x120d35).lerp(new THREE.Color(0x231247), state.regionB * 0.2);
}

function makeSkyDome(skyUniforms: Record<string, { value: number | THREE.Color | THREE.Vector3 }>): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(3600, 24, 14);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vWorldDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDirection;
      uniform float dayAmount;
      uniform float twilightAmount;
      uniform float templeInfluence;
      uniform vec3 localUp;
      uniform vec3 sunDirection;
      uniform vec3 dayHorizonColour;
      uniform vec3 dayMiddleColour;
      uniform vec3 dayUpperColour;
      uniform vec3 dayZenithColour;
      uniform vec3 nightHorizonColour;
      uniform vec3 nightMiddleColour;
      uniform vec3 nightUpperColour;
      uniform vec3 nightZenithColour;

      void main() {
        vec3 direction = normalize(vWorldDirection);
        float upDot = dot(direction, normalize(localUp));
        float height = clamp(upDot * 0.5 + 0.5, 0.0, 1.0);
        float sunDot = max(dot(direction, normalize(sunDirection)), 0.0);

        vec3 horizonColour = mix(nightHorizonColour, dayHorizonColour, dayAmount);
        vec3 middleColour = mix(nightMiddleColour, dayMiddleColour, dayAmount);
        vec3 upperColour = mix(nightUpperColour, dayUpperColour, dayAmount);
        vec3 zenithColour = mix(nightZenithColour, dayZenithColour, dayAmount);

        vec3 sky = mix(horizonColour, middleColour, smoothstep(0.16, 0.52, height));
        sky = mix(sky, upperColour, smoothstep(0.42, 0.78, height));
        sky = mix(sky, zenithColour, smoothstep(0.68, 1.0, height));

        float horizonGlow = (1.0 - smoothstep(0.04, 0.28, abs(upDot))) * twilightAmount;
        sky = mix(sky, vec3(1.0, 0.52, 0.82), horizonGlow * 0.22);
        sky += vec3(1.0, 0.76, 0.42) * pow(sunDot, 10.0) * (0.18 + dayAmount * 0.28);
        sky += vec3(0.42, 1.0, 0.88) * templeInfluence * (0.08 + horizonGlow * 0.16);

        float grain = fract(sin(dot(direction.xy + direction.zz, vec2(43.31, 19.17))) * 14758.5453);
        sky += (grain - 0.5) * 0.018;
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  return new THREE.Mesh(geometry, material);
}

type CelestialBody = {
  direction: THREE.Vector3;
  radius: number;
  colour: number;
  halo: number;
  ring?: boolean;
};

type MeteorPath = {
  lateral: number;
  lift: number;
  drift: number;
  size: number;
  colour: number;
  glow: number;
  offset: number;
};

const skyShellDistance = 132;
const ringDirection = stableDirection(0.34, 0.56);

const celestialBodies: CelestialBody[] = [
  { direction: stableDirection(-0.86, 0.5), radius: 8.4, colour: 0xff75c9, halo: 0x57225d, ring: true },
  { direction: stableDirection(-0.42, -0.12), radius: 3.6, colour: 0xb8f7ff, halo: 0x265b7b },
  { direction: stableDirection(0.08, 0.72), radius: 5.8, colour: 0xf6ee9d, halo: 0x6f5428, ring: true },
  { direction: stableDirection(0.48, 0.04), radius: 2.8, colour: 0x94ffca, halo: 0x21584c },
  { direction: stableDirection(0.9, 0.32), radius: 4.4, colour: 0xca96ff, halo: 0x3f2a70 },
  { direction: stableDirection(1.32, -0.24), radius: 2.3, colour: 0xffb183, halo: 0x6d352c },
  { direction: stableDirection(1.72, 0.84), radius: 6.9, colour: 0x83d3ff, halo: 0x223a75, ring: true },
  { direction: stableDirection(2.24, -0.02), radius: 3.2, colour: 0xfff4c8, halo: 0x66552c },
  { direction: stableDirection(2.78, 0.48), radius: 4.9, colour: 0xff8ba7, halo: 0x66284a },
  { direction: stableDirection(3.3, -0.1), radius: 2.6, colour: 0x91ffe8, halo: 0x1c5d60 },
  { direction: stableDirection(3.86, 0.68), radius: 7.6, colour: 0xf79bff, halo: 0x4c2266, ring: true },
  { direction: stableDirection(4.42, 0.08), radius: 3.1, colour: 0xffdf74, halo: 0x6b521e },
];

function stableDirection(longitude: number, latitude: number): THREE.Vector3 {
  const cosLatitude = Math.cos(latitude);
  return new THREE.Vector3(Math.sin(longitude) * cosLatitude, Math.cos(longitude) * cosLatitude, Math.sin(latitude)).normalize();
}

function addCelestialBody(celestialGroup: THREE.Group, camera: THREE.Camera, body: CelestialBody, index: number): void {
  const group = new THREE.Group();
  group.position.copy(body.direction).multiplyScalar(skyShellDistance);

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

function updateCelestialBody(
  child: THREE.Object3D,
  camera: THREE.Camera,
  body: CelestialBody,
  index: number,
  state: SkyLocationState,
  elapsed: number
): void {
  const altitudeFade = THREE.MathUtils.smoothstep(body.direction.dot(state.frame.up), -0.2, 0.18);
  const prominence = 0.9 + (Math.sin(state.longitude * 1.7 + state.latitude * 1.1 + index * 2.13) * 0.5 + 0.5) * 0.22;
  child.position.copy(body.direction).multiplyScalar(skyShellDistance + (index % 3) * 4);
  child.scale.setScalar(prominence * THREE.MathUtils.lerp(0.64, 1.12, altitudeFade));
  child.visible = altitudeFade > 0.03;
  child.lookAt(camera.position);
  child.rotation.z += Math.sin(elapsed * 0.12 + index) * 0.0008;
}

function updateSkyRing(skyRing: THREE.Mesh, state: SkyLocationState, elapsed: number): void {
  skyRing.position.copy(ringDirection).multiplyScalar(150);
  skyRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringDirection);
  skyRing.rotateZ(elapsed * 0.035 + state.ringSpinOffset);
  skyRing.visible = ringDirection.dot(state.frame.up) > -0.16;
}

function createStarField(): { points: THREE.Points; update: (nightAmount: number, templeInfluence: number) => void } {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < 96; index += 1) {
    const y = 1 - (index / 95) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = index * goldenAngle;
    positions.push(Math.cos(theta) * radius * 170, y * 170, Math.sin(theta) * radius * 170);
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xe9fff7,
    transparent: true,
    opacity: 0,
    size: 2.4,
    sizeAttenuation: false,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "stable-celestial-star-field";

  return {
    points,
    update: (nightAmount, templeInfluence) => {
      material.opacity = THREE.MathUtils.clamp(nightAmount * 0.72 + templeInfluence * 0.18, 0, 0.86);
      points.visible = material.opacity > 0.02;
    },
  };
}

function createMeteorField(camera: THREE.Camera, isDemo: boolean): { group: THREE.Group; update: (elapsed: number, nightAmount: number, state: SkyLocationState) => void } {
  const group = new THREE.Group();
  const period = isDemo ? 7.2 : 23;
  const duration = isDemo ? 2.4 : 2.9;
  const paths: MeteorPath[] = [
    {
      lateral: -0.48,
      lift: 0.28,
      drift: 0.46,
      size: 2.15,
      colour: 0xfff6b0,
      glow: 0xff78d2,
      offset: 1.0,
    },
    {
      lateral: 0.36,
      lift: 0.16,
      drift: -0.38,
      size: 1.2,
      colour: 0xa8fff2,
      glow: 0x7c7dff,
      offset: 4.4,
    },
    {
      lateral: 0.12,
      lift: 0.36,
      drift: 0.52,
      size: 1.18,
      colour: 0xffcaf5,
      glow: 0x89d6ff,
      offset: 7.8,
    },
    {
      lateral: -0.18,
      lift: 0.44,
      drift: -0.5,
      size: 1.08,
      colour: 0xffec83,
      glow: 0xff85aa,
      offset: 11.5,
    },
  ];
  const meteors = paths.map((path) => {
    const meteor = makeMeteor(path);
    group.add(meteor);
    return { path, meteor };
  });

  return {
    group,
    update: (elapsed, nightAmount, state) => {
      group.visible = nightAmount > 0.02;
      meteors.forEach(({ path, meteor }) => {
        const phase = (elapsed + path.offset) % period;
        const activeAmount = phase <= duration ? 1 : 0;
        const progress = THREE.MathUtils.clamp(phase / duration, 0, 1);
        const easedProgress = THREE.MathUtils.smoothstep(progress, 0, 1);
        const { start, end } = meteorPathVectors(path, state);
        const radiantAltitude = start.clone().normalize().dot(state.frame.up);
        const horizonFade = THREE.MathUtils.smoothstep(radiantAltitude, -0.08, 0.28);
        const fade = activeAmount * nightAmount * horizonFade * Math.sin(progress * Math.PI);
        meteor.visible = fade > 0.015;
        meteor.position.lerpVectors(start, end, easedProgress);
        meteor.lookAt(camera.position);
        alignMeteorToTravel(meteor, start, end, camera);
        meteor.scale.setScalar(path.size * (0.84 + progress * 0.24));
        meteor.children.forEach((child) => {
          const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          material.opacity = fade * ((child.userData.opacityWeight as number | undefined) ?? 0.86);
        });
      });
    },
  };
}

function meteorPathVectors(path: MeteorPath, state: SkyLocationState): { start: THREE.Vector3; end: THREE.Vector3 } {
  const east = state.frame.east;
  const north = state.frame.localZ;
  const base = state.antiSunDirection.clone().multiplyScalar(0.92).add(state.frame.up.clone().multiplyScalar(path.lift));
  const startDirection = base.clone().add(east.clone().multiplyScalar(path.lateral)).add(north.clone().multiplyScalar(path.drift * 0.18)).normalize();
  const endDirection = base.clone().add(east.clone().multiplyScalar(path.lateral + path.drift)).add(north.clone().multiplyScalar(-0.32)).normalize();
  return {
    start: startDirection.multiplyScalar(skyShellDistance),
    end: endDirection.multiplyScalar(skyShellDistance),
  };
}

function alignMeteorToTravel(meteor: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, camera: THREE.Camera): void {
  const currentWorld = meteor.getWorldPosition(new THREE.Vector3());
  const current = currentWorld.clone().project(camera);
  const ahead = currentWorld.clone().add(end.clone().sub(start).setLength(6)).project(camera);
  const screenTravel = ahead.sub(current);
  if (screenTravel.lengthSq() < 0.000001) return;
  meteor.rotateZ(Math.atan2(screenTravel.y, screenTravel.x));
}

function makeMeteor(path: MeteorPath): THREE.Group {
  const meteor = new THREE.Group();
  const tailLength = 15;
  addMeteorPart(meteor, new THREE.CircleGeometry(3.4, 12), path.glow, 0.36, tailLength * 0.33, 0, 0.92);
  const head = addMeteorPart(meteor, new THREE.CircleGeometry(1.24, 4), path.colour, 1, tailLength * 0.42, 0, 1);
  head.rotation.z = Math.PI / 4;
  addMeteorPart(meteor, new THREE.CircleGeometry(0.56, 8), 0xffffff, 0.98, tailLength * 0.42, 0, 1.02);

  const fin = addMeteorPart(meteor, new THREE.CircleGeometry(0.78, 3), path.glow, 0.88, tailLength * 0.18, -0.58, 0.96);
  fin.rotation.z = -0.2;

  const beadColours = [path.glow, path.colour, 0xffffff, path.glow, path.colour, path.glow];
  beadColours.forEach((colour, index) => {
    const t = index / (beadColours.length - 1);
    const x = THREE.MathUtils.lerp(tailLength * 0.04, -tailLength * 0.72, t);
    const y = Math.sin(t * Math.PI * 1.35) * 0.72 - t * 0.28;
    const radius = THREE.MathUtils.lerp(0.5, 0.18, t);
    addMeteorPart(meteor, new THREE.CircleGeometry(radius, index % 2 === 0 ? 7 : 4), colour, 0.96 - t * 0.34, x, y, 0.8 - t * 0.18);
  });

  [
    [-tailLength * 0.22, 0.96, 0.3, path.colour],
    [-tailLength * 0.48, -0.82, 0.24, path.glow],
    [-tailLength * 0.66, 0.46, 0.2, 0xffffff],
  ].forEach(([x, y, radius, colour]) => {
    addMeteorPart(meteor, new THREE.CircleGeometry(radius, 5), colour, 0.78, x, y, 0.62);
  });

  return meteor;
}

function addMeteorPart(
  meteor: THREE.Group,
  geometry: THREE.BufferGeometry,
  colour: number,
  opacityWeight: number,
  x: number,
  y: number,
  scaleY: number
): THREE.Mesh {
  const part = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  part.position.set(x, y, 0);
  part.scale.y = scaleY;
  part.userData.opacityWeight = opacityWeight;
  meteor.add(part);
  return part;
}
