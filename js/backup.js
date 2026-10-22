// backup.js - moves her coloring between Safari and the Home Screen app, or to another device.
// A .finley file has a small contents list followed by the original compressed image blobs.
// This avoids turning hundreds of pictures into a huge text string in the iPad's memory.
import { dbEntries, dbGet, dbMergeArtwork, storedBlob } from "./storage.js?v=20261021211413";
import { SETTINGS } from "./settings.js?v=20261021211413";

const MAGIC = new TextEncoder().encode("FINLEY-COLORING-BACKUP-1\n");
const KEYS = ["brush-settings", "recent-colors", "palettes", "line-lock", "build-up", "extra-brush"];
const describe = blob => blob ? { size: blob.size, type: blob.type } : null;

export async function makeBackup(onProgress = () => {}) {
  const entries = await dbEntries("progress");
  const pages = [], chunks = [];
  for (const [id] of entries) {
    const artwork = await dbGet("artwork", id);
    if (!artwork?.color) throw new Error(`The saved picture for ${id} couldn't be read. Please reopen it before backing up.`);
    const color = storedBlob(artwork.color, "image/png");
    const memory = artwork.memory ? storedBlob(artwork.memory, "application/gzip") : null;
    const savedThumb = await dbGet("progressThumbs", id);
    const thumb = savedThumb ? storedBlob(savedThumb, "image/jpeg") : null;
    pages.push({ id, updated: artwork.updated, color: describe(color), memory: describe(memory), thumb: describe(thumb) });
    chunks.push(color);
    if (memory) chunks.push(memory);
    if (thumb) chunks.push(thumb);
    onProgress(pages.length, entries.size);
  }
  const settings = {};
  for (const key of KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }
  const json = new TextEncoder().encode(JSON.stringify({ format: 1, created: Date.now(), settings, pages }));
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, json.length, true);
  const blob = new Blob([MAGIC, size, json, ...chunks], { type: "application/octet-stream" });
  if (blob.size > SETTINGS.backupMaxFileBytes || pages.length > SETTINGS.backupMaxPages) throw new Error("This coloring collection is too large for a single backup.");
  return { blob, count: pages.length, filename: `finleys-coloring-${new Date().toISOString().slice(0, 10)}.finley` };
}

function invalid() { throw new Error("This file isn't a complete coloring-book backup. Please choose the original .finley file."); }

// Validate the entire file BEFORE writing anything. File.slice() keeps pictures on disk until
// needed. Each compressed payload is copied to bytes before saving: keeping File slices
// in IndexedDB can leave Safari dependent on temporary Files-picker access after reload.
export async function readBackup(file, onProgress = () => {}) {
  if (file.size > SETTINGS.backupMaxFileBytes || file.size < MAGIC.length + 4) invalid();
  const prefix = new Uint8Array(await file.slice(0, MAGIC.length + 4).arrayBuffer());
  if (!MAGIC.every((b, i) => prefix[i] === b)) invalid();
  const length = new DataView(prefix.buffer).getUint32(MAGIC.length, true);
  if (length > SETTINGS.backupMaxHeaderBytes || length < 2 || MAGIC.length + 4 + length > file.size) invalid();
  let data;
  try { data = JSON.parse(await file.slice(MAGIC.length + 4, MAGIC.length + 4 + length).text()); }
  catch { invalid(); }
  if (!data || data.format !== 1 || !Array.isArray(data.pages) || data.pages.length > SETTINGS.backupMaxPages) invalid();
  const records = [], ids = new Set();
  let offset = MAGIC.length + 4 + length;
  const take = async (part, types, required = false) => {
    if (!part) { if (required) invalid(); return null; }
    if (!Number.isSafeInteger(part.size) || part.size <= 0 || part.size > SETTINGS.backupMaxImageBytes || !types.includes(part.type) || offset + part.size > file.size) invalid();
    const bytes = new Uint8Array(await file.slice(offset, offset + part.size).arrayBuffer());
    if (bytes.byteLength !== part.size) invalid();
    offset += part.size;
    return bytes;
  };
  for (const page of data.pages) {
    if (typeof page.id !== "string" || !page.id.length || page.id.length > 200 || /[\x00-\x1f/\\]/.test(page.id) || ids.has(page.id) || !Number.isFinite(page.updated) || page.updated <= 0) invalid();
    ids.add(page.id);
    const color = await take(page.color, ["image/png"], true);
    const memory = await take(page.memory, ["application/gzip", "" ]);
    const thumb = await take(page.thumb, ["image/jpeg", "image/png"]);
    const pixels = await checkPNG(storedBlob(color, "image/png"));
    if (memory && typeof DecompressionStream !== "undefined") {
      const reader = storedBlob(memory, "application/gzip").stream().pipeThrough(new DecompressionStream("gzip")).getReader();
      let count = 0;
      try {
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          count += value.length;
          if (count > pixels * 4) { await reader.cancel(); invalid(); }
        }
      } catch { invalid(); }
      if (count !== pixels * 4) invalid();
    }
    if (thumb) await checkImage(storedBlob(thumb, page.thumb.type), 1024 * 1024);
    records.push({ id: page.id, updated: page.updated, color, memory, thumb });
    onProgress(records.length, data.pages.length);
  }
  if (offset !== file.size) invalid();
  const settings = {};
  for (const key of KEYS) {
    const value = data.settings?.[key];
    if (typeof value === "string" && value.length <= SETTINGS.backupMaxHeaderBytes) settings[key] = value;
  }
  return { records, settings };
}

async function checkPNG(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  if (bytes.length < 24 || ![137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) invalid();
  const view = new DataView(bytes.buffer);
  const w = view.getUint32(16), h = view.getUint32(20);
  if (!w || !h || w * h > SETTINGS.backupMaxPixels) invalid();
  await checkImage(blob, SETTINGS.backupMaxPixels);
  return w * h;
}

async function checkImage(blob, limit) {
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > limit) invalid();
  } catch { invalid(); }
  finally { image.src = ""; URL.revokeObjectURL(url); }
}

export async function restoreBackup(backup) {
  const result = await dbMergeArtwork(backup.records);
  // Read the bytes back before saying "restored". This catches a storage failure while
  // the backup is still selected, and never mistakes an unreadable picture for success.
  for (const record of backup.records) {
    const saved = await dbGet("artwork", record.id);
    if (saved?.updated > record.updated) continue; // a newer save was deliberately kept
    const thumb = await dbGet("progressThumbs", record.id);
    for (const [actual, expected, type] of [[saved?.color, record.color, "image/png"], [saved?.memory, record.memory, "application/gzip"], [thumb, record.thumb, "image/jpeg"]]) {
      if (!expected) continue;
      const bytes = new Uint8Array(await storedBlob(actual, type).arrayBuffer());
      if (bytes.length !== expected.length || !bytes.every((b, i) => b === expected[i])) {
        throw new Error("The restored copy couldn't be verified. Keep your backup file and try Restore backup again. The original backup file is unchanged.");
      }
    }
  }
  // Restoring settings is optional; a storage restriction mustn't undo restored pictures.
  let settingsSaved = true;
  try { for (const [key, value] of Object.entries(backup.settings)) localStorage.setItem(key, value); }
  catch { settingsSaved = false; }
  navigator.storage?.persist?.().catch(() => {});
  return { ...result, settingsSaved };
}
