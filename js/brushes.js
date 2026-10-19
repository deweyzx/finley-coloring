// brushes.js - the brushes, each described as a short list of settings.
//
// The stroke engine (stroke-engine.js) reads these descriptions, so ADDING A BRUSH means
// adding one more entry to BRUSHES below. What each setting means:
//
//   name, icon      - shown on the tool button (icon = the inside of a 24x24 <svg>)
//   sizeRange       - smallest and biggest size on the size slider, in page pixels
//   defaults        - starting size and opacity (0-1) the first time she uses it
//   hardness        - 1 = crisp edge, lower = softer edge (how far in the fade starts)
//   spacing         - distance between "dabs" along the stroke, as a share of the size
//   pressure        - how lighter pressure changes the stroke. Each [min, 1] pair says what
//                     share of the slider's value you get at the lightest touch (min) and at
//                     full pressure (1). curve > 1 makes light pressure stay lighter longer;
//                     curve < 1 makes a light touch show up sooner.
//   tilt            - what happens when the Pencil is tilted over, like shading with the side
//                     of a pencil lead: widen (how much wider), opacity (share kept),
//                     grainFill (share of grain filled in)
//   grain           - paper texture, or null for none: strength (0-1) and how much of the
//                     grain light/full pressure fills in [light, full]. The grain is fixed to
//                     the page, like the tooth of real paper.
//   paint           - "color" uses the chosen color; "paper" paints the paper back (eraser)

export const BRUSHES = {
  pencil: {
    name: "Pencil",
    icon: `<path d="M4 20 L5.2 15.2 L15.5 4.9 L19.1 8.5 L8.8 18.8 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.6 6.8 L17.2 10.4" stroke="currentColor" stroke-width="1.7"/><path d="M4 20 L5.2 15.2 L8.8 18.8 Z" fill="currentColor"/>`,
    sizeRange: [1, 40],
    defaults: { size: 8, opacity: 0.9 },
    hardness: 0.75,
    spacing: 0.12,
    // curve below 1 = a light touch already shows (faint), building smoothly to full.
    pressure: { size: [0.6, 1], opacity: [0.5, 1], curve: 0.5 },
    tilt: { widen: 2.6, opacity: 0.78, grainFill: 0.72 },
    grain: { strength: 1, fill: [0.45, 0.85] },
    paint: "color",
  },

  marker: {
    name: "Marker",
    icon: `<path d="M7.5 16.5 L14.8 4.2 L19.8 7.2 L12.5 19.5 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.5 16.5 L6 21 L10 19.2" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
    sizeRange: [4, 120],
    defaults: { size: 30, opacity: 0.7 },
    hardness: 0.82,
    spacing: 0.08,
    pressure: { size: [0.7, 1], opacity: [0.75, 1], curve: 1 },
    tilt: { widen: 0.35, opacity: 1, grainFill: 1 },
    grain: null,
    paint: "color",
  },

  eraser: {
    name: "Eraser",
    icon: `<path d="M9 19 L3.8 13.8 L12.8 4.8 L20.2 12.2 L13.4 19 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.3 9.3 L15.7 16.7" stroke="currentColor" stroke-width="1.7"/><path d="M9 19 H 20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
    sizeRange: [4, 200],
    defaults: { size: 40, opacity: 1 },
    hardness: 0.85,
    spacing: 0.08,
    pressure: { size: [0.6, 1], opacity: [1, 1], curve: 1 },
    tilt: { widen: 0, opacity: 1, grainFill: 1 },
    grain: null,
    paint: "paper",
  },
};

// ---------- Remembering each brush's size and opacity ----------
// Kept on this device (localStorage), so her choices are still there next time.

const SAVE_KEY = "brush-settings";
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
} catch {
  saved = {};
}

export function brushSettings(id) {
  const brush = BRUSHES[id];
  const s = saved[id] || {};
  return {
    size: clamp(Number(s.size) || brush.defaults.size, brush.sizeRange[0], brush.sizeRange[1]),
    opacity: clamp(Number(s.opacity) || brush.defaults.opacity, 0.05, 1),
  };
}

export function saveBrushSettings(id, settings) {
  saved[id] = { size: settings.size, opacity: settings.opacity };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Private browsing etc.: settings just won't be remembered after closing the app.
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// ---------- Paper grain ----------
// An original "paper tooth" texture made with code: soft bumps of a few sizes plus fine
// speckle and faint diagonal fibres. It's 256 x 256 and repeats seamlessly across the page.
// Values: 0 = valley (pigment rarely reaches), 255 = peak (catches pigment first).

export const GRAIN_SIZE = 256;
export const GRAIN = makeGrain(GRAIN_SIZE, 7);

function makeGrain(size, seed) {
  let state = seed;
  const random = () => {
    // small, repeatable random number generator (the same grain every time)
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const sum = new Float32Array(size * size);
  // Mostly small bumps (fine, even tooth) with only a hint of bigger ones.
  const layers = [
    { cell: 32, weight: 0.04 },
    { cell: 16, weight: 0.06 },
    { cell: 8, weight: 0.14 },
    { cell: 4, weight: 0.3 },
    { cell: 2, weight: 0.36 },
  ];
  for (const { cell, weight } of layers) {
    const n = size / cell;
    const lattice = Array.from({ length: n * n }, random);
    const at = (gx, gy) => lattice[((gy + n) % n) * n + ((gx + n) % n)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = x / cell;
        const fy = y / cell;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        sum[y * size + x] += weight * (top * (1 - ty) + bottom * ty);
      }
    }
  }
  // faint diagonal fibres, like the texture of drawing paper
  for (let k = 0; k < 140; k++) {
    let x = random() * size;
    let y = random() * size;
    const len = 6 + random() * 18;
    const strength = 0.06 + random() * 0.08;
    for (let s = 0; s < len; s++) {
      const i = (Math.floor(y) & (size - 1)) * size + (Math.floor(x) & (size - 1));
      sum[i] += strength;
      x += 0.9;
      y += 0.45;
    }
  }
  // a sprinkle of single-pixel speckle, for the fine sparkle of real paper
  for (let i = 0; i < sum.length; i++) sum[i] += random() * 0.16;
  // stretch to the full 0-255 range, with a bit more contrast
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of sum) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = new Uint8Array(size * size);
  for (let i = 0; i < sum.length; i++) {
    const t = (sum[i] - lo) / (hi - lo);
    out[i] = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 1.3 + 0.5)));
  }
  return out;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}
