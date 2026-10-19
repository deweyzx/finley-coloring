// settings.js - numbers you can tweak to change how the app behaves.
// Sizes are in page pixels (a page is about 2048 x 2732 pixels).

export const SETTINGS = {
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

  // How far (in pixels) the color reaches in under the edge of the lines. This hides
  // any thin white rim between the color and the line. The lines sit on top, so the
  // extra color is never visible.
  fillUnderLines: 2,
};
