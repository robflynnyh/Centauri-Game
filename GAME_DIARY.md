# Game Diary

## 2026-06-19

Initial Centauri scaffold: Vite, TypeScript, Three.js, Playwright demo artifact workflow, Symphony instructions, and a first deterministic alien-planet flythrough.

Cleaned up generated media handling: demo screenshots/videos are produced by Playwright and uploaded as workflow artifacts, but ignored by Git and not committed to the repository.

Made the sky more alien: a pink-blue-to-purple gradient dome, many visible moons and ringed bodies, and a slightly higher PR demo gaze so the new sky reads in review captures.

Added alien nature density: readable low-poly trees, small glowing ground sprouts, spring pools, and a central glassy stream placed along the deterministic PR flythrough.

Tightened the alien tree silhouettes so the trunks, collars, and canopies overlap as one readable form instead of looking like disconnected stacked pieces.

Reworked the alien trees again with centered, overlapping crowns around a trunk that visibly rises into the canopy to avoid a disjointed stacked read.

Changed pools and the stream into terrain-following water meshes so the demo water sits against the ground instead of floating over uneven terrain.

Added lightweight first-person collision against alien trees and larger rocks using explicit circular blockers while keeping water, sprouts, and small glowing flora passable.

Flattened the planet's visual language toward broad Proteus-like graphic masses: unlit world materials, banded terrain/sky color, pixel-edged rendering, and a closer PR demo path for reading silhouettes.

Rebalanced the flat art pass after review feedback by restoring whimsical alien color contrast: brighter pink flora, acid green canopies, cyan water, violet rocks, and more playful sky/terrain bands while keeping the unlit graphic silhouette read.

Restored the ROB-248 sky direction inside the flatter art pass with a simple day/night palette cycle: bright pinky-blue daytime bands, dark blue-purple nighttime bands, and an accelerated PR demo transition so the video shows both moods.

Changed the terrain color layout from interpolated vertex gradients to hard-edged flat color cells so the floor reads more like pixelly Proteus-style color borders.

Expanded the planet beyond the local field with wider terrain, distant flat-colour ridge silhouettes, and odd side buttes, then split the growing scene code into small terrain, sky, nature, collision, and PR demo modules.

Reworked the mountain pass after review feedback so the high ridges are part of the walkable terrain heightfield instead of detached horizon silhouettes.

Added fading lo-fi footstep decals that appear only while walking, avoid obvious water and blockers, and clean themselves up after a short smooth fade.
