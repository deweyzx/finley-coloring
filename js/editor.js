// editor.js - the coloring screen.
// Loads the page, sets up the stacked layers, fits the picture on screen, and turns
// taps and Pencil strokes into color.

import { loadImage, drawLineArt } from "./lineart.js";
import { prepareFill, findFillArea, paintFill } from "./fill.js";
import { renderPalette, currentColor, toRGB } from "./palette.js";
import { BRUSHES, brushSettings, saveBrushSettings } from "./brushes.js";
import { StrokeEngine } from "./stroke-engine.js";
import { createSlider } from "./slider.js";
import { SETTINGS } from "./settings.js";

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

// The "view" says where the paper sits on screen:
// how much it is zoomed (scale) and how far it is moved from the top-left (x, y).
const view = { scale: 1, x: 0, y: 0 };

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

// ---------- Line-lock ----------
// When on, a brush stroke stays inside the outlined area where it started.
// On by default; her choice is remembered on this device.

let lineLock = true;
try {
  lineLock = localStorage.getItem("line-lock") !== "off";
} catch {
  // storage unavailable: just use the default
}
const lockButton = document.getElementById("line-lock");
lockButton.addEventListener("click", () => {
  lineLock = !lineLock;
  try {
    localStorage.setItem("line-lock", lineLock ? "on" : "off");
  } catch {
    // not remembered, but still works for now
  }
  showLineLock();
});
function showLineLock() {
  lockButton.setAttribute("aria-checked", String(lineLock));
  lockButton.classList.toggle("on", lineLock);
  lockButton.querySelector(".lock-state").textContent = lineLock ? "On" : "Off";
}
showLineLock();

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
  lockButton.classList.toggle("faded", !brush);  // line-lock is for brushes
  if (brush) {
    const s = brushSettings(name);
    sizeSlider.set(s.size, { min: brush.sizeRange[0], max: brush.sizeRange[1] });
    opacitySlider.set(s.opacity);
  }
  drawPreview();
}

renderPalette(document.getElementById("palette"), () => {
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
  if (stroke && !stroke.waiting) finishStroke();
  stroke = null;
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

// ---------- Brush strokes ----------

let stroke = null; // the stroke being drawn (one at a time)
let frameRequested = false;

function startStroke(e) {
  const brush = BRUSHES[currentTool];
  const rgb = brush.paint === "paper" ? PAPER_RGB : toRGB(currentColor());
  const first = readPoint(e);
  const s = { pointerId: e.pointerId, page: currentPage, waiting: false, pending: [], lifted: false };
  stroke = s;
  engine.begin(brush, brushSettings(currentTool), rgb);
  if (!lineLock) {
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
  engine.commit(strokeCtx, colorCtx);
  stroke = null;
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
  const p = toPagePoint(e.clientX, e.clientY);
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
// A brush draws while the pointer is down. Fill reacts to a tap: the pointer goes down
// and comes back up quickly without moving much.
// (Step 6 adds two-finger zoom and pan, and ignoring her palm while drawing.)

let press = null;

area.addEventListener("pointerdown", (e) => {
  if (e.button > 0 || paper.hidden || stroke || press) return; // one pointer at a time
  if (tools[currentTool].brush) {
    // Keep receiving this pointer even if it slides off the drawing area.
    try {
      area.setPointerCapture(e.pointerId);
    } catch {
      // not available for this pointer; the stroke still works
    }
    startStroke(e);
  } else {
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp };
  }
});

area.addEventListener("pointermove", (e) => {
  if (stroke && !stroke.lifted && e.pointerId === stroke.pointerId) continueStroke(e);
});

area.addEventListener("pointerup", (e) => {
  if (stroke && e.pointerId === stroke.pointerId) {
    if (!stroke.lifted) endStroke();
    return;
  }
  if (!press || e.pointerId !== press.id) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
  const quick = e.timeStamp - press.time < 800;
  press = null;
  if (moved < 12 && quick && tools[currentTool].tap) {
    tools[currentTool].tap(toPagePoint(e.clientX, e.clientY));
  }
});

area.addEventListener("pointercancel", (e) => {
  if (stroke && !stroke.lifted && e.pointerId === stroke.pointerId) endStroke(); // keep what was drawn
  if (press && e.pointerId === press.id) press = null;
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
  drawPreview(); // the preview shows the brush at its on-screen size
}

// When the iPad rotates (or the browser window is resized), re-fit the picture.
window.addEventListener("resize", () => {
  if (currentPage && !paper.hidden) fitToScreen();
  else drawPreview();
});
