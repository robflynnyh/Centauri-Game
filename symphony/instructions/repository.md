# Repository

`src/` contains the playable browser game. Keep gameplay, rendering, controls, and demo logic here until the project is large enough to split into modules.

`tests/` contains Playwright tests. `tests/demo.spec.ts` records the deterministic PR flythrough.

`docs/` contains project notes. `docs/VISION.md` describes the intended feel and non-goals. `docs/PR_DEMO_VIDEO.md` explains the video artifact flow.

`.github/workflows/` contains CI and demo-video automation.

`symphony/` contains Symphony workflow configuration and instructions. `symphony/.env` is local-only and must not be committed.

`GAME_DIARY.md` records meaningful project changes, design decisions, prototype milestones, and validation notes. Append concise dated entries for nontrivial changes.

Keep large generated files, local recordings, dependency folders, build output, and temporary artifacts out of Git. Commit source changes and small docs only.

Prefer simple, inspectable code over engine-like abstractions. This repo is meant to be friendly to coding agents and easy to review in PRs.
