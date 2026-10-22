// palette.js - the colors she paints with: the current color, her recently used colors, and
// palettes (named sets of colors) she can make and switch between.
//
// The picker window itself (hue ring and shade square) is in color-picker.js; this file holds
// the data and draws the swatches in the tool panel.
//
// Saved on this device in localStorage (small: a few hundred bytes), under:
//   "recent-colors"  - the last colors she actually painted with, newest first
//   "palettes"       - { active: "<palette id>", list: [{ id, name, colors: ["#rrggbb", ...] }] }
// The built-in "Classic" palette is always there and can't be changed.

import { hexToRgb, normalizeHex } from "./color.js?v=20261022003833";

export const DEFAULT_COLORS = [
  // reds and pinks
  "#c9184a", "#e63946", "#f28482", "#f7a1c4",
  // oranges and yellows
  "#e76f51", "#f4a261", "#ffb703", "#ffe066",
  // greens
  "#386641", "#6a994e", "#a7c957", "#57cc99",
  // blues
  "#1d3557", "#3a86ff", "#219ebc", "#8ecae6",
  // purples, peach
  "#7b2cbf", "#c77dff", "#e0aaff", "#fcd5b5",
  // browns, greys, white
  "#8d5524", "#d4a373", "#6c757d", "#ffffff",
];

export const CLASSIC = { id: "classic", name: "Classic", colors: DEFAULT_COLORS, builtin: true };
const COLOR_NAMES = new Map(DEFAULT_COLORS.map((hex, i) => [hex, [
  "Raspberry", "Red", "Coral pink", "Pink", "Terracotta", "Apricot", "Golden yellow", "Light yellow",
  "Deep green", "Leaf green", "Lime green", "Mint green", "Navy", "Royal blue", "Ocean blue", "Sky blue",
  "Purple", "Lilac", "Pale lavender", "Peach", "Brown", "Sand", "Grey", "White",
][i]]));

const MAX_RECENT = 10;       // remembered (and shown in the picker)
const SHOWN_RECENT = 8;      // shown in the tool panel (two rows when the iPad is sideways)
const MAX_PALETTES = 20;
const MAX_COLORS_PER_PALETTE = 48;
const MAX_NAME_LENGTH = 24;

let current = "#f4a261";
let userPalettes = []; // her palettes
let activeId = CLASSIC.id;
let recent = [];
let listeners = [];

load();

// ---------- The current color ----------

export function currentColor() {
  return current;
}

// Turns "#f4a261" into { r: 244, g: 162, b: 97 }.
export function toRGB(hex) {
  return hexToRgb(hex);
}

// Makes this the color she paints with. (`source` lets listeners ignore their own changes.)
export function selectColor(color, source) {
  const hex = normalizeHex(color);
  if (!hex) return;
  current = hex;
  notify(source);
}

// ---------- Recently used colors ----------

export function recentColors() {
  return recent.slice();
}

// Call when a color is actually painted with (a stroke starts or a fill is tapped).
export function noteColorUsed(color) {
  const hex = normalizeHex(color);
  if (!hex || recent[0] === hex) return;
  recent = [hex, ...recent.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  save("recent-colors", recent);
  notify("recent");
}

// ---------- Palettes ----------

export function allPalettes() {
  return [CLASSIC, ...userPalettes];
}

export function activePalette() {
  return allPalettes().find((p) => p.id === activeId) || CLASSIC;
}

export function setActivePalette(id) {
  if (!allPalettes().some((p) => p.id === id)) return;
  activeId = id;
  savePalettes();
  notify("palette");
}

// Makes a new palette (starting with `colors`) and switches to it. Returns it, or null if she
// already has the most palettes allowed.
export function createPalette(name, colors = []) {
  if (userPalettes.length >= MAX_PALETTES) return null;
  const palette = {
    id: "p" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    name: cleanName(name) || nextDefaultName(),
    colors: colors.map(normalizeHex).filter(Boolean).slice(0, MAX_COLORS_PER_PALETTE),
  };
  userPalettes.push(palette);
  activeId = palette.id;
  savePalettes();
  notify("palette");
  return palette;
}

export function renamePalette(id, name) {
  const palette = userPalettes.find((p) => p.id === id);
  const clean = cleanName(name);
  if (!palette || !clean) return;
  palette.name = clean;
  savePalettes();
  notify("palette");
}

export function deletePalette(id) {
  const before = userPalettes.length;
  userPalettes = userPalettes.filter((p) => p.id !== id);
  if (userPalettes.length === before) return;
  if (activeId === id) activeId = CLASSIC.id;
  savePalettes();
  notify("palette");
}

// Adds a color to one of her palettes. Returns "added", "exists" or "full".
export function addColorToPalette(id, color) {
  const palette = userPalettes.find((p) => p.id === id);
  const hex = normalizeHex(color);
  if (!palette || !hex) return "full";
  if (palette.colors.includes(hex)) return "exists";
  if (palette.colors.length >= MAX_COLORS_PER_PALETTE) return "full";
  palette.colors.push(hex);
  savePalettes();
  notify("palette");
  return "added";
}

export function removeColorFromPalette(id, color) {
  const palette = userPalettes.find((p) => p.id === id);
  if (!palette) return;
  palette.colors = palette.colors.filter((c) => c !== color);
  savePalettes();
  notify("palette");
}

export function suggestedPaletteName() {
  return nextDefaultName();
}

export const LIMITS = { MAX_NAME_LENGTH, MAX_PALETTES, MAX_COLORS_PER_PALETTE };

// ---------- Telling the screen about changes ----------

// fn(source) is called whenever the current color, the recent colors or the palettes change.
// `source` says what changed: "recent", "palette", or whatever was passed to selectColor.
export function onPaletteChange(fn) {
  listeners.push(fn);
}

function notify(source) {
  for (const fn of listeners) fn(source);
}

// ---------- The swatches in the tool panel ----------

let stripEl = null;
let recentEl = null;
let moreButton = null;

// Draws the swatches. `strip` = the grid of the active palette's colors, `recentRow` = the row
// of recently used colors, `more` = the button that opens the full picker.
export function setupSwatches({ strip, recentRow, more }) {
  stripEl = strip;
  recentEl = recentRow;
  moreButton = more;
  onPaletteChange((source) => {
    // Only redraw the swatches when the colors in them changed; a color change (such as
    // dragging in the picker, dozens of times a second) just moves the highlight.
    if (source === "palette") drawStrip();
    else if (source === "recent") drawRecent();
    else markSelected();
  });
  drawStrip();
  drawRecent();
}

export function makeSwatch(color) {
  const swatch = document.createElement("button");
  swatch.type = "button";
  swatch.className = "swatch";
  swatch.style.setProperty("--swatch", color);
  swatch.dataset.color = color;
  swatch.setAttribute("aria-label", (COLOR_NAMES.get(color.toLowerCase()) || "Custom color") + ", " + color);
  return swatch;
}

function drawStrip() {
  if (!stripEl) return;
  stripEl.replaceChildren(moreButton);
  for (const color of activePalette().colors) {
    const swatch = makeSwatch(color);
    swatch.addEventListener("click", () => selectColor(color, "swatch"));
    stripEl.append(swatch);
  }
  markSelected();
  if (moreButton) moreButton.style.setProperty("--current", current);
}

function drawRecent() {
  if (!recentEl) return;
  recentEl.replaceChildren();
  recentEl.hidden = recent.length === 0;
  for (const color of recent.slice(0, SHOWN_RECENT)) {
    const swatch = makeSwatch(color);
    swatch.addEventListener("click", () => selectColor(color, "swatch"));
    recentEl.append(swatch);
  }
  markSelected();
}

function markSelected() {
  for (const container of [stripEl, recentEl]) {
    if (!container) continue;
    for (const swatch of container.children) {
      if (!swatch.dataset.color) continue;
      swatch.classList.toggle("selected", swatch.dataset.color === current);
      swatch.setAttribute("aria-pressed", String(swatch.dataset.color === current));
    }
  }
  if (moreButton) moreButton.style.setProperty("--current", current);
}

// ---------- Saving and loading ----------

function cleanName(name) {
  return String(name || "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

function nextDefaultName() {
  const taken = new Set(userPalettes.map((p) => p.name.toLowerCase()));
  if (!taken.has("my colors")) return "My colors";
  for (let n = 2; ; n++) if (!taken.has(`my colors ${n}`)) return `My colors ${n}`;
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: it just won't be remembered after closing the app
  }
}

function savePalettes() {
  save("palettes", { active: activeId, list: userPalettes });
}

function load() {
  try {
    const colors = JSON.parse(localStorage.getItem("recent-colors"));
    if (Array.isArray(colors)) recent = colors.map(normalizeHex).filter(Boolean).slice(0, MAX_RECENT);
  } catch {
    recent = [];
  }
  try {
    const saved = JSON.parse(localStorage.getItem("palettes"));
    if (saved && Array.isArray(saved.list)) {
      userPalettes = saved.list
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.colors))
        .map((p) => ({ id: p.id, name: cleanName(p.name) || "Palette", colors: p.colors.map(normalizeHex).filter(Boolean) }));
      if (typeof saved.active === "string") activeId = saved.active;
      if (!allPalettes().some((p) => p.id === activeId)) activeId = CLASSIC.id;
    }
  } catch {
    userPalettes = [];
  }
  // Start with her most recent color if she has one (otherwise the first-time orange).
  if (recent.length) current = recent[0];
}
