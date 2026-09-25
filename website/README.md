# Virtboard website

The landing page is a self-contained Node HTTP server with no runtime package dependencies. It includes product features, application screenshots, a sourced comparison and direct installer downloads. The Windows application runs on the visitor's PC; this container only hosts its website and installer.

## Run the published image

The image is published by `.github/workflows/website.yml` when a `v*` release tag is pushed:

```sh
mkdir -p data
# Copy Virtboard-Setup-0.2.0.exe into ./data, then:
docker compose up -d
```

Open http://localhost:8080. The included `compose.yaml` uses `ghcr.io/scopeddlol/virtboard-website:0.2.0` and mounts `./data` read-only at `/data` inside the container. Place an HTTPS reverse proxy in front when serving a public domain. The site uses relative links and needs no hostname configured.

GHCR packages may be private. Authenticate your deployment host to `ghcr.io` using an account with access and a token with `read:packages` before pulling a private image. Repository visibility is not changed by this workflow.

Equivalent container command:

```sh
docker run -d --name virtboard-website --restart unless-stopped \
  -p 8080:8080 --read-only --cap-drop ALL --security-opt no-new-privileges \
  -v "$(pwd)/data:/data:ro" ghcr.io/scopeddlol/virtboard-website:0.2.0
```

Or build from the checkout with `docker compose up -d --build`. The image supports Linux amd64 and arm64, runs as the unprivileged `node` user and listens on port 8080. The mounted folder and files must be readable by that user. `PORT` and `DATA_DIR` can override the defaults for custom deployments.

## Add or replace an installer

1. Put a nonempty `.exe` directly in `./data` on the host. Prefer `Virtboard-Setup-X.Y.Z.exe`.
2. The highest numeric X.Y.Z version is selected. If there are no versioned Virtboard installers, the most recently modified `.exe` is selected instead.
3. No rebuild or restart is needed. The website checks availability every 30 seconds; reloading updates it immediately.

Upload using a temporary suffix such as `.upload`, then rename to `.exe` when the copy is complete. That prevents a partly copied installer from becoming downloadable. Remove older installers if you no longer want their direct URLs to work.

Only nonempty regular `.exe` files with simple filenames are served from `/data`. Subdirectories, symlinks and unrelated files are excluded. The website has no upload endpoint. The application installer is never included in the image or fetched from GitHub at runtime. All visitor download buttons stay on this website.

Endpoints:

- `/`: landing page.
- `/api/download`: latest installer name, version when recognized, size and relative URL; `{ "available": false }` when empty.
- `/download`: redirects to the latest installer on this website, or returns 503 when none is present.
- `/downloads/<filename.exe>`: installer attachment, supporting HEAD and single byte ranges for resumed downloads.
- `/healthz`: container health check (healthy even when waiting for an installer).

## Development and checks

```sh
npm run website                 # default /data; set DATA_DIR for a local folder
npm test                        # routing/state regression tests + server tests
node scripts/website-ui.mjs      # desktop/mobile layout checks using Electron
```

The UI check starts its own ephemeral server and writes screenshots to `out/qa`. App screenshots are refreshed with `node scripts/website-screenshots.mjs` after `npm run build`; Linux requires `xvfb-run -a` for Electron.

Comparisons cite the vendors' own feature pages and intentionally avoid pricing or unsupported feature-absence claims. Website copy contains no private repository links or source-availability claims.
