// storage.js - saves data inside the browser using IndexedDB.
// IndexedDB is a small database built into every browser. Unlike localStorage, it
// can hold big things like images, and it stays after the app is closed.
//
// "Stores" are like folders inside the database:
//   thumbnails     - small previews of blank pages that have no ready-made thumbnail file
//   artwork        - her coloring for each page: { color (image), memory (build-up), updated }
//   progress       - which pages she has colored and when: { updated }  (small, quick to read)
//   progressThumbs - a small colored preview of each page she has colored (for the library)
//
// Adding a store means raising DB_VERSION; onupgradeneeded then creates the missing ones
// (existing data is kept).

const DB_NAME = "finleys-coloring-book";
const DB_VERSION = 2;
const STORES = ["thumbnails", "artwork", "progress", "progressThumbs"];

let dbPromise = null;

// If the database can't be opened within this time, give up (instead of waiting forever).
// That happens when another tab still has an older version of the app open: the browser won't
// update the database until that tab lets go of it.
const OPEN_TIMEOUT_MS = 4000;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      let gaveUp = false;
      const timer = setTimeout(() => {
        gaveUp = true;
        reject(new Error("The saved-coloring database is busy (another tab may have an older version of the app open)."));
      }, OPEN_TIMEOUT_MS);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      // Runs the very first time (or when DB_VERSION goes up): create any missing stores.
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        if (gaveUp) {
          db.close();
          return;
        }
        // A newer version of the app (in another tab) wants to update the database: let go,
        // so it isn't stuck waiting. We'll reopen it the next time we need it.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
    });
    dbPromise.catch(() => {
      dbPromise = null; // try again next time
    });
  }
  return dbPromise;
}

// Read one item. Resolves to undefined if it isn't there.
export async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save (or replace) one item.
export async function dbPut(store, key, value) {
  return dbPutMany([[store, key, value]]);
}

// Save several items all at once: either all of them are saved, or none are.
// items = [[store, key, value], ...]
export async function dbPutMany(items) {
  const db = await openDB();
  const stores = [...new Set(items.map(([store]) => store))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    for (const [store, key, value] of items) tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Delete several items all at once. items = [[store, key], ...]
export async function dbDeleteMany(items) {
  const db = await openDB();
  const stores = [...new Set(items.map(([store]) => store))];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    for (const [store, key] of items) tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Every item in a store, as a Map of key -> value. (Only use on small stores.)
export async function dbEntries(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const out = new Map();
    const request = db.transaction(store).objectStore(store).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(out);
      out.set(cursor.key, cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

// Restore a backup as one transaction. Reading the current dates inside this transaction
// keeps a newer save in another window from being replaced by an older backup.
export async function dbMergeArtwork(records) {
  if (!records.length) return { added: 0, kept: 0 };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["artwork", "progress", "progressThumbs"], "readwrite");
    let added = 0, kept = 0;
    for (const record of records) {
      const request = tx.objectStore("artwork").get(record.id);
      request.onsuccess = () => {
        if (request.result?.updated >= record.updated) { kept++; return; }
        tx.objectStore("artwork").put({ color: record.color, memory: record.memory, updated: record.updated }, record.id);
        tx.objectStore("progress").put({ updated: record.updated }, record.id);
        if (record.thumb) tx.objectStore("progressThumbs").put(record.thumb, record.id);
        else tx.objectStore("progressThumbs").delete(record.id);
        added++;
      };
    }
    tx.oncomplete = () => resolve({ added, kept });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
