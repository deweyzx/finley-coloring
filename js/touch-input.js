// touch-input.js - decides what every touch, Pencil and mouse movement on the page means.
//
// The rules:
//   - The Apple Pencil always draws (or taps to fill).
//   - Once this device has seen the Pencil, FINGERS NEVER DRAW. They only zoom and pan.
//     That's what makes palm rejection reliable: her hand can rest on the screen.
//   - While the Pencil is on the screen, every other touch is ignored (her palm), so nothing
//     can interrupt or spoil the stroke.
//   - Two fingers moving: pinch to zoom, drag to pan.
//   - Two fingers tapped (down and up quickly, barely moving): undo.
//     Three fingers tapped: redo. Anything that moves or lasts longer is zoom/pan instead.
//   - On a device that has never seen a Pencil (a PC, or an iPad used with fingers only),
//     one finger draws. If a second finger lands soon after, that stroke is taken back
//     without leaving any mark, and it becomes a two-finger gesture.
//   - On the PC: the mouse draws, the mouse wheel zooms, and dragging with the middle
//     button (or with the space bar held) pans. Ctrl+0 shows the whole page.

const TAP_MAX_MS = 350;        // a tap gesture must be over within this time...
const TAP_MOVE_PX = 12;        // ...and no finger may move more than this
const FILL_TAP_MAX_MS = 800;   // a fill tap (one Pencil/finger/mouse tap)
const SECOND_FINGER_MS = 250;  // finger mode: a 2nd finger this soon cancels the 1st finger's stroke
const PALM_SIZE = 60;          // a touch reported wider than this (screen pixels) is a palm

export function setupInput(area, viewport, h) {
  // h = what the editor does: ready(), isBrush(), strokeStart(e), strokeMove(e), strokeEnd(),
  //     strokeCancel(), tap(e), undo(), redo()

  let penSeen = false;
  try {
    penSeen = localStorage.getItem("pencil-seen") === "yes";
  } catch {
    // storage unavailable: we'll notice the Pencil again on its first touch
  }

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

  function addToGesture(id, time) {
    if (!gesture) gesture = { ids: [], t0: time, maxCount: 0, moved: false, base: null };
    gesture.ids.push(id);
    gesture.maxCount = Math.max(gesture.maxCount, gesture.ids.length);
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

  function moveGesture() {
    if (!gesture.moved) {
      const far = gesture.ids.some((id) => {
        const t = touches.get(id);
        return t && Math.hypot(t.x - t.x0, t.y - t.y0) > TAP_MOVE_PX;
      });
      if (!far) return; // still could be a tap: don't move the page yet
      gesture.moved = true;
      rebase(true); // the page hasn't moved yet, so measure from where the fingers went down
    }
    const [a, b] = gesture.ids.map((id) => touches.get(id)).filter(Boolean);
    if (a && b && gesture.base) {
      viewport.pinch(gesture.base, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }

  function endGesture(e) {
    const g = gesture;
    gesture = null;
    const quick = e.timeStamp - g.t0 < TAP_MAX_MS;
    if (!g.moved && quick && e.type === "pointerup") {
      if (g.maxCount === 2) h.undo();
      else if (g.maxCount === 3) h.redo();
    }
    if (g.moved) viewport.settle();
  }

  // ---------- events ----------

  area.addEventListener("pointerdown", (e) => {
    if (!h.ready()) return;

    if (e.pointerType === "pen") {
      if (!penSeen) {
        penSeen = true;
        try {
          localStorage.setItem("pencil-seen", "yes");
        } catch {
          // not remembered; noticed again next time
        }
      }
      if (draw && draw.type === "touch") endDraw("cancel"); // the Pencil wins over a finger
      if (draw) return;
      // Any fingers on the screen right now are her hand: ignore them until they lift.
      for (const id of touches.keys()) ignored.add(id);
      touches.clear();
      if (gesture) {
        gesture = null;
        viewport.settle();
      }
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
    if ((draw && draw.type === "pen") || e.width > PALM_SIZE || e.height > PALM_SIZE) {
      ignored.add(e.pointerId); // palm
      return;
    }
    capture(e);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });

    if (penSeen) {
      addToGesture(e.pointerId, e.timeStamp);
      return;
    }
    // Finger mode (this device has never seen a Pencil).
    if (!draw && !gesture) {
      beginDraw(e);
      return;
    }
    if (draw && draw.type === "touch") {
      // A second finger: this is a gesture, not drawing.
      const first = draw;
      const young = e.timeStamp - first.t0 < SECOND_FINGER_MS && first.moved < 20;
      endDraw(young ? "cancel" : "finish");
      addToGesture(first.id, first.t0);
      addToGesture(e.pointerId, e.timeStamp);
      return;
    }
    if (gesture) addToGesture(e.pointerId, e.timeStamp);
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
    if (gesture && gesture.ids.includes(e.pointerId)) moveGesture();
  });

  function lift(e) {
    if (mousePan && e.pointerType === "mouse") {
      mousePan = null;
      viewport.settle();
      return;
    }
    if (draw && e.pointerId === draw.id) endDraw("finish", e);
    ignored.delete(e.pointerId);
    touches.delete(e.pointerId);
    if (gesture && gesture.ids.includes(e.pointerId)) {
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
    usingPencil: () => penSeen,
    busy: () => draw !== null,
  };
}
