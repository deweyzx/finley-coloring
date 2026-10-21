// touch-input.js - decides what every touch, Pencil and mouse movement on the page means.
//
// The rules:
//   - The Apple Pencil draws (or taps to fill). So does one finger.
//   - Palm rejection, automatically:
//       * while the Pencil is touching the screen, every finger is ignored;
//       * for a moment after the Pencil lifts (SETTINGS.afterPencilMs), a new finger can't
//         draw - but it can still be part of a two/three-finger gesture (quick undo);
//       * touches already on the screen when the Pencil lands are her hand: ignored, and a
//         finger stroke still in progress is taken back with no mark;
//       * touches the iPad reports as palm-sized are always ignored.
//   - Two fingers moving: pinch to zoom, drag to pan.
//   - Two fingers tapped (down and up quickly, barely moving): undo.
//     Three fingers tapped: redo. Anything that moves or lasts longer is zoom/pan instead.
//   - When one finger is drawing and a second finger lands soon after (or the first finger
//     has barely moved), that stroke is taken back without leaving any mark, and it becomes a
//     two-finger gesture.
//   - On the PC: the mouse draws, the mouse wheel zooms, and dragging with the middle
//     button (or with the space bar held) pans. Ctrl+0 shows the whole page.
//
// The time and distance limits are in settings.js. With the touch debug overlay turned on
// (tap the page title 5 times), every touch and decision is shown on screen.

import { SETTINGS } from "./settings.js?v=20261021174002";
import { debugLog, debugOn } from "./touch-debug.js?v=20261021174002";

const FILL_TAP_MAX_MS = 800; // a fill tap (one Pencil/finger/mouse tap)

export function setupInput(area, viewport, h) {
  // h = what the editor does: ready(), isBrush(), strokeStart(e), strokeMove(e),
  //     strokeEnd(), strokeCancel(), tap(e), undo() -> true if it undid, redo() -> same

  let pencilUpAt = -Infinity; // when the Pencil last lifted (for palm rejection)

  const touches = new Map(); // finger id -> { x, y, x0, y0 }
  const ignored = new Set(); // finger ids we're ignoring (palm)
  let draw = null;           // the pointer that is drawing (or tapping to fill)
  let gesture = null;        // two/three-finger gesture in progress
  let mousePan = null;
  let spaceHeld = false;

  const capture = (e) => {
    try {
      area.setPointerCapture(e.pointerId);
    } catch {
      // not available for this pointer; everything still works
    }
  };
  const size = (e) => `${Math.round(e.width || 0)}×${Math.round(e.height || 0)}`;

  // ---------- drawing / tapping with one pointer ----------

  function beginDraw(e) {
    capture(e);
    draw = {
      id: e.pointerId,
      type: e.pointerType,
      stroke: h.isBrush(),
      t0: e.timeStamp,
      x0: e.clientX,
      y0: e.clientY,
      moved: 0,
      size: size(e),
    };
    if (draw.stroke) h.strokeStart(e);
  }

  // how: "finish" (keep the stroke / check for a fill tap), "cancel" (take it back)
  function endDraw(how, e) {
    const d = draw;
    draw = null;
    if (d.stroke) {
      if (how === "cancel") h.strokeCancel();
      else h.strokeEnd();
    } else if (how === "finish" && e && e.type === "pointerup") {
      if (d.moved < 12 && e.timeStamp - d.t0 < FILL_TAP_MAX_MS) h.tap(e);
    }
  }

  // ---------- finger gestures ----------

  function addToGesture(id, time, info) {
    if (!gesture) {
      gesture = { ids: [], t0: time, maxCount: 0, moved: false, base: null, fingers: [], cancelled: false };
    }
    gesture.ids.push(id);
    gesture.maxCount = Math.max(gesture.maxCount, gesture.ids.length);
    gesture.fingers.push({ id, landed: Math.round(time - gesture.t0), size: info.size, moved: 0, up: null });
    rebase();
  }

  // (Re)starts the pinch from the fingers' positions, so nothing jumps when a finger is
  // added or lifted. fromTouchDown: measure from where the fingers first touched instead.
  // (The iPad reports each finger's movement separately, so "right now" can be a moment
  // when one finger has moved and the other hasn't yet - a lopsided starting point.)
  function rebase(fromTouchDown = false) {
    const [a, b] = gesture.ids.map((id) => touches.get(id)).filter(Boolean);
    if (!a || !b) {
      gesture.base = null;
      return;
    }
    const ax = fromTouchDown ? a.x0 : a.x;
    const ay = fromTouchDown ? a.y0 : a.y;
    const bx = fromTouchDown ? b.x0 : b.x;
    const by = fromTouchDown ? b.y0 : b.y;
    gesture.base = { scale: viewport.scale, x: viewport.x, y: viewport.y, cx: (ax + bx) / 2, cy: (ay + by) / 2, dist: Math.max(1, Math.hypot(ax - bx, ay - by)) };
  }

  function moveGesture(id) {
    const t = touches.get(id);
    const f = gesture.fingers.find((x) => x.id === id);
    if (t && f) f.moved = Math.max(f.moved, Math.round(Math.hypot(t.x - t.x0, t.y - t.y0)));
    if (!gesture.moved) {
      const far = gesture.fingers.find((x) => x.moved > SETTINGS.tapGestureMoveLimit && gesture.ids.includes(x.id));
      if (!far) return; // still could be a tap: don't move the page yet
      gesture.moved = true;
      if (gesture.ids.length >= 2) debugLog(`zoom/pan started (a finger moved ${far.moved} px)`);
      rebase(true); // the page hasn't moved yet, so measure from where the fingers went down
    }
    const [a, b] = gesture.ids.map((i) => touches.get(i)).filter(Boolean);
    if (a && b && gesture.base) {
      viewport.pinch(gesture.base, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }

  function endGesture(e) {
    const g = gesture;
    gesture = null;
    const took = Math.round(e.timeStamp - g.t0);
    let result;
    if (g.cancelled) result = "nothing: the iPad cancelled the touch (pointercancel)";
    else if (g.moved) result = g.maxCount >= 2 ? "zoom/pan" : "nothing: 1 finger moved (fingers don't pan alone)";
    else if (g.maxCount < 2) result = "nothing: only 1 finger";
    else if (g.maxCount > 3) result = `nothing: ${g.maxCount} fingers (2 = undo, 3 = redo)`;
    else if (took >= SETTINGS.tapGestureMaxMs) result = `nothing: took ${took} ms (tap limit ${SETTINGS.tapGestureMaxMs} ms)`;
    else if (g.maxCount === 2) result = h.undo() ? "UNDO" : "UNDO, but there was nothing to undo";
    else result = h.redo() ? "REDO" : "REDO, but there was nothing to redo";
    if (g.moved) viewport.settle();

    if (debugOn()) {
      const f = g.fingers;
      debugLog(
        `${g.maxCount} finger${g.maxCount === 1 ? "" : "s"} · landed ${f.map((x) => "+" + x.landed).join("/")} ms` +
        ` · all up after ${took} ms · moved ${f.map((x) => x.moved).join("/")} px` +
        ` · size ${f.map((x) => x.size).join(", ")}\n   → ${result}`
      );
    }
  }

  // ---------- events ----------

  area.addEventListener("pointerdown", (e) => {
    if (!h.ready()) return;

    if (e.pointerType === "pen") {
      if (draw && draw.type === "touch") {
        endDraw("cancel"); // the Pencil wins: a finger "stroke" now was her palm landing first
        debugLog("Pencil down while a finger was drawing → that finger stroke was taken back (no mark)");
      }
      if (draw) return;
      // Any fingers on the screen right now are her hand: ignore them until they lift.
      const palms = touches.size;
      for (const id of touches.keys()) ignored.add(id);
      touches.clear();
      if (gesture) {
        debugLog("Pencil touched down during a finger gesture → gesture stopped");
        gesture = null;
        viewport.settle();
      }
      debugLog(`Pencil down${palms ? ` (${palms} finger${palms > 1 ? "s" : ""} on screen ignored as palm)` : ""}`);
      beginDraw(e);
      return;
    }

    if (e.pointerType === "mouse") {
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        capture(e);
        mousePan = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        return;
      }
      if (e.button === 0 && !draw) beginDraw(e);
      return;
    }

    // A finger (touch).
    if (draw && draw.type === "pen") {
      ignored.add(e.pointerId);
      debugLog(`finger ignored: the Pencil is touching the screen (size ${size(e)})`);
      return;
    }
    if (e.width > SETTINGS.palmSize || e.height > SETTINGS.palmSize) {
      ignored.add(e.pointerId);
      debugLog(`finger ignored as a palm: size ${size(e)} is bigger than ${SETTINGS.palmSize}`);
      return;
    }
    capture(e);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });

    // Right after the Pencil lifts, a new finger is probably her hand: it can't draw, but it
    // can still be part of a gesture (so a quick two-finger tap to undo still works).
    const sincePencil = Math.round(e.timeStamp - pencilUpAt);
    const tooSoon = sincePencil < SETTINGS.afterPencilMs;
    if (!SETTINGS.fingersDraw || tooSoon || gesture) {
      if (tooSoon && !gesture) debugLog(`finger can't draw: the Pencil lifted ${sincePencil} ms ago (gestures still OK)`);
      addToGesture(e.pointerId, e.timeStamp, { size: size(e) });
      return;
    }
    // Fingers can draw: the first finger draws; a second one turns it into a gesture.
    if (!draw && !gesture) {
      beginDraw(e);
      return;
    }
    if (draw && draw.type === "touch") {
      const first = draw;
      const age = Math.round(e.timeStamp - first.t0);
      // Take the first finger's stroke back if it only just started, or if that finger has
      // barely moved (it was resting, waiting for the second finger) - so no stray dots.
      const young = (age < SETTINGS.secondFingerMs && first.moved < 20) || first.moved < 10;
      endDraw(young ? "cancel" : "finish");
      debugLog(young
        ? `2nd finger +${age} ms → the 1st finger's stroke was taken back (no mark)`
        : `2nd finger +${age} ms → the 1st finger's stroke was kept (it was already ${first.moved} px / ${age} ms long)`);
      addToGesture(first.id, first.t0, { size: first.size });
      const f = gesture.fingers[0];
      f.moved = Math.round(first.moved);
      addToGesture(e.pointerId, e.timeStamp, { size: size(e) });
      return;
    }
    if (gesture) addToGesture(e.pointerId, e.timeStamp, { size: size(e) });
  });

  area.addEventListener("pointermove", (e) => {
    if (mousePan && e.pointerType === "mouse") {
      viewport.panBy(e.clientX - mousePan.x, e.clientY - mousePan.y);
      mousePan = { x: e.clientX, y: e.clientY };
      return;
    }
    if (draw && e.pointerId === draw.id) {
      draw.moved = Math.max(draw.moved, Math.hypot(e.clientX - draw.x0, e.clientY - draw.y0));
      if (draw.stroke) h.strokeMove(e);
      if (draw.type === "touch") {
        const t = touches.get(e.pointerId);
        if (t) {
          t.x = e.clientX;
          t.y = e.clientY;
        }
      }
      return;
    }
    const t = touches.get(e.pointerId);
    if (!t || ignored.has(e.pointerId)) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (gesture && gesture.ids.includes(e.pointerId)) moveGesture(e.pointerId);
  });

  function lift(e) {
    if (mousePan && e.pointerType === "mouse") {
      mousePan = null;
      viewport.settle();
      return;
    }
    if (e.type === "pointercancel" && e.pointerType === "touch") debugLog("the iPad cancelled a touch (pointercancel)");
    if (draw && e.pointerId === draw.id) {
      if (draw.type === "pen") pencilUpAt = e.timeStamp;
      endDraw("finish", e);
    }
    ignored.delete(e.pointerId);
    touches.delete(e.pointerId);
    if (gesture && gesture.ids.includes(e.pointerId)) {
      if (e.type === "pointercancel") gesture.cancelled = true;
      gesture.ids = gesture.ids.filter((id) => id !== e.pointerId);
      if (gesture.ids.length === 0) endGesture(e);
      else rebase();
    }
  }
  area.addEventListener("pointerup", lift);
  area.addEventListener("pointercancel", lift);

  // PC: mouse wheel (or a trackpad pinch) zooms around the mouse pointer.
  area.addEventListener(
    "wheel",
    (e) => {
      if (!h.ready()) return;
      e.preventDefault();
      viewport.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      clearTimeout(area.wheelTimer);
      area.wheelTimer = setTimeout(() => viewport.settle(), 250);
    },
    { passive: false }
  );

  window.addEventListener("keydown", (e) => {
    if (e.key === " ") spaceHeld = true;
    if ((e.ctrlKey || e.metaKey) && e.key === "0" && h.ready()) {
      e.preventDefault();
      viewport.fit();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === " ") spaceHeld = false;
  });

  // Safari has its own pinch-zoom for the whole web page; turn it off here.
  area.addEventListener("gesturestart", (e) => e.preventDefault());

  return {
    busy: () => draw !== null,
  };
}
