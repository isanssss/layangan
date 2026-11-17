// Screens and flow: title, campaign map, rival intro, the duel itself, result, upgrade
// choice, campaign complete, and the endless Langit Bebas. The painters are exported
// pure-ish functions of a view object so shots.js can stage the exact same screens for
// screenshots; createUI wires them to input, audio and the save.
import { FIELD, PLAYER_ANCHOR, RIVAL_ANCHOR, STEP } from './config.js';
import { clamp, createWind } from './physics.js';
import { createRandom } from './random.js';
import { PLAYER_DESIGN, RIVALS, drawKiteShape, rivalForRound } from './kites.js';
import { createDuel, EV_OVER, EV_SNAP, EV_ZING } from './duel.js';
import { loadSave, offerUpgrades, statsFor, storeSave, upgradeById } from './state.js';
import {
  createBackdrop, drawBackdrop, drawDecoKite, drawDuelWorld, drawHUD, panel, roundRectPath, text, updateBackdrop,
} from './render.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE } from './input.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_CAMPAIGN = 'campaign';
export const SCREEN_INTRO = 'intro';
export const SCREEN_DUEL = 'duel';
export const SCREEN_RESULT = 'result';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_COMPLETE = 'complete';

/** Node positions on the campaign skyline, one rooftop per rival. */
const NODES = [
  { x: 150, y: 540 }, { x: 292, y: 512 }, { x: 442, y: 546 }, { x: 592, y: 510 },
  { x: 742, y: 542 }, { x: 902, y: 508 }, { x: 1058, y: 538 },
];

function drawButton(ctx, buttons, id, x, y, w, h, label, opts = {}) {
  buttons.push({ id, x, y, w, h, disabled: !!opts.disabled });
  roundRectPath(ctx, x, y, w, h, 10);
  if (opts.disabled) {
    ctx.fillStyle = 'rgba(30,24,48,0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,150,190,0.25)';
  } else if (opts.primary) {
    ctx.fillStyle = 'rgba(146,44,32,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,120,0.8)';
  } else {
    ctx.fillStyle = 'rgba(24,16,44,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,120,0.45)';
  }
  ctx.lineWidth = 1.6;
  ctx.stroke();
  text(ctx, label, x + w / 2, y + h / 2 + 6, {
    size: opts.size || 19, weight: 800, align: 'center',
    color: opts.disabled ? 'rgba(200,195,220,0.45)' : '#ffe9b8',
  });
}

/** The three decorative kites that drift over the menu screens. */
export function decoKites(t) {
  const defs = [
    { design: PLAYER_DESIGN, bx: 330, by: 218, phase: 0, anchor: PLAYER_ANCHOR, scale: 1.15 },
    { design: RIVALS[0], bx: 880, by: 170, phase: 2.1, anchor: { x: 950, y: 614 }, scale: 0.95 },
    { design: RIVALS[2], bx: 1085, by: 285, phase: 4.2, anchor: RIVAL_ANCHOR, scale: 0.85 },
  ];
  return defs.map((d) => ({
    ...d,
    x: d.bx + Math.sin(t * 0.23 + d.phase) * 38,
    y: d.by + Math.sin(t * 0.31 + d.phase * 2) * 20,
    angle: Math.sin(t * 0.4 + d.phase) * 0.15,
  }));
}

function drawDecoSet(ctx, t) {
  for (const k of decoKites(t)) {
    drawDecoKite(ctx, k.design, k.x, k.y, k.angle, k.scale, k.anchor, t, 36);
  }
}

// ---------------------------------------------------------------------------
// Painters (shared by the live UI and the screenshot scenes)
// ---------------------------------------------------------------------------

export function paintTitle(ctx, view, buttons) {
  drawBackdrop(ctx, view.bd);
  drawDecoSet(ctx, view.t);
  // The wordmark: gold over the dusk, with the red of the player's own kite under it.
  const grad = ctx.createLinearGradient(0, 96, 0, 208);
  grad.addColorStop(0, '#ffe9a8');
  grad.addColorStop(0.55, '#f5b942');
  grad.addColorStop(1, '#d97b2f');
  ctx.save();
  ctx.font = '900 104px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(20,6,0,0.55)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = grad;
  ctx.fillText('LAYANGAN', 640, 196);
  ctx.restore();
  text(ctx, '— WAR OF STRINGS —', 640, 240, { size: 25, weight: 700, align: 'center', color: '#ffd9c2', shadow: true });
  text(ctx, 'Perang benang di langit kampung. Satu kata kerja: PUTUS.', 640, 276, { size: 19, align: 'center', color: '#f5efe2', shadow: true });

  panel(ctx, 340, 452, 600, 118, 0.78);
  text(ctx, 'Geser mouse untuk terbang — tahan klik / SPASI untuk TARIK (naik, benang menegang).', 640, 486, { size: 16.5, align: 'center', color: '#e8e2d2' });
  text(ctx, 'Lepas untuk menukik: silangkan benangmu dengan benang lawan saat menukik —', 640, 514, { size: 16.5, align: 'center', color: '#e8e2d2' });
  text(ctx, 'gesekan memotongnya. Panah / WASD juga bisa.  P jeda · M senyap.', 640, 542, { size: 16.5, align: 'center', color: '#e8e2d2' });

  const hasProgress = view.save.nextRound > 0 || view.save.completed;
  drawButton(ctx, buttons, 'main', 490, 596, 300, 52, view.save.completed ? 'PETA KAMPUNG' : hasProgress ? 'LANJUTKAN' : 'MULAI', { primary: true, size: 21 });
  if (hasProgress) drawButton(ctx, buttons, 'reset', 1052, 664, 196, 36, 'ULANG DARI AWAL', { size: 13 });
  if (view.save.bestStreak > 0) {
    text(ctx, `Langit Bebas — streak terbaik: ${view.save.bestStreak}`, 640, 676, { size: 14, align: 'center', color: '#cfd4ea' });
  }
}

export function paintCampaign(ctx, view, buttons) {
  drawBackdrop(ctx, view.bd);
  text(ctx, 'PETA KAMPUNG', 640, 74, { size: 40, weight: 900, align: 'center', color: '#ffe9b8', shadow: true });
  text(ctx, view.save.completed ? 'Tujuh atap, tujuh layangan jatuh. Langit ini milikmu.' : 'Tujuh rival menunggu di tujuh atap. Kalahkan mereka satu-satu.', 640, 108, { size: 17, align: 'center', color: '#f5efe2', shadow: true });
  // The route across the rooftops.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,217,148,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 8]);
  ctx.beginPath();
  NODES.forEach((n, i) => {
    if (i === 0) ctx.moveTo(n.x, n.y);
    else ctx.lineTo(n.x, n.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  RIVALS.forEach((rival, i) => {
    const node = NODES[i];
    const beaten = view.save.beaten.includes(rival.name);
    const current = !view.save.completed && i === view.save.nextRound;
    if (beaten) {
      ctx.save();
      ctx.translate(node.x, node.y + 16);
      ctx.rotate(-0.5 + i * 0.13);
      drawKiteShape(ctx, rival, 30, view.t);
      ctx.restore();
      text(ctx, '✓', node.x + 20, node.y - 12, { size: 19, weight: 900, color: '#8fe388' });
    } else {
      const pulse = current ? 3 + Math.sin(view.t * 3.4) * 2.4 : 0;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 17 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = current ? 'rgba(255,180,60,0.9)' : 'rgba(30,24,52,0.85)';
      ctx.fill();
      ctx.strokeStyle = current ? '#ffe9a8' : 'rgba(200,195,220,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, String(i + 1), node.x, node.y + 6, { size: 16, weight: 800, align: 'center', color: current ? '#2a1400' : '#cfd4ea' });
    }
    text(ctx, rival.name, node.x, node.y + 52, {
      size: 13.5, weight: 700, align: 'center',
      color: beaten ? 'rgba(220,215,235,0.55)' : '#f5efe2', shadow: true,
    });
    if (current) buttons.push({ id: 'node:' + i, x: node.x - 30, y: node.y - 30, w: 60, h: 60 });
  });

  // Owned upgrades, as chips along the bottom.
  if (view.save.upgrades.length > 0) {
    text(ctx, 'UPGRADEMU', 44, 664, { size: 13, weight: 700, color: '#cfd4ea' });
    view.save.upgrades.forEach((id, i) => {
      const u = upgradeById(id);
      const x = 44 + i * 196;
      roundRectPath(ctx, x, 674, 186, 30, 8);
      ctx.fillStyle = 'rgba(16,10,30,0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,205,120,0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      text(ctx, `${u.glyph} ${u.name}`, x + 10, 694, { size: 13.5, weight: 700, color: '#ffe9b8' });
    });
  }
  if (!view.save.completed) {
    drawButton(ctx, buttons, 'duel', 490, 596, 300, 50, `LAWAN ${rivalForRound(view.save.nextRound).name.toUpperCase()}`, { primary: true, size: 18 });
  } else {
    drawButton(ctx, buttons, 'bebas', 490, 596, 300, 50, 'LANGIT BEBAS (ENDLESS)', { primary: true, size: 18 });
  }
  drawButton(ctx, buttons, 'judul', 44, 40, 150, 38, '‹ JUDUL', { size: 14 });
}

export function paintIntro(ctx, view, buttons) {
  drawBackdrop(ctx, view.bd);
  ctx.fillStyle = 'rgba(8,5,18,0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const rival = view.rival;
  panel(ctx, 340, 92, 600, 500, 0.9);
  text(ctx, view.endless ? 'LANGIT BEBAS' : `RONDE ${view.round + 1} DARI 7`, 640, 138, { size: 16, weight: 700, align: 'center', color: '#ffd94d' });
  ctx.save();
  ctx.translate(640, 246);
  drawKiteShape(ctx, rival, 96, view.t * 1.4);
  ctx.restore();
  text(ctx, rival.title, 640, 356, { size: 27, weight: 900, align: 'center', color: '#ffe9b8' });
  text(ctx, rival.taunt, 640, 390, { size: 17.5, align: 'center', color: '#e8e2d2' });
  const stats = [
    ['KECEPATAN', rival.ai.speed / 1.2],
    ['KETAJAMAN BENANG', rival.ai.sharpness / 1.6],
    ['KEKUATAN BENANG', rival.ai.stringHp / 160],
    ['KELINCAHAN', rival.ai.agility / 1.2],
  ];
  stats.forEach(([label, frac], i) => {
    const y = 424 + i * 30;
    text(ctx, label, 420, y + 5, { size: 13, weight: 700, color: '#cfd4ea' });
    roundRectPath(ctx, 590, y - 6, 270, 11, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.fillStyle = '#f5b942';
    roundRectPath(ctx, 590, y - 6, 270 * clamp(frac, 0.04, 1), 11, 5);
    ctx.fill();
  });
  drawButton(ctx, buttons, 'mulai', 490, 534, 300, 50, 'MULAI DUEL', { primary: true, size: 20 });
  drawButton(ctx, buttons, 'peta', 44, 40, 150, 38, '‹ PETA', { size: 14 });
}

export function paintResult(ctx, view, buttons) {
  drawBackdrop(ctx, view.bd);
  ctx.fillStyle = 'rgba(8,5,18,0.4)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const r = view.result;
  const win = r.winner === 'player';
  panel(ctx, 390, 130, 500, 400, 0.9);
  text(ctx, win ? 'MENANG!' : 'KALAH', 640, 208, { size: 52, weight: 900, align: 'center', color: win ? '#ffd94d' : '#ff8a76', shadow: true });
  text(ctx, win ? `Benang ${view.rival.name} putus pada ${r.cutSpeed} px/s.` : `${view.rival.name} memotong benangmu.`, 640, 246, { size: 17, align: 'center', color: '#f5efe2' });
  const rows = [
    ['Waktu duel', `${r.timeSec} detik`],
    ['Kecepatan potong', `${r.cutSpeed} px/s`],
    ['Damage benangmu', `${r.damageTakenPct}%`],
    ['Damage benang lawan', `${r.damageDealtPct}%`],
  ];
  if (view.endless) rows.push(['Streak', String(view.streak)]);
  rows.forEach(([label, value], i) => {
    const y = 288 + i * 32;
    text(ctx, label, 450, y, { size: 16.5, color: '#cfd4ea' });
    text(ctx, value, 830, y, { size: 16.5, weight: 700, align: 'right', color: '#f5efe2' });
  });
  text(ctx, `SKOR ${r.score}`, 640, 288 + rows.length * 32 + 16, { size: 26, weight: 900, align: 'center', color: '#ffe9b8' });
  if (win) drawButton(ctx, buttons, 'lanjut', 490, 476, 300, 50, view.endless ? 'LAWAN BERIKUTNYA' : 'LANJUT', { primary: true, size: 19 });
  else drawButton(ctx, buttons, 'coba', 490, 476, 300, 50, 'COBA LAGI', { primary: true, size: 19 });
  drawButton(ctx, buttons, 'peta', 44, 40, 150, 38, '‹ PETA', { size: 14 });
}

export function paintUpgrade(ctx, view, buttons) {
  drawBackdrop(ctx, view.bd);
  ctx.fillStyle = 'rgba(8,5,18,0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'MENANG! PILIH SATU UPGRADE', 640, 150, { size: 34, weight: 900, align: 'center', color: '#ffe9b8', shadow: true });
  text(ctx, 'Tukang layangan di bawah menawarimu satu perbaikan. Pilih dengan bijak.', 640, 186, { size: 16.5, align: 'center', color: '#f5efe2' });
  view.choices.forEach((u, i) => {
    const x = 190 + i * 310;
    const y = 240;
    roundRectPath(ctx, x, y, 280, 240, 14);
    ctx.fillStyle = 'rgba(20,13,38,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,120,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    text(ctx, u.glyph, x + 140, y + 78, { size: 52, weight: 900, align: 'center', color: '#ffd94d' });
    text(ctx, u.name, x + 140, y + 128, { size: 21, weight: 800, align: 'center', color: '#ffe9b8' });
    wrapText(ctx, u.desc, x + 140, y + 164, 240, 22, { size: 15.5, color: '#e8e2d2', align: 'center' });
    buttons.push({ id: 'upgrade:' + u.id, x, y, w: 280, h: 240 });
  });
}

export function paintComplete(ctx, view, buttons) {
  drawBackdrop(ctx, view.bd);
  // Your kite soars over the night kampung, above the fallen seven.
  const kx = 640 + Math.sin(view.t * 0.3) * 90;
  const ky = 218 + Math.sin(view.t * 0.47) * 24;
  drawDecoKite(ctx, PLAYER_DESIGN, kx, ky, Math.sin(view.t * 0.4) * 0.12, 1.5, { x: 640, y: 614 }, view.t, 60);
  text(ctx, 'JUARA LANGIT KAMPUNG', 640, 396, { size: 46, weight: 900, align: 'center', color: '#ffe9b8', shadow: true });
  text(ctx, 'Tujuh rival jatuh ke atap. JANDA HITAM pun putus di tanganmu.', 640, 434, { size: 18, align: 'center', color: '#f5efe2', shadow: true });
  const names = view.save.upgrades.map((id) => upgradeById(id).name);
  text(ctx, names.length > 0 ? `Upgrade terkumpul: ${names.join(' · ')}` : 'Tanpa upgrade sekalipun. Tangan kosong, langit penuh.', 640, 470, { size: 15.5, align: 'center', color: '#cfd4ea' });
  text(ctx, '🏆', 640, 356, { size: 40, align: 'center' });
  drawButton(ctx, buttons, 'bebas', 340, 520, 280, 50, 'LANGIT BEBAS', { primary: true, size: 18 });
  drawButton(ctx, buttons, 'peta', 660, 520, 280, 50, 'PETA KAMPUNG', { size: 18 });
  drawButton(ctx, buttons, 'judul', 44, 40, 150, 38, '‹ JUDUL', { size: 14 });
}

/** Tiny word-wrap for card descriptions. */
function wrapText(ctx, value, x, y, maxWidth, lineHeight, opts) {
  const words = value.split(' ');
  const lines = [];
  let line = '';
  ctx.font = `600 ${opts.size || 16}px system-ui, sans-serif`;
  for (const word of words) {
    const trial = line === '' ? word : line + ' ' + word;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line !== '') lines.push(line);
  lines.forEach((l, i) => text(ctx, l, x, y + i * lineHeight, opts));
}

// ---------------------------------------------------------------------------
// The live UI
// ---------------------------------------------------------------------------

export function createUI({ renderer, input, audio, seed, announce }) {
  const ctx = renderer.ctx;
  const save = loadSave();
  audio.setMuted(save.muted);
  const backdrops = new Map();
  const menuWind = createWind(createRandom((seed ^ 0x5eed) >>> 0), 1);
  const uiRng = createRandom((seed ^ 0x0dd5) >>> 0);

  let screen = SCREEN_TITLE;
  let time = 0;
  let buttons = [];
  let duel = null;
  let duelBackdrop = null;
  let mode = 'campaign'; // or 'endless'
  let roundIndex = save.nextRound;
  let attempt = 0;
  let paused = false;
  let accumulator = 0;
  let overDelay = 0;
  let upgradeChoices = [];
  let endlessStreak = 0;
  let endlessCycle = 0;
  let lastResult = null;
  let warned = false;

  function backdrop(round, fallen) {
    const key = round + ':' + (fallen ? 'f' : '');
    if (!backdrops.has(key)) {
      backdrops.set(key, createBackdrop(round, createRandom((seed + round * 131) >>> 0), { fallen: fallen || [] }));
    }
    return backdrops.get(key);
  }

  function goto(next) {
    screen = next;
    if (announce) announce(screen);
  }

  function startDuel(roundIdx, endless) {
    mode = endless ? 'endless' : 'campaign';
    roundIndex = roundIdx;
    attempt += 1;
    const rival = endless
      ? RIVALS[(endlessCycle + endlessStreak) % RIVALS.length]
      : rivalForRound(roundIdx);
    const rng = createRandom((seed + roundIdx * 7919 + attempt * 104729 + endlessStreak * 31) >>> 0);
    duel = createDuel({
      round: endless ? 7 : roundIdx + 1,
      rival,
      stats: statsFor(save.upgrades),
      rng,
      statScale: endless ? 1 + endlessCycle * 0.15 + endlessStreak * 0.03 : 1,
    });
    duelBackdrop = backdrop(endless ? 7 : roundIdx + 1, []);
    paused = false;
    overDelay = 0;
    warned = false;
    audio.setZing(0);
    goto(SCREEN_DUEL);
  }

  function finishDuel() {
    const result = duel.result;
    lastResult = result;
    if (mode === 'endless') {
      if (result.winner === 'player') {
        endlessStreak += 1;
        if (endlessStreak > save.bestStreak) {
          save.bestStreak = endlessStreak;
          storeSave(save);
        }
      } else {
        endlessCycle += 1;
      }
    } else if (result.winner === 'player') {
      const rival = rivalForRound(roundIndex);
      if (!save.beaten.includes(rival.name)) save.beaten.push(rival.name);
      if (roundIndex === save.nextRound && save.nextRound < 7) save.nextRound += 1;
      if (save.nextRound >= 7) save.completed = true;
      storeSave(save);
    }
    goto(SCREEN_RESULT);
  }

  function playerControl() {
    const kite = duel.player.kite;
    if (input.steering()) {
      const s = input.steer();
      return { tx: kite.pos.x + s.x * 360, ty: kite.pos.y + s.y * 360, pull: input.pulling() };
    }
    if (input.pointer.seen) {
      return { tx: input.pointer.x, ty: input.pointer.y, pull: input.pulling() };
    }
    return { tx: kite.pos.x, ty: Math.max(120, kite.pos.y - 40), pull: true };
  }

  function stepDuel() {
    const events = duel.step(STEP, playerControl());
    const windLevel = duel.wind.strength(duel.player.kite.pos.x, duel.player.kite.pos.y);
    audio.setWind(windLevel);
    audio.setZing(duel.crossing !== null && duel.phase === 'fight' ? 0.9 : 0);
    if (events & EV_SNAP) {
      audio.snapCrack();
      if (duel.result !== null && duel.result.winner === 'player') audio.cutMotif();
    }
    if (events & EV_OVER) {
      if (duel.result.winner === 'player') audio.cheer();
      else audio.thud();
      overDelay = 1.1;
    }
    if (!warned && duel.phase === 'fight' && duel.player.rope.hp / duel.player.rope.maxHp < 0.25) {
      warned = true;
      audio.warn();
    }
    const midWind = duel.wind.at(FIELD.width / 2, 320, { x: 0, y: 0 });
    updateBackdrop(duelBackdrop, STEP, midWind);
  }

  function activate(id) {
    audio.unlock();
    audio.click();
    if (screen === SCREEN_TITLE) {
      if (id === 'main') {
        if (save.completed || save.nextRound > 0) goto(SCREEN_CAMPAIGN);
        else {
          roundIndex = 0;
          goto(SCREEN_INTRO);
        }
      } else if (id === 'reset') {
        const fresh = loadSaveFresh();
        Object.assign(save, fresh);
        storeSave(save);
        goto(SCREEN_TITLE);
      }
    } else if (screen === SCREEN_CAMPAIGN) {
      if (id === 'duel') {
        roundIndex = save.nextRound;
        goto(SCREEN_INTRO);
      } else if (id === 'bebas') startEndless();
      else if (id === 'judul') goto(SCREEN_TITLE);
      else if (id.startsWith('node:')) {
        roundIndex = Number(id.slice(5));
        goto(SCREEN_INTRO);
      }
    } else if (screen === SCREEN_INTRO) {
      if (id === 'mulai') startDuel(roundIndex, mode === 'endless');
      else if (id === 'peta') goto(mode === 'endless' ? SCREEN_TITLE : SCREEN_CAMPAIGN);
    } else if (screen === SCREEN_RESULT) {
      if (id === 'lanjut') {
        if (mode === 'endless') startDuel(6, true);
        else if (lastResult.winner === 'player' && roundIndex >= 6) goto(SCREEN_COMPLETE);
        else if (lastResult.winner === 'player') {
          upgradeChoices = offerUpgrades(uiRng);
          goto(SCREEN_UPGRADE);
        }
      } else if (id === 'coba') startDuel(roundIndex, mode === 'endless');
      else if (id === 'peta') goto(mode === 'endless' ? SCREEN_TITLE : SCREEN_CAMPAIGN);
    } else if (screen === SCREEN_UPGRADE) {
      if (id.startsWith('upgrade:')) {
        save.upgrades.push(id.slice(8));
        storeSave(save);
        roundIndex = save.nextRound;
        goto(SCREEN_INTRO);
      }
    } else if (screen === SCREEN_COMPLETE) {
      if (id === 'bebas') startEndless();
      else if (id === 'peta') goto(SCREEN_CAMPAIGN);
      else if (id === 'judul') goto(SCREEN_TITLE);
    }
  }

  function startEndless() {
    mode = 'endless';
    endlessStreak = 0;
    roundIndex = 6;
    goto(SCREEN_INTRO);
  }

  function loadSaveFresh() {
    return { nextRound: 0, beaten: [], upgrades: [], completed: false, bestStreak: 0, muted: save.muted };
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      save.muted = !save.muted;
      audio.setMuted(save.muted);
      storeSave(save);
    }
    if (screen === SCREEN_DUEL) {
      if (actions & ACTION_PAUSE) {
        paused = !paused;
        audio.unlock();
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      const px = input.pointer.x;
      const py = input.pointer.y;
      const hit = buttons.find((b) => !b.disabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
      if (hit) activate(hit.id);
      else {
        const primary = buttons.find((b) => !b.disabled && (b.id === 'main' || b.id === 'mulai' || b.id === 'duel' || b.id === 'lanjut' || b.id === 'coba'));
        if (primary && !input.pointer.seen) activate(primary.id);
        else if (primary && screen !== SCREEN_UPGRADE && screen !== SCREEN_CAMPAIGN) activate(primary.id);
      }
    }
  }

  /** Advance and draw one frame. dt is real seconds (clamped by the caller). */
  function frame(dt, actions) {
    time += dt;
    handleActions(actions);
    menuWind.update(dt);
    const menuWindVec = menuWind.at(FIELD.width / 2, 320, { x: 0, y: 0 });

    if (screen === SCREEN_DUEL && duel !== null) {
      if (!paused) {
        accumulator += dt;
        let guard = 0;
        while (accumulator >= STEP && guard < 5) {
          stepDuel();
          accumulator -= STEP;
          guard += 1;
          if (overDelay > 0) {
            overDelay -= STEP;
            if (overDelay <= 0 && duel.phase === 'over') {
              finishDuel();
              break;
            }
          }
        }
        if (guard >= 5) accumulator = 0;
      }
      renderer.begin();
      drawBackdrop(ctx, duelBackdrop);
      drawDuelWorld(ctx, duel, time);
      drawHUD(ctx, duel, mode === 'endless' ? `LANGIT BEBAS — ${duel.rival.name}` : `RONDE ${roundIndex + 1} — ${duel.rival.name}`, mode === 'endless' ? endlessStreak : 0);
      if (paused) {
        ctx.fillStyle = 'rgba(8,5,18,0.55)';
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
        panel(ctx, 440, 250, 400, 170, 0.92);
        text(ctx, 'JEDA', 640, 318, { size: 40, weight: 900, align: 'center', color: '#ffe9b8' });
        text(ctx, 'Tekan P atau Esc untuk lanjut.', 640, 356, { size: 16.5, align: 'center', color: '#e8e2d2' });
        text(ctx, 'Benang tidak putus saat kau berpikir.', 640, 384, { size: 14.5, align: 'center', color: '#cfd4ea' });
      }
      return;
    }

    // Menu screens share the menu wind and their round's backdrop.
    let bd;
    let view;
    buttons = [];
    if (screen === SCREEN_TITLE) {
      bd = backdrop(1, []);
      view = { bd, t: time, save };
      updateBackdrop(bd, dt, menuWindVec);
      renderer.begin();
      paintTitle(ctx, view, buttons);
    } else if (screen === SCREEN_CAMPAIGN) {
      bd = backdrop(Math.min(7, save.nextRound + 1), []);
      view = { bd, t: time, save };
      updateBackdrop(bd, dt, menuWindVec);
      renderer.begin();
      paintCampaign(ctx, view, buttons);
    } else if (screen === SCREEN_INTRO) {
      bd = backdrop(mode === 'endless' ? 7 : roundIndex + 1, []);
      view = { bd, t: time, rival: mode === 'endless' ? RIVALS[(endlessCycle + endlessStreak) % RIVALS.length] : rivalForRound(roundIndex), round: roundIndex, endless: mode === 'endless' };
      updateBackdrop(bd, dt, menuWindVec);
      renderer.begin();
      paintIntro(ctx, view, buttons);
    } else if (screen === SCREEN_RESULT && lastResult !== null) {
      bd = backdrop(mode === 'endless' ? 7 : roundIndex + 1, []);
      view = { bd, t: time, result: lastResult, rival: duel !== null ? duel.rival : rivalForRound(roundIndex), endless: mode === 'endless', streak: endlessStreak };
      updateBackdrop(bd, dt, menuWindVec);
      renderer.begin();
      paintResult(ctx, view, buttons);
    } else if (screen === SCREEN_UPGRADE) {
      bd = backdrop(roundIndex + 1, []);
      view = { bd, t: time, choices: upgradeChoices };
      updateBackdrop(bd, dt, menuWindVec);
      renderer.begin();
      paintUpgrade(ctx, view, buttons);
    } else if (screen === SCREEN_COMPLETE) {
      bd = backdrop(7, RIVALS);
      view = { bd, t: time, save };
      updateBackdrop(bd, dt, menuWindVec);
      renderer.begin();
      paintComplete(ctx, view, buttons);
    }
    if (save.muted) {
      text(ctx, 'SENYAP (M)', 1236, 706, { size: 12.5, weight: 700, align: 'right', color: 'rgba(220,215,235,0.6)' });
    }
  }

  return {
    frame,
    /** Pause a running duel (tab hidden); never unpauses on its own. */
    autoPause() {
      if (screen === SCREEN_DUEL) paused = true;
    },
    get screen() {
      return screen;
    },
  };
}
