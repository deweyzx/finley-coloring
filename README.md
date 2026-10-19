# Coloring Book

A free coloring app for iPad + Apple Pencil, written in plain HTML, CSS and JavaScript.

## Test it on this PC

1. Double-click `start-server.bat` (or run `python serve.py` in this folder).
2. Open **http://localhost:8000** in Chrome.
3. To stop, close the black server window.

Don't open `index.html` by double-clicking. Browsers block some features for files opened straight from disk.

## Files

| File | What it does |
|---|---|
| `index.html` | The page skeleton: both screens (gallery and coloring) |
| `css/styles.css` | All the looks: colors, sizes, layout |
| `js/app.js` | Starts the app and picks the screen from the address (`#/flowers/tulips`) |
| `js/library.js` | Reads `pages/pages.js` and works out each page's path, id and title |
| `js/gallery.js` | The library screens: categories, sub-categories, pages |
| `js/thumbnails.js` | Makes small preview pictures once, and saves them |
| `js/storage.js` | The IndexedDB database (thumbnails now, her coloring later) |
| `js/editor.js` | The coloring screen: tools, taps, fitting the page on screen |
| `js/lineart.js` | Loads a page and turns its white areas see-through |
| `js/settings.js` | **Numbers you can tweak**, like gap closing for tap-to-fill |
| `js/fill.js`, `js/fill-worker.js` | Tap-to-fill (the heavy work runs in the background) |
| `js/palette.js` | The color swatches |
| `pages/pages.js` | **The list of categories and pages** |
| `pages/<category>/<sub-category>/` | The page images |
| `thumbs/<category>/<sub-category>/` | Small previews of each page for the library (made by the import tool) |
| `serve.py`, `start-server.bat` | Local test server (only for your PC, not part of the app) |
| `import-pages.bat`, `tools/import_pages.py` | The import tool (see below) |
| `tools/import-log.json` | The import tool's record of what it has imported |

## Importing coloring pages (the easy way)

The import tool takes messy images (from AI generators, downloaded packs, scans) and turns
them into clean pages for the app, then adds them to the library for you.

**1. Put your images in the `import` folder,** sorted into a category folder and a
sub-category folder:

```
import/
  Flowers/
    Roses/
      my-rose.png
      ChatGPT Image Oct 3.png
  Dogs/
    Huskies/
      husky.jpg
```

- PNG, JPG and WEBP all work.
- Folder names become the names she sees, tidied up: filler like "Coloring Page", "Line Art"
  or "for Adults" is dropped, so `tiger-lily-coloring-page` shows as "Tiger Lily".
  Singular or plural stays as you typed it, so name the folder `Tiger Lilies` if you want the plural.
- If the category or sub-category already exists in the app, the pages are added to it.
  Singular and plural count as the same, so a `Tiger Lily` folder adds to "Tiger Lilies".
  If it doesn't exist yet, it's created.
- To rename a category or sub-category later, change its `name:` in `pages/pages.js`.
  That's always safe. Her coloring isn't affected.

**2. Double-click `import-pages.bat`.** The first time, it installs two free image tools
(Pillow and NumPy). Then it works through every image and prints a summary:
what it added, and anything it skipped and why.

**3. Check the new pages** by starting the test server (`start-server.bat`) and looking at them in Chrome.

**4. Put them online:** make a checkpoint and upload it (ask Claude, or use git), and they
appear on her iPad about a minute later.

What it does to each image:
- makes the paper pure white and the lines solid black, with no grey haze, specks or off-white paper
- gives the lines a very thin smooth edge so curves don't look jagged when zoomed in
  (the `EDGE_SOFTNESS` setting; 0 = hard pixel edges)
- trims empty margins and resizes to 2048 × 2732 (wide pictures: 2732 × 2048)
- thickens lines that are too thin, and seals tiny gaps where lines only touch at a corner
- gives it a clean name. "A detailed coloring page of a red ROSE.jpg" becomes `red-rose.png`.
  Machine names like "ChatGPT Image 3 Oct.png" become `roses-01.png`.

Good to know:
- **Your originals are never changed, moved or deleted.** The `import` folder stays on this PC only.
  It is not uploaded to the website and not saved in git checkpoints, so keep your own backup.
- **Running it again is safe.** Images it already imported are skipped. So is the same picture
  saved twice (say, a PNG and a JPG of the same page). You can leave old images in the folder,
  or clear them out once imported.
- **Settings** are at the top of `tools/import_pages.py`. For example, `SPECK_AREA` is the
  largest dot that gets removed as a speck. Raise it if specks survive, lower it if tiny real
  details disappear. `EDGE_SOFTNESS` controls how smooth the line edges are.
- **Changed a setting and want to redo pages?** The tool skips images it already imported, so
  ask Claude to remove those pages first. Only do this before she has colored them.
- **Pages look a bit grey and fuzzy on the PC?** That's the browser shrinking a big page to fit a
  small window, not the page itself. On her iPad's sharper screen the lines look solid.
- **Thumbnails:** for each page, the tool also saves a small preview (about 40 KB) in `thumbs/`,
  so the library loads fast even with hundreds of pages. Every run also makes any missing ones,
  for example after you add a page by hand or move a sub-category. Just run it again.
- `tools/import-log.json` is the tool's memory of what it imported. Don't delete it.
- If pages.js has a typo, the tool stops before changing anything and tells you the line number.

## Adding a coloring page by hand

1. Put the image in its sub-category folder, e.g. `pages/flowers/roses/red-rose.png`.
2. In `pages/pages.js`, add `"red-rose.png",` to the Roses `pages` list.
   The title "Red Rose" is made from the file name automatically.
3. Every file name must be unique across the whole library, and must not be renamed
   after she's colored it (her progress is saved under the name). Moving it to another folder is fine.
4. If you replace a picture with a different one, give it a new file name. Otherwise the old thumbnail is still shown.
5. Run `import-pages.bat` once (even with nothing to import). It makes the page's thumbnail.
   Without one, the app makes a preview itself, just more slowly.

New categories and sub-categories: create the folder, then copy an existing block in `pages/pages.js`.

**Best format:** PNG, black lines on a white (or transparent) background.
- **Size:** about 1500–2500 pixels on the long side. 1536 × 2048 (the iPad's shape) is ideal. Bigger pages use a lot of iPad memory and make fills slower.
- **Lines:** dark and solid, at least ~6 px thick at that size, and shapes fully closed. A gap in a line lets tap-to-fill leak into the next area.
- **Avoid:** JPG (blurry grey speckles around lines), grey shading, or textured backgrounds.

## Tap-to-fill settings

Open `js/settings.js` to adjust how tap-to-fill behaves:

- `gapClosing` (default 4): breaks in a line up to about twice this many pixels wide are treated as
  closed, so the color doesn't leak through. If fills still leak on a page, raise it a little.
  If a thin area won't fill in one tap, lower it.
- `thinPatchWidth` (default 9) and `thinPatchLimit` (default 8000): gap closing can cut off thin
  bits of an area, like wedges where a vein meets the outline, strips between close lines, and
  the tight curves of a ruffled edge. After each fill, white patches touching it are filled too
  if no spot in them is more than `thinPatchWidth` pixels from a line, and they are no bigger
  than `thinPatchLimit` pixels. Wider or bigger patches are other areas and stay white.
  If white slivers remain, raise `thinPatchWidth` a little. If a fill spills into a thin
  neighboring strip through a break in a line, lower it. `thinPatchLimit: 0` turns this off.
- `ignoreSpecks` (default 30): stray dots smaller than this many pixels don't block a fill.
- `tapReach` (default 10): a tap that lands right on a line fills the nearest open area this many
  screen pixels away.
- `fillUnderLines` (default 2): how far the color tucks in under the lines so no white rim shows.

After changing a setting, refresh the page in the browser (or upload it for the iPad).

## Brushes

Pick **Pencil**, **Marker** or **Eraser** in the tool panel. The **Size** and **Opacity** sliders
set the brush's strongest stroke: pressing lightly with the Pencil makes it thinner and lighter
than that. Tilting the Pencil over makes the pencil shade with the side of its lead. Each brush
remembers its own size and opacity. The preview shows the brush at the size it appears on screen.

A single stroke never gets darker where it crosses itself; a new stroke on top builds up color.

**Stay inside lines (line-lock):** the switch under the tool buttons. When it's on (the default),
a brush stroke only colors inside the outlined area where it started, exactly the area a fill
would cover there, so she can color quickly without going over the lines. It works for every
brush, including the eraser. Turn it off to draw freely. The app remembers the choice.

**Build up color:** the switch below it. On (the default), each new stroke on top deepens the
color, for layering and shading. Off, going back over a spot in the same color keeps it even
instead of darker, which is good for touching up missed spots. Painting a different color on top
works normally either way.

## Undo and redo

The curved arrows at the top right of the coloring screen go back and forward one step (a stroke
or a fill) at a time. On the PC: Ctrl+Z to undo, Ctrl+Y to redo.

To change how a brush feels, or to add a new one, edit `js/brushes.js`. Each brush is one short
block of settings, and the comments at the top explain each setting.
