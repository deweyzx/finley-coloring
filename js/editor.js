// editor.js - the coloring screen.
// Loads the page, sets up the stacked layers, fits the picture on screen, and turns
// taps and Pencil strokes into color.

import { loadImage, drawLineArt } from "./lineart.js?v=202610191524";
import { prepareFill, findFillArea, paintFill, warmUp } from "./fill.js?v=202610191524";
import { setupSwatches, onPaletteChange, currentColor, toRGB, noteColorUsed } from "./palette.js?v=202610191524";
import { setupColorPicker } from "./color-picker.js?v=202610191524";
import { setupSavePicture } from "./save-picture.js?v=202610191524";
import { BRUSHES, brushSettings, saveBrushSettings } from "./brushes.js?v=202610191524";
import { StrokeEngine } from "./stroke-engine.js?v=202610191524";
import { createSlider } from "./slider.js?v=202610191524";
import { History } from "./history.js?v=202610191524";
import { Viewport } from "./viewport.js?v=202610191524";
import { setupInput } from "./touch-input.js?v=202610191524";
import { toggleDebug } from "./touch-debug.js?v=202610191524";
import { saveArtwork, loadArtwork, forgetArtwork } from "./autosave.js?v=202610191524";
import { SETTINGS } from "./settings.js?v=202610191524";

const area = document.getElementById("canvas-area");
const paper = document.getElementById("paper");
const colorCanvas = document.getElementById("color-canvas");
const strokeCanvas = document.getElementById("stroke-canvas");
const lineCanvas = document.getElementById("line-canvas");
const titleEl = document.getElementById("page-title");
const messageEl = document.getElementById("canvas-message");
const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
const strokeCtx = strokeCanvas.getContext("2d");

const PAPER_RGB = { r: 255, g: 255, b: 255 }; // the eraser paints the paper back

let currentPage = null;
let fillReady = null; // a promise: done when the fill helper has studied the current page
let engine = null;    // draws brush strokes for the current page

// The "view" says where the paper sits on screen: how much it is zoomed (view.scale) and
// how far it is moved (view.x, view.y). Pinch, pan and mouse-wheel zoom change it.
const view = new Viewport(area, paper, () => schedulePreview());

// ---------- Tools ----------
// Fill reacts to taps; every brush in brushes.js draws strokes.

const tools = { fill: { tap: (point) => fillAt(point) } };
for (const id of Object.keys(BRUSHES)) tools[id] = { brush: BRUSHES[id] };
let currentTool = "fill";

const toolBar = document.getElementById("tools");
for (const [id, brush] of Object.entries(BRUSHES)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-button";
  button.dataset.tool = id;
  button.setAttribute("aria-label", brush.name);
  button.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">${brush.icon}</svg>`;
  toolBar.append(button);
}
for (const button of toolBar.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => selectTool(button.dataset.tool));
}

// ---------- On/off switches ----------
// "Stay inside lines" (line-lock): a brush stroke stays inside the outlined area where it
//   started. On by default.
// "Build up color": a new stroke over color deepens it (layering, shading). When off, going
//   over a spot already painted in the same color keeps it even. On by default.
// Her choices are remembered on this device.

function makeSwitch(id, storageKey, startOn) {
  const button = document.getElementById(id);
  const state = { on: startOn, button };
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) state.on = saved === "on";
  } catch {
    // storage unavailable: just use the default
  }
  const show = () => {
    button.setAttribute("aria-checked", String(state.on));
    button.classList.toggle("on", state.on);
    button.querySelector(".toggle-state").textContent = state.on ? "On" : "Off";
  };
  button.addEventListener("click", () => {
    state.on = !state.on;
    try {
      localStorage.setItem(storageKey, state.on ? "on" : "off");
    } catch {
      // not remembered, but still works for now
    }
    show();
  });
  show();
  return state;
}
const lineLock = makeSwitch("line-lock", "line-lock", true);
const buildUp = makeSwitch("build-up", "build-up", true);

// Hidden: tapping the page title 5 times quickly shows/hides the touch debug log.
let titleTaps = [];
titleEl.addEventListener("click", (e) => {
  titleTaps = titleTaps.filter((t) => e.timeStamp - t < 2000);
  titleTaps.push(e.timeStamp);
  if (titleTaps.length >= 5) {
    titleTaps = [];
    toggleDebug();
  }
});

// ---------- Undo and redo ----------

const undoButton = document.getElementById("undo-button");
const redoButton = document.getElementById("redo-button");
let history = null; // one history per open page

function updateHistoryButtons() {
  undoButton.disabled = !history || !history.canUndo();
  redoButton.disabled = !history || !history.canRedo();
}
// Each returns true if it did something.
function undo(fromGesture) {
  if (!history || stroke || !history.canUndo()) return false; // not in the middle of a stroke
  history.undo();
  markChanged();
  if (fromGesture) showToast("Undo");
  return true;
}
function redo(fromGesture) {
  if (!history || stroke || !history.canRedo()) return false;
  history.redo();
  markChanged();
  if (fromGesture) showToast("Redo");
  return true;
}
undoButton.addEventListener("click", () => undo());
redoButton.addEventListener("click", () => redo());

// A small label that flashes in the middle of the page, so she knows a gesture worked.
const toast = document.getElementById("toast");
function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("show");
  void toast.offsetWidth; // restart the fade animation
  toast.classList.add("show");
}
// Keyboard shortcuts for testing on the PC: Ctrl+Z, and Ctrl+Y or Ctrl+Shift+Z.
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || paper.hidden) return;
  const key = e.key.toLowerCase();
  if (key === "z" && !e.shiftKey) undo();
  else if (key === "y" || (key === "z" && e.shiftKey)) redo();
  else return;
  e.preventDefault();
});

// ---------- Size and opacity sliders, and the preview ----------

const controls = document.getElementById("brush-controls");
const preview = document.getElementById("brush-preview");
const sizeSlider = createSlider(document.getElementById("size-slider"), {
  label: "Size",
  min: 1,
  max: 40,
  curve: 2, // finer control for small sizes
  format: (v) => String(Math.round(v)),
  onChange: (v) => changeBrushSetting("size", Math.round(v * 10) / 10),
});
const opacitySlider = createSlider(document.getElementById("opacity-slider"), {
  label: "Opacity",
  min: 0.05,
  max: 1,
  format: (v) => `${Math.round(v * 100)}%`,
  onChange: (v) => changeBrushSetting("opacity", Math.round(v * 100) / 100),
});

function changeBrushSetting(key, value) {
  const brush = BRUSHES[currentTool];
  if (!brush) return;
  const settings = brushSettings(currentTool);
  settings[key] = value;
  saveBrushSettings(currentTool, settings); // each brush remembers its own
  drawPreview();
}

function selectTool(name) {
  if (!tools[name]) return;
  currentTool = name;
  for (const button of toolBar.querySelectorAll("[data-tool]")) {
    button.classList.toggle("selected", button.dataset.tool === name);
  }
  const brush = BRUSHES[name];
  controls.classList.toggle("disabled", !brush); // fill has no size or opacity
  lineLock.button.classList.toggle("faded", !brush); // these switches are for brushes
  buildUp.button.classList.toggle("faded", !brush);
  if (brush) {
    const s = brushSettings(name);
    sizeSlider.set(s.size, { min: brush.sizeRange[0], max: brush.sizeRange[1] });
    opacitySlider.set(s.opacity);
  }
  drawPreview();
}

// The color swatches, recent colors, and the full color picker (ring + square + palettes).
const moreColorsButton = document.getElementById("more-colors");
setupSwatches({
  strip: document.getElementById("palette"),
  recentRow: document.getElementById("recent-colors"),
  more: moreColorsButton,
});
setupColorPicker(moreColorsButton);
onPaletteChange((source) => {
  if (source === "palette" || source === "recent") return; // only the swatches changed
  // Picking a color while the eraser is selected switches back to the last brush.
  if (BRUSHES[currentTool]?.paint === "paper") selectTool(lastColorTool);
  drawPreview();
});
let lastColorTool = "pencil";
selectTool(currentTool);

// The preview shows the current brush at the size it will appear on screen, with its
// opacity, texture and color, drawn from light pressure (left) to full pressure (right).
function drawPreview() {
  const box = preview.getBoundingClientRect();
  if (!box.width) return;
  const ratio = window.devicePixelRatio || 1;
  const w = Math.round(box.width * ratio);
  const h = Math.round(box.height * ratio);
  preview.width = w;
  preview.height = h;
  const ctx = preview.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const brush = BRUSHES[currentTool];
  if (!brush) {
    // Fill: just a swatch of the color.
    ctx.fillStyle = currentColor();
    roundRect(ctx, w * 0.12, h * 0.22, w * 0.76, h * 0.56, h * 0.16);
    ctx.fill();
    return;
  }
  if (brush.paint === "color") lastColorTool = currentTool;

  const settings = brushSettings(currentTool);
  // Size as it looks on screen right now (capped so it fits in the preview).
  const onScreen = settings.size * (view.scale || 1) * ratio;
  const size = Math.min(Math.max(onScreen, 1.5), h * 0.62);
  const sample = new StrokeEngine(w, h);
  const paperBand = brush.paint === "paper";
  if (paperBand) {
    // The eraser is shown rubbing out a band of the current color.
    ctx.fillStyle = currentColor();
    ctx.fillRect(0, h * 0.2, w, h * 0.6);
  }
  sample.begin(brush, { size, opacity: settings.opacity }, paperBand ? PAPER_RGB : toRGB(currentColor()));
  const steps = 40;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    sample.addPoint({
      x: w * (0.1 + 0.8 * t),
      y: h * (0.5 + 0.18 * Math.sin(t * Math.PI * 2)),
      pressure: 0.25 + 0.75 * t,
      altitude: Math.PI / 2,
      azimuth: 0,
    });
  }
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  sample.render(layer.getContext("2d"));
  ctx.drawImage(layer, 0, 0);
}

// While she's zooming, update the preview a moment after the page stops moving
// (redrawing it on every frame of a pinch would waste time).
let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(drawPreview, 120);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Opening a page ----------

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
  for (const canvas of [colorCanvas, strokeCanvas, lineCanvas]) {
    canvas.width = w;
    canvas.height = h;
  }
  paper.style.width = w + "px";
  paper.style.height = h + "px";
  engine = new StrokeEngine(w, h);
  history = new History(colorCtx, engine.memory, w, updateHistoryButtons);
  updateHistoryButtons();

  // Bottom layer: plain white paper (colors go here)...
  colorCtx.fillStyle = "#ffffff";
  colorCtx.fillRect(0, 0, w, h);
  // ...with her saved coloring on it, if she has colored this page before. (First wait for
  // any save still in progress, e.g. of this same page she just left.)
  await lastSave.catch(() => {});
  try {
    await loadArtwork(page.id, colorCtx, engine.memory);
  } catch (err) {
    // Her saved coloring is there but couldn't be read right now. Don't show a blank page she
    // might color on - its auto-save would then replace her real work.
    console.error("Couldn't load the saved coloring", err);
    if (currentPage === page) {
      messageEl.textContent = "Your saved coloring for this page couldn't be opened. Close any other tabs with the coloring book, then open this page again.";
    }
    return;
  }
  if (currentPage !== page) return;

  // Top layer: the black lines. Tap-to-fill studies them in the background.
  const darkness = drawLineArt(lineCanvas, img);
  fillReady = prepareFill(darkness, w, h);
  fillReady.then((r) => {
    console.log(`Page ready for tap-to-fill in ${r.ms} ms`);
    // Get the background ready in advance: points just inside the edges of the page.
    const points = [];
    for (const fx of [0.02, 0.5, 0.98]) {
      for (const fy of [0.02, 0.5, 0.98]) {
        if (fx !== 0.5 || fy !== 0.5) points.push([Math.round(w * fx), Math.round(h * fy)]);
      }
    }
    warmUp(points).then((t) => console.log(`Background areas prepared in ${t.ms} ms`));
  });

  messageEl.textContent = "";
  paper.hidden = false;
  view.setPage(w, h);
}

export function closeEditor() {
  if (stroke && !stroke.waiting) finishStroke();
  stroke = null;
  saveNow(); // leaving the page: save right away
  currentPage = null;
}

// ---------- Auto-save ----------
// After each change (stroke, fill, undo, redo) the page is saved a moment later, once she
// pauses. It's also saved right away when she leaves the page or switches away from the app.

let unsaved = false;
let saveTimer = null;
let lastSave = Promise.resolve();

function markChanged() {
  unsaved = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SETTINGS.autosaveDelayMs);
}

function saveNow() {
  clearTimeout(saveTimer);
  if (!unsaved || !currentPage || !engine) return;
  if (stroke) {
    saveTimer = setTimeout(saveNow, 500); // never in the middle of a stroke: try again soon
    return;
  }
  unsaved = false;
  const id = currentPage.id;
  const started = performance.now();
  lastSave = saveArtwork(id, colorCanvas, lineCanvas, engine.memory)
    .then((info) => console.log(`Saved "${id}" in ${Math.round(performance.now() - started)} ms (colors ${Math.round(info.colorBytes / 1024)} KB, build-up memory ${Math.round(info.memoryBytes / 1024)} KB, preview ${Math.round(info.previewBytes / 1024)} KB)`))
    .catch((err) => {
      if (currentPage && currentPage.id === id) unsaved = true; // try again with the next change
      console.error("Auto-save failed", err);
    });
}

// ---------- Start over ----------
// Erases all her coloring on this page after she confirms. It can still be undone until she
// leaves the page; if she leaves, the page is blank again (and blank in the library).

// Save: the finished picture to Photos (or a download on a PC).
setupSavePicture({ isReady: () => !paper.hidden && !stroke });

const startOverButton = document.getElementById("start-over");
const startOverDialog = document.getElementById("start-over-dialog");
const keepButton = document.getElementById("start-over-cancel");
const eraseButton = document.getElementById("start-over-confirm");

startOverButton.addEventListener("click", () => {
  if (paper.hidden || stroke) return;
  startOverDialog.hidden = false;
  keepButton.focus(); // the safe choice is the default
});
keepButton.addEventListener("click", () => {
  startOverDialog.hidden = true;
});
startOverDialog.addEventListener("click", (e) => {
  if (e.target === startOverDialog) startOverDialog.hidden = true; // tapped outside the box
});
eraseButton.addEventListener("click", () => {
  startOverDialog.hidden = true;
  startOver();
});

function startOver() {
  if (!currentPage || !engine || stroke) return;
  const w = colorCanvas.width;
  const h = colorCanvas.height;
  history.saveBefore({ x: 0, y: 0, w, h }); // so Undo can bring it all back
  colorCtx.fillStyle = "#ffffff";
  colorCtx.fillRect(0, 0, w, h);
  engine.memory.fill(0);
  // Forget the saved version too (a pending auto-save is no longer needed).
  clearTimeout(saveTimer);
  unsaved = false;
  const id = currentPage.id;
  lastSave = lastSave
    .catch(() => {})
    .then(() => forgetArtwork(id))
    .catch((err) => console.error("Couldn't clear the saved coloring", err));
}

// Switching to another app, locking the iPad or closing Safari: save right away.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
});
window.addEventListener("pagehide", saveNow);

// ---------- Fill ----------

async function fillAt(point) {
  const page = currentPage;
  if (!fillReady) return;
  await fillReady;
  const color = toRGB(currentColor());
  noteColorUsed(currentColor()); // remembered in "recent colors"
  // A tap that lands on a line fills the nearest open spot within about a fingertip.
  const reach = Math.min(SETTINGS.tapReach / view.scale, 60);
  const result = await findFillArea(point.x, point.y, reach);
  if (currentPage !== page || result.empty) return;
  history.saveBefore({ x: result.x, y: result.y, w: result.w, h: result.h });
  paintFill(colorCtx, result, color);
  engine.rememberFill(result, color);
  markChanged();
  console.log(`Filled ${result.count} pixels in ${result.ms} ms (gap closing used: ${result.gapUsed})`);
}

// ---------- Brush strokes ----------

let stroke = null; // the stroke being drawn (one at a time)
let frameRequested = false;

function startStroke(e) {
  const brush = BRUSHES[currentTool];
  const rgb = brush.paint === "paper" ? PAPER_RGB : toRGB(currentColor());
  if (brush.paint === "color") noteColorUsed(currentColor()); // remembered in "recent colors"
  const first = readPoint(e);
  const s = { pointerId: e.pointerId, page: currentPage, waiting: false, pending: [], lifted: false };
  stroke = s;
  engine.begin(brush, brushSettings(currentTool), rgb, buildUp.on);
  if (!lineLock.on) {
    engine.addPoint(first);
    showStroke();
    return;
  }
  // Line-lock: find the outlined area where the stroke starts (exactly what a fill from
  // here would cover). Until it arrives - usually a few thousandths of a second - Pencil
  // samples wait in `pending`, then they're all drawn inside the area.
  s.waiting = true;
  s.pending.push(first);
  findLockArea(first).then((area) => {
    if (stroke !== s || s.page !== currentPage) return; // page closed meanwhile
    engine.setClip(area && !area.empty ? area : NOWHERE);
    s.waiting = false;
    for (const p of s.pending) engine.addPoint(p);
    s.pending = [];
    showStroke();
    if (s.lifted) finishStroke();
  });
}

// A stencil that allows nothing (a stroke that started outside every area).
const NOWHERE = { x: 0, y: 0, w: 0, h: 0, mask: new Uint8Array(0) };

async function findLockArea(point) {
  if (!fillReady) return null;
  await fillReady;
  const reach = Math.min(SETTINGS.tapReach / view.scale, 60); // started on a line? nearest area
  return findFillArea(point.x, point.y, reach);
}

function continueStroke(e) {
  // The iPad records the Pencil up to 240 times a second but only sends some of those
  // as events; getCoalescedEvents() gives us all of them for smoother strokes.
  const samples = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for (const sample of samples.length ? samples : [e]) {
    const p = readPoint(sample);
    if (stroke.waiting) stroke.pending.push(p);
    else engine.addPoint(p);
  }
  showStroke();
}

function endStroke() {
  if (stroke.waiting) {
    stroke.lifted = true; // finish as soon as the locked area arrives
    return;
  }
  finishStroke();
}

function finishStroke() {
  const changed = engine.commit(strokeCtx, colorCtx, (box) => history.saveBefore(box));
  stroke = null;
  if (changed) markChanged();
}

// Takes the stroke back with no mark at all (a finger that turned into a gesture).
function cancelStroke() {
  if (!stroke) return;
  stroke = null;
  engine.cancel(strokeCtx);
}

// Redraws the stroke once per screen refresh (not once per Pencil sample).
function showStroke() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(() => {
    frameRequested = false;
    if (stroke) engine.render(strokeCtx);
  });
}

// Reads position, pressure and tilt from a pointer event.
function readPoint(e) {
  const p = view.toPage(e.clientX, e.clientY);
  const pen = e.pointerType === "pen";
  // Mouse and finger have no pressure: they draw at the slider's full size and opacity.
  p.pressure = pen ? e.pressure : 1;
  let altitude = Math.PI / 2; // upright
  let azimuth = 0;
  if (pen) {
    if (typeof e.altitudeAngle === "number") {
      altitude = e.altitudeAngle;
      azimuth = e.azimuthAngle || 0;
    } else if (e.tiltX || e.tiltY) {
      const tx = Math.tan((e.tiltX * Math.PI) / 180);
      const ty = Math.tan((e.tiltY * Math.PI) / 180);
      altitude = Math.atan(1 / Math.hypot(tx, ty));
      azimuth = Math.atan2(ty, tx);
    }
  }
  p.altitude = altitude;
  p.azimuth = azimuth;
  return p;
}

// ---------- Pointer input ----------
// touch-input.js decides what each touch, Pencil or mouse movement means (draw, fill tap,
// zoom/pan, undo/redo gestures, or a palm to ignore) and calls these.

setupInput(area, view, {
  ready: () => !paper.hidden && !!engine,
  isBrush: () => !!tools[currentTool].brush,
  strokeStart: (e) => {
    if (!stroke) startStroke(e);
  },
  strokeMove: (e) => {
    if (stroke && !stroke.lifted) continueStroke(e);
  },
  strokeEnd: () => {
    if (stroke && !stroke.lifted) endStroke();
  },
  strokeCancel: () => cancelStroke(),
  tap: (e) => tools[currentTool].tap && tools[currentTool].tap(view.toPage(e.clientX, e.clientY)),
  undo: () => undo(true),
  redo: () => redo(true),
});

// When the iPad rotates (or the browser window is resized), show the whole page again.
window.addEventListener("resize", () => {
  if (currentPage && !paper.hidden) view.fit();
  else drawPreview();
});
