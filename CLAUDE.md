# Finley's Coloring Book: project guide for Claude

A free coloring app (a replacement for "Pigment") for Finley's iPad Pro 11" with Apple Pencil 2
(pressure + tilt). Built by Owen (GitHub: deweyzx) with Claude, one tested step at a time.

**Keep this file current:** when a step is finished and committed, update "Where we are", the step
table, and any decisions that changed.

## Where we are

- **Done and committed:** steps 1–6, including gesture tuning for Finley. Everything works on her
  iPad: one-finger coloring, 2-finger tap undo, 3-finger tap redo, pinch zoom, two-finger drag,
  and no interference from her hand resting on the screen while using the Pencil.
- **In progress:** step 7, auto-save + progress in the library.

## How to work with Owen

- He's a beginner (one semester of Python), on Windows 10. Explain things simply, in plain words,
  and explain each new tool or concept before using it.
- **One step at a time:** build a step, test it yourself (browser pane, real pages), tell Owen
  exactly how to test it, then **wait for his report**.
- **Commit only after Owen says a step works.** He tests on PC, then you commit + push, then he
  checks on the iPad. Never commit before his OK.
- Test on his **real pages** (Flowers > Daffodils, Tiger Lilies), zoomed in. He cares about leaks,
  white gaps and halos. When fixing visual issues, show before/after crops.
- Be honest about trade-offs and anything not verified.

## Rules for the code

- **Plain HTML, CSS and JavaScript.** No frameworks, no build tools, no npm. Files run as-is in a
  browser. JavaScript uses ES modules (`<script type="module">`), plus one classic web worker.
- Must work in **Safari on iPad** (and Chrome on Windows for testing). Large touch targets
  (buttons 52px, swatches 44px). Works upright and sideways.
- **All colors, fonts and sizes** are CSS variables at the top of `css/styles.css` (`:root`).
  Never hard-code a color or font elsewhere; the storybook restyle (step 12) depends on this.
- **Tweakable behavior numbers** live in `js/settings.js`, with plain-English comments.
- Comments in code are written for a beginner: say what and why in plain words.
- Every element has `touch-action: manipulation` (no Safari double-tap zoom, no tap delay); the
  drawing area and slider tracks use `touch-action: none` because the app handles those touches.
  Safari ignores `user-scalable=no` for double-tap zoom, so don't rely on the viewport tag.
- Paths are relative (the site lives under `/finley-coloring/` on GitHub Pages).

## Step plan

| Step | What | Status |
|---|---|---|
| 1 | App shell, gallery, open a page | ✅ |
| 1b | Library: categories → sub-categories → pages, cached thumbnails | ✅ |
| 2 | Online via GitHub Pages | ✅ |
| 2b | Python import tool for messy pages (+ ready-made thumbnails) | ✅ |
| 3 | Tap-to-fill with gap closing + basic palette and toolbar | ✅ |
| 4 | Brush engine: pencil, marker, eraser; size + opacity sliders, live preview; pressure + tilt; line-lock | ✅ |
| 5 | Undo / redo (big back/forward buttons) | ✅ |
| 6 | Pinch-zoom, two-finger pan, palm rejection; 2-finger tap undo, 3-finger tap redo | ✅ |
| 7 | Auto-save (IndexedDB) + her progress shown on library thumbnails | in progress |
| 8 | Full color picker: hue ring + saturation/brightness square, recent colors, named saved palettes | |
| 9 | Export the finished picture to Photos | |
| 10 | Brush collection: colored pencil, crayon, watercolor, airbrush, glitter/sparkle | |
| 11 | Installable + offline (manifest, service worker, icons) | |
| 12 | Magical storybook look, Themes, polish | |

### Notes for future steps

- **Step 7:** IndexedDB already has an `artwork` store (unused) in `js/storage.js`. Save per page
  id. Library cards should then show her colored version instead of the blank thumbnail.
- **Step 8:** Pencil-friendly hue ring + saturation/brightness square, recently used colors,
  saved palettes she can name and switch between (store in IndexedDB; adding a store means
  bumping `DB_VERSION`). `js/palette.js` holds the 24 default swatches.
- **Step 11:** the service worker must cache pages and thumbnails; plan for updates (version the
  cache) since GitHub Pages also caches files for ~10 minutes.
- **Step 12, fairy-tale UI + Themes:** the default theme is the magical storybook look: soft
  pastels with gold accents, gentle sparkle effects on taps and when a page is finished, a
  whimsical but readable title font (`--font-title`), and a library that feels like a magical book
  or enchanted shelf. Calm, not cluttered; keep buttons large. Add a **"Themes" button on the
  library (home) screen** that switches the look of the whole app: colors, fonts, backgrounds and
  sparkle effects. Theme ideas: "Storybook" (default), a dark "Midnight Forest", "Ocean Dreams",
  "Autumn Cottage", and a clean minimal one. Remember her choice (localStorage). Plan: each theme
  is one block of CSS variables, e.g. `:root[data-theme="midnight-forest"] { ... }`, plus a small
  JS settings object for non-CSS parts (sparkle style, background art). Keep ALL colors, fonts,
  backgrounds and effect settings as variables so a new theme = one new block. The coloring
  page itself always stays white paper.

## Brushes (step 4)

- **Brush = a definition object** in `js/brushes.js` (`BRUSHES`): name, icon (inner SVG markup),
  `sizeRange`, `defaults` {size, opacity}, `hardness`, `spacing`, `pressure` {size:[min,1],
  opacity:[min,1], curve}, `tilt` {widen, opacity, grainFill}, `grain` {strength, fill:[light,full]}
  or null, `paint` "color" | "paper". **Adding a brush (step 10) = adding one entry**; the tool
  button is created automatically. Step 10 brushes (watercolor, airbrush, glitter) may need new
  engine features (e.g. wet edges, scatter, sparkle color) - add them as new optional fields.
- **Stroke engine** (`js/stroke-engine.js`): stamps evenly spaced dabs, interpolating pressure and
  tilt. Each stroke writes into a per-stroke coverage map using **MAX**, so a stroke never darkens
  where it overlaps itself (no blotches). It's shown live on `#stroke-canvas` (between color and
  line art) once per animation frame, and on Pencil-up is drawn onto the color canvas
  (source-over), so **separate strokes build up** for layered shading.
- **Pressure works under the sliders:** the slider value is the maximum; lighter pressure scales
  size and opacity down to the `pressure` minimums. Mouse and finger draw at full value.
- **Tilt** (from `altitudeAngle`, or computed from `tiltX/tiltY`): past ~30° of lean the dab
  becomes an oval across the lean direction, wider, lighter and grainier (side-of-the-lead shading).
- **Pencil grain:** an original procedural paper-tooth texture (256² tile, fixed to the page so
  layered strokes share the same tooth). Light pressure only reaches grain peaks; heavy pressure
  fills ~80%. Marker and eraser have no grain (smooth).
- **Eraser** paints the paper color (white) back onto the color layer; the line art is untouched.
- **Each brush remembers its own size and opacity** in `localStorage` ("brush-settings").
- **UI:** custom Pencil-friendly sliders (`js/slider.js`, tap or drag anywhere on the 40px-tall
  track; the size slider has a squared curve for fine control at small sizes) and a live preview
  canvas (current brush, at its on-screen size, color and opacity, drawn light → full pressure).
  With Fill selected, the sliders fade out and the preview shows the color.
- Picking a color while the eraser is selected switches back to the last color brush.
- **"Build up color" switch** (under "Stay inside lines"; on by default; `localStorage`
  "build-up"; added from Finley's feedback). On: a new stroke over color deepens it. Off: going
  over a spot already painted in the **same color** only adds what's missing to reach the
  stroke's opacity, so touch-ups stay even; a different color paints over normally. This uses the
  engine's **paint memory** (`engine.memory`, 4 bytes per pixel: RGB of the last paint + its
  strength 0-255, updated by `remember()` after strokes and `rememberFill()` after fills). With
  build-up off, `render()` shows each pixel at `(c - had) / (255 - had)` over what's there, so the
  live stroke and the result match exactly. Works for every brush, eraser included.
- **Line-lock** ("Stay inside lines" switch under the tool buttons; **on by default**, remembered in
  `localStorage` "line-lock"): when a stroke starts, `findLockArea()` in `js/editor.js` asks the fill
  worker for exactly the area a tap-to-fill from that point would cover (same gap closing, thin
  slivers, tuck under lines, and snapping to the nearest area within `tapReach` when starting on a
  line). The engine then paints only inside that mask (`engine.setClip(area)`; checked per pixel in
  `dab()`), so it works for every brush, eraser included, and any future brush automatically.
  Pencil samples that arrive before the area is ready wait in `stroke.pending` and are drawn when it
  arrives; a stroke lifted before then finishes as soon as it does. Lookup: 3–8 ms for typical
  areas, ~190 ms (PC) for the whole-page background, so on the iPad the ink can appear a moment
  late when starting in the background. A stroke starting outside every area draws nothing.
  Fill ignores line-lock (the switch fades while Fill is selected).
- **Faster big areas:** the fill worker remembers the last 6 areas of 20,000+ pixels (`cache`,
  matched by the tap landing in the area's flood "core" with the same settings), and right after a
  page opens, `warmUp()` works out the areas at 8 points along the page edges (usually the
  background). So starting a stroke or fill in the background takes ~2 ms instead of ~190 ms.

## Undo and redo (step 5)

- `js/history.js`: before every stroke or fill changes the picture, `history.saveBefore(box)`
  copies that rectangle's pixels **and its paint memory**. Undo swaps the copy back (keeping the
  current state for redo); redo swaps forward. A new change clears the redo steps.
- Strokes: `engine.commit(strokeCtx, colorCtx, beforeChange)` calls back with the box just before
  drawing. Fills: `fillAt()` saves the fill's box before `paintFill`.
- Memory cap: oldest steps are dropped past 150 MB of copies or 100 steps (a whole-background fill
  is ~45 MB; strokes are much smaller). The history is per open page and isn't saved (step 7
  saves the picture itself, not the history).
- UI: big back/forward buttons at the top right of the coloring screen (greyed when unavailable).
  PC shortcuts: Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z. Undo is ignored mid-stroke.
- Gestures: two-finger tap = undo, three-finger tap = redo (step 6; a small "Undo"/"Redo" label flashes).
- Defaults: pencil 8 / 90% (range 1–40), marker 30 / 70% (4–120), eraser 40 / 100% (4–200).
- **Pencil pressure tuned for Finley** (she had to press too hard): `pressure.curve` 0.5 (a light
  touch counts for more), opacity min 0.5, size min 0.6, grain fill [0.45, 0.85]. Measured darkness
  of an 8 px stroke: 3% pressure → 13%, 15% → 24%, 40% → 42%, 80% → 64%, 100% → 73% (before:
  invisible below ~40%). Texture unchanged. Further tuning = these numbers in `js/brushes.js`.
- **Eraser and paint memory:** the eraser doesn't record "white"; it weakens the remembered
  strength of what's there (`strength × (1 − erased)`), forgetting fully erased pixels. Recording
  white made partly-erased soft-edge pixels count as "a different color", so repainting with
  build-up off laid a double layer there: dark lines along the eraser's edges (fixed; tested with
  marker and pencil, build-up on/off, with undo/redo in between). Build-up never applies to the
  eraser itself (repeated erasing keeps erasing).
- Speed (PC): one second of fast Pencil drawing costs 23 ms (pencil) to 85 ms (eraser at 200);
  screen updates are under 2 ms.
- Input: Pencil samples come from `getCoalescedEvents()` when available. One pointer at a time;
  real palm rejection and finger zoom/pan are step 6.

## Zoom, pan, palm rejection and gestures (step 6)

- `js/viewport.js` (`view` in editor.js): scale + position, applied as a CSS transform on
  `#paper`. `zoomAt()`, `panBy()`, `pinch(start, cx, cy, dist)`, `fit()`, `toPage()`. Zoom range:
  half of "fit" while pinching (springs back to fit on release, with a 300 ms safety snap if the
  animation can't run) up to 4 screen px per page px. The middle of the drawing area always stays
  over the page, so it can't be lost.
- `js/touch-input.js` decides what every pointer means:
  - **Pencil and one finger both draw / tap to fill** (`SETTINGS.fingersDraw` true; false =
    Pencil-only, fingers just zoom/pan/tap). Owen asked for fingers to work without a switch.
  - **Automatic palm rejection:** while the Pencil is down, all touches are ignored; touches
    already on the screen when the Pencil lands are ignored until lifted, and a finger stroke in
    progress is taken back with no mark (her palm landing just before the Pencil); for
    `afterPencilMs` (500) after the Pencil lifts, a new finger can't draw but can still join a
    gesture (so a quick two-finger-tap undo right after a stroke works); touches wider than
    `palmSize` (120) are always ignored. It was 60, but **Finley has long nails** and touches with
    the flat finger pad, which the iPad reports as palm-sized at 60 - nearly all her finger input
    was being ignored. Get her real sizes from the touch log to fine-tune. Known trade-off: a resting hand with no Pencil nearby
    can draw (palm-size filter permitting).
  - **Two fingers moving** = pinch-zoom + pan, measured from where the fingers first touched (the
    iPad reports each finger separately, so measuring "right now" at the start was lopsided and
    made a plain drag zoom a bit - fixed).
  - **Taps:** all fingers up within 350 ms, none moved more than 12 px → 2 fingers = undo,
    3 = redo, with a small "Undo"/"Redo" toast. Anything moving or longer is zoom/pan.
  - **Second finger:** when one finger is drawing and a second lands, the first finger's stroke is
    taken back with no mark (`engine.cancel()`) if it started under `secondFingerMs` (250) ago or
    the finger has moved under 10 px (resting, waiting for the second); then it's a gesture.
  - **PC:** mouse draws; wheel / trackpad pinch zooms at the pointer; middle-button drag or
    Space + drag pans; Ctrl+0 fits the page.
  - (A "Draw with finger" switch existed briefly; removed in favor of the automatic rules above.)
  - Gesture thresholds live in `js/settings.js`: `tapGestureMaxMs` 350, `tapGestureMoveLimit` 12,
    `palmSize` 120, `secondFingerMs` 250, `afterPencilMs` 500, `fingersDraw` true.
- **Touch debug overlay** (temporary, `js/touch-debug.js`, `#touch-debug`): turned on by opening
  **https://deweyzx.github.io/finley-coloring/?debug** (the `?debug` is then removed from the
  address so a reload doesn't re-enable it) or by tapping the coloring screen's page title 5 times;
  turned off by its **"Hide log"** button (which stops its own pointer events so it can't draw or
  count as a gesture) or 5 title taps. Remembered in `localStorage` "touch-debug". Logs each
  finger ignored and why, Pencil downs, pointercancel, and per gesture: finger count, landing
  offsets (ms), time until all lifted, max movement per finger, reported touch size, and the
  decision (UNDO / REDO / zoom/pan / "nothing: <reason>"). `pointer-events: none`.
- Tested with simulated touches (real timing): pinch 100→300 px = exactly 3×, two-finger drag
  moves exactly with the fingers, 2/3-finger taps undo/redo without moving the page, a held
  two-finger touch does nothing, palms before/during a Pencil stroke change nothing, finger-mode
  two-finger tap leaves no mark. **The browser pane doesn't run requestAnimationFrame**, so live
  stroke rendering and animations can't be watched there; the real iPad check matters.
- The brush preview updates 120 ms after zooming stops (it shows the on-screen brush size).
- **What we learned from Finley's real touches** (touch log on her iPad, 2026-10-18):
  - She has **long nails**, so she touches with the flat finger pad. The iPad reports her touches as
    **42–83 px wide (usually 63)**, versus roughly 20–40 for a fingertip. With `palmSize` 60 almost
    all her finger input was ignored as a palm - that was the cause of "fingers don't register" and
    most of "gestures are hard to trigger". **`palmSize` is 120** (~45% headroom over her largest).
    Don't lower it below ~100 without new data.
  - Her taps: fingers land 0–25 ms apart, all lift after 57–108 ms, movement 0 px. The defaults
    (`tapGestureMaxMs` 350, `tapGestureMoveLimit` 12) already fit her with a wide margin, so they
    were kept.
  - Palm rejection by timing (ignore fingers while the Pencil is down / 500 ms after) works fully
    for her; the size filter is now only a backstop for a whole hand.
- **Touch log:** off by default; open the app with `?debug` to turn it on, "Hide log" to turn it
  off (remembered per device).

## Key decisions

- **Device:** iPad Pro 11" (screen 1668 × 2388), Apple Pencil 2, Safari.
- **Page size:** 2048 × 2732 (3:4, wide pictures 2732 × 2048). Each canvas layer is ~22 MB.
- **Layers:** a white color canvas, the live stroke canvas, then the line-art canvas on top. The line art has its white
  made transparent, so color can never cover the lines.
- **Line art from the import tool:** solid black lines with a thin smooth edge (`EDGE_SOFTNESS`
  0.7); every line pixel is darker than 50% grey and every paper pixel lighter. The app treats
  "darker than 50%" (`LINE_CUTOFF = 128`) as a line.
- **Tap-to-fill** (`js/fill.js` + `js/fill-worker.js`, runs in a web worker), only stops at the
  line art (never at brush strokes). When a page opens, the worker builds a line mask (minus
  specks) and a distance-to-nearest-line map. Each tap then:
  1. snaps a tap on a line to the nearest paper within `tapReach` screen px; if near a line,
     steps into the open part of the area (without crossing lines) before gap closing
  2. flood fills with every line treated as `gapClosing` px thicker (closes gaps up to ~2×)
  3. grows back to the real lines by moving only "downhill" in distance (stops halfway
     across a gap)
  4. fills thin leftover patches (thin everywhere ≤ `thinPatchWidth` px from a line, ≤
     `thinPatchLimit` px); wider patches are other areas reached through a gap
  5. tucks `fillUnderLines` px under the lines (no white halo), then fills single pinholes
  - Known trade-off: a real gap opening straight onto an enclosed strip under ~9px wide gets
    that strip filled.
  - Speed (PC): page prep ~190 ms; typical fill 2–10 ms; the biggest fill ~170 ms.
- **Settings** (`js/settings.js`): `gapClosing` 4, `thinPatchWidth` 9, `thinPatchLimit` 8000,
  `ignoreSpecks` 30, `tapReach` 10, `fillUnderLines` 2.
- **Library:** `pages/pages.js` lists categories → sub-categories → page files. Folders match:
  `pages/<category>/<sub-category>/<file>`. **Page id = file name without extension, unique
  across the whole library; never rename it** (her saved coloring will be keyed by it). Titles
  come from file names unless given. Addresses: `#/`, `#/flowers`, `#/flowers/tulips`,
  `#/page/<id>`.
- **Thumbnails:** `thumbs/<category>/<sub-category>/<id>.png`, 420 × 560, 4 grey shades (~40 KB),
  made by the import tool. SVG pages, or pages without a thumbnail, get one made in the browser and
  cached in IndexedDB (`js/thumbnails.js`).
- **Placeholder pages** are SVG (sunflower, tulips, butterfly, mandalas, shapes, cottage); the real
  pages are PNG from the import tool.

## Import tool

- `import-pages.bat` → `tools/import_pages.py` (needs Pillow + NumPy, installed with `--user`).
- Owen drops raw images (PNG/JPG/WEBP from AI generators and packs) into
  `import/<Category>/<Sub-category>/` and runs it. For each image it evens out the paper, picks a
  line threshold, removes specks (`SPECK_AREA` 150), trims margins, resizes to the page size,
  thickens thin lines, seals diagonal leaks, smooths edges, gives a clean unique name, writes the
  page + thumbnail, and updates `pages/pages.js` (creating categories as needed).
- Folder names are cleaned ("tiger-lily-coloring-page" → "Tiger Lily"); singular/plural match
  existing groups. Skips duplicates (file hash + look-alike fingerprint) via
  `tools/import-log.json`. Never changes the originals.
- `import/` is git-ignored: originals stay on Owen's PC and are never published.
- Settings are at the top of the script.

## Testing and hosting

- **Local:** `start-server.bat` (or `python serve.py`) → http://localhost:8000. It's a no-cache
  server that fixes Windows MIME types. Opening `index.html` directly won't work. Owen's Wi-Fi
  blocks testing between devices, so the iPad always tests the hosted link.
- **Live:** https://deweyzx.github.io/finley-coloring/ (repo `deweyzx/finley-coloring`, public,
  Pages from `main` / root, `.nojekyll` present). It updates ~1 minute after a push, and Safari may
  show the old version for a few minutes.
- **Browser caching lesson:** GitHub Pages lets Safari reuse files for ~10 min. Without version
  stamps, Finley's iPad ran the new HTML with old cached JS (a new switch appeared but did
  nothing). Fixed with version stamps (below). After any upload, tell Owen to **wait ~10 minutes
  and reopen the tab** before testing.
- **Before every commit that will be pushed, run `python tools/stamp_version.py`.** It stamps
  `?v=<yyyymmddHHMM>` onto every reference (index.html's CSS/JS, every `import ... from "./x.js"`,
  the fill worker URL). GitHub Pages lets browsers cache files ~10 min, and without stamps Safari
  ran new HTML with old cached JS (the "Draw with finger" switch appeared but did nothing). With
  stamps a page always gets matching code; only the HTML itself can be up to ~10 min stale, so
  tell Owen to wait ~10 minutes after an upload (or until step 11's service worker). New imports
  must use plain `"./x.js"` (the tool adds the stamp). In browser-pane tests, import modules with
  the same `?v=` the page uses, or you get a separate copy of the module (separate worker/state).
- **Git:** identity is repo-local: `deweyzx` / `343752721+deweyzx@users.noreply.github.com` (keeps
  his real email private). Pushing works through the saved Git Credential Manager sign-in.
  Commit messages are "Step N: …" with a short explanation.
- The browser pane's hidden tab doesn't fire lazy loading / IntersectionObserver; library
  thumbnails can look blank there even though they work on real screens.

## Files

| File | Purpose |
|---|---|
| `index.html` | Both screens (library, coloring) |
| `css/styles.css` | All styling; design tokens in `:root` |
| `js/app.js` | Router: address → screen |
| `js/library.js` | Reads `pages/pages.js`, builds page objects |
| `js/gallery.js` | Library screens and cards |
| `js/thumbnails.js` | Browser-made thumbnails (fallback) |
| `js/storage.js` | IndexedDB (`thumbnails`, `artwork` stores) |
| `js/editor.js` | Coloring screen: layers, tools, taps, strokes, sliders, preview, fitting the page |
| `js/lineart.js` | Loads a page, makes white see-through, returns the darkness map |
| `js/fill.js`, `js/fill-worker.js` | Tap-to-fill |
| `js/palette.js` | Default swatches |
| `js/brushes.js` | Brush definitions, saved per-brush settings, paper grain |
| `js/stroke-engine.js` | Draws brush strokes (dabs, coverage, live layer, commit) |
| `js/slider.js` | Pencil-friendly slider |
| `js/history.js` | Undo and redo |
| `js/viewport.js` | Zoom and pan (where the page sits on screen) |
| `js/touch-input.js` | What each Pencil / finger / mouse action means; palm rejection; gestures |
| `js/touch-debug.js` | Temporary on-screen touch log (`?debug` link or 5 title taps; "Hide log") |
| `tools/stamp_version.py` | Stamps a version on every file reference (run before each upload) |
| `js/settings.js` | Tweakable numbers |
| `pages/pages.js` | The library list |
| `tools/import_pages.py`, `import-pages.bat` | Import tool |
| `serve.py`, `start-server.bat` | Local test server |
| `README.md` | Owen's beginner guide (running, importing, settings) |
