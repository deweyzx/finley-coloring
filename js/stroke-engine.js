// stroke-engine.js - turns Pencil movements into brush strokes.
//
// How a stroke is drawn:
//   1. Each Pencil position becomes a "dab" (a small round mark). Between positions, dabs
//      are added at even spacing, with pressure and tilt blended smoothly from one to the next.
//   2. Every dab writes into a "coverage" map for this stroke: how strongly each pixel is
//      covered (0-255). A pixel keeps the STRONGEST coverage any dab gave it, never the sum,
//      so a stroke that crosses itself doesn't get darker blotches.
//   3. While she draws, the stroke is shown on its own see-through layer.
//   4. When she lifts the Pencil, the stroke is laid onto the picture. A new stroke over an
//      old one adds up, so she can build up color and shading in layers.
//   5. "Build up color" OFF: going over a spot already painted in the SAME color only adds
//      what's missing to reach this stroke's opacity, so touch-ups stay even instead of
//      getting darker. To know that, the engine remembers for every pixel the last color
//      painted there and how strongly ("paint memory", 4 numbers per pixel).
//
// The brushes themselves are described in brushes.js.

import { GRAIN, GRAIN_SIZE } from "./brushes.js?v=202610191452";

export class StrokeEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.coverage = new Uint8Array(width * height);
    // Paint memory: for every pixel, the red, green, blue of the last paint there and how
    // strongly it was laid on (0-255). 0 strength = never painted.
    this.memory = new Uint8Array(width * height * 4);
    this.box = null;   // the area the whole stroke has touched
    this.dirty = null; // the area changed since the screen was last updated
  }

  // Starts a stroke. settings = { size, opacity } from the sliders; rgb = { r, g, b };
  // buildUp = true: strokes on top deepen the color; false: same-color touch-ups stay even.
  begin(brush, settings, rgb, buildUp = true) {
    this.brush = brush;
    this.settings = settings;
    this.rgb = rgb;
    this.buildUp = buildUp;
    this.last = null;
    this.leftover = 0; // distance already travelled toward the next dab
    this.box = null;
    this.dirty = null;
    this.clip = null;
  }

  // Line-lock: only let this stroke paint inside an area, like a stencil.
  // area = { x, y, w, h, mask } from tap-to-fill (mask has a 1 for every pixel allowed),
  // or null to paint anywhere. Works the same for every brush.
  setClip(area) {
    this.clip = area;
  }

  // Adds a Pencil position: { x, y, pressure (0-1), altitude (0 = flat, PI/2 = upright), azimuth }
  addPoint(point) {
    const p = { ...point };
    if (!this.last) {
      this.dab(p);
      this.last = p;
      return;
    }
    const a = this.last;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    let travelled = -this.leftover;
    for (;;) {
      // spacing depends on how big the dab is right here
      const t0 = Math.max(0, travelled) / length;
      const step = Math.max(0.5, this.dabSize(lerpPoint(a, p, t0)) * this.brush.spacing);
      if (travelled + step > length) {
        this.leftover = length - travelled;
        break;
      }
      travelled += step;
      this.dab(lerpPoint(a, p, travelled / length));
    }
    this.last = p;
  }

  // How the brush responds to pressure and tilt at one point.
  shape(p) {
    const brush = this.brush;
    const pressure = Math.pow(clamp(p.pressure, 0, 1), brush.pressure.curve);
    const flat = 1 - clamp(p.altitude / (Math.PI / 2), 0, 1); // 0 = upright, 1 = lying flat
    // Tilt only counts once the Pencil leans past about 30 degrees, then grows smoothly.
    const side = smoothStep(clamp((flat - 0.33) / 0.5, 0, 1));
    const sizeFactor = lerp(brush.pressure.size[0], brush.pressure.size[1], pressure);
    const opacityFactor = lerp(brush.pressure.opacity[0], brush.pressure.opacity[1], pressure);
    return {
      radius: Math.max(0.6, (this.settings.size * sizeFactor) / 2),
      stretch: 1 + brush.tilt.widen * side,
      angle: p.azimuth || 0,
      opacity: this.settings.opacity * opacityFactor * lerp(1, brush.tilt.opacity, side),
      grainFill: brush.grain
        ? lerp(brush.grain.fill[0], brush.grain.fill[1], pressure) * lerp(1, brush.tilt.grainFill, side)
        : 1,
    };
  }

  dabSize(p) {
    const s = this.shape(p);
    return s.radius * 2;
  }

  // Stamps one dab into the coverage map.
  dab(p) {
    const s = this.shape(p);
    const brush = this.brush;
    const W = this.width;
    const H = this.height;
    // An oval: `stretch` times wider across the tilt direction (side of the lead).
    const rLong = s.radius * s.stretch;
    const rShort = s.radius;
    const reach = Math.ceil(rLong + 1);
    let x0 = Math.max(0, Math.floor(p.x - reach));
    let x1 = Math.min(W - 1, Math.ceil(p.x + reach));
    let y0 = Math.max(0, Math.floor(p.y - reach));
    let y1 = Math.min(H - 1, Math.ceil(p.y + reach));
    const clip = this.clip;
    if (clip) {
      // Line-lock: only the part of the dab inside the stencil's box can paint.
      x0 = Math.max(x0, clip.x);
      y0 = Math.max(y0, clip.y);
      x1 = Math.min(x1, clip.x + clip.w - 1);
      y1 = Math.min(y1, clip.y + clip.h - 1);
    }
    if (x0 > x1 || y0 > y1) return;

    // the oval's long side runs across the direction the Pencil leans
    const cos = Math.cos(s.angle + Math.PI / 2);
    const sin = Math.sin(s.angle + Math.PI / 2);
    const hard = brush.hardness;
    const peak = s.opacity * 255;
    // Small dabs get a softer edge so thin lines stay smooth instead of jagged.
    const edge = Math.max(1 - hard, 1 / Math.max(1, rShort));
    const inner = 1 - edge;
    const grain = brush.grain;
    const grainFill = s.grainFill;
    const grainSoft = 0.3; // how gradually the grain fills in
    const cov = this.coverage;

    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - p.y;
      const row = y * W;
      const grainRow = (y & (GRAIN_SIZE - 1)) * GRAIN_SIZE;
      const clipRow = clip ? (y - clip.y) * clip.w - clip.x : 0;
      for (let x = x0; x <= x1; x++) {
        if (clip && clip.mask[clipRow + x] === 0) continue; // outside the locked area
        const dx = x + 0.5 - p.x;
        const u = (dx * cos + dy * sin) / rLong;
        const v = (-dx * sin + dy * cos) / rShort;
        const d = Math.sqrt(u * u + v * v);
        if (d >= 1) continue;
        let a = d <= inner ? 1 : (1 - d) / edge;
        if (grain) {
          // Paper tooth: pigment reaches the high points first; more pressure fills more in.
          const g = GRAIN[grainRow + (x & (GRAIN_SIZE - 1))] / 255;
          const reached = clamp((g - (1 - grainFill)) / grainSoft + 0.5, 0, 1);
          a *= 1 - grain.strength + grain.strength * reached;
        }
        const value = a * peak;
        const i = row + x;
        if (value > cov[i]) cov[i] = value;
      }
    }
    this.box = growBox(this.box, x0, y0, x1, y1);
    this.dirty = growBox(this.dirty, x0, y0, x1, y1);
  }

  // Shows the changed part of the stroke on the stroke layer (call once per screen update).
  render(ctx) {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const w = d.x1 - d.x0 + 1;
    const h = d.y1 - d.y0 + 1;
    const image = ctx.createImageData(w, h);
    const px = image.data;
    const { r, g, b } = this.rgb;
    const cov = this.coverage;
    const mem = this.memory;
    // (The eraser always just rubs out; "build up" only changes how colors go on.)
    const evenOut = !this.buildUp && this.brush.paint !== "paper";
    for (let row = 0; row < h; row++) {
      let i = (d.y0 + row) * this.width + d.x0;
      let p = row * w * 4;
      for (let col = 0; col < w; col++, i++, p += 4) {
        let c = cov[i];
        if (c === 0) continue;
        if (evenOut) {
          const m = i * 4;
          const had = mem[m + 3];
          if (had > 0 && mem[m] === r && mem[m + 1] === g && mem[m + 2] === b) {
            // Already painted this color with strength `had`: only add what's missing.
            // (Laying the color on at strength x over it brings it to `c` exactly when
            // x = (c - had) / (1 - had).)
            if (c <= had) continue;
            c = had >= 255 ? 0 : Math.round(((c - had) / (255 - had)) * 255);
            if (c === 0) continue;
          }
        }
        px[p] = r;
        px[p + 1] = g;
        px[p + 2] = b;
        px[p + 3] = c;
      }
    }
    ctx.putImageData(image, d.x0, d.y0);
  }

  // Lays the finished stroke onto the picture, then clears the stroke layer.
  // beforeChange(box) is called just before the picture changes (undo saves a copy then).
  // Returns the area it changed, or null if nothing was drawn.
  commit(strokeCtx, colorCtx, beforeChange) {
    const box = this.box;
    if (!box) return null;
    this.render(strokeCtx);
    const w = box.x1 - box.x0 + 1;
    const h = box.y1 - box.y0 + 1;
    if (beforeChange) beforeChange({ x: box.x0, y: box.y0, w, h });
    colorCtx.drawImage(strokeCtx.canvas, box.x0, box.y0, w, h, box.x0, box.y0, w, h);
    strokeCtx.clearRect(box.x0, box.y0, w, h);
    this.remember(box);
    for (let y = box.y0; y <= box.y1; y++) {
      this.coverage.fill(0, y * this.width + box.x0, y * this.width + box.x1 + 1);
    }
    this.box = null;
    this.last = null;
    return { x: box.x0, y: box.y0, w, h };
  }
}

// Paint memory after a stroke: each touched pixel now holds this color at this strength
// (or, for an even-out touch-up of the same color, at the stronger of the two).
// The eraser is different: it doesn't paint "white", it weakens what's there. A pixel
// erased by 30% keeps its color in the memory at 70% of its old strength, so painting the
// same color over it later adds exactly what's missing (no darker edges where the eraser's
// soft edge only partly erased). Fully erased pixels are forgotten.
StrokeEngine.prototype.remember = function (box) {
  const { r, g, b } = this.rgb;
  const cov = this.coverage;
  const mem = this.memory;
  const erasing = this.brush.paint === "paper";
  for (let y = box.y0; y <= box.y1; y++) {
    for (let i = y * this.width + box.x0, end = y * this.width + box.x1; i <= end; i++) {
      const c = cov[i];
      if (c === 0) continue;
      const m = i * 4;
      if (erasing) {
        const left = Math.round((mem[m + 3] * (255 - c)) / 255);
        if (left === 0) mem[m] = mem[m + 1] = mem[m + 2] = mem[m + 3] = 0;
        else mem[m + 3] = left;
        continue;
      }
      const same = mem[m + 3] > 0 && mem[m] === r && mem[m + 1] === g && mem[m + 2] === b;
      if (!this.buildUp && same) {
        if (c > mem[m + 3]) mem[m + 3] = c;
      } else {
        mem[m] = r;
        mem[m + 1] = g;
        mem[m + 2] = b;
        mem[m + 3] = c;
      }
    }
  }
};

// Paint memory after a fill: the filled pixels are now solid `rgb`.
StrokeEngine.prototype.rememberFill = function (area, rgb) {
  const mem = this.memory;
  for (let row = 0; row < area.h; row++) {
    for (let col = 0; col < area.w; col++) {
      if (!area.mask[row * area.w + col]) continue;
      const m = ((area.y + row) * this.width + area.x + col) * 4;
      mem[m] = rgb.r;
      mem[m + 1] = rgb.g;
      mem[m + 2] = rgb.b;
      mem[m + 3] = 255;
    }
  }
};

// Takes the current stroke back without leaving any mark (e.g. a finger stroke that turned
// out to be the start of a two-finger gesture).
StrokeEngine.prototype.cancel = function (strokeCtx) {
  const box = this.box;
  if (box) {
    strokeCtx.clearRect(box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1);
    for (let y = box.y0; y <= box.y1; y++) {
      this.coverage.fill(0, y * this.width + box.x0, y * this.width + box.x1 + 1);
    }
  }
  this.box = null;
  this.dirty = null;
  this.last = null;
};

function growBox(box, x0, y0, x1, y1) {
  if (!box) return { x0, y0, x1, y1 };
  return {
    x0: Math.min(box.x0, x0),
    y0: Math.min(box.y0, y0),
    x1: Math.max(box.x1, x1),
    y1: Math.max(box.y1, y1),
  };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    altitude: a.altitude + (b.altitude - a.altitude) * t,
    azimuth: b.azimuth,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}
