// app.js - the starting point. It looks at the address after the "#" and shows
// the matching screen:
//   #/                  -> all categories
//   #/flowers           -> the sub-categories of Flowers
//   #/flowers/tulips    -> the pages in Tulips
//   #/page/tulips       -> coloring the page "tulips"

import { findCategory, findSubcategory, findPage } from "./library.js?v=20261021020853";
import { showLibrary, showCategory, showSubcategory } from "./gallery.js?v=20261021020853";
import { openEditor, closeEditor, prepareAppReload } from "./editor.js?v=20261021020853";
import { setupOffline, offlineBusy } from "./offline.js?v=20261021020853";

const galleryScreen = document.getElementById("gallery-screen");
const coloringScreen = document.getElementById("coloring-screen");
const coloringBack = document.getElementById("back-button");
let previousHash = location.hash || "#/";
setupOffline({prepareForReload:prepareAppReload, isLibrary:() => coloringScreen.hidden});

function route() {
  // A browser Back gesture during a restore/update must not open a page being replaced.
  if (offlineBusy()) { location.replace(previousHash); return; }
  previousHash = location.hash || "#/";
  const parts = location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  if (parts[0] === "page") {
    const page = findPage(parts[1]);
    if (!page) return redirect("#/");
    const sub = page.subcategory;
    coloringBack.href = `#/${sub.category.folder}/${sub.folder}`;
    galleryScreen.hidden = true;
    coloringScreen.hidden = false;
    openEditor(page);
    return;
  }

  closeEditor();
  coloringScreen.hidden = true;
  galleryScreen.hidden = false;

  if (parts.length === 0) return showLibrary();

  const cat = findCategory(parts[0]);
  if (!cat) return redirect("#/");
  if (parts.length === 1) return showCategory(cat);

  const sub = findSubcategory(cat, parts[1]);
  if (!sub) return redirect(`#/${cat.folder}`);
  showSubcategory(sub);
}

// Swap a bad address for a good one (without adding a step to the browser history).
function redirect(hash) {
  location.replace(hash);
}

window.addEventListener("hashchange", route);
route();
