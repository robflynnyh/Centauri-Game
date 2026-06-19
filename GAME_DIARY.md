# Game Diary

## 2026-06-19

Initial Centauri scaffold: Vite, TypeScript, Three.js, Playwright demo artifact workflow, Symphony instructions, and a first deterministic alien-planet flythrough.

Cleaned up generated media handling: demo screenshots/videos are produced by Playwright and uploaded as workflow artifacts

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

Reworked the footstep decals into irregular terrain-sampled ground colour patches and brightened the authored water so the trail review beat still reads as a watery biome.

Tightened the footstep patches into smaller tapered smudges with terrain-sampled strip sections and polygon offset so they read less round and remain visible over uneven crevice-like ground.

Simplified the footstep shape again into centered narrow ground smudges aligned to walking direction, removing the asymmetric taper that could read as sideways.

Switched the marks to small circular terrain-sampled patches with denser ring geometry and stronger polygon offset after direction/orientation remained distracting.

Retuned first-person walking with faster braking, lower top speed, a roughly 25% lower viewpoint, steady camera movement, Space jump, and held Ctrl/Shift/C crouch that visibly lowers the camera; the PR demo now includes a short crouch-and-jump beat near the start.

Enabled built-in WebGL antialiasing to smooth jagged high-contrast silhouettes while keeping the capped pixel ratio and flat graphic material style.

Added night-only meteors as simple billboarded streaks that drift through the existing sky cycle, with the deterministic PR demo holding a brief upward night view so review screenshots and video catch the effect.

Retuned the meteors after review feedback into more whimsical falling sky glyphs with diamond heads, small fins, bead-like curved tails, and loose glowing fragments instead of plain diagonal smears.

Fixed meteor glyph orientation so the bead trails follow behind the moving heads in the camera view, then refreshed the committed PR demo video for direct meteor review.

Changed first-person look controls to use browser pointer lock after one click on the planet view, giving continuous mouse-look without edge limits while Esc or a second click releases the cursor.

Made the cube-top stalk plants react to nearby movement with a smooth 12-metre proximity fade, shifting their tops to bright alien amber and adding a pulsing flat glow that is visible along the PR demo path.

Added small alien water-creatures around the authored pools and stream, with deterministic short hop cycles that keep them near water and visible in the PR flythrough without adding collision or interaction systems.

Reworked the water-creatures after review so their low-poly bodies read as connected alien amphibians, their hops follow small patrol loops around water instead of snapping back to one spot, and the PR demo video is refreshed as a committed review artifact.

Turned the local field into a walkable spherical planet: player movement, camera up, terrain, water, rocks, flora, footsteps, collisions, and the PR demo now use planet-surface coordinates with a 25-minute target equatorial circumnavigation.

Extended the spherical planet with deterministic generated nature chunks so trees, sprouts, rocks, and occasional pools appear around the active globe location instead of only near the original starting field.

Unified the starting biome with the generated spherical nature layer so spawn and off-origin regions are populated by the same deterministic chunk system, including reactive stalks, trees, rocks, pools, and short streams.

Changed generated nature from even scatter into deterministic pocket clusters so off-origin globe regions regain the composed start-biome feel with nearby trees, glowing stalks, rocks, water, and denser silhouettes.

Expanded the generated pockets into larger start-area-like biome patches dotted around the globe, with heavier local clustering and sparse gaps between composed alien garden areas.

Added a trippy color-shifting planet fog and capped generated nature complexity by distance, keeping dense biome patches near the player while reducing far-off trees, reactive stalks, pools, streams, and colliders.

Guaranteed that the default spawn cell produces a dense generated biome patch close to the player start, keeping the opening view rich without bringing back a separate handcrafted start area.

Gave the small water-creatures a scared hop response: within an 8.5 metre player radius they flee away with roughly double hop height and speed, then settle back toward their water patrols after the player moves on.

Retuned the scared water-creature response so frightened hops cover more ground away from the player instead of mostly popping in place, with a looser water leash while scared.
