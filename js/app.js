// app.js - the starting point. It looks at the address after the "#" and shows
// the matching screen:
//   #/                  -> all categories
//   #/flowers           -> the sub-categories of Flowers
//   #/flowers/tulips    -> the pages in Tulips
//   #/page/tulips       -> coloring the page "tulips"

import { findCategory, findSubcategory, findPage } from "./library.js?v=20261021233948";
import { showLibrary, showCategory, showSubcategory } from "./gallery.js?v=20261021233948";
import { openEditor, closeEditor, prepareAppReload, preparePageChange, showToast } from "./editor.js?v=20261021233948";
import { setupOffline, offlineBusy } from "./offline.js?v=20261021233948";

const galleryScreen = document.getElementById("gallery-screen");
const coloringScreen = document.getElementById("coloring-screen");
const coloringBack = document.getElementById("back-button");
let previousHash = location.hash || "#/";
let editorPage = null;
let navigation = Promise.resolve();
setupOffline({prepareForReload:prepareAppReload, isLibrary:() => coloringScreen.hidden});

function route() {
  const target = location.hash || '#/';
  // A quick page/back/page sequence must never let two image decodes paint the same canvas
  // at once. Finish the current navigation, then honor the latest address.
  navigation = navigation.then(() => showRoute(target)).catch(error => {
    console.error('Could not change pages',error);
    showToast('Your coloring could not finish saving. Keep this page open and try again.');
    location.replace(previousHash);
  });
}
async function showRoute(target) {
  if (target !== (location.hash || '#/')) return;
  // A browser Back gesture during a restore/update must not open a page being replaced.
  if (offlineBusy()) { location.replace(previousHash); return; }
  const parts = target
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  const nextPage = parts[0] === 'page' ? findPage(parts[1]) : null;
  if(editorPage && nextPage?.id !== editorPage.id){
    if(!await preparePageChange()){
      location.replace(previousHash);
      showToast('Finish the current stroke or let your coloring save before changing pages.');
      return;
    }
    if(target !== (location.hash || '#/'))return;
    closeEditor();editorPage=null;
  }
  previousHash = target;

  if (parts[0] === "page") {
    const page = findPage(parts[1]);
    if (!page) return redirect("#/");
    coloringBack.href = '#/';
    galleryScreen.hidden = true;
    coloringScreen.hidden = false;
    if(editorPage?.id !== page.id){editorPage=page;await openEditor(page);}
    return;
  }

  if(editorPage){closeEditor();editorPage=null;}
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
