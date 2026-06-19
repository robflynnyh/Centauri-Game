# Centauri Game

Lo-fi first-person exploration game set on an unknown planet. Built for agent-driven development with Symphony.

## Stack

- Vite + TypeScript for the browser game loop and build.
- Three.js for 3D rendering.
- Playwright for deterministic PR screenshots and demo videos.
- GitHub Actions for build checks and downloadable demo artifacts.

## Local setup

```bash
npm install
npm run dev
```

Open the printed localhost URL.

Manual controls:

- `WASD` to walk.
- Drag the mouse to look.

Deterministic PR demo route:

```text
/?demo=pr
```

## Validation

```bash
npm run build
npm run demo:screenshot
npm run demo:video
```

`npm run typecheck` is available as a stricter local check, but the initial CI gate is the Vite build.

The screenshot command writes `docs/demo/pr-preview.png`. The video command records a Playwright `.webm` under `test-results/`. Generated demo media is ignored by Git and should not be committed.

On PRs, the `PR demo assets` workflow uploads the generated screenshot/video as a downloadable artifact and comments with the workflow-run link.

## Agent workflow

Symphony configuration and instructions live under `symphony/`.

Future visual/gameplay PRs should keep the deterministic `?demo=pr` route useful so reviewers can inspect the downloadable demo artifact without pulling the branch locally.

Useful docs:

- `docs/VISION.md`
- `docs/PR_DEMO_VIDEO.md`
- `symphony/WORKFLOW.md`
