// touch-debug.js - a TEMPORARY on-screen log of touches and gestures, for tuning the
// gesture settings to how Finley actually touches the screen.
//
// Turn it ON by opening the app with ?debug at the end of the link
// (https://deweyzx.github.io/finley-coloring/?debug), or by tapping the page title on the
// coloring screen 5 times quickly. Turn it OFF with the log's "Hide log" button (or 5 taps).
// The choice is remembered on the device.
//
// It shows, for each gesture: how many fingers, when each finger landed (milliseconds after
// the first), how long until all fingers lifted, how far each moved, the touch size the
// iPad reported, and what the app decided - or why it did nothing.

const box = document.getElementById("touch-debug");
const linesEl = document.getElementById("touch-debug-lines");
const hideButton = document.getElementById("touch-debug-hide");
const speedButton = document.getElementById("touch-debug-speed");
let speedTest = null; // what the "Speed test" button runs (set by the coloring screen)
const lines = [];
let on = false;
try {
  on = localStorage.getItem("touch-debug") === "on";
} catch {
  on = false;
}

// ?debug in the link turns it on. Then the ?debug is removed from the address bar, so
// reloading after "Hide log" doesn't turn it straight back on.
const params = new URLSearchParams(location.search);
if (params.has("debug")) {
  params.delete("debug");
  const rest = params.toString();
  history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  if (!on) toggleDebug();
}

// The "Hide log" button sits on top of the drawing area: keep its touches to itself so
// tapping it can never draw, fill or count as a gesture.
for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
  hideButton.addEventListener(type, (e) => e.stopPropagation());
  speedButton.addEventListener(type, (e) => e.stopPropagation());
}
// "Speed test": measures every brush on this device (see speed-test.js).
speedButton.addEventListener("click", async () => {
  if (!speedTest || speedButton.disabled) return;
  speedButton.disabled = true;
  speedButton.textContent = "Testing…";
  try {
    await speedTest();
  } catch (err) {
    debugLog("Speed test failed: " + err);
  }
  speedButton.disabled = false;
  speedButton.textContent = "Speed test";
});

// The coloring screen hands over what the "Speed test" button should do.
export function onSpeedTest(fn) {
  speedTest = fn;
}
hideButton.addEventListener("click", () => {
  if (on) toggleDebug();
});
show();

export function debugOn() {
  return on;
}

export function toggleDebug() {
  on = !on;
  try {
    localStorage.setItem("touch-debug", on ? "on" : "off");
  } catch {
    // just for this visit
  }
  lines.length = 0;
  if (on) debugLog("touch log ON - try the gestures; newest entries appear at the top");
  show();
}

export function debugLog(text) {
  if (!on) return;
  const now = new Date();
  const time = `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, "0")}`;
  lines.unshift(`${time}  ${text}`);
  lines.length = Math.min(lines.length, 14);
  show();
}

function show() {
  box.hidden = !on;
  linesEl.textContent = lines.join("\n");
}
