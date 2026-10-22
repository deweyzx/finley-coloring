// viewport.js - positions the whole stack of paper, paint and lines together.
// Only the view turns: saved pixels stay upright. Drawing and fill use the inverse
// of the same translation, rotation and scale that displays the paper.
const MAX_SCALE = 4;
const MIN_FACTOR = 0.5;
const MARGIN = 20;

export class Viewport {
  constructor(area, paper, onChange = () => {}) {
    this.area = area;
    this.paper = paper;
    this.onChange = onChange;
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.rotation = 0; // radians, clockwise on screen
    this.pageW = 1;
    this.pageH = 1;
    this.animation = null;
  }

  setPage(width, height) {
    this.pageW = width;
    this.pageH = height;
    this.fit();
  }

  scaleToFit(rotation = this.rotation) {
    const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
    const w = this.pageW * c + this.pageH * s;
    const h = this.pageW * s + this.pageH * c;
    return Math.max(0.01, Math.min((this.area.clientWidth - MARGIN * 2) / w,
      (this.area.clientHeight - MARGIN * 2) / h));
  }

  get fitScale() { return this.scaleToFit(); }
  isZoomedIn() { return this.scale > this.fitScale * 1.02; }

  // A new Pencil stroke or gesture takes over immediately from a settling animation.
  stop() { this.animation = null; }

  centered(scale, rotation = this.rotation) {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return {
      x: this.area.clientWidth / 2 - scale * (this.pageW * c - this.pageH * s) / 2,
      y: this.area.clientHeight / 2 - scale * (this.pageW * s + this.pageH * c) / 2,
    };
  }

  // Fit is also the simple way to return a twisted view to upright.
  fit() {
    const scale = this.scaleToFit(0), p = this.centered(scale, 0);
    this.set(scale, p.x, p.y, 0);
  }

  zoomAt(factor, clientX, clientY) {
    this.around(this.clampScale(this.scale * factor), this.rotation, clientX, clientY);
  }

  // Alt + wheel on a computer offers rotation without needing a touch screen.
  rotateAt(turn, clientX, clientY) {
    this.around(this.scale, this.rotation + turn, clientX, clientY);
  }

  around(scale, rotation, clientX, clientY) {
    const p = this.toPage(clientX, clientY), box = this.area.getBoundingClientRect();
    const c = Math.cos(rotation), s = Math.sin(rotation);
    this.set(scale, clientX - box.left - scale * (p.x * c - p.y * s),
      clientY - box.top - scale * (p.x * s + p.y * c), rotation);
  }

  panBy(dx, dy) { this.set(this.scale, this.x + dx, this.y + dy); }

  // Pinch, drag and twist keep the page point under the starting midpoint anchored.
  // Touch-input accumulates the turn so crossing +/-180 degrees never jumps.
  pinch(start, cx, cy, dist, turn = 0) {
    const rotation = (start.rotation || 0) + turn;
    const scale = this.clampScale(start.scale * dist / start.dist, rotation);
    const box = this.area.getBoundingClientRect();
    const dx = (start.cx - box.left - start.x) / start.scale;
    const dy = (start.cy - box.top - start.y) / start.scale;
    const oldC = Math.cos(start.rotation || 0), oldS = Math.sin(start.rotation || 0);
    const px = dx * oldC + dy * oldS, py = -dx * oldS + dy * oldC;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    this.set(scale, cx - box.left - scale * (px * c - py * s),
      cy - box.top - scale * (px * s + py * c), rotation);
  }

  clampScale(scale, rotation = this.rotation) {
    return Math.min(MAX_SCALE, Math.max(this.scaleToFit(rotation) * MIN_FACTOR, scale));
  }

  settle() {
    if (this.scale < this.fitScale) {
      const scale = this.fitScale, p = this.centered(scale);
      this.animateTo(scale, p.x, p.y);
    }
  }

  toPage(clientX, clientY) {
    const box = this.area.getBoundingClientRect();
    const x = (clientX - box.left - this.x) / this.scale;
    const y = (clientY - box.top - this.y) / this.scale;
    const c = Math.cos(this.rotation), s = Math.sin(this.rotation);
    return { x: x * c + y * s, y: -x * s + y * c };
  }

  set(scale, x, y, rotation = this.rotation) {
    this.animation = null;
    this.scale = scale;
    this.rotation = rotation;
    // Keep the workspace center over the paper in its rotated coordinates.
    const cx = this.area.clientWidth / 2, cy = this.area.clientHeight / 2;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const dx = (cx - x) / scale, dy = (cy - y) / scale;
    const px = Math.min(this.pageW, Math.max(0, dx * c + dy * s));
    const py = Math.min(this.pageH, Math.max(0, -dx * s + dy * c));
    this.x = cx - scale * (px * c - py * s);
    this.y = cy - scale * (px * s + py * c);
    this.apply();
  }

  apply() {
    this.paper.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rotation}rad) scale(${this.scale})`;
    this.onChange();
  }

  animateTo(scale, x, y, rotation = this.rotation) {
    const from = { scale: this.scale, x: this.x, y: this.y, rotation: this.rotation };
    const started = performance.now(), token = {};
    this.animation = token;
    const step = now => {
      if (this.animation !== token) return;
      const t = Math.min(1, (now - started) / 220), e = 1 - (1 - t) ** 3;
      this.scale = from.scale + (scale - from.scale) * e;
      this.x = from.x + (x - from.x) * e;
      this.y = from.y + (y - from.y) * e;
      this.rotation = from.rotation + (rotation - from.rotation) * e;
      this.apply();
      if (t < 1) requestAnimationFrame(step);
      else this.animation = null;
    };
    requestAnimationFrame(step);
    setTimeout(() => {
      if (this.animation === token) this.set(scale, x, y, rotation);
    }, 300);
  }
}
