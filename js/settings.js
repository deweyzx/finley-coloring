// settings.js - numbers you can tweak to change how the app behaves.
// Sizes are in page pixels (a page is about 2048 x 2732 pixels).

export const SETTINGS = {
  // ---------- Offline access and backups (step 11) ----------
  // If the offline helper stops replying, let her try again instead of waiting forever.
  offlineReplyMs: 30000,
  offlineDownloadReplyMs: 120000,
  // Backups keep compressed pictures, not giant uncompressed copies of every canvas.
  backupMaxPages: 2000,
  backupMaxHeaderBytes: 2 * 1024 * 1024,
  backupMaxFileBytes: 2 * 1024 * 1024 * 1024,
  backupMaxImageBytes: 64 * 1024 * 1024,
  backupMaxPixels: 16 * 1024 * 1024,
  // ---------- Blender and Blur (step 10, batch 3) ----------
  // Wider color sampling gives a gradual transition instead of a narrow smeared seam.
  // Each averaged tile is still calculated only once, never once per overlapping dab.
  blendRadiusShare: 0.30,
  blendMaxRadius: 16,
  blurRadiusShare: 0.22,
  blurMaxRadius: 12,
  // Blender keeps a small patch of picked-up paint on its tip. This is how far
  // (in brush widths) it carries that paint before mostly replacing it with new paint.
  blendCarryDistance: 2.5,
  // A small grid retains separate color streaks across the tip instead of averaging
  // the entire brush into one flat color. More cells cost more work per dab.
  blendTipGrid: 12,
  // Smooth that small tip grid once per dab, then use fast pixel lookups.
  blendTipPixels: 32,
  // Blender gives colored pixels more weight than bare paper. This fills the tooth
  // of pencil strokes without turning a rich color into a milky average with white.
  // 0 = ordinary averaging (like Blur); 1 = fully favor pigment over white paper.
  blendPigmentWeight: 0.9,
  // At most this many small, smoothed tiles stay cached (about 1.2 MB).
  blendCacheTiles: 96,
  // ---------- Tap-to-fill ----------

  // Gap closing: breaks in a line up to about TWICE this many pixels wide are treated
  // as closed, so a fill doesn't leak through a small break in an outline.
  // 0 = off. Bigger closes bigger gaps, but very thin areas may need an extra tap.
  gapClosing: 4,

  // Gap closing cuts off thin parts of an area (wedges where a vein meets the outline,
  // strips between close lines, tight curves of a ruffled edge). After each fill, white
  // patches like that touching the fill are filled too, if:
  //   - no spot in the patch is farther than thinPatchWidth pixels from a line, and
  //   - the patch is no bigger than thinPatchLimit pixels.
  // Wider or bigger patches are other areas (another petal, the background) reached
  // through a real gap, so they are left alone. thinPatchLimit: 0 = off.
  thinPatchWidth: 9,
  thinPatchLimit: 8000,

  // Black specks smaller than this many pixels don't count as lines, so a stray dot
  // doesn't block a fill.
  ignoreSpecks: 30,

  // A tap that lands exactly on a line fills the nearest open spot up to this many
  // SCREEN pixels away (about a fingertip), instead of doing nothing.
  tapReach: 10,

  // ---------- Keeping the ink up with the Pencil (step 10) ----------

  // The iPad hands the Pencil's position to the page a moment after it moves, so the ink would
  // trail a little behind the tip. To hide that, each screen update also draws where the Pencil
  // is about to be, this many milliseconds ahead (a guess from how it's moving; it's taken back
  // and replaced by the real stroke a moment later). 0 = off. Too big = the ink can overshoot
  // for a split second at sharp turns and sudden stops.
  predictAheadMs: 20,
  // ...but never more than this many SCREEN pixels ahead of the tip.
  predictMaxPx: 24,
  // Brushes reaching more than this many SCREEN pixels from their middle are redrawn at most
  // about 60 times a second instead of up to 120: half the drawing work, at most 8 ms later.
  fullRateMaxBrushPx: 12,

  // Big brushes skip this: when the brush reaches more than this many SCREEN pixels from its
  // middle, the Pencil tip is well inside the paint anyway (no gap to see), and drawing the
  // guess for a big brush would cost a lot of work on every screen update.
  predictMaxBrushPx: 32,

  // ---------- Auto-save (step 7) ----------

  // After a change, the page is saved once she has paused for this many milliseconds.
  // (It's also saved right away when she leaves the page or switches away from the app.)
  autosaveDelayMs: 1500,

  // ---------- Finger gestures (step 6) ----------
  // Turn on the touch debug overlay (tap the page title 5 times) to see real numbers
  // for her touches before changing these.

  // A two-finger tap (undo) or three-finger tap (redo) must be over - all fingers up -
  // within this many milliseconds of the first finger landing...
  tapGestureMaxMs: 350,
  // ...and no finger may move more than this many screen pixels (more = zoom/pan).
  tapGestureMoveLimit: 12,
  // A touch the iPad reports as wider than this (screen pixels) is treated as a palm and ignored.
  // Finley has long nails, so she touches with the flat pad of her finger, which the iPad
  // reports as much bigger than a fingertip; at 60 her fingers counted as palms. Palm rejection
  // now relies mostly on timing (fingers are ignored while the Pencil is down and just after),
  // so this only needs to catch a whole hand. The touch log shows each touch's size.
  palmSize: 120,
  // One finger draws and taps to fill (true). Set to false for "Pencil only": then fingers
  // only zoom, pan and do the two/three-finger taps.
  fingersDraw: true,
  // For this many milliseconds after the Pencil lifts, a new finger can't draw (it's probably
  // her hand), but it can still be part of a two- or three-finger gesture.
  afterPencilMs: 500,
  // When a finger is drawing and a second finger lands within this many milliseconds,
  // the first finger's stroke is taken back (it was the start of a gesture, not drawing).
  secondFingerMs: 250,

  // How far (in pixels) the color reaches in under the edge of the lines. This hides
  // any thin white rim between the color and the line. The lines sit on top, so the
  // extra color is never visible.
  fillUnderLines: 2,
};
