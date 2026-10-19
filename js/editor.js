// editor.js - the coloring screen.
// Loads the page, sets up the two stacked layers, fits the picture on screen,
// and turns taps into fills.

import { loadImage, drawLineArt } from "./lineart.js";
import { prepareFill, findFillArea, paintFill } from "./fill.js";
import { renderPalette, currentColor, toRGB } from "./palette.js";
import { SETTINGS } from "./settings.js";

const area = document.getElementById("canvas-area");
const paper = document.getElementById("paper");
const colorCanvas = document.getElementById("color-canvas");
const lineCanvas = document.getElementById("line-canvas");
const titleEl = document.getElementById("page-title");
const messageEl = document.getElementById("canvas-message");
const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });

let currentPage = null;
let fillReady = null; // a promise: done when the fill helper has studied the current page

// The "view" says where the paper sits on screen:
// how much it is zoomed (scale) and how far it is moved from the top-left (x, y).
const view = { scale: 1, x: 0, y: 0 };

// The tools. Step 4 adds the brushes and eraser here; each tool decides what a
// tap or a stroke does.
const tools = {
  fill: {
    tap: (point) => fillAt(point),
  },
};
let currentTool = "fill";

renderPalette(document.getElementById("palette"));
for (const button of document.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => selectTool(button.dataset.tool));
}
selectTool(currentTool);

function selectTool(name) {
  if (!tools[name]) return;
  currentTool = name;
  for (const button of document.querySelectorAll("[data-tool]")) {
    button.classList.toggle("selected", button.dataset.tool === name);
  }
}

export async function openEditor(page) {
  currentPage = page;
  fillReady = null;
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

  // Bottom layer: plain white paper (colors go here).
  colorCtx.fillStyle = "#ffffff";
  colorCtx.fillRect(0, 0, w, h);

  // Top layer: the black lines. Tap-to-fill studies them in the background.
  const darkness = drawLineArt(lineCanvas, img);
  fillReady = prepareFill(darkness, w, h);
  fillReady.then((r) => console.log(`Page ready for tap-to-fill in ${r.ms} ms`));

  messageEl.textContent = "";
  paper.hidden = false;
  fitToScreen();
}

export function closeEditor() {
  currentPage = null;
}

// ---------- Fill ----------

async function fillAt(point) {
  const page = currentPage;
  if (!fillReady) return;
  await fillReady;
  const color = toRGB(currentColor());
  // A tap that lands on a line fills the nearest open spot within about a fingertip.
  const reach = Math.min(SETTINGS.tapReach / view.scale, 60);
  const result = await findFillArea(point.x, point.y, reach);
  if (currentPage !== page || result.empty) return;
  paintFill(colorCtx, result, color);
  console.log(`Filled ${result.count} pixels in ${result.ms} ms (gap closing used: ${result.gapUsed})`);
}

// ---------- Taps ----------
// A tap = the pointer goes down and comes back up quickly without moving much.
// (Step 6 adds two-finger zoom and pan, and ignoring her palm while drawing.)

let press = null;

area.addEventListener("pointerdown", (e) => {
  if (e.button > 0 || paper.hidden) return; // left mouse button, finger or Pencil only
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp };
});

area.addEventListener("pointerup", (e) => {
  if (!press || e.pointerId !== press.id) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
  const quick = e.timeStamp - press.time < 800;
  press = null;
  if (moved < 12 && quick && tools[currentTool].tap) {
    tools[currentTool].tap(toPagePoint(e.clientX, e.clientY));
  }
});

area.addEventListener("pointercancel", () => {
  press = null;
});

// Converts a point on the screen to a point on the page (in page pixels).
function toPagePoint(clientX, clientY) {
  const box = area.getBoundingClientRect();
  return {
    x: (clientX - box.left - view.x) / view.scale,
    y: (clientY - box.top - view.y) / view.scale,
  };
}

// ---------- Fitting the page on screen ----------

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
