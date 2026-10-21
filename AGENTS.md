# Finley's Coloring Book: project guide for Codex

A free coloring app (a replacement for "Pigment") for Finley's iPad Pro 11" with Apple Pencil 2
(pressure + tilt). Built by Owen (GitHub: deweyzx) with Codex, one tested step at a time.

**Keep this file current:** when a step is finished and committed, update "Where we are", the step
table, and any decisions that changed.

## Where we are

- **Done and committed:** steps 1–6, including gesture tuning for Finley. Everything works on her
  iPad: one-finger coloring, 2-finger tap undo, 3-finger tap redo, pinch zoom, two-finger drag,
  and no interference from her hand resting on the screen while using the Pencil.
- **Done and committed:** step 7, auto-save + progress in the library, plus the "Start over"
  button - both checked on the iPad and working.
- **Done and committed:** step 8, the full color picker - checked on the iPad: ring and square
  smooth with Pencil and finger, recents and palettes work, both layouts good, survives closing Safari.
- **Done and committed:** step 9, export to Photos - checked on the iPad: share sheet, "Save
  Image", "Download instead" and touch-and-hold all work, upright and sideways.
- **Done and committed:** step 10, all three brush batches, confirmed working on Finley's iPad. Each
  batch: build, Owen tests on PC, commit + push, iPad test, and only then the next batch.
  **Batch 1 (airbrush, smooth hair, watercolor, splatter) is committed** (passed Owen's PC test:
  Brushes window, line-lock, sliders/preview, hold-to-spray, watercolor glaze, undo/redo,
  auto-save). iPad: smooth hair, watercolor, splatter feel good; **airbrush lagged** (ink trailing
  the Pencil) and smooth hair needed a bigger maximum. **Committed:** a faster airbrush (2-4x, see
  "Airbrush speed") and smooth hair up to 200 (passed Owen's PC test). iPad log (2026-10-19):
  drawing work 22-48%, but "most behind" 44-56 ms at every size; airbrush felt laggy at 80 but
  not 250, the eraser slightly. **Committed:** ink drawn right up to the Pencil tip and ~20 ms
  ahead (see "Keeping the ink up with the Pencil") and a clearer speed log (passed Owen's PC
  test). Smooth hair at 200 confirmed good. iPad (2026-10-20): **ink keeps up with the Pencil**
  for every brush, the stopping tail isn't a problem; log: typical Pencil→app 6-19 ms, 90% under
  10-52 ms. **Batch 1 is done.**
  **Batch 2 (glitter, metallic) + a quality pass are committed** (see "Richer looks"): Owen's
  first PC look said glitter looked like noise and the brushes "a bit cheap" next to a reference
  app (quality reference only, no copying), so glitter, metallic, watercolor and splatter got
  richer original textures (passed Owen's PC test). **Smooth hair was reverted to exactly its
  batch-1 version** (Finley liked it; max size 200 kept; proven pixel-identical in 80 cases).
  Also a brush warm-up when a page opens. iPad log (2026-10-20): **watercolor 160 froze the page**
  (100% work, single updates 0.6-1.9 s, Pencil→app 2-3.6 s, 2-3 updates per stroke). **Fixed and
  committed** (see "Watercolor freeze"); Owen asked to commit straight away for the retest.
  iPad retest (2026-10-20): watercolor 103 smooth (32-42% work, slowest 2-6 ms) but 160 still
  lags; **Metallic 120 (97%, slowest 132 ms), Glitter 150 (92%, 64 ms), Smooth hair 200 (98%,
  438 ms) maxed out**. Her iPad is ~8-12x slower than this PC for this work (30x for glitter vs
  the 8x simulator), so max sizes can't be judged on the PC. Owen: **rather a smaller max size
  than a laggy brush**, and keep looks unchanged. **Committed (for the iPad run):** a **Speed test**
  button in the touch log (measures every brush on the device, reports the largest smooth size),
  a 60-per-second drawing pace for brushes that aren't small on screen, a per-stroke split of the
  work (dabs vs drawing) in the log. **Speed test on her iPad (Sunflower page):** every brush
  smooth at its biggest size except smooth hair (149% at 200, 95% at 110, 50% at 50). **Then
  (committed):** smooth hair made ~4x lighter with the same look (quick loop `hairRows` + spacing
  0.12; before/after shown to Owen); the Speed test now draws on the real (visible) stroke layer
  in white and uses the app's real guess-ahead distance, because the first version said glitter /
  metallic / watercolor were smooth while real strokes had shown 92-100% (those real strokes were
  also before the 60-per-second pace); each stroke's log line now shows its speed (screen px/s).
  Then real strokes on Daffodils: **Finley draws at 1600-2300 screen px/s** (the test assumed 600);
  smooth hair 200 felt fine (38% at 2301 px/s); watercolor 160 laggy, glitter 150 slightly laggy,
  metallic 120 laggy (97-98%). Owen: no more speed tests - make them cheaper, pick conservative max
  sizes, Finley just says smooth or laggy. **Committed:** lean loops for plain dabs and watercolor
  (identical results), wider spacing for watercolor (0.3) / glitter (0.16) / metallic (0.16),
  **new max sizes: watercolor 130 (was 160), glitter 120 (was 150), metallic 60 (was 120)**; all
  others unchanged. **iPad confirmed:** Owen reports all three are smooth. Batches 1 and 2
  are complete. **Batch 3 (Blender and Blur) is complete and confirmed on her iPad:** existing-paint
  tools, maximum size 48 each (default 30 / 65%), pressure and gentle tilt, line-lock, undo/redo,
  auto-save and export. Owen confirmed on 2026-10-21: "works good on the computer".
  First iPad check: no lag, but both tools needed too much pressure; Blender's color result and the
  icons/previews were not accepted. Owen supplied IMG_6831.MOV showing Pigment smoothing green
  and yellow pencil strokes. **Revisions approved on PC and iPad (4341706):** lighter pressure,
  paint-pickup/carrying Blender (yellow trails into green), wider Blur, matching outlined
  tool icons and curved previews. Owen approved the color-carrying result on 2026-10-21
  ("perfect! thank you!"). The subsequent iPad retest passed: "everything works perfectly! thank you!"
  (2026-10-21). Step 10 is complete. **Step 11 checkpoint: PC check passed** (Home Screen/offline + backups);
  committing and uploading for the iPad installation/offline check. The icon is approved.
  Owen confirmed on 2026-10-21: "it worked now what". Step 12 has not started.

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
| 7 | Auto-save (IndexedDB) + her progress shown on library thumbnails; Start over | ✅ |
| 8 | Full color picker: hue ring + saturation/brightness square, recent colors, named saved palettes | ✅ |
| 9 | Export the finished picture to Photos | ✅ |
| 10 | Brush collection (Finley's picks), in 3 batches: paint brushes, effect brushes, blending tools | ✅ all three batches confirmed on iPad |
| 11 | Installable + offline (manifest, service worker, icons), coloring backup/transfer | PC passed; checkpoint for iPad installation/offline check |
| 12 | Magical storybook look, Themes, polish | |

### Notes for future steps

- **Step 10, the brush collection (Finley's picks).** Marker stays as it is. Build in three
  batches; **Owen tests each batch on her iPad before the next one starts.** For every batch:
  show close-up samples of each brush, then tell Owen how to test it. Every brush must work with
  pressure, tilt (where it makes sense), line-lock, build-up, undo, auto-save, and the size and
  opacity sliders, and each must feel clearly different.
  - **Batch 1, paint brushes:**
    - **Airbrush:** soft spray that builds up gradually; pressure controls the flow.
    - **Smooth hair:** soft-bristle paintbrush with smooth, tapered strokes.
    - **Watercolor:** see-through, slightly uneven, soft darker edges where color pools; layers
      like real watercolor.
    - **Splatter:** scattered droplets of different sizes; pressure controls how many and how far.
  - **Batch 2, effect brushes:** **Glitter** (sparkly texture, tiny bright flecks) and
    **Metallic** (shiny, a sheen like metallic ink). The effect must be part of the picture
    itself (not an animation) so it looks right in a saved picture.
  - **Batch 3, blending tools:** **Blender** (smudges and mixes colors already on the page, like a
    finger or blending stump) and **Blur** (softens and smooths colors already there). They change
    existing color instead of adding new color, so they must work with line-lock, undo and
    auto-save, and never touch the black lines.
  - With this many brushes the tool bar can't hold them all: the bar keeps Fill, Pencil, Marker,
    Eraser and a **Brushes** button that opens a window of all brushes, each with a sample stroke.

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

## Brush collection (step 10)

- **Tool bar:** Fill, Pencil, Marker, Eraser (`inBar: true` in brushes.js) and a **Brushes**
  button (`.brushes-button`) that opens `#brushes-dialog`: a card per brush (every brush, bar
  ones too) with a sample stroke in the current color. The button shows the last brush picked
  from the window (`localStorage` "extra-brush") with a small grid badge, highlighted while that
  brush is in use. Sideways, the 5 buttons just fit the 272 px panel (`.tools` gap 0).
- `drawSample(canvas, toolId, pickSize)` in editor.js draws both the panel preview and the cards.
- **New optional brush fields** (all in `stroke-engine.js`, all off for pencil/marker/eraser, which
  were checked to draw pixel-for-pixel the same as before - 12 fingerprints incl. tilt, line-lock
  and build-up off): `soft`, `flow` {amount, hold}, `noise`, `taper` {start, length}, `bristles`
  {strength, width}, `wash` {wobble, uneven, rimWidth, rimGain, middle, rim}, `scatter` {count,
  reach, spread, drop, hardness}, `blend: "multiply"`. The engine's per-mark function is now
  `stamp(cx, cy, shape)`; `dab()` calls it once, or many times for splatter. Each stroke gets a
  random `seed` (own bristles, droplets, watercolor blooms).
- **Batch 1:**
  - **Airbrush** (10-300, default 80 / 60%): bell-shaped soft dab with fine speckle; dabs ADD up
    (`flow`) toward the opacity slider's value instead of MAX, with random rounding so light
    spray still builds. Pressure = flow (12%-100%). **Holding the Pencil still keeps spraying**
    (`sprayWhileHeld()` in editor.js calls `engine.hold(frames)` about 30 times a second when no
    new dab was made): middle strength 24 -> 87 -> 118 -> 133 -> 140 of 153 at 0 / 0.5 / 1 /
    1.5 / 2 s. One pass at full pressure reaches ~60% of the slider value. Tilt = longer,
    lighter oval. Spacing 0.2 with flow 0.49 (was 0.12 / 0.3; same look within ~3%).
  - **Smooth hair** (2-200, default 24 / 85%; max was 100, doubled at Owen's request): soft round dab, tip starts at 35% size and grows
    over 0.9 brush sizes (`taper`; it was 15% over 1.6 sizes but that left a white sawtooth where
    strokes start at a line-locked edge); pressure size 12%-100% so a light lift tapers the end
    (finger/mouse strokes end blunt). Hair streaks: a 64-entry random strength table sampled by
    the distance ACROSS the stroke direction (smoothed `engine.direction`), so each hair leaves a
    streak along the stroke.
  - **Watercolor** (6-160, default 50 / 45%): MAX coverage with an edge that wanders and patchy
    pigment (`WASH`, a 256 px low-frequency noise tile in brushes.js, shifted randomly per
    stroke); darker **rims** where pigment pools: `washAlpha()` compares each pixel with a
    double box-blur of the coverage (radius `rimRadius` = 12% of size, 3-18 px); weaker
    surroundings = rim. Rims also form along line-locked edges. Drawn live over the changed area
    plus the rim radius; at lift the rims are baked into the coverage so the paint memory matches.
    **Glazes**: committed with `multiply` (yellow over blue = green), and `#stroke-canvas` gets
    CSS `mix-blend-mode: multiply` during the stroke so the live view matches. With build-up OFF
    it's laid on normally (even-out math needs normal painting), so it covers instead of glazing.
    White watercolor shows nothing (as with real watercolor).
  - **Splatter** (10-240, default 70 / 90%): each dab (every 30% of the size) throws 1.2-6
    droplets (pressure) out to 0.35-1.25 brush radii (pressure); sizes 1.2%-12% of the brush, mostly
    tiny; far ones smaller. Tilt shifts the spray away from the Pencil and stretches far droplets
    into streaks.
- Tested (browser pane, real daffodil page, app's own pointer path): line-lock (0 pixels outside
  the locked area for all four), undo/redo exact, build-up off (2nd same-color pass darkens
  ~1-3 levels vs 7-29 with build-up on), auto-save restores the exact pixels, sideways + upright
  layouts, previews. **Not testable here:** real Pencil feel, live drawing (the pane doesn't run
  animation frames), hold-to-spray timing, iPad speed.
- **Airbrush speed** (Finley's iPad: "very delayed, the ink trails behind the Pencil"). Measured
  on the PC, one second of fast drawing at page size (240 Pencil samples + 120 screen updates):
  75-85% of the time was stamping dabs, the rest redrawing the stroke layer. Tilt was the big
  multiplier: a tilted dab is a long oval but every pixel of a square around it was visited (a
  natural grip already counts as tilted). Fixes, all in `stroke-engine.js` unless noted:
  1. `stamp()` visits only the oval: a tight box around the turned oval, and on each row only the
     span between the oval's edges (`qa/qbRow/qcRow`). Helps every brush; pencil, marker and
     eraser are still pixel-identical (12 fingerprints).
  2. `sprayRows()`: the airbrush's own inner loop - bell fade from a table by squared distance
     (`SPRAY_BELL`, no square roots), oval position stepped along each row, speckle and fair
     rounding from ready-made random tables (`RANDOM_TABLE`, `speckleTable()`). Used when a brush
     has flow + soft and no grain/wash/bristles/scatter (`engine.fastSpray`).
  3. Spacing 0.12 -> 0.2 (flow 0.3 -> 0.49, hold 0.22 -> 0.135): 40% fewer dabs, same strength.
  4. Holding still: ~30 sprays a second (each a bit stronger) instead of one per screen refresh
     (up to 120 on her iPad).
  5. `render()`: writes each pixel as one 32-bit number, and reuses one `ImageData` block
     (`engine.scratch`) instead of making a new one every update.
  Results (PC, before -> after, ms of work per second of fast drawing): size 80: upright 79 -> 34,
  natural grip 113 -> 46, tilted 251 -> 68; size 160: 150 -> 77, 227 -> 96, 513 -> 127;
  size 300: 268 -> 97, 435 -> 137, 1021 -> 240 (2-4.3x); held still 1 s: 310 -> 35 (size 300).
  Other brushes also got faster from (1) and (5): marker 120 tilted 152 -> 83, smooth hair 100
  tilted 236 -> 171, watercolor 160 tilted 721 -> 559.
  **Unknown:** how much slower her iPad is than this PC; even before, size 80 used only ~10% of
  the time here, so the iPad may be much slower at this work, or something only happens there.
- **Speed lines in the touch log** (`?debug`), three lines after every stroke:
  "Airbrush 80: 1.4 s, work 310 ms (22%), slowest 3 ms" /
  "Pencil→app: touch-down 48 ms, typical 22 ms, 90% under 30 ms, worst 54 ms" /
  "drawn ahead ~20 ms (own guess) · 120 events, 2.0 samples each, 118 screen updates · lift 9 ms
  · stay-inside wait 3 ms". *work* = stamping + redrawing; *Pencil→app* = from the iPad sensing
  the Pencil (the event's `timeStamp`, newest coalesced sample) to our code handling it, split into
  touch-down, typical (median), 90th percentile and worst - this part happens before our code and
  can only grow if our code keeps the page busy; *drawn ahead* = how far the guess reaches at the
  current speed ("iPad's" if Safari offers `getPredictedEvents`, "own" otherwise, "no" when the
  brush is big on screen). (`s.timing`, `noteWork()`, `guessAhead()` in editor.js.) The first
  version showed only the worst value, which was 44-56 ms at every size on her iPad.
- **Keeping the ink up with the Pencil** (after that log):
  1. Real dabs are placed every `spacing`, so the newest could be up to one spacing behind the tip
     (the airbrush's spacing had just gone from 12% to 20% of its size). `engine.renderAhead(ctx,
     ahead)` stamps temporary dabs at the tip and toward a guessed point ~`predictAheadMs` (20) ahead
     (at most `predictMaxPx` 24 screen px), draws, then restores the coverage exactly from a copy
     (`aheadCopy`) along with `last/leftover/direction/dabCount/box`, and marks that area dirty so
     the next update redraws it from the real coverage. Temporary dabs use 3x the spacing
     (`spacingScale`). Tested: for every brush, with/without build-up and line-lock, the finished
     picture and paint memory are identical with or without it, and nothing is left on the stroke
     layer after lifting or cancelling.
  2. Skipped for splatter (random droplets would flicker), watercolor (rims are expensive to
     redraw; it already felt fine), and when the tip dab reaches more than `predictMaxBrushPx` (32)
     screen px - the gap is inside the paint then (why size 250 didn't feel laggy) and the extra
     work would be large.
  3. Pencil events draw right away (`drawStrokeNow()`) instead of waiting for the next animation
     frame (unless drawn < 6 ms ago). If no new position arrives for 50 ms, the guess is dropped.
  Measured here: ink at half strength now reaches 12-46 page px past the tip instead of -8..+19
  px. Extra work (PC): at most ~39 ms per second of fast drawing (smooth hair 100 at whole-page
  zoom); most brushes +5-20 ms.
  **Not measurable here:** how long Safari takes to deliver Pencil positions and show a frame;
  the guess hides ~20 ms of that. Whether "under 30 ms" is reachable depends on the iPad's own part.
- **Batch 2** (cards come after splatter in the Brushes window):
  - New optional field **`effect`**: the paint's look is worked into each pixel's COLOR in
    `renderEffect()` (stroke-engine.js); the per-pixel strength (coverage) works exactly like
    every other brush, so line-lock, build-up off (same even-out math), the paint memory (stores
    the base color), undo, auto-save and the saved picture need nothing special. Tested: finished
    picture identical whether the screen updated every point, every 9th point, with drawing
    ahead, or only at lift; 0 px outside line-lock; undo/redo exact; build-up off: a second
    same-color pass changes nothing; auto-save and the saved picture match the page exactly.
  - **Glitter** (4-150, default 30 / 90%): `GLITTER` texture in brushes.js (256 px tile, shifted
    randomly per stroke so layering adds new sparkles): flakes ~4 px (nearest of jittered points,
    each with a shade -1..1, `facet` 0.4 lighter/darker), sparkles on 1 flake in 10 (nearly white,
    slightly warm, `sparkle` 0.95, they also raise the pixel's strength so they shine through a
    thin coat), a third of them with 4-point star flares 3-7 px. Uses drawing ahead.
  - **Metallic** (3-120, default 20 / 100%): lit from the top left. The paint "surface" = this
    stroke's coverage, or the same color already painted (paint memory), whichever is stronger,
    double box-blurred (`shineRadius` = 30% of size, 2-12 px); its slope gives each pixel a
    facing direction -> diffuse light (`bump` 0.7) + a highlight from a lookup table (`gloss` 24,
    `highlight` 0.7). Plus polished diagonal bands **fixed to the page** (the WASH texture read
    smoothly and stretched, `sheen` 0.5) so strokes side by side join seamlessly, and a fine
    grain (GRAIN, `flake` 0.06). Brightness 0-1 maps to the color x 0.6-1.0 (dark side, not
    lower or yellows turn olive) and toward white above the middle. Each update redraws 2 x
    shineRadius + 1 px around the change (the blur runs twice - with only 1 x the live picture
    differed from the final one). No drawing ahead (too costly, like watercolor).
    History of the look: first version shaded each stroke as a rounded tube (`bump` 1.6) -
    lovely for lines but colored-in areas looked corrugated; using the paint memory alone didn't
    fix it (normal back-and-forth strokes overlap too little), so the rounding was made gentle
    and the bands were tied to the page.
  - Speed (PC, ms of work per second of fast drawing, whole-page zoom): glitter 30: 19, glitter
    150: 115; metallic 20: 25, 60: 93, 120: 191 (was 366 before reusing the blur's memory, the
    highlight table and the 12 px cap); lift ~5 ms. Marker 120 is 43 for comparison.
- **Richer looks (quality pass, 2026-10-20),** all original textures made in code:
  - **Glitter:** new `GLITTER` texture (512 px): 9000 separate flat flakes, 4-6 sided, 3-16 px
    across (mostly small), each with its own brightness (20% darker, 55% the color, 18% catching
    the light, 7% blazing almost white; plus a slight tilt gradient) and a random `pick` number;
    blazing bigger flakes get sharp 4-point glints. Between flakes: a solid **deep shade** of the
    color (`base` 0.8 x color-times-itself, like colored glue), thinning toward a stroke's edge
    (strokes overlapping showed light/dark stripes when it was see-through everywhere). Light
    pressure / soft edges show fewer flakes (`pick > amount * 380 - 30` -> base instead). Flakes
    raise the pixel's strength (solid pieces). Hardness 0.95 (crisp edge).
  - **Metallic:** shadows are the color times itself (gold -> warm brown, not grey), highlights
    toward white (x1.5), reflection bands sharper (x3.5 then an S-curve, `sheen` 1), `gloss` 40,
    `highlight` 0.9, `bump` 0.8, `mica` 0.6 (tiny bright specks where the GRAIN tile > 0.94),
    `join` true (same color on the page counts as one surface).
  - **Smooth hair:** a richer version was built (wider hairs whose paint came and went along the
    stroke, plus a fine light-and-shadow "paint" relief) and looked like real paint, but **Owen
    asked to revert it to exactly the batch-1 version because Finley liked that one** (max size
    200 kept). Reverted and proven pixel-identical to commit 5159bf1 in 80 cases (sizes 8-200,
    build-up, line-lock, drawing ahead, tilt). Left over from it: the generic `maxShine` setting
    for lit effects, and drawing ahead is allowed for lit effects with shineRadius <= 3.
  - **Watercolor:** the edge wanders by a new `CLOUD` texture (256 px, layers 64-8 px; finer
    layers made the edge look like noise) with `wobble` 0.6 -> cloud-like edges; pooling
    `uneven` 0.5 (S-curved); `granulate` 0.08 (pigment in the paper's tooth, from GRAIN; 0.22
    looked grainy); `middle` 0.85, `rim` 0.8, hardness 0.65. (Later made much faster - see
    "Watercolor freeze".)
  - **Splatter:** sizes 0.8%-20% of the brush (power 2.6: mostly tiny, a few big blobs); each drop
    a randomly squashed oval, drops over 2.5 px get 1-5 satellite drops on their edge (irregular
    splash), drops over 6 px have a 30% chance of a tail of 4 shrinking drops; hardness 0.94.
  - **Big + expensive brushes redraw at most ~60 times a second:** watercolor and metallic,
    when the tip dab reaches > `predictMaxBrushPx` screen px (drawStrokeNow).
  - Speed (PC, ms per second of fast drawing at whole-page zoom, before -> after the pass):
    glitter 30: 17 -> 20, 150: 105 -> 118; metallic 20: 26 -> 27, 120: 195 -> 217; watercolor
    50: 45 -> 64, 160: 244 -> 233; splatter ~4. (Smooth hair's rejected relief version had cost
    about 2x; it's back to its batch-1 speed.)
  - Tested after the pass: every brush gives the same finished picture whether the screen updates
    every point, every 9th, with drawing ahead, or only at lift; 0 px outside line-lock; pencil,
    marker and eraser identical to step 9; in the app: undo/redo exact, auto-save exact.
- **Watercolor freeze (her iPad, size 160) and the fix:**
  - **iPad-like simulator** (browser-pane test code, not in the app): runs a stroke with the
    app's own rules (240 Pencil samples/s, one event per 120 Hz refresh carrying every sample
    since the last, drawing ahead / 60 Hz rules), measures each piece of work on the PC and counts
    it N times longer; while "busy", samples pile up into the next event (like on her iPad). The
    old watercolor at **8x** reproduced her log (single updates up to ~1.6 s, 50-80 samples per
    event = snowballing); at 4x it only looked mildly slow. So **design for ~8x slower than this
    PC** for heavy brushes. Single runs vary; take the best of 3.
  - Causes: (1) every update re-blurred the whole area around the newest dabs for the darker
    rims, ~80% of live drawing time, with new memory each time; (2) each update redrew the whole
    square of the newest dabs (12x more pixels than the brush actually swept); (3) many
    overlapping dabs (spacing 0.07) each doing several texture look-ups.
  - Fixes: rims are now `washAlphaLive()` - each pixel vs 8 neighbours `rimRadius` away plus
    itself, no blur, no new memory - used both live and for the finished stroke (no change at
    lift; looks the same as the blur, avg 2/255 different); pooling (`uneven`) and `granulate` are
    applied there once per pixel instead of in every dab; dabs only report the pixels they
    actually changed as needing a redraw (helps every brush); dabs skip pixels already as strong
    as they could make them (exact, every brush); watercolor spacing 0.2 (looks the same, avg
    2/255); `pixelBlock()` hands Safari exact-size pixel blocks on reused memory (all brushes; the
    old reused block only ever grew and could be page-sized); very big working memory is let go
    after each stroke; **adaptive pace** in drawStrokeNow: the next screen update waits at least
    twice as long as the last one took, so input is never starved.
  - Results (simulator, very fast 3000 page px/s scribble, slowest / typical update ms): watercolor
    160 at 8x: before 1582 / 349 (snowball) -> after 42 / 18; at 4x: 86 / 69 -> 14 / 6; lift
    170 ms at 8x. Other brushes at 8x: all fine except smooth hair 200 (see "Where we are").
  - Checked: every brush gives the expected finished picture (other brushes identical to the
    previous commit; watercolor identical however the screen updates) - 432 of 432 cases; 0 px
    outside line-lock; pencil/marker/eraser identical to step 9; app: undo/redo, build-up on/off,
    auto-save exact. Not verified: the real iPad (the simulator is an estimate).
- **Speed test** (`js/speed-test.js`, "Speed test" button in the touch log, `onSpeedTest()` in
  touch-debug.js, wired in editor.js): for every brush, draws one second of a fast stroke (600
  screen px/s at the current zoom, 240 samples/s, the app's own update rules via
  `drawingWait()`) on a hidden full-size layer inside `#paper` (opacity 0) and a separate
  StrokeEngine, starting at the biggest size and trying 85/70/55/40/25% until smooth (work <= 50%
  of the second and no single update > 33 ms). Reports e.g. "Glitter (biggest 150): 150: 92% /
  64 ms ✗ · 128: 61% ✗ · 105: 44% / 20 ms ✓ -> largest smooth size: about 105". Hidden layers
  are removed afterwards. On the PC all brushes pass at their biggest size (1.7 s).
- **Drawing pace** (`drawingWait()` in editor.js): brushes reaching more than
  `fullRateMaxBrushPx` (12) screen px are redrawn at most ~60 times a second; plus the adaptive
  rule (wait twice the last update's time). Finished pictures don't depend on this.
- PC breakdown at her Mandala zoom (0.23), ms per second of fast drawing (dabs + drawing; handing
  pixels to Safari is ~0-2 ms): smooth hair 200: 110 + 42; glitter 150: 28 + 49; metallic 120:
  27 + 56; watercolor 160: 37 + 41; watercolor 100: 23 + 25 (smooth on her iPad); marker 120:
  27 + 23. Smooth hair: an exact skip (using the hair passing over a pixel) didn't help - its
  soft edges and streaks rarely make a pixel "full".
- **Smooth hair made lighter (same look):** what was expensive: (1) the hair-streak maths per
  pixel per dab (about half of the dab work), (2) the number of dabs (spacing 0.06 = 3x the
  marker's at size 200). Fixes: `hairRows()` - its own inner loop (hair pattern from a per-stroke
  table, `makeHairTable()`, 64 hairs x 16 steps; oval position and hair position stepped along
  each row; square root only near the soft edge; skip pixels it can't make stronger) - looks the
  same as batch 1 (avg 0.26/255, max 3); then spacing 0.06 -> 0.12 (vs batch 1: avg 0.69/255,
  0.27% of pixels differ by > 10, at the thin tips; indistinguishable in a 2x before/after).
  PC ms per second of fast drawing at zoom 0.23: size 50: 65 -> ~25, 110: 103 -> 24, 200: 153
  -> 41 (her iPad ran ~10x the PC number as a %: 149% at 200 before).
- **Calibration from her real strokes (Daffodil, zoom 0.231):** her iPad vs this PC, same work:
  smooth hair 200 (lean `hairRows` loop) ~3x for dabs, ~1.9x for drawing; metallic 120 (then the
  all-purpose stamp loop) ~10x for dabs, ~2.4x for drawing. So Safari runs the all-purpose loop
  in `stamp()` (a branch per brush feature) far worse than lean loops. Added `plainRows()` (plain
  round dabs: marker, eraser, glitter, metallic, splatter drops) and `washRows()` (watercolor):
  the same sums in the same order - identical pictures (216 of 216 cases). Pencil (grain) and the
  airbrush (own loop) are unchanged.
- **Choosing max sizes** (simulator `measureLike`: her zoom 0.231, 240 samples/s, the app's pace
  and guess-ahead; iPad % estimate = (PC dab ms x 3.2 + PC drawing ms x 2.5) / 10, target <= 45%
  at 2300 px/s): watercolor 130 (~43%), glitter 120 (~38%), metallic 60 (~43%; metallic's cost is
  mostly the shine drawn on each update, so spacing alone didn't help much). Check: smooth hair
  200 estimates 40% (real 38%), marker 120 42%. Spacing changes vs before (sample sheets): glitter
  0.16 avg 1.2/255, metallic 0.16 avg ~1/255, watercolor 0.3 avg ~2/255 - all at the edges.
  Saved sizes above the new maximums are clamped (brushSettings). If Finley finds one still
  laggy: lower that max further, or (metallic) make its shine cheaper.
- **Speed test vs real strokes:** the first version drew on a hidden layer with a tiny guess
  ahead; it said glitter 150 / metallic 120 / watercolor 160 were smooth (16-22%) while real
  strokes had shown 92-100% (taken before the 60-per-second pace, which halves drawing at those
  sizes - but not enough to explain 5x). Now: real stroke layer (drawn white, cleared after),
  real guess-ahead distance (`predictAheadMs` x speed, capped at `predictMaxPx`). Note: the
  Sunflower/Mandala pages are SVG placeholders at 1536 x 2048; real pages are 2048 x 2732, so run
  the test on a real page. Stroke log lines show "at N px/s" (the test uses 600 screen px/s).
- **Brush warm-up** (`warmUpBrushes()` in editor.js): 300 ms after the first page opens, each brush
  draws two tiny practice strokes on a hidden 160 px canvas, one brush every 30 ms (each step
  1-13 ms on the PC), pausing while she draws. Why: the first airbrush stroke on her iPad showed
  83% work / 29 ms slowest update vs 41% or less after - browsers only make code fast after it
  has run. Not verified on the iPad yet.

## Blender and Blur (step 10, batch 3)

- **Status:** original batch 3 passed PC and was committed as a96c03b. Her iPad: both tools
  smooth, but pressure too weak until pressing hard, Blender's color result unlike Pigment, and
  icons disliked. Owen approved the revisions below on PC (2026-10-21: "perfect! thank you!");
  committed as 4341706. Owen then confirmed the iPad retest: "everything works perfectly!
  thank you!" (2026-10-21). Batch 3 and step 10 are complete; step 11 passed the PC check; iPad installation/offline check pending.
  Batches 1/2, including watercolor 130 / glitter 120 / metallic 60, are confirmed smooth.
- **Implementation:** `js/blend-engine.js` exports `PaintEngine`, extending the original
  `StrokeEngine`. Ordinary brushes delegate unchanged to that engine. `modify: "blender"` /
  `"blur"`, `paint: "modify"` in brushes.js identify tools that change existing paint; they do
  not add the palette color, record a recently used color, or become the last color brush.
- **Blender now picks up and CARRIES paint.** Owen rejected the first local revision because
  he wants the yellow streaks invading green in IMG_6831.MOV, not merely a softened boundary.
  A per-stroke 12x12 paint tip retains separate colors across its footprint. Each dab picks up
  some local paint and retains earlier paint using `1 - exp(-distance/(size*2.5))`; strokes
  starting in yellow carry yellow into green, gradually picking up green. Samples obey line-lock.
  The palette color is never added. New strokes start with a fresh tip. The previous fixed-offset
  pull settings are removed. Blender spacing 0.2 (was 0.3) gives smoother continuous trails.
- **Pickup and Blur:** Blender's sampled paint favors pigment over white paper gaps
  (`weight = 1 - 0.9 * min(R,G,B)/255`), radius 30% of size, cap 16px. Blur still averages in
  place with ordinary pixel weights, radius 22% of size, cap 12px; it does not carry paint.
  Both keep a frozen starting picture and MAX opacity coverage. Blender cross-fades varying
  carried COLORS with a smooth bell and per-pixel running weighted averages (separate from
  opacity), avoiding visible round stamp boundaries without accumulating darker alpha blotches.
  Tilt gently widens the area. Maximum 48 page px each, default 30 / 65%; all other maxima
  stay unchanged. The size and opacity are remembered separately for each tool as usual.
- **Light-touch revision:** both pressure curves 0.4, opacity minimum 0.6, size minimum 0.9
  (was 0.65 / 0.15 / 0.65); hardness 0.65 instead of 0.35 gives a wider effective center with a
  soft edge. Natural tilt no longer weakens Blender. At 3% simulated pressure with opacity 65%,
  center strength 15.4% -> 45.4%; at 90% pressure 63.9%. Sliders still cap size/opacity; saved
  choices stay unchanged. This is a simulated response, not measured Pencil force.
- **Reference:** Owen's private IMG_6831.MOV (10.3 sec) shows green/yellow pencil grain becoming
  smoother, fuller color with little dragging. Frames inspected locally; recording never copied
  into the repository. New behavior is an original approximation, not a verified reproduction
  of Pigment's private mixing math, particularly for other color pairs.
  Follow-up: Owen explicitly wants streaks of yellow traveling into green and smooth lines;
  softening-only was insufficient. The latest samples compare local softening vs real pickup/
  carry on solid and original textured pencil marks. Automated checks confirm yellow influences
  green 60px beyond the boundary (local averaging radius only 14px), and vice versa.
- **Build up ON:** each new stroke uses the finished picture as its source, so successive strokes
  blend/smooth further. **OFF:** consecutive strokes with the same tool, size and lock region
  share an original source and a strongest-strength map; repeating the same path at equal or
  lower strength does not keep smoothing it. Higher pressure/opacity can strengthen it. Changing
  tools, size or lock region, painting, filling, undo/redo, Start over, leaving/reopening the page
  starts a new pass. The temporary pass is not saved; the finished colors and controls are saved.
- **Line-lock:** uses the existing fill worker's exact gap-closed/thin-sliver mask. Both destination
  pixels AND sampled neighbors obey it; the average divides by allowed samples only, preventing
  a neighboring outlined area's color (or artificial white padding) bleeding into the locked area.
  Uncolored white paper within the region can lighten paint naturally. Line art is never sampled
  or modified. With lock off, color can mix across outlined areas beneath the unchanged lines.
- **Memory/performance:** lazy source snapshots in 64px tiles avoid reading the full 22 MB canvas
  on touch-down. A reserved full-page source buffer is filled only as needed. A summed-area
  table makes each smoothed tile in linear time; cache capped at 96 tiles (~1.2 MB).
  The 12px paint tip is smoothed to 32px using tiny CPU-read-friendly canvases and the browser's
  native resizer. Dabs use quick tip-pixel lookups and average carried color; screen updates apply
  coverage to the frozen original. The oval row loop visits only the ellipse and increments
  coordinates instead of recalculating rotations per pixel. Refreshes capped around 60/s; no predicted
  smudges. Pencil-up updates paint memory only in visited tiles, not the whole bounding box.
  The source is ~22 MB at full page size; build-up off adds ~5.6 MB for strengths; result tiles
  are allocated only along the current stroke. Blender adds Float32 RGB/weight accumulators
  (16 bytes per visited tile pixel, plus its 4-byte live image); long strokes need more memory.
  Sources are released after build-up-on strokes,
  other picture edits/tool changes, or leaving the page.
- **Paint memory:** altered pixels lose their old single-color/opacity record (mixed paint cannot
  honestly keep that old record). Painting there afterwards treats it as existing mixed paint;
  normal new paint records its own memory again. History saves/restores this memory with pixels.
- **Preview:** cards/live preview now show curved paint ribbons matching the other brushes,
  current color plus a lighter shade, using actual blending and a ribbon clip mask. The previous
  two rectangular complementary-color blocks were disliked. Icons are now an outlined paper
  stump and a soft brush, matching the existing diagonal handles/line weights. Blender and
  Blur appear after Metallic. The old white-paint Speed test skips
  these tools because they need a colored source; the usual real-stroke speed log still works.
- **Checks:** direct engine checks for pressure/opacity, build-up on/off, exact undo/redo,
  cancellation, refresh-frequency independence, unchanged original nine brushes; real masks on
  Daffodils and both Tiger Lilies (no changed pixels outside, lines untouched), exact saved-color
  and paint-memory restore, lossless PNG; actual UI pointer strokes, undo/redo, reload persistence,
  export preview/download and portrait/landscape cards. Before/after sample sheet generated from
  actual tool output. Browser tests use an isolated profile, not Owen's saved coloring.
- **iPad acceptance:** Owen confirmed the final version works perfectly (2026-10-21), after
  being asked to check light pressure, color trails and fast strokes at size 48. No further
  tuning or speed logs are needed unless she reports a new problem. Earlier CPU-throttled
  measurements were estimates; the actual iPad acceptance is the result to use. Step 10 done.
- Tweakable sampling controls are in `js/settings.js`: `blendRadiusShare`, `blendMaxRadius`,
  `blendCarryDistance`, `blendTipGrid`, `blendTipPixels`, `blendPigmentWeight`, `blurRadiusShare`, `blurMaxRadius`, `blendCacheTiles`.

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
  off (remembered per device). Since step 10 it also logs speed lines after every stroke (see
  "Speed lines in the touch log").

## Auto-save and progress (step 7)

- `js/autosave.js`: `saveArtwork(id, colorCanvas, lineCanvas, memory)` stores, in one IndexedDB
  transaction: `artwork[id] = { color: PNG Blob, memory: gzip Blob (CompressionStream; null if
  unavailable), updated }`, `progress[id] = { updated }`, `progressThumbs[id] = JPEG preview`
  (420×560 composite of color + lines). All three snapshots are taken synchronously at call time
  (`toBlob` snapshots the canvas; memory is `.slice()`d) so leaving the page can't save the wrong
  picture. Measured on the daffodil: PNG 148 KB, memory 48 KB (from 22 MB), preview 103 KB.
- `js/editor.js`: `markChanged()` after every stroke / fill / undo / redo → `saveNow()` after
  `SETTINGS.autosaveDelayMs` (1500) of quiet; never mid-stroke; immediately on leaving the page
  (`closeEditor`), on `visibilitychange` → hidden, and on `pagehide`. `openEditor` waits for any
  in-flight save (`lastSave`), then `loadArtwork()` restores colors + memory before showing the
  page. Undo history is not saved (starts empty on each open).
- **Database version 2** (`js/storage.js`): stores thumbnails, artwork, progress, progressThumbs.
  Opening gives up after 4 s (an old tab with the old app version blocks the upgrade - this
  happened in testing); connections close on `versionchange` so new versions never get stuck
  again. **If her saved coloring can't be read, the page is NOT shown and NOT saved** (message:
  close other tabs and reopen), so a blank page can never overwrite her real work.
- `js/gallery.js`: before drawing cards, waits for the newest preview (`previewsReady()`) and
  reads `progress`; a page card shows her colored preview, a category/sub-category card shows its
  most recently colored page; untouched pages show the blank thumbnail.
- Tested: save + library previews at all three levels, exact pixel restore after a full reload,
  build-up memory restored (build-up off over a restored stroke stays even), stroke kept when
  leaving immediately and reopening, old-version-tab blocking shows the message.
- **Storage persistence:** `navigator.storage.persist()` is requested on first save; WebKit
  uses storage policies/heuristics and Home Screen installation can help. It is not a guarantee
  against removal or clearing data. The old blanket seven-day/weekly-visit advice was too broad.
  Keep .finley backups and exported pictures; see step 11 for separate Home Screen storage.
- **Start over** (button in the coloring screen's top bar, left of undo/redo): asks first in a
  dialog ("Keep coloring" = highlighted default, "Erase my coloring" = red outline; tapping outside
  cancels). Erasing saves a full-page undo step (so Undo brings it back until she leaves the page),
  whites the color layer, clears the paint memory, cancels the pending save, and (after any
  in-flight save) deletes the page's artwork/progress/progressThumbs (`forgetArtwork`), so the
  page is blank in the library too. Undo afterwards re-saves normally. Tested all paths.
- Not built (could add later): saving undo history between visits.

## Color picker, recent colors and palettes (step 8)

- **Files:** `js/color.js` (hex / rgb / hsv conversions), `js/palette.js` (data + toolbar
  swatches), `js/color-picker.js` (the picker window), `js/dialogs.js` (`askText` / `askConfirm`
  question boxes in the app's style, appended to `body` with class `dialog-top`, z-index 20).
- **Toolbar:** a "More" button (rainbow ring around the current color; tall pill spanning both
  swatch rows when upright, a full-width "More colors" row when sideways) is the first item in
  `#palette` and opens the picker. Below/above: a `#recent-colors` row (last 8 painted colors,
  hidden until she has painted; one row of 5 when sideways) and the active palette's swatches.
  `setupSwatches()` redraws only what changed (a color change just moves the highlight, so
  dragging in the picker doesn't rebuild swatches).
- **Picker window** (`#picker-dialog`): hue ring (red at top, clockwise) with a saturation x
  brightness square inside (HSV; square corners: top-left white, top-right pure hue, bottom black).
  Drag with Pencil, finger or mouse; the color applies live (`selectColor(hex, "picker")`). Ring is
  drawn once per size with `ImageData`; the square is redrawn with two gradients when the hue
  changes. Handles are DOM circles. Greys keep their hue so the ring handle doesn't jump. A
  "Before" swatch (tap to go back) and "Now" swatch, the hex code, recent colors, palettes,
  **Done** (also tapping outside / Escape closes). Upright: single column; sideways (landscape,
  >= 880 px wide): wheel on the left, colors and palettes on the right, no scrolling needed.
- **Recent colors:** `noteColorUsed(hex)` is called when a color stroke starts or a fill is tapped
  (not when merely picked); newest first, max 10 kept, 8 shown in the toolbar.
- **Palettes:** the built-in "Classic" (the original 24 swatches) can't be changed. She can make
  palettes (max 20, max 48 colors each, names up to 24 chars): "Add this color" on Classic starts a
  new palette (naming box, starts with the current color); on her own palette it adds the color
  (says if it's already there); "Remove colors" mode shows an x on each swatch; Rename; Delete
  (confirmation, "Keep it" is the default). Switching palettes changes the toolbar swatches.
- **Storage: localStorage**, keys `recent-colors` and `palettes` ({active, list}), not IndexedDB as
  first planned: it's a few hundred bytes, and avoiding another database version bump avoids the
  upgrade-blocking problem seen in step 7. (Browser storage policies apply; see step 11 backups.)
- The editor listens with `onPaletteChange(source)`: sources "palette" and "recent" only mean the
  swatches changed; anything else is a color change (switches the eraser back to the last brush,
  refreshes the brush preview).
- **Sideways panel is now 304 px wide with 5 swatches per row** (was 262 / 4) so the new recent
  row fits without scrolling on an iPad Pro 11" (766 px of panel height).
- Tested with simulated pointer events: ring at 0/90/180/270 degrees, square corners and middle,
  clamping when dragging outside the square, recents (order, only painted colors, persistence),
  palette create/add/duplicate/remove/rename/switch/delete, persistence after reload, naming
  box on top of the picker. Screenshot tool was flaky for the final visuals.
- Not built: typing a hex code; lightness slider; reordering palette colors.

## Export to Photos (step 9)

- **`js/save-picture.js`**, button `#export-button` ("Save", accent-colored, top bar left of Start
  over) and window `#export-dialog`. Flow: tap Save -> window opens, picture is made ("Getting your
  picture ready...", ~1 s on a PC) -> preview + one big button -> **second tap** calls
  `navigator.share({ files: [File] })` (iPad share sheet; "Save Image" puts it in Photos). Two taps
  on purpose: Safari only allows `share()` right after a tap, and building a 2048x2732 PNG takes
  a moment, so the picture is prepared first and shared on a fresh tap.
- **The picture:** a temporary canvas = white + color layer + line-art layer (lines on top), full
  page size (2048x2732, or 2732x2048), PNG (~1.1 MB for a lightly colored daffodil), opaque.
  File name `finleys-coloring-<page title>.png`.
- **The share sheet is used only on iPad / iPhone** (`isAppleTouchDevice()`: "iPad|iPhone|iPod" in
  the user agent, or `platform === "MacIntel"` with `maxTouchPoints > 1`, since iPadOS Safari
  reports itself as a Mac). Found on Owen's PC: Chrome on Windows reports `canShare({files})` true
  and opened the Windows share panel (My Phone, OneNote...) instead of saving. Tested six cases
  (Windows, Windows touchscreen, real Mac, iPad as Mac, iPad, iPhone).
- **Fallback (everything else):** the button is "Download picture" and downloads the file; the preview `<img>` re-enables the iOS touch-and-hold
  menu (`-webkit-touch-callout: default`, normally off app-wide) so "Add to Photos" always works.
  Cancelling the share sheet (`AbortError`) is silent; other errors show a message pointing to
  touch-and-hold.
- **"Download instead"** link (`#export-download`, under the main button, **iPad/iPhone only**): a
  backup in case the share sheet ever fails; saves the PNG to the Files app (Downloads). Hidden
  while the picture is prepared and on computers.
- Closing releases the picture's object URL; closing while it's still being made and reopening is
  handled. Export is blocked mid-stroke (`isReady`).
- Tested here: exact pixel contents (every line pixel black, every colored pixel kept, white paper,
  no transparency), share path with a stubbed `navigator.share` (file name/type/size, cancel, failure),
  download path, tap outside / Close, both orientations (fits, no scrolling).
  **Not testable here: the real share sheet** - Owen checks on the iPad.
- Not built: exporting the colors without lines, a share/export from the library, JPEG option.

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
  `?v=<yyyymmddHHMMSS>` onto every reference (index.html's CSS/JS, every `import ... from "./x.js"`,
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
| `manifest.webmanifest`, `icons/` | Home Screen identity and approved book icon |
| `sw.js`, `offline-assets.js` | Offline files and verified app updates; generated contents list |
| `js/offline.js` | App/offline window, downloads, install help, update and backup controls |
| `js/backup.js` | Download/restore editable coloring backups |
| `css/styles.css` | All styling; design tokens in `:root` |
| `js/app.js` | Router: address → screen |
| `js/library.js` | Reads `pages/pages.js`, builds page objects |
| `js/gallery.js` | Library screens and cards |
| `js/thumbnails.js` | Browser-made thumbnails (fallback) |
| `js/storage.js` | IndexedDB (thumbnails, artwork, progress, progressThumbs); atomic backup merge |
| `js/editor.js` | Coloring screen: layers, tools, taps, strokes, sliders, preview, fitting the page |
| `js/lineart.js` | Loads a page, makes white see-through, returns the darkness map |
| `js/fill.js`, `js/fill-worker.js` | Tap-to-fill |
| `js/palette.js` | Current color, recent colors, palettes (localStorage); toolbar swatches |
| `js/color.js` | Color conversions (hex / rgb / hsv) |
| `js/color-picker.js` | The full color picker window (hue ring, shade square, palettes) |
| `js/dialogs.js` | Small question boxes: ask for a name, ask "are you sure?" |
| `js/save-picture.js` | Save button: makes the finished picture, shares it to Photos / downloads it |
| `js/brushes.js` | Brush definitions, saved per-brush settings, paper grain |
| `js/blend-engine.js` | Blender/Blur: existing-paint sampling, soft coverage, line-lock and commit |
| `js/stroke-engine.js` | Draws brush strokes (dabs, coverage, live layer, commit; spray, bristles, watercolor rims, splatter) |
| `js/slider.js` | Pencil-friendly slider |
| `js/history.js` | Undo and redo |
| `js/autosave.js` | Saves/loads/forgets her coloring per page; colored previews for the library |
| `js/viewport.js` | Zoom and pan (where the page sits on screen) |
| `js/touch-input.js` | What each Pencil / finger / mouse action means; palm rejection; gestures |
| `js/touch-debug.js` | Temporary on-screen touch log (`?debug` link or 5 title taps; "Hide log"; "Speed test") |
| `js/speed-test.js` | Measures every brush on the device; largest smooth size per brush |
| `tools/stamp_version.py` | Stamps references and generates offline contents/hashes (before uploads) |
| `js/settings.js` | Tweakable numbers |
| `pages/pages.js` | The library list |
| `tools/import_pages.py`, `import-pages.bat` | Import tool |
| `serve.py`, `start-server.bat` | Local test server |
| `README.md` | Owen's beginner guide (running, importing, settings) |

## Home Screen, offline files and backups (step 11)

- **Status:** Owen approved the PC check on 2026-10-21 ("it worked now what").
  This checkpoint is for the hosted iPad installation/offline check. Wait for that report
  before calling step 11 complete or starting step 12.
- **Manifest and icons:** `manifest.webmanifest`, relative id/start_url/scope `./`, standalone,
  no orientation lock. `index.html` links the manifest, 180px Apple icon and Apple standalone
  metadata. User-approved original enchanted book/vines/slim pencil icon: `icons/enchanted-book-1024.png`;
  derivatives 192/512 and Apple 180, all opaque square PNG. `icons/README.md` records built-in
  generation and the final prompt. Earlier design options are retained but not cached offline.
- **Library button:** App & offline opens a scrollable window with installation help, page
  download status, Save all pages offline, backup/restore, update controls. Large controls,
  existing CSS variables, sticky close button, portrait/landscape. It is outside the editor.
- **Worker:** `sw.js` + generated `offline-assets.js`. The app shell cache is scoped to this
  deployment path and versioned. It includes HTML/CSS/JS, pages.js, manifest, small icons,
  prepared thumbnails and tiny SVG examples. Full raster outlines are NOT fetched for unopened
  pages unless she chooses Save all pages offline. Opening one online caches it; first-install
  opens are queued until the worker is ready. Bulk download uses two requests at a time and
  resumes after interruption. Status counts the actual library, currently 10 pages (7 SVGs).
- **Integrity:** `tools/stamp_version.py` now uses a seconds stamp, updates SW VERSION and its
  importScripts query, and generates SHA-256 contents lists. Hash checks stop a mixed GitHub
  deployment from replacing the working app. Text hashes normalize CRLF/LF for Windows/Git;
  binaries are exact. Run this tool after ANY source/page changes before publishing. It has
  only standard Python dependencies; the runtime app remains plain files with no build tools.
- **Outlines:** separate persistent cache keys include content hashes. Existing downloads
  survive app updates; changed art must be downloaded for that new revision. Keep page IDs
  stable and avoid changing art beneath existing coloring. Master icon files are not cached.
- **Updates:** installing workers wait normally. No automatic skipWaiting or reload. Update app
  is offered only in the library, waits for the latest save (failed save blocks reload), and
  refuses activation with other scoped windows open. A modal prevents navigation while busy.
  An explicit successful handover reloads the app. Closing all windows also allows normal
  activation. One previous shell bundle is kept for exact old module references. The worker
  never opens or deletes the artwork database. Database stays version 2.
- **Offline restart lesson:** serviceWorker.register can fail when reopening offline even with
  a working installed worker. Read getRegistration first, keep the current controller as a
  fallback, and keep offline controls working if checking for a new version fails.
- **Storage isolation/backup:** WebKit Home Screen storage can be separate from Safari. Do not
  tell Owen installation automatically moves her coloring. Before installing, Safari → Prepare
  backup → Save backup file; after installing, Restore backup in the new app if needed, then
  save all outlines offline there. The backup file remains in Files and is never modified.
- **Backup implementation:** `js/backup.js`, custom `.finley` file, magic header + little-endian
  JSON length + JSON index + original compressed Blob payloads. No enormous base64 string or
  external libraries. Includes artwork PNG, gzip paint memory, progress previews/timestamps,
  palettes/recents, brush settings, line-lock/build-up and extra brush. Excludes outlines,
  undo history, touch-debug setting and temporary blending state. Backups include stored page
  IDs even if not currently listed. File limits live in SETTINGS.
- **Restore:** reads/validates the complete file (bounds, unique IDs, decoded images, decompressed
  memory size where supported) before a confirmation and writes. `dbMergeArtwork` merges all
  artwork/progress/previews in ONE transaction, reading saved dates inside it to keep newer
  local work, including concurrent saves. Restores allowlisted preferences, reports failures;
  finishing with Open library reloads UI caches. Online restores also try downloading current
  outlines for listed restored pages. Missing/removed outlines require restoring their IDs.
  No cloud sync, accounts, or uploads of artwork. No deletion of Safari data is required.
- **Checks:** isolated Chrome profile under `/finley-coloring/`: installation and icon/layout,
  offline library and uncached-page explanation; real UI stroke + immediate leave; backup
  download/restoration into separate storage (color and gzip bytes exact), newer work kept,
  settings transferred, truncated file rejected; all 10 outlines downloaded and real Daffodil /
  both Tiger Lilies reopened offline; PNG download offline; deliberately incomplete update
  rejected with old app retained; extra-window activation refused; successful update retains
  downloaded outlines and artwork. No unexpected JavaScript errors. Real iPad Home Screen,
  Files picker/download, Pencil feel and Safari offline restart still need Owen's hosted check.
- **References:** https://webkit.org/tracking-prevention/ (Home Screen isolation),
  https://webkit.org/blog/14403/updates-to-storage-policy/ (storage),
  https://web.dev/articles/service-worker-lifecycle (update lifecycle).
