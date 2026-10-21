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
//   inBar           - true = has its own button in the tool bar; the others are in the
//                     "Brushes" window (every brush is in that window)
//
// Optional extras (leave them out for a plain brush; stroke-engine.js explains each):
//   soft            - true = a rounded "bell" fade from the middle to the edge (airbrush)
//   flow            - spray that adds up: { amount: how much each dab adds (0-1),
//                     hold: how fast it keeps spraying while the Pencil is held still }
//   noise           - 0-1, a fine random speckle in every dab
//   taper           - { start: size at the very start (share of full), length: how far (in
//                     brush sizes) until it reaches full size }
//   bristles        - { strength: how visible the hair streaks are (0-1), width: one hair's
//                     width as a share of the brush size }
//   wash            - watercolor: { wobble: how much the edge wanders (cloud-like), uneven:
//                     patches where pigment pools and thins, granulate: pigment settling into the
//                     paper's tooth,
//                     rimWidth: width of the darker rim (share of size), rimGain: how quickly
//                     the rim darkens, middle: strength in the middle, rim: extra at the rim }
//   scatter         - splatter: { count: droplets per dab [light, full pressure], reach: how
//                     far they fly [light, full] in brush radii, spread: >1 keeps more near the
//                     middle, drop: droplet size [smallest, biggest] as a share of brush size,
//                     hardness: droplet edge }. Bigger droplets are irregular: a stretched blob
//                     with little satellite drops around it, and now and then a short tail.
//   blend           - "multiply" = see-through glaze: colors mix like layered watercolor
//   effect          - the paint's own look, worked into each pixel's color (so it's part of the
//                     picture and shows in a saved picture too):
//                     { kind: "glitter", base: how bright the base between the flakes is (a share
//                       of the color's deep shade), sparkle: how bright the glints are (0-1) }
//                     { kind: "metallic", shine: how wide the rounded highlight is (share of
//                       size), bump: how strongly the stroke looks rounded, gloss: how small and
//                       sharp the shiny highlight is, highlight: how bright it is (0-1),
//                       sheen: polished light/dark bands (0-1), flake: fine metal grain (0-1),
//                       mica: tiny bright specks (0-1), join: true = the same color already on the
//                       page joins in as one surface, maxShine: the rounding reaches at most this
//                       many pixels whatever the brush size (12 if left out) }

// modify: existing-paint tools, handled by blend-engine.js (no palette color added).
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
    inBar: true,
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
    inBar: true,
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
    inBar: true,
  },

  // ----- Step 10, batch 1: paint brushes -----

  // Soft spray that builds up the longer she sprays (or holds still). Pressure = how much
  // paint comes out; the opacity slider is the most it can build up to.
  airbrush: {
    name: "Airbrush",
    icon: `<rect x="3.5" y="10" width="8" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 10 V7.2 H9.5 V10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="14.5" cy="6.5" r="1.1" fill="currentColor"/><circle cx="17.8" cy="4.6" r="0.9" fill="currentColor"/><circle cx="18" cy="8.6" r="1.1" fill="currentColor"/><circle cx="21" cy="6.6" r="0.8" fill="currentColor"/><circle cx="20.6" cy="11" r="0.9" fill="currentColor"/>`,
    sizeRange: [10, 300],
    defaults: { size: 80, opacity: 0.6 },
    hardness: 0,
    soft: true,
    spacing: 0.2,
    pressure: { size: [0.85, 1], opacity: [0.12, 1], curve: 1.2 },
    flow: { amount: 0.49, hold: 0.135 },
    noise: 0.55,
    tilt: { widen: 1.6, opacity: 0.8, grainFill: 1 },
    grain: null,
    paint: "color",
  },

  // A soft-bristle paintbrush: smooth strokes with faint hair streaks, starting from a fine
  // point. Lifting the Pencil gently makes the end taper too.
  smoothHair: {
    name: "Smooth hair",
    icon: `<path d="M20.5 3.5 L13.2 10.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14.2 9 L15 9.8 L11.5 13.3 L10.7 12.5 Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M10.7 12.5 C7.2 12.6 5.4 15 4.5 20 C9.5 19 11.4 17 11.5 13.3 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
    sizeRange: [2, 200],
    defaults: { size: 24, opacity: 0.85 },
    hardness: 0.55,
    spacing: 0.12, // (was 0.06; with the quick loop it looks the same and is about 4x lighter)
    pressure: { size: [0.12, 1], opacity: [0.65, 1], curve: 0.8 },
    taper: { start: 0.35, length: 0.9 },
    bristles: { strength: 0.28, width: 0.05 },
    tilt: { widen: 0.9, opacity: 0.9, grainFill: 1 },
    grain: null,
    paint: "color",
  },

  // See-through color with uneven pigment and darker rims where the water pools. Strokes glaze
  // over each other (yellow over blue makes green), like real watercolor.
  watercolor: {
    name: "Watercolor",
    icon: `<path d="M12 3.2 C9 7.8 6.3 11 6.3 14.6 a5.7 5.7 0 0 0 11.4 0 C17.7 11 15 7.8 12 3.2 Z" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.2 14.8 a2.9 2.9 0 0 0 2.6 2.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    sizeRange: [6, 130], // (was 160: too heavy at her drawing speed on her iPad)
    defaults: { size: 50, opacity: 0.45 },
    hardness: 0.65,
    spacing: 0.3, // (was 0.07, then 0.2: far fewer dabs, to keep up on her iPad; the cloud-like edge hides the difference)
    pressure: { size: [0.55, 1], opacity: [0.45, 1], curve: 0.9 },
    wash: { wobble: 0.6, uneven: 0.5, granulate: 0.08, rimWidth: 0.1, rimGain: 2.2, middle: 0.85, rim: 0.8 },
    blend: "multiply",
    tilt: { widen: 1.2, opacity: 0.8, grainFill: 1 },
    grain: null,
    paint: "color",
  },

  // Droplets of paint flicked from a brush: lots of tiny ones, a few big ones. Press harder
  // for more droplets, thrown farther. The size slider sets how wide the splatter spreads.
  splatter: {
    name: "Splatter",
    icon: `<circle cx="10.5" cy="12.5" r="4" fill="currentColor"/><circle cx="18" cy="7" r="1.6" fill="currentColor"/><circle cx="5" cy="5.5" r="1.2" fill="currentColor"/><circle cx="18.6" cy="16.8" r="1.3" fill="currentColor"/><circle cx="5.6" cy="19.2" r="1.8" fill="currentColor"/><circle cx="12.5" cy="4" r="0.9" fill="currentColor"/><circle cx="20.5" cy="12" r="0.8" fill="currentColor"/>`,
    sizeRange: [10, 240],
    defaults: { size: 70, opacity: 0.9 },
    hardness: 0.8,
    spacing: 0.3,
    pressure: { size: [1, 1], opacity: [0.85, 1], curve: 1 },
    scatter: { count: [1.2, 6], reach: [0.35, 1.25], spread: 0.8, drop: [0.008, 0.2], hardness: 0.94 },
    tilt: { widen: 0, opacity: 1, grainFill: 1 },
    grain: null,
    paint: "color",
  },

  // ----- Step 10, batch 2: effect brushes -----

  // Glitter: the color in tiny flakes, some lighter and some darker, with bright sparkle flecks
  // and a few little star-shaped glints. Every stroke gets its own scatter of sparkles, so going
  // over glitter again adds new ones.
  glitter: {
    name: "Glitter",
    icon: `<path d="M12 3 L13.6 9.4 L20 11 L13.6 12.6 L12 19 L10.4 12.6 L4 11 L10.4 9.4 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M18.5 15.5 L19.2 17.8 L21.5 18.5 L19.2 19.2 L18.5 21.5 L17.8 19.2 L15.5 18.5 L17.8 17.8 Z" fill="currentColor"/><circle cx="5.5" cy="18.5" r="1.2" fill="currentColor"/><circle cx="19" cy="5" r="1" fill="currentColor"/>`,
    sizeRange: [4, 120], // (was 150: too heavy at her drawing speed on her iPad)
    defaults: { size: 30, opacity: 0.9 },
    hardness: 0.95,
    spacing: 0.16, // (was 0.1: fewer dabs, looks the same)
    pressure: { size: [0.6, 1], opacity: [0.55, 1], curve: 0.8 },
    tilt: { widen: 1, opacity: 0.85, grainFill: 1 },
    grain: null,
    effect: { kind: "glitter", base: 0.8, sparkle: 1 },
    paint: "color",
  },

  // Metallic ink: shiny like a metallic gel pen. Light comes from the top left, so each stroke
  // gets a bright highlight on top and a darker edge below, and wide areas get soft polished
  // bands and a fine metal grain.
  metallic: {
    name: "Metallic",
    icon: `<path d="M5 19 C8 12 11 16 14 9 C15.5 5.5 18 4.5 20 5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M6.4 16.3 C8.6 12.6 10.6 14.6 12.8 9.6" fill="none" style="stroke: var(--surface)" stroke-width="1" stroke-linecap="round" opacity="0.9"/><path d="M19 13 L19.6 14.9 L21.5 15.5 L19.6 16.1 L19 18 L18.4 16.1 L16.5 15.5 L18.4 14.9 Z" fill="currentColor"/>`,
    sizeRange: [3, 60], // (was 120: too heavy at her drawing speed on her iPad)
    defaults: { size: 20, opacity: 1 },
    hardness: 0.8,
    spacing: 0.16, // (was 0.08: half the dabs, looks the same)
    pressure: { size: [0.45, 1], opacity: [0.8, 1], curve: 0.8 },
    tilt: { widen: 0.8, opacity: 0.95, grainFill: 1 },
    grain: null,
    effect: { kind: "metallic", shine: 0.3, bump: 0.8, gloss: 40, highlight: 0.9, sheen: 1, flake: 0.05, mica: 0.6, join: true },
    paint: "color",
  },
  blender: {
    name: "Blender",
    // A paper blending stump, in the same diagonal, outlined style as Pencil/Marker.
    icon: `<path d="M4 20 L6 13.5 L15.6 3.9 Q16.5 3 17.4 3.9 L20.1 6.6 Q21 7.5 20.1 8.4 L10.5 18 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M6 13.5 L10.5 18 M14.1 5.4 L18.6 9.9 M4 20 L7.1 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    sizeRange: [6, 48], defaults: { size: 30, opacity: 0.65 },
    hardness: 0.65, spacing: 0.2,
    // A light touch already does useful blending; pressure adds control, not a hurdle.
    // The opacity slider still sets the maximum. No pressure threshold or hard press needed.
    pressure: { size: [0.9, 1], opacity: [0.6, 1], curve: 0.4 },
    tilt: { widen: 0.35, opacity: 1, grainFill: 1 },
    grain: null, paint: "modify", modify: "blender",
  },
  blur: {
    name: "Blur",
    // A soft blending brush, matching Smooth hair's handle and fine outline.
    icon: `<path d="M20.5 3.5 L14 10 M18.4 3.2 L12.4 9.2 L15.2 12 L21.2 6 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.4 9.2 C8.1 9.5 4.8 13 4.2 18.8 C9.7 18.2 13.5 15.5 15.2 12 M8.1 15.7 L6.3 18.2 M10.8 14.4 L9.5 17.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    sizeRange: [6, 48], defaults: { size: 30, opacity: 0.65 },
    hardness: 0.65, spacing: 0.3,
    pressure: { size: [0.9, 1], opacity: [0.6, 1], curve: 0.4 },
    tilt: { widen: 0.2, opacity: 1, grainFill: 1 },
    grain: null, paint: "modify", modify: "blur",
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

// ---------- Glitter texture ----------
// Real-looking glitter: separate flat flakes (little 4- to 6-sided pieces, 3 to 16 pixels across,
// mostly small), lying at different angles so each catches the light differently: most are the
// paint's color, some darker, some much brighter, and a few blaze almost white with a sharp
// star-shaped glint. Between the flakes a darker base shows. 512 x 512 and repeating; each stroke
// uses it shifted to a random spot.
//   GLITTER.shade[i]: 0 = the base between flakes, otherwise the flake's brightness x 100
//                     (100 = the paint's color, 50 = half as bright, 200 = nearly white)
//   GLITTER.pick[i]:  0-255, a random number per flake: with light pressure (or at the soft edge
//                     of a stroke) only the flakes with low numbers appear, so the glitter is sparser
//   GLITTER.spark[i]: 0-255, the sharp glints

export const GLITTER_SIZE = 512;
export const GLITTER = makeGlitter(GLITTER_SIZE, 23);

function makeGlitter(size, seed) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const shade = new Uint8Array(size * size);
  const pick = new Uint8Array(size * size);
  const spark = new Uint8Array(size * size);
  const wrap = (v) => ((v % size) + size) % size;
  const flakes = 9000;
  for (let n = 0; n < flakes; n++) {
    const cx = random() * size;
    const cy = random() * size;
    const r = 1.5 + 6.5 * Math.pow(random(), 2.2); // mostly small, a few big
    // how it catches the light
    const roll = random();
    let bright;
    if (roll < 0.2) bright = 0.5 + 0.3 * random(); // turned away: darker
    else if (roll < 0.75) bright = 0.85 + 0.3 * random(); // the paint's color
    else if (roll < 0.93) bright = 1.25 + 0.35 * random(); // catching the light
    else bright = 1.75 + 0.25 * random(); // blazing
    // a flat piece tilted a little: one side slightly brighter than the other
    const ga = random() * Math.PI * 2;
    const gx = Math.cos(ga) * 0.15 / r;
    const gy = Math.sin(ga) * 0.15 / r;
    const flakePick = 1 + Math.floor(random() * 254);
    // its outline: 4 to 6 corners at slightly random angles and distances
    const corners = 4 + Math.floor(random() * 3);
    const turn = random() * Math.PI * 2;
    const px = [];
    const py = [];
    for (let k = 0; k < corners; k++) {
      const ang = turn + (k + (random() - 0.5) * 0.5) * (Math.PI * 2 / corners);
      const rr = r * (0.75 + 0.4 * random());
      px.push(Math.cos(ang) * rr);
      py.push(Math.sin(ang) * rr);
    }
    const reach = Math.ceil(r * 1.2);
    for (let oy = -reach; oy <= reach; oy++) {
      for (let ox = -reach; ox <= reach; ox++) {
        const x = ox + 0.5 - (cx % 1);
        const y = oy + 0.5 - (cy % 1);
        // inside the (convex) outline if on the inner side of every edge
        let inside = true;
        for (let k = 0; k < corners && inside; k++) {
          const k2 = (k + 1) % corners;
          if ((px[k2] - px[k]) * (y - py[k]) - (py[k2] - py[k]) * (x - px[k]) < 0) inside = false;
        }
        if (!inside) continue;
        const i = wrap(Math.floor(cy) + oy) * size + wrap(Math.floor(cx) + ox);
        const v = bright + x * gx + y * gy;
        shade[i] = Math.max(1, Math.min(255, Math.round(v * 100)));
        pick[i] = flakePick;
      }
    }
    // blazing flakes (the bigger ones) get a sharp four-pointed glint
    if (bright > 1.75 && r > 2.5) {
      const arm = Math.round(r * (1.2 + random()));
      const put = (x, y, v) => {
        const i = wrap(Math.round(y)) * size + wrap(Math.round(x));
        if (v > spark[i]) spark[i] = v;
      };
      put(cx, cy, 255);
      for (let s = 1; s <= arm; s++) {
        const v = Math.round(255 * Math.pow(1 - s / (arm + 1), 1.6));
        put(cx + s, cy, v);
        put(cx - s, cy, v);
        put(cx, cy + s, v);
        put(cx, cy - s, v);
        if (s <= arm / 2) {
          const d = Math.round(v * 0.5);
          put(cx + s, cy + s, d);
          put(cx - s, cy - s, d);
          put(cx + s, cy - s, d);
          put(cx - s, cy + s, d);
        }
      }
    }
  }
  return { shade, pick, spark };
}

// ---------- Cloud texture (watercolor edges) ----------
// Soft blotches with some finer detail on top, like the edge of a cloud: used to make watercolor's
// wet edge wander in feathery, irregular shapes. 256 x 256, repeating.

export const CLOUD_SIZE = 256;
export const CLOUD = makeNoise(CLOUD_SIZE, 31, [
  { cell: 64, weight: 0.3 },
  { cell: 32, weight: 0.25 },
  { cell: 16, weight: 0.2 },
  { cell: 8, weight: 0.15 },
]);

// ---------- Watercolor texture ----------
// Big, soft blotches (no fine detail): where pigment settles more or less, and how the wet edge
// wanders. Also 256 x 256 and repeating; each stroke uses it shifted to a random spot.

export const WASH_SIZE = 256;
export const WASH = makeWash(WASH_SIZE, 11);

function makeWash(size, seed) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const sum = new Float32Array(size * size);
  const layers = [
    { cell: 64, weight: 0.45 },
    { cell: 32, weight: 0.3 },
    { cell: 16, weight: 0.17 },
    { cell: 8, weight: 0.08 },
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
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of sum) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = new Uint8Array(size * size);
  for (let i = 0; i < sum.length; i++) out[i] = Math.round((255 * (sum[i] - lo)) / (hi - lo));
  return out;
}

// Smooth random noise from a few layers of soft bumps (cell = bump size in pixels), 0-255.
function makeNoise(size, seed, layers) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const sum = new Float32Array(size * size);
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
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of sum) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = new Uint8Array(size * size);
  for (let i = 0; i < sum.length; i++) out[i] = Math.round((255 * (sum[i] - lo)) / (hi - lo));
  return out;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}
