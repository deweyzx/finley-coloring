// color-picker.js - the full color picker window: a hue ring with a shade square inside it,
// her recently used colors, and her named palettes.
//
// How the ring and square work:
//   - The RING picks the hue (which color of the rainbow). Red is at the top, going clockwise.
//   - The SQUARE picks the shade of that hue: across = how vivid (left = grey, right = full
//     color), up and down = how bright (top = brightest, bottom = black).
// Dragging anywhere on the ring or square (with the Pencil or a finger) changes the color live.
//
// The data (current color, recent colors, palettes) lives in palette.js.

import { hsvToRgb, hsvToHex, hexToHsv } from "./color.js?v=202610201533";
import {
  currentColor, selectColor, onPaletteChange, allPalettes, activePalette, setActivePalette,
  createPalette, renamePalette, deletePalette, addColorToPalette, removeColorFromPalette,
  recentColors, makeSwatch, suggestedPaletteName, LIMITS,
} from "./palette.js?v=202610201533";
import { askText, askConfirm } from "./dialogs.js?v=202610201533";

// Sizes as fractions of the wheel's width.
const RING_INNER = 0.36;
const RING_OUTER = 0.5;
const SQUARE_HALF = 0.235; // the square runs from 0.5 - this to 0.5 + this

const dialog = document.getElementById("picker-dialog");
const wheel = document.getElementById("wheel");
const ringCanvas = document.getElementById("wheel-ring");
const squareCanvas = document.getElementById("wheel-square");
const ringHandle = document.getElementById("ring-handle");
const squareHandle = document.getElementById("square-handle");
const beforeSwatch = document.getElementById("compare-before");
const nowSwatch = document.getElementById("compare-now");
const hexReadout = document.getElementById("hex-readout");
const noteEl = document.getElementById("picker-note");
const recentBox = document.getElementById("picker-recent");
const chipsBox = document.getElementById("palette-chips");
const swatchBox = document.getElementById("palette-swatches");
const paletteHint = document.getElementById("palette-hint");
const addButton = document.getElementById("add-color");
const editButton = document.getElementById("edit-colors");
const renameButton = document.getElementById("rename-palette");
const deleteButton = document.getElementById("delete-palette");

let hsv = { h: 20, s: 0.6, v: 0.96 }; // the color being picked
let colorWhenOpened = "#ffffff";
let editing = false;      // "remove colors" mode in the palette
let ringSize = 0;         // pixels the ring was drawn at
let squareHue = -1;       // the hue the square was drawn for

export function setupColorPicker(openButton) {
  openButton.addEventListener("click", open);
  document.getElementById("picker-done").addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close(); // tapped outside the window
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dialog.hidden) close();
  });
  beforeSwatch.addEventListener("click", () => pick(colorWhenOpened)); // go back to the old color

  onPaletteChange((source) => {
    if (dialog.hidden) return;
    if (source === "palette") renderPalettes();
    else if (source === "recent") renderRecent();
    else if (source !== "picker") {
      pick(currentColor(), true); // she tapped a swatch somewhere: follow it
    }
  });

  // Dragging on the wheel (ring or square), with the Pencil, a finger or the mouse.
  let mode = null;
  let pointerId = null;
  wheel.addEventListener("pointerdown", (e) => {
    const p = wheelPoint(e);
    const d = Math.hypot(p.x - 0.5, p.y - 0.5);
    if (d >= RING_INNER - 0.02 && d <= RING_OUTER + 0.04) mode = "ring";
    else if (Math.abs(p.x - 0.5) <= SQUARE_HALF + 0.03 && Math.abs(p.y - 0.5) <= SQUARE_HALF + 0.03) mode = "square";
    else return;
    pointerId = e.pointerId;
    try {
      wheel.setPointerCapture(e.pointerId);
    } catch {
      // fine without it
    }
    drag(e, mode);
  });
  wheel.addEventListener("pointermove", (e) => {
    if (mode && e.pointerId === pointerId) drag(e, mode);
  });
  for (const type of ["pointerup", "pointercancel"]) {
    wheel.addEventListener(type, (e) => {
      if (e.pointerId === pointerId) mode = null;
    });
  }

  addButton.addEventListener("click", addCurrentColor);
  editButton.addEventListener("click", () => {
    editing = !editing;
    renderPalettes();
  });
  renameButton.addEventListener("click", async () => {
    const p = activePalette();
    const name = await askText({ title: "Rename palette", value: p.name, maxLength: LIMITS.MAX_NAME_LENGTH });
    if (name) renamePalette(p.id, name);
  });
  deleteButton.addEventListener("click", async () => {
    const p = activePalette();
    const yes = await askConfirm({
      title: `Delete “${p.name}”?`,
      text: "The palette is removed. Pictures you already colored stay the same.",
      confirmLabel: "Delete palette",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (yes) {
      editing = false;
      deletePalette(p.id);
      say(`Deleted “${p.name}”.`);
    }
  });

  window.addEventListener("resize", () => {
    if (!dialog.hidden) drawRing();
  });
}

function open() {
  colorWhenOpened = currentColor();
  editing = false;
  noteEl.textContent = "";
  dialog.hidden = false;
  pick(currentColor(), true);
  drawRing();
  renderRecent();
  renderPalettes();
}

function close() {
  dialog.hidden = true;
}

// ---------- Setting the color ----------

// Sets the picker to a color. keepHueForGreys: for greys the hue is meaningless, so keep the
// hue she had (so the ring handle doesn't jump to red).
function pick(hex, followOnly = false) {
  const next = hexToHsv(hex);
  if (next.s < 0.001 || next.v < 0.001) next.h = hsv.h;
  hsv = next;
  if (!followOnly || currentColor() !== hex) selectColor(hex, "picker");
  show();
}

function drag(e, mode) {
  const p = wheelPoint(e);
  if (mode === "ring") {
    hsv.h = (Math.atan2(p.x - 0.5, 0.5 - p.y) * 180 / Math.PI + 360) % 360;
  } else {
    hsv.s = clamp((p.x - (0.5 - SQUARE_HALF)) / (2 * SQUARE_HALF));
    hsv.v = 1 - clamp((p.y - (0.5 - SQUARE_HALF)) / (2 * SQUARE_HALF));
  }
  selectColor(hsvToHex(hsv), "picker");
  show();
}

function wheelPoint(e) {
  const box = wheel.getBoundingClientRect();
  return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
}

// ---------- Drawing the wheel ----------

function drawRing() {
  const css = wheel.getBoundingClientRect().width;
  if (!css) return;
  const size = Math.min(900, Math.round(css * (window.devicePixelRatio || 1)));
  if (size !== ringSize) {
    ringSize = size;
    ringCanvas.width = ringCanvas.height = size;
    const ctx = ringCanvas.getContext("2d");
    const image = ctx.createImageData(size, size);
    const px = image.data;
    // The rainbow colors, one per quarter degree, worked out once.
    const rainbow = Array.from({ length: 1440 }, (_, i) => hsvToRgb({ h: i / 4, s: 1, v: 1 }));
    const edge = 1.2 / size; // soft edge, about a pixel
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5;
        const dy = (y + 0.5) / size - 0.5;
        const d = Math.hypot(dx, dy);
        if (d < RING_INNER - edge || d > RING_OUTER + edge) continue;
        let a = 1;
        if (d < RING_INNER) a = 1 - (RING_INNER - d) / edge;
        else if (d > RING_OUTER) a = 1 - (d - RING_OUTER) / edge;
        const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        const c = rainbow[Math.floor(deg * 4) % 1440];
        const i = (y * size + x) * 4;
        px[i] = c.r;
        px[i + 1] = c.g;
        px[i + 2] = c.b;
        px[i + 3] = a * 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  squareHue = -1;
  show();
}

function drawSquare() {
  if (squareHue === hsv.h) return;
  squareHue = hsv.h;
  const css = wheel.getBoundingClientRect().width * SQUARE_HALF * 2;
  const size = Math.max(32, Math.min(600, Math.round(css * (window.devicePixelRatio || 1))));
  if (squareCanvas.width !== size) squareCanvas.width = squareCanvas.height = size;
  const ctx = squareCanvas.getContext("2d");
  ctx.fillStyle = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  ctx.fillRect(0, 0, size, size);
  const white = ctx.createLinearGradient(0, 0, size, 0); // left: grey/white, right: full color
  white.addColorStop(0, "rgba(255,255,255,1)");
  white.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, size, size);
  const black = ctx.createLinearGradient(0, 0, 0, size); // top: bright, bottom: black
  black.addColorStop(0, "rgba(0,0,0,0)");
  black.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, size, size);
}

// Moves the handles and updates the color samples.
function show() {
  drawSquare();
  const mid = (RING_INNER + RING_OUTER) / 2;
  const rad = hsv.h * Math.PI / 180;
  place(ringHandle, 0.5 + mid * Math.sin(rad), 0.5 - mid * Math.cos(rad));
  place(squareHandle, 0.5 - SQUARE_HALF + hsv.s * 2 * SQUARE_HALF, 0.5 - SQUARE_HALF + (1 - hsv.v) * 2 * SQUARE_HALF);
  const hex = hsvToHex(hsv);
  ringHandle.style.background = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  squareHandle.style.background = hex;
  beforeSwatch.style.background = colorWhenOpened;
  nowSwatch.style.background = hex;
  hexReadout.textContent = hex.toUpperCase();
  markSelected();
}

function place(el, x, y) {
  el.style.left = x * 100 + "%";
  el.style.top = y * 100 + "%";
}

// ---------- Recent colors ----------

function renderRecent() {
  const colors = recentColors();
  recentBox.hidden = colors.length === 0;
  const row = recentBox.querySelector(".picker-swatches");
  row.replaceChildren();
  for (const color of colors) {
    const swatch = makeSwatch(color);
    swatch.addEventListener("click", () => pick(color));
    row.append(swatch);
  }
  markSelected();
}

// ---------- Palettes ----------

function renderPalettes() {
  const active = activePalette();
  if (active.builtin) editing = false;

  chipsBox.replaceChildren();
  for (const p of allPalettes()) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (p.id === active.id ? " selected" : "");
    chip.textContent = p.name;
    chip.addEventListener("click", () => {
      editing = false;
      setActivePalette(p.id);
    });
    chipsBox.append(chip);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "chip chip-new";
  add.textContent = "+ New palette";
  add.addEventListener("click", newPalette);
  chipsBox.append(add);

  swatchBox.replaceChildren();
  swatchBox.classList.toggle("editing", editing);
  for (const color of active.colors) {
    const swatch = makeSwatch(color);
    swatch.addEventListener("click", () => {
      if (editing) removeColorFromPalette(active.id, color);
      else pick(color);
    });
    swatchBox.append(swatch);
  }
  markSelected();

  editButton.hidden = active.builtin;
  renameButton.hidden = active.builtin;
  deleteButton.hidden = active.builtin;
  editButton.textContent = editing ? "Finished" : "Remove colors";
  editButton.classList.toggle("on", editing);
  addButton.hidden = editing;
  if (active.builtin) paletteHint.textContent = "Classic is the starting set. Pick a color, then tap “Add this color” to start your own palette.";
  else if (editing) paletteHint.textContent = "Tap a color to remove it from this palette.";
  else if (active.colors.length === 0) paletteHint.textContent = "This palette is empty. Pick a color and tap “Add this color”.";
  else paletteHint.textContent = "";
  paletteHint.hidden = !paletteHint.textContent;
}

function markSelected() {
  const now = currentColor();
  for (const box of [recentBox, swatchBox]) {
    for (const s of box.querySelectorAll(".swatch")) s.classList.toggle("selected", s.dataset.color === now);
  }
}

async function newPalette() {
  if (allPalettes().length - 1 >= LIMITS.MAX_PALETTES) {
    say(`That's the most palettes (${LIMITS.MAX_PALETTES}). Delete one to make room.`);
    return;
  }
  const name = await askText({
    title: "Name your new palette",
    text: "It starts with the color you're picking now.",
    value: suggestedPaletteName(),
    maxLength: LIMITS.MAX_NAME_LENGTH,
    confirmLabel: "Make palette",
  });
  if (!name) return;
  editing = false;
  const p = createPalette(name, [currentColor()]);
  if (p) say(`Made “${p.name}”.`);
}

async function addCurrentColor() {
  const p = activePalette();
  if (p.builtin) {
    await newPalette(); // the Classic palette can't change: start a palette of her own
    return;
  }
  const result = addColorToPalette(p.id, currentColor());
  if (result === "added") say(`Added to “${p.name}”.`);
  else if (result === "exists") say("That color is already in this palette.");
  else say(`This palette is full (${LIMITS.MAX_COLORS_PER_PALETTE} colors).`);
}

function say(text) {
  noteEl.textContent = text;
}

function clamp(v) {
  return Math.min(1, Math.max(0, v));
}
