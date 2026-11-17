// Kite designs and the seven rivals who fly them. A design is pure data — colours, a
// pattern, a size, a tail — and drawKite paints any of them in code: the tall diamond of a
// layangan aduan, its spars, its pattern clipped inside, and a ribbon tail that waves
// behind it. The rivals add a name, a taunt, and the numbers the AI flies by.

/** The player's kite: merah-putih, red bands over white, a red-and-white ribbon tail. */
export const PLAYER_DESIGN = {
  name: 'Garuda Kecil',
  main: '#f3ead8',
  trim: '#d43d2a',
  accent: '#8c1f14',
  pattern: 'bands',
  size: 1,
  tail: { count: 7, colors: ['#d43d2a', '#f3ead8'] },
};

/**
 * The seven rivals, in campaign order. `ai` carries the state machine's temperament:
 * aggression (how much it hunts your string), diveFreq (how often it commits to a dive),
 * skill (reaction precision), sharpness (string damage), stringHp, and speed/agility
 * factors against the player's base flight numbers.
 */
export const RIVALS = [
  {
    name: 'Si Kuning', title: 'Si Kuning — Anak Magang Langit',
    taunt: '“Pelan-pelan saja, Nak. Langit tidak ke mana-mana.”',
    main: '#f2c230', trim: '#fff3c4', accent: '#a8740c', pattern: 'bands', size: 0.95,
    tail: { count: 6, colors: ['#f2c230', '#fff3c4'] },
    ai: { aggression: 0.25, diveFreq: 0.2, skill: 0.3, sharpness: 0.7, stringHp: 58, speed: 0.85, agility: 0.85 },
  },
  {
    name: 'Banteng Merah', title: 'Banteng Merah — Sang Penabrak',
    taunt: '“Maju terus! Benangmu akan putus sebelum benangku!”',
    main: '#c22e22', trim: '#2b2b30', accent: '#ffb199', pattern: 'stripes', size: 1.05,
    tail: { count: 6, colors: ['#c22e22', '#2b2b30'] },
    ai: { aggression: 0.55, diveFreq: 0.55, skill: 0.42, sharpness: 0.9, stringHp: 72, speed: 0.92, agility: 0.9 },
  },
  {
    name: 'Elang Perak', title: 'Elang Perak — Sayap Kilat',
    taunt: '“Tangkap aku kalau bisa, penantang.”',
    main: '#cfd6dd', trim: '#5b7a99', accent: '#eef6ff', pattern: 'checks', size: 1,
    tail: { count: 8, colors: ['#cfd6dd', '#5b7a99'] },
    ai: { aggression: 0.4, diveFreq: 0.3, skill: 0.6, sharpness: 0.95, stringHp: 78, speed: 1.08, agility: 1.1 },
  },
  {
    name: 'Kembar Mendung', title: 'Kembar Mendung — Ekor Dua',
    taunt: '“Kami berdua. Kau sendirian.”',
    main: '#6d6f78', trim: '#3a3b42', accent: '#c9ccd4', pattern: 'diamond', size: 1.02,
    tail: { count: 10, colors: ['#6d6f78', '#c9ccd4'], twin: true },
    ai: { aggression: 0.5, diveFreq: 0.45, skill: 0.6, sharpness: 1.08, stringHp: 88, speed: 1.0, agility: 1.0 },
  },
  {
    name: 'Nyi Roro', title: 'Nyi Roro — Ratu Pantai Selatan',
    taunt: '“Laut selatan sabar menunggu. Benangmu tidak.”',
    main: '#1f8a70', trim: '#0d4d3c', accent: '#a8e6cf', pattern: 'bands', size: 1.05,
    tail: { count: 9, colors: ['#1f8a70', '#a8e6cf'] },
    ai: { aggression: 0.35, diveFreq: 0.35, skill: 0.72, sharpness: 1.3, stringHp: 98, speed: 0.98, agility: 0.95 },
  },
  {
    name: 'Raja Langit', title: 'Raja Langit — Pemegang Tahta',
    taunt: '“Tahta langit hanya untuk satu layangan.”',
    main: '#e0a81e', trim: '#7a4d00', accent: '#fff0b3', pattern: 'diamond', size: 1.12,
    tail: { count: 9, colors: ['#e0a81e', '#7a4d00'] },
    ai: { aggression: 0.65, diveFreq: 0.6, skill: 0.75, sharpness: 1.08, stringHp: 112, speed: 1.05, agility: 1.05 },
  },
  {
    name: 'JANDA HITAM', title: 'JANDA HITAM — Pemutus Semua Benang',
    taunt: '“Semua benang putus di tanganku.”',
    main: '#17171d', trim: '#05050a', accent: '#f2f2f2', pattern: 'eyes', size: 1.35,
    tail: { count: 11, colors: ['#17171d', '#f2f2f2'] },
    ai: { aggression: 0.8, diveFreq: 0.7, skill: 0.92, sharpness: 1.5, stringHp: 150, speed: 1.12, agility: 1.12 },
  },
];

/** The rival for a 0-based campaign round. */
export function rivalForRound(roundIndex) {
  return RIVALS[Math.max(0, Math.min(RIVALS.length - 1, roundIndex))];
}

/**
 * Paint a kite centred on (0, 0) in the caller's transform, pointing up, `unit` pixels
 * wide before the design's own size. `wave` is a time phase for the tail.
 */
export function drawKiteShape(ctx, design, unit, wave) {
  const w = unit * design.size;
  const h = w * 1.38;
  ctx.save();
  // The diamond silhouette, clipped so the pattern never spills.
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(w / 2, -h * 0.08);
  ctx.lineTo(0, h / 2);
  ctx.lineTo(-w / 2, -h * 0.08);
  ctx.closePath();
  ctx.fillStyle = design.main;
  ctx.fill();
  ctx.save();
  ctx.clip();
  drawPattern(ctx, design, w, h);
  // A soft shade down the right spar, so the kite reads as cloth over bamboo, not a sticker.
  const shade = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  shade.addColorStop(0, 'rgba(255,255,255,0.20)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  // Spars: the spine and the bowed cross-spar.
  ctx.strokeStyle = 'rgba(60,35,15,0.55)';
  ctx.lineWidth = Math.max(1.4, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(0, h / 2);
  ctx.moveTo(-w / 2, -h * 0.08);
  ctx.quadraticCurveTo(0, h * 0.06, w / 2, -h * 0.08);
  ctx.stroke();
  ctx.strokeStyle = design.trim;
  ctx.lineWidth = Math.max(1.6, w * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(w / 2, -h * 0.08);
  ctx.lineTo(0, h / 2);
  ctx.lineTo(-w / 2, -h * 0.08);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  drawTail(ctx, design, h, wave);
}

/** The pattern inside the diamond, by name. Always clipped by the caller. */
function drawPattern(ctx, design, w, h) {
  ctx.fillStyle = design.trim;
  if (design.pattern === 'bands') {
    ctx.fillRect(-w / 2, -h * 0.26, w, h * 0.17);
    ctx.fillRect(-w / 2, h * 0.12, w, h * 0.13);
    ctx.fillStyle = design.accent;
    ctx.fillRect(-w / 2, -h * 0.02, w, h * 0.06);
  } else if (design.pattern === 'stripes') {
    ctx.save();
    ctx.rotate(0.5);
    for (let x = -w; x < w; x += w * 0.24) ctx.fillRect(x, -h, w * 0.11, h * 2);
    ctx.restore();
  } else if (design.pattern === 'checks') {
    const s = w * 0.22;
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        if ((row + col) % 2 === 0) ctx.fillRect(-w / 2 + col * s, -h / 2 + row * s, s, s);
      }
    }
    ctx.fillStyle = design.accent;
    ctx.beginPath();
    ctx.arc(0, -h * 0.05, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (design.pattern === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.3);
    ctx.lineTo(w * 0.26, -h * 0.05);
    ctx.lineTo(0, h * 0.22);
    ctx.lineTo(-w * 0.26, -h * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = design.accent;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.16);
    ctx.lineTo(w * 0.13, -h * 0.05);
    ctx.lineTo(0, h * 0.08);
    ctx.lineTo(-w * 0.13, -h * 0.05);
    ctx.closePath();
    ctx.fill();
  } else if (design.pattern === 'eyes') {
    // The Widow's white eye spots, wide and watching.
    for (const side of [-1, 1]) {
      ctx.fillStyle = design.accent;
      ctx.beginPath();
      ctx.ellipse(side * w * 0.21, -h * 0.16, w * 0.13, h * 0.1, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#05050a';
      ctx.beginPath();
      ctx.arc(side * w * 0.21, -h * 0.16, w * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = design.accent;
    ctx.beginPath();
    ctx.arc(0, h * 0.18, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Ribbon bows strung below the kite's bottom point, waving with `wave` and the wind. */
function drawTail(ctx, design, h, wave) {
  const tail = design.tail;
  const gap = h * 0.16;
  const lanes = tail.twin ? [-0.16, 0.16] : [0];
  ctx.lineWidth = 1.4;
  for (const lane of lanes) {
    const x0 = lane * h;
    ctx.strokeStyle = 'rgba(40,30,20,0.6)';
    ctx.beginPath();
    ctx.moveTo(x0 * 0.2, h / 2);
    for (let i = 1; i <= tail.count; i += 1) {
      const y = h / 2 + i * gap;
      const x = x0 + Math.sin(wave * 2.2 + i * 0.85 + lane * 3) * h * 0.07 * (0.4 + i / tail.count);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 1; i <= tail.count; i += 1) {
      const y = h / 2 + i * gap;
      const x = x0 + Math.sin(wave * 2.2 + i * 0.85 + lane * 3) * h * 0.07 * (0.4 + i / tail.count);
      const s = h * 0.055 * (1 - i / (tail.count + 4));
      ctx.fillStyle = tail.colors[(i - 1) % tail.colors.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(wave * 2.2 + i) * 0.5);
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(0, -s * 0.55);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * Paint a kite body (from physics.js) at its position: motion trail first, then the kite
 * rotated to its heading. `t` is the scene clock for the tail wave.
 */
export function drawKiteBody(ctx, kite, t) {
  if (kite.trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = kite.design.trim;
    ctx.lineCap = 'round';
    for (let i = 0; i < kite.trail.length - 1; i += 1) {
      const a = kite.trail[i];
      const b = kite.trail[i + 1];
      ctx.globalAlpha = 0.34 * (1 - i / kite.trail.length);
      ctx.lineWidth = 7 * (1 - i / kite.trail.length) + 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(kite.pos.x, kite.pos.y);
  ctx.rotate(kite.fallen ? kite.angle : kite.angle);
  drawKiteShape(ctx, kite.design, 54, t * 2 + kite.pos.x * 0.01);
  ctx.restore();
}
