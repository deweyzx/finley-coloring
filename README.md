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
| `serve.py`, `start-server.bat` | Local test server (only for your PC, not part of the app) |

## Adding a coloring page

1. Put the image in its sub-category folder, e.g. `pages/flowers/roses/red-rose.png`.
2. In `pages/pages.js`, add `"red-rose.png",` to the Roses `pages` list.
   The title "Red Rose" is made from the file name automatically.
3. Every file name must be unique across the whole library, and must not be renamed
   after she's colored it (her progress is saved under the name). Moving it to another folder is fine.
4. If you replace a picture with a different one, give it a new file name. Otherwise the old thumbnail is still shown.

New categories and sub-categories: create the folder, then copy an existing block in `pages/pages.js`.

**Best format:** PNG, black lines on a white (or transparent) background.
- **Size:** about 1500–2500 pixels on the long side. 1536 × 2048 (the iPad's shape) is ideal. Bigger pages use a lot of iPad memory and make fills slower.
- **Lines:** dark and solid, at least ~6 px thick at that size, and shapes fully closed. A gap in a line lets tap-to-fill leak into the next area.
- **Avoid:** JPG (blurry grey speckles around lines), grey shading, or textured backgrounds.
