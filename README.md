# Centauri Game

Lo-fi first-person exploration game set on an unknown planet. Built for agent-driven development with Symphony.

## Stack

- Vite + TypeScript for the browser game loop and build.
- Three.js for 3D rendering.
- Playwright for deterministic PR demo videos.
- GitHub Actions for build checks and `.webm` demo artifacts.

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
npm run demo:video
```

`npm run typecheck` is available as a stricter local check, but the initial CI gate is the Vite build plus the recorded Playwright demo.

The demo-video command records a Playwright `.webm` under `test-results/`.

On PRs, the `PR demo video` workflow uploads a `pr-demo-video` artifact and comments on the PR with the workflow-run link. GitHub does not display generated video artifacts inline in the PR by default.

## Agent workflow

Symphony configuration and instructions live under `symphony/`.

Future visual/gameplay PRs should keep the deterministic demo route useful so that reviewers can inspect the feature from the uploaded GitHub Actions artifact.

Useful docs:

- `docs/VISION.md`
- `docs/PR_DEMO_VIDEO.md`
- `symphony/WORKFLOW.md`
