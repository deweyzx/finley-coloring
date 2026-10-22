// offline.js - Home Screen help, offline downloads, updates and moving her saved coloring.
// The separate service worker keeps downloaded files; IndexedDB still keeps her artwork.
import { categories, findPage } from "./library.js?v=20261021235410";
import { SETTINGS } from "./settings.js?v=20261021235410";
import { makeBackup, readBackup, restoreBackup } from "./backup.js?v=20261021235410";
import { askConfirm } from "./dialogs.js?v=20261021235410";
import { openModal, closeModal } from './modal.js?v=20261021235410';

const pages = categories.flatMap(c => c.subcategories.flatMap(s => s.pages));
let registration = null, panel = null, busy = false, installPrompt = null;
let backupURL = null, prepare, libraryVisible;
let restored = false;
const opened = new Set();
const currentWorker = () => registration?.active || navigator.serviceWorker?.controller;
const $ = id => panel.querySelector(`#${id}`);
export const offlineBusy = () => busy;

function request(worker, message, onProgress) {
  if (!worker) return Promise.reject(new Error("Offline setup isn't ready yet. Please try again in a moment."));
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timer;
    const finish = (error, result) => {
      clearTimeout(timer); channel.port1.close();
      if (error) reject(error); else resolve(result);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error("The download paused. Keep this window open and try again; pages already saved are kept.")),
        message.type === "DOWNLOAD" ? SETTINGS.offlineDownloadReplyMs : SETTINGS.offlineReplyMs);
    };
    channel.port1.onmessage = ({data}) => {
      if (data.done) finish(data.error ? new Error(data.error) : null, data);
      else { arm(); onProgress?.(data); }
    };
    arm();
    worker.postMessage(message, [channel.port2]);
  });
}

// A page can finish loading before the very first offline setup finishes. Remember it,
// then save its outline as soon as the helper is ready. Caching errors never stop coloring.
export function rememberPageForOffline(file) {
  opened.add(file);
  if (currentWorker()) {
    request(currentWorker(), {type:"DOWNLOAD", files:[file]}).then(result => {
      if (!result.failed) opened.delete(file);
    }).catch(() => {});
  }
}

export function setupOffline({ prepareForReload, isLibrary }) {
  prepare = prepareForReload;
  libraryVisible = isLibrary;
  panel = document.createElement("div");
  panel.className = "dialog-backdrop app-backdrop";
  panel.hidden = true;
  panel.innerHTML = `<section class="dialog app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-heading">
    <div class="app-heading"><img src="icons/apple-touch-icon.png" alt="" width="64" height="64"><h2 id="app-heading">App &amp; offline</h2><button id="app-close" class="icon-button" aria-label="Close App and offline"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
    <section class="app-section"><h3>On your Home Screen</h3>
      <p id="install-help"></p><button id="install-app" class="dialog-button" hidden>Install app</button>
    </section>
    <section class="app-section"><h3>Color without Wi-Fi</h3>
      <p id="offline-status" role="status">Getting offline access ready…</p>
      <p>Pages you open online are saved on this device. Save the whole library here before going offline.</p>
      <button id="download-pages" class="dialog-button secondary">Save all pages offline</button>
    </section>
    <section class="app-section"><h3>Move or back up your coloring</h3>
      <p>Safari and the Home Screen app may keep separate coloring. Save a backup here first, then restore that file inside the installed app. Your palettes and brush settings come with it.</p>
      <div class="app-actions"><button id="make-backup" class="dialog-button secondary">Prepare backup</button>
      <button id="save-backup" class="dialog-button" hidden>Save backup file</button>
      <button id="restore-backup" class="dialog-button secondary">Restore backup</button></div>
      <input id="backup-file" type="file" accept=".finley,application/octet-stream" hidden>
      <p id="backup-status" role="status"></p>
    </section>
    <section class="app-section"><h3>App updates</h3><p id="update-status" role="status">Checking for updates…</p>
      <button id="update-app" class="dialog-button secondary" hidden>Update app</button>
      <button id="check-update" class="dialog-button secondary">Check for updates</button>
    </section>
    <div class="dialog-buttons"><button id="app-done" class="dialog-button">Done</button></div>
  </section>`;
  document.body.append(panel);
  document.getElementById("app-options").addEventListener("click", async () => {
    openModal(panel, {onClose:close, initialFocus:$("app-close")});
    panel.querySelector(".app-dialog").scrollTop = 0;
    $("app-close").focus({preventScroll:true});
    showInstallHelp(); showUpdate();
    await refreshStatus();
  });
  $("app-done").addEventListener("click", close);
  $("app-close").addEventListener("click", close);
  panel.addEventListener("click", e => { if (e.target === panel) close(); });
  $("download-pages").addEventListener("click", () => run("offline-status", downloadAll));
  $("check-update").addEventListener("click", () => run("update-status", async () => {
    if (!registration) throw new Error("Go online and reopen the app to finish offline setup.");
    await registration.update(); showUpdate();
  }));
  $("update-app").addEventListener("click", () => run("update-status", updateApp));
  $("install-app").addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt; installPrompt = null;
    await prompt.prompt(); showInstallHelp();
  });
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); installPrompt = e; showInstallHelp();
  });
  window.addEventListener("appinstalled", showInstallHelp);
  $("make-backup").addEventListener("click", () => run("backup-status", async () => {
    await readyToChange();
    forgetBackup();
    const backup = await makeBackup((n,total) => { $("backup-status").textContent = `Preparing picture ${n} of ${total}…`; });
    backupURL = URL.createObjectURL(backup.blob);
    $("save-backup").hidden = false;
    $("save-backup").onclick = () => {
      const link = document.createElement("a"); link.href = backupURL; link.download = backup.filename;
      document.body.append(link); link.click(); link.remove();
    };
    $("backup-status").textContent = `Ready: ${backup.count} colored ${backup.count === 1 ? "page" : "pages"}. Tap Save backup file and keep the .finley file in Files or Downloads.`;
  }));
  $("restore-backup").addEventListener("click", () => { $("backup-file").value = ""; $("backup-file").click(); });
  $("backup-file").addEventListener("change", () => {
    const file = $("backup-file").files[0];
    if (file) run("backup-status", () => importFile(file));
  });
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    $("offline-status").textContent = "Offline access needs HTTPS (the hosted link) or localhost on your PC.";
    $("download-pages").disabled = true;
    $("update-status").textContent = "App updates will appear when offline access is available.";
    $("check-update").disabled = true;
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    for (const file of opened) rememberPageForOffline(file);
    refreshStatus();
  });
  const watched = new WeakSet();
  const connect = reg => {
    if (!reg) return;
    registration = reg;
    if (watched.has(reg)) return;
    watched.add(reg);
    const watch = worker => worker?.addEventListener("statechange", () => {
      showUpdate();
      if (worker.state === "activated") {
        for (const file of opened) rememberPageForOffline(file);
        refreshStatus();
      }
      if (worker.state === "redundant") $("offline-status").textContent = "Offline setup couldn't finish. The website may still be updating. Check for updates again while online.";
    });
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
    showUpdate(); refreshStatus();
  };
  // Reopening offline must use the installed helper even if checking for a new one fails.
  navigator.serviceWorker.getRegistration().then(existing => {
    connect(existing);
    return navigator.serviceWorker.register("./sw.js", {updateViaCache:"none"});
  }).then(connect).catch(error => {
    if (currentWorker()) { refreshStatus(); showUpdate(); return; }
    $("offline-status").textContent = "Offline setup couldn't finish. Check your connection and reopen the app; online coloring still works.";
    $("update-status").textContent = "Updates need an internet connection and permission to store website data.";
    console.warn("Offline setup", error);
  });
  window.addEventListener("online", () => { registration?.update().catch(() => {}); refreshStatus(); });
  window.addEventListener("offline", refreshStatus);
}

function close() {
  if (busy) return;
  if (restored) { location.reload(); return; }
  closeModal(panel); forgetBackup();
}
function forgetBackup() {
  if (backupURL) URL.revokeObjectURL(backupURL);
  backupURL = null; $("save-backup").hidden = true;
}
async function run(statusId, action) {
  if (busy) return;
  busy = true;
  for (const button of panel.querySelectorAll("button")) button.disabled = true;
  try { await action(); }
  catch (error) { $(statusId).textContent = error.message || "That couldn't finish. Please try again."; }
  finally {
    busy = false;
    for (const button of panel.querySelectorAll("button")) button.disabled = false;
  }
}
async function readyToChange() {
  if (!libraryVisible() || !await prepare()) throw new Error("Your last picture hasn't finished saving. Please reopen it and try again before moving your coloring or updating.");
}
async function refreshStatus() {
  if (!currentWorker()) return;
  try {
    const result = await request(currentWorker(), {type:"STATUS"});
    const saved = new Set(result.available);
    const count = pages.filter(p => saved.has(new URL(p.file, location.href).pathname)).length;
    $("offline-status").textContent = `${count} of ${pages.length} pages ready offline on this device.${navigator.onLine ? "" : " You're offline now."}`;
  } catch (error) { $("offline-status").textContent = error.message; }
}
function showInstallHelp() {
  const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  $("install-help").textContent = installed ? "You're using the Home Screen app. Your coloring and offline pages are saved on this device." :
    apple ? "First save a backup below. Then in Safari, tap Share → Add to Home Screen → Add. If shown, keep Open as Web App turned on. Open the new book icon and restore your backup there." :
    "In Chrome, use Install app below if available, or the install icon in the address bar. On iPad, use Safari → Share → Add to Home Screen. Save a backup before moving devices.";
  $("install-app").hidden = installed || !installPrompt;
}
function showUpdate() {
  const waiting = !!registration?.waiting;
  $("update-app").hidden = !waiting;
  $("update-status").textContent = waiting ? "A new version is ready. Finish coloring, close any other coloring-book windows, then update here." :
    registration?.installing ? "Getting the app files ready. You can keep coloring while they download." :
    registration?.active ? "This version is ready. New versions wait until you close the app or choose Update here; drawing is never interrupted by a reload." : "Getting app updates ready…";
}
async function downloadAll() {
  if (!navigator.onLine) throw new Error("Go online to download more pages. Pages already saved still work offline.");
  $("offline-status").textContent = "Saving pages… Keep the app open until this finishes.";
  const result = await request(currentWorker(), {type:"DOWNLOAD", files:pages.map(p => p.file)}, p => {
    $("offline-status").textContent = `Saved ${p.completed} of ${p.total} pages… Keep the app open.`;
  });
  await refreshStatus();
  if (result.failed) $("offline-status").textContent += ` ${result.failed} couldn't finish. ${result.reason} Try again to resume.`;
}
async function updateApp() {
  await readyToChange();
  if (!registration?.waiting) { showUpdate(); return; }
  $("update-status").textContent = "Opening the new version…";
  // Listen before asking: activation may happen immediately after the worker replies.
  let reload;
  const changed = new Promise(resolve => {
    reload = () => resolve();
    navigator.serviceWorker.addEventListener("controllerchange", reload, {once:true});
  });
  try {
    await request(registration.waiting, {type:"ACTIVATE"});
    await Promise.race([changed, new Promise((_, reject) => setTimeout(() => reject(new Error("The update is still waiting. Close the app and reopen it to finish.")), SETTINGS.offlineReplyMs))]);
    location.reload();
  } finally { navigator.serviceWorker.removeEventListener("controllerchange", reload); }
}
async function importFile(file) {
  await readyToChange();
  $("backup-status").textContent = "Checking your backup…";
  const backup = await readBackup(file, (n,total) => { $("backup-status").textContent = `Checking picture ${n} of ${total}…`; });
  const yes = await askConfirm({title:"Restore your coloring?", text:`This backup has ${backup.records.length} colored pages. Newer coloring already on this device is kept. Your palettes and brush settings will switch to the backup's settings.`, confirmLabel:"Restore", cancelLabel:"Keep it as it is"});
  if (!yes) { $("backup-status").textContent = "Nothing changed."; return; }
  const result = await restoreBackup(backup);
  // The backup holds her paint, not the original outlines. Save those separately when online.
  let outlineNote = "Go online and use Save all pages offline to save the outlines too.";
  if (currentWorker() && navigator.onLine) {
    const files = backup.records.map(r => findPage(r.id)?.file).filter(Boolean);
    $("backup-status").textContent = "Coloring restored. Saving its outlines for offline use…";
    try {
      const saved = await request(currentWorker(), {type:"DOWNLOAD", files});
      if (!saved.failed) outlineNote = "Their current outlines are ready offline too.";
    } catch { /* The coloring is already safe even if outlines couldn't download. */ }
  }
  $("backup-status").textContent = `Restored ${result.added} pages; refreshed ${result.refreshed} matching pages; kept ${result.kept} newer pages. ${outlineNote}${result.settingsSaved ? "" : " This browser couldn't remember the restored settings."}`;
  restored = true;
  $("app-done").textContent = "Open library";
  // Wait for a fresh tap before reloading palettes and library previews from the database.
}
