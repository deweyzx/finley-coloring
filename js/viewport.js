// viewport.js - where the page sits on screen: how much it's zoomed and how far it's moved.
//
// scale = screen pixels per page pixel; (x, y) = where the page's top-left corner is,
// measured from the top-left of the drawing area. The page is shown with a CSS transform,
// so zooming and panning are smooth (the browser just moves the finished picture).

const MAX_SCALE = 4;      // most zoomed in: one page pixel = 4 screen pixels
const MIN_FACTOR = 0.5;   // while pinching, she can shrink it to half the "fit" size...
const MARGIN = 20;        // ...but on release it springs back to fit, with this margin

export class Viewport {
  constructor(area, paper, onChange = () => {}) {
    this.area = area;
    this.paper = paper;
    this.onChange = onChange;
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.pageW = 1;
    this.pageH = 1;
    this.animation = null;
  }

  setPage(width, height) {
    this.pageW = width;
    this.pageH = height;
    this.fit();
  }

  // The scale at which the whole page fits in the area.
  get fitScale() {
    const w = this.area.clientWidth - MARGIN * 2;
    const h = this.area.clientHeight - MARGIN * 2;
    return Math.max(0.01, Math.min(w / this.pageW, h / this.pageH));
  }

  isZoomedIn() {
    return this.scale > this.fitScale * 1.02;
  }

  // Shows the whole page, centered.
  fit() {
    const s = this.fitScale;
    this.set(s, (this.area.clientWidth - this.pageW * s) / 2, (this.area.clientHeight - this.pageH * s) / 2);
  }

  // Zooms by `factor` keeping the page point under screen point (clientX, clientY) still.
  zoomAt(factor, clientX, clientY) {
    const box = this.area.getBoundingClientRect();
    const ax = clientX - box.left;
    const ay = clientY - box.top;
    const s = this.clampScale(this.scale * factor);
    const k = s / this.scale;
    this.set(s, ax - (ax - this.x) * k, ay - (ay - this.y) * k);
  }

  panBy(dx, dy) {
    this.set(this.scale, this.x + dx, this.y + dy);
  }

  // For pinch: zoom and move together, based on where the gesture started.
  // start = { scale, x, y, cx, cy, dist } when the fingers went down (cx, cy = their midpoint).
  pinch(start, cx, cy, dist) {
    const s = this.clampScale(start.scale * (dist / start.dist));
    const box = this.area.getBoundingClientRect();
    const sx = start.cx - box.left;
    const sy = start.cy - box.top;
    // the page point that was under the fingers' midpoint stays under it
    const px = (sx - start.x) / start.scale;
    const py = (sy - start.y) / start.scale;
    this.set(s, cx - box.left - px * s, cy - box.top - py * s);
  }

  clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(this.fitScale * MIN_FACTOR, s));
  }

  // After a gesture: if she shrank it smaller than "fit", spring back to fit.
  settle() {
    if (this.scale < this.fitScale) {
      const s = this.fitScale;
      this.animateTo(s, (this.area.clientWidth - this.pageW * s) / 2, (this.area.clientHeight - this.pageH * s) / 2);
    }
  }

  // Converts a point on the screen to a point on the page (in page pixels).
  toPage(clientX, clientY) {
    const box = this.area.getBoundingClientRect();
    return { x: (clientX - box.left - this.x) / this.scale, y: (clientY - box.top - this.y) / this.scale };
  }

  set(scale, x, y) {
    this.animation = null;
    this.scale = scale;
    // Keep the page from getting lost: the middle of the area always stays over the page.
    const aw = this.area.clientWidth;
    const ah = this.area.clientHeight;
    this.x = Math.min(aw / 2, Math.max(aw / 2 - this.pageW * scale, x));
    this.y = Math.min(ah / 2, Math.max(ah / 2 - this.pageH * scale, y));
    this.apply();
  }

  apply() {
    this.paper.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    this.onChange();
  }

  animateTo(scale, x, y) {
    const from = { scale: this.scale, x: this.x, y: this.y };
    const started = performance.now();
    const token = {};
    this.animation = token;
    const step = (now) => {
      if (this.animation !== token) return; // a new gesture took over
      const t = Math.min(1, (now - started) / 220);
      const e = 1 - Math.pow(1 - t, 3); // ease out
      this.scale = from.scale + (scale - from.scale) * e;
      this.x = from.x + (x - from.x) * e;
      this.y = from.y + (y - from.y) * e;
      this.apply();
      if (t < 1) requestAnimationFrame(step);
      else this.animation = null;
    };
    requestAnimationFrame(step);
    // Safety net: if the animation didn't get to run (e.g. the browser paused it), just
    // jump to the end so the page never stays stuck smaller than the screen.
    setTimeout(() => {
      if (this.animation === token) this.set(scale, x, y);
    }, 300);
  }
}
