// Blender and Blur change existing paint, never the line-art layer.
// A frozen starting picture keeps the result independent of screen refresh timing.
// Only small, visited tiles are smoothed; each is cached for the rest of this pass.
import { StrokeEngine } from "./stroke-engine.js?v=202610210038";
import { SETTINGS } from "./settings.js?v=202610210038";

const TILE = 64;

export class PaintEngine extends StrokeEngine {
  invalidateBlend() {
    this.blendPass = null;
    this.source = null;
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
    this.filterRadius = Math.max(1, Math.min(SETTINGS.blendMaxRadius,
      Math.round(this.settings.size * SETTINGS.blendRadiusShare)));
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

  // A summed-area table makes a whole soft tile in linear time, whatever the
  // blur radius. The fourth channel counts allowed pixels: paint across a locked
  // boundary is excluded from BOTH the average and its divisor (no white seam).
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
    for (let y = 0; y < sh; y++) {
      const py = y0 + y - r;
      let red = 0, green = 0, blue = 0, count = 0;
      for (let x = 0; x < sw; x++) {
        const px = x0 + x - r;
        if (this.allowed(px, py)) {
          const at = (py * this.width + px) * 4;
          red += this.source[at]; green += this.source[at + 1]; blue += this.source[at + 2]; count++;
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
    const x0 = Math.max(0, Math.floor(p.x - reach)), x1 = Math.min(W - 1, Math.ceil(p.x + reach));
    const y0 = Math.max(0, Math.floor(p.y - reach)), y1 = Math.min(this.height - 1, Math.ceil(p.y + reach));
    const pull = this.brush.modify === "blender" && this.direction !== null
      ? Math.min(SETTINGS.blendMaxPull, radius * SETTINGS.blendPullShare) : 0;
    const dx = Math.round(Math.cos(this.direction || 0) * pull);
    const dy = Math.round(Math.sin(this.direction || 0) * pull);
    const prior = this.blendPass.strengths;
    let changed = false, resultKey = -1, result;
    const columns = Math.ceil(W / TILE);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ux = x + 0.5 - p.x, uy = y + 0.5 - p.y;
      const a = (ux * ca + uy * sa) / (radius * stretch), b = (-ux * sa + uy * ca) / radius;
      const q = a * a + b * b;
      if (q >= 1 || !this.allowed(x, y)) continue;
      const fade = Math.min(1, (1 - q) / (1 - this.brush.hardness * this.brush.hardness));
      const amount = Math.round(255 * s.opacity * fade * fade * (3 - 2 * fade));
      const i = y * W + x;
      if (amount <= Math.max(this.coverage[i], prior ? prior[i] : 0)) continue;
      // Never carry paint from the other side of a locked outline.
      let sx = x - dx, sy = y - dy;
      if (!this.allowed(sx, sy)) { sx = x; sy = y; }
      const rk = Math.floor(y / TILE) * columns + Math.floor(x / TILE);
      if (rk !== resultKey) {
        result = this.results.get(rk);
        if (!result) {
          const rx = Math.floor(x / TILE) * TILE, ry = Math.floor(y / TILE) * TILE;
          result = { x: rx, y: ry, w: Math.min(TILE, W - rx), h: Math.min(TILE, this.height - ry) };
          result.image = new ImageData(result.w, result.h);
          result.pullX = new Int8Array(result.w * result.h);
          result.pullY = new Int8Array(result.w * result.h);
          this.results.set(rk, result);
        }
        resultKey = rk;
      }
      const local = (y - result.y) * result.w + x - result.x;
      // Do only coverage work while stamping. Color sampling happens once per changed
      // pixel at the next screen update, not again for every overlapping dab.
      result.pullX[local] = x - sx;
      result.pullY[local] = y - sy;
      result.image.data[local * 4 + 3] = 1; // pending calculation, never displayed as-is
      this.changedTiles.add(result);
      this.coverage[i] = amount;
      changed = true;
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
        const sx = px - tile.pullX[local], sy = py - tile.pullY[local];
        const key = Math.floor(sy / TILE) * columns + Math.floor(sx / TILE);
        if (key !== targetKey) { target = this.filteredTile(Math.floor(sx / TILE), Math.floor(sy / TILE)); targetKey = key; }
        const at = i * 4, sample = ((sy - target.y) * target.w + sx - target.x) * 3;
        const strength = this.coverage[i] / 255;
        data[to] = this.source[at] + (target.data[sample] - this.source[at]) * strength;
        data[to + 1] = this.source[at + 1] + (target.data[sample + 1] - this.source[at + 1]) * strength;
        data[to + 2] = this.source[at + 2] + (target.data[sample + 2] - this.source[at + 2]) * strength;
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
