# Game Diary

## 2026-06-27

Added a massive three-dish radio telescope array on a flat reserved site, with separate dish directions, precise base collision, `?debug=radio`/`?debug=radio-telescope`, PR-demo visibility, and a collection-order field note.

## 2026-06-26

Added Shift sprinting with a compact stamina HUD, Ctrl/C-only crouch, walking/idle stamina recovery, and a running fatigue multiplier so sleep drains faster during sustained exertion.

Deepened the star pass with layered full-dome pixel-cloud ribbons, glow-backed glints, stronger slow twinkle, and a steeper PR-demo sky gaze so the night sky feels richer and more alive without turning into random star noise.

Added Amethyst Abyss as a third large swimmable ocean, with its own violet palette, carved basin depth, shared chunked rendering path, and `?debug=purple-ocean`/`?debug=ocean3` inspection routes.

## 2026-06-25

Added a deterministic hillside paramotor near the starting area, with a low-poly frame, canopy, propeller, mount prompt, gas/throttle/altitude HUD, forgiving spherical-planet flight, landing back to walking, `?debug=paramotor`, and PR-demo visibility.

## 2026-06-23

Added patterned twinkling star clusters to the night sky, replacing the even star spray with small alien constellation shapes that fade down during day and stay subtle in the lo-fi sky.

Adjusted the observatory follow-up so the raised platform has a walkable height surface, the telescope marker is a single simple shard glyph, and unattached upright platform blocks are removed.

## 2026-06-22

Added two large irregular swimmable oceans to the spherical planet, with carved deep basins, chunked ocean-surface rendering, slower in-water movement, underwater tinting, and a focused `?debug=ocean` review route.

Retuned ocean rendering after review so the water keeps a lo-fi shimmer without obvious large square mesh tiles, using a finer shared vertex grid, per-vertex color, and continuous subtle ripple.

Grounded ocean shorelines after review by blending low outside banks up toward the water surface and fading/clipping shoreline water vertices, preventing partial shoreline cells from reading as floating sheets.

Slightly reduced player gravity so jumps and falls feel a touch floatier while keeping the existing movement model intact.

Refined the observatory follow-up with terrain-contact foundation supports, a walkable platform with smaller pier/telescope blockers, hidden telescope geometry during scoped view, and a non-cross astronomical field-note glyph.

Added debug-only performance instrumentation for frame/render/memory/object counts and terrain/nature rebuild timings, then removed obvious movement and sky update scratch allocations without changing gameplay or visuals.

Reduced chunk-boundary stalls by reusing terrain and ocean chunks across the visible window, added ocean rebuild timing to perf debug, and covered one-chunk moves with an incremental update regression test.

## 2026-06-21

Removed the hard water-distance cap from scared water-creature flee hops so chased frogs can keep escaping beyond their normal patrol radius, while calm return hops still guide them back toward water once danger passes.

Made sleep drain scale with exertion: idle standing drains slowest, crouch-walking drains gently, normal movement uses the intended play drain, and airborne/jump frames spike fatigue faster while preserving hold-still rest behavior.

Changed sky time to come from planet spin: the sun, stars, planets, ring, and meteors now project through a spun sky frame so they rise and set at a fixed location while the demo includes a fixed-position sky watch beat.

Added sparse mountain birds as tiny curved V-shaped flocks that circle high ridges, flee upward and away from nearby focus/player movement, expose `?debug=birds`, and appear in the deterministic PR demo for review.

Distributed mountain bird flocks across repeated high-ridge regions so longer exploration can reveal more mountain-only bird groups beyond the initial debug/start flock.

Added a single alien observatory landmark with a discoverable collection-order field note, an interactable zoomed telescope mode, `?debug=observatory`/`?debug=telescope` review routes, and PR-demo visibility.

## 2026-06-20

Added a slow sleep meter as a small red HUD bar, with hold-still sleeping to refill it and a recoverable dark pass-out state when fatigue reaches zero.

Added a calm eyelid close/open overlay for voluntary sleep, keeping it distinct from the zero-sleep blackout while making rest feel more intentional in the PR demo.

Retuned ground mist distance falloff so nearby low wisps remain spooky while mid/far patches fade harder, especially on rough high terrain and cliff silhouettes.

Tightened the mist review follow-up with a shorter hard distance cutoff, zeroed hidden-patch alpha, and a debug assertion that far mist patches are fully culled from normal walking views.

Changed ground mist into a strictly local near-player atmosphere by reducing patch generation scope and culling distinct wisps before they can read across distant terrain.

Matched demo and normal mist fade/cull distances so the PR flythrough uses the same local-only mist range as ordinary play.

Stabilized local mist patch generation across chunk boundaries by keeping deterministic chunk-keyed patches alive while visible instead of clearing and reseeding the whole mist field.

Rebuilt ground mist from scratch as sparse low drifting terrain-following wisps, using deterministic chunk placement biased toward lowlands and water-like terrain without cube particles or camera-facing billboards.

Retuned the ground mist after review so it is clearly visible in normal play and the PR demo while staying as low terrain-hugging vapour bands instead of object-like particles.

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

Fixed shortcut-driven tab return input cleanup so stale held modifier keys do not leave the player crouched and unable to jump after returning to pointer-lock play.

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

Added a lightweight field-notes system with a compact HUD panel, a small discoverable temple glyph marker, debug state for note discovery, and deterministic temple-debug coverage for recovering the first sparse temple note.

Integrated recovered field-note status back into the original top-left HUD surface so the temple fragment reads as part of one coherent field-note card instead of a separate overlay.

Reframed the HUD as the current field-note page itself: the initial expedition text is Field Note 001, and discovering the temple glyph advances the same card to Field Note 002 instead of showing recovered-note inventory status.

Added a restrained isolation-vision postprocess that fades in when the player is far from generated biome patches, with a deterministic debug route and PR-demo beat for review.

Retuned the isolation-vision pass after review so the doubled horizon and colour phase are plainly visible in debug captures and the PR demo, then added a rendered-frame comparison test for the postprocess.

Retuned the isolation trigger for normal exploration density so deterministic wilderness reached from non-demo debug play can fade into the visible effect while the starter biome remains clear.

Added sparse wilderness seaweed patches as flat green reactive blade sprites that only spawn away from dense biome clusters on flatter ground, with nearby player movement freezing their gentle shimmer and a PR-demo close-up for review.

Retuned the wilderness seaweed after review so each flat blade has an organic static bend even when frozen, and suitable sparse areas receive a few more patches and blades without relaxing biome or slope constraints.

Reworked scared water-creature hops as per-creature committed state machines on latest main: each scared hop now starts from anticipation at phase zero, drives horizontal travel and vertical arc from the same local progress, and only retargets after landing.

Tightened scared water-creature movement so frogs choose obstacle-clear forward landings, reject hop paths through solid blockers, and return to their patrols via planted hops instead of sliding along the ground.

## 2026-06-22

Added one massive planet-local mountain as terrain height-field geometry, with a broad climbable summit, a switchback-like carved path, a `?debug=mountain` spawn, generated-nature clearance along the route, and PR demo/screenshot coverage focused on the new landmark.

Followed review feedback by keeping normal generated biome clusters off the massive mountain footprint and adding general terrain-slope slipperiness, with the massive mountain path overriding that slip so it remains the reliable climb route.

Retuned the slope slipperiness so the mountain path is smooth enough to climb without a hard zero-slip exemption, and added a general grounded step-rise guard to avoid sudden camera pops on steep terrain discontinuities.

## 2026-06-23

Added a deterministic prismatic diamond biome with terrain-integrated pale spectral ground, many small embedded crystal fragments, a `?debug=diamond` review spawn, local half-gravity, and a smooth low-res prism vision pass that appears only inside the biome.

Generalized the diamond biome into three deterministic planet regions with shared sampling/rendering helpers, distinct cyan and rose mineral variants, explicit debug spawns, and progressively lighter local gravity.

## 2026-06-25

Made active sleep/rest advance the shared game-time sky clock at 8x speed while composing with the existing glass-dome time multiplier and leaving the sleep meter, eyelids, blackout, and controls intact.

## 2026-06-26

Added a stable README screenshot capture for the starter tree-biome landscape so repository visitors can see the current lo-fi exploration look without relying on transient PR demo artifacts.
