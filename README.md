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
| `css/compact.css` | Compact library and coloring layout (tokens stay in styles.css) |
| `js/workspace-ui.js`, `js/page-browser.js` | Pop-open controls, focus mode and Pages drawer |
| `fonts/` | Local Literata/Figtree fonts and their free-font licenses; available offline |
| `js/app.js` | Starts the app and picks the screen from the address (`#/flowers/tulips`) |
| `js/library.js` | Reads `pages/pages.js` and works out each page's path, id and title |
| `js/gallery.js` | The library screens: categories, sub-categories, pages |
| `js/splash.js` | The opening book animation, tap/key skip, Reduce Motion and cleanup |
| `js/themes.js` | The Themes window and remembered appearance (Storybook first) |
| `js/modal.js` | Shared window focus, nested questions and background input blocking |
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
| `start-design-preview.bat` | Separate mockup server on port 8001; avoids the app's offline cache |
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
persistence after leaving/reopening, and rotation. Step 12's Storybook library and coloring
screen have passed Owen's PC review and her iPad check.

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

The app, bundled fonts, library list, small thumbnails and SVG example pages download during setup. Opening
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

Current checkpoint: **Ocean Dreams, version 20261021233948**. Owen requested direct upload
for her iPad test, skipping separate PC approval. Local checks passed; iPad acceptance is pending.

Previous accepted app checkpoint: **153d049, Midnight Forest, version 20261021211413**, uploaded and
verified live. PC accepted ("everything works good"); iPad accepted ("everything worked").
This checkpoint records Midnight Forest's iPad acceptance and the new Ocean Dreams theme.

Previous accepted app checkpoint: **a944bea, compact interface, version 20261021201511**, uploaded and
verified live. PC accepted ("works great"); iPad accepted ("everythging worked perfect").
This checkpoint includes the compact iPad acceptance, Midnight Forest implementation and
its PC acceptance in all three project guides.

Previous accepted app checkpoint: **38b4c83, Step 12 part 3, version 20261021174002**, the Storybook Themes selector
and matching windows, uploaded with live files verified. **PC and iPad reviews passed**
("everything worked", then "ipad test worked"). The previous checkpoint **14eb58e, version 20261021162959** delivered the
approved opening animation, accepted on PC and iPad (2026-10-21). Earlier checkpoint **0ff818a** delivered
part 1's Storybook library/coloring design and slider repair, accepted on PC and iPad (2026-10-21).
Home Screen installation and offline coloring were accepted on Finley's iPad in step 11,
including restore repair 173f41d.
CLAUDE.md and AGENTS.md contain matching implementation history, settings and next-session notes.
This checkpoint includes the part 1 iPad acceptance, part 2 PC acceptance and future brush-column
request. The brush chooser idea is recorded below and has not been implemented.
This checkpoint includes part 2's subsequent iPad acceptance and part 3's implementation and
passed PC review in all three guides. Storybook is the only theme in this first selector round;
its iPad check has passed. Each alternate theme will still be built and tested separately.
Both compact mockups are approved ("everything looks great!"). The actual compact interface
**20261021201511** also passed its PC test ("works great"). This checkpoint includes that
implementation, part 3's iPad acceptance and the preview-server repair. Its subsequent
iPad test passed too. Midnight Forest subsequently passed its own PC and iPad round.
Ocean Dreams is now implemented for its own direct iPad test round.

## Storybook design (step 12, part 1)

The library now looks like a green book cover above parchment shelves: white paper stacks,
progress ribbons, and a **Where you left off** card for the most recently colored page.
The card stays hidden until there is saved coloring. A red ribbon means coloring is in progress.
Categories, page names and her existing coloring stay the same.

The coloring screen uses matching parchment controls around a white page. Buttons and recent
colors stay large; the Size and Opacity sliders respond across their whole row. Keyboard users
can use the arrow keys, Home/End and Page Up/Down after focusing a slider. Literata and Figtree
fonts are included in the app, so they don't need Google Fonts or an internet connection.

The slider knobs have been made smaller and spaced away from their labels and numbers after
the first PC review. The full 50px row still responds to dragging. In a narrow upright window,
the preview and sliders move below the tools to give them more room. Owen accepted this repair
on PC and then confirmed the iPad checks worked too.

### Check this part on the PC

1. Double-click `start-server.bat`, then open http://localhost:8000 in Chrome.
2. If the previous design appears, go to **App & offline → Check for updates → Update app**
   when offered. Close other local coloring-book tabs if asked. Keep your saved website data.
3. Browse a collection, then a sub-category, open a real page, and use Back to return.
4. Color a little and return to the library home. Its progress preview/ribbon and **Keep
   coloring** should lead back to the saved picture. With no colored pages, there is no continue card.
5. Try the tools, Stay inside lines, Build up color, Size and Opacity, undo/redo, More colors
   and the Brushes window. Leave the page and reopen to confirm the coloring remains.
6. Resize Chrome into a tall window and a wide window. Check that titles, buttons and colors
   remain readable and reachable. On shorter windows the sideways panel can scroll.
7. These PC checks and the following iPad checks have passed. Keep the lists for reference.

### Check this part on her iPad

**Passed:** Owen reported "everything works good" after the upload. No repeat test is pending.

1. Open the installed app while online. Choose **App & offline → Check for updates → Update app**
   when offered. If the upload has only just finished, allow a few minutes for GitHub Pages.
2. Check the library header, page stacks, progress ribbons and **Keep coloring** card.
3. Open a colored page and check Size/Opacity at both ends with the Pencil and her finger.
   Try drawing, undo/redo and More colors, then leave/reopen the page.
4. Rotate upright and sideways. Text, knobs, values and buttons should stay clear and reachable.
5. Report the results before the splash animation is built. Keep existing website data.

The approved splash animation has passed both PC and iPad checks. Next, the **Themes** button
starts with **Storybook only**, so you can test the selector first. Other themes will be added
**one at a time**, with a test between each: Midnight Forest, Ocean Dreams, Autumn Cottage,
and a clean minimal look.

## Opening animation (step 12, part 2)

On a fresh opening or refresh, the green book cover appears with growing ivy, the enchanted
book icon and a golden thread, then fades into your library or the page you had open. It takes
about three seconds. Browsing between pages does not replay it.

Tap anywhere to skip, or press **Space**, **Enter** or **Escape**. Holding the skip touch
doesn't pass it through to the picture. With Reduce Motion enabled on the device, the cover
stays still and fades gently instead. The animation is removed when finished and works offline
after the app update is downloaded. Your coloring, palettes and brush settings stay as they are.

### Check this part on the PC

1. Double-click `start-server.bat` and open http://localhost:8000 in Chrome.
2. If needed, choose **App & offline → Check for updates → Update app**. Keep website data.
3. Refresh and let the entire opening play. Check the ivy, book icon, golden thread and fade.
4. Refresh again and click to skip. Try Space, Enter and Escape on separate refreshes too.
5. Try a tall window and a wide one. The thread should remain lined up with the book's Pencil.
6. Open a real page and refresh there: the opening should finish on that same page. Color a
   little, try undo/redo, leave and reopen; saved coloring should remain. Clicking through the
   library should not restart the animation.
7. Owen accepted the PC result ("looks perfect"), then the iPad result ("everything works perfect").

### Check the opening on her iPad

**Passed:** Owen reported "everything works perfect" after update 14eb58e. Keep this checklist
for reference; there is no pending repeat check.

1. While online, choose **App & offline → Check for updates → Update app** when offered.
2. Close and reopen the installed app to watch the opening. Try upright and sideways.
3. On another fresh opening, tap with a finger or Pencil to skip. The app should be usable
   afterward, with no stray coloring. Browsing through the library should not replay the intro.
4. Open a colored page and check that your work is still there. Report the result before the next part.

## Themes and matching windows (step 12, part 3)

**PC and iPad reviews passed:** Owen confirmed "everything worked", then "ipad test worked"
after upload 38b4c83. This round is complete.

The library now has a **Themes** button. It offers **Storybook** first: forest-green leather,
warm parchment and gold, with a preview and selected checkmark. Tap its card to remember the
choice on this device. Other themes will come one at a time, with a test between each:
Midnight Forest, Ocean Dreams, Autumn Cottage, then the minimal look.

More colors, Brushes, the name/confirmation boxes, App & offline and Save picture now match
the Storybook design. Large windows scroll, and the Done row stays within reach. Close buttons
and keyboard focus are consistent. Escape closes a naming box without closing the picker
underneath. The iPad's **Download instead** link remains below the main Save to Photos button.
The current brush grid, painting tools, coloring data and backups keep their existing behavior.
Theme choice is a device preference and is not included in the coloring backup.

### Part 3 PC checklist (passed)

1. Start `start-server.bat` and open **http://localhost:8000** in Chrome. If an older local tab
   is cached, use **App & offline → Check for updates → Update app** when offered. Keep your
   saved data; there is no need to clear it.
2. Open **Themes**, select **Storybook**, close it, refresh and open it again. Check that it
   remains selected. Only Storybook is available in this first round.
3. Open a real page. Inspect **More colors** and **Brushes** in a tall and a wide window.
   Try naming a palette, canceling a name and choosing a brush. The existing sample strokes
   and color controls should work as before.
4. Draw a short stroke, Undo/Redo it, leave the page and reopen it. Check that your coloring
   remains. Open **Start over**, then choose **Keep coloring** to cancel.
5. Try **Save → Download picture** and inspect the matching **App & offline** window.
6. Owen reported "everything worked", approving checkpoint/upload. No repeat PC check is needed.

### Part 3 iPad checklist (passed)

Owen reported "ipad test worked". Keep this checklist for reference; no repeat check is pending.

1. While online in the installed app, choose **App & offline → Check for updates → Update app**
   when offered. The update should show the **Themes** button on the library.
2. Open **Themes**, select **Storybook**, close and reopen it. Check that it stays selected.
3. On a real page, try **More colors**, naming a palette and **Brushes** with Pencil/finger.
   Rotate and check that everything fits or scrolls and the Done buttons remain reachable.
4. Try **Save to Photos** and **Download instead**, then make a stroke, Undo it, and leave/reopen
   the page to confirm the saved coloring remains. Report the result before the next theme.

Local checks passed for window layouts, color/palette controls, large saved palettes, keyboard
focus, drawing/Undo, PNG download, backup/restore, offline opening, safe updates and the existing
intro/sliders. They used separate test storage. Chrome checks with an Apple-platform stub
covered the share/download buttons. The later iPad report supplies acceptance of the requested
Safari/Pencil checklist; VoiceOver was not explicitly reported. The full development notes
are in CLAUDE.md and AGENTS.md.

## Saved idea for later: brush column

Owen would like the brushes displayed individually in a column, each with its own distinctive
icon or brush-type illustration, instead of the current brush chooser presentation. This is
saved for a future UI change, not built or scheduled yet. We'll review the exact layout when
that work starts; the brushes' drawing behavior stays the same.

## Requested design refinement: a more compact workspace

Owen would like a smaller, cleaner, more professional interface with Storybook character,
and a side menu for picking pages. The proposed direction is more room for the picture,
less bulky padding and decoration, and a **Pages** button opening categories, sub-categories
and small progress thumbnails beside the editor. The drawer would close out of the way and
overlay the picture on narrow screens. Controls should look lighter while staying comfortable
to tap with the Pencil or a finger.

This request is recorded for a layout mockup/review before replacing the accepted interface.
Both mockups are now approved. The real compact interface also passed its own PC test
("works great"). It comes before the
alternate themes; those still come one at a time. The separate brush-column idea remains saved.
Part 3's iPad check passed. This checkpoint includes the compact implementation and
acceptance/design notes; the compact app's iPad review has also passed.

### Try the compact layout mockup

Owen authorized the preview with "okay lets do it". Double-click **`start-design-preview.bat`**,
leave its window open, then open:

**http://localhost:8001/tools/design.tmp/compact-workspace.html**

This is a separate local preview; it has not replaced or updated the working app.
Use **8001** for mockups and **8000** for normal app testing. The app's offline helper can
substitute its home screen for other pages on port 8000, making a mockup appear unstyled.
The preview server prevents that conflict. No website data needs clearing.

- **Pages:** browse back through sub-categories and collections, search, and choose a page.
- **Tool strip:** pick tools, open all Brushes, then try the size/settings button and color dot.
- **Options (…):** choose **Focus on picture** to hide the controls; **Show tools** brings them back.
- Try a tall and a wide window. The bottom strip becomes a slim side rail when wide.

The colored Daffodil is an example. This preview does not paint, export or save coloring; those
actions stay in the working app. Settings in the preview last only for the visit. It does not
read or change your saved pages. Tell us what you think of the space, control sizes and layout
before we implement it. The prototype files are in the same Git-ignored `tools/design.tmp/`
folder as the older mockups, so they are local and not part of a fresh clone or the live app.

### Try the matching home/library preview

Owen approved the coloring design's visual direction ("looks amazing", "spectacular") and
agreed to a matching home page. Open:

**http://localhost:8001/tools/design.tmp/compact-library.html**

Use `start-design-preview.bat` if needed. The home preview has a shorter green header,
smaller collection covers, a compact continue banner, search and quieter gold/green details.
Click **Flowers → Tiger Lilies → a page** to open the coloring preview. In that preview,
**… → Back to library** returns here. **Continue** opens the example Daffodil.

Review the home design in a tall and a wide window. The example progress is not your actual
saved coloring. Both mockups were accepted; the real app implementation subsequently passed
its PC test (below), was uploaded as a944bea and passed its iPad test.

## Working compact app (PC and iPad accepted)

This is the real app with the approved compact design, not the mockups. Start
**`start-server.bat`**, then open **http://localhost:8000**. If you still see the old cached
layout, choose **App & offline → Check for updates → Update app** when offered. Keep website
data. The separate port **8001** still serves only design previews.

1. Check the smaller home page, search, collection navigation and real **Where you left off**
   card (it appears only when you have saved coloring).
2. Open a real page and color a little. Tap **Pages**, choose another page, then return to
   the first. Your latest coloring should remain, and thumbnails should show it. The app
   waits for the save before changing pages; it keeps the picture open if saving fails.
3. Tap the **size number** for brush size, opacity, preview and the three switches. Try
   **Brushes** and the **color dot → More** for the full picker and saved palettes.
4. Try Undo/Redo, **… → Focus on picture → Show tools**, **Fit**, **… → Back to library**,
   and **… → Start over → Keep coloring**. Try a tall and a wide window.
5. Check **Save → Download picture** and leave/reopen a colored page once more.

The original brush textures, pressure settings, line-lock, build-up, gestures and data format
remain. Draw with finger is available in the settings popup and remembers its choice; its
default stays on, matching the accepted app behavior. All original brushes, full palettes,
Photos export, backups and offline pages stay connected. Your actual progress is used here;
the colored demo Daffodil exists only in the separate mockup.

Local checks passed for layouts, real strokes/Undo, page switching/saves, progress, full color
picker, settings, export, backup restore, offline operation, safe updates and the opening.
A failed-save simulation kept the editable picture open. A separate 300-page simulation
loaded only nearby thumbnails and the full outline of the opened page. These used isolated
test storage. Owen confirmed the actual PC app "works great", approving checkpoint/upload.
After upload a944bea, he confirmed the iPad checklist "everythging worked perfect".

### Accepted iPad checklist (reference)

1. Open the installed app, then **App & offline → Check for updates → Update app**.
2. Check the compact library, search and Continue. Open a page, color a little, switch using
   **Pages**, then return. The latest coloring and progress thumbnail should remain.
3. Try the Pencil and finger, size/settings, color dot → More, Brushes and Undo/Redo.
4. Try **… → Back to library**, Focus/Show tools, Fit and Save to Photos in both orientations.

Keep website data and backups. This checklist has passed; no repeat is pending. Midnight
Forest was subsequently authorized and is now local for PC review (below). The other themes
still come one at a time. The illustrated brush-column idea remains deferred.


## Midnight Forest (PC and iPad accepted)

Midnight Forest adds deep evergreen surfaces, silver-green ivy and soft moonlight accents.
The library, Pages drawer, tool windows and opening all use its colors. Your coloring paper,
brush samples and downloaded picture stay white, and the actual painting colors stay the same.
Storybook is still available; the app remembers your choice on this device, including offline.

1. Start **start-server.bat** and open **http://localhost:8000** in Chrome.
2. If you still have the cached version, use **App & offline -> Check for updates -> Update app**.
3. Choose **Themes -> Midnight Forest -> Done**. Inspect the library and open a real page.
4. Try **Pages**, size/settings, **Brushes**, and **color dot -> More**. Open a palette naming
   box and check that text, controls and selected states are easy to read. Try tall and wide.
5. Draw a short stroke, Undo/Redo it, and try **Save -> Download picture**. Check that the
   picture and paint colors are unchanged. Leave/reopen the page to check the saved coloring.
6. Refresh: Midnight Forest should remain selected. Switch to Storybook and back; on a fresh
   reload the opening uses the chosen theme too.

Local checks passed for selection, text contrast, six layouts, real strokes/Undo/saving,
full-resolution export and offline reopening. Owen reported "everything works good" on PC,
approving checkpoint/upload. After upload 153d049, he reported "everything worked" on her
iPad too. Midnight Forest is accepted on both devices. Ocean Dreams is a separate later round.

### Accepted Midnight Forest iPad checklist (reference)

1. While online, choose **App & offline -> Check for updates -> Update app**.
2. Choose **Themes -> Midnight Forest -> Done**. Check library, Pages, settings, Brushes,
   the full picker and palette naming with Pencil/finger in both orientations.
3. Draw a little, try Undo/Redo, leave/reopen the page and try Save to Photos.
4. Close/reopen to check the look is remembered. Switch to Storybook and back.

Keep website data and backups. This checklist passed; no repeat is pending. Owen subsequently
authorized Ocean Dreams and asked to go directly to the iPad test (below).


## Ocean Dreams (iPad test next)

Ocean Dreams adds pale sea-glass surfaces, ocean blues, teal controls and pearl accents.
The opening has a cooler shimmer, and its theme card has a small wave detail. Coloring paper
stays white. Storybook and Midnight Forest remain available, and each theme keeps the same
compact controls, tools and saved coloring.

Owen requested direct upload for the iPad test, so this round skips a separate PC approval.
Local checks passed for six layouts, readable controls, all three theme choices, exact saved
coloring across switches, Undo/Redo, full-size PNG export and offline reopening.

1. In the installed iPad app, choose **App & offline -> Check for updates -> Update app**.
2. Choose **Themes -> Ocean Dreams -> Done**. Check the library, Pages, settings, Brushes
   and full color picker in both orientations.
3. Draw a little, try Undo/Redo, leave/reopen the page and Save to Photos.
4. Close/reopen the app: Ocean Dreams should remain selected and recolor the opening too.
   Switch to Storybook and Midnight Forest, then back to Ocean Dreams.

Keep website data and backups. The iPad result is pending. Autumn Cottage is the next planned
separate theme round after this one passes; it has not been built.
