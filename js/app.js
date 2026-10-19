// app.js - the starting point. It looks at the address after the "#" and shows
// the matching screen:
//   #/                  -> all categories
//   #/flowers           -> the sub-categories of Flowers
//   #/flowers/tulips    -> the pages in Tulips
//   #/page/tulips       -> coloring the page "tulips"

import { findCategory, findSubcategory, findPage } from "./library.js?v=202610191452";
import { showLibrary, showCategory, showSubcategory } from "./gallery.js?v=202610191452";
import { openEditor, closeEditor } from "./editor.js?v=202610191452";

const galleryScreen = document.getElementById("gallery-screen");
const coloringScreen = document.getElementById("coloring-screen");
const coloringBack = document.getElementById("back-button");

function route() {
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
