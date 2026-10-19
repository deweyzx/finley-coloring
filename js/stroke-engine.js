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
//
// The brushes themselves are described in brushes.js.

import { GRAIN, GRAIN_SIZE, WASH, WASH_SIZE } from "./brushes.js?v=202610191633";

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
      const step = Math.max(0.5, this.dabSize(lerpPoint(a, p, t0)) * this.brush.spacing);
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
      // Mostly tiny droplets, a few big ones; the far ones are smaller.
      const big = Math.pow(rand(), 3);
      const radius = Math.max(0.7, size * lerp(sc.drop[0], sc.drop[1], big) * (1 - 0.45 * far));
      this.stamp(p.x + ox, p.y + oy, {
        radius,
        stretch: 1 + s.side * 0.9 * far, // far droplets of a tilted spray are streaks
        angle: away - Math.PI / 2,
        opacity: s.opacity * (0.8 + 0.2 * rand()),
        strength: s.strength,
        grainFill: 1,
        hardness: sc.hardness,
      });
    }
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
    const uneven = wash ? wash.uneven : 0;
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
      const washRow = ((y + sy) & (WASH_SIZE - 1)) * WASH_SIZE;
      const clipRow = clip ? (y - clip.y) * clip.w - clip.x : 0;
      for (let x = xs; x <= xe; x++) {
        if (clip && clip.mask[clipRow + x] === 0) continue; // outside the locked area
        const dx = x + 0.5 - cx;
        const u = (dx * cos + dy * sin) / rLong;
        const v = (-dx * sin + dy * cos) / rShort;
        let d = Math.sqrt(u * u + v * v);
        let w = 0;
        if (wash) {
          // Watercolor: the wet edge wanders in and out a little.
          w = WASH[washRow + ((x + sx) & (WASH_SIZE - 1))] / 255;
          d += (w - 0.5) * wobble;
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
        if (wash) a *= 1 - uneven * w; // patchy, like pigment settling unevenly
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
          if (next > c) cov[i] = next > cap ? cap : next;
          continue;
        }
        const value = a * peak;
        if (value > cov[i]) cov[i] = value;
      }
    }
    this.box = growBox(this.box, x0, y0, x1, y1);
    this.dirty = growBox(this.dirty, x0, y0, x1, y1);
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
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    // Where the strength of each pixel comes from: the coverage map itself, or (watercolor)
    // the coverage with darker rims worked in.
    let src = this.coverage;
    let srcStart = y0 * this.width + x0;
    let srcStride = this.width;
    if (rims) {
      src = this.washAlpha(x0, y0, x1, y1);
      srcStart = 0;
      srcStride = w;
    }
    // One block of pixels is reused for every update (making a new one ~100 times a second
    // made the iPad stop now and then to clean up memory). Only its top-left w x h part is used.
    let image = this.scratch;
    if (!image || image.width < w || image.height < h) {
      image = new ImageData(Math.max(w, image ? image.width : 0), Math.max(h, image ? image.height : 0));
      this.scratch = image;
    }
    const stride = image.width;
    const px = image.data;
    const { r, g, b } = this.rgb;
    const mem = this.memory;
    // (The eraser always just rubs out; "build up" only changes how colors go on.)
    const evenOut = !this.buildUp && this.brush.paint !== "paper";
    if (!evenOut && LITTLE_ENDIAN) {
      // The usual case, done the quick way: each pixel is written as one number (red, green,
      // blue and strength together) instead of four separate ones.
      const px32 = this.scratch32 && this.scratch32.buffer === px.buffer ? this.scratch32 : (this.scratch32 = new Uint32Array(px.buffer));
      const color = (b << 16) | (g << 8) | r;
      for (let row = 0; row < h; row++) {
        let si = srcStart + row * srcStride;
        let p = row * stride;
        for (let col = 0; col < w; col++, si++, p++) {
          const c = src[si];
          px32[p] = c === 0 ? 0 : color | (c << 24);
        }
      }
      ctx.putImageData(image, x0, y0, 0, 0, w, h);
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
    ctx.putImageData(image, x0, y0, 0, 0, w, h);
  }

  // Watercolor: the stroke's strength in an area, with the pooled darker rims worked in.
  // A pixel is "near the rim" when its blurred neighbourhood is weaker than itself (it sits
  // just inside the edge of the wet patch, or against a line when line-lock is on).
  washAlpha(x0, y0, x1, y1) {
    const W = this.width;
    const H = this.height;
    const r = this.rimRadius;
    const wash = this.brush.wash;
    // Blur a slightly bigger area, so pixels near the border still see their neighbours.
    const bx0 = Math.max(0, x0 - r);
    const by0 = Math.max(0, y0 - r);
    const bx1 = Math.min(W - 1, x1 + r);
    const by1 = Math.min(H - 1, y1 + r);
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    const blur = boxBlur(this.coverage, W, bx0, by0, bw, bh, r);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const out = new Uint8Array(w * h);
    const cov = this.coverage;
    for (let row = 0; row < h; row++) {
      const y = y0 + row;
      let i = y * W + x0;
      let bi = (y - by0) * bw + (x0 - bx0);
      let o = row * w;
      for (let col = 0; col < w; col++, i++, bi++, o++) {
        const c = cov[i];
        if (c === 0) continue;
        const rim = clamp(((c - blur[bi]) / c) * wash.rimGain, 0, 1);
        const value = c * (wash.middle + wash.rim * rim);
        out[o] = value > 255 ? 255 : value;
      }
    }
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
      // Work the rims into the coverage once and for all, so the paint memory matches what's
      // on the page, and draw the whole stroke one last time.
      const shaped = this.washAlpha(box.x0, box.y0, box.x1, box.y1);
      for (let row = 0; row < h; row++) {
        this.coverage.set(shaped.subarray(row * w, row * w + w), (box.y0 + row) * this.width + box.x0);
      }
      this.baked = true;
      this.dirty = { ...box };
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
  const box = this.box;
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
function boxBlur(src, stride, x0, y0, w, h, r) {
  const a = new Float32Array(w * h);
  for (let row = 0; row < h; row++) {
    const s = (y0 + row) * stride + x0;
    for (let col = 0; col < w; col++) a[row * w + col] = src[s + col];
  }
  const b = new Float32Array(w * h);
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
