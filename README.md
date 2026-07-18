# Homepage Bunella

`homepage-bunella` is a self-hosted image homepage with an admin UI for uploads, rotation, layout controls, and generated render variants.

It combines an Express backend, a Vite frontend, SQLite state, and Sharp-based image processing so the home screen can run as either a single-image display or a managed slideshow.

## Features

- Password-protected admin bootstrap
- Image uploads with metadata and rotation ordering
- Single-image and rotating display modes
- Configurable color scheme, page title, and image fit
- Optional rendered variants for fixed display dimensions
- Slideshow timing and advance-mode controls

## Stack

- Node.js + Express backend
- Vite frontend under `frontend/`
- SQLite via `better-sqlite3`
- Image processing with `sharp`

## Important Environment

- `HOMEPAGE_BUNELLA_BOOTSTRAP_PASSWORD` required on first run
- `PORT` default `3000`
- `DATA_DIR` default `/app/data`
- `IMAGES_DIR` default `/app/images`
- `VARIANTS_DIR` default `/app/variants`

## Development

```bash
npm install
cd frontend && npm install && cd ..
HOMEPAGE_BUNELLA_BOOTSTRAP_PASSWORD=replace-with-long-secret npm run dev
```

## Build

```bash
npm run build
docker build -t homepage-bunella .
```

## Files

- `src/server.ts` backend and image pipeline
- `frontend/` browser UI
- `Dockerfile` production image
- `DESIGN_BRIEF.md` product/design notes
