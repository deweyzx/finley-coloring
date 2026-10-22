// save-picture.js - saves the finished picture to the iPad's Photos (or downloads it on a PC).
//
// How it works:
//   1. She taps "Save" in the top bar. A window opens and the picture is made: her colors
//      with the black lines on top, at the full page size, as a PNG file.
//   2. The window shows a preview and a big button. Tapping it opens the iPad's share sheet
//      (navigator.share) with the picture; "Save Image" there puts it in Photos.
//      (Safari only opens the share sheet right after a tap, and making a big picture takes a
//      moment, so the picture is made first and the share happens on this second tap.)
//   3. On a computer the button downloads the file instead. (Chrome on Windows has its own
//      share panel that browsers report as "can share", but it's not what we want there, so the
//      share sheet is only used on an iPad or iPhone.)
//   She can also touch and hold the preview picture and choose "Add to Photos".

import { openModal, closeModal } from './modal.js?v=20261021233948';

const button = document.getElementById("export-button");
const dialog = document.getElementById("export-dialog");
const textEl = document.getElementById("export-text");
const previewBox = document.getElementById("export-preview");
const imageEl = document.getElementById("export-image");
const hintEl = document.getElementById("export-hint");
const closeButton = document.getElementById("export-close");
const saveButton = document.getElementById("export-save");
const downloadLink = document.getElementById("export-download");

// True on an iPad or iPhone. (An iPad often tells websites it's a Mac, but unlike a real Mac
// it has a touchscreen.)
function isAppleTouchDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

let picture = null;   // { blob, file, url, name } for the picture on screen
let canShare = false; // can this browser share the file?
let busy = false;     // a picture is being made

export function setupSavePicture({ isReady }) {
  button.addEventListener("click", () => {
    if (isReady()) open();
  });
  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close(); // tapped outside the window
  });
  saveButton.addEventListener("click", saveNow);
  downloadLink.addEventListener("click", () => {
    if (picture) downloadFile();
  });
}

async function open() {
  if (busy) {
    openModal(dialog, {onClose:close, initialFocus:closeButton}); // still being made
    return;
  }
  busy = true;
  forget();
  openModal(dialog, {onClose:close, initialFocus:closeButton});
  previewBox.hidden = true;
  hintEl.hidden = true;
  downloadLink.hidden = true;
  saveButton.disabled = true;
  saveButton.textContent = "One moment…";
  textEl.textContent = "Getting your picture ready…";
  closeButton.focus();

  try {
    picture = await makePicture();
  } catch (err) {
    console.error("Couldn't make the picture", err);
    textEl.textContent = "Sorry, the picture couldn't be made. Please try again.";
    busy = false;
    return;
  }
  busy = false;
  if (dialog.hidden) {
    forget(); // she closed the window while it was working
    return;
  }

  canShare = !!(isAppleTouchDevice() && navigator.canShare && navigator.canShare({ files: [picture.file] }) && navigator.share);
  imageEl.src = picture.url;
  previewBox.hidden = false;
  const size = picture.blob.size > 1048576 ? (picture.blob.size / 1048576).toFixed(1) + " MB" : Math.round(picture.blob.size / 1024) + " KB";
  textEl.textContent = canShare
    ? `Your picture is ready (${size}). Tap the button, then choose “Save Image” to put it in Photos.`
    : `Your picture is ready (${size}). Tap the button to download it.`;
  saveButton.textContent = canShare ? "Save to Photos" : "Download picture";
  saveButton.disabled = false;
  hintEl.textContent = canShare
    ? "Or touch and hold the picture above and choose “Add to Photos”."
    : "";
  hintEl.hidden = !hintEl.textContent; // (no hint on a computer)
  downloadLink.hidden = !canShare;     // the backup is only for iPad and iPhone
  saveButton.focus();
}

function close() {
  closeModal(dialog);
  if (!busy) forget();
}

function forget() {
  if (picture) URL.revokeObjectURL(picture.url);
  picture = null;
  imageEl.removeAttribute("src");
}

// ---------- Making the picture ----------

// Her colors with the black lines on top, as a PNG, at the page's full size.
async function makePicture() {
  const colors = document.getElementById("color-canvas");
  const lines = document.getElementById("line-canvas");
  const out = document.createElement("canvas");
  out.width = colors.width;
  out.height = colors.height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(colors, 0, 0);
  ctx.drawImage(lines, 0, 0);
  const blob = await new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob gave nothing"))), "image/png");
  });
  out.width = out.height = 0; // let the big canvas go
  const name = fileName();
  return { blob, name, file: new File([blob], name, { type: "image/png" }), url: URL.createObjectURL(blob) };
}

// "Daffodil" -> "Finleys-coloring-daffodil.png"
function fileName() {
  const title = (document.getElementById("page-title").textContent || "picture")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `finleys-coloring-${title || "picture"}.png`;
}

// ---------- Saving ----------

async function saveNow() {
  if (!picture) return;
  if (canShare) {
    try {
      await navigator.share({ files: [picture.file], title: "My coloring" });
      textEl.textContent = "Done! If you chose “Save Image”, your picture is in Photos now.";
    } catch (err) {
      if (err && err.name === "AbortError") return; // she closed the share sheet: nothing wrong
      console.error("Sharing failed", err);
      textEl.textContent = "The share sheet didn't open. Touch and hold the picture and choose “Add to Photos”, or tap “Download instead”.";
    }
    return;
  }
  downloadFile(); // no share sheet here: download the file
}

// Saves the picture as a file (the Downloads folder on a computer; the Files app on an iPad).
function downloadFile() {
  const link = document.createElement("a");
  link.href = picture.url;
  link.download = picture.name;
  document.body.append(link);
  link.click();
  link.remove();
  textEl.textContent = canShare
    ? "Downloaded! Open the Files app and look in Downloads."
    : "Downloaded! Look in your Downloads folder.";
}
