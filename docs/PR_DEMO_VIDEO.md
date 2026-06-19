# PR Demo Video Flow

Every feature PR should keep the demo route working:

```bash
npm run demo:video
```

Every feature PR should also keep the screenshot route working:

```bash
npm run demo:screenshot
```

Both commands open:

```text
http://127.0.0.1:5173/?demo=pr
```

The screenshot command captures `docs/demo/pr-preview.png`. The workflow commits that generated PNG back to the PR branch and inserts it into the PR description as a Markdown image.

The video command records a short deterministic flythrough. GitHub Actions uploads the resulting `.webm` files as the `pr-demo-video` artifact.

## Expected agent behaviour

For any visual/world/gameplay change, update one of these:

- the deterministic `?demo=pr` path in `src/main.ts`, or
- a future dedicated demo module under `src/demos/`, once the project grows.

The screenshot should make the PR immediately scannable. The video should show enough motion that a reviewer can tell what changed without pulling the branch locally.

## Local commands

```bash
npm install
npm run dev
npm run build
npm run demo:screenshot
npm run demo:video
```

## PR output

On PRs, the `PR demo video` workflow should:

1. generate `docs/demo/pr-preview.png`,
2. commit that screenshot back to the PR branch,
3. insert the screenshot into the PR body,
4. upload the zipped `pr-demo-video` artifact containing the `.webm` and screenshot,
5. comment with the workflow-run link.

GitHub does not embed Actions video artifacts directly in the PR conversation by default, so the still screenshot lives in the PR description and the full video remains a downloadable artifact.
