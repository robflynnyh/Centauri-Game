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

The screenshot command should generate `docs/demo/pr-preview.png`. The demo-video command should generate a Playwright `.webm` under `test-results/`. These are generated artifacts and should not be committed.

Commit completed source, test, workflow, and documentation changes on the issue branch.

Push the branch to `origin`.

Open a GitHub pull request against the issue base branch when provided, otherwise against `main`.

The PR body must include:

- Summary of the player-visible change.
- Validation commands run.
- Whether screenshot/video generation was run locally or left to CI.
- Any residual risk or follow-up work.

The `PR demo assets` workflow uploads generated screenshot/video artifacts and comments with a workflow-run link. Do not add branch-mutating CI just to commit generated media back to the PR.

Include the PR URL in the Linear completion comment.

Move the issue to `In Review` only when the requested work is complete and the GitHub handoff has succeeded. Do not move Symphony-completed implementation work directly to `Done`; leave final acceptance to a human reviewer.
