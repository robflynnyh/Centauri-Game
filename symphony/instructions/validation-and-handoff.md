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

The screenshot command should generate `docs/demo/pr-preview.png`. The demo-video command should generate a Playwright `.webm` artifact under `test-results/`. If either cannot be generated, document the exact blocker and command failure.

Commit completed changes on the issue branch.

Push the branch to `origin`.

Open a GitHub pull request against the issue base branch when provided, otherwise against `main`.

The PR body must include:

- Summary of the player-visible change.
- Validation commands run.
- Whether the PR screenshot and demo video were generated or why either could not be generated.
- Any residual risk or follow-up work.

The `PR demo video` workflow should update the PR body with a generated screenshot and comment with the workflow-run link for the full video artifact. If this does not happen, mention the missing preview explicitly in the handoff.

Include the PR URL in the Linear completion comment.

Move the issue to `In Review` only when the requested work is complete and the GitHub handoff has succeeded. Do not move Symphony-completed implementation work directly to `Done`; leave final acceptance to a human reviewer.
