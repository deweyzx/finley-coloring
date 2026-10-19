// history.js - undo ("back") and redo ("forward").
//
// Before every stroke or fill changes the picture, we save a copy of just the rectangle it
// will touch: the colors there, and the paint memory used by "Build up color".
// Undo swaps that saved copy back in (keeping what was there, so redo can swap it back).
//
// Saved copies use memory, so the oldest steps are forgotten once all the copies together
// pass about MAX_BYTES. A big fill (the whole background) can use ~45 MB on its own; a
// normal stroke uses far less.

const MAX_BYTES = 150 * 1024 * 1024;
const MAX_STEPS = 100;

export class History {
  // ctx = the color layer; memory = the paint memory (4 numbers per pixel); width of the page.
  constructor(ctx, memory, width, onChange = () => {}) {
    this.ctx = ctx;
    this.memory = memory;
    this.width = width;
    this.onChange = onChange;
    this.undoSteps = [];
    this.redoSteps = [];
  }

  // Call BEFORE changing the box { x, y, w, h }. Saves what's there now.
  saveBefore(box) {
    this.undoSteps.push(this.copy(box));
    this.redoSteps = []; // a new change means the old "forward" steps no longer apply
    this.trim();
    this.onChange();
  }

  canUndo() {
    return this.undoSteps.length > 0;
  }

  canRedo() {
    return this.redoSteps.length > 0;
  }

  undo() {
    const step = this.undoSteps.pop();
    if (!step) return;
    this.redoSteps.push(this.swap(step));
    this.onChange();
  }

  redo() {
    const step = this.redoSteps.pop();
    if (!step) return;
    this.undoSteps.push(this.swap(step));
    this.onChange();
  }

  clear() {
    this.undoSteps = [];
    this.redoSteps = [];
    this.onChange();
  }

  // Puts a saved copy back, and returns a copy of what it replaced.
  swap(step) {
    const now = this.copy(step);
    this.ctx.putImageData(step.pixels, step.x, step.y);
    for (let row = 0; row < step.h; row++) {
      const at = ((step.y + row) * this.width + step.x) * 4;
      this.memory.set(step.memory.subarray(row * step.w * 4, (row + 1) * step.w * 4), at);
    }
    return now;
  }

  copy({ x, y, w, h }) {
    const memory = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) {
      const at = ((y + row) * this.width + x) * 4;
      memory.set(this.memory.subarray(at, at + w * 4), row * w * 4);
    }
    return { x, y, w, h, pixels: this.ctx.getImageData(x, y, w, h), memory, bytes: w * h * 8 };
  }

  trim() {
    let total = 0;
    for (const s of this.undoSteps) total += s.bytes;
    while (this.undoSteps.length > 1 && (total > MAX_BYTES || this.undoSteps.length > MAX_STEPS)) {
      total -= this.undoSteps.shift().bytes;
    }
  }
}
