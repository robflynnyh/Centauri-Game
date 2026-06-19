# Game Design

Centauri is a lo-fi first-person exploration game on an unknown planet.

Target mood: strange, quiet, colourful, gently trippy, and a bit lonely. It should feel more like wandering through an alien album cover than completing a checklist.

## Prefer

- First-person exploration.
- Simple, readable movement.
- Low-poly, flat-shaded, billboard, pixelated, or deliberately crude visuals.
- Weird plants, rocks, sky objects, weather, light, and sound-emitting landmarks.
- Environmental reactions to proximity, time, route, or gaze.
- Deterministic demo paths for visual review.
- Small changes that can be understood quickly from a PR video.

## Avoid for now

- Combat systems.
- Inventory and crafting.
- Quest logs.
- Dialogue-heavy NPCs.
- Realistic PBR asset pipelines.
- Heavy framework rewrites.
- Large binary assets.

## Implementation rule

For any visual or gameplay feature, make sure the reviewer can see it in the PR demo video. Update the `?demo=pr` path or add a dedicated deterministic demo route if needed.
