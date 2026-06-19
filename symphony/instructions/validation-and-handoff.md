# Validation And Handoff

Run the most targeted command or test that demonstrates the task is complete.

For docs-only changes, run:

```bash
git diff --check
```

For code changes, run at least:

```bash
npm run build
```

For visual or gameplay changes, also run:

```bash
npm run demo:screenshot
npm run demo:video
```

The screenshot command should generate `docs/demo/pr-preview.png`. The demo-video command should generate a Playwright `.webm` under `test-results/`.

Every gameplay or visual PR body must include the generated PR screenshot directly as a visible Markdown image. Keep the tracked `docs/demo/pr-preview.png` current when the screenshot changes so the PR description can embed the branch image. Keep generated video files as local/CI artifacts; do not commit video files unless a human explicitly requests that exception.

Commit completed source, test, workflow, and documentation changes on the issue branch.

Push the branch to `origin`.

Open a GitHub pull request against the issue base branch when provided, otherwise against `main`.

The PR body must include:

- Summary of the player-visible change.
- The generated PR screenshot as a visible Markdown image.
- Validation commands run.
- Whether screenshot/video generation was run locally or left to CI.
- Any residual risk or follow-up work.

The `PR demo assets` workflow uploads generated screenshot/video artifacts and comments with a workflow-run link. Do not add branch-mutating CI just to commit generated media back to the PR.

Include the PR URL in the Linear completion comment.

Move the issue to `In Review` only when the requested work is complete and the GitHub handoff has succeeded. Do not move Symphony-completed implementation work directly to `Done`; leave final acceptance to a human reviewer.
