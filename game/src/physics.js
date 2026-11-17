// The physical heart of the game: a kite body that seeks with inertia, stalls and dives; a
// verlet rope that sags, strains and (when cut) curls away; and a wind field of traveling
// gusts. Nothing here knows about screens or scores — duel.js drives it, render.js draws it.
import { FIELD, FLIGHT, ROOF_Y, ROPE } from './config.js';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Do segments a-b and c-d cross? Returns {t, u, x, y} — t along a-b, u along c-d, and the
 * point — or null. Parallel and merely-touching segments do not count.
 */
export function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / denom;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / denom;
  if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) return null;
  return { t, u, x: ax + rX * t, y: ay + rY * t };
}

// ---------------------------------------------------------------------------
// Wind: a steady base flow plus gusts that are born upwind, travel across the
// field, and die downwind. Gusts are seeded per round, so a round's weather
// is the same weather every time it is flown.
// ---------------------------------------------------------------------------

export function createWind(rng, round) {
  const base = { x: 26 + round * 2, y: -4 };
  const gusts = [];
  let clock = 0;
  let nextGust = rng.range(0.5, 2.2);
  return {
    base,
    gusts,
    /** Advance the gust schedule; call once per step. */
    update(dt) {
      clock += dt;
      nextGust -= dt;
      if (nextGust <= 0) {
        nextGust = rng.range(2.4, 5.2);
        gusts.push({
          x: -180,
          speed: rng.range(120, 210),
          width: rng.range(150, 300),
          power: rng.range(45, 95),
          wobble: rng.range(0, Math.PI * 2),
        });
      }
      for (let i = gusts.length - 1; i >= 0; i -= 1) {
        gusts[i].x += gusts[i].speed * dt;
        if (gusts[i].x - gusts[i].width > FIELD.width + 120) gusts.splice(i, 1);
      }
    },
    /** The wind vector at a point: base flow plus each gust's gaussian push. */
    at(x, y, out) {
      let wx = base.x;
      let wy = base.y + Math.sin(clock * 0.7 + x * 0.002) * 5;
      for (const g of gusts) {
        const d = (x - g.x) / g.width;
        const fall = Math.exp(-d * d);
        wx += g.power * fall;
        wy += Math.sin(clock * 2 + g.wobble) * 9 * fall;
      }
      out.x = wx;
      out.y = wy;
      return out;
    },
    /** 0..1 overall strength at a point, for the HUD meter and the wind sound. */
    strength(x, y) {
      const v = this.at(x, y, _tmp);
      return clamp(Math.hypot(v.x, v.y) / 120, 0, 1);
    },
  };
}

const _tmp = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// Kite body: position and velocity, a smoothed heading for drawing, a short
// trail while diving, and — once its string is cut — a tumbling fall.
// ---------------------------------------------------------------------------

export function createKiteBody(x, y, design) {
  return {
    pos: { x, y },
    vel: { x: 0, y: 0 },
    angle: 0,
    spin: 0,
    design,
    flutterPhase: (x * 0.37 + y * 0.113) % (Math.PI * 2),
    trail: [],
    fallen: false,
    landed: false,
    restY: ROOF_Y,
  };
}

/**
 * Advance one kite. `control` is {tx, ty, pull}: the point it seeks and whether tarik is
 * held. `opts`: {maxSpeed, agilityMul, stabilityMul, anchor, stringLen} — the string
 * constraint is enforced here, so a kite can never outrun its own string.
 */
export function stepKiteBody(kite, control, windAt, dt, opts) {
  const p = kite.pos;
  const v = kite.vel;
  if (kite.fallen) {
    // A cut kite tumbles: gravity, spin, a draggy flutter, then the rooftops.
    v.y += 620 * dt;
    v.x *= 1 - 0.7 * dt;
    v.y *= 1 - 0.25 * dt;
    kite.spin += dt * 5.2;
    kite.angle += dt * 5.2;
    p.x += v.x * dt;
    p.y += v.y * dt;
    if (p.y >= kite.restY) {
      p.y = kite.restY;
      kite.landed = true;
      v.x = 0;
      v.y = 0;
    }
    return;
  }

  const maxSpeed = opts.maxSpeed;
  const dx = control.tx - p.x;
  const dy = control.ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = Math.min(maxSpeed, d * FLIGHT.seekGain);
  const dvx = (dx / d) * want;
  const dvy = (dy / d) * want;
  const agility = FLIGHT.agility * (opts.agilityMul || 1);
  v.x += (dvx - v.x) * Math.min(1, agility * dt);
  v.y += (dvy - v.y) * Math.min(1, agility * dt);

  if (control.pull) {
    v.y -= FLIGHT.pullClimb * dt;
    // Tarik strains the kite outward against its string: a pulled kite rides the
    // leash at full stretch, which is where tension — and cutting — lives.
    const ox = p.x - opts.anchor.x;
    const oy = p.y - opts.anchor.y;
    const od = Math.hypot(ox, oy) || 1;
    v.x += (ox / od) * FLIGHT.pullStrain * dt;
    v.y += (oy / od) * FLIGHT.pullStrain * dt;
  } else {
    v.y += FLIGHT.sink * dt;
    const speed = Math.hypot(v.x, v.y);
    if (v.y > 60 && speed > 1) {
      // Released and falling: the dive feeds on itself.
      v.x += (v.x / speed) * FLIGHT.diveBoost * dt;
      v.y += (v.y / speed) * FLIGHT.diveBoost * dt;
    }
  }

  const speed = Math.hypot(v.x, v.y);
  if (speed < FLIGHT.stallSpeed) {
    // Too slow: the kite flutters, wanders and sinks until it finds the wind again.
    kite.flutterPhase += dt * 31;
    v.x += Math.sin(kite.flutterPhase) * 210 * dt;
    v.y += FLIGHT.stallSink * dt;
  }

  const windGrip = FLIGHT.windGrip * (opts.windMul || 1);
  v.x += windAt.x * windGrip * dt;
  v.y += windAt.y * windGrip * dt;

  const capped = Math.hypot(v.x, v.y);
  const cap = maxSpeed * 1.45; // dives may overshoot cruise speed, but not forever
  if (capped > cap) {
    v.x = (v.x / capped) * cap;
    v.y = (v.y / capped) * cap;
  }

  p.x += v.x * dt;
  p.y += v.y * dt;

  // The string is a hard leash: project back onto its circle, kill the outward velocity.
  const ax = opts.anchor.x;
  const ay = opts.anchor.y;
  const lx = p.x - ax;
  const ly = p.y - ay;
  const ld = Math.hypot(lx, ly);
  if (ld > opts.stringLen) {
    const s = opts.stringLen / ld;
    p.x = ax + lx * s;
    p.y = ay + ly * s;
    const radial = (v.x * lx + v.y * ly) / ld;
    if (radial > 0) {
      v.x -= (lx / ld) * radial;
      v.y -= (ly / ld) * radial;
    }
  }

  p.x = clamp(p.x, 26, FIELD.width - 26);
  p.y = clamp(p.y, 34, ROOF_Y - 6);

  // Heading for the drawing: mostly upright, leaning into the velocity.
  const lean = clamp(Math.atan2(v.y, v.x) + Math.PI / 2, -1.15, 1.15) * 0.55;
  kite.angle += (lean - kite.angle) * Math.min(1, 7 * dt);

  // Trail: only fast flight leaves one, newest first, capped short.
  if (Math.hypot(v.x, v.y) > 300) {
    kite.trail.unshift({ x: p.x, y: p.y });
    if (kite.trail.length > 14) kite.trail.pop();
  } else if (kite.trail.length > 0) {
    kite.trail.pop();
  }
}

// ---------------------------------------------------------------------------
// The string: a verlet rope pinned to the handler's rooftop at one end and to
// the kite at the other. Interior points feel gravity and wind; constraints
// keep the segments honest. When severed, the anchored half keeps a loose end
// that curls as it falls.
// ---------------------------------------------------------------------------

export function createRope(anchor, kitePos, totalLen) {
  const points = [];
  const n = ROPE.segments;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    points.push({
      x: anchor.x + (kitePos.x - anchor.x) * t,
      y: anchor.y + (kitePos.y - anchor.y) * t + Math.sin(t * Math.PI) * 26 * (1 - t),
      px: 0,
      py: 0,
    });
    points[i].px = points[i].x;
    points[i].py = points[i].y;
  }
  return {
    anchor: { x: anchor.x, y: anchor.y },
    points,
    segLen: totalLen / n,
    totalLen,
    hp: 100,
    maxHp: 100,
    tension: 0,
    severed: false,
    cutIndex: 0, // polyline index nearest the cut, set when severed
    loose: null, // the curling free end of the anchored half, once severed
  };
}

export function stepRope(rope, kitePos, windVec, dt) {
  const pts = rope.points;
  const n = pts.length - 1;
  const dt2 = dt * dt;
  const grav = ROPE.gravity * (rope.severed ? 2.4 : 1);
  for (let i = 1; i < n; i += 1) {
    const pt = pts[i];
    const nx = pt.x + (pt.x - pt.px) * 0.985 + windVec.x * ROPE.windShare * dt2;
    const ny = pt.y + (pt.y - pt.py) * 0.985 + (grav + windVec.y * ROPE.windShare) * dt2;
    pt.px = pt.x;
    pt.py = pt.y;
    pt.x = nx;
    pt.y = ny;
  }
  pts[0].x = rope.anchor.x;
  pts[0].y = rope.anchor.y;
  pts[0].px = pts[0].x;
  pts[0].py = pts[0].y;
  if (!rope.severed) {
    pts[n].x = kitePos.x;
    pts[n].y = kitePos.y;
    pts[n].px = kitePos.x;
    pts[n].py = kitePos.y;
  }
  const limit = rope.severed ? rope.cutIndex : n;
  for (let iter = 0; iter < ROPE.iterations; iter += 1) {
    for (let i = 0; i < limit; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = ((d - rope.segLen) / d) * 0.5;
      dx *= diff;
      dy *= diff;
      if (i === 0) {
        b.x -= dx * 2;
        b.y -= dy * 2;
      } else {
        a.x += dx;
        a.y += dy;
        b.x -= dx;
        b.y -= dy;
      }
    }
    pts[0].x = rope.anchor.x;
    pts[0].y = rope.anchor.y;
    if (!rope.severed) {
      pts[n].x = kitePos.x;
      pts[n].y = kitePos.y;
    }
  }
  if (rope.severed && rope.loose !== null) {
    // The free end whips and curls: verlet with a swirling offset, leashed to the cut point.
    const loose = rope.loose;
    loose.phase += dt * 7;
    const nx = loose.x + (loose.x - loose.px) * 0.96 + Math.sin(loose.phase) * 260 * dt2;
    const ny = loose.y + (loose.y - loose.py) * 0.96 + (900 + Math.cos(loose.phase * 0.8) * 160) * dt2;
    loose.px = loose.x;
    loose.py = loose.y;
    loose.x = nx;
    loose.y = ny;
    const anchorPt = pts[rope.cutIndex];
    const dx = loose.x - anchorPt.x;
    const dy = loose.y - anchorPt.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const want = rope.segLen * 1.35;
    if (d > want) {
      loose.x = anchorPt.x + (dx / d) * want;
      loose.y = anchorPt.y + (dy / d) * want;
    }
  }
  const end = rope.severed ? pts[rope.cutIndex] : pts[n];
  rope.tension = clamp(dist(rope.anchor.x, rope.anchor.y, end.x, end.y) / rope.totalLen, 0, 1.02);
}

/** Snap the rope: the anchored half keeps points up to the cut; the kite half is gone. */
export function severRope(rope, cutPoint) {
  let best = 1;
  let bestD = Infinity;
  for (let i = 1; i < rope.points.length; i += 1) {
    const d = dist(rope.points[i].x, rope.points[i].y, cutPoint.x, cutPoint.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  rope.severed = true;
  rope.cutIndex = Math.max(1, Math.min(rope.points.length - 2, best));
  const at = rope.points[rope.cutIndex];
  rope.loose = { x: at.x, y: at.y, px: at.x, py: at.y, phase: 0 };
  rope.hp = 0;
}
