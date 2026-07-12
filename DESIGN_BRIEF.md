# Bunella Homepage — Admin redesign brief

## Product in one paragraph
"Bunella Homepage" is a personal browser start-page: visitors see a single full-screen
background image (with just a small gear button linking to admin). The **admin page** is a
single-user control panel to manage a library of background images and tune how the homepage
displays them (rotation vs. single image, slideshow, framing/cropping, accent color, etc.).
It's a hobby/home-lab tool, desktop-first, used on a **widescreen monitor**.

## The problem to solve
The current admin scatters controls and preview across a tall, scrolling single page: settings
in a left column, a small "live preview" in a right sidebar, and the image **library grid
full-width below the fold**. As a result:

- When I change a setting, toggle slideshow, pick an accent, or add/remove images from the
  rotation, **I can't see the preview update** — it's offscreen and I have to scroll around.
- It's **not inherently obvious that my edits drive the preview** (cause → effect is broken by distance).
- The layout **wastes horizontal space** on a widescreen.

**Design goal:** a layout where a **persistent, always-visible live preview** reflects my edits
in real time as I work — choosing images, changing display/slideshow/render settings, accent
color, rotation membership, etc. Make the widescreen work for me (side-by-side, panes, etc.).
Everything currently auto-saves (debounced), so there's no "Save" button to design around —
edits apply immediately.

## Everything that needs a home in the layout

**Global / chrome**
- Brand/title, library **stats** (image count, variant count, originals size, cache size)
- Auto-save status ("Saving…/Saved")
- Account menu: open homepage, change password, clear image cache, sign out

**Display settings**
- Display mode: **Rotation** vs **Single image** (mutually exclusive)
- Single-image picker (only in Single mode)
- **Slideshow** (Rotation only): on/off, interval value + unit (sec/min), advance mode
  (random / sequential / shuffle)
- **"Resize for the screen"** (server-side render to a target size): on/off, width, height,
  crop position (center/east/west/north/south)
- Page title (browser tab text), Image fit (cover/contain/fill/scale-down)
- Homepage **accent color** (7 swatches)

**Uploads**: drag-drop / file picker, upload queue, duplicate warnings

**Library** (the big one): grid of image cards, with
- Filters (all / rotation / favourites / landscape / portrait / recent), filename search,
  select-filtered / clear
- Bulk actions on selection: add/remove rotation, favourite/unfavourite, clear cache, delete
- Per-card: favourite (star), select, **preview this image**, use-as-single, toggle rotation,
  clear cache, delete, and (in sequential slideshow) move up/down to set order

**Preview**: an admin-only mockup styled as a small browser window, showing the chosen image
with the current framing (fit, render size, crop, mode).

## Important semantics / gotchas
- **Favourite (star) is purely an organizational tag** for the Favourites filter — it does NOT
  affect what the homepage shows.
- **Preview is a mockup**, not the live site; clicking a card's "Preview" selects *which* image
  fills the preview. It reflects **draft** settings live.
- **Rotation membership + order** is what actually drives the homepage; sequential order is set per-card.
- Backgrounds are **widescreen landscape** (default render target ~1536×930, ≈16:10). Preview
  aspect should follow the render target.
- Typical scale: **tens of images** (not thousands), single user, low concurrency.

## Tech & visual constraints (so designs are buildable)
- **React 18 + TypeScript + Vite + Tailwind CSS v3**. No UI component library; a small custom
  **inline-SVG icon set** (no icon dependency).
- Existing visual language is **Apple HIG dark**: SF system font; layered "system gray" materials
  (`#1c1c1e / #2c2c2e / #3a3a3c`); system blue/green/red/orange accents; grouped inset lists;
  iOS switches; segmented controls; ~10–14px radii; subtle vibrancy/blur. Keeping this aesthetic
  is preferred but not mandatory — improving the *layout/IA* is the priority.
- Desktop-first (widescreen), but should degrade to a stacked single-column on narrow widths.
- Backend is a simple REST API (Express + SQLite + sharp); no realtime/websockets — preview
  updates are client-side from the in-memory draft, which is instant.

## What to preserve
- Auto-save (no manual save), the consolidated gear/account menu, and the browser-window framing
  of the preview are recent wins — keep the spirit.
- All the functionality above must remain reachable; the ask is **better spatial organization**,
  above all **a live preview that's always in view while editing**.

## Open for ideas
Layout is wide open: e.g. a fixed preview pane beside scrollable controls, a preview that pins
while the library scrolls, an "editor + canvas + inspector" three-pane model, a library rail,
etc. Suggest 2–3 distinct directions with trade-offs.

---

# Appendix — concrete data model & code map

### Frontend files
- `frontend/src/pages/AdminPage.tsx` — the entire admin UI (controls, library, preview, account menu).
- `frontend/src/pages/HomePage.tsx` — the public homepage (full-screen image + gear button).
- `frontend/src/components/Icons.tsx` — inline-SVG icon set (stroke-based, `currentColor`).
- `frontend/tailwind.config.js` — Apple design tokens (`apple.*` colors, `font-sf`, radii).
- `frontend/src/index.css` — base styles, SF font stack, dark color-scheme.
- Routing: React Router — `/` → HomePage, `/admin` → AdminPage.

### Auth
- HTTP Basic on protected routes: `Authorization: Basic base64("admin:" + password)`.
- `POST /api/login` `{ password }` → 200/401. Password stored client-side in `localStorage`.

### API routes
Public:
- `GET /api/image` — the current image to show (respects mode/rotation).
- `GET /api/rotation-images` — ordered list of in-rotation images.
- `GET /api/public-settings` — settings needed by the homepage.
- `GET /api/images/:id/render?w=&h=&position=` — sharp-rendered/cropped variant (cached).
- `GET /images/:filename` — original file (static).

Protected (require auth):
- `GET /api/images` — full library.
- `GET /api/settings` / `PUT /api/settings` — read/update settings (PUT accepts partial; also
  `{ new_password }` to change password). Returns the full settings object.
- `GET /api/stats` — `{ image_count, variant_count, total_original_size, total_variant_size }`.
- `POST /api/upload` (multipart, field `images`) → `{ uploaded[], failed[], duplicates[] }`.
- `PUT /api/images/:id` — patch `{ in_rotation?, favourite?, rotation_order? }`.
- `PUT /api/images/order` — `{ orderedIds: number[] }` (sequential rotation order).
- `POST /api/images/bulk` — `{ ids: number[], action }` where action ∈
  `enable-rotation | disable-rotation | favourite | unfavourite | delete`.
- `DELETE /api/images/:id`.
- `POST /api/cache/clear` — body `{}` (all) or `{ imageIds: number[] }` → `{ stats }`.

### Settings object (the editable state; preview reads this live)
```ts
interface Settings {
  display_mode: 'rotation' | 'single'
  single_image_id: number | null
  color_scheme: 'teal'|'blue'|'purple'|'pink'|'green'|'orange'|'red'   // homepage accent only
  page_title: string                                                    // browser tab title
  image_fit: 'cover' | 'contain' | 'fill' | 'scale-down'
  render_enabled: boolean                                               // "Resize for the screen"
  render_width: number | null
  render_height: number | null
  render_position: 'center' | 'east' | 'west' | 'north' | 'south'       // crop anchor
  slideshow_enabled: boolean                                            // rotation mode only
  slideshow_interval_value: number
  slideshow_interval_unit: 'seconds' | 'minutes'
  slideshow_advance_mode: 'random' | 'sequential' | 'shuffle'
}
```

### Image object
```ts
interface Image {
  id: number
  filename: string            // on-disk name, served at /images/<filename>
  original_name: string       // display name
  upload_date: number         // epoch ms
  in_rotation: number         // 0 | 1   → drives the homepage
  width: number | null
  height: number | null
  file_size: number | null    // bytes
  content_hash: string | null // for duplicate detection
  rotation_order: number | null // sequential slideshow order
  favourite: number           // 0 | 1   → organizational tag only (Favourites filter)
}
```

### Preview URL logic (how the preview/homepage build an image src)
```ts
// If render is enabled with a target size → request the sharp variant; else the original.
const url = settings.render_enabled && settings.render_width && settings.render_height
  ? `/api/images/${image.id}/render?w=${w}&h=${h}&position=${settings.render_position}`
  : `/images/${image.filename}`
```
