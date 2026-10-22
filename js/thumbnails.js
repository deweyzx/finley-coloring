// thumbnails.js - small preview pictures for the library, for pages WITHOUT a ready-made
// thumbnail file (SVG pages, or pages added by hand without running the import tool).
//
// Full pages are big (about 2048 x 2732 pixels). Showing hundreds of those in a grid
// would make the iPad slow and run out of memory. So the first time a page's card
// appears on screen, we load the full page ONCE, shrink it to a small picture, and
// save that in the database. After that, only the small picture is ever loaded.

import { loadImage } from "./lineart.js?v=20261022001928";
import { dbGet, dbPut } from "./storage.js?v=20261022001928";

const THUMB_WIDTH = 480; // pixels; sharp enough for the cards on an iPad screen

const ready = new Map(); // file -> Promise of a URL the <img> can show (for this session)
let queue = Promise.resolve(); // makes thumbnails one at a time, to keep memory low

export function getThumbnailURL(file) {
  if (!ready.has(file)) ready.set(file, findOrMake(file));
  return ready.get(file);
}

async function findOrMake(file) {
  let blob = await dbGet("thumbnails", file).catch(() => undefined);
  if (!blob) {
    // Wait for our turn in the queue, then make it.
    const job = queue.then(() => makeThumbnail(file));
    queue = job.catch(() => {});
    blob = await job;
    dbPut("thumbnails", file, blob).catch(() => {}); // if saving fails, we just make it again next time
  }
  return URL.createObjectURL(blob);
}

async function makeThumbnail(file) {
  const img = await loadImage(file);
  const scale = THUMB_WIDTH / img.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // white behind see-through PNGs
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Thumbnail failed"))), "image/png");
  });
}
