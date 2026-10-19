// color.js - color math for the color picker.
//
// A color can be written in different ways:
//   hex  "#f4a261"         - how the app stores and passes colors around
//   rgb  { r, g, b }       - red, green, blue, each 0-255 (what the screen uses)
//   hsv  { h, s, v }       - hue 0-360 (which color of the rainbow), saturation 0-1 (how
//                            vivid: 0 = grey, 1 = full color), value 0-1 (how bright:
//                            0 = black). This is what the picker's ring and square show.

// "#f4a261" -> { r: 244, g: 162, b: 97 }
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// { r, g, b } -> "#f4a261"
export function rgbToHex({ r, g, b }) {
  const part = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return "#" + part(r) + part(g) + part(b);
}

// Cleans up anything color-like into "#rrggbb" in lower case, or returns null if it isn't a color.
export function normalizeHex(text) {
  if (typeof text !== "string") return null;
  let t = text.trim().toLowerCase();
  if (t[0] !== "#") t = "#" + t;
  if (/^#[0-9a-f]{3}$/.test(t)) t = "#" + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
  return /^#[0-9a-f]{6}$/.test(t) ? t : null;
}

// { h, s, v } -> { r, g, b }
export function hsvToRgb({ h, s, v }) {
  const hh = ((h % 360) + 360) % 360 / 60;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6];
  return { r: r * 255, g: g * 255, b: b * 255 };
}

// { r, g, b } -> { h, s, v }. For greys (no color) the hue is 0; callers that care keep
// the hue they had before, so the ring handle doesn't jump around.
export function rgbToHsv({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex(hsv) {
  return rgbToHex(hsvToRgb(hsv));
}

export function hexToHsv(hex) {
  return rgbToHsv(hexToRgb(hex));
}
