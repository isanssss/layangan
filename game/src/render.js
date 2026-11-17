// Drawing only: the kampung at dusk, the strings, the HUD. The backdrop is precomputed
// per round (createBackdrop) — gradient sky that deepens gold to purple, a sinking sun, a
// rising moon, mountain ridges, a silhouette skyline with a mosque dome and swaying palms,
// lit windows as night comes — then painted each frame with drifting clouds, birds, leaves
// and wind streaks over it. The duel scene and HUD paint on top of the same backdrop.
import { FIELD, FONT, ROOF_Y, ROPE, skyForRound } from './config.js';
import { drawKiteBody, drawKiteShape } from './kites.js';
import { clamp } from './physics.js';

/** Create the renderer: owns the canvas, the letterbox transform, and text helpers. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);
  return {
    ctx,
    view,
    /** Map a pointer event's client coordinates into the virtual field. */
    toVirtual(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const bx = (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
      const by = (clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
      return {
        x: clamp((bx - view.x) / view.scale, 0, FIELD.width),
        y: clamp((by - view.y) / view.scale, 0, FIELD.height),
      };
    },
    /** Clear the window and set the field transform; call once per frame before drawing. */
    begin() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0918';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    },
  };
}

const fontCache = new Map();
export function text(ctx, value, x, y, opts = {}) {
  const size = opts.size || 20;
  const weight = opts.weight || 600;
  const key = weight + ':' + size;
  if (!fontCache.has(key)) fontCache.set(key, `${weight} ${size}px ${FONT}`);
  ctx.font = fontCache.get(key);
  ctx.fillStyle = opts.color || '#f5efe2';
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  if (opts.shadow) {
    ctx.shadowColor = 'rgba(10,5,20,0.65)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillText(value, x, y);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A translucent dusk panel with a warm rim — the menu surface every screen shares. */
export function panel(ctx, x, y, w, h, alpha = 0.82) {
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = `rgba(16,10,30,${alpha})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,205,120,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

/**
 * Precompute a round's backdrop: stars, ridges, the skyline (houses, mosque, palms),
 * clouds, birds, leaves. `fallen` is a list of kite designs to hang on the rooftops.
 */
export function createBackdrop(round, rng, opts = {}) {
  const sky = skyForRound(round);
  const stars = [];
  for (let i = 0; i < 240; i += 1) {
    stars.push({ x: rng.range(0, FIELD.width), y: rng.range(0, 430), r: rng.range(0.6, 1.8), tw: rng.range(0, 6.28) });
  }
  const ridges = [makeRidge(rng, 512, 26, 90), makeRidge(rng, 566, 20, 60)];
  const houses = [];
  let hx = -16;
  while (hx < FIELD.width + 20) {
    const w = rng.range(74, 138);
    const h = rng.range(58, 118);
    const windows = [];
    const cols = Math.max(1, Math.floor(w / 30));
    const rows = Math.max(1, Math.floor(h / 32));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        windows.push({ x: 10 + c * 30, y: 12 + r * 32, lit: rng.chance(0.55) });
      }
    }
    houses.push({ x: hx, w, h, roof: rng.pick(['gable', 'flat', 'tile']), shade: rng.range(-8, 10), windows, antenna: rng.chance(0.3) });
    hx += w + rng.range(2, 10);
  }
  const palms = [70, 268, 520, 986, 1196].map((x, i) => ({ x, h: rng.range(120, 168), phase: i * 1.7 }));
  const clouds = [];
  for (let i = 0; i < 6; i += 1) {
    clouds.push({ x: rng.range(0, FIELD.width), y: rng.range(36, 210), s: rng.range(0.6, 1.5), drift: rng.range(2, 7) });
  }
  const birds = [];
  for (let i = 0; i < 4; i += 1) {
    birds.push({ x: rng.range(0, FIELD.width), y: rng.range(90, 260), speed: rng.range(14, 30), phase: rng.range(0, 6.28) });
  }
  const leaves = [];
  for (let i = 0; i < 24; i += 1) {
    leaves.push({ x: rng.range(0, FIELD.width), y: rng.range(0, FIELD.height), phase: rng.range(0, 6.28), size: rng.range(3, 6.5), fall: rng.range(9, 22) });
  }
  const streaks = [];
  for (let i = 0; i < 16; i += 1) {
    streaks.push({ x: rng.range(0, FIELD.width), y: rng.range(60, 560), len: rng.range(30, 90) });
  }
  const fallen = (opts.fallen || []).map((design, i) => {
    const house = houses[1 + ((i * 2 + 1) % Math.max(1, houses.length - 2))];
    return { design, x: house.x + house.w / 2, y: FIELD.height - house.h - 6, rot: rng.range(-0.7, 0.7) };
  });
  return {
    round, sky, stars, ridges, houses, palms, clouds, birds, leaves, streaks, fallen,
    t: 0, windLevel: 0.3, windX: 30,
  };
}

function makeRidge(rng, baseY, step, amp) {
  const pts = [];
  let y = baseY;
  for (let x = -40; x <= FIELD.width + 40; x += step) {
    y += rng.range(-amp, amp) * 0.4;
    y = clamp(y, baseY - amp, baseY + amp * 0.4);
    pts.push({ x, y });
  }
  return pts;
}

/** Advance the backdrop's living parts. `windVec` is the wind at field centre. */
export function updateBackdrop(bd, dt, windVec) {
  bd.t += dt;
  bd.windX = windVec.x;
  bd.windLevel = clamp(Math.hypot(windVec.x, windVec.y) / 120, 0, 1);
  for (const c of bd.clouds) {
    c.x += (windVec.x * 0.25 + c.drift) * dt;
    if (c.x - 190 * c.s > FIELD.width) c.x = -190 * c.s;
  }
  for (const b of bd.birds) {
    b.x += b.speed * dt;
    b.y += Math.sin(bd.t * 2 + b.phase) * 6 * dt;
    if (b.x > FIELD.width + 30) {
      b.x = -30;
      b.y = 80 + (b.phase * 53) % 200;
    }
  }
  for (const leaf of bd.leaves) {
    leaf.y += leaf.fall * dt;
    leaf.x += (windVec.x * 0.7 + Math.sin(bd.t * 1.7 + leaf.phase) * 14) * dt;
    if (leaf.y > FIELD.height + 8 || leaf.x > FIELD.width + 8) {
      leaf.y = -8;
      leaf.x = (leaf.phase * 197) % FIELD.width;
    }
  }
  for (const s of bd.streaks) {
    s.x += windVec.x * 3.4 * dt + 60 * dt;
    if (s.x - s.len > FIELD.width) {
      s.x = -s.len;
      s.y = 50 + (s.len * 7.3) % 520;
    }
  }
}

export function drawBackdrop(ctx, bd) {
  const { sky } = bd;
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(0.55, sky.mid);
  grad.addColorStop(0.88, sky.horizon);
  grad.addColorStop(1, sky.horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  if (sky.stars > 0) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < Math.min(sky.stars, bd.stars.length); i += 1) {
      const s = bd.stars[i];
      ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(bd.t * 1.6 + s.tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (sky.sun > 0.02) {
    const sunY = 108 + (1 - sky.sun) * 300;
    const glow = ctx.createRadialGradient(1015, sunY, 8, 1015, sunY, 190);
    glow.addColorStop(0, 'rgba(255,190,90,0.55)');
    glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(1015 - 200, sunY - 200, 400, 400);
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(1015, sunY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.beginPath();
    ctx.arc(1015, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  if (sky.moon > 0) {
    ctx.fillStyle = 'rgba(232,228,208,0.95)';
    ctx.beginPath();
    ctx.arc(1090, 96, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,186,170,0.5)';
    for (const [cx, cy, cr] of [[1080, 88, 5], [1100, 106, 4], [1094, 84, 3]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRidge(ctx, bd.ridges[0], 'rgba(38,32,66,0.55)');
  for (const c of bd.clouds) drawCloud(ctx, c, bd);
  drawRidge(ctx, bd.ridges[1], 'rgba(28,22,50,0.8)');
  for (const b of bd.birds) drawBird(ctx, b, bd.t);

  drawSkyline(ctx, bd);
  for (const f of bd.fallen) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    drawKiteShape(ctx, f.design, 34, bd.t);
    ctx.restore();
    ctx.strokeStyle = 'rgba(230,225,215,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y + 8);
    ctx.quadraticCurveTo(f.x + 16, f.y + 26, f.x + 30, f.y + 34);
    ctx.stroke();
  }

  // Ground shadow under the rooftops.
  ctx.fillStyle = '#0d0819';
  ctx.fillRect(0, ROOF_Y + 58, FIELD.width, FIELD.height - ROOF_Y - 58);

  // Falling leaves and petals, warm against the dusk.
  for (const leaf of bd.leaves) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(bd.t * 1.3 + leaf.phase);
    ctx.fillStyle = 'rgba(255,170,110,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.size, leaf.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Wind streaks: the gusts made visible.
  if (bd.windLevel > 0.22) {
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + bd.windLevel * 0.13})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const s of bd.streaks) {
      ctx.beginPath();
      ctx.moveTo(s.x - s.len, s.y);
      ctx.lineTo(s.x, s.y + 3);
      ctx.stroke();
    }
  }
}

function drawRidge(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, FIELD.height);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(FIELD.width + 40, FIELD.height);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(ctx, c, bd) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.s, c.s * 0.62);
  ctx.fillStyle = 'rgba(255,226,205,0.20)';
  for (const [ox, oy, r] of [[0, 0, 52], [46, 8, 38], [-48, 10, 36], [8, -16, 34]]) {
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void bd;
}

function drawBird(ctx, b, t) {
  const flap = Math.sin(t * 9 + b.phase) * 5;
  ctx.strokeStyle = 'rgba(20,14,34,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x - 9, b.y + flap * 0.4);
  ctx.quadraticCurveTo(b.x - 4, b.y - 4 - flap, b.x, b.y);
  ctx.quadraticCurveTo(b.x + 4, b.y - 4 - flap, b.x + 9, b.y + flap * 0.4);
  ctx.stroke();
}

function drawSkyline(ctx, bd) {
  const base = FIELD.height;
  for (const house of bd.houses) {
    const top = base - house.h;
    const shade = 22 + house.shade;
    ctx.fillStyle = `rgb(${shade + 8},${shade - 2},${shade + 22})`;
    ctx.fillRect(house.x, top, house.w, house.h);
    ctx.fillStyle = `rgb(${shade - 4},${shade - 10},${shade + 12})`;
    if (house.roof === 'gable') {
      ctx.beginPath();
      ctx.moveTo(house.x - 4, top);
      ctx.lineTo(house.x + house.w / 2, top - 20);
      ctx.lineTo(house.x + house.w + 4, top);
      ctx.closePath();
      ctx.fill();
    } else if (house.roof === 'tile') {
      ctx.beginPath();
      ctx.arc(house.x + house.w / 2, top + 2, house.w / 2, Math.PI, 0);
      ctx.fill();
    } else {
      ctx.fillRect(house.x - 3, top - 6, house.w + 6, 7);
    }
    if (house.antenna) {
      ctx.strokeStyle = `rgb(${shade},${shade - 6},${shade + 16})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(house.x + house.w * 0.7, top - 4);
      ctx.lineTo(house.x + house.w * 0.7, top - 26);
      ctx.moveTo(house.x + house.w * 0.7 - 7, top - 20);
      ctx.lineTo(house.x + house.w * 0.7 + 7, top - 20);
      ctx.stroke();
    }
    for (const win of house.windows) {
      if (win.lit && bd.sky.windowLit > 0.02) {
        ctx.fillStyle = `rgba(255,186,92,${0.25 + bd.sky.windowLit * 0.75})`;
      } else {
        ctx.fillStyle = 'rgba(130,120,170,0.20)';
      }
      ctx.fillRect(house.x + win.x, top + win.y, 11, 14);
    }
  }
  drawMosque(ctx, bd);
  for (const palm of bd.palms) drawPalm(ctx, palm, bd);
}

function drawMosque(ctx, bd) {
  const x = 806;
  const base = FIELD.height;
  const top = base - 128;
  ctx.fillStyle = 'rgb(26,18,44)';
  ctx.fillRect(x, top + 34, 128, 94);
  ctx.beginPath(); // dome
  ctx.arc(x + 64, top + 36, 40, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x + 61, top - 16, 6, 14);
  ctx.fillStyle = 'rgba(255,210,120,0.9)'; // finial crescent dot
  ctx.beginPath();
  ctx.arc(x + 64, top - 20, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgb(26,18,44)';
  ctx.fillRect(x + 142, top - 34, 15, 162); // minaret
  ctx.beginPath();
  ctx.moveTo(x + 138, top - 34);
  ctx.lineTo(x + 149.5, top - 56);
  ctx.lineTo(x + 161, top - 34);
  ctx.closePath();
  ctx.fill();
  if (bd.sky.windowLit > 0.02) {
    ctx.fillStyle = `rgba(255,196,100,${bd.sky.windowLit})`;
    ctx.fillRect(x + 52, top + 62, 24, 30);
    ctx.fillRect(x + 145.5, top + 6, 8, 12);
  }
}

function drawPalm(ctx, palm, bd) {
  const base = FIELD.height;
  const sway = Math.sin(bd.t * 0.9 + palm.phase) * (3 + bd.windLevel * 9);
  const topX = palm.x + sway;
  const topY = base - palm.h;
  ctx.strokeStyle = 'rgb(20,14,36)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(palm.x, base);
  ctx.quadraticCurveTo(palm.x + sway * 0.3, base - palm.h * 0.6, topX, topY);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  const frondSway = Math.sin(bd.t * 1.4 + palm.phase) * (0.05 + bd.windLevel * 0.14);
  for (let i = 0; i < 6; i += 1) {
    const ang = -Math.PI * 0.92 + i * (Math.PI * 0.17) + frondSway;
    const len = 44 + (i % 3) * 9;
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.5 + len * 0.34;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(ang) * len * 0.6, topY + Math.sin(ang) * len * 0.4 - 7, ex, ey);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Strings, kites, effects
// ---------------------------------------------------------------------------

/**
 * Paint one string as a smooth curve through its verlet points. Taut strings glint —
 * a bright dashed sheen that runs along the line; a severed string stops at its cut
 * point and trails its curling loose end, with a short stub still tied to the kite.
 */
export function drawRope(ctx, rope, kite, t) {
  const pts = rope.points;
  const last = rope.severed ? rope.cutIndex : pts.length - 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(238,234,224,0.88)';
  ctx.lineWidth = 1.7;
  traceCurve(ctx, pts, last);
  ctx.stroke();
  if (!rope.severed && rope.tension >= ROPE.tautAt) {
    const gold = rope.tension >= ROPE.goldAt;
    ctx.strokeStyle = gold ? 'rgba(255,214,96,0.85)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.7;
    ctx.setLineDash(gold ? [9, 15] : [5, 11]);
    ctx.lineDashOffset = -t * 70;
    traceCurve(ctx, pts, last);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (rope.severed && rope.loose !== null) {
    const at = pts[rope.cutIndex];
    ctx.strokeStyle = 'rgba(238,234,224,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.quadraticCurveTo(
      (at.x + rope.loose.x) / 2 + Math.sin(rope.loose.phase) * 9,
      (at.y + rope.loose.y) / 2,
      rope.loose.x, rope.loose.y,
    );
    ctx.stroke();
    // The stub still tied to the falling kite, whipping behind it.
    if (kite) {
      ctx.beginPath();
      ctx.moveTo(kite.pos.x, kite.pos.y);
      for (let i = 1; i <= 3; i += 1) {
        ctx.lineTo(
          kite.pos.x - kite.vel.x * 0.03 * i + Math.sin(t * 9 + i * 1.7) * 6 * i,
          kite.pos.y - kite.vel.y * 0.03 * i + i * 7,
        );
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function traceCurve(ctx, pts, last) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < last; i += 1) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[last].x, pts[last].y);
}

/** A decorative kite on a simple curved string — title and celebration screens. */
export function drawDecoKite(ctx, design, x, y, angle, scale, anchor, t, sag = 30) {
  ctx.save();
  ctx.strokeStyle = 'rgba(238,234,224,0.55)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.quadraticCurveTo((anchor.x + x) / 2, (anchor.y + y) / 2 + sag, x, y);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  drawKiteShape(ctx, design, 54, t * 2 + x * 0.01);
  ctx.restore();
}

/** Everything in the duel that moves: strings, kites, sparks, floaters, the snap banner. */
export function drawDuelWorld(ctx, duel, t) {
  drawRope(ctx, duel.rivalSide.rope, duel.rivalSide.kite, t);
  drawRope(ctx, duel.player.rope, duel.player.kite, t);
  drawKiteBody(ctx, duel.rivalSide.kite, t);
  drawKiteBody(ctx, duel.player.kite, t);

  for (const s of duel.sparks) {
    const a = clamp(s.life / s.maxLife, 0, 1);
    ctx.fillStyle = a > 0.5 ? `rgba(255,217,77,${a})` : `rgba(255,140,66,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of duel.floaters) {
    const a = clamp(f.life / f.maxLife, 0, 1);
    text(ctx, f.text, f.x, f.y, { size: 21, weight: 800, color: f.color, align: 'center', alpha: a, shadow: true });
  }

  if (duel.phase === 'snap' || duel.phase === 'over') {
    // Slow-motion vignette, then the word of the day.
    const vig = ctx.createRadialGradient(640, 330, 240, 640, 330, 720);
    vig.addColorStop(0, 'rgba(8,4,18,0)');
    vig.addColorStop(1, 'rgba(8,4,18,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const pop = duel.phase === 'snap' ? clamp(duel.snapClock / 0.18, 0, 1) : 1;
    ctx.save();
    ctx.translate(640, 268);
    ctx.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3);
    text(ctx, 'PUTUS!', 0, 0, {
      size: 92, weight: 900, align: 'center',
      color: duel.result !== null && duel.result.winner === 'player' ? '#ffd94d' : '#ff8a76',
      shadow: true,
    });
    ctx.restore();
    if (duel.result !== null) {
      text(ctx, duel.result.winner === 'player' ? `${duel.rival.name} jatuh ke atap kampung` : 'Layanganmu jatuh ke atap kampung', 640, 312, {
        size: 22, weight: 600, align: 'center', color: '#f5efe2', shadow: true,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function stringBar(ctx, x, y, w, frac, flip) {
  const h = 14;
  roundRectPath(ctx, x, y, w, h, 7);
  ctx.fillStyle = 'rgba(10,6,22,0.66)';
  ctx.fill();
  const fw = Math.max(0, w * clamp(frac, 0, 1));
  const hue = clamp(frac, 0, 1) * 105;
  ctx.fillStyle = `hsl(${hue},72%,52%)`;
  if (fw > 1) {
    roundRectPath(ctx, flip ? x + w - fw : x, y, fw, h, 7);
    ctx.fill();
  }
  roundRectPath(ctx, x, y, w, h, 7);
  ctx.strokeStyle = 'rgba(245,239,226,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** The duel HUD: both BENANG bars, the round plate, wind, and the tension meter. */
export function drawHUD(ctx, duel, label, streak = 0) {
  const p = duel.player;
  const r = duel.rivalSide;
  // Player plate, top-left.
  ctx.save();
  ctx.translate(42, 42);
  drawKiteShape(ctx, p.kite.design, 21, 0);
  ctx.restore();
  text(ctx, 'GARUDA KECIL — BENANG', 70, 32, { size: 14, weight: 700, color: '#f5efe2', shadow: true });
  stringBar(ctx, 70, 40, 264, p.rope.hp / p.rope.maxHp, false);
  // Rival plate, top-right.
  ctx.save();
  ctx.translate(1238, 42);
  drawKiteShape(ctx, r.kite.design, 21, 0);
  ctx.restore();
  text(ctx, `${duel.rival.name.toUpperCase()} — BENANG`, 1210, 32, { size: 14, weight: 700, color: '#f5efe2', align: 'right', shadow: true });
  stringBar(ctx, 946, 40, 264, r.rope.hp / r.rope.maxHp, true);

  // Centre plate: the round and its name.
  panel(ctx, 490, 14, 300, 44, 0.62);
  text(ctx, label, 640, 43, { size: 17, weight: 800, align: 'center', color: '#ffe9b8' });
  if (streak > 0) {
    text(ctx, `STREAK ${streak}`, 640, 76, { size: 13, weight: 700, align: 'center', color: '#ffd94d' });
  }

  // Wind, bottom-left: an arrow that leans with the gusts and a strength meter.
  const wind = duel.wind.at(p.kite.pos.x, p.kite.pos.y, { x: 0, y: 0 });
  const strength = clamp(Math.hypot(wind.x, wind.y) / 120, 0, 1);
  const ang = Math.atan2(wind.y, wind.x);
  ctx.save();
  ctx.translate(52, 668);
  ctx.rotate(ang);
  ctx.strokeStyle = 'rgba(245,239,226,0.9)';
  ctx.fillStyle = 'rgba(245,239,226,0.9)';
  ctx.lineWidth = 2.4;
  const len = 14 + strength * 22;
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(len / 2 + 7, 0);
  ctx.lineTo(len / 2 - 3, -4.6);
  ctx.lineTo(len / 2 - 3, 4.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, 'ANGIN', 76, 662, { size: 12, weight: 700, color: '#cfd4ea' });
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = strength * 5 > i ? '#ffd94d' : 'rgba(245,239,226,0.25)';
    ctx.fillRect(76 + i * 13, 668, 9, 6);
  }

  // Tension, bottom-centre: the cutting zone glows gold.
  const tension = p.rope.tension;
  const gold = tension >= ROPE.goldAt;
  text(ctx, 'TEGANGAN', 640, 656, { size: 12, weight: 700, align: 'center', color: gold ? '#ffd94d' : '#cfd4ea' });
  roundRectPath(ctx, 490, 664, 300, 11, 5);
  ctx.fillStyle = 'rgba(10,6,22,0.66)';
  ctx.fill();
  ctx.fillStyle = gold ? '#ffd94d' : 'rgba(245,239,226,0.75)';
  if (tension > 0.01) {
    roundRectPath(ctx, 490, 664, 300 * clamp(tension, 0, 1), 11, 5);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,217,77,0.8)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(490 + 300 * ROPE.goldAt, 661);
  ctx.lineTo(490 + 300 * ROPE.goldAt, 678);
  ctx.stroke();
  if (duel.crossing !== null && tension >= ROPE.tautAt) {
    text(ctx, 'MEMOTONG!', 640, 700, { size: 15, weight: 800, align: 'center', color: '#ffd94d', shadow: true });
  }
  // Your string is nearly gone: say so, in red, where the eye already is.
  if (p.rope.hp / p.rope.maxHp < 0.25 && duel.phase === 'fight') {
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.012);
    text(ctx, 'BENANGMU KRITIS!', 70, 84, { size: 15, weight: 800, color: '#ff7a68', alpha: pulse });
  }
}
