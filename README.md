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
| `js/editor.js` | The coloring screen |
| `js/lineart.js` | Loads a page and turns its white areas see-through |
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
