// stroke-engine.js - turns Pencil movements into brush strokes.
//
// How a stroke is drawn:
//   1. Each Pencil position becomes a "dab" (a small round mark). Between positions, dabs
//      are added at even spacing, with pressure and tilt blended smoothly from one to the next.
//   2. Every dab writes into a "coverage" map for this stroke: how strongly each pixel is
//      covered (0-255). A pixel keeps the STRONGEST coverage any dab gave it, never the sum,
//      so a stroke that crosses itself doesn't get darker blotches.
//      (The airbrush is the exception: its dabs ADD up, like spray paint, up to the opacity
//      slider's value - see "flow" in brushes.js.)
//   3. While she draws, the stroke is shown on its own see-through layer.
//   4. When she lifts the Pencil, the stroke is laid onto the picture. A new stroke over an
//      old one adds up, so she can build up color and shading in layers.
//   5. "Build up color" OFF: going over a spot already painted in the SAME color only adds
//      what's missing to reach this stroke's opacity, so touch-ups stay even instead of
//      getting darker. To know that, the engine remembers for every pixel the last color
//      painted there and how strongly ("paint memory", 4 numbers per pixel).
//
// Extra brush features (each one is switched on by a setting in brushes.js):
//   flow      - airbrush: dabs add up gradually; holding the Pencil still keeps spraying
//   noise     - a fine random speckle in every dab (the droplets of a spray)
//   taper     - the stroke starts thin and swells to full size (a paintbrush tip)
//   bristles  - fine streaks along the stroke, like the hairs of a brush
//   wash      - watercolor: uneven, wobbly edges, and darker rims where the color pools
//   scatter   - splatter: each dab throws droplets of different sizes around it
//   blend     - "multiply": the color is laid on like a see-through glaze (watercolor)
//   effect    - glitter or metallic: the paint's look is worked into each pixel's COLOR when
//               the stroke is drawn (renderEffect), so it's part of the picture itself
//
// The brushes themselves are described in brushes.js.

import { GRAIN, GRAIN_SIZE, WASH, WASH_SIZE, GLITTER, GLITTER_SIZE, CLOUD, CLOUD_SIZE } from "./brushes.js?v=202610202029";

export class StrokeEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.coverage = new Uint8Array(width * height);
    // Paint memory: for every pixel, the red, green, blue of the last paint there and how
    // strongly it was laid on (0-255). 0 strength = never painted.
    this.memory = new Uint8Array(width * height * 4);
    this.box = null;   // the area the whole stroke has touched
    this.dirty = null; // the area changed since the screen was last updated
  }

  // Starts a stroke. settings = { size, opacity } from the sliders; rgb = { r, g, b };
  // buildUp = true: strokes on top deepen the color; false: same-color touch-ups stay even.
  begin(brush, settings, rgb, buildUp = true) {
    this.brush = brush;
    this.settings = settings;
    this.rgb = rgb;
    this.buildUp = buildUp;
    this.last = null;
    this.leftover = 0; // distance already travelled toward the next dab
    this.box = null;
    this.dirty = null;
    this.clip = null;
    this.direction = null; // which way the stroke is heading (for bristles)
    this.baked = false;    // watercolor: rims already worked out (when the stroke is laid on)
    this.flowScale = 1;
    // The airbrush (soft spray that adds up, nothing else) uses the quick loop.
    this.fastSpray = !!(brush.flow && brush.soft && !brush.grain && !brush.wash && !brush.bristles && !brush.scatter);
    this.speckle = this.fastSpray ? speckleTable(brush.noise || 0) : null;
    // Every stroke gets its own random pattern (its own bristles, droplets, watercolor blooms).
    this.seed = (Math.random() * 4294967296) >>> 0 || 1;
    this.rand = makeRandom(this.seed);
    this.bristleTable = brush.bristles ? makeBristles(this.rand) : null;
    this.washShift = [Math.floor(this.rand() * WASH_SIZE), Math.floor(this.rand() * WASH_SIZE)];
    // Watercolor rims: how far in from the edge the darker pooling reaches.
    this.rimRadius = brush.wash ? Math.round(clamp(settings.size * brush.wash.rimWidth, 3, 18)) : 0;
    // Metallic: how far around each pixel to look when working out how rounded the stroke is
    // there (which way it faces the light).
    const lit = brush.effect && brush.effect.kind !== "glitter" ? brush.effect : null;
    // (at most 12 pixels, or the effect's own `maxShine`: more costs a lot of work on every
    // screen update for big brushes)
    this.shineRadius = lit ? Math.round(clamp(settings.size * lit.shine, 1, lit.maxShine || 12)) : 0;
    this.glitterShift = [Math.floor(this.rand() * GLITTER_SIZE), Math.floor(this.rand() * GLITTER_SIZE)];
    // How this stroke is laid onto the picture. (Build-up off keeps touch-ups even, which
    // only works with ordinary painting, so the watercolor glaze is used with build-up on.)
    this.blend = brush.blend === "multiply" && buildUp ? "multiply" : "source-over";
  }

  // Line-lock: only let this stroke paint inside an area, like a stencil.
  // area = { x, y, w, h, mask } from tap-to-fill (mask has a 1 for every pixel allowed),
  // or null to paint anywhere. Works the same for every brush.
  setClip(area) {
    this.clip = area;
  }

  // Adds a Pencil position: { x, y, pressure (0-1), altitude (0 = flat, PI/2 = upright), azimuth }
  addPoint(point) {
    const p = { ...point };
    if (!this.last) {
      p.dist = 0;
      this.dab(p);
      this.last = p;
      return;
    }
    const a = this.last;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    p.dist = a.dist + length;
    // The stroke's direction, smoothed so tiny wobbles don't twist the bristles.
    const heading = Math.atan2(dy, dx);
    this.direction = this.direction === null ? heading : turnToward(this.direction, heading, Math.min(1, length / 8));
    let travelled = -this.leftover;
    for (;;) {
      // spacing depends on how big the dab is right here
      const t0 = Math.max(0, travelled) / length;
      const step = Math.max(0.5, this.dabSize(lerpPoint(a, p, t0)) * this.brush.spacing * (this.spacingScale || 1));
      if (travelled + step > length) {
        this.leftover = length - travelled;
        break;
      }
      travelled += step;
      this.dab(lerpPoint(a, p, travelled / length));
    }
    this.last = p;
  }

  // Airbrush: the Pencil is being held still. Keeps spraying where it is, so the color slowly
  // builds up. `frames` = how many screen refreshes (1/60 s each) have passed.
  hold(frames = 1) {
    if (!this.last || !this.brush.flow) return;
    this.flowScale = this.brush.flow.hold * frames;
    const count = this.dabCount;
    this.dab({ ...this.last });
    this.dabCount = count; // (spraying in place doesn't count as moving)
    this.flowScale = 1;
  }

  // How the brush responds to pressure and tilt at one point.
  shape(p) {
    const brush = this.brush;
    const pressure = Math.pow(clamp(p.pressure, 0, 1), brush.pressure.curve);
    const flat = 1 - clamp(p.altitude / (Math.PI / 2), 0, 1); // 0 = upright, 1 = lying flat
    // Tilt only counts once the Pencil leans past about 30 degrees, then grows smoothly.
    const side = smoothStep(clamp((flat - 0.33) / 0.5, 0, 1));
    let sizeFactor = lerp(brush.pressure.size[0], brush.pressure.size[1], pressure);
    if (brush.taper) {
      // A paintbrush tip: thin at the very start, swelling to full size.
      const grown = clamp((p.dist || 0) / (brush.taper.length * this.settings.size), 0, 1);
      sizeFactor *= lerp(brush.taper.start, 1, smoothStep(grown));
    }
    const opacityFactor = lerp(brush.pressure.opacity[0], brush.pressure.opacity[1], pressure);
    const strength = opacityFactor * lerp(1, brush.tilt.opacity, side);
    return {
      pressure,
      side,
      radius: Math.max(0.6, (this.settings.size * sizeFactor) / 2),
      stretch: 1 + brush.tilt.widen * side,
      angle: p.azimuth || 0,
      strength,
      opacity: this.settings.opacity * strength,
      grainFill: brush.grain
        ? lerp(brush.grain.fill[0], brush.grain.fill[1], pressure) * lerp(1, brush.tilt.grainFill, side)
        : 1,
    };
  }

  dabSize(p) {
    const s = this.shape(p);
    return s.radius * 2;
  }

  // One dab: a single mark, or (splatter) a handful of droplets.
  dab(p) {
    this.dabCount = (this.dabCount || 0) + 1;
    const s = this.shape(p);
    if (this.brush.scatter) this.splatter(p, s);
    else this.stamp(p.x, p.y, s);
  }

  // Splatter: droplets of different sizes thrown around the Pencil. More pressure = more of
  // them, thrown farther. Tilting throws them away from the Pencil, in a longer streak.
  splatter(p, s) {
    const sc = this.brush.scatter;
    const rand = this.rand;
    const size = this.settings.size;
    const reach = (size / 2) * lerp(sc.reach[0], sc.reach[1], s.pressure);
    const wanted = lerp(sc.count[0], sc.count[1], s.pressure);
    // e.g. 2.4 droplets = 2, plus a 40% chance of a third
    const count = Math.floor(wanted) + (rand() < wanted % 1 ? 1 : 0);
    const away = s.angle + Math.PI; // the side away from the Pencil's body
    for (let n = 0; n < count; n++) {
      // Most droplets land near the middle; fewer far out.
      const far = Math.pow(rand(), sc.spread);
      const angle = rand() * Math.PI * 2;
      let ox = Math.cos(angle) * far * reach;
      let oy = Math.sin(angle) * far * reach;
      if (s.side > 0) {
        // Tilted: the spray shifts and stretches away from the Pencil.
        const along = ox * Math.cos(away) + oy * Math.sin(away);
        const shift = (along + reach * 0.5) * s.side;
        ox += Math.cos(away) * shift;
        oy += Math.sin(away) * shift;
      }
      // Mostly tiny droplets, some medium, a few big blobs; the far ones are smaller.
      const big = Math.pow(rand(), 2.6);
      const radius = Math.max(0.6, size * lerp(sc.drop[0], sc.drop[1], big) * (1 - 0.45 * far));
      const opacity = s.opacity * (0.85 + 0.15 * rand());
      const x = p.x + ox;
      const y = p.y + oy;
      // a tilted spray throws streaks; otherwise each drop is a slightly squashed blob
      const tilted = s.side * far > 0.15;
      const turn = tilted ? away - Math.PI / 2 : rand() * Math.PI;
      const stretch = tilted ? 1 + s.side * 0.9 * far : 1 + rand() * 0.45;
      this.drop(x, y, radius, stretch, turn, opacity, s.strength, sc.hardness);
      if (radius < 2.5) continue;
      // Bigger drops aren't round: a few little satellite drops cling to the edge, making an
      // irregular splash shape...
      const satellites = 1 + Math.floor(rand() * Math.min(5, radius / 2));
      for (let k = 0; k < satellites; k++) {
        const a = rand() * Math.PI * 2;
        const at = radius * (0.65 + 0.5 * rand());
        this.drop(x + Math.cos(a) * at, y + Math.sin(a) * at, radius * (0.2 + 0.35 * rand()), 1 + rand() * 0.6, rand() * Math.PI, opacity, s.strength, sc.hardness);
      }
      // ...and now and then a big one leaves a short tail of shrinking drops.
      if (radius > 6 && rand() < 0.3) {
        const a = tilted ? away : rand() * Math.PI * 2;
        let r = radius * 0.45;
        let at = radius * 1.1;
        for (let k = 0; k < 4 && r > 0.6; k++) {
          this.drop(x + Math.cos(a) * at, y + Math.sin(a) * at, r, 1.3, a - Math.PI / 2, opacity, s.strength, sc.hardness);
          at += r * 2.2;
          r *= 0.62;
        }
      }
    }
  }

  // One splatter drop (an oval) - see splatter().
  drop(x, y, radius, stretch, turn, opacity, strength, hardness) {
    this.stamp(x, y, { radius, stretch, angle: turn, opacity, strength, grainFill: 1, hardness });
  }

  // Stamps one round (or oval) mark into the coverage map.
  stamp(cx, cy, s) {
    const brush = this.brush;
    const W = this.width;
    const H = this.height;
    // An oval: `stretch` times wider across the tilt direction (side of the lead).
    const rLong = s.radius * s.stretch;
    const rShort = s.radius;
    // the oval's long side runs across the direction the Pencil leans
    const cos = Math.cos(s.angle + Math.PI / 2);
    const sin = Math.sin(s.angle + Math.PI / 2);
    // Only visit pixels the oval can reach: the box that tightly fits the (turned) oval, and on
    // each row just the stretch the oval covers - not a whole square around it. A long tilted
    // oval fills only a third of that square, so this saves a lot of work.
    // (Watercolor's wandering edge can reach a little past the oval.)
    const grow = brush.wash ? 1 / (1 - brush.wash.wobble / 2) : 1;
    const A = rLong * grow;
    const B = rShort * grow;
    const halfW = Math.sqrt(A * A * cos * cos + B * B * sin * sin) + 1;
    const halfH = Math.sqrt(A * A * sin * sin + B * B * cos * cos) + 1;
    let x0 = Math.max(0, Math.floor(cx - halfW));
    let x1 = Math.min(W - 1, Math.ceil(cx + halfW));
    let y0 = Math.max(0, Math.floor(cy - halfH));
    let y1 = Math.min(H - 1, Math.ceil(cy + halfH));
    const clip = this.clip;
    if (clip) {
      // Line-lock: only the part of the dab inside the stencil's box can paint.
      x0 = Math.max(x0, clip.x);
      y0 = Math.max(y0, clip.y);
      x1 = Math.min(x1, clip.x + clip.w - 1);
      y1 = Math.min(y1, clip.y + clip.h - 1);
    }
    if (x0 > x1 || y0 > y1) return;

    // For the row spans: the oval's edge on row dy is where qa*dx^2 + qb*dx + qc = 0.
    const qa = (cos * cos) / (A * A) + (sin * sin) / (B * B);
    const qbRow = 2 * cos * sin * (1 / (A * A) - 1 / (B * B));
    const qcRow = (sin * sin) / (A * A) + (cos * cos) / (B * B);
    const hard = s.hardness !== undefined ? s.hardness : brush.hardness;
    const peak = s.opacity * 255;
    // Small dabs get a softer edge so thin lines stay smooth instead of jagged.
    const edge = Math.max(1 - hard, 1 / Math.max(1, rShort));
    const inner = 1 - edge;
    const grain = brush.grain;
    const grainFill = s.grainFill;
    const grainSoft = 0.3; // how gradually the grain fills in
    const cov = this.coverage;

    // Extra features (see the top of this file); all off for pencil, marker and eraser.
    const soft = !!brush.soft; // a rounded "bell" fade instead of a straight one (airbrush)
    const flow = brush.flow;
    const cap = this.settings.opacity * 255;         // airbrush: never more than the slider
    const rate = flow ? flow.amount * s.strength * this.flowScale : 0;
    const noise = brush.noise || 0;
    const bristles = this.bristleTable;
    const bristleStrength = bristles ? brush.bristles.strength : 0;
    const bristleWidth = bristles ? Math.max(1.4, this.settings.size * brush.bristles.width) : 1;
    const dir = this.direction || 0;
    const nx = -Math.sin(dir); // across the stroke
    const ny = Math.cos(dir);
    const wash = brush.wash;
    const wobble = wash ? wash.wobble : 0;
    const sx = this.washShift[0];
    const sy = this.washShift[1];
    let rng = this.seed ^ ((x0 * 73856093) ^ (y0 * 19349663)); // quick random numbers for speckle
    if (rng === 0) rng = 1;

    if (this.fastSpray) {
      // Airbrush: the same soft, speckled spray, worked out the quick way (see sprayRows).
      sprayRows(this, cx, cy, x0, y0, x1, y1, cos, sin, rLong, rShort, qa, qbRow, qcRow, cap, rate, rng);
      this.box = growBox(this.box, x0, y0, x1, y1);
      this.dirty = growBox(this.dirty, x0, y0, x1, y1);
      return;
    }

    // the area of pixels this dab actually changes (none yet)
    let cx0 = W;
    let cx1 = -1;
    let cy0 = H;
    let cy1 = -1;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      // where this row crosses the oval (skip the row if it doesn't)
      const qb = qbRow * dy;
      const qc = qcRow * dy * dy - 1;
      const disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const root = Math.sqrt(disc);
      const xs = Math.max(x0, Math.floor(cx + (-qb - root) / (2 * qa) - 0.5));
      const xe = Math.min(x1, Math.ceil(cx + (-qb + root) / (2 * qa) - 0.5));
      const row = y * W;
      const grainRow = (y & (GRAIN_SIZE - 1)) * GRAIN_SIZE;
      const cloudRow = ((y + sx) & (CLOUD_SIZE - 1)) * CLOUD_SIZE;
      const clipRow = clip ? (y - clip.y) * clip.w - clip.x : 0;
      for (let x = xs; x <= xe; x++) {
        if (clip && clip.mask[clipRow + x] === 0) continue; // outside the locked area
        // Already as strong as this dab could ever make it? Then nothing to do here. (Dabs
        // overlap a lot, so this skips most of each dab's middle; the result is exactly the same.)
        if (!flow && cov[row + x] >= peak) continue;
        const dx = x + 0.5 - cx;
        const u = (dx * cos + dy * sin) / rLong;
        const v = (-dx * sin + dy * cos) / rShort;
        let d = Math.sqrt(u * u + v * v);
        if (wash) {
          // Watercolor: the wet edge wanders in and out in soft, cloud-like shapes. (Where the
          // pigment pools and thins is worked in later, once per pixel - see washAlphaLive.)
          d += (CLOUD[cloudRow + ((x + sy) & (CLOUD_SIZE - 1))] / 255 - 0.5) * wobble;
        }
        if (d >= 1) continue;
        let a = d <= inner ? 1 : (1 - d) / edge;
        if (soft) a = a * a * (3 - 2 * a);
        if (grain) {
          // Paper tooth: pigment reaches the high points first; more pressure fills more in.
          const g = GRAIN[grainRow + (x & (GRAIN_SIZE - 1))] / 255;
          const reached = clamp((g - (1 - grainFill)) / grainSoft + 0.5, 0, 1);
          a *= 1 - grain.strength + grain.strength * reached;
        }
        if (bristles) {
          // Brush hairs: which hair passes over this spot depends on how far it is across
          // the stroke, so each hair leaves its own faint streak along the stroke.
          const pos = (dx * nx + dy * ny) / bristleWidth + 32;
          const i0 = Math.floor(pos);
          const f = pos - i0;
          const b0 = bristles[i0 & 63];
          const hair = b0 + (bristles[(i0 + 1) & 63] - b0) * f * f * (3 - 2 * f);
          a *= 1 - bristleStrength * (1 - hair);
        }
        if (noise) {
          rng ^= rng << 13;
          rng ^= rng >>> 17;
          rng ^= rng << 5;
          a *= 1 - noise * ((rng >>> 0) / 4294967296);
        }
        const i = row + x;
        if (flow) {
          // Airbrush: add a little more each time, getting closer to the slider's opacity.
          const c = cov[i];
          if (c >= cap) continue;
          rng ^= rng << 13;
          rng ^= rng >>> 17;
          rng ^= rng << 5;
          // (the random part rounds tiny amounts up or down fairly, so light spray still adds up)
          const next = Math.floor(c + (cap - c) * rate * a + (rng >>> 0) / 4294967296);
          if (next > c) {
            cov[i] = next > cap ? cap : next;
            if (x < cx0) cx0 = x;
            if (x > cx1) cx1 = x;
            if (y < cy0) cy0 = y;
            cy1 = y;
          }
          continue;
        }
        const value = a * peak;
        if ((value | 0) > cov[i]) {
          cov[i] = value;
          if (x < cx0) cx0 = x;
          if (x > cx1) cx1 = x;
          if (y < cy0) cy0 = y;
          cy1 = y;
        }
      }
    }
    // Only the pixels this dab actually changed need drawing again (with a moving brush that's
    // just a thin crescent at the front, not the dab's whole square).
    if (cx1 < 0) return;
    this.box = growBox(this.box, cx0, cy0, cx1, cy1);
    this.dirty = growBox(this.dirty, cx0, cy0, cx1, cy1);
  }

  // Shows the changed part of the stroke on the stroke layer (call once per screen update).
  render(ctx) {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    let { x0, y0, x1, y1 } = d;
    // Watercolor: a change also changes the rims around it, so redraw a bit more.
    const rims = this.brush.wash && !this.baked;
    if (rims) {
      const r = this.rimRadius;
      x0 = Math.max(0, x0 - r);
      y0 = Math.max(0, y0 - r);
      x1 = Math.min(this.width - 1, x1 + r);
      y1 = Math.min(this.height - 1, y1 + r);
    }
    if (this.brush.effect) {
      // Metallic: a change also changes the shine around it (how rounded the stroke looks). The
      // blur that tells how rounded it is runs twice, so it reaches twice its radius (+1 for the
      // slope).
      const r = this.shineRadius ? 2 * this.shineRadius + 1 : 0;
      if (r > 0) {
        x0 = Math.max(0, x0 - r);
        y0 = Math.max(0, y0 - r);
        x1 = Math.min(this.width - 1, x1 + r);
        y1 = Math.min(this.height - 1, y1 + r);
      }
      this.renderEffect(ctx, x0, y0, x1, y1);
      return;
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    // Where the strength of each pixel comes from: the coverage map itself, or (watercolor)
    // the coverage with darker rims worked in.
    let src = this.coverage;
    let srcStart = y0 * this.width + x0;
    let srcStride = this.width;
    if (rims) {
      // (while she draws: the quick estimate of the rims; the exact ones are worked out once,
      // when she lifts the Pencil - see commit)
      src = this.washAlphaLive(x0, y0, x1, y1);
      srcStart = 0;
      srcStride = w;
    }
    const { image, px32: block32 } = this.pixelBlock(w, h);
    const stride = w;
    const px = image.data;
    const { r, g, b } = this.rgb;
    const mem = this.memory;
    // (The eraser always just rubs out; "build up" only changes how colors go on.)
    const evenOut = !this.buildUp && this.brush.paint !== "paper";
    if (!evenOut && LITTLE_ENDIAN) {
      // The usual case, done the quick way: each pixel is written as one number (red, green,
      // blue and strength together) instead of four separate ones.
      const px32 = block32;
      const color = (b << 16) | (g << 8) | r;
      for (let row = 0; row < h; row++) {
        let si = srcStart + row * srcStride;
        let p = row * stride;
        for (let col = 0; col < w; col++, si++, p++) {
          const c = src[si];
          px32[p] = c === 0 ? 0 : color | (c << 24);
        }
      }
      ctx.putImageData(image, x0, y0);
      return;
    }
    for (let row = 0; row < h; row++) {
      let i = (y0 + row) * this.width + x0;
      let si = srcStart + row * srcStride;
      let p = row * stride * 4;
      for (let col = 0; col < w; col++, i++, si++, p += 4) {
        let c = src[si];
        px[p + 3] = 0; // (the reused block may still hold an older update here)
        if (c === 0) continue;
        if (evenOut) {
          const m = i * 4;
          const had = mem[m + 3];
          if (had > 0 && mem[m] === r && mem[m + 1] === g && mem[m + 2] === b) {
            // Already painted this color with strength `had`: only add what's missing.
            // (Laying the color on at strength x over it brings it to `c` exactly when
            // x = (c - had) / (1 - had).)
            if (c <= had) continue;
            c = had >= 255 ? 0 : Math.round(((c - had) / (255 - had)) * 255);
            if (c === 0) continue;
          }
        }
        px[p] = r;
        px[p + 1] = g;
        px[p + 2] = b;
        px[p + 3] = c;
      }
    }
    ctx.putImageData(image, x0, y0);
  }

  // A block of pixels exactly w x h for one screen update, on memory that is kept and reused.
  // (Making new memory on every update - up to 120 times a second - makes Safari stop now and
  // then to clean up; and handing Safari a block bigger than the changed area can make it work
  // on the whole block every time.)
  pixelBlock(w, h) {
    const bytes = w * h * 4;
    if (!this.pixelMemory || this.pixelMemory.byteLength < bytes) {
      this.pixelMemory = new ArrayBuffer(Math.ceil((bytes * 1.25) / 4) * 4);
    }
    const data = new Uint8ClampedArray(this.pixelMemory, 0, bytes);
    return { image: new ImageData(data, w, h), px32: new Uint32Array(this.pixelMemory, 0, w * h) };
  }

  // Glitter and metallic: draws an area of the stroke with the paint's look worked into each
  // pixel's color. The strength of each pixel (and so line-lock, build-up and the paint memory)
  // works exactly as for any other brush; only the color changes from pixel to pixel.
  renderEffect(ctx, x0, y0, x1, y1) {
    const W = this.width;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const { image } = this.pixelBlock(w, h);
    const stride = w;
    const px = image.data;
    const { r, g, b } = this.rgb;
    const cov = this.coverage;
    const mem = this.memory;
    const evenOut = !this.buildUp;
    const fx = this.brush.effect;
    const glitter = fx.kind === "glitter";
    // (the effect's settings, read once here rather than for every pixel)
    const join = !!fx.join;
    const sheen = fx.sheen || 0;
    const flake = fx.flake || 0;
    const mica = fx.mica || 0;
    const base = fx.base || 0;
    const sparkle = fx.sparkle || 0;

    // Metallic: how rounded the paint is around each pixel, from a blurred copy of it
    // (the middle of a stroke is "higher" than its edges), so we can tell
    // which way it faces. For metallic the same color already on the page counts too (from the
    // paint memory), so coloring in an area with many strokes makes one smooth, shiny surface.
    let blur = null;
    let bx0 = 0;
    let by0 = 0;
    let bw = 0;
    let bh = 0;
    let bump = 0;
    let glossTable = null;
    if (!glitter) {
      const rad = this.shineRadius;
      const reach = 2 * rad + 1; // (the blur runs twice, plus one pixel for the slope)
      bx0 = Math.max(0, x0 - reach);
      by0 = Math.max(0, y0 - reach);
      const bx1 = Math.min(W - 1, x1 + reach);
      const by1 = Math.min(this.height - 1, y1 + reach);
      bw = bx1 - bx0 + 1;
      bh = by1 - by0 + 1;
      if (!this.surface || this.surface.length < bw * bh) this.surface = new Uint8Array(bw * bh);
      const surface = this.surface;
      for (let row = 0; row < bh; row++) {
        let si = (by0 + row) * W + bx0;
        let o = row * bw;
        for (let col = 0; col < bw; col++, si++, o++) {
          const now = cov[si];
          if (join) {
            const m = si * 4;
            const before = mem[m + 3] > 0 && mem[m] === r && mem[m + 1] === g && mem[m + 2] === b ? mem[m + 3] : 0;
            surface[o] = now > before ? now : before;
          } else {
            surface[o] = now;
          }
        }
      }
      if (!this.blurKeep) this.blurKeep = {};
      blur = boxBlur(surface, bw, 0, 0, bw, bh, rad, this.blurKeep);
      // (steepness: the same whatever the opacity, a bit gentler for wide strokes)
      bump = (fx.bump * rad) / Math.max(1, this.settings.opacity * 255) / 2;
      // how bright the highlight is for each "facing" value 0-1, from a table
      if (!this.glossTable || this.glossFor !== fx) {
        this.glossTable = new Float32Array(1025);
        for (let k = 0; k <= 1024; k++) this.glossTable[k] = Math.pow(k / 1024, fx.gloss) * fx.highlight;
        this.glossFor = fx;
      }
      glossTable = this.glossTable;
    }
    // Light comes from the top left, a little in front of the page.
    const Lx = -0.45, Ly = -0.55, Lz = 0.7;
    const Ll = Math.hypot(Lx, Ly, Lz);
    const lx = Lx / Ll, ly = Ly / Ll, lz = Lz / Ll;
    const hl = Math.hypot(lx, ly, lz + 1); // halfway between the light and her eye
    const hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl;
    // The highlight color: the paint's own color, almost white.
    const hr = r + (255 - r) * 0.85, hg = g + (255 - g) * 0.85, hb = b + (255 - b) * 0.85;
    // Metallic shadows are a deeper, richer version of the color itself (gold goes warm brown,
    // not grey): the color "multiplied by itself".
    const dr = (r * r) / 255, dg = (g * g) / 255, db = (b * b) / 255;
    // Glitter: the base between flakes, and how strong a full coat is (for sparse light strokes).
    const peak = Math.max(1, this.settings.opacity * 255);
    const gs = this.glitterShift;
    const GM = GLITTER_SIZE - 1;

    for (let row = 0; row < h; row++) {
      const y = y0 + row;
      let i = y * W + x0;
      let p = row * stride * 4;
      const gRow = ((y + gs[1]) & GM) * GLITTER_SIZE;
      const grainRow = (y & (GRAIN_SIZE - 1)) * GRAIN_SIZE;
      for (let col = 0; col < w; col++, i++, p += 4) {
        let c = cov[i];
        px[p + 3] = 0; // (the reused block may still hold an older update here)
        if (c === 0) continue;
        if (evenOut) {
          // Build-up off: same as for every brush (see render()).
          const m = i * 4;
          const had = mem[m + 3];
          if (had > 0 && mem[m] === r && mem[m + 1] === g && mem[m + 2] === b) {
            if (c <= had) continue;
            c = had >= 255 ? 0 : Math.round(((c - had) / (255 - had)) * 255);
            if (c === 0) continue;
          }
        }
        const x = x0 + col;
        let R, G, B;
        if (glitter) {
          const t = gRow + ((x + gs[0]) & GM);
          const code = GLITTER.shade[t];
          const amount = c / peak; // 1 = a full coat; less at light pressure and soft edges
          if (code === 0 || GLITTER.pick[t] > amount * 380 - 30) {
            // the darker base between flakes (or a flake that isn't there with light pressure)
            // a deep, rich shade of the color (like colored glue under the glitter), solid inside
            // the stroke so it looks the same over paper and over earlier glitter...
            R = dr * base;
            G = dg * base;
            B = db * base;
            // ...but thinning out toward the stroke's edge, so where strokes overlap the glitter
            // underneath keeps sparkling
            const k = amount > 0.7 ? 1 : amount / 0.7;
            c *= k * k;
          } else {
            // a flake: flat, crisp, with its own brightness
            const v = code / 100;
            if (v <= 1) {
              R = r * v;
              G = g * v;
              B = b * v;
            } else {
              const k = Math.min(1, (v - 1) * 0.85);
              R = r + (255 - r) * k;
              G = g + (255 - g) * k;
              B = b + (255 - b) * k;
            }
            c = c + (255 - c) * 0.6; // flakes are solid pieces: they cover well
          }
          const glint = (GLITTER.spark[t] / 255) * sparkle;
          if (glint > 0) {
            R += (255 - R) * glint;
            G += (255 - G) * glint;
            B += (255 - B) * glint * 0.92; // (a touch warm, like light on glitter)
            c = c + (255 - c) * glint;
          }
        } else {
          // Which way the paint faces here (from the slope of the blurred surface)...
          const bx = x - bx0;
          const by = y - by0;
          const bi = by * bw + bx;
          // (at the very edge of the page there's no neighbour on one side: use this pixel)
          const left = bx > 0 ? bi - 1 : bi;
          const right = bx < bw - 1 ? bi + 1 : bi;
          const up = by > 0 ? bi - bw : bi;
          const down = by < bh - 1 ? bi + bw : bi;
          const gx = (blur[right] - blur[left]) * bump;
          const gy = (blur[down] - blur[up]) * bump;
          const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
          const nx = -gx * inv, ny = -gy * inv, nz = inv;
          // ...how much light it catches (compared with a flat surface)...
          let t = 0.5 + (nx * lx + ny * ly + nz * lz - lz) * 1.6;
          if (sheen) {
            // ...polished reflections, running diagonally: bright and dark bands with fairly
            // sharp edges, like a mirror-like surface reflecting a room. They're fixed to the
            // page (not to the stroke), so strokes side by side join up seamlessly...
            // (read smoothly between the texture's pixels, so the bands have no little steps)
            const fu = (x - y) * 0.25 + 1024;
            const fv = (x + y) * 0.0625;
            const u0 = Math.floor(fu);
            const v0 = Math.floor(fv);
            const tu = fu - u0;
            const tv = fv - v0;
            const m = WASH_SIZE - 1;
            const ra = (v0 & m) * WASH_SIZE;
            const rb = ((v0 + 1) & m) * WASH_SIZE;
            const top = WASH[ra + (u0 & m)] * (1 - tu) + WASH[ra + ((u0 + 1) & m)] * tu;
            const bottom = WASH[rb + (u0 & m)] * (1 - tu) + WASH[rb + ((u0 + 1) & m)] * tu;
            let band = ((top * (1 - tv) + bottom * tv) / 255 - 0.5) * 3.5;
            band = band < -1 ? -1 : band > 1 ? 1 : band;
            band = band * (1.5 - 0.5 * band * band); // (an S-curve: crisper light and dark)
            t += band * sheen * 0.5;
          }
          let grain = 0;
          if (flake || mica) grain = GRAIN[grainRow + (x & (GRAIN_SIZE - 1))] / 255;
          // ...and a fine metal grain.
          if (flake) t += (grain - 0.5) * flake * 2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          if (t < 0.5) {
            if (join) {
              // metallic: from the deep, rich shade of the color up to the color itself
              const k = t * 2;
              R = dr * 0.8 + (r - dr * 0.8) * k;
              G = dg * 0.8 + (g - dg * 0.8) * k;
              B = db * 0.8 + (b - db * 0.8) * k;
            } else {
              const k = 0.6 + 0.8 * t; // (paint: just a little darker in the dips)
              R = r * k;
              G = g * k;
              B = b * k;
            }
          } else {
            const k = (t - 0.5) * (join ? 1.5 : 1.0);
            R = r + (255 - r) * k;
            G = g + (255 - g) * k;
            B = b + (255 - b) * k;
          }
          // the shiny highlight where the paint faces between the light and her eye
          const facing = nx * hx + ny * hy + nz * hz;
          if (facing > 0) {
            const sp = glossTable[(facing * 1024) | 0];
            R += (hr - R) * sp;
            G += (hg - G) * sp;
            B += (hb - B) * sp;
          }
          // metallic ink's tiny bright specks (like mica in the ink)
          if (mica && grain > 0.94) {
            const k = ((grain - 0.94) / 0.06) * mica;
            R += (255 - R) * k;
            G += (255 - G) * k;
            B += (255 - B) * k;
          }
        }
        px[p] = R;
        px[p + 1] = G;
        px[p + 2] = B;
        px[p + 3] = c;
      }
    }
    ctx.putImageData(image, x0, y0);
  }

  // Shows the stroke right up to the Pencil tip - and a little past it, to where the Pencil is
  // about to be (`ahead`, a guess) - without keeping those extra dabs.
  // Why: real dabs are only placed every `spacing`, so the newest one can be up to one spacing
  // behind the tip, and the iPad hands the Pencil's position to the page a moment late. Both
  // look like ink trailing behind the Pencil. So for each screen update: stamp temporary dabs
  // at the tip and ahead of it, draw, then put the coverage back exactly as it was. The next
  // update redraws that area from the real coverage, so the guess never stays on the page.
  // (Not for splatter: its droplets are random, so temporary ones would flicker. Not for
  // watercolor and metallic: redrawing their rims or shine around the tip on every update costs
  // too much.)
  renderAhead(ctx, ahead) {
    if (!this.last || !this.box || this.brush.scatter || this.brush.wash || this.shineRadius > 3) {
      this.render(ctx);
      return;
    }
    const W = this.width;
    const H = this.height;
    // The area temporary dabs could touch: the size of the dab at the tip (the guessed points
    // carry the tip's pressure and tilt, so their dabs are the same size).
    const grow = this.brush.wash ? 1 / (1 - this.brush.wash.wobble / 2) : 1;
    const reach = Math.ceil(this.tipRadius() * grow) + 2;
    let minX = this.last.x;
    let maxX = minX;
    let minY = this.last.y;
    let maxY = minY;
    for (const p of ahead) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const x0 = Math.max(0, Math.floor(minX - reach));
    const y0 = Math.max(0, Math.floor(minY - reach));
    const x1 = Math.min(W - 1, Math.ceil(maxX + reach));
    const y1 = Math.min(H - 1, Math.ceil(maxY + reach));
    if (x0 > x1 || y0 > y1) {
      this.render(ctx);
      return;
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    // Keep a copy of the coverage there (one reused block of memory).
    if (!this.aheadCopy || this.aheadCopy.length < w * h) this.aheadCopy = new Uint8Array(w * h);
    const copy = this.aheadCopy;
    const cov = this.coverage;
    for (let row = 0; row < h; row++) {
      const start = (y0 + row) * W + x0;
      copy.set(cov.subarray(start, start + w), row * w);
    }
    const saved = { last: this.last, leftover: this.leftover, direction: this.direction, dabCount: this.dabCount, box: this.box };
    // A dab right at the tip, then on toward where the Pencil is heading - with the dabs three
    // times farther apart than usual: they're only on screen for one update, so nobody can see
    // the difference, and it saves a lot of work.
    this.dab({ ...this.last });
    this.leftover = 0;
    this.spacingScale = 3;
    for (const p of ahead) this.addPoint(p);
    this.spacingScale = 1;
    this.render(ctx);
    // Put everything back as it was.
    for (let row = 0; row < h; row++) {
      cov.set(copy.subarray(row * w, row * w + w), (y0 + row) * W + x0);
    }
    Object.assign(this, saved);
    // The next update redraws this area from the real coverage (taking the temporary dabs away).
    this.dirty = growBox(this.dirty, x0, y0, x1, y1);
  }

  // How far the dab at the Pencil tip reaches from its middle (the long side of the oval), in
  // page pixels. 0 before the stroke has started.
  tipRadius() {
    if (!this.last) return 0;
    const s = this.shape(this.last);
    return s.radius * s.stretch;
  }

  // Watercolor: the stroke's strength in an area, with the pooled darker rims worked in. A pixel
  // is "near the rim" when its surroundings are weaker than itself (it sits just inside the edge
  // of the wet patch, or against a line when line-lock is on). The surroundings are 8 neighbours
  // `rimRadius` away (4 straight, 4 diagonal) plus the pixel itself. (This used to be a full
  // blur of the area on every screen update; at big sizes that froze her iPad for whole seconds.
  // The 8-neighbour version looks the same - on average 2 out of 255 different - and needs no
  // extra memory. The same is used for the finished stroke, so nothing changes at lift.)
  washAlphaLive(x0, y0, x1, y1) {
    const W = this.width;
    const H = this.height;
    const R = this.rimRadius;
    const D = Math.round(R * 0.7);
    const wash = this.brush.wash;
    const uneven = wash.uneven;
    const granulate = wash.granulate || 0;
    const sx = this.washShift[0];
    const sy = this.washShift[1];
    const cov = this.coverage;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const out = this.rimBlock(w * h);
    for (let row = 0; row < h; row++) {
      const y = y0 + row;
      const washRow = ((y + sy) & (WASH_SIZE - 1)) * WASH_SIZE;
      const grainRow = (y & (GRAIN_SIZE - 1)) * GRAIN_SIZE;
      // rows R and D above/below (or -1 = off the page, counts as empty)
      const up = y - R >= 0 ? (y - R) * W : -1;
      const down = y + R < H ? (y + R) * W : -1;
      const upD = y - D >= 0 ? (y - D) * W : -1;
      const downD = y + D < H ? (y + D) * W : -1;
      const here = y * W;
      let o = row * w;
      for (let x = x0; x <= x1; x++, o++) {
        const c = cov[here + x];
        if (c === 0) continue;
        const l = x - R >= 0 ? cov[here + x - R] : 0;
        const rr = x + R < W ? cov[here + x + R] : 0;
        const u = up >= 0 ? cov[up + x] : 0;
        const d = down >= 0 ? cov[down + x] : 0;
        const xl = x - D >= 0;
        const xr = x + D < W;
        const ul = upD >= 0 && xl ? cov[upD + x - D] : 0;
        const ur = upD >= 0 && xr ? cov[upD + x + D] : 0;
        const dl = downD >= 0 && xl ? cov[downD + x - D] : 0;
        const dr = downD >= 0 && xr ? cov[downD + x + D] : 0;
        const around = c * 0.2 + (l + rr + u + d) * 0.1 + (ul + ur + dl + dr) * 0.1;
        let rim = ((c - around) / c) * wash.rimGain;
        rim = rim < 0 ? 0 : rim > 1 ? 1 : rim;
        let value = c * (wash.middle + wash.rim * rim);
        // patchy, like pigment pooling in some places and thinning in others...
        const p = WASH[washRow + ((x + sx) & (WASH_SIZE - 1))] / 255;
        value *= 1 - uneven * p * p * (3 - 2 * p);
        // ...and settling into the dips of the paper (a fine, grainy look)
        if (granulate) value *= 1 - granulate * (1 - GRAIN[grainRow + (x & (GRAIN_SIZE - 1))] / 255);
        out[o] = value > 255 ? 255 : value;
      }
    }
    return out;
  }

  // A reused block of `n` strengths, all 0 (for the watercolor rims).
  rimBlock(n) {
    if (!this.rimMemory || this.rimMemory.length < n) this.rimMemory = new Uint8Array(Math.ceil(n * 1.25));
    const out = this.rimMemory.subarray(0, n);
    out.fill(0);
    return out;
  }

  // Lays the finished stroke onto the picture, then clears the stroke layer.
  // beforeChange(box) is called just before the picture changes (undo saves a copy then).
  // Returns the area it changed, or null if nothing was drawn.
  commit(strokeCtx, colorCtx, beforeChange) {
    const box = this.box;
    if (!box) return null;
    const w = box.x1 - box.x0 + 1;
    const h = box.y1 - box.y0 + 1;
    if (this.brush.wash && !this.baked) {
      // Work the rims into the coverage once and for all, so the paint memory matches what's on
      // the page. They're worked out the same quick way as while she drew (washAlphaLive), so
      // the stroke doesn't change when she lifts the Pencil, and lifting stays quick. Only the
      // part changed since the last screen update is drawn again (plus the rim reach around it,
      // whose rims that change can have moved).
      const shaped = this.washAlphaLive(box.x0, box.y0, box.x1, box.y1);
      for (let row = 0; row < h; row++) {
        this.coverage.set(shaped.subarray(row * w, row * w + w), (box.y0 + row) * this.width + box.x0);
      }
      this.baked = true;
      const d = this.dirty;
      if (d) {
        const r = this.rimRadius;
        this.dirty = {
          x0: Math.max(0, d.x0 - r),
          y0: Math.max(0, d.y0 - r),
          x1: Math.min(this.width - 1, d.x1 + r),
          y1: Math.min(this.height - 1, d.y1 + r),
        };
      }
    }
    this.render(strokeCtx);
    if (beforeChange) beforeChange({ x: box.x0, y: box.y0, w, h });
    colorCtx.globalCompositeOperation = this.blend;
    colorCtx.drawImage(strokeCtx.canvas, box.x0, box.y0, w, h, box.x0, box.y0, w, h);
    colorCtx.globalCompositeOperation = "source-over";
    strokeCtx.clearRect(box.x0, box.y0, w, h);
    this.remember(box);
    for (let y = box.y0; y <= box.y1; y++) {
      this.coverage.fill(0, y * this.width + box.x0, y * this.width + box.x1 + 1);
    }
    this.box = null;
    this.last = null;
    // Very big working blocks (from drawing a whole big stroke at once, just now) are let go, so
    // they don't keep taking up the iPad's memory; everyday-sized ones are kept for reuse.
    if (this.pixelMemory && this.pixelMemory.byteLength > 8e6) this.pixelMemory = null;
    if (this.rimMemory && this.rimMemory.length > 2e6) this.rimMemory = null;
    return { x: box.x0, y: box.y0, w, h };
  }
}

// Paint memory after a stroke: each touched pixel now holds this color at this strength
// (or, for an even-out touch-up of the same color, at the stronger of the two).
// The eraser is different: it doesn't paint "white", it weakens what's there. A pixel
// erased by 30% keeps its color in the memory at 70% of its old strength, so painting the
// same color over it later adds exactly what's missing (no darker edges where the eraser's
// soft edge only partly erased). Fully erased pixels are forgotten.
StrokeEngine.prototype.remember = function (box) {
  const { r, g, b } = this.rgb;
  const cov = this.coverage;
  const mem = this.memory;
  const erasing = this.brush.paint === "paper";
  for (let y = box.y0; y <= box.y1; y++) {
    for (let i = y * this.width + box.x0, end = y * this.width + box.x1; i <= end; i++) {
      const c = cov[i];
      if (c === 0) continue;
      const m = i * 4;
      if (erasing) {
        const left = Math.round((mem[m + 3] * (255 - c)) / 255);
        if (left === 0) mem[m] = mem[m + 1] = mem[m + 2] = mem[m + 3] = 0;
        else mem[m + 3] = left;
        continue;
      }
      const same = mem[m + 3] > 0 && mem[m] === r && mem[m + 1] === g && mem[m + 2] === b;
      if (!this.buildUp && same) {
        if (c > mem[m + 3]) mem[m + 3] = c;
      } else {
        mem[m] = r;
        mem[m + 1] = g;
        mem[m + 2] = b;
        mem[m + 3] = c;
      }
    }
  }
};

// Paint memory after a fill: the filled pixels are now solid `rgb`.
StrokeEngine.prototype.rememberFill = function (area, rgb) {
  const mem = this.memory;
  for (let row = 0; row < area.h; row++) {
    for (let col = 0; col < area.w; col++) {
      if (!area.mask[row * area.w + col]) continue;
      const m = ((area.y + row) * this.width + area.x + col) * 4;
      mem[m] = rgb.r;
      mem[m + 1] = rgb.g;
      mem[m + 2] = rgb.b;
      mem[m + 3] = 255;
    }
  }
};

// Takes the current stroke back without leaving any mark (e.g. a finger stroke that turned
// out to be the start of a two-finger gesture).
StrokeEngine.prototype.cancel = function (strokeCtx) {
  const box = this.box && this.dirty ? growBox(this.box, this.dirty.x0, this.dirty.y0, this.dirty.x1, this.dirty.y1) : this.box;
  if (box) {
    // (watercolor rims can reach a little past the stroke's own box)
    const r = this.rimRadius || 0;
    strokeCtx.clearRect(box.x0 - r, box.y0 - r, box.x1 - box.x0 + 1 + 2 * r, box.y1 - box.y0 + 1 + 2 * r);
    for (let y = box.y0; y <= box.y1; y++) {
      this.coverage.fill(0, y * this.width + box.x0, y * this.width + box.x1 + 1);
    }
  }
  this.box = null;
  this.dirty = null;
  this.last = null;
};

// Most computers and every iPad store a number's smallest byte first; render()'s quick path
// relies on that (and falls back to the slower path otherwise).
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

// ---------- The quick airbrush ----------
// The airbrush stamps big, soft dabs many times a second, so its inner loop is kept as simple
// as possible. It gives the same result as the general loop in stamp(), but:
//   - the bell-shaped fade is looked up in a table by the squared distance (no square roots),
//   - the oval's position is stepped along each row (no multiplying per pixel),
//   - the random speckle and the fair rounding come from ready-made tables of random numbers.

const BELL_STEPS = 1024;
// Strength at squared distance q (0 = middle, 1 = edge): a bell-shaped fade, like `soft` in stamp().
const SPRAY_BELL = new Float32Array(BELL_STEPS + 1);
for (let j = 0; j <= BELL_STEPS; j++) {
  const a = 1 - Math.sqrt(Math.min(1, (j + 0.5) / BELL_STEPS));
  SPRAY_BELL[j] = a * a * (3 - 2 * a);
}
const RANDOM_SIZE = 16384; // (a power of 2)
const RANDOM_TABLE = new Float32Array(RANDOM_SIZE);
{
  const rand = makeRandom(12345);
  for (let k = 0; k < RANDOM_SIZE; k++) RANDOM_TABLE[k] = rand();
}
const speckleTables = new Map(); // noise amount -> table of (1 - noise * random)
function speckleTable(noise) {
  if (!speckleTables.has(noise)) {
    const t = new Float32Array(RANDOM_SIZE);
    const rand = makeRandom(67890);
    for (let k = 0; k < RANDOM_SIZE; k++) t[k] = 1 - noise * rand();
    speckleTables.set(noise, t);
  }
  return speckleTables.get(noise);
}

function sprayRows(engine, cx, cy, x0, y0, x1, y1, cos, sin, rLong, rShort, qa, qbRow, qcRow, cap, rate, rng) {
  const W = engine.width;
  const cov = engine.coverage;
  const clip = engine.clip;
  const speckle = engine.speckle;
  const rounding = RANDOM_TABLE;
  const mask = RANDOM_SIZE - 1;
  const ua = cos / rLong; // how u and v change from one pixel to the next along a row
  const va = -sin / rShort;
  let k = (rng >>> 0) & mask; // where in the random tables this dab starts
  const k2 = ((rng >>> 14) | 1) & mask; // (a different place for the rounding numbers)
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const qb = qbRow * dy;
    const qc = qcRow * dy * dy - 1;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    const xs = Math.max(x0, Math.floor(cx + (-qb - root) / (2 * qa) - 0.5));
    const xe = Math.min(x1, Math.ceil(cx + (-qb + root) / (2 * qa) - 0.5));
    const dx0 = xs + 0.5 - cx;
    let u = (dx0 * cos + dy * sin) / rLong;
    let v = (-dx0 * sin + dy * cos) / rShort;
    const row = y * W;
    const clipRow = clip ? (y - clip.y) * clip.w - clip.x : 0;
    for (let x = xs; x <= xe; x++, u += ua, v += va) {
      k = (k + 1) & mask;
      if (clip && clip.mask[clipRow + x] === 0) continue; // outside the locked area
      const q = u * u + v * v;
      if (q >= 1) continue;
      const i = row + x;
      const c = cov[i];
      if (c >= cap) continue;
      const next = Math.floor(c + (cap - c) * rate * SPRAY_BELL[(q * BELL_STEPS) | 0] * speckle[k] + rounding[(k + k2) & mask]);
      if (next > c) cov[i] = next > cap ? cap : next;
    }
  }
}

// Averages each pixel with its neighbours up to `r` pixels away (twice, for a smooth result).
// Reads a w x h area of `src` (a full-page map, `stride` wide) starting at x0, y0.
// `keep` (optional) is an object that holds the working memory between calls, so it can be
// reused instead of made new each time (the screen is updated many times a second).
function boxBlur(src, stride, x0, y0, w, h, r, keep) {
  let a;
  let b;
  if (keep) {
    if (!keep.a || keep.a.length < w * h) {
      keep.a = new Float32Array(w * h);
      keep.b = new Float32Array(w * h);
    }
    a = keep.a;
    b = keep.b;
  } else {
    a = new Float32Array(w * h);
    b = new Float32Array(w * h);
  }
  for (let row = 0; row < h; row++) {
    const s = (y0 + row) * stride + x0;
    for (let col = 0; col < w; col++) a[row * w + col] = src[s + col];
  }
  for (let pass = 0; pass < 2; pass++) {
    blurLine(a, b, w, h, r, 1, w); // across
    blurLine(b, a, h, w, r, w, 1); // down
  }
  return a;
}

// One direction of the blur: `count` lines of `length` pixels; `step` moves along a line,
// `next` moves to the next line. Pixels past the edges count as empty.
function blurLine(from, to, length, count, r, step, next) {
  const span = 2 * r + 1;
  for (let line = 0; line < count; line++) {
    const start = line * next;
    let sum = 0;
    for (let k = 0; k <= r && k < length; k++) sum += from[start + k * step];
    for (let k = 0; k < length; k++) {
      to[start + k * step] = sum / span;
      const add = k + r + 1;
      const drop = k - r;
      if (add < length) sum += from[start + add * step];
      if (drop >= 0) sum -= from[start + drop * step];
    }
  }
}

// The hairs of a brush: 64 strengths between 0.3 and 1, a few weak hairs among strong ones.
function makeBristles(rand) {
  const hairs = new Float32Array(64);
  for (let k = 0; k < 64; k++) hairs[k] = 0.3 + 0.7 * Math.pow(rand(), 0.6);
  return hairs;
}

// Small repeatable random number maker (the same seed gives the same numbers).
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Turns angle `from` part of the way (`t`, 0-1) toward angle `to`, the short way round.
function turnToward(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function growBox(box, x0, y0, x1, y1) {
  if (!box) return { x0, y0, x1, y1 };
  return {
    x0: Math.min(box.x0, x0),
    y0: Math.min(box.y0, y0),
    x1: Math.max(box.x1, x1),
    y1: Math.max(box.y1, y1),
  };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    altitude: a.altitude + (b.altitude - a.altitude) * t,
    azimuth: b.azimuth,
    dist: a.dist + (b.dist - a.dist) * t,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}
