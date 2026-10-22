// Blender and Blur change existing paint, never the line-art layer.
// A frozen starting picture plus a carried paint tip keep the result independent of
// screen refresh timing. Blender picks up paint and transports it along the path.
// Only small, visited tiles are smoothed; each is cached for the rest of this pass.
import { StrokeEngine } from "./stroke-engine.js?v=20261022001928";
import { SETTINGS } from "./settings.js?v=20261022001928";

const TILE = 64;

export class PaintEngine extends StrokeEngine {
  invalidateBlend() {
    this.blendPass = null;
    this.source = null;
    this.paintTip = null;
    this.tipPosition = null;
    this.filtered = null;
    this.results = null;
    this.changedTiles?.clear();
  }

  begin(brush, settings, rgb, buildUp = true, colorCtx = null) {
    super.begin(brush, settings, rgb, buildUp);
    this.colorCtx = colorCtx;
    this.results = new Map();
    this.changedTiles = new Set();
    this.source = null;
    this.paintTip = null;
    this.tipPosition = null;
    if (!brush.modify) this.invalidateBlend();
  }

  // Called only after the line-lock area is ready. With build-up off, consecutive
  // passes keep their original picture and strongest strength, not a repeatedly blurred copy.
  prepareBlend() {
    if (this.source) return;
    if (!this.colorCtx) throw new Error("Blending needs the color layer.");
    const c = this.clip;
    const key = `${this.brush.modify}:${this.settings.size}:${c ? [c.x, c.y, c.w, c.h] : "free"}`;
    let pass = this.blendPass;
    if (this.buildUp || !pass || pass.key !== key || pass.buildUp) {
      pass = {
        key, buildUp: this.buildUp,
        // Reserve the page buffer but copy only small tiles when first visited.
        // Reading the entire 22 MB canvas at touch-down caused a noticeable first pause.
        source: new Uint8ClampedArray(this.width * this.height * 4),
        sourceTiles: new Set(),
        strengths: this.buildUp ? null : new Uint8Array(this.width * this.height),
        filtered: new Map(),
      };
      this.blendPass = pass;
    }
    this.source = pass.source;
    this.filtered = pass.filtered;
    this.results = new Map();
    const blur = this.brush.modify === "blur";
    this.filterRadius = Math.max(1, Math.min(blur ? SETTINGS.blurMaxRadius : SETTINGS.blendMaxRadius,
      Math.round(this.settings.size * (blur ? SETTINGS.blurRadiusShare : SETTINGS.blendRadiusShare))));
  }

  allowed(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const c = this.clip;
    return !c || (x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h &&
      c.mask[(y - c.y) * c.w + x - c.x]);
  }

  freezeTile(tx, ty) {
    const pass = this.blendPass;
    const key = ty * Math.ceil(this.width / TILE) + tx;
    if (pass.sourceTiles.has(key)) return;
    const x = tx * TILE, y = ty * TILE;
    const w = Math.min(TILE, this.width - x), h = Math.min(TILE, this.height - y);
    const data = this.colorCtx.getImageData(x, y, w, h).data;
    for (let row = 0; row < h; row++)
      this.source.set(data.subarray(row * w * 4, (row + 1) * w * 4), ((y + row) * this.width + x) * 4);
    pass.sourceTiles.add(key);
  }

  // Pick up a little paint in each part of the tip BEFORE laying down this dab.
  // Separate cells retain colored streaks (yellow can travel into green), while
  // distance-based pickup gradually mixes in the color she crosses. No palette paint.
  // All samples obey the same lock mask as the destination pixels.
  pickUpPaint(p, shape) {
    const n = SETTINGS.blendTipGrid;
    if (!this.paintTip) {
      this.paintTip = new Float32Array(n * n * 3);
      this.tipLoaded = new Uint8Array(n * n);
    }
    const step = this.tipPosition ? Math.hypot(p.x - this.tipPosition.x, p.y - this.tipPosition.y) : 0;
    const pickup = 1 - Math.exp(-step / Math.max(1, this.settings.size * SETTINGS.blendCarryDistance));
    const ca = Math.cos(shape.angle), sa = Math.sin(shape.angle);
    let key = -1, tile;
    const columns = Math.ceil(this.width / TILE);
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
      const cell = gy * n + gx, at = cell * 3;
      const u = (gx + 0.5) * 2 / n - 1, v = (gy + 0.5) * 2 / n - 1;
      if (u * u + v * v > 1) { this.tipLoaded[cell] = 0; continue; }
      const x = Math.round(p.x + shape.radius * (u * shape.stretch * ca - v * sa));
      const y = Math.round(p.y + shape.radius * (u * shape.stretch * sa + v * ca));
      if (!this.allowed(x, y)) { this.tipLoaded[cell] = 0; continue; }
      const nextKey = Math.floor(y / TILE) * columns + Math.floor(x / TILE);
      if (nextKey !== key) { tile = this.filteredTile(Math.floor(x / TILE), Math.floor(y / TILE)); key = nextKey; }
      const sample = ((y - tile.y) * tile.w + x - tile.x) * 3;
      const amount = this.tipLoaded[cell] ? pickup : 1;
      for (let k = 0; k < 3; k++) this.paintTip[at + k] += (tile.data[sample + k] - this.paintTip[at + k]) * amount;
      this.tipLoaded[cell] = 1;
    }
    this.tipPosition = { x: p.x, y: p.y };
    // Let the browser's native image resizer interpolate the tip, rather than
    // running four color lookups in JavaScript for every page pixel. Both tiny
    // canvases request the read-friendly backing used for the picture canvas.
    const m = SETTINGS.blendTipPixels;
    if (!this.tipCanvas || this.tipCanvas.width !== n || this.tipSmooth.width !== m) {
      this.tipCanvas = document.createElement("canvas");
      this.tipCanvas.width = this.tipCanvas.height = n;
      this.tipCtx = this.tipCanvas.getContext("2d", { willReadFrequently: true });
      this.tipImage = new ImageData(n, n);
      this.tipSmooth = document.createElement("canvas");
      this.tipSmooth.width = this.tipSmooth.height = m;
      this.tipSmoothCtx = this.tipSmooth.getContext("2d", { willReadFrequently: true });
    }
    const data = this.tipImage.data;
    for (let cell = 0; cell < n * n; cell++) {
      data[cell * 4] = this.paintTip[cell * 3];
      data[cell * 4 + 1] = this.paintTip[cell * 3 + 1];
      data[cell * 4 + 2] = this.paintTip[cell * 3 + 2];
      data[cell * 4 + 3] = this.tipLoaded[cell] ? 255 : 0;
    }
    this.tipCtx.putImageData(this.tipImage, 0, 0);
    this.tipSmoothCtx.clearRect(0, 0, m, m);
    this.tipSmoothCtx.drawImage(this.tipCanvas, 0, 0, m, m);
    this.tipPixels = this.tipSmoothCtx.getImageData(0, 0, m, m).data;
  }

  // A summed-area table makes a whole soft tile in linear time, whatever the
  // blur radius. The fourth channel counts allowed paint: paint across a locked
  // boundary is excluded from BOTH the average and its divisor (no white seam).
  // Blender also favors pigment over white paper grain, keeping mixtures fuller.
  filteredTile(tx, ty) {
    const key = ty * Math.ceil(this.width / TILE) + tx;
    let tile = this.filtered.get(key);
    if (tile) return tile;
    const r = this.filterRadius;
    const x0 = tx * TILE, y0 = ty * TILE;
    const w = Math.min(TILE, this.width - x0), h = Math.min(TILE, this.height - y0);
    for (let gy = Math.max(0, Math.floor((y0 - r) / TILE)); gy <= Math.min(Math.ceil(this.height / TILE) - 1, Math.floor((y0 + h - 1 + r) / TILE)); gy++)
      for (let gx = Math.max(0, Math.floor((x0 - r) / TILE)); gx <= Math.min(Math.ceil(this.width / TILE) - 1, Math.floor((x0 + w - 1 + r) / TILE)); gx++)
        this.freezeTile(gx, gy);
    const sw = w + r * 2, sh = h + r * 2, stride = (sw + 1) * 4;
    const needed = (sh + 1) * stride;
    if (!this.sums || this.sums.length < needed) this.sums = new Float64Array(needed);
    const sums = this.sums;
    sums.fill(0, 0, needed);
    const favorPaint = this.brush.modify === "blender" ? SETTINGS.blendPigmentWeight : 0;
    for (let y = 0; y < sh; y++) {
      const py = y0 + y - r;
      let red = 0, green = 0, blue = 0, count = 0;
      for (let x = 0; x < sw; x++) {
        const px = x0 + x - r;
        if (this.allowed(px, py)) {
          const at = (py * this.width + px) * 4;
          const R = this.source[at], G = this.source[at + 1], B = this.source[at + 2];
          const weight = 1 - favorPaint * Math.min(R, G, B) / 255;
          red += R * weight; green += G * weight; blue += B * weight; count += weight;
        }
        const at = (y + 1) * stride + (x + 1) * 4, above = at - stride;
        sums[at] = sums[above] + red; sums[at + 1] = sums[above + 1] + green;
        sums[at + 2] = sums[above + 2] + blue; sums[at + 3] = sums[above + 3] + count;
      }
    }
    tile = { x: x0, y: y0, w, h, data: new Uint8ClampedArray(w * h * 3) };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = y * stride + x * 4, b = a + (2 * r + 1) * 4;
      const d = (y + 2 * r + 1) * stride + x * 4, e = d + (2 * r + 1) * 4;
      const count = sums[e + 3] - sums[b + 3] - sums[d + 3] + sums[a + 3];
      const at = (y * w + x) * 3;
      const original = ((y0 + y) * this.width + x0 + x) * 4;
      for (let k = 0; k < 3; k++) tile.data[at + k] = count
        ? (sums[e + k] - sums[b + k] - sums[d + k] + sums[a + k]) / count
        : this.source[original + k];
    }
    // Bound the cache, even if she covers the whole page without lifting.
    if (this.filtered.size >= SETTINGS.blendCacheTiles) this.filtered.delete(this.filtered.keys().next().value);
    this.filtered.set(key, tile);
    return tile;
  }

  dab(p) {
    if (!this.brush.modify) return super.dab(p);
    this.prepareBlend();
    this.dabCount = (this.dabCount || 0) + 1;
    const s = this.shape(p), W = this.width;
    const radius = s.radius, stretch = s.stretch;
    const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
    const reach = radius * stretch;
    let x0 = Math.max(0, Math.floor(p.x - reach)), x1 = Math.min(W - 1, Math.ceil(p.x + reach));
    let y0 = Math.max(0, Math.floor(p.y - reach)), y1 = Math.min(this.height - 1, Math.ceil(p.y + reach));
    const clip = this.clip;
    if (clip) {
      x0 = Math.max(x0, clip.x); x1 = Math.min(x1, clip.x + clip.w - 1);
      y0 = Math.max(y0, clip.y); y1 = Math.min(y1, clip.y + clip.h - 1);
    }
    const carriesPaint = this.brush.modify === "blender";
    if (carriesPaint) this.pickUpPaint(p, s);
    const grid = SETTINGS.blendTipPixels;
    const prior = this.blendPass.strengths;
    let changed = false, resultKey = -1, result;
    const columns = Math.ceil(W / TILE);
    const da = ca / (radius * stretch), db = -sa / radius;
    const va = sa / (radius * stretch), vb = ca / radius;
    const qa = da * da + db * db, qbRow = 2 * (da * va + db * vb), qcRow = va * va + vb * vb;
    const peak = 255 * s.opacity, edge = 1 / (1 - this.brush.hardness * this.brush.hardness);
    for (let y = y0; y <= y1; y++) {
      const uy = y + 0.5 - p.y, qb = qbRow * uy, qc = qcRow * uy * uy - 1;
      const disc = qb * qb - 4 * qa * qc;
      if (disc <= 0) continue;
      const root = Math.sqrt(disc);
      const left = Math.max(x0, Math.ceil(p.x - 0.5 + (-qb - root) / (2 * qa)));
      const right = Math.min(x1, Math.floor(p.x - 0.5 + (-qb + root) / (2 * qa)));
      let a = (left + 0.5 - p.x) * da + uy * va;
      let b = (left + 0.5 - p.x) * db + uy * vb;
      const clipRow = clip ? (y - clip.y) * clip.w - clip.x : 0;
      for (let x = left; x <= right; x++, a += da, b += db) {
        const q = a * a + b * b;
        if (q >= 1 || (clip && !clip.mask[clipRow + x])) continue;
        const fade = Math.min(1, (1 - q) * edge);
        const amount = Math.round(peak * fade * fade * (3 - 2 * fade));
        const i = y * W + x;
        if (!amount || amount <= (prior ? prior[i] : 0) ||
          (!carriesPaint && amount <= this.coverage[i])) continue;
        const rk = (y >> 6) * columns + (x >> 6);
        if (rk !== resultKey) {
          result = this.results.get(rk);
          if (!result) {
            const rx = Math.floor(x / TILE) * TILE, ry = Math.floor(y / TILE) * TILE;
            result = { x: rx, y: ry, w: Math.min(TILE, W - rx), h: Math.min(TILE, this.height - ry) };
            result.image = new ImageData(result.w, result.h);
            if (carriesPaint) {
              result.paint = new Float32Array(result.w * result.h * 3);
              result.paintWeight = new Float32Array(result.w * result.h);
            }
            this.results.set(rk, result);
          }
          resultKey = rk;
        }
        const local = (y - result.y) * result.w + x - result.x;
        if (carriesPaint) {
          // q < 1 already guarantees the normalized coordinates are inside the tip.
          const gx = ((a + 1) * grid / 2) | 0;
          const gy = ((b + 1) * grid / 2) | 0;
          const picked = (gy * grid + gx) * 4;
          let R = this.tipPixels[picked], G = this.tipPixels[picked + 1], B = this.tipPixels[picked + 2];
          if (!this.tipPixels[picked + 3]) {
            // A narrow locked vein can fit between the tip's sample cells. It still
            // gets local mixing; never borrow paint from outside the allowed region.
            const sampleTile = this.filteredTile(Math.floor(x / TILE), Math.floor(y / TILE));
            const sample = ((y - sampleTile.y) * sampleTile.w + x - sampleTile.x) * 3;
            R = sampleTile.data[sample]; G = sampleTile.data[sample + 1]; B = sampleTile.data[sample + 2];
          }
          const to = local * 3;
          // Neighboring tip colors cross-fade with a smooth bell, rather than replacing
          // whole round stamps (which left visible scallops). Only COLOR is averaged;
          // opacity remains MAX, so overlap does not build darker blotches.
          const weight = (1 - q) * (1 - q) * s.opacity;
          const total = result.paintWeight[local] + weight;
          const mix = weight / total;
          result.paint[to] += (R - result.paint[to]) * mix;
          result.paint[to + 1] += (G - result.paint[to + 1]) * mix;
          result.paint[to + 2] += (B - result.paint[to + 2]) * mix;
          result.paintWeight[local] = total;
        }
        result.image.data[local * 4 + 3] = 1; // pending calculation, never displayed as-is
        this.changedTiles.add(result);
        this.coverage[i] = Math.max(this.coverage[i], amount);
        changed = true;
      }
    }
    if (changed) {
      this.box = union(this.box, x0, y0, x1, y1);
      this.dirty = union(this.dirty, x0, y0, x1, y1);
    }
  }

  render(ctx) {
    if (!this.brush.modify) return super.render(ctx);
    const columns = Math.ceil(this.width / TILE);
    for (const tile of this.changedTiles) {
      this.freezeTile(Math.floor(tile.x / TILE), Math.floor(tile.y / TILE));
      let targetKey = -1, target;
      const data = tile.image.data;
      for (let y = 0; y < tile.h; y++) for (let x = 0; x < tile.w; x++) {
        const local = y * tile.w + x, to = local * 4;
        if (data[to + 3] !== 1) continue;
        const px = tile.x + x, py = tile.y + y, i = py * this.width + px;
        const sx = px, sy = py;
        const key = Math.floor(sy / TILE) * columns + Math.floor(sx / TILE);
        if (!tile.paint && key !== targetKey) { target = this.filteredTile(Math.floor(sx / TILE), Math.floor(sy / TILE)); targetKey = key; }
        const colors = tile.paint || target.data;
        const at = i * 4, sample = tile.paint ? local * 3 : ((sy - target.y) * target.w + sx - target.x) * 3;
        const strength = this.coverage[i] / 255;
        data[to] = this.source[at] + (colors[sample] - this.source[at]) * strength;
        data[to + 1] = this.source[at + 1] + (colors[sample + 1] - this.source[at + 1]) * strength;
        data[to + 2] = this.source[at + 2] + (colors[sample + 2] - this.source[at + 2]) * strength;
        data[to + 3] = 255;
      }
      ctx.putImageData(tile.image, tile.x, tile.y);
    }
    this.changedTiles.clear();
    this.dirty = null;
  }

  // These tools alter the picture: guessed smudges would flicker, so only real input is used.
  renderAhead(ctx, ahead) {
    if (!this.brush.modify) return super.renderAhead(ctx, ahead);
    this.render(ctx);
  }

  commit(strokeCtx, colorCtx, beforeChange) {
    if (!this.brush.modify) return super.commit(strokeCtx, colorCtx, beforeChange);
    if (!this.box) { this.results = null; return null; }
    this.render(strokeCtx);
    const b = this.box, box = { x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 };
    if (beforeChange) beforeChange(box);
    colorCtx.drawImage(strokeCtx.canvas, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h);
    const prior = this.blendPass.strengths;
    // A long curved stroke can have a huge bounding box with mostly untouched paper.
    // Visit only its small painted tiles when updating paint memory at Pencil-up.
    for (const tile of this.results.values()) {
      for (let y = tile.y; y < tile.y + tile.h; y++) for (let x = tile.x; x < tile.x + tile.w; x++) {
        const i = y * this.width + x;
        if (!this.coverage[i]) continue;
        // Mixed colors have no single original paint color/opacity. Forget those pixels,
        // rather than letting the even-out painting calculation use stale paint memory.
        const at = i * 4;
        this.memory[at] = this.memory[at + 1] = this.memory[at + 2] = this.memory[at + 3] = 0;
        if (prior) prior[i] = this.coverage[i];
        this.coverage[i] = 0;
      }
    }
    strokeCtx.clearRect(box.x, box.y, box.w, box.h);
    this.box = this.dirty = this.last = null;
    this.results = null;
    this.source = null;
    if (this.buildUp) this.invalidateBlend();
    return box;
  }

  cancel(ctx) {
    super.cancel(ctx);
    this.results = null;
    this.source = null;
    if (this.buildUp) this.invalidateBlend();
  }
}

function union(box, x0, y0, x1, y1) {
  return box ? { x0: Math.min(box.x0, x0), y0: Math.min(box.y0, y0),
    x1: Math.max(box.x1, x1), y1: Math.max(box.y1, y1) } : { x0, y0, x1, y1 };
}
