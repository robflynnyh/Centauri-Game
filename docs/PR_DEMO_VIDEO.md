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

The video command records a short deterministic flythrough. The workflow copies the generated `.webm` to `docs/demo/pr-demo.webm`, commits it back to the PR branch, and inserts a direct WebM link into the PR description. It also uploads the full `pr-demo-video` artifact as a fallback.

## Expected agent behaviour

For any visual/world/gameplay change, update one of these:

- the deterministic `?demo=pr` path in `src/main.ts`, or
- a future dedicated demo module under `src/demos/`, once the project grows.

The screenshot should make the PR immediately scannable. The WebM should show enough motion that a reviewer can tell what changed without pulling the branch locally.

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
2. generate/copy `docs/demo/pr-demo.webm`,
3. commit those demo assets back to the PR branch,
4. insert the screenshot and direct WebM link into the PR body,
5. upload the zipped `pr-demo-video` artifact as a fallback,
6. comment with the workflow-run link.

GitHub does not reliably embed WebM video players from Actions artifacts inside the PR conversation. The intended review surface is therefore: screenshot inline in the PR body, direct WebM link in the PR body, zipped artifact as fallback.
