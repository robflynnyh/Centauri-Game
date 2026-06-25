import * as THREE from "three";
import { normalizePlanetCoords, planetFrameAt, PLANET_RADIUS, type LocalPlanetPoint } from "./planet";

type PlanetFrameSnapshot = ReturnType<typeof planetFrameAt>;

export type SkyDebugState = {
  longitude: number;
  latitude: number;
  planetSpinPhase: number;
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
  patternedStarClusters: number;
  patternedStarCloudBands: number;
  patternedStarGlints: number;
  patternedStarNorthernFeatures: number;
  patternedStarSouthernFeatures: number;
  patternedStarMinLatitude: number;
  patternedStarMaxLatitude: number;
  patternedStars: number;
  starVisibility: number;
};

type SkyLocationState = SkyDebugState & {
  frame: PlanetFrameSnapshot;
  spunFrame: PlanetFrameSnapshot;
  sunDirection: THREE.Vector3;
  antiSunDirection: THREE.Vector3;
  stableSunDirection: THREE.Vector3;
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
  const locationDayBackgroundAccent = new THREE.Color(0x67ffc1);
  const locationNightBackgroundAccent = new THREE.Color(0x2a2464);
  const dayFogLocationAccent = new THREE.Color(0x9bffd5);
  const nightFogLocationAccent = new THREE.Color(0x5c2b7b);
  const locationDayBackground = new THREE.Color();
  const locationNightBackground = new THREE.Color();
  const dayFog = new THREE.Color();
  const nightFog = new THREE.Color();
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
  skyAnchor.add(starField.group);
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

      locationDayBackground.copy(dayBackgroundColour).lerp(locationDayBackgroundAccent, locationState.horizonTint * 0.14);
      locationNightBackground.copy(nightBackgroundColour).lerp(locationNightBackgroundAccent, locationState.regionB * 0.22);
      (scene.background as THREE.Color).copy(locationNightBackground).lerp(locationDayBackground, dayAmount);
      (scene.background as THREE.Color).lerp(templeBackgroundColour, phaseAmount * 0.38);
      const fogPulse = Math.sin(elapsed * 0.16) * 0.5 + 0.5;
      dayFog
        .copy(dayFogColour)
        .lerp(dayFogLocationAccent, locationState.horizonTint * 0.22)
        .lerp(dayFogAccentColour, fogPulse * 0.32);
      nightFog
        .copy(nightFogColour)
        .lerp(nightFogLocationAccent, locationState.regionA * 0.2)
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
      starField.update(elapsed, nightAmount, phaseAmount, locationState);
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
  const planetSpinPhase = getPlanetSpinPhase(elapsed, isDemo);
  const frame = planetFrameAt(normalized.x, normalized.z);
  const spunFrame = planetFrameAt(normalized.x + planetSpinPhase * PLANET_RADIUS, normalized.z);
  const stableSunDirection = getSunDirection();
  const sunDirection = apparentSkyDirection(stableSunDirection, frame, spunFrame, skyLocationSunDirection);
  const sunState = getLocationDayState(spunFrame, stableSunDirection);
  const antiSunDirection = skyLocationAntiSunDirection.copy(sunDirection).multiplyScalar(-1);
  const regionA = Math.sin(longitude * 1.35 + latitude * 0.9) * 0.5 + 0.5;
  const regionB = Math.sin(longitude * 0.7 - latitude * 1.6 + Math.cos(longitude * 1.1)) * 0.5 + 0.5;
  const horizonTint = Math.cos(latitude * 2.2 - longitude * 0.45) * 0.5 + 0.5;
  const firstCelestialDirection = apparentSkyDirection(celestialBodies[0].direction, frame, spunFrame, skyLocationCelestialDirection);
  const celestialAzimuth = localAzimuth(firstCelestialDirection, frame);
  const celestialAltitude = firstCelestialDirection.dot(frame.up);
  const apparentRingDirection = apparentSkyDirection(ringDirection, frame, spunFrame, skyLocationRingDirection);
  const ringAltitude = apparentRingDirection.dot(frame.up);
  const meteorRadiantAltitude = antiSunDirection.dot(frame.up);

  const dayHorizonHex = skyColourScratchA.set(0xff9fd0).lerp(skyPaletteDayHorizonAccent, horizonTint * 0.34).getHex();
  const nightHorizonHex = skyColourScratchB.set(0x7d55b4).lerp(skyPaletteNightHorizonAccent, regionB * 0.26).getHex();

  return {
    longitude,
    latitude,
    planetSpinPhase,
    sunDot: sunState.sunDot,
    dayAmount: sunState.dayAmount,
    twilightAmount: sunState.twilightAmount,
    localUpX: spunFrame.up.x,
    localUpY: spunFrame.up.y,
    localUpZ: spunFrame.up.z,
    sunDirectionX: sunDirection.x,
    sunDirectionY: sunDirection.y,
    sunDirectionZ: sunDirection.z,
    regionA,
    regionB,
    horizonTint,
    celestialYaw: celestialAzimuth,
    celestialAltitude,
    ringTilt: localAzimuth(apparentRingDirection, frame),
    ringAltitude,
    ringSpinOffset: THREE.MathUtils.lerp(-0.55, 0.55, regionB),
    meteorYaw: localAzimuth(antiSunDirection, frame),
    meteorRadiantAltitude,
    dayHorizonHex,
    nightHorizonHex,
    patternedStarClusters: starClusters.length,
    patternedStarCloudBands: starCloudBands.length,
    patternedStarGlints: patternedStars.filter((star) => (star.glow ?? 0) > 0).length,
    patternedStarNorthernFeatures: starCoverage.northernFeatures,
    patternedStarSouthernFeatures: starCoverage.southernFeatures,
    patternedStarMinLatitude: starCoverage.minLatitude,
    patternedStarMaxLatitude: starCoverage.maxLatitude,
    patternedStars: patternedStars.length,
    starVisibility: 0,
    frame,
    spunFrame,
    sunDirection,
    antiSunDirection,
    stableSunDirection,
  };
}

function getLocationDayState(
  frame: PlanetFrameSnapshot,
  sunDirection: THREE.Vector3
): { sunDot: number; dayAmount: number; twilightAmount: number } {
  const sunDot = THREE.MathUtils.clamp(frame.up.dot(sunDirection), -1, 1);
  const dayAmount = THREE.MathUtils.smoothstep(sunDot, -0.16, 0.28);
  const twilightAmount = 1 - THREE.MathUtils.smoothstep(Math.abs(sunDot), 0.04, 0.28);
  return { sunDot, dayAmount, twilightAmount };
}

function localAzimuth(direction: THREE.Vector3, frame: PlanetFrameSnapshot): number {
  return Math.atan2(direction.dot(frame.east), direction.dot(frame.localZ));
}

const fullTurn = Math.PI * 2;
const spinPhaseOffset = 0.18;
const stableSunLongitude = spinPhaseOffset * fullTurn * 2;
const stableSunLatitude = 0.1;
const stableSunDirectionVector = stableDirection(stableSunLongitude, stableSunLatitude);
const skyLocationSunDirection = new THREE.Vector3();
const skyLocationAntiSunDirection = new THREE.Vector3();
const skyLocationCelestialDirection = new THREE.Vector3();
const skyLocationRingDirection = new THREE.Vector3();
const skyColourScratchA = new THREE.Color();
const skyColourScratchB = new THREE.Color();
const skyPaletteDayHorizonAccent = new THREE.Color(0xffc67a);
const skyPaletteDayMiddleAccent = new THREE.Color(0x90ffca);
const skyPaletteDayUpperAccent = new THREE.Color(0x8f75ff);
const skyPaletteDayZenithAccent = new THREE.Color(0x4fd0ff);
const skyPaletteNightHorizonAccent = new THREE.Color(0x4bc4ce);
const skyPaletteNightMiddleAccent = new THREE.Color(0x572e88);
const skyPaletteNightUpperAccent = new THREE.Color(0x203c72);
const skyPaletteNightZenithAccent = new THREE.Color(0x231247);
const apparentSkySpunBasis = new THREE.Matrix4();
const apparentSkyFrameBasis = new THREE.Matrix4();
const apparentSkyQuaternionScratch = new THREE.Quaternion();
const skyForwardDirection = new THREE.Vector3(0, 0, 1);
const celestialApparentDirection = new THREE.Vector3();
const ringApparentDirection = new THREE.Vector3();
const meteorStartScratch = new THREE.Vector3();
const meteorEndScratch = new THREE.Vector3();
const meteorBaseScratch = new THREE.Vector3();
const meteorTravelScratch = new THREE.Vector3();
const meteorWorldScratch = new THREE.Vector3();
const meteorScreenCurrentScratch = new THREE.Vector3();
const meteorScreenAheadScratch = new THREE.Vector3();

export function getPlanetSpinPhase(elapsed: number, isDemo: boolean): number {
  const cycleLength = isDemo ? 18 : 96;
  return ((elapsed / cycleLength + spinPhaseOffset) % 1) * fullTurn;
}

export function getSunFacingLongitude(elapsed: number, isDemo: boolean): number {
  return THREE.MathUtils.euclideanModulo(stableSunLongitude - getPlanetSpinPhase(elapsed, isDemo) + Math.PI, fullTurn) - Math.PI;
}

function getSunDirection(): THREE.Vector3 {
  return stableSunDirectionVector;
}

function apparentSkyDirection(
  direction: THREE.Vector3,
  frame: PlanetFrameSnapshot,
  spunFrame: PlanetFrameSnapshot,
  target = new THREE.Vector3()
): THREE.Vector3 {
  return target
    .copy(frame.east)
    .multiplyScalar(direction.dot(spunFrame.east))
    .addScaledVector(frame.up, direction.dot(spunFrame.up))
    .addScaledVector(frame.localZ, direction.dot(spunFrame.localZ))
    .normalize();
}

function apparentSkyQuaternion(state: SkyLocationState): THREE.Quaternion {
  apparentSkySpunBasis.makeBasis(state.spunFrame.east, state.spunFrame.up, state.spunFrame.localZ);
  apparentSkyFrameBasis.makeBasis(state.frame.east, state.frame.up, state.frame.localZ);
  return apparentSkyQuaternionScratch.setFromRotationMatrix(apparentSkyFrameBasis.multiply(apparentSkySpunBasis.invert()));
}

function updateSkyPalette(skyUniforms: Record<string, { value: number | THREE.Color | THREE.Vector3 }>, state: SkyDebugState): void {
  (skyUniforms.dayHorizonColour.value as THREE.Color).set(0xff9fd0).lerp(skyPaletteDayHorizonAccent, state.horizonTint * 0.34);
  (skyUniforms.dayMiddleColour.value as THREE.Color).set(0x78d2ff).lerp(skyPaletteDayMiddleAccent, state.regionA * 0.2);
  (skyUniforms.dayUpperColour.value as THREE.Color).set(0x6393ff).lerp(skyPaletteDayUpperAccent, state.regionB * 0.16);
  (skyUniforms.dayZenithColour.value as THREE.Color).set(0x705ed8).lerp(skyPaletteDayZenithAccent, state.regionA * 0.14);
  (skyUniforms.nightHorizonColour.value as THREE.Color).set(0x7d55b4).lerp(skyPaletteNightHorizonAccent, state.regionB * 0.26);
  (skyUniforms.nightMiddleColour.value as THREE.Color).set(0x2d3f9b).lerp(skyPaletteNightMiddleAccent, state.horizonTint * 0.18);
  (skyUniforms.nightUpperColour.value as THREE.Color).set(0x1d236f).lerp(skyPaletteNightUpperAccent, state.regionA * 0.16);
  (skyUniforms.nightZenithColour.value as THREE.Color).set(0x120d35).lerp(skyPaletteNightZenithAccent, state.regionB * 0.2);
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

type StarPoint = {
  longitudeOffset: number;
  latitudeOffset: number;
  size: number;
  colour: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  twinkleAmount: number;
  baseOpacity?: number;
  depthOffset?: number;
  glow?: number;
  glowSize?: number;
};

type StarCluster = {
  longitude: number;
  latitude: number;
  points: StarPoint[];
};

const skyShellDistance = 132;
const starShellDistance = 170;
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

const starConstellations: StarCluster[] = [
  {
    longitude: -1.42,
    latitude: 0.38,
    points: [
      { longitudeOffset: -0.035, latitudeOffset: -0.018, size: 2.9, colour: 0xf4fff2, twinkleSpeed: 1.15, twinkleOffset: 0.2, twinkleAmount: 0.3 },
      { longitudeOffset: -0.006, latitudeOffset: 0.006, size: 3.4, colour: 0xfff1c9, twinkleSpeed: 0.82, twinkleOffset: 1.7, twinkleAmount: 0.22 },
      { longitudeOffset: 0.028, latitudeOffset: 0.026, size: 2.4, colour: 0xbffffa, twinkleSpeed: 1.38, twinkleOffset: 3.2, twinkleAmount: 0.26 },
      { longitudeOffset: 0.056, latitudeOffset: 0.008, size: 2.1, colour: 0xffc7f0, twinkleSpeed: 1.03, twinkleOffset: 4.9, twinkleAmount: 0.2 },
      { longitudeOffset: 0.014, latitudeOffset: -0.038, size: 2.0, colour: 0xd9d1ff, twinkleSpeed: 1.25, twinkleOffset: 2.6, twinkleAmount: 0.24 },
    ],
  },
  {
    longitude: -0.18,
    latitude: 0.62,
    points: [
      { longitudeOffset: -0.05, latitudeOffset: 0.0, size: 2.1, colour: 0xc8fff4, twinkleSpeed: 0.76, twinkleOffset: 1.1, twinkleAmount: 0.24 },
      { longitudeOffset: -0.02, latitudeOffset: 0.03, size: 2.7, colour: 0xfff6bb, twinkleSpeed: 1.06, twinkleOffset: 2.5, twinkleAmount: 0.28 },
      { longitudeOffset: 0.018, latitudeOffset: 0.012, size: 2.3, colour: 0xffffff, twinkleSpeed: 1.34, twinkleOffset: 3.3, twinkleAmount: 0.22 },
      { longitudeOffset: 0.048, latitudeOffset: 0.045, size: 2.9, colour: 0xffb8e8, twinkleSpeed: 0.92, twinkleOffset: 4.1, twinkleAmount: 0.2 },
      { longitudeOffset: 0.064, latitudeOffset: -0.006, size: 1.9, colour: 0x9fffe0, twinkleSpeed: 1.18, twinkleOffset: 5.6, twinkleAmount: 0.26 },
    ],
  },
  {
    longitude: 0.88,
    latitude: 0.22,
    points: [
      { longitudeOffset: -0.048, latitudeOffset: 0.034, size: 2.2, colour: 0xfff0a6, twinkleSpeed: 1.28, twinkleOffset: 0.7, twinkleAmount: 0.22 },
      { longitudeOffset: -0.016, latitudeOffset: 0.006, size: 2.6, colour: 0xf8fff6, twinkleSpeed: 0.88, twinkleOffset: 2.0, twinkleAmount: 0.3 },
      { longitudeOffset: 0.018, latitudeOffset: -0.018, size: 2.0, colour: 0xb7d8ff, twinkleSpeed: 1.42, twinkleOffset: 3.8, twinkleAmount: 0.24 },
      { longitudeOffset: 0.052, latitudeOffset: -0.048, size: 2.8, colour: 0xffc6f4, twinkleSpeed: 1.0, twinkleOffset: 5.1, twinkleAmount: 0.2 },
    ],
  },
  {
    longitude: 1.78,
    latitude: 0.72,
    points: [
      { longitudeOffset: -0.036, latitudeOffset: -0.03, size: 2.4, colour: 0xf6ffd9, twinkleSpeed: 0.94, twinkleOffset: 1.4, twinkleAmount: 0.24 },
      { longitudeOffset: -0.006, latitudeOffset: -0.002, size: 3.1, colour: 0xffffff, twinkleSpeed: 1.2, twinkleOffset: 2.9, twinkleAmount: 0.18 },
      { longitudeOffset: 0.03, latitudeOffset: -0.032, size: 2.4, colour: 0xa5fff6, twinkleSpeed: 0.86, twinkleOffset: 4.2, twinkleAmount: 0.28 },
      { longitudeOffset: -0.002, latitudeOffset: 0.038, size: 2.0, colour: 0xe4b9ff, twinkleSpeed: 1.48, twinkleOffset: 5.8, twinkleAmount: 0.22 },
    ],
  },
  {
    longitude: 2.72,
    latitude: 0.18,
    points: [
      { longitudeOffset: -0.052, latitudeOffset: 0.002, size: 2.0, colour: 0xbffff7, twinkleSpeed: 1.08, twinkleOffset: 0.5, twinkleAmount: 0.2 },
      { longitudeOffset: -0.018, latitudeOffset: -0.022, size: 2.7, colour: 0xfff8d4, twinkleSpeed: 1.36, twinkleOffset: 1.9, twinkleAmount: 0.3 },
      { longitudeOffset: 0.012, latitudeOffset: 0.014, size: 2.2, colour: 0xffb7de, twinkleSpeed: 0.8, twinkleOffset: 3.0, twinkleAmount: 0.24 },
      { longitudeOffset: 0.046, latitudeOffset: -0.01, size: 2.8, colour: 0xf7fff0, twinkleSpeed: 1.18, twinkleOffset: 4.8, twinkleAmount: 0.2 },
      { longitudeOffset: 0.074, latitudeOffset: 0.026, size: 1.8, colour: 0x9ddaff, twinkleSpeed: 1.52, twinkleOffset: 6.0, twinkleAmount: 0.26 },
    ],
  },
  {
    longitude: 3.74,
    latitude: 0.52,
    points: [
      { longitudeOffset: -0.04, latitudeOffset: -0.016, size: 2.6, colour: 0xffffff, twinkleSpeed: 0.9, twinkleOffset: 0.0, twinkleAmount: 0.22 },
      { longitudeOffset: -0.012, latitudeOffset: 0.018, size: 2.0, colour: 0xffd3f1, twinkleSpeed: 1.3, twinkleOffset: 1.5, twinkleAmount: 0.24 },
      { longitudeOffset: 0.014, latitudeOffset: -0.01, size: 3.0, colour: 0xe9ffd0, twinkleSpeed: 1.04, twinkleOffset: 2.8, twinkleAmount: 0.28 },
      { longitudeOffset: 0.044, latitudeOffset: 0.02, size: 2.3, colour: 0xb0fff9, twinkleSpeed: 1.46, twinkleOffset: 4.5, twinkleAmount: 0.2 },
    ],
  },
  {
    longitude: 4.82,
    latitude: 0.06,
    points: [
      { longitudeOffset: -0.07, latitudeOffset: 0.02, size: 1.9, colour: 0xaee8ff, twinkleSpeed: 1.38, twinkleOffset: 0.8, twinkleAmount: 0.22 },
      { longitudeOffset: -0.034, latitudeOffset: -0.012, size: 2.5, colour: 0xfff3bf, twinkleSpeed: 0.84, twinkleOffset: 2.1, twinkleAmount: 0.3 },
      { longitudeOffset: 0.0, latitudeOffset: 0.016, size: 2.1, colour: 0xffb7e7, twinkleSpeed: 1.14, twinkleOffset: 3.4, twinkleAmount: 0.24 },
      { longitudeOffset: 0.036, latitudeOffset: -0.02, size: 2.8, colour: 0xf7fff4, twinkleSpeed: 1.0, twinkleOffset: 4.7, twinkleAmount: 0.18 },
      { longitudeOffset: 0.07, latitudeOffset: 0.014, size: 2.0, colour: 0xb7ffd2, twinkleSpeed: 1.56, twinkleOffset: 6.2, twinkleAmount: 0.26 },
    ],
  },
];

const starCloudBands: StarCluster[] = [
  makeStarRibbon(-0.96, 0.56, 1.18, 0.06, 42, [0x78a8ff, 0xc3ddff, 0xeec7ff], 0.3, 12.0),
  makeStarRibbon(0.18, 0.7, 0.92, 0.045, 34, [0x93fff0, 0xf7f1c7, 0xc7adff], 0.24, 16.0),
  makeStarRibbon(1.18, 0.34, 1.04, 0.052, 38, [0xffc5ec, 0xb6f7ff, 0xffef9f], 0.26, 6.0),
  makeStarRibbon(3.42, 0.48, 1.08, 0.056, 36, [0xb5c7ff, 0xf5ffda, 0x9effe8], 0.25, 20.0),
  makeStarRibbon(2.28, 0.84, 1.42, 0.05, 44, [0xf7f4ff, 0x87c8ff, 0xffbfe9], 0.28, 24.0),
  makeStarRibbon(5.18, 0.74, 1.36, 0.058, 42, [0xa8fff0, 0xd5d1ff, 0xfff0a8], 0.27, 18.0),
  makeStarRibbon(-2.78, 0.28, 1.18, 0.05, 34, [0x9fb9ff, 0xffc9f1, 0xc7ffd8], 0.22, 8.0),
  makeStarRibbon(-0.66, -0.5, 1.16, 0.058, 40, [0x8fc6ff, 0xffd2f6, 0xd8ffe4], 0.27, 10.0),
  makeStarRibbon(0.82, -0.76, 1.28, 0.052, 42, [0xf8f3ff, 0x9affee, 0xffe2a8], 0.28, 22.0),
  makeStarRibbon(2.58, -0.36, 1.1, 0.056, 36, [0xb8c4ff, 0xffbde5, 0xcaffff], 0.24, 14.0),
  makeStarRibbon(4.18, -0.84, 1.38, 0.052, 44, [0x91d8ff, 0xfff7c0, 0xdbb6ff], 0.29, 26.0),
  makeStarRibbon(5.48, -0.18, 0.98, 0.046, 30, [0xa8ffdd, 0xd1c2ff, 0xffc7df], 0.21, 4.0),
];

const starDomeGlyphs: StarCluster[] = [
  makeEchoGlyph(-2.94, -0.68, 0xffd7f2, 0),
  makeEchoGlyph(-2.36, -0.32, 0x9fe8ff, 1),
  makeEchoGlyph(-1.78, 0.02, 0xf8f2bd, 2),
  makeEchoGlyph(-1.2, 0.42, 0xc8b4ff, 3),
  makeEchoGlyph(-0.62, 0.72, 0x9affdf, 4),
  makeEchoGlyph(-0.04, -0.78, 0xf7f8ff, 5),
  makeEchoGlyph(0.54, -0.46, 0xffc1e8, 6),
  makeEchoGlyph(1.12, -0.08, 0xa9d4ff, 7),
  makeEchoGlyph(1.7, 0.32, 0xfff0a4, 8),
  makeEchoGlyph(2.28, 0.68, 0xb8ffe8, 9),
  makeEchoGlyph(2.86, -0.72, 0xd9c4ff, 10),
  makeEchoGlyph(3.44, -0.38, 0xffcfef, 11),
  makeEchoGlyph(4.02, 0.08, 0x9ffff2, 12),
  makeEchoGlyph(4.6, 0.5, 0xfff7c6, 13),
  makeEchoGlyph(5.18, -0.14, 0xbfcfff, 14),
  makeEchoGlyph(5.76, 0.82, 0xffbfe3, 15),
];

const starClusters = [...starConstellations, ...starCloudBands, ...starDomeGlyphs];
const patternedStars = starClusters.flatMap((cluster) => cluster.points);
const starCoverage = getStarCoverage(starClusters);

function stableDirection(longitude: number, latitude: number): THREE.Vector3 {
  const cosLatitude = Math.cos(latitude);
  return new THREE.Vector3(Math.sin(longitude) * cosLatitude, Math.cos(longitude) * cosLatitude, Math.sin(latitude)).normalize();
}

function makeStarRibbon(
  longitude: number,
  latitude: number,
  longitudeSpan: number,
  width: number,
  count: number,
  colours: number[],
  opacity: number,
  depthOffset: number
): StarCluster {
  const points: StarPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const centered = t - 0.5;
    const lane = (((index * 7) % 11) - 5) / 5;
    const wave = Math.sin(t * Math.PI * 2.4 + longitude * 1.7) * width * 0.42;
    const shimmer = ((index * 13) % 9) / 8;
    const glint = index % 11 === 2 || index % 17 === 5;
    points.push({
      longitudeOffset: centered * longitudeSpan + Math.sin(index * 1.37) * 0.018,
      latitudeOffset: lane * width + wave + Math.cos(index * 0.93) * width * 0.18,
      size: glint ? 4.0 + shimmer * 1.45 : 1.55 + shimmer * 1.75,
      colour: colours[index % colours.length],
      twinkleSpeed: glint ? 1.55 + shimmer * 0.42 : 0.58 + shimmer * 0.62,
      twinkleOffset: longitude * 1.9 + latitude * 2.7 + index * 0.73,
      twinkleAmount: glint ? 0.62 : 0.36,
      baseOpacity: glint ? opacity * 2.9 : opacity * (0.72 + shimmer * 0.5),
      depthOffset: depthOffset + lane * 4,
      glow: glint ? 0.46 : undefined,
      glowSize: glint ? 3.8 + shimmer * 1.45 : undefined,
    });
  }
  return { longitude, latitude, points };
}

function makeEchoGlyph(longitude: number, latitude: number, colour: number, seed: number): StarCluster {
  const warmColour = seed % 2 === 0 ? 0xfff4c8 : 0xc8fff7;
  return {
    longitude,
    latitude,
    points: [
      { longitudeOffset: -0.035, latitudeOffset: -0.018, size: 2.4, colour, twinkleSpeed: 0.82, twinkleOffset: seed * 0.7, twinkleAmount: 0.34, baseOpacity: 0.82, depthOffset: -6 },
      { longitudeOffset: -0.006, latitudeOffset: 0.012, size: 3.4, colour: warmColour, twinkleSpeed: 1.18, twinkleOffset: seed * 0.7 + 1.4, twinkleAmount: 0.5, baseOpacity: 0.98, depthOffset: 4, glow: 0.34, glowSize: 3.4 },
      { longitudeOffset: 0.032, latitudeOffset: 0.03, size: 2.1, colour: 0xf7f9ff, twinkleSpeed: 0.96, twinkleOffset: seed * 0.7 + 2.6, twinkleAmount: 0.36, baseOpacity: 0.78, depthOffset: 10 },
      { longitudeOffset: 0.05, latitudeOffset: -0.008, size: 2.8, colour, twinkleSpeed: 1.36, twinkleOffset: seed * 0.7 + 3.8, twinkleAmount: 0.58, baseOpacity: 0.9, depthOffset: 0, glow: 0.18, glowSize: 2.7 },
      { longitudeOffset: 0.014, latitudeOffset: -0.04, size: 2.0, colour: warmColour, twinkleSpeed: 0.74, twinkleOffset: seed * 0.7 + 5.0, twinkleAmount: 0.3, baseOpacity: 0.74, depthOffset: 14 },
    ],
  };
}

function getStarCoverage(clusters: StarCluster[]): {
  northernFeatures: number;
  southernFeatures: number;
  minLatitude: number;
  maxLatitude: number;
} {
  let northernFeatures = 0;
  let southernFeatures = 0;
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;

  clusters.forEach((cluster) => {
    cluster.points.forEach((star) => {
      const latitude = cluster.latitude + star.latitudeOffset;
      minLatitude = Math.min(minLatitude, latitude);
      maxLatitude = Math.max(maxLatitude, latitude);
      if (latitude >= 0) northernFeatures += 1;
      else southernFeatures += 1;
    });
  });

  return { northernFeatures, southernFeatures, minLatitude, maxLatitude };
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
  const apparentDirection = apparentSkyDirection(body.direction, state.frame, state.spunFrame, celestialApparentDirection);
  const altitudeFade = THREE.MathUtils.smoothstep(apparentDirection.dot(state.frame.up), -0.2, 0.18);
  const prominence = 0.9 + (Math.sin(state.longitude * 1.7 + state.latitude * 1.1 + index * 2.13) * 0.5 + 0.5) * 0.22;
  child.position.copy(apparentDirection).multiplyScalar(skyShellDistance + (index % 3) * 4);
  child.scale.setScalar(prominence * THREE.MathUtils.lerp(0.64, 1.12, altitudeFade));
  child.visible = altitudeFade > 0.03;
  child.lookAt(camera.position);
  child.rotation.z += Math.sin(elapsed * 0.12 + index) * 0.0008;
}

function updateSkyRing(skyRing: THREE.Mesh, state: SkyLocationState, elapsed: number): void {
  const apparentRingDirection = apparentSkyDirection(ringDirection, state.frame, state.spunFrame, ringApparentDirection);
  skyRing.position.copy(apparentRingDirection).multiplyScalar(150);
  skyRing.quaternion.setFromUnitVectors(skyForwardDirection, apparentRingDirection);
  skyRing.rotateZ(elapsed * 0.035 + state.ringSpinOffset);
  skyRing.visible = apparentRingDirection.dot(state.frame.up) > -0.16;
}

function createStarField(): {
  group: THREE.Group;
  update: (elapsed: number, nightAmount: number, templeInfluence: number, state: SkyLocationState) => void;
} {
  const group = new THREE.Group();
  group.name = "patterned-twinkling-star-clusters";
  const starGeometry = new THREE.PlaneGeometry(1, 1);
  const starVisualScale = 0.28;
  const starGlowVisualScale = 0.34;
  const twinkleTint = new THREE.Color(0xffffff);
  const stars: Array<{
    star: StarPoint;
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    baseColour: THREE.Color;
    glowMesh?: THREE.Mesh;
    glowMaterial?: THREE.MeshBasicMaterial;
  }> = [];

  starClusters.forEach((cluster) => {
    cluster.points.forEach((star) => {
      const direction = stableDirection(cluster.longitude + star.longitudeOffset, cluster.latitude + star.latitudeOffset);
      const material = new THREE.MeshBasicMaterial({
        color: star.colour,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(starGeometry, material);
      mesh.position.copy(direction).multiplyScalar(starShellDistance + (star.depthOffset ?? 0));
      mesh.lookAt(0, 0, 0);
      mesh.scale.setScalar(star.size * starVisualScale);
      group.add(mesh);
      const glowAmount = star.glow ?? 0;
      if (glowAmount > 0) {
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: star.colour,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          fog: false,
          side: THREE.DoubleSide,
        });
        const glowMesh = new THREE.Mesh(starGeometry, glowMaterial);
        glowMesh.position.copy(direction).multiplyScalar(starShellDistance + (star.depthOffset ?? 0) - 0.35);
        glowMesh.lookAt(0, 0, 0);
        glowMesh.scale.setScalar(star.size * (star.glowSize ?? 2.8) * starGlowVisualScale);
        group.add(glowMesh);
        stars.push({ star, mesh, material, baseColour: new THREE.Color(star.colour), glowMesh, glowMaterial });
      } else {
        stars.push({ star, mesh, material, baseColour: new THREE.Color(star.colour) });
      }
    });
  });

  return {
    group,
    update: (elapsed, nightAmount, templeInfluence, state) => {
      const visibility = THREE.MathUtils.clamp(nightAmount * 0.94 + templeInfluence * 0.08, 0, 1);
      state.starVisibility = visibility;
      group.visible = visibility > 0.02;
      group.quaternion.copy(apparentSkyQuaternion(state));
      stars.forEach(({ star, mesh, material, baseColour, glowMesh, glowMaterial }) => {
        const slowPulse = Math.sin(elapsed * star.twinkleSpeed + star.twinkleOffset) * 0.5 + 0.5;
        const smallPulse = Math.sin(elapsed * (star.twinkleSpeed * 1.9 + 0.37) + star.twinkleOffset * 1.7) * 0.5 + 0.5;
        const alivePulse = slowPulse * 0.62 + smallPulse * 0.38;
        const twinkle = 1 + (alivePulse - 0.5) * star.twinkleAmount;
        material.color.copy(baseColour).lerp(twinkleTint, slowPulse * 0.22);
        material.opacity = visibility * (star.baseOpacity ?? 1) * (0.54 + slowPulse * 0.34 + smallPulse * 0.22);
        mesh.scale.setScalar(star.size * twinkle * starVisualScale);
        if (glowMesh && glowMaterial) {
          const glowPulse = Math.pow(alivePulse, 1.6);
          glowMaterial.color.copy(baseColour).lerp(twinkleTint, 0.24 + slowPulse * 0.2);
          glowMaterial.opacity = visibility * (star.glow ?? 0) * (0.24 + glowPulse * 0.72);
          glowMesh.scale.setScalar(star.size * (star.glowSize ?? 2.8) * (0.88 + glowPulse * 0.2) * starGlowVisualScale);
        }
      });
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
        setMeteorPathVectors(path, state, meteorStartScratch, meteorEndScratch);
        const radiantAltitude = meteorStartScratch.dot(state.frame.up) / skyShellDistance;
        const horizonFade = THREE.MathUtils.smoothstep(radiantAltitude, -0.08, 0.28);
        const fade = activeAmount * nightAmount * horizonFade * Math.sin(progress * Math.PI);
        meteor.visible = fade > 0.015;
        meteor.position.lerpVectors(meteorStartScratch, meteorEndScratch, easedProgress);
        meteor.lookAt(camera.position);
        alignMeteorToTravel(meteor, meteorStartScratch, meteorEndScratch, camera);
        meteor.scale.setScalar(path.size * (0.84 + progress * 0.24));
        meteor.children.forEach((child) => {
          const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          material.opacity = fade * ((child.userData.opacityWeight as number | undefined) ?? 0.86);
        });
      });
    },
  };
}

function setMeteorPathVectors(path: MeteorPath, state: SkyLocationState, start: THREE.Vector3, end: THREE.Vector3): void {
  const east = state.frame.east;
  const north = state.frame.localZ;
  const base = meteorBaseScratch.copy(state.antiSunDirection).multiplyScalar(0.92).addScaledVector(state.frame.up, path.lift);
  start.copy(base).addScaledVector(east, path.lateral).addScaledVector(north, path.drift * 0.18).normalize().multiplyScalar(skyShellDistance);
  end.copy(base).addScaledVector(east, path.lateral + path.drift).addScaledVector(north, -0.32).normalize().multiplyScalar(skyShellDistance);
}

function alignMeteorToTravel(meteor: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, camera: THREE.Camera): void {
  const currentWorld = meteor.getWorldPosition(meteorWorldScratch);
  const current = meteorScreenCurrentScratch.copy(currentWorld).project(camera);
  const ahead = meteorScreenAheadScratch
    .copy(currentWorld)
    .add(meteorTravelScratch.copy(end).sub(start).setLength(6))
    .project(camera);
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
