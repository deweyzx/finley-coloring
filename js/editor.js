// editor.js - the coloring screen.
// Step 1: loads the page, sets up the two stacked layers, and fits the picture on screen.

import { loadImage, drawLineArt } from "./lineart.js";

const area = document.getElementById("canvas-area");
const paper = document.getElementById("paper");
const colorCanvas = document.getElementById("color-canvas");
const lineCanvas = document.getElementById("line-canvas");
const titleEl = document.getElementById("page-title");
const messageEl = document.getElementById("canvas-message");

let currentPage = null;

// The "view" says where the paper sits on screen:
// how much it is zoomed (scale) and how far it is moved from the top-left (x, y).
const view = { scale: 1, x: 0, y: 0 };

export async function openEditor(page) {
  currentPage = page;
  titleEl.textContent = page.title;
  paper.hidden = true;
  messageEl.textContent = "Loading…";

  let img;
  try {
    img = await loadImage(page.file);
  } catch (err) {
    messageEl.textContent = "Sorry, this page couldn't be opened.";
    console.error(err);
    return;
  }
  // If she tapped "back" while the image was loading, stop here.
  if (currentPage !== page) return;

  // The canvases get the image's real pixel size, so nothing is blurry.
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  for (const canvas of [colorCanvas, lineCanvas]) {
    canvas.width = w;
    canvas.height = h;
  }
  paper.style.width = w + "px";
  paper.style.height = h + "px";

  // Bottom layer: plain white paper (colors will go here).
  const colorCtx = colorCanvas.getContext("2d");
  colorCtx.fillStyle = "#ffffff";
  colorCtx.fillRect(0, 0, w, h);

  // Top layer: the black lines.
  drawLineArt(lineCanvas, img);

  messageEl.textContent = "";
  paper.hidden = false;
  fitToScreen();
}

export function closeEditor() {
  currentPage = null;
}

// Shrinks (or grows) the paper so the whole picture fits in the area, centered.
function fitToScreen() {
  const margin = 20;
  const areaW = area.clientWidth;
  const areaH = area.clientHeight;
  const w = lineCanvas.width;
  const h = lineCanvas.height;

  view.scale = Math.min((areaW - margin * 2) / w, (areaH - margin * 2) / h);
  view.x = (areaW - w * view.scale) / 2;
  view.y = (areaH - h * view.scale) / 2;
  applyView();
}

function applyView() {
  paper.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

// When the iPad rotates (or the browser window is resized), re-fit the picture.
window.addEventListener("resize", () => {
  if (currentPage && !paper.hidden) fitToScreen();
});
