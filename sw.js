// sw.js - keeps the app and downloaded outlines available without Wi-Fi.
// This helper runs separately from drawing. It never opens or deletes her artwork database.
const VERSION = "20261022011129";
importScripts("./offline-assets.js?v=20261022011129");
const ASSETS = self.FINLEY_OFFLINE;
if (ASSETS.version !== VERSION) throw new Error("The offline files belong to different updates.");
const ROOT = self.registration.scope;
const PREFIX = `finley-coloring-${encodeURIComponent(new URL(ROOT).pathname)}-`;
const SHELL = `${PREFIX}app-${VERSION}`;
const PAGES = `${PREFIX}pages`;
const revisions = new Map(ASSETS.pages.map(p => [new URL(p.url, ROOT).href, p.hash]));
const working = new Map();

const absolute = path => new URL(path, ROOT).href;
const pageKey = (url, hash) => { const key = new URL(url); key.search = `art=${hash}`; return key.href; };

async function checkedFetch(url, hash) {
  const response = await fetch(url, { cache: "reload" });
  if (!response.ok || response.type === "opaque") throw new Error("This file couldn't be downloaded.");
  // Windows checkouts and GitHub can use different line endings for the same text.
  const text = /\.(?:html|css|js|svg|webmanifest|txt)$/i.test(new URL(url).pathname);
  const bytes = text ? new TextEncoder().encode((await response.clone().text()).replace(/\r\n/g, "\n")) : await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  if (actual !== hash) throw new Error("The website is still updating. Please try again shortly.");
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      // Small batches keep hundreds of thumbnails from downloading all at once.
      for (let i = 0; i < ASSETS.shell.length; i += 6) {
        const results = await Promise.allSettled(ASSETS.shell.slice(i, i + 6).map(async asset => {
          const url = absolute(asset.url);
          await cache.put(url, await checkedFetch(url, asset.hash));
        }));
        const failed = results.find(result => result.status === "rejected");
        if (failed) throw failed.reason;
      }
    } catch (error) {
      // An incomplete update must never replace the working offline app.
      await caches.delete(SHELL);
      throw error;
    }
    // An update waits here while the current app is open. No mid-stroke replacement.
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const oldApps = names.filter(n => n.startsWith(`${PREFIX}app-`) && n !== SHELL).sort().reverse();
    // Keep one previous app bundle for exact old file references during the handover.
    await Promise.all(oldApps.slice(1).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function savedPage(url) {
  const hash = revisions.get(url);
  if (!hash) throw new Error("This outline isn't in this version of the book.");
  const cache = await caches.open(PAGES), key = pageKey(url, hash);
  const saved = await cache.match(key);
  if (saved) return saved;
  if (working.has(key)) return (await working.get(key)).clone();
  const job = (async () => {
    const shell = await caches.open(SHELL);
    const existing = await shell.match(url); // tiny SVG placeholder/cover already installed
    const response = existing || await checkedFetch(key, hash);
    await cache.put(key, response.clone());
    return response;
  })();
  working.set(key, job);
  try { return (await job).clone(); } finally { working.delete(key); }
}

self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || !request.url.startsWith(ROOT)) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => (await (await caches.open(SHELL)).match(absolute("index.html"))) || fetch(request))());
    return;
  }
  const plain = new URL(url); plain.search = ""; plain.hash = "";
  if (revisions.has(plain.href)) {
    event.respondWith(savedPage(plain.href).catch(async () => {
      // Full offline storage mustn't prevent opening a page while online.
      try { return await fetch(request); }
      catch { return new Response("Open this page online once to save it offline.", {status:503, headers:{"Cache-Control":"no-store"}}); }
    }));
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const current = await cache.match(request);
    if (current) return current;
    // Exact matches only: never give old JavaScript a different version under the same name.
    const names = await caches.keys();
    for (const name of names.filter(n => n.startsWith(`${PREFIX}app-`) && n !== SHELL)) {
      const previous = await (await caches.open(name)).match(request);
      if (previous) return previous;
    }
    return fetch(request);
  })());
});

async function status() {
  const pages = await caches.open(PAGES), shell = await caches.open(SHELL);
  const available = [];
  for (const [url, hash] of revisions) {
    if (await pages.match(pageKey(url, hash)) || await shell.match(url)) available.push(new URL(url).pathname);
  }
  return { version: VERSION, available };
}

self.addEventListener("message", event => {
  if (!event.ports[0] || !event.source?.url?.startsWith(ROOT)) return;
  const port = event.ports[0], message = event.data || {};
  const reply = data => port.postMessage({ done: true, ...data });
  event.waitUntil((async () => {
    try {
      if (message.type === "STATUS") return reply(await status());
      if (message.type === "ACTIVATE") {
        const windows = (await self.clients.matchAll({type:"window", includeUncontrolled:true})).filter(c => c.url.startsWith(ROOT));
        if (windows.length !== 1 || windows[0].id !== event.source.id) {
          return reply({ error: "Close the other coloring-book windows, then try Update again." });
        }
        reply({ activating: true });
        await self.skipWaiting();
        return;
      }
      if (message.type === "DOWNLOAD") {
        const files = [...new Set(message.files || [])];
        let completed = 0, failed = 0, stop = false, reason = "";
        // Two files at a time. Successful pages remain saved if Wi-Fi drops or storage fills.
        for (let i = 0; i < files.length && !stop; i += 2) {
          await Promise.all(files.slice(i, i + 2).map(async file => {
            try { await savedPage(absolute(file)); completed++; }
            catch (error) {
              failed++; reason = error.name === "QuotaExceededError" ? "There isn't enough free storage for more pages." : error.message;
              if (error.name === "QuotaExceededError" || error instanceof TypeError) stop = true;
            }
            port.postMessage({done:false, completed, failed, total:files.length});
          }));
        }
        reply({ completed, failed:files.length - completed, reason, ...(await status()) });
        return;
      }
      reply({error:"Unknown offline request."});
    } catch (error) { reply({error:error.message || "Offline storage isn't available right now."}); }
  })());
});
