// touch-debug.js - a TEMPORARY on-screen log of touches and gestures, for tuning the
// gesture settings to how Finley actually touches the screen.
//
// Turn it on or off by tapping the page title (on the coloring screen) 5 times quickly.
// It shows, for each gesture: how many fingers, when each finger landed (milliseconds after
// the first), how long until all fingers lifted, how far each moved, the touch size the
// iPad reported, and what the app decided - or why it did nothing.

const box = document.getElementById("touch-debug");
const lines = [];
let on = false;
try {
  on = localStorage.getItem("touch-debug") === "on";
} catch {
  on = false;
}
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
  if (on) debugLog("touch debug ON (tap the title 5 times to turn off)");
  show();
}

export function debugLog(text) {
  if (!on) return;
  const now = new Date();
  const time = `${now.getMinutes()}:${String(now.getSeconds()).padStart(2, "0")}`;
  lines.unshift(`${time}  ${text}`);
  lines.length = Math.min(lines.length, 10);
  show();
}

function show() {
  box.hidden = !on;
  box.textContent = lines.join("\n");
}
