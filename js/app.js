// app.js - the starting point. It switches between the gallery screen and the coloring screen.

import { PAGES } from "../pages/pages.js";
import { renderGallery } from "./gallery.js";
import { openEditor, closeEditor } from "./editor.js";

const galleryScreen = document.getElementById("gallery-screen");
const coloringScreen = document.getElementById("coloring-screen");
const backButton = document.getElementById("back-button");

function showGallery() {
  coloringScreen.hidden = true;
  galleryScreen.hidden = false;
  renderGallery(PAGES, openPage);
}

function openPage(page) {
  galleryScreen.hidden = true;
  coloringScreen.hidden = false;
  openEditor(page);
}

backButton.addEventListener("click", () => {
  closeEditor();
  showGallery();
});

showGallery();
