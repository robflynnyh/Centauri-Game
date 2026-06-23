import * as THREE from "three";
import type { CollisionObstacle } from "./collision";
import { isInLandmarkZone, type LandmarkZone } from "./landmarks";
import { normalizePlanetCoords, placeObjectOnPlanet, pointOnPlanet, surfaceDistanceBetweenLocal, type LocalPlanetPoint } from "./planet";
import { isInMassiveMountainFootprint } from "./terrain";
import { oceanStateAt } from "./water";

type HeightSampler = (x: number, z: number) => number;
type AddCollisionObstacle = (obstacle: CollisionObstacle) => void;
type SetDynamicCollisionObstacles = (obstacles: CollisionObstacle[]) => void;

export type NatureState = {
  centerX: number;
  centerZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  chunkSize: number;
  chunkCount: number;
  complexDetailRadius: number;
  complexFadeRadius: number;
  nearestBiomePatchDistance: number;
  fullDetailBiomePatches: number;
  generatedBiomePatches: number;
  generatedObjects: number;
  generatedObstacles: number;
  generatedReactiveFlora: number;
  generatedSeaweedPatches: number;
  generatedSeaweedBlades: number;
  generatedBushClumps: number;
  generatedBushCards: number;
  nearestSeaweedDistance: number;
  nearestSeaweedFreezeAmount: number;
  nearestBushDistance: number;
  nearestBushWobbleAmount: number;
  seaweedSamples: SeaweedSample[];
  bushSamples: BushSample[];
};

type ReactiveStalk = {
  x: number;
  z: number;
  cap: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  capAltitude: number;
  capRotation: THREE.Euler;
  reaction: number;
};

type SeaweedBlade = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  baseLean: number;
  phase: number;
  waveAmount: number;
  restColour: THREE.Color;
};

type ReactiveSeaweedPatch = {
  x: number;
  z: number;
  blades: SeaweedBlade[];
  reaction: number;
  flatness: number;
};

type SeaweedSample = {
  x: number;
  z: number;
  bladeCount: number;
  nearestBiomeEdgeDistance: number;
  flatness: number;
  staticBend: number;
};

type BushCard = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  restRotation: THREE.Euler;
  restScale: THREE.Vector3;
  phase: number;
  wobbleAmount: number;
};

type ReactiveBushClump = {
  x: number;
  z: number;
  cards: BushCard[];
  reaction: number;
  flatness: number;
};

type BushSample = {
  x: number;
  z: number;
  cardCount: number;
  flatness: number;
  nearestBiomeEdgeDistance: number;
};

type BiomePatch = {
  x: number;
  z: number;
  radius: number;
};

const capRestColour = new THREE.Color(0xff5c9e);
const capNearColour = new THREE.Color(0xfff06a);
const glowNearColour = new THREE.Color(0xffffb8);
const floraReactionRadius = 12;
const floraReactionFullRadius = 5.5;
const seaweedReactionRadius = 16;
const seaweedReactionFullRadius = 7;
const bushReactionRadius = 14;
const bushReactionFullRadius = 5.5;
const seaweedCellSize = 48;
const seaweedBiomeClearance = 38;
const seaweedMaxFlatness = 0.72;
const bushMaxFlatness = 0.86;
const generatedNatureChunkSize = 96;
const generatedNatureChunkRadius = 3;
const generatedBiomeCellSize = generatedNatureChunkSize * 2;
const generatedComplexDetailRadius = 180;
const generatedComplexFadeRadius = 292;
const starterBiomeCellX = 0;
const starterBiomeCellZ = 0;
const starterBiomeCenter = { x: 8, z: 18 };
const baseTreesPerChunk = 3;
const baseReactiveFloraPerChunk = 9;
const baseSproutsPerChunk = 6;
const baseRocksPerChunk = 3;
const basePoolChance = 0.22;
const baseStreamChance = 0.12;

export function populateNature(
  scene: THREE.Scene,
  heightAt: HeightSampler,
  addCollisionObstacle: AddCollisionObstacle,
  setDynamicCollisionObstacles: SetDynamicCollisionObstacles = () => undefined,
  landmarkZones: LandmarkZone[] = []
): {
  floraGroup: THREE.Group;
  natureGroup: THREE.Group;
  updateFloraReactivity: (playerPosition: LocalPlanetPoint, delta: number, elapsed: number) => void;
  updateNatureChunks: (centerX: number, centerZ: number) => void;
  getNatureState: () => NatureState;
} {
  const floraGroup = new THREE.Group();
  scene.add(floraGroup);

  const natureGroup = new THREE.Group();
  scene.add(natureGroup);

  const generatedNatureGroup = new THREE.Group();
  generatedNatureGroup.name = "generated-spherical-nature";
  scene.add(generatedNatureGroup);

  const stalkMaterial = new THREE.MeshBasicMaterial({ color: 0x55c7ba });
  const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x3f2b92 });
  const canopyMaterial = new THREE.MeshBasicMaterial({ color: 0x8dff86 });
  const canopyAccentMaterial = new THREE.MeshBasicMaterial({ color: 0xffb84f });
  const reedMaterial = new THREE.MeshBasicMaterial({ color: 0xc5ff4f });
  const bloomMaterial = new THREE.MeshBasicMaterial({ color: 0xff58df });
  const bushMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x44df9a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    new THREE.MeshBasicMaterial({ color: 0xd8ff5e, side: THREE.DoubleSide, transparent: true, opacity: 0.84 }),
    new THREE.MeshBasicMaterial({ color: 0xff67c8, side: THREE.DoubleSide, transparent: true, opacity: 0.78 }),
  ];
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: 0x8cffff,
    transparent: true,
    opacity: 0.76,
    side: THREE.DoubleSide,
  });
  const stoneMaterial = new THREE.MeshBasicMaterial({ color: 0x6b55d8 });
  const reactiveStalks: ReactiveStalk[] = [];
  const reactiveSeaweedPatches: ReactiveSeaweedPatch[] = [];
  const reactiveBushClumps: ReactiveBushClump[] = [];
  let generatedCenterChunkX = Number.NaN;
  let generatedCenterChunkZ = Number.NaN;
  let generatedObjectCount = 0;
  let generatedObstacleCount = 0;
  let generatedReactiveFloraCount = 0;
  let generatedSeaweedPatchCount = 0;
  let generatedSeaweedBladeCount = 0;
  let generatedBushClumpCount = 0;
  let generatedBushCardCount = 0;
  let generatedBiomePatchCount = 0;
  let fullDetailBiomePatchCount = 0;
  let nearestBiomePatchDistance = Number.POSITIVE_INFINITY;
  let nearestSeaweedDistance = Number.POSITIVE_INFINITY;
  let nearestSeaweedFreezeAmount = 0;
  let nearestBushDistance = Number.POSITIVE_INFINITY;
  let nearestBushWobbleAmount = 0;
  let seaweedSamples: SeaweedSample[] = [];
  let bushSamples: BushSample[] = [];

  const addReactiveFloraAt = (x: number, z: number, seed: number, angle: number, targetGroup = generatedNatureGroup): void => {
    const y = heightAt(x, z);

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 2.6 + (seed % 5) * 0.35, 5), stalkMaterial);
    placeObjectOnPlanet(stalk, x, z, y + 1.2, new THREE.Euler(0, 0, Math.sin(seed) * 0.18));
    targetGroup.add(stalk);

    const capGeometry = new THREE.OctahedronGeometry(0.5 + (seed % 4) * 0.12, 0);
    const capMaterial = new THREE.MeshBasicMaterial({ color: capRestColour });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    const capAltitude = y + 2.8 + (seed % 3) * 0.18;
    const capRotation = new THREE.Euler(seed * 0.12, seed * 0.2, seed * 0.07);
    placeObjectOnPlanet(cap, x, z, capAltitude, capRotation);
    targetGroup.add(cap);

    const glow = new THREE.Mesh(
      capGeometry.clone(),
      new THREE.MeshBasicMaterial({
        color: glowNearColour,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    placeObjectOnPlanet(glow, x, z, capAltitude, capRotation);
    glow.scale.setScalar(1.22);
    targetGroup.add(glow);
    reactiveStalks.push({ x, z, cap, glow, capAltitude, capRotation, reaction: 0 });
  };

  const addAlienTree = (
    x: number,
    z: number,
    scale: number,
    lean: number,
    targetGroup = natureGroup,
    dynamicObstacles?: CollisionObstacle[]
  ): void => {
    const y = heightAt(x, z);
    const tree = new THREE.Group();
    placeObjectOnPlanet(tree, x, z, y, new THREE.Euler(0, x * 0.11 + z * 0.07, 0));
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

    targetGroup.add(tree);
    const obstacle = { kind: "tree" as const, x, z, radius: 1.15 * scale };
    if (dynamicObstacles) dynamicObstacles.push(obstacle);
    else addCollisionObstacle(obstacle);
  };

  const addSproutAt = (x: number, z: number, seed: number, angle: number, targetGroup = natureGroup): void => {
    const y = heightAt(x, z);
    const sprout = new THREE.Group();
    placeObjectOnPlanet(sprout, x, z, y + 0.08, new THREE.Euler(0, angle, 0));

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

    targetGroup.add(sprout);
  };

  const addGeneratedRock = (x: number, z: number, size: number, rotation: THREE.Euler, dynamicObstacles: CollisionObstacle[]): void => {
    const y = heightAt(x, z);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), stoneMaterial);
    placeObjectOnPlanet(stone, x, z, y + 0.7, rotation);
    generatedNatureGroup.add(stone);
    dynamicObstacles.push({ kind: "rock", x, z, radius: size * 0.72 });
  };

  const addSeaweedPatchAt = (x: number, z: number, seed: number, angle: number, flatness: number, nearestBiomeEdgeDistance: number): void => {
    const random = createChunkRandom(seed, Math.floor(seed * 0.37));
    const y = heightAt(x, z);
    const patch = new THREE.Group();
    placeObjectOnPlanet(patch, x, z, y + 0.04, new THREE.Euler(0, angle, 0));

    const bladeCount = 6 + Math.floor(random() * 9);
    const blades: SeaweedBlade[] = [];
    let strongestStaticBend = 0;
    for (let i = 0; i < bladeCount; i += 1) {
      const height = 1.05 + random() * 1.35;
      const width = 0.12 + random() * 0.1;
      const staticBend = 0.08 + random() * 0.16;
      const geometry = makeSeaweedBladeGeometry(width, height, staticBend, random() * Math.PI * 2);
      strongestStaticBend = Math.max(strongestStaticBend, staticBend);
      const restColour = new THREE.Color(0x54d65c);
      restColour.offsetHSL(0.035 + random() * 0.035, 0.02, -0.08 + random() * 0.12);
      const material = new THREE.MeshBasicMaterial({
        color: restColour,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.84 + random() * 0.12,
      });
      const blade = new THREE.Mesh(geometry, material);
      const bladeAngle = random() * Math.PI * 2;
      const distance = Math.pow(random(), 0.55) * (0.4 + random() * 0.55);
      const baseLean = (random() - 0.5) * 0.42;
      blade.position.set(Math.cos(bladeAngle) * distance, 0, Math.sin(bladeAngle) * distance);
      blade.rotation.set(0, bladeAngle + (i % 2) * Math.PI * 0.5, baseLean);
      blade.scale.y = 0.86 + random() * 0.22;
      patch.add(blade);
      blades.push({
        mesh: blade,
        baseLean,
        phase: random() * Math.PI * 2,
        waveAmount: 0.08 + random() * 0.08,
        restColour,
      });
    }

    generatedNatureGroup.add(patch);
    reactiveSeaweedPatches.push({ x, z, blades, reaction: 0, flatness });
    generatedSeaweedPatchCount += 1;
    generatedSeaweedBladeCount += bladeCount;
    seaweedSamples.push({ x, z, bladeCount, nearestBiomeEdgeDistance, flatness, staticBend: strongestStaticBend });
  };

  const addBushClumpAt = (x: number, z: number, seed: number, angle: number, flatness: number, nearestBiomeEdgeDistance: number): void => {
    const random = createChunkRandom(seed, Math.floor(seed * 0.53));
    const y = heightAt(x, z);
    const clump = new THREE.Group();
    placeObjectOnPlanet(clump, x, z, y + 0.05, new THREE.Euler(0, angle, 0));

    const cardCount = 3 + Math.floor(random() * 6);
    const cards: BushCard[] = [];
    for (let i = 0; i < cardCount; i += 1) {
      const height = 0.9 + random() * 1.05;
      const width = 0.86 + random() * 0.72;
      const lobe = 0.12 + random() * 0.18;
      const card = new THREE.Mesh(
        makeBushCardGeometry(width, height, lobe, random() * Math.PI * 2),
        bushMaterials[(seed + i) % bushMaterials.length]
      );
      const cardAngle = (i / cardCount) * Math.PI * 2 + (random() - 0.5) * 0.72;
      const distance = Math.pow(random(), 0.68) * (0.45 + random() * 0.88);
      const restRotation = new THREE.Euler((random() - 0.5) * 0.16, cardAngle + Math.PI * 0.5, (random() - 0.5) * 0.24);
      const restScale = new THREE.Vector3(0.78 + random() * 0.48, 0.82 + random() * 0.38, 1);
      card.position.set(Math.cos(cardAngle) * distance, 0, Math.sin(cardAngle) * distance);
      card.rotation.copy(restRotation);
      card.scale.copy(restScale);
      clump.add(card);
      cards.push({
        mesh: card,
        restRotation,
        restScale,
        phase: random() * Math.PI * 2,
        wobbleAmount: 0.12 + random() * 0.11,
      });
    }

    generatedNatureGroup.add(clump);
    reactiveBushClumps.push({ x, z, cards, reaction: 0, flatness });
    generatedBushClumpCount += 1;
    generatedBushCardCount += cardCount;
    bushSamples.push({ x, z, cardCount, flatness, nearestBiomeEdgeDistance });
  };

  const rebuildGeneratedNature = (centerX: number, centerZ: number): void => {
    const normalized = normalizePlanetCoords(centerX, centerZ);
    const nextChunkX = Math.floor(normalized.x / generatedNatureChunkSize);
    const nextChunkZ = Math.floor(normalized.z / generatedNatureChunkSize);
    if (nextChunkX === generatedCenterChunkX && nextChunkZ === generatedCenterChunkZ) return;

    disposeGeneratedNature(generatedNatureGroup);
    generatedNatureGroup.clear();
    generatedCenterChunkX = nextChunkX;
    generatedCenterChunkZ = nextChunkZ;
    generatedObjectCount = 0;
    generatedReactiveFloraCount = 0;
    generatedSeaweedPatchCount = 0;
    generatedSeaweedBladeCount = 0;
    generatedBushClumpCount = 0;
    generatedBushCardCount = 0;
    generatedBiomePatchCount = 0;
    fullDetailBiomePatchCount = 0;
    nearestBiomePatchDistance = Number.POSITIVE_INFINITY;
    nearestSeaweedDistance = Number.POSITIVE_INFINITY;
    nearestSeaweedFreezeAmount = 0;
    nearestBushDistance = Number.POSITIVE_INFINITY;
    nearestBushWobbleAmount = 0;
    seaweedSamples = [];
    bushSamples = [];
    reactiveStalks.length = 0;
    reactiveSeaweedPatches.length = 0;
    reactiveBushClumps.length = 0;
    const dynamicObstacles: CollisionObstacle[] = [];
    const visibleBiomePatches: BiomePatch[] = [];

    const minX = (generatedCenterChunkX - generatedNatureChunkRadius) * generatedNatureChunkSize;
    const maxX = (generatedCenterChunkX + generatedNatureChunkRadius + 1) * generatedNatureChunkSize;
    const minZ = (generatedCenterChunkZ - generatedNatureChunkRadius) * generatedNatureChunkSize;
    const maxZ = (generatedCenterChunkZ + generatedNatureChunkRadius + 1) * generatedNatureChunkSize;
    const minBiomeCellX = Math.floor(minX / generatedBiomeCellSize) - 1;
    const maxBiomeCellX = Math.floor(maxX / generatedBiomeCellSize) + 1;
    const minBiomeCellZ = Math.floor(minZ / generatedBiomeCellSize) - 1;
    const maxBiomeCellZ = Math.floor(maxZ / generatedBiomeCellSize) + 1;

    for (let biomeCellZ = minBiomeCellZ; biomeCellZ <= maxBiomeCellZ; biomeCellZ += 1) {
      for (let biomeCellX = minBiomeCellX; biomeCellX <= maxBiomeCellX; biomeCellX += 1) {
        const random = createChunkRandom(biomeCellX * 7 + 3, biomeCellZ * 7 - 5);
        const starterBiome = biomeCellX === starterBiomeCellX && biomeCellZ === starterBiomeCellZ;
        const density = starterBiome ? 1.34 : chunkNatureDensity(biomeCellX, biomeCellZ);
        if (!starterBiome && density < 0.88 && random() < 0.45) continue;

        const clusterX = starterBiome
          ? starterBiomeCenter.x
          : biomeCellX * generatedBiomeCellSize + (0.3 + random() * 0.4) * generatedBiomeCellSize;
        const clusterZ = starterBiome
          ? starterBiomeCenter.z
          : biomeCellZ * generatedBiomeCellSize + (0.3 + random() * 0.4) * generatedBiomeCellSize;
        const clusterRadius = starterBiome ? 46 : 28 + random() * 18;
        if (isInMassiveMountainFootprint(clusterX, clusterZ, clusterRadius + 18)) continue;

        const distanceToFocus = surfaceDistanceBetweenLocal({ x: normalized.x, z: normalized.z }, { x: clusterX, z: clusterZ });
        const detailAmount = 1 - THREE.MathUtils.smoothstep(distanceToFocus, generatedComplexDetailRadius, generatedComplexFadeRadius);
        if (detailAmount <= 0.02) continue;

        generatedBiomePatchCount += 1;
        if (detailAmount >= 0.98) fullDetailBiomePatchCount += 1;
        nearestBiomePatchDistance = Math.min(nearestBiomePatchDistance, distanceToFocus);
        visibleBiomePatches.push({ x: clusterX, z: clusterZ, radius: clusterRadius });
        const transitionAmount = THREE.MathUtils.clamp((detailAmount - 0.16) / 0.84, 0, 1);
        const fullness = starterBiome ? 1.48 : density * (0.85 + random() * 0.38);
        const nearObjectScale = 0.56 + detailAmount * 0.44;
        const complexObjectScale = Math.pow(transitionAmount, 0.78);
        const waterDetailEnabled = detailAmount > 0.5;

        for (let i = 0; i < Math.round((baseTreesPerChunk * 2 + fullness * 5) * nearObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.68, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addAlienTree(point.x, point.z, 0.72 + random() * 0.58, random() * Math.PI * 2 - Math.PI, generatedNatureGroup, dynamicObstacles);
          generatedObjectCount += 1;
        }

        for (let i = 0; i < Math.round((baseReactiveFloraPerChunk * 3 + fullness * 24) * complexObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addReactiveFloraAt(point.x, point.z, Math.floor(random() * 10_000), random() * Math.PI * 2, generatedNatureGroup);
          generatedObjectCount += 1;
          generatedReactiveFloraCount += 1;
        }

        for (let i = 0; i < Math.round((baseSproutsPerChunk * 2 + fullness * 13) * nearObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.9, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addSproutAt(point.x, point.z, Math.floor(random() * 10_000), random() * Math.PI * 2, generatedNatureGroup);
          generatedObjectCount += 1;
        }

        const bushCount = Math.round((2 + fullness * 5) * complexObjectScale);
        for (let i = 0; i < bushCount; i += 1) {
          const point = starterBiome && i === 0 ? { x: 7.2, z: 10.4 } : pointNear(clusterX, clusterZ, clusterRadius * 0.82, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          const flatness = terrainFlatnessAt(heightAt, point.x, point.z);
          if (flatness > bushMaxFlatness) continue;
          addBushClumpAt(
            point.x,
            point.z,
            Math.floor(random() * 100_000),
            random() * Math.PI * 2,
            flatness,
            nearestBiomeEdgeDistanceAt(point.x, point.z, visibleBiomePatches)
          );
          generatedObjectCount += 1;
        }

        for (let i = 0; i < Math.round((baseRocksPerChunk * 2 + fullness * 8) * nearObjectScale); i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 1.08, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addGeneratedRock(
            point.x,
            point.z,
            0.78 + random() * 1.2,
            new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
            dynamicObstacles
          );
          generatedObjectCount += 1;
        }

        const poolCount = waterDetailEnabled ? 1 + (random() < basePoolChance + fullness * 0.34 ? 1 : 0) + (random() < fullness * 0.18 ? 1 : 0) : 0;
        for (let i = 0; i < poolCount; i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.42, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addPool(generatedNatureGroup, heightAt, waterMaterial, stoneMaterial, point.x, point.z, 2.5 + random() * 2.4, random() * Math.PI);
          generatedObjectCount += 1;
        }

        const streamCount = waterDetailEnabled ? 1 + (random() < baseStreamChance + fullness * 0.25 ? 1 : 0) : 0;
        for (let i = 0; i < streamCount; i += 1) {
          const point = pointNear(clusterX, clusterZ, clusterRadius * 0.35, random);
          if (isGeneratedNatureExcluded(point, landmarkZones)) continue;
          addGeneratedStream(
            generatedNatureGroup,
            heightAt,
            waterMaterial,
            point.x,
            point.z,
            14 + random() * 20,
            random() * Math.PI * 2,
            random() * Math.PI * 2
          );
          generatedObjectCount += 1;
        }
      }
    }

    const minSeaweedCellX = Math.floor(minX / seaweedCellSize);
    const maxSeaweedCellX = Math.floor(maxX / seaweedCellSize);
    const minSeaweedCellZ = Math.floor(minZ / seaweedCellSize);
    const maxSeaweedCellZ = Math.floor(maxZ / seaweedCellSize);
    for (let cellZ = minSeaweedCellZ; cellZ <= maxSeaweedCellZ; cellZ += 1) {
      for (let cellX = minSeaweedCellX; cellX <= maxSeaweedCellX; cellX += 1) {
        const random = createChunkRandom(cellX - 431, cellZ + 719);
        if (random() > 0.48) continue;
        const x = cellX * seaweedCellSize + (0.18 + random() * 0.64) * seaweedCellSize;
        const z = cellZ * seaweedCellSize + (0.18 + random() * 0.64) * seaweedCellSize;
        const distanceToFocus = surfaceDistanceBetweenLocal({ x: normalized.x, z: normalized.z }, { x, z });
        if (distanceToFocus > generatedComplexFadeRadius * 0.95) continue;
        if (isGeneratedNatureExcluded({ x, z }, landmarkZones)) continue;

        const nearestBiomeEdgeDistance = nearestBiomeEdgeDistanceAt(x, z, visibleBiomePatches);
        if (nearestBiomeEdgeDistance < seaweedBiomeClearance) continue;

        const flatness = terrainFlatnessAt(heightAt, x, z);
        if (flatness > seaweedMaxFlatness) continue;

        const patchSeed = Math.floor(random() * 100_000);
        addSeaweedPatchAt(x, z, patchSeed, random() * Math.PI * 2, flatness, nearestBiomeEdgeDistance);
        generatedObjectCount += 1;
      }
    }

    generatedObstacleCount = dynamicObstacles.length;
    setDynamicCollisionObstacles(dynamicObstacles);
  };

  rebuildGeneratedNature(0, 0);

  return {
    floraGroup,
    natureGroup,
    updateFloraReactivity: createFloraReactivityUpdater(reactiveStalks, reactiveSeaweedPatches, reactiveBushClumps, (distance, freezeAmount) => {
      nearestSeaweedDistance = distance;
      nearestSeaweedFreezeAmount = freezeAmount;
    }, (distance, wobbleAmount) => {
      nearestBushDistance = distance;
      nearestBushWobbleAmount = wobbleAmount;
    }),
    updateNatureChunks: rebuildGeneratedNature,
    getNatureState: () =>
      getGeneratedNatureState(
        generatedCenterChunkX,
        generatedCenterChunkZ,
        generatedObjectCount,
        generatedObstacleCount,
        generatedReactiveFloraCount,
        generatedSeaweedPatchCount,
        generatedSeaweedBladeCount,
        generatedBushClumpCount,
        generatedBushCardCount,
        nearestSeaweedDistance,
        nearestSeaweedFreezeAmount,
        nearestBushDistance,
        nearestBushWobbleAmount,
        seaweedSamples,
        bushSamples,
        generatedBiomePatchCount,
        fullDetailBiomePatchCount,
        nearestBiomePatchDistance
      ),
  };
}

function createFloraReactivityUpdater(
  reactiveStalks: ReactiveStalk[],
  reactiveSeaweedPatches: ReactiveSeaweedPatch[],
  reactiveBushClumps: ReactiveBushClump[],
  setSeaweedFocusState: (distance: number, freezeAmount: number) => void,
  setBushFocusState: (distance: number, wobbleAmount: number) => void
): (playerPosition: LocalPlanetPoint, delta: number, elapsed: number) => void {
  return (playerPosition, delta, elapsed) => {
    const fade = 1 - Math.exp(-delta * 9);
    let nearestSeaweedDistance = Number.POSITIVE_INFINITY;
    let nearestSeaweedFreezeAmount = 0;
    let nearestBushDistance = Number.POSITIVE_INFINITY;
    let nearestBushWobbleAmount = 0;

    reactiveStalks.forEach((stalk, index) => {
      const distance = surfaceDistanceBetweenLocal(playerPosition, stalk);
      const target = 1 - THREE.MathUtils.smoothstep(distance, floraReactionFullRadius, floraReactionRadius);
      stalk.reaction = THREE.MathUtils.lerp(stalk.reaction, target, fade);

      const pulse = 0.82 + Math.sin(elapsed * 4.2 + index * 0.73) * 0.18;
      const glowStrength = stalk.reaction * pulse;
      const bob = Math.sin(elapsed * 1.6 + index) * 0.045;
      stalk.capRotation.y += delta * 0.18;
      placeObjectOnPlanet(stalk.cap, stalk.x, stalk.z, stalk.capAltitude + bob, stalk.capRotation);
      placeObjectOnPlanet(stalk.glow, stalk.x, stalk.z, stalk.capAltitude + bob, stalk.capRotation);
      stalk.cap.material.color.lerpColors(capRestColour, capNearColour, stalk.reaction);
      stalk.cap.scale.setScalar(1 + stalk.reaction * 0.2);
      stalk.glow.material.opacity = glowStrength * 0.48;
      stalk.glow.scale.setScalar(1.18 + glowStrength * 0.42);
    });

    reactiveSeaweedPatches.forEach((patch, patchIndex) => {
      const distance = surfaceDistanceBetweenLocal(playerPosition, patch);
      const freezeTarget = 1 - THREE.MathUtils.smoothstep(distance, seaweedReactionFullRadius, seaweedReactionRadius);
      patch.reaction = THREE.MathUtils.lerp(patch.reaction, freezeTarget, fade);
      if (distance < nearestSeaweedDistance) {
        nearestSeaweedDistance = distance;
        nearestSeaweedFreezeAmount = patch.reaction;
      }

      const waveStrength = 1 - patch.reaction;
      patch.blades.forEach((blade, bladeIndex) => {
        const shimmer = Math.sin(elapsed * 1.7 + blade.phase + patchIndex * 0.41 + bladeIndex * 0.23);
        blade.mesh.rotation.z = blade.baseLean + shimmer * blade.waveAmount * waveStrength;
        blade.mesh.scale.x = 1 + shimmer * 0.04 * waveStrength;
        blade.mesh.material.opacity = 0.74 + waveStrength * (0.1 + Math.max(0, shimmer) * 0.08);
        blade.mesh.material.color.copy(blade.restColour).offsetHSL(0, 0, shimmer * 0.018 * waveStrength);
      });
    });

    reactiveBushClumps.forEach((clump, clumpIndex) => {
      const distance = surfaceDistanceBetweenLocal(playerPosition, clump);
      const target = 1 - THREE.MathUtils.smoothstep(distance, bushReactionFullRadius, bushReactionRadius);
      clump.reaction = THREE.MathUtils.lerp(clump.reaction, target, fade);
      if (distance < nearestBushDistance) {
        nearestBushDistance = distance;
        nearestBushWobbleAmount = clump.reaction;
      }

      clump.cards.forEach((card, cardIndex) => {
        const dance = Math.sin(elapsed * 10.8 + card.phase + clumpIndex * 0.43 + cardIndex * 0.29);
        const flutter = Math.sin(elapsed * 17.2 + card.phase * 0.7);
        const wobble = clump.reaction * card.wobbleAmount;
        card.mesh.rotation.x = card.restRotation.x + flutter * wobble * 0.34;
        card.mesh.rotation.y = card.restRotation.y + dance * wobble * 0.55;
        card.mesh.rotation.z = card.restRotation.z + dance * wobble;
        card.mesh.scale.set(
          card.restScale.x * (1 + clump.reaction * 0.08 + Math.max(0, dance) * clump.reaction * 0.04),
          card.restScale.y * (1 - clump.reaction * 0.05 + Math.max(0, flutter) * clump.reaction * 0.08),
          card.restScale.z
        );
      });
    });

    setSeaweedFocusState(nearestSeaweedDistance, nearestSeaweedFreezeAmount);
    setBushFocusState(nearestBushDistance, nearestBushWobbleAmount);
  };
}

function createChunkRandom(chunkX: number, chunkZ: number): () => number {
  let state = (Math.imul(chunkX, 73856093) ^ Math.imul(chunkZ, 19349663) ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) ^ Math.imul(state ^ (state >>> 13), 3266489917)) >>> 0;
    return state / 0xffffffff;
  };
}

function chunkNatureDensity(chunkX: number, chunkZ: number): number {
  const broadWave = (Math.sin(chunkX * 0.91 + chunkZ * 0.37) + Math.cos(chunkZ * 0.73 - chunkX * 0.28) + 2) * 0.25;
  const pocket = createChunkRandom(chunkX + 101, chunkZ - 211)();
  return THREE.MathUtils.clamp(0.72 + broadWave * 0.42 + pocket * 0.28, 0.62, 1.34);
}

function pointNear(x: number, z: number, radius: number, random: () => number): LocalPlanetPoint {
  const angle = random() * Math.PI * 2;
  const distance = Math.pow(random(), 0.62) * radius;
  return {
    x: x + Math.cos(angle) * distance,
    z: z + Math.sin(angle) * distance,
  };
}

function isGeneratedNatureExcluded(point: LocalPlanetPoint, landmarkZones: LandmarkZone[]): boolean {
  return isInLandmarkZone(point, landmarkZones) || isInMassiveMountainFootprint(point.x, point.z, 8) || isOceanPoint(point.x, point.z);
}

function isOceanPoint(x: number, z: number): boolean {
  return oceanStateAt(x, z).isInOcean;
}

function nearestBiomeEdgeDistanceAt(x: number, z: number, patches: BiomePatch[]): number {
  if (patches.length === 0) return Number.POSITIVE_INFINITY;
  return patches.reduce((nearest, patch) => {
    const distance = surfaceDistanceBetweenLocal({ x, z }, patch) - patch.radius;
    return Math.min(nearest, distance);
  }, Number.POSITIVE_INFINITY);
}

function makeSeaweedBladeGeometry(width: number, height: number, bend: number, phase: number): THREE.BufferGeometry {
  const segments = 5;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const rootFade = THREE.MathUtils.smoothstep(t, 0.06, 0.34);
    const tipSweep = Math.sin(t * Math.PI * 1.55 + phase) * bend * rootFade;
    const tipLean = Math.sin(phase * 1.7) * bend * 0.42 * t * t;
    const centerX = tipSweep + tipLean;
    const taper = 1 - t * 0.42;
    const halfWidth = width * taper * 0.5;
    const y = height * t;
    positions.push(centerX - halfWidth, y, 0, centerX + halfWidth, y, 0);
  }

  for (let i = 0; i < segments; i += 1) {
    const lowerLeft = i * 2;
    const lowerRight = lowerLeft + 1;
    const upperLeft = lowerLeft + 2;
    const upperRight = lowerLeft + 3;
    indices.push(lowerLeft, upperLeft, lowerRight, lowerRight, upperLeft, upperRight);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBushCardGeometry(width: number, height: number, lobe: number, phase: number): THREE.BufferGeometry {
  const waist = width * (0.34 + Math.sin(phase) * 0.04);
  const shoulder = width * (0.5 + Math.cos(phase * 1.3) * 0.05);
  const top = width * (0.16 + lobe * 0.25);
  const positions = [
    -waist, 0, 0,
    waist, 0, 0,
    -shoulder, height * 0.38, 0,
    shoulder, height * 0.35, 0,
    -width * (0.36 + lobe), height * 0.68, 0,
    width * (0.3 + lobe * 0.7), height * 0.72, 0,
    -top, height, 0,
    top, height * (0.95 + Math.sin(phase * 0.8) * 0.04), 0,
  ];
  const indices = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 4, 6, 5, 5, 6, 7];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function terrainFlatnessAt(heightAt: HeightSampler, x: number, z: number): number {
  const center = heightAt(x, z);
  const sampleDistance = 3.5;
  const samples = [
    heightAt(x + sampleDistance, z),
    heightAt(x - sampleDistance, z),
    heightAt(x, z + sampleDistance),
    heightAt(x, z - sampleDistance),
    heightAt(x + sampleDistance * 0.7, z + sampleDistance * 0.7),
    heightAt(x - sampleDistance * 0.7, z - sampleDistance * 0.7),
  ];

  return samples.reduce((largest, height) => Math.max(largest, Math.abs(height - center)), 0);
}

function disposeGeneratedNature(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

function getGeneratedNatureState(
  centerChunkX: number,
  centerChunkZ: number,
  generatedObjects: number,
  generatedObstacles: number,
  generatedReactiveFlora: number,
  generatedSeaweedPatches: number,
  generatedSeaweedBlades: number,
  generatedBushClumps: number,
  generatedBushCards: number,
  nearestSeaweedDistance: number,
  nearestSeaweedFreezeAmount: number,
  nearestBushDistance: number,
  nearestBushWobbleAmount: number,
  seaweedSamples: SeaweedSample[],
  bushSamples: BushSample[],
  generatedBiomePatches: number,
  fullDetailBiomePatches: number,
  nearestBiomePatchDistance: number
): NatureState {
  const minChunkX = centerChunkX - generatedNatureChunkRadius;
  const maxChunkX = centerChunkX + generatedNatureChunkRadius + 1;
  const minChunkZ = centerChunkZ - generatedNatureChunkRadius;
  const maxChunkZ = centerChunkZ + generatedNatureChunkRadius + 1;
  return {
    centerX: (minChunkX + maxChunkX) * 0.5 * generatedNatureChunkSize,
    centerZ: (minChunkZ + maxChunkZ) * 0.5 * generatedNatureChunkSize,
    minX: minChunkX * generatedNatureChunkSize,
    maxX: maxChunkX * generatedNatureChunkSize,
    minZ: minChunkZ * generatedNatureChunkSize,
    maxZ: maxChunkZ * generatedNatureChunkSize,
    chunkSize: generatedNatureChunkSize,
    chunkCount: Math.pow(generatedNatureChunkRadius * 2 + 1, 2),
    complexDetailRadius: generatedComplexDetailRadius,
    complexFadeRadius: generatedComplexFadeRadius,
    nearestBiomePatchDistance,
    fullDetailBiomePatches,
    generatedBiomePatches,
    generatedObjects,
    generatedObstacles,
    generatedReactiveFlora,
    generatedSeaweedPatches,
    generatedSeaweedBlades,
    generatedBushClumps,
    generatedBushCards,
    nearestSeaweedDistance,
    nearestSeaweedFreezeAmount,
    nearestBushDistance,
    nearestBushWobbleAmount,
    seaweedSamples: seaweedSamples.slice(0, 12),
    bushSamples: bushSamples.slice(0, 12),
  };
}

function makePoolGeometry(
  heightAt: HeightSampler,
  x: number,
  z: number,
  radius: number,
  rotation: number,
  scaleX: number,
  scaleZ: number
): THREE.BufferGeometry {
  const segments = 22;
  const center = pointOnPlanet(x, z, heightAt(x, z) + 0.045);
  const positions: number[] = [center.x, center.y, center.z];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radius * scaleX;
    const localZ = Math.sin(angle) * radius * scaleZ;
    const worldX = x + Math.cos(rotation) * localX - Math.sin(rotation) * localZ;
    const worldZ = z + Math.sin(rotation) * localX + Math.cos(rotation) * localZ;
    const point = pointOnPlanet(worldX, worldZ, heightAt(worldX, worldZ) + 0.045);
    positions.push(point.x, point.y, point.z);
  }

  for (let i = 1; i <= segments; i += 1) {
    indices.push(0, i, i + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addPool(
  natureGroup: THREE.Group,
  heightAt: HeightSampler,
  waterMaterial: THREE.MeshBasicMaterial,
  stoneMaterial: THREE.MeshBasicMaterial,
  x: number,
  z: number,
  radius: number,
  colourShift: number
): void {
  const pool = new THREE.Group();

  const water = new THREE.Mesh(makePoolGeometry(heightAt, x, z, radius, colourShift, 1.45, 0.78), waterMaterial.clone());
  const waterMat = water.material as THREE.MeshBasicMaterial;
  waterMat.color.offsetHSL(colourShift * 0.018, -0.05, -0.02);
  pool.add(water);

  const innerGlow = new THREE.Mesh(
    makePoolGeometry(heightAt, x, z, radius * 0.56, colourShift, 1.3, 0.68),
    new THREE.MeshBasicMaterial({ color: 0xe2ffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  pool.add(innerGlow);

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const localX = Math.cos(angle) * radius * 1.28;
    const localZ = Math.sin(angle) * radius * 0.72;
    const worldX = x + Math.cos(colourShift) * localX - Math.sin(colourShift) * localZ;
    const worldZ = z + Math.sin(colourShift) * localX + Math.cos(colourShift) * localZ;
    const rim = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 4) * 0.06, 0), stoneMaterial);
    placeObjectOnPlanet(rim, worldX, worldZ, heightAt(worldX, worldZ) + 0.16, new THREE.Euler(i * 0.2, i * 0.3, i * 0.17));
    pool.add(rim);
  }

  natureGroup.add(pool);
}

function addGeneratedStream(
  natureGroup: THREE.Group,
  heightAt: HeightSampler,
  waterMaterial: THREE.MeshBasicMaterial,
  x: number,
  z: number,
  length: number,
  rotation: number,
  bend: number
): void {
  const points = Array.from({ length: 5 }, (_, index) => {
    const t = index / 4;
    const along = (t - 0.5) * length;
    const side = Math.sin(t * Math.PI * 2 + bend) * length * 0.12;
    return new THREE.Vector3(x + Math.cos(rotation) * along - Math.sin(rotation) * side, 0, z + Math.sin(rotation) * along + Math.cos(rotation) * side);
  });
  const stream = new THREE.Mesh(makeStreamGeometry(heightAt, points), waterMaterial);
  stream.renderOrder = 1;
  natureGroup.add(stream);
}

function makeStreamGeometry(heightAt: HeightSampler, points: THREE.Vector3[]): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const samples = 36;
  const halfWidth = 0.28;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(halfWidth);
    const leftX = point.x + side.x;
    const leftZ = point.z + side.z;
    const rightX = point.x - side.x;
    const rightZ = point.z - side.z;
    const left = pointOnPlanet(leftX, leftZ, heightAt(leftX, leftZ) + 0.055);
    const right = pointOnPlanet(rightX, rightZ, heightAt(rightX, rightZ) + 0.055);
    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);
  }

  for (let i = 0; i < samples; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
