// Each blank sheet has its own permanent id. The small contents list lives in
// IndexedDB; the existing auto-save keeps the actual drawing separately.
import { dbEntries, dbPut } from './storage.js?v=20261022011129';
import { SETTINGS } from './settings.js?v=20261022011129';

export const BLANK_PAPER = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SETTINGS.sketchWidth}" height="${SETTINGS.sketchHeight}"><rect width="100%" height="100%" fill="white"/></svg>`
);

// Also used when checking a backup. Never trust a file's list without checking it.
export function validSketch(sheet) {
  return sheet && typeof sheet.id === 'string' && /^sketch-[a-f0-9]{32}$/.test(sheet.id) &&
    typeof sheet.title === 'string' && sheet.title.trim().length > 0 && sheet.title.length <= 80 &&
    Number.isSafeInteger(sheet.number) && sheet.number > 0 &&
    Number.isFinite(sheet.created) && sheet.created > 0;
}

export async function readSketches() {
  const sheets = [];
  for (const [id, sheet] of await dbEntries('sketchbook')) {
    if (!validSketch(sheet) || sheet.id !== id) throw new Error("The sketchbook contents couldn't be read. Keep your backup and try reopening the app.");
    sheets.push(sheet);
  }
  return sheets.sort((a, b) => b.created - a.created || b.id.localeCompare(a.id));
}

export async function saveNewSketch() {
  // Read fresh so another open window's sheets are included when numbering this one.
  const existing = await readSketches();
  const number = Math.max(0, ...existing.map(sheet => sheet.number)) + 1;
  const random = crypto.getRandomValues(new Uint8Array(16));
  const id = 'sketch-' + Array.from(random, n => n.toString(16).padStart(2, '0')).join('');
  const sheet = { id, number, title: `Sketch ${number}`, created: Date.now() };
  // Finish saving the entry BEFORE opening the paper. Even an empty sheet survives closing.
  await dbPut('sketchbook', id, sheet);
  return sheet;
}
