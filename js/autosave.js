// autosave.js - keeps her coloring safe: saves each page she colors, loads it back when she
// opens the page again, and gives the library a small colored preview of each page.
//
// What's saved for a page (in the IndexedDB store "artwork", under the page's id):
//   color   - the color layer as a PNG image (lossless, so nothing changes when reloaded)
//   memory  - the "Build up color" paint memory, squeezed with gzip (it's mostly empty, so it
//             shrinks from ~22 MB to a few hundred KB). Older browsers without gzip skip it.
//   updated - when it was saved
// Plus a small colored preview (store "progressThumbs") and the save time (store "progress").

import { dbGet, dbPutMany, dbDeleteMany, dbEntries, storedBlob } from "./storage.js?v=20261022001928";

const THUMB_W = 420; // same size as the ready-made library thumbnails
const THUMB_H = 560;

const previewURLs = new Map(); // page id -> URL of its colored preview (for this visit)
let previewPending = Promise.resolve(); // the newest preview being made
let progressTimes = null;      // page id -> when it was last saved (loaded once)
let persistAsked = false;

// ---------- Saving ----------

// Saves a page. colorCanvas = her colors, lineCanvas = the black lines (for the preview),
// memory = the stroke engine's paint memory. Resolves when it's safely stored.
export async function saveArtwork(id, colorCanvas, lineCanvas, memory) {
  const updated = Date.now();

  // Take all the snapshots right now, before waiting for anything: toBlob copies a canvas
  // the moment it's called, so leaving the page or drawing on can't change what's saved.
  const thumbPromise = toBlob(makePreviewCanvas(colorCanvas, lineCanvas), "image/jpeg", 0.88);
  const colorPromise = toBlob(colorCanvas, "image/png");
  const memoryCopy = memory.slice();

  // The small preview is ready first, so the library can show it right away.
  previewPending = thumbPromise.then((blob) => rememberPreview(id, blob, updated)).catch(() => {});
  const thumbBlob = await thumbPromise;
  const colorBlob = await colorPromise;
  const memoryBlob = await squeeze(memoryCopy);

  await dbPutMany([
    ["artwork", id, { color: colorBlob, memory: memoryBlob, updated }],
    ["progress", id, { updated }],
    ["progressThumbs", id, thumbBlob],
  ]);
  askToKeepData();
  return { colorBytes: colorBlob.size, memoryBytes: memoryBlob ? memoryBlob.size : 0, previewBytes: thumbBlob.size };
}

// "Start over": removes a page's saved coloring and its library preview, so the page is
// blank again everywhere.
export async function forgetArtwork(id) {
  const old = previewURLs.get(id);
  if (old) URL.revokeObjectURL(old);
  previewURLs.delete(id);
  if (progressTimes) progressTimes.delete(id);
  await dbDeleteMany([["artwork", id], ["progress", id], ["progressThumbs", id]]);
}

// ---------- Loading ----------

// Draws a saved page back onto colorCanvas and fills `memory` again.
// Resolves to true if there was something saved, false if the page is still blank.
// Throws if the saved coloring couldn't be read (so the page won't be saved over it).
export async function loadArtwork(id, colorCtx, memory) {
  const saved = await dbGet("artwork", id);
  if (!saved || !saved.color) return false;
  let image;
  try { image = await blobToImage(storedBlob(saved.color, "image/png")); }
  catch (cause) {
    const error = new Error("The saved coloring image couldn't be read.");
    error.code = "saved-image";
    error.cause = cause;
    throw error;
  }
  colorCtx.drawImage(image, 0, 0);
  image.close?.();
  if (saved.memory) {
    try {
      const bytes = await unsqueeze(storedBlob(saved.memory, "application/gzip"));
      if (bytes.length === memory.length) memory.set(bytes);
    } catch {
      // can't read it back: build-up just starts fresh for this page
    }
  }
  return true;
}

// ---------- Previews for the library ----------

// Waits until the preview of the page she just left is ready (a few milliseconds), so the
// library shows her newest strokes.
export function previewsReady() {
  return previewPending;
}

// URL of the colored preview of a page, or null if she hasn't colored it yet.
export async function getPreviewURL(id) {
  if (previewURLs.has(id)) return previewURLs.get(id);
  const times = await getProgressTimes();
  if (!times.has(id)) return null;
  const blob = await dbGet("progressThumbs", id).catch(() => undefined);
  if (!blob) return null;
  const url = URL.createObjectURL(storedBlob(blob, "image/jpeg"));
  previewURLs.set(id, url);
  return url;
}

// page id -> time it was last saved, for every page she has colored.
export async function getProgressTimes() {
  if (!progressTimes) {
    try {
      const times = new Map();
      for (const [id, info] of await dbEntries("progress")) times.set(id, info.updated);
      progressTimes = times;
    } catch {
      return new Map(); // storage unavailable right now: show blank pages, try again next time
    }
  }
  return progressTimes;
}

function rememberPreview(id, blob, updated) {
  const old = previewURLs.get(id);
  if (old) URL.revokeObjectURL(old);
  previewURLs.set(id, URL.createObjectURL(blob));
  if (progressTimes) progressTimes.set(id, updated);
}

function makePreviewCanvas(colorCanvas, lineCanvas) {
  const scale = Math.min(THUMB_W / colorCanvas.width, THUMB_H / colorCanvas.height);
  const c = document.createElement("canvas");
  c.width = Math.round(colorCanvas.width * scale);
  c.height = Math.round(colorCanvas.height * scale);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(colorCanvas, 0, 0, c.width, c.height);
  ctx.drawImage(lineCanvas, 0, 0, c.width, c.height);
  return c;
}

// ---------- Helpers ----------

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't save the picture"))), type, quality);
  });
}

async function blobToImage(blob) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob); }
    catch { /* Safari can fail here even when the ordinary image decoder works. */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function squeeze(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

async function unsqueeze(blob) {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Asks the browser to keep the saved coloring even when space runs low (Safari decides;
// it's most likely to agree once the app is on the Home Screen).
function askToKeepData() {
  if (persistAsked) return;
  persistAsked = true;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
