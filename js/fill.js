// fill.js - tap-to-fill. The heavy work happens in fill-worker.js (in the background);
// this file sends it the page and the taps, and paints the result.

import { SETTINGS } from "./settings.js?v=202610182317";

let worker = null;
let nextId = 1;
const waiting = new Map(); // message id -> function to call with the answer

function ask(message, transfer = []) {
  if (!worker) {
    worker = new Worker("js/fill-worker.js?v=202610182317");
    worker.onmessage = (event) => {
      const done = waiting.get(event.data.id);
      waiting.delete(event.data.id);
      if (done) done(event.data);
    };
  }
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    worker.postMessage({ ...message, id }, transfer);
  });
}

// Call once when a page opens. `darkness` has one number per pixel (0 = paper, 255 = black line).
export function prepareFill(darkness, width, height) {
  return ask({ type: "prepare", width, height, darkness, speckSize: SETTINGS.ignoreSpecks }, [darkness.buffer]);
}

// Works out the area to fill around page point (x, y). A tap right on a line uses the
// nearest open spot up to `reach` page pixels away.
// Answers { empty: true } if there's nothing to fill, otherwise the box { x, y, w, h }
// and a mask with a 1 for every pixel in the box to color.
export function findFillArea(x, y, reach) {
  return ask({
    type: "fill", x, y, reach,
    gap: SETTINGS.gapClosing,
    under: SETTINGS.fillUnderLines,
    thinMax: SETTINGS.thinPatchLimit,
    thinWidth: SETTINGS.thinPatchWidth,
  });
}

// Works out (and remembers) the areas at these page points ahead of time, while she isn't
// waiting. Used right after a page opens for the points along the edges, which are usually
// in the background - the biggest, slowest area.
export function warmUp(points) {
  return ask({
    type: "warm", points, reach: 0,
    gap: SETTINGS.gapClosing,
    under: SETTINGS.fillUnderLines,
    thinMax: SETTINGS.thinPatchLimit,
    thinWidth: SETTINGS.thinPatchWidth,
  });
}

// Paints the area onto the color layer in `color` ({ r, g, b }).
export function paintFill(ctx, area, color) {
  const image = ctx.getImageData(area.x, area.y, area.w, area.h);
  const px = image.data;
  const mask = area.mask;
  for (let k = 0; k < mask.length; k++) {
    if (!mask[k]) continue;
    const p = k * 4;
    px[p] = color.r;
    px[p + 1] = color.g;
    px[p + 2] = color.b;
    px[p + 3] = 255;
  }
  ctx.putImageData(image, area.x, area.y);
}
