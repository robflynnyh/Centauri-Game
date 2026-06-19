import * as THREE from "three";

export function createSkySystem(
  scene: THREE.Scene,
  camera: THREE.Camera,
  isDemo: boolean
): { update: (elapsed: number) => void } {
  const dayBackgroundColour = new THREE.Color(0x5d91ff);
  const nightBackgroundColour = new THREE.Color(0x171044);
  const dayFogColour = new THREE.Color(0x76a6df);
  const nightFogColour = new THREE.Color(0x251652);
  const worldFog = new THREE.FogExp2(dayFogColour.getHex(), 0.014);
  scene.background = dayBackgroundColour.clone();
  scene.fog = worldFog;

  const hemi = new THREE.HemisphereLight(0xf2e9c8, 0x4e4671, 0.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd8a3, 0.22);
  sun.position.set(-24, 42, 16);
  scene.add(sun);

  const moon = new THREE.DirectionalLight(0xb6c5ff, 0.12);
  moon.position.set(30, 15, -20);
  scene.add(moon);

  const skyUniforms = {
    dayAmount: { value: 1 },
    dayHorizonColour: { value: new THREE.Color(0xff9fd0) },
    dayMiddleColour: { value: new THREE.Color(0x78d2ff) },
    dayUpperColour: { value: new THREE.Color(0x6393ff) },
    dayZenithColour: { value: new THREE.Color(0x705ed8) },
    nightHorizonColour: { value: new THREE.Color(0x7d55b4) },
    nightMiddleColour: { value: new THREE.Color(0x2d3f9b) },
    nightUpperColour: { value: new THREE.Color(0x1d236f) },
    nightZenithColour: { value: new THREE.Color(0x120d35) },
  };

  scene.add(makeSkyDome(skyUniforms));

  const skyRing = new THREE.Mesh(
    new THREE.TorusGeometry(42, 0.06, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xffd37e })
  );
  skyRing.position.set(0, 30, -20);
  skyRing.rotation.x = Math.PI / 2.7;
  scene.add(skyRing);

  const celestialGroup = new THREE.Group();
  scene.add(celestialGroup);
  celestialBodies.forEach((body, index) => addCelestialBody(celestialGroup, camera, body, index));
  const meteorField = createMeteorField(camera, isDemo);
  scene.add(meteorField.group);

  return {
    update: (elapsed) => {
      const dayAmount = getDayAmount(elapsed, isDemo);
      const nightAmount = 1 - THREE.MathUtils.smoothstep(dayAmount, 0.08, 0.36);
      skyUniforms.dayAmount.value = dayAmount;

      (scene.background as THREE.Color).copy(nightBackgroundColour).lerp(dayBackgroundColour, dayAmount);
      worldFog.color.copy(nightFogColour).lerp(dayFogColour, dayAmount);
      worldFog.density = THREE.MathUtils.lerp(0.021, 0.014, dayAmount);

      hemi.intensity = THREE.MathUtils.lerp(0.14, 0.35, dayAmount);
      sun.intensity = THREE.MathUtils.lerp(0.04, 0.22, dayAmount);
      moon.intensity = THREE.MathUtils.lerp(0.18, 0.08, dayAmount);

      skyRing.rotation.z = elapsed * 0.035;
      celestialGroup.children.forEach((child, index) => {
        child.lookAt(camera.position);
        child.rotation.z += Math.sin(elapsed * 0.12 + index) * 0.0008;
      });
      meteorField.update(elapsed, nightAmount);
    },
  };
}

function makeSkyDome(skyUniforms: Record<string, { value: number | THREE.Color }>): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(180, 24, 14);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
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
      uniform float dayAmount;
      uniform vec3 dayHorizonColour;
      uniform vec3 dayMiddleColour;
      uniform vec3 dayUpperColour;
      uniform vec3 dayZenithColour;
      uniform vec3 nightHorizonColour;
      uniform vec3 nightMiddleColour;
      uniform vec3 nightUpperColour;
      uniform vec3 nightZenithColour;

      void main() {
        float height = clamp(normalize(vWorldPosition).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizonColour = mix(nightHorizonColour, dayHorizonColour, dayAmount);
        vec3 middleColour = mix(nightMiddleColour, dayMiddleColour, dayAmount);
        vec3 upperColour = mix(nightUpperColour, dayUpperColour, dayAmount);
        vec3 zenithColour = mix(nightZenithColour, dayZenithColour, dayAmount);
        vec3 sky = horizonColour;
        if (height > 0.32) sky = middleColour;
        if (height > 0.56) sky = upperColour;
        if (height > 0.78) sky = zenithColour;
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  return new THREE.Mesh(geometry, material);
}

function getDayAmount(elapsed: number, isDemo: boolean): number {
  const cycleLength = isDemo ? 18 : 96;
  const phase = (elapsed / cycleLength + 0.18) % 1;
  const daylightWave = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
  return THREE.MathUtils.smoothstep(daylightWave, 0.2, 0.82);
}

type CelestialBody = {
  angle: number;
  height: number;
  distance: number;
  radius: number;
  colour: number;
  halo: number;
  ring?: boolean;
};

type MeteorPath = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  size: number;
  angle: number;
  colour: number;
  glow: number;
  offset: number;
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

function addCelestialBody(celestialGroup: THREE.Group, camera: THREE.Camera, body: CelestialBody, index: number): void {
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

function createMeteorField(camera: THREE.Camera, isDemo: boolean): { group: THREE.Group; update: (elapsed: number, nightAmount: number) => void } {
  const group = new THREE.Group();
  const period = isDemo ? 7.2 : 23;
  const duration = isDemo ? 2.4 : 2.9;
  const paths: MeteorPath[] = [
    {
      start: new THREE.Vector3(20, 55, -116),
      end: new THREE.Vector3(-28, 34, -94),
      size: 2.15,
      angle: -0.38,
      colour: 0xfff6b0,
      glow: 0xff78d2,
      offset: 1.0,
    },
    {
      start: new THREE.Vector3(-74, 48, -64),
      end: new THREE.Vector3(-34, 28, -82),
      size: 1.2,
      angle: -0.28,
      colour: 0xa8fff2,
      glow: 0x7c7dff,
      offset: 4.4,
    },
    {
      start: new THREE.Vector3(66, 42, -78),
      end: new THREE.Vector3(22, 24, -100),
      size: 1.18,
      angle: -0.34,
      colour: 0xffcaf5,
      glow: 0x89d6ff,
      offset: 7.8,
    },
    {
      start: new THREE.Vector3(-18, 62, 84),
      end: new THREE.Vector3(35, 38, 62),
      size: 1.08,
      angle: -0.4,
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
    update: (elapsed, nightAmount) => {
      group.visible = nightAmount > 0.02;
      meteors.forEach(({ path, meteor }) => {
        const phase = (elapsed + path.offset) % period;
        const activeAmount = phase <= duration ? 1 : 0;
        const progress = THREE.MathUtils.clamp(phase / duration, 0, 1);
        const easedProgress = THREE.MathUtils.smoothstep(progress, 0, 1);
        const fade = activeAmount * nightAmount * Math.sin(progress * Math.PI);
        meteor.visible = fade > 0.015;
        meteor.position.lerpVectors(path.start, path.end, easedProgress);
        meteor.lookAt(camera.position);
        meteor.rotation.z += path.angle;
        meteor.scale.setScalar(path.size * (0.84 + progress * 0.24));
        meteor.children.forEach((child) => {
          const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          material.opacity = fade * ((child.userData.opacityWeight as number | undefined) ?? 0.86);
        });
      });
    },
  };
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
