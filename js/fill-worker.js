// fill-worker.js - does the heavy work for tap-to-fill in the background (a "web worker"),
// so the app never freezes while it runs. fill.js talks to it with messages.
//
// When a page opens ("prepare"), it builds two maps of the page:
//   lines - 1 for every pixel that is part of a line, 0 for paper
//   dist  - for every pixel, how far it is from the nearest line (used to close gaps)
// Then for each tap ("fill"), it works out which pixels to color and sends them back.

let W = 0;
let H = 0;
let lines = null;  // Uint8Array, one entry per pixel
let dist = null;   // Uint16Array, distance to the nearest line x3 (so 3 = one pixel)
let filled = null; // Uint8Array, scratch space marking the pixels of the current fill
let queue = null;  // Int32Array, a to-do list of pixels while a fill spreads
let count = 0;     // how many pixels the current fill has

const LINE_CUTOFF = 128; // pixels darker than middle grey count as line

onmessage = (event) => {
  const msg = event.data;
  if (msg.type === "prepare") {
    const started = performance.now();
    prepare(msg);
    postMessage({ id: msg.id, ms: Math.round(performance.now() - started) });
  } else if (msg.type === "fill") {
    const started = performance.now();
    const result = fill(msg);
    result.ms = Math.round(performance.now() - started);
    result.id = msg.id;
    postMessage(result, result.mask ? [result.mask.buffer] : []);
  }
};

// ------------------------------------------------------------------ prepare --

function prepare({ width, height, darkness, speckSize }) {
  W = width;
  H = height;
  lines = new Uint8Array(W * H);
  for (let i = 0; i < lines.length; i++) lines[i] = darkness[i] >= LINE_CUTOFF ? 1 : 0;
  removeSpecks(speckSize);
  dist = distanceFromLines();
  filled = new Uint8Array(W * H);
  queue = new Int32Array(W * H);
}

// Removes groups of line pixels smaller than maxArea (stray dots), so they don't block fills.
// It looks at each row as "runs" of line pixels, joins runs that touch the row above
// (corners count), and adds up how big each joined group is.
function removeSpecks(maxArea) {
  if (!(maxArea > 0)) return;
  const starts = [];
  const ends = [];
  const rowFirst = new Int32Array(H + 1);
  for (let y = 0; y < H; y++) {
    rowFirst[y] = starts.length;
    const row = y * W;
    let x = 0;
    while (x < W) {
      if (lines[row + x]) {
        const s = x;
        while (x < W && lines[row + x]) x++;
        starts.push(s);
        ends.push(x);
      } else {
        x++;
      }
    }
  }
  rowFirst[H] = starts.length;

  const n = starts.length;
  const parent = new Int32Array(n);
  for (let k = 0; k < n; k++) parent[k] = k;
  const root = (k) => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k]];
      k = parent[k];
    }
    return k;
  };

  for (let y = 1; y < H; y++) {
    let i = rowFirst[y - 1];
    const iEnd = rowFirst[y];
    let j = rowFirst[y];
    const jEnd = rowFirst[y + 1];
    while (i < iEnd && j < jEnd) {
      if (starts[i] <= ends[j] && starts[j] <= ends[i]) {
        const a = root(i);
        const b = root(j);
        if (a !== b) parent[a] = b;
      }
      if (ends[i] < ends[j]) i++;
      else j++;
    }
  }

  const area = new Int32Array(n);
  for (let k = 0; k < n; k++) area[root(k)] += ends[k] - starts[k];
  for (let y = 0; y < H; y++) {
    for (let k = rowFirst[y]; k < rowFirst[y + 1]; k++) {
      if (area[root(k)] < maxArea) lines.fill(0, y * W + starts[k], y * W + ends[k]);
    }
  }
}

// For every pixel: roughly how far it is from the nearest line pixel, times 3.
// (A quick two-pass method: straight steps cost 3, diagonal steps cost 4.)
function distanceFromLines() {
  const d = new Uint16Array(W * H);
  const FAR = 65535;
  for (let i = 0; i < d.length; i++) d[i] = lines[i] ? 0 : FAR;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0 && d[i - 1] + 3 < v) v = d[i - 1] + 3;
      if (y > 0) {
        const up = i - W;
        if (d[up] + 3 < v) v = d[up] + 3;
        if (x > 0 && d[up - 1] + 4 < v) v = d[up - 1] + 4;
        if (x < W - 1 && d[up + 1] + 4 < v) v = d[up + 1] + 4;
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < W - 1 && d[i + 1] + 3 < v) v = d[i + 1] + 3;
      if (y < H - 1) {
        const down = i + W;
        if (d[down] + 3 < v) v = d[down] + 3;
        if (x < W - 1 && d[down + 1] + 4 < v) v = d[down + 1] + 4;
        if (x > 0 && d[down - 1] + 4 < v) v = d[down - 1] + 4;
      }
      d[i] = v;
    }
  }
  return d;
}

// --------------------------------------------------------------------- fill --

let minX, minY, maxX, maxY; // the box around the current fill

function fill({ x, y, gap, under, reach, thinMax, thinWidth }) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (!lines || x < 0 || y < 0 || x >= W || y >= H) return { empty: true };
  let start = y * W + x;
  // Tapped right on a line? Use the nearest paper pixel within `reach` pixels instead.
  if (lines[start]) start = nearestPaper(x, y, Math.floor(reach || 0));
  if (start < 0) return { empty: true };
  x = start % W;
  y = (start / W) | 0;

  // Gap closing treats every line as `gap` pixels thicker on each side. A tap close to a
  // line lands inside that thickening, so step a few pixels further into the same area
  // (without crossing a line) to start from. Only if the spot is truly narrower than the
  // thickening, use a smaller gap so it can still be filled.
  let g = Math.max(0, Math.floor(gap));
  if (g > 0 && dist[start] <= g * 3) {
    const open = nearestOpen(start, g * 3, 2 * g + 2);
    if (open >= 0) start = open;
  }
  while (g > 0 && dist[start] <= g * 3) g--;
  const limit = g * 3;
  x = start % W;
  y = (start / W) | 0;

  filled.fill(0);
  count = 0;
  minX = maxX = x;
  minY = maxY = y;

  // 1. Flood fill everything reachable from the tap without touching the thickened lines.
  floodFill(start, limit);
  // 2. Grow back out to the real lines (the thickening pulled the color away from them).
  if (g > 0) {
    growTowardLines(limit);
    widenBox(limit + 4); // it can only have moved this far past the box
    // 2b. Fill thin strips of this same area that the thickened lines cut off.
    fillThinLeftovers(Math.max(limit, Math.floor(thinWidth || 0) * 3), thinMax);
  }
  // 3. Reach a little under the lines, so no white rim shows at their soft edges.
  if (under > 0) {
    growIntoLines(Math.floor(under));
    widenBox(Math.floor(under));
  }
  // 4. Single white pixels boxed in on all four sides by this fill belong to it too.
  fillPinholes();

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const mask = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    const from = (minY + row) * W + minX;
    mask.set(filled.subarray(from, from + w), row * w);
  }
  return { x: minX, y: minY, w, h, mask, count, gapUsed: g };
}

// The closest non-line pixel to (x, y), at most `reach` pixels away, or -1 if there is none.
function nearestPaper(x, y, reach) {
  let best = -1;
  let bestDist = Infinity;
  for (let dy = -reach; dy <= reach; dy++) {
    const ny = y + dy;
    if (ny < 0 || ny >= H) continue;
    for (let dx = -reach; dx <= reach; dx++) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      const d = dx * dx + dy * dy;
      if (d < bestDist && d <= reach * reach && !lines[ny * W + nx]) {
        best = ny * W + nx;
        bestDist = d;
      }
    }
  }
  return best;
}

// Walks outward from `start` through paper pixels only (never across a line), up to
// `maxSteps` steps, and returns the first pixel farther than `limit` from every line,
// or -1 if there's none (the tap is in a truly narrow spot).
function nearestOpen(start, limit, maxSteps) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let s = 0; s < maxSteps && frontier.length; s++) {
    const next = [];
    for (const i of frontier) {
      const x = i % W;
      const y = (i / W) | 0;
      const around = [];
      if (x > 0) around.push(i - 1);
      if (x < W - 1) around.push(i + 1);
      if (y > 0) around.push(i - W);
      if (y < H - 1) around.push(i + W);
      for (const j of around) {
        if (seen.has(j) || lines[j]) continue;
        if (dist[j] > limit) return j;
        seen.add(j);
        next.push(j);
      }
    }
    frontier = next;
  }
  return -1;
}

// Classic "scanline" flood fill: fill a whole horizontal stretch at once, then look
// for open stretches in the rows above and below.
function floodFill(start, limit) {
  let stack = new Int32Array(4096);
  let top = 0;
  stack[top++] = start;
  const open = (i) => filled[i] === 0 && dist[i] > limit;

  while (top > 0) {
    const i = stack[--top];
    if (!open(i)) continue;
    const y = (i / W) | 0;
    const rowStart = y * W;
    let left = i;
    let right = i;
    while (left > rowStart && open(left - 1)) left--;
    while (right < rowStart + W - 1 && open(right + 1)) right++;
    filled.fill(1, left, right + 1);
    count += right - left + 1;
    if (left - rowStart < minX) minX = left - rowStart;
    if (right - rowStart > maxX) maxX = right - rowStart;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    for (const step of [-W, W]) {
      const ny = y + (step > 0 ? 1 : -1);
      if (ny < 0 || ny >= H) continue;
      let inStretch = false;
      for (let k = left + step; k <= right + step; k++) {
        if (open(k)) {
          if (!inStretch) {
            if (top >= stack.length) {
              const bigger = new Int32Array(stack.length * 2);
              bigger.set(stack);
              stack = bigger;
            }
            stack[top++] = k;
            inStretch = true;
          }
        } else {
          inStretch = false;
        }
      }
    }
  }
}

// After gap closing, the fill stops a few pixels short of the real lines. This spreads
// it the rest of the way by only ever moving "downhill" - to a pixel that is closer to a
// line than the one it came from. On her side of a line every paper pixel can be reached
// that way. Inside a gap, "downhill" ends halfway across (from there on, pixels get
// farther from the lines again), so the color stops in the middle of the gap instead of
// leaking into the next area.
function growTowardLines(limit) {
  // Start from every filled pixel close to the band the thickening left empty.
  // (Neighboring pixels differ by at most 4 in distance, so farther ones can't help.)
  let tail = seedQueue(limit + 4);
  let head = 0;
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    const x = i % W;
    const left = x > 0;
    const right = x < W - 1;
    const up = i >= W;
    const down = i < W * (H - 1);
    if (left) tail = stepDownhill(i - 1, d, tail);
    if (right) tail = stepDownhill(i + 1, d, tail);
    if (up) {
      tail = stepDownhill(i - W, d, tail);
      if (left) tail = stepDownhill(i - W - 1, d, tail);
      if (right) tail = stepDownhill(i - W + 1, d, tail);
    }
    if (down) {
      tail = stepDownhill(i + W, d, tail);
      if (left) tail = stepDownhill(i + W - 1, d, tail);
      if (right) tail = stepDownhill(i + W + 1, d, tail);
    }
  }
}

function stepDownhill(j, d, tail) {
  if (filled[j] === 0 && lines[j] === 0 && dist[j] < d) {
    filled[j] = 1;
    count++;
    queue[tail++] = j;
  }
  return tail;
}

// Gap closing cuts off thin parts of an area: wedges where a vein meets the outline,
// strips between lines that run close together, the tight curves of a ruffled edge.
// Their middles are all the same distance from the lines, so growTowardLines can't
// walk into them. This finds every white patch touching the fill and decides:
//   - thin everywhere (no pixel farther than `thinLimit` from a line): a sliver of this
//     same area -> fill it
//   - wider somewhere: another area (another petal, the background...) reached through a
//     real gap -> leave it alone
// Patches bigger than `maxArea` pixels are also left alone, to be safe.
function fillThinLeftovers(thinLimit, maxArea) {
  const limit = thinLimit;
  if (!(maxArea > 0)) return;
  const PATCH = 2;    // being explored
  const REJECTED = 3; // explored, not part of this area (reset to 0 at the end)
  const x0 = minX, x1 = maxX, y0 = minY, y1 = maxY;
  let rx0 = W, ry0 = H, rx1 = -1, ry1 = -1; // box around rejected patches

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const s = y * W + x;
      if (filled[s] !== 0 || lines[s] || dist[s] > limit) continue;
      const touchesFill = (x > 0 && filled[s - 1] === 1) || (x < W - 1 && filled[s + 1] === 1) ||
                          (y > 0 && filled[s - W] === 1) || (y < H - 1 && filled[s + W] === 1);
      if (!touchesFill) continue;

      // Explore the white patch (up, down, left, right; never across a line).
      let head = 0;
      let tail = 0;
      let thin = true;
      queue[tail++] = s;
      filled[s] = PATCH;
      explore: while (head < tail) {
        const i = queue[head++];
        if (dist[i] > limit || tail > maxArea) {
          thin = false;
          break;
        }
        const ix = i % W;
        for (let k = 0; k < 4; k++) {
          let j;
          if (k === 0) { if (ix === 0) continue; j = i - 1; }
          else if (k === 1) { if (ix === W - 1) continue; j = i + 1; }
          else if (k === 2) { if (i < W) continue; j = i - W; }
          else { if (i >= W * (H - 1)) continue; j = i + W; }
          if (filled[j] === REJECTED) {
            thin = false; // joins a patch already found to lead somewhere else
            break explore;
          }
          if (filled[j] === 0 && !lines[j]) {
            filled[j] = PATCH;
            queue[tail++] = j;
          }
        }
      }

      const mark = thin ? 1 : REJECTED;
      for (let k = 0; k < tail; k++) {
        const i = queue[k];
        filled[i] = mark;
        const px = i % W;
        const py = (i / W) | 0;
        if (thin) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        } else {
          if (px < rx0) rx0 = px;
          if (px > rx1) rx1 = px;
          if (py < ry0) ry0 = py;
          if (py > ry1) ry1 = py;
        }
      }
      if (thin) count += tail;
    }
  }

  // Clean up the "rejected" marks so the next fill starts fresh.
  for (let y = ry0; y <= ry1; y++) {
    for (let i = y * W + rx0, end = y * W + rx1; i <= end; i++) {
      if (filled[i] === REJECTED) filled[i] = 0;
    }
  }
}

// Spreads the fill `steps` pixels into the lines themselves (never across them: lines are
// at least 3 pixels wide on imported pages, and the lines are drawn on top anyway).
function growIntoLines(steps) {
  let tail = seedQueue(3); // only pixels right next to a line can step into it
  let head = 0;
  for (let s = 0; s < steps; s++) {
    const levelEnd = tail;
    while (head < levelEnd) {
      const i = queue[head++];
      const x = i % W;
      if (x > 0) tail = stepIntoLine(i - 1, tail);
      if (x < W - 1) tail = stepIntoLine(i + 1, tail);
      if (i >= W) tail = stepIntoLine(i - W, tail);
      if (i < W * (H - 1)) tail = stepIntoLine(i + W, tail);
    }
  }
}

function stepIntoLine(j, tail) {
  if (filled[j] === 0 && lines[j] === 1) {
    filled[j] = 1;
    count++;
    queue[tail++] = j;
  }
  return tail;
}

// A single white pixel walled in on all four sides by this fill or by lines (often a tiny
// notch in a line's soft edge) belongs to this fill: a single pixel can't lead anywhere.
function fillPinholes() {
  const shut = (j) => filled[j] === 1 || lines[j] === 1;
  for (let y = Math.max(minY, 1); y <= Math.min(maxY, H - 2); y++) {
    for (let x = Math.max(minX, 1); x <= Math.min(maxX, W - 2); x++) {
      const i = y * W + x;
      if (filled[i] !== 0 || lines[i]) continue;
      if (!(shut(i - 1) && shut(i + 1) && shut(i - W) && shut(i + W))) continue;
      const touchesFill = filled[i - 1] === 1 || filled[i + 1] === 1 || filled[i - W] === 1 || filled[i + W] === 1 ||
                          filled[i - W - 1] === 1 || filled[i - W + 1] === 1 || filled[i + W - 1] === 1 || filled[i + W + 1] === 1;
      if (touchesFill) {
        filled[i] = 1;
        count++;
      }
    }
  }
}

// Puts every filled pixel within `nearLines` of a line into the work queue.
function seedQueue(nearLines) {
  let tail = 0;
  for (let y = minY; y <= maxY; y++) {
    const end = y * W + maxX;
    for (let i = y * W + minX; i <= end; i++) {
      if (filled[i] && dist[i] <= nearLines) queue[tail++] = i;
    }
  }
  return tail;
}

// Makes the box around the fill `by` pixels bigger on every side (staying on the page).
function widenBox(by) {
  minX = Math.max(0, minX - by);
  minY = Math.max(0, minY - by);
  maxX = Math.min(W - 1, maxX + by);
  maxY = Math.min(H - 1, maxY + by);
}
