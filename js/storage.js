// storage.js - saves data inside the browser using IndexedDB.
// IndexedDB is a small database built into every browser. Unlike localStorage, it
// can hold big things like images, and it stays after the app is closed.
//
// "Stores" are like folders inside the database:
//   thumbnails - small preview images for the library cards
//   artwork    - her coloring progress (used from step 7 on)

const DB_NAME = "finleys-coloring-book";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      // Runs the very first time (or when DB_VERSION goes up): create the stores.
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("thumbnails")) db.createObjectStore("thumbnails");
        if (!db.objectStoreNames.contains("artwork")) db.createObjectStore("artwork");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
