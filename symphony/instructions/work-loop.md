# Work Loop

Inspect repo state and task context before editing.

Make a concise plan.

Identify validation for the specific change before editing.

If the issue description includes `Branch/ref: <name>`, fetch and check out that branch or ref before editing.

Confirm the checked-out commit with:

```bash
git status
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```

Create a working branch named `symphony/<issue-identifier>-<short-slug>` from the checked-out base branch. Do not commit directly to the base branch.

Keep edits narrowly scoped to the issue.

For visual/gameplay work, prefer extending the existing scene and demo path before creating new architectural layers.

During nontrivial work, periodically post concise Linear progress comments for meaningful implementation progress, design decisions, blockers, or validation changes.

Before each Linear progress or completion comment, re-fetch recent comments and incorporate any new human reply first.

If a change is partial, blocked, or only a prototype, label it clearly as such in the PR and Linear handoff.
