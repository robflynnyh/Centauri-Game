# PR Demo Video Flow

Every feature PR should keep the demo route working:

```bash
npm run demo:video
```

The Playwright test opens:

```text
http://127.0.0.1:5173/?demo=pr
```

and records a short deterministic flythrough. GitHub Actions uploads the resulting `.webm` files as the `pr-demo-video` artifact.

## Expected agent behaviour

For any visual/world/gameplay change, update one of these:

- the deterministic `?demo=pr` path in `src/main.ts`, or
- a future dedicated demo module under `src/demos/`, once the project grows.

The demo does not need to show every detail. It should show enough that a reviewer can tell what changed without pulling the branch locally.

## Local commands

```bash
npm install
npm run dev
npm run build
npm run demo:video
```

## CI artifact

On PRs, open the `PR demo video` workflow run and download the `pr-demo-video` artifact.
