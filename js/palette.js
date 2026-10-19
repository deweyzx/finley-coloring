// palette.js - the color swatches. (Step 8 adds the full color picker, recent colors
// and saved palettes; this simple set of swatches stays as the starting palette.)

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

let current = "#f4a261";
let container = null;
let onChange = () => {};

export function currentColor() {
  return current;
}

// Turns "#f4a261" into { r: 244, g: 162, b: 97 }.
export function toRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function renderPalette(element, changed) {
  container = element;
  onChange = changed || onChange;
  container.replaceChildren();
  for (const color of DEFAULT_COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch";
    swatch.style.setProperty("--swatch", color);
    swatch.dataset.color = color;
    swatch.setAttribute("aria-label", "Color " + color);
    swatch.addEventListener("click", () => selectColor(color));
    container.append(swatch);
  }
  markSelected();
}

export function selectColor(color) {
  current = color;
  markSelected();
  onChange(color);
}

function markSelected() {
  if (!container) return;
  for (const swatch of container.children) {
    swatch.classList.toggle("selected", swatch.dataset.color === current);
  }
}
