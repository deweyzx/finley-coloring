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
| `js/app.js` | Starts the app and switches between screens |
| `js/gallery.js` | Draws the grid of page cards |
| `js/editor.js` | The coloring screen |
| `js/lineart.js` | Loads a page and turns its white areas see-through |
| `pages/pages.js` | **The list of coloring pages** |
| `pages/*.svg` | The placeholder pages |
| `serve.py`, `start-server.bat` | Local test server (only for your PC, not part of the app) |

## Adding a coloring page

1. Put the image in the `pages` folder.
2. Add one line to `pages/pages.js`, for example:
   `{ id: "owl", title: "Owl", file: "pages/owl.png" },`
3. Never change a page's `id` later. Her saved coloring is stored under it.

**Best format:** PNG, black lines on a white (or transparent) background.
- **Size:** about 1500–2500 pixels on the long side. 1536 × 2048 (the iPad's shape) is ideal. Bigger pages use a lot of iPad memory and make fills slower.
- **Lines:** dark and solid, at least ~6 px thick at that size, and shapes fully closed. A gap in a line lets tap-to-fill leak into the next area.
- **Avoid:** JPG (blurry grey speckles around lines), grey shading, or textured backgrounds.
