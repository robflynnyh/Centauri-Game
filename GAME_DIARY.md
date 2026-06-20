# Game Diary

## 2026-06-20

Added rare deterministic flying beetles as small ambient wildlife, with gentle wandering paths near natural patches and a short update radius so distant beetles stay inactive.

Added `?debug=beetle` as a focused spawn route near the starter beetle so the rare wildlife can be inspected without searching the planet.

Added gentle beetle obstacle avoidance that steers and lifts their flight away from solid trees and rocks, plus a debug smoke check for visible beetle clearance.

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

Rebuilt the lo-fi render direction around a low-resolution whole-scene render target upscaled with nearest filtering, disabled WebGL antialiasing, and retuned terrain colour boundaries into broader block-stepped regions without repainting the existing palette.

## 2026-06-20

Added one deterministic strange temple landmark to the spherical planet, with a reserved generation clearance, collision, a `?debug=temple` review spawn, PR-demo visibility, and an intermittent proximity colour phase through the sky and fog system.

Reworked the temple landmark into chunkier ancient alien ruins: layered round bases, a broken stellar-gate silhouette, glyph panels, fallen slabs, ruined columns, and reclaimed alien foliage so it reads less like a plain tower.

Simplified the temple again after visual review feedback so it reads as one composed Proteus-like landmark at screenshot scale: a squat stepped plinth, one chunky broken ring, a few broad glyph panels, large vine ribbons, and minimal supporting slabs.

Balanced the temple between the detailed ruin pass and the abstract simplified pass by keeping the strong plinth-and-ring silhouette while restoring a few large readable ruin elements, including chunky broken columns and clearer glyph blocks.

Rebuilt the temple's central facade with custom trapezoid prism silhouettes instead of a dark backing cube, keeping the broken gate open and bright while using broad pylons, stone planes, and a few large ruin details.

Made the camera-anchored sky respond to spherical planet location with deterministic regional palette tints, celestial offsets, ring tilt, meteor-field rotation, and reversible debug coverage.

Reworked the location sky so day and night come from the current planet surface normal against a slowly rotating sun direction, producing a moving terminator instead of a global day/night fade.

Updated the PR flythrough to visit sun-facing, twilight, and night-side planet regions so the location-based day/night model is visible in review footage.

Rebuilt the sky model around smooth planet-relative gradients and stable celestial directions so planets, rings, and meteors sit in a coherent sky sphere instead of camera-local colour bands.

Added a restrained isolation-vision postprocess that fades in when the player is far from generated biome patches, with a deterministic debug route and PR-demo beat for review.

Retuned the isolation-vision pass after review so the doubled horizon and colour phase are plainly visible in debug captures and the PR demo, then added a rendered-frame comparison test for the postprocess.

Retuned the isolation trigger for normal exploration density so deterministic wilderness reached from non-demo debug play can fade into the visible effect while the starter biome remains clear.
