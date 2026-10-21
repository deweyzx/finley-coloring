// speed-test.js - measures how heavy each brush is on THIS device (for the touch log's
// "Speed test" button), so each brush's biggest size can be set to what stays smooth on
// Finley's iPad instead of guessing from a fast computer.
//
// For every brush it draws one standard fast stroke, invisibly, at the current zoom: one second
// of drawing (the Pencil moving about 600 screen pixels a second, sampled 240 times a second,
// with the screen updated the way the app does it). It starts at the brush's biggest size and
// tries smaller sizes until one is smooth:
//   smooth = the drawing work takes at most half of that second, and no single screen update
//            takes longer than about two screen refreshes (33 ms).
// Nothing is drawn on her picture; the test uses its own hidden layers and lets them go after.

import { BRUSHES } from "./brushes.js?v=202610202151";
import { StrokeEngine } from "./stroke-engine.js?v=202610202151";

const SCREEN_SPEED = 600; // screen pixels per second: a quick, sweeping stroke
const SHARES = [1, 0.85, 0.7, 0.55, 0.4, 0.25]; // sizes tried, as shares of the biggest size
const SMOOTH_WORK = 0.5; // at most half of the time spent drawing...
const SMOOTH_SLOWEST = 33; // ...and no single update longer than this (ms)

// width, height: the page's size; scale: screen pixels per page pixel right now;
// wait(engine, scale, lastCost): how long the app waits between screen updates (see editor.js);
// parent: where to put the hidden layer; report(text): adds a line to the touch log.
export async function runSpeedTest({ width, height, scale, wait, parent, report }) {
  const engine = new StrokeEngine(width, height);
  const strokeCanvas = document.createElement("canvas");
  const colorCanvas = document.createElement("canvas");
  strokeCanvas.width = colorCanvas.width = width;
  strokeCanvas.height = colorCanvas.height = height;
  strokeCanvas.style.opacity = "0"; // in the page like the real stroke layer, but invisible
  parent.append(strokeCanvas);
  const strokeCtx = strokeCanvas.getContext("2d");
  const colorCtx = colorCanvas.getContext("2d");
  const pause = () => new Promise((resolve) => setTimeout(resolve, 40));

  report(`Speed test: 1 s of fast drawing per brush at this zoom (smooth = under ${SMOOTH_WORK * 100}% work and no update over ${SMOOTH_SLOWEST} ms)`);
  try {
    // a first stroke so the browser has the brush code ready (like the warm-up)
    measure(engine, BRUSHES.marker, 20, scale, wait, strokeCtx, colorCtx);
    for (const [id, brush] of Object.entries(BRUSHES)) {
      const [min, max] = brush.sizeRange;
      const sizes = [...new Set(SHARES.map((k) => Math.max(min, Math.round(max * k))))];
      const tried = [];
      let smoothSize = null;
      for (const size of sizes) {
        await pause(); // (let the screen breathe between strokes)
        const r = measure(engine, brush, size, scale, wait, strokeCtx, colorCtx);
        const smooth = r.work <= SMOOTH_WORK * 1000 && r.slowest <= SMOOTH_SLOWEST;
        tried.push(`${size}: ${Math.round(r.work / 10)}% / ${Math.round(r.slowest)} ms ${smooth ? "✓" : "✗"}`);
        if (smooth) {
          smoothSize = size;
          break;
        }
      }
      report(
        `${brush.name} (biggest ${max}): ${tried.join(" · ")}\n   → ` +
          (smoothSize === max ? "smooth at its biggest size" : smoothSize ? `largest smooth size: about ${smoothSize}` : `not smooth even at ${sizes[sizes.length - 1]}`)
      );
    }
  } finally {
    strokeCanvas.remove();
    strokeCanvas.width = strokeCanvas.height = 0; // let the big hidden layers go
    colorCanvas.width = colorCanvas.height = 0;
  }
}

// One second of fast drawing with one brush at one size. Returns the total work and the slowest
// single update, in milliseconds (measured, on this device).
function measure(engine, brush, size, scale, wait, strokeCtx, colorCtx) {
  const pageSpeed = SCREEN_SPEED / scale; // page pixels per second
  const { width, height } = engine;
  // a back-and-forth stroke across the middle of the page
  const span = Math.min(width * 0.6, 1400);
  const pos = (t) => {
    const d = pageSpeed * t;
    const lane = Math.floor(d / span);
    const along = d % span;
    return { x: width * 0.2 + (lane % 2 ? span - along : along), y: height * 0.3 + lane * size * 0.6 + 30 * Math.sin(d / 80) };
  };
  engine.begin(brush, { size, opacity: brush.defaults.opacity }, { r: 120, g: 60, b: 180 }, true);
  let work = 0;
  let slowest = 0;
  let drawnAt = -1e9;
  let drawCost = 0;
  let prev = null;
  for (let frame = 0; frame < 120; frame++) {
    const now = (frame * 1000) / 120;
    const t0 = performance.now();
    let p = null;
    for (let k = 0; k < 2; k++) {
      p = { ...pos((frame * 2 + k) / 240), pressure: 0.8, altitude: 0.8, azimuth: 2.2 };
      engine.addPoint(p);
    }
    if (now - drawnAt >= wait(engine, scale, drawCost)) {
      const d0 = performance.now();
      if (engine.tipRadius() * scale > 32 || !prev) engine.render(strokeCtx);
      else engine.renderAhead(strokeCtx, [{ ...p, x: p.x + (p.x - prev.x) * 0.6, y: p.y + (p.y - prev.y) * 0.6 }]);
      drawCost = performance.now() - d0;
      drawnAt = now;
    }
    prev = p;
    const took = performance.now() - t0;
    work += took;
    if (took > slowest) slowest = took;
  }
  const t0 = performance.now();
  engine.commit(strokeCtx, colorCtx, null);
  const lift = performance.now() - t0;
  colorCtx.clearRect(0, 0, width, height);
  engine.memory.fill(0);
  return { work, slowest, lift };
}
