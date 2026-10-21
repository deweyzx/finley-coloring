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
| `manifest.webmanifest`, `icons/` | Home Screen app name, display mode and approved book icon |
| `sw.js`, `offline-assets.js` | Offline files and verified updates; generated file list |
| `js/offline.js`, `js/backup.js` | App/offline window, downloads, updates and editable-coloring backups |
| `css/styles.css` | All the looks: colors, sizes, layout |
| `js/app.js` | Starts the app and picks the screen from the address (`#/flowers/tulips`) |
| `js/library.js` | Reads `pages/pages.js` and works out each page's path, id and title |
| `js/gallery.js` | The library screens: categories, sub-categories, pages |
| `js/thumbnails.js` | Makes small preview pictures once, and saves them |
| `js/storage.js` | IndexedDB: saved coloring, paint memory, progress and thumbnails |
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
| `tools/stamp_version.py` | Gives every file a version stamp before an upload, so the iPad never mixes old and new files |
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
- **Size:** 2048 × 2732 (or 2732 × 2048 sideways), the size the importer produces. The older placeholder pages are smaller. Larger files increase memory use and slow coloring.
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
or a fill) at a time. On the iPad: tap with **two fingers** to undo, **three fingers** to redo.
On the PC: Ctrl+Z to undo, Ctrl+Y to redo.

## Zoom, pan and the Pencil

- **On the iPad:** pinch with two fingers to zoom, drag with two fingers to move around. Pinch
  smaller than the page and it springs back to show the whole page.
- **The Apple Pencil and one finger both draw** (and tap to fill). Two fingers zoom and move.
- **Palm rejection is automatic:** while the Pencil is touching the screen, and for half a second
  after it lifts, fingers can't draw (they can still do the two/three-finger taps). A hand that
  lands just before the Pencil leaves no mark, and palm-sized touches are always ignored.
  To make it "Pencil only", set `fingersDraw: false` in `js/settings.js`.
- **Touch debug log (temporary):** open **https://deweyzx.github.io/finley-coloring/?debug**
  (or tap the page title on the coloring screen 5 times) to show a log of every touch: how many
  fingers, their timing, movement and size, and what the app decided. The log's **Hide log**
  button turns it off. The gesture limits are in `js/settings.js`.
- **On the PC:** the mouse wheel zooms, dragging with the middle mouse button (or holding the
  space bar and dragging) moves around, and Ctrl+0 shows the whole page again.

To change how a brush feels, or to add a new one, edit `js/brushes.js`. Each brush is one short
block of settings, and the comments at the top explain each setting.

## Saving

Her coloring saves automatically: a moment after each change, when she leaves a page, and when
she switches away from or closes Safari. Opening a page brings her coloring back, and the library
shows her colored version of each page (a category shows the page she colored most recently).

Coloring is stored on this device, not in a GitHub account or an online cloud. Browsers can
remove website data, and clearing Safari data removes saved coloring. Home Screen installation
can help storage persistence, but it is not a backup. Keep a **.finley backup** and export finished
pictures to Photos. See the installation and backup instructions below.

**Start over** (top of the coloring screen) erases all the coloring on a page, after asking
"Start this page over?". If she changes her mind right away, Undo brings it all back, as long as
she hasn't left the page.

If a page ever says its saved coloring couldn't be opened, close any other Safari tabs with the
coloring book and open the page again. Nothing is lost.

## Colors

- The swatches in the tool panel are the **Classic** palette. Tap one to paint with it.
- Tap **More** (the rainbow circle) to open the color picker: drag around the **ring** to choose a
  color of the rainbow, then drag in the **square** to make it lighter, darker, brighter or
  greyer. The color changes as you drag. Tap **Done** when you like it. "Before" shows the color
  you started with (tap it to go back).
- **Recent colors** (a row above the swatches) are the colors you actually painted with lately.
- **Palettes** are your own sets of colors. In the picker, tap **Add this color** to start a
  palette (it asks for a name), **+ New palette** to make another, and tap a palette's name to
  switch to it. **Remove colors** lets you tap colors to delete them from a palette, and Rename
  and Delete palette do what they say. The Classic palette can't be changed.
- Palettes and recent colors are saved on this device and included in .finley backups.

## Saving a finished picture to Photos

Tap **Save** at the top of the coloring screen. The app makes a picture of her coloring (with the
black lines on top, full size), shows a preview, and offers a big **Save to Photos** button. Tap it,
then choose **Save Image** in the sheet that opens, and the picture is in her Photos. (She can also
touch and hold the preview and choose **Add to Photos**, or tap **Download instead** to save the
file to the Files app if the share sheet ever doesn't open.) On a PC the button says **Download
picture** and saves a PNG file instead.

## Brushes

The tool bar has Fill, Pencil, Marker and Eraser, plus a **Brushes** button (the last one) that
opens a window with every brush and a sample of each. Pick one there; the Brushes button then
shows that brush, so it's easy to spot. New in step 10 (batch 1):

- **Airbrush** - soft spray. The color builds up the more she sprays over a spot, or if she holds
  the Pencil still. Pressing harder lets more paint out. The opacity slider is the most it builds to.
- **Smooth hair** - a soft paintbrush with faint hair streaks; strokes start from a fine tip.
- **Watercolor** - see-through color with darker edges where it pools. Colors mix when layered
  (yellow over blue looks green).
- **Splatter** - flicked droplets. Press harder for more droplets, thrown farther; the size slider
  sets how wide they spread.

New in step 10 (batch 2):

- **Glitter** - separate flakes of different sizes on a deep-colored base, some much brighter
  than others, with sharp star-shaped glints. Press lightly for a sprinkle, harder for a full
  coat. Going over glitter again adds new flakes.
- **Metallic** - shiny like metallic ink: lit from the top left, with soft polished reflections.
  Coloring in an area makes one smooth, shiny surface.

Both looks are part of the picture itself, so they also show in a picture saved to Photos.

New in step 10 (batch 3; the full brush collection is confirmed working on Finley's iPad):

- **Blender** picks up the color where the stroke starts and carries it along, gradually mixing
  with the colors it crosses. Start in yellow and drag into green to pull a yellow trail into it;
  reverse the stroke to carry green into yellow. It favors paint over white paper grain gaps.
- **Blur** softens existing color transitions in place.

These two tools use the paint already there, not the selected palette color. Start by painting
two colors next to each other, then stroke across their boundary. Their maximum size is 48;
opacity controls strength. A light Pencil touch already blends visibly, with firmer pressure
strengthening the effect; she should not need to press hard. Each remembers its
own size and opacity. White paper can lighten the color when mixed into it.

**Stay inside lines** limits both the changed pixels and where color is sampled from, keeping
the neighboring outlined areas separate. The black lines always stay untouched.

**Build up color on:** each new stroke blends or smooths further. **Off:** consecutive strokes
with the same tool, size and outlined area work from the same starting picture, so repeated
passes at the same strength stay even. More pressure or opacity can strengthen the effect.
Switching tools, changing size or outlined area, undoing, painting, or reopening a page starts
a fresh blending pass. The finished result always auto-saves, appears in the library, and is
included in exported pictures; the temporary blending pass itself is not saved.

The settings for each brush are in `js/brushes.js`, with comments explaining each number.

## Home Screen installation and offline coloring (step 11)

**Status: step 11 is complete (2026-10-21).** PC testing passed. The first iPad restore needed
repair 173f41d; the same backup then recovered the coloring. Owen confirmed the final installed
app checklist worked perfectly: all 10 pages saved offline, Airplane Mode launch, coloring
persistence after leaving/reopening, and rotation. The next planned step is storybook themes;
that design work has not started.

The library's **App & offline** button has the controls below.

### Install on her iPad

1. In Safari, open https://deweyzx.github.io/finley-coloring/ while online.
2. Before moving, open **App & offline → Prepare backup → Save backup file**. Save the
   `.finley` file somewhere you can find in Files (Downloads or iCloud Drive).
3. Use Safari's **Share → Add to Home Screen → Add**. If shown, leave **Open as Web App** on.
4. Open the new green book-and-pencil icon. It opens without Safari's address bar.
5. If her coloring is missing there, choose **App & offline → Restore backup**, pick the file,
   confirm Restore, then Open library. Safari and the installed app can have separate storage;
   a blank installed library does not mean her Safari coloring was erased.
6. Choose **Save all pages offline** in the installed app and wait for all pages to be ready.
   Downloads are separate for each browser/device. Restoring while online also downloads the
   current outlines for the restored pages when possible.
7. Turn on Airplane Mode, reopen the icon, and try the real Daffodil and Tiger Lily pages.
   Color, leave, reopen, undo/redo and save a finished picture. Rotate the iPad too.
8. Turn the connection back on when finished. Keep the backup file until all checks pass.

On a PC, Chrome may offer an install icon in the address bar, or **Install app** in the app's
window. Installation is optional for testing offline access at http://localhost:8000.

### What works offline

The app, library list, small thumbnails and SVG example pages download during setup. Opening
any real page online saves its outline. **Save all pages offline** downloads the remaining
outlines, two at a time; it resumes without re-downloading successful pages. It doesn't silently
fetch full-sized images for hundreds of unopened pages. The window reports how many pages are
ready on this device. Keep the app open during a bulk download.

Coloring, brushes, palettes, undo/redo, auto-save and PNG export work offline on downloaded
pages. A page not yet downloaded gives instructions and does not overwrite her saved coloring.
New pages and updates require a connection. Browser storage can still run out or be cleared.

### Back up or move coloring

**Prepare backup** gathers all saved coloring, its build-up memory, colored library previews,
brush sizes/opacity, switch settings and palettes. **Save backup file** downloads a `.finley`
file to Downloads/Files. It is an editable-coloring backup, unlike the flattened PNG in Photos.
Preparing alone does not save a file: tap Save backup file too.

**Restore backup** checks the complete file before writing, asks for confirmation, merges its
pages and keeps newer coloring already on this device. Matching save dates are refreshed from
the backup so re-restoring can repair a failed import. It replaces palettes/brush settings
with the backup's settings. The original backup is never changed. It does not include outline
images, undo history or a live blending pass. If offline, download the outlines later. Pages
whose original IDs no longer exist remain stored, but need those library IDs restored to open.
No account, automatic sync or upload of her pictures is involved.

### Updates and adding pages

New app files download in the background. A new version waits while the old app is open.
Finish coloring and close other coloring-book tabs/windows, then in the library use **App &
offline → Check for updates → Update app** when offered. The app waits for the last save;
no automatic reload interrupts a stroke. Closing all app windows and reopening also allows
an already-downloaded update to take over. GitHub deployment can take a few minutes; retry if
an update cannot finish yet. Existing coloring is not deleted by an app update.

When changing code or adding pages, run **`python tools/stamp_version.py` before the upload**.
It gives file references a fresh version and writes `offline-assets.js`, the list used to
verify and download the matching app. This is a small Python publishing helper, not a build
system or something the iPad runs. Do not edit that generated list by hand.

Storage details: [WebKit's Home Screen storage explanation](https://webkit.org/tracking-prevention/)
and [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

### PC check for this step

1. Start the local server and open http://localhost:8000 in Chrome.
2. Open **App & offline**, wait for setup, then **Save all pages offline**. Expect 10 of 10 with
   the current library. Check the icon and scroll through the window in both window shapes.
3. Color a page and return to the library. Prepare and save a backup to Downloads.
4. In Chrome press F12 → Network, change **No throttling** to **Offline**. Reload the page,
   browse the library, open Daffodils and both Tiger Lilies, color, leave and reopen. Try saving
   a PNG. Keep the local server running; this tests browser offline access.
5. Change the Network setting back to **No throttling**, then close Developer Tools.
6. Restore the saved .finley file without deleting any existing data. Confirm the message and
   Open library; coloring/palettes should still be there. Newer work should be kept.
7. This original checklist has already passed, along with the later iPad repair and offline
   checks. Keep these instructions for future regression checks if something changes.

### If an earlier iPad restore left blank previews or unreadable pages

Keep the original Safari coloring and .finley backup. In the installed app, go online and open
**App & offline → Check for updates → Update app** when offered. Close other coloring-book
windows if asked. Then **Restore backup** using the same file, confirm, and choose **Open
library**. Matching pages should be refreshed; newer coloring is kept. Close and reopen the
installed app and check those pages again. Do not clear website data or delete the app to repair
this issue. The repair copies the backup's compressed data independently of the Files picker.

### Project checkpoint and next step

Latest published app code: **173f41d**, including the accepted iPad restore repair. Home Screen
installation and offline coloring are complete and accepted on Finley's iPad. The next planned
step is **12: Storybook design and themes**, including Storybook, Midnight Forest, Ocean Dreams,
Autumn Cottage and a minimal look. Step 12 has not started. CLAUDE.md and AGENTS.md contain the
full implementation history, current settings and next-session notes.
