// splash.js - the approved book cover and golden thread, once per page opening.
// This helper is separate from app.js: it never paints, saves, changes the route or starts
// a second animation when she browses pages or comes back from another app.
import { SETTINGS } from "./settings.js?v=20261021211413";

const SVG = "http://www.w3.org/2000/svg";
const THREAD = "M544 598 C 640 690 790 610 768 470 S 630 236 500 258 S 288 390 400 478 S 488 506 500 500";
const BRANCHES = ["M6 552 C 2 470 12 400 8 330 S 24 190 14 120 S 30 40 70 18",
  "M6 552 C 80 556 150 538 220 548 S 340 556 420 536"];

// A fixed seed gives the same leaf arrangement and dust as the approved mockup.
function randomSource() {
  let seed = 3;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
function svg(tag, attributes) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}
function sparkle(size) {
  const node = document.createElement("span");
  node.className = "opening-spark";
  node.style.setProperty("--opening-spark-size", `${size}px`);
  node.innerHTML = '<span class="opening-core"></span>';
  return node;
}

// The thread and its dust share this easing. Dust positions are calculated ONCE here,
// not measured on every screen refresh while she is coloring.
function threadEase(x) {
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 30; i++) {
    t = (lo + hi) / 2;
    const cx = 3 * (1 - t) ** 2 * t * 0.65 + 3 * (1 - t) * t * t * 0.35 + t ** 3;
    if (cx < x) lo = t; else hi = t;
  }
  return 3 * (1 - t) * t * t + t ** 3;
}

function decorate(cover, css) {
  const rnd = randomSource();
  for (const vine of cover.querySelectorAll(".opening-vine")) {
    const delay = parseFloat(vine.style.getPropertyValue("--opening-vine-delay"));
    const stem = svg("path", { class: "opening-stem", d: BRANCHES.join(" "), pathLength: 1 });
    vine.append(stem);
    BRANCHES.forEach((d, branch) => {
      const probe = svg("path", { d, visibility: "hidden" });
      vine.append(probe);
      const length = probe.getTotalLength(), count = branch === 0 ? 9 : 7;
      for (let i = 0; i < count; i++) {
        const f = 0.08 + (i / count) * 0.88 + rnd() * 0.03;
        const pt = probe.getPointAtLength(f * length), side = i % 2 ? 1 : -1;
        const size = parseFloat(css.getPropertyValue("--opening-leaf-size")) - f * 12 +
          rnd() * parseFloat(css.getPropertyValue("--opening-leaf-jitter"));
        const ox = branch === 0 ? side * 13 : 0, oy = branch === 0 ? 0 : side * 12;
        const leaf = svg("use", { href: "#opening-ivy", class: "opening-leaf", width: size, height: size,
          x: pt.x + ox - size / 2, y: pt.y + oy - size / 2 });
        const arrives = 1 - Math.cbrt(1 - f);
        leaf.style.setProperty("--opening-leaf-delay", `${(delay + arrives - 0.05).toFixed(3)}s`);
        const wrapper = svg("g", { transform: `rotate(${Math.round((branch === 0 ? side * 70 : 180 + side * 20) + (rnd() - 0.5) * 50)} ${pt.x + ox} ${pt.y + oy})` });
        wrapper.append(leaf); vine.append(wrapper);
        if (i % 3 === 1) {
          const tendril = svg("path", { class: "opening-tendril", pathLength: 1,
            d: `M${pt.x} ${pt.y} q ${ox * 1.4 + 6} ${oy * 1.4 - 10} ${ox * 0.8 + 12} ${oy * 0.8 - 4} q 5 -4 0 -7` });
          tendril.style.setProperty("--opening-tendril-delay", `${(delay + arrives).toFixed(3)}s`);
          vine.insertBefore(tendril, stem);
        }
      }
      // Keep the measuring path attached until all leaf positions have been read (Safari).
      probe.remove();
    });
  }
  [[-0.62,0.62],[0.58,0.72],[0.7,0.9],[-0.7,1],[0.05,1.08],[-0.3,1.18]].forEach(([angle, delay], i) => {
    const node = sparkle(16 + (i % 3) * 7), radius = 0.62 + (i % 2) * 0.1;
    node.style.left = `${50 + Math.sin(angle * Math.PI) * radius * 100}%`;
    node.style.top = `${50 - Math.cos(angle * Math.PI) * radius * 100}%`;
    node.style.setProperty("--opening-delay", `${delay}s`);
    cover.querySelector(".opening-twinkles").append(node);
  });
  const thread = cover.querySelector("#opening-thread-path"), length = thread.getTotalLength();
  // One path supplies the drawn thread, the moving star and the dust. They cannot drift apart.
  cover.querySelectorAll(".opening-thread path").forEach(node => node.setAttribute("d", THREAD));
  cover.querySelector(".opening-head").style.offsetPath = `path("${THREAD}")`;
  const dust = cover.querySelector(".opening-dust");
  for (let i = 0; i < 24; i++) {
    const time = 0.06 + (i / 24) * 0.9 + rnd() * 0.02;
    const pt = thread.getPointAtLength(threadEase(time) * length);
    const node = document.createElement("div"); node.className = "opening-p";
    node.style.cssText = `left:${pt.x}px;top:${pt.y}px;--opening-delay:${(1.2 + time * 0.9).toFixed(3)}s;--opening-drift-x:${Math.round((rnd() - 0.5) * 30)}px;--opening-drift-y:${Math.round(14 + rnd() * 30)}px;--opening-brightness:${(0.55 + rnd() * 0.45).toFixed(2)}`;
    if (i % 3 === 0) node.append(sparkle(Math.round(9 + rnd() * 8)));
    else {
      const mote = document.createElement("span"); mote.className = "opening-mote";
      mote.style.setProperty("--opening-mote-size", `${Math.round(3 + rnd() * 3)}px`);
      node.append(mote);
    }
    dust.append(node);
  }
}

async function startOpening() {
  const cover = document.getElementById("opening-splash");
  if (!cover) return;
  const screens = [...document.querySelectorAll(".screen")].map(node => ({node, wasInert:node.inert}));
  const previousFocus = document.activeElement, fingers = new Set();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let finished = false, skipping = false, visuallyFinished = false;
  let safetyTimer, endTimer, imageTimer, frame, releaseImageWait;
  const css = getComputedStyle(cover);
  const milliseconds = name => parseFloat(css.getPropertyValue(name)) * 1000;
  function finish(force = false) {
    if (finished || (!force && fingers.size)) return;
    finished = true;
    clearTimeout(safetyTimer); clearTimeout(endTimer); clearTimeout(imageTimer);
    releaseImageWait?.();
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("resize", size);
    document.removeEventListener("visibilitychange", visibility);
    motion.removeEventListener("change", reduce);
    for (const {node, wasInert} of screens) node.inert = wasInert;
    const hadFocus = document.activeElement === cover;
    cover.remove(); document.getElementById("opening-defs")?.remove();
    if (hadFocus) {
      const target = previousFocus !== document.body && previousFocus?.isConnected ? previousFocus :
        screens.find(({node}) => !node.hidden)?.node.querySelector('a:not([hidden]), button:not([disabled])');
      target?.focus({preventScroll:true});
    }
  }
  function scheduleEnd() {
    clearTimeout(endTimer);
    const duration = motion.matches ? SETTINGS.splashReducedMs :
      milliseconds("--opening-exit-delay") + milliseconds("--opening-exit-time");
    endTimer = setTimeout(() => { visuallyFinished = true; finish(); }, duration + SETTINGS.splashCleanupSlackMs);
  }
  function size() {
    const medallion = cover.querySelector(".opening-medallion");
    // The 1000-unit magic stage was drawn around a 380-unit medallion. Use its untransformed
    // width so the pencil flare remains aligned even during the medallion's settling motion.
    const width = parseFloat(getComputedStyle(medallion).width), box = cover.getBoundingClientRect();
    cover.style.setProperty("--opening-magic-scale", String(width / 380));
    const opaqueRadius = parseFloat(css.getPropertyValue("--opening-iris-size")) * 0.3;
    cover.style.setProperty("--opening-iris-scale", String(Math.hypot(box.width, box.height) / 2 / opaqueRadius * 1.05));
  }
  function skip() {
    if (finished || skipping) return;
    skipping = true;
    cover.style.setProperty("--opening-skip-opacity", getComputedStyle(cover).opacity);
    cover.classList.add("is-running", "is-skipping");
    clearTimeout(endTimer);
    endTimer = setTimeout(() => { visuallyFinished = true; finish(); }, SETTINGS.splashSkipMs + SETTINGS.splashCleanupSlackMs);
  }
  function key(e) {
    if (![" ", "Enter", "Escape"].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation(); skip();
  }
  function visibility() { if (document.hidden) finish(true); }
  function reduce() {
    if (finished || skipping) return;
    cover.classList.toggle("is-reduced", motion.matches);
    if (cover.classList.contains("is-running")) scheduleEnd();
  }
  try {
    // Hidden markup fails open if this helper cannot load. Once visible, this timer makes
    // sure even an interrupted animation releases the app and keyboard focus.
    safetyTimer = setTimeout(() => finish(true), SETTINGS.splashSafetyMs);
    cover.hidden = false;
    for (const {node} of screens) node.inert = true;
    cover.style.setProperty("--opening-skip-time", `${SETTINGS.splashSkipMs}ms`);
    cover.style.setProperty("--opening-reduce-time", `${SETTINGS.splashReducedMs}ms`);
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", reduce);
    cover.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopImmediatePropagation(); fingers.add(e.pointerId);
      cover.setPointerCapture(e.pointerId); skip();
    });
    const lift = e => {
      e.preventDefault(); e.stopImmediatePropagation(); fingers.delete(e.pointerId);
      if (visuallyFinished) finish();
    };
    cover.addEventListener("pointerup", lift); cover.addEventListener("pointercancel", lift);
    cover.addEventListener("click", e => { e.preventDefault(); e.stopImmediatePropagation(); skip(); });
    cover.addEventListener("animationend", e => {
      if (e.target !== cover || !["intro-splash-out","intro-reduce","intro-skip"].includes(e.animationName)) return;
      visuallyFinished = true; finish();
    });
    cover.focus({preventScroll:true});
    decorate(cover, css); size(); reduce();
    const art = new Image(); art.src = new URL("../icons/enchanted-book-1024.png", import.meta.url).href;
    // A slow/missing picture can never hold the app closed. Already downloaded artwork
    // decodes immediately offline. No mockup iframe or remote resource is used.
    await Promise.race([art.decode().catch(() => {}), new Promise(resolve => {
      releaseImageWait = resolve;
      imageTimer = setTimeout(resolve, SETTINGS.splashImageWaitMs);
    })]);
    clearTimeout(imageTimer);
    if (finished || skipping) return;
    if (document.hidden) { finish(true); return; }
    frame = requestAnimationFrame(() => {
      cover.classList.add("is-running"); scheduleEnd();
    });
  } catch (error) {
    finish(true);
    console.warn("Opening animation skipped:", error);
  }
}

// No top-level await: loading the library and auto-save never waits for this animation.
startOpening();
