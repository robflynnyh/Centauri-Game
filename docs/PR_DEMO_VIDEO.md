# PR Demo Asset Flow

Every visual/gameplay PR should keep the deterministic demo route working:

```text
http://127.0.0.1:5173/?demo=pr
```

The route should show enough of the changed feature for reviewers to understand it without running the game locally.

## Local commands

```bash
npm install
npm run dev
npm run build
npm run demo:screenshot
npm run demo:video
```

`npm run demo:screenshot` captures:

```text
docs/demo/pr-preview.png
```

`npm run demo:video` records a Playwright `.webm` under:

```text
test-results/
```

Generated screenshot/video files are local artifacts. They are ignored by Git and should not be committed.

## PR output

On PRs, the `PR demo assets` workflow:

1. runs the screenshot command,
2. runs the video command,
3. uploads the generated files as a downloadable `pr-demo-assets` artifact,
4. comments on the PR with the workflow-run link.

GitHub does not reliably embed generated WebM videos directly in PR descriptions. The clean repository policy is therefore: keep deterministic demo code in Git, keep generated media out of Git, and use workflow artifacts for review media.

## Agent rule

For any player-visible change, update the deterministic `?demo=pr` route or add a dedicated demo route/module if the project has grown enough to justify it.
