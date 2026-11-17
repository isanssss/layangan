// The screenshot scenes behind ?shot=title|duel|cut|victory. Each stages real engine
// state deterministically from the seed — a live duel with its kites pinned into a
// string-crossing dive, the snap frozen mid-tumble — and paints it with the same
// painters the game itself uses, so a screenshot is the game, not a mock-up of it.
import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createBackdrop, drawBackdrop, drawDuelWorld, drawHUD, updateBackdrop } from './render.js';
import { createDuel } from './duel.js';
import { RIVALS, rivalForRound } from './kites.js';
import { statsFor } from './state.js';
import { paintComplete, paintTitle } from './ui.js';

const DEMO_SAVE = {
  nextRound: 0, beaten: [], upgrades: [], completed: false, bestStreak: 0, muted: false,
};

/** Build the named scene; returns {draw(ctx), info} — info carries the staged facts. */
export function createShotScene(name, seed) {
  if (name === 'duel') return duelScene(seed, false);
  if (name === 'cut') return duelScene(seed, true);
  if (name === 'victory') return victoryScene(seed);
  return titleScene(seed);
}

function settleBackdrop(bd, steps, windVec) {
  for (let i = 0; i < steps; i += 1) updateBackdrop(bd, STEP, windVec);
}

function titleScene(seed) {
  const bd = createBackdrop(1, createRandom((seed + 11) >>> 0));
  settleBackdrop(bd, 90, { x: 44, y: 0 });
  const view = { bd, t: 2.4, save: DEMO_SAVE };
  return {
    info: { screen: 'title', crossing: false, snapActive: false },
    draw(ctx) {
      paintTitle(ctx, view, []);
    },
  };
}

function victoryScene(seed) {
  const bd = createBackdrop(7, createRandom((seed + 77) >>> 0), { fallen: RIVALS });
  settleBackdrop(bd, 60, { x: 30, y: 0 });
  const save = {
    ...DEMO_SAVE,
    completed: true,
    nextRound: 7,
    beaten: RIVALS.map((r) => r.name),
    upgrades: ['gelasan', 'lilin', 'kaca'],
    bestStreak: 4,
  };
  const view = { bd, t: 2.2, save };
  return {
    info: { screen: 'complete', crossing: false, snapActive: false },
    draw(ctx) {
      paintComplete(ctx, view, []);
    },
  };
}

/**
 * The duel scenes share one staging: the player has crossed to the rival's side of the
 * sky and dives down across the rival's string, both strings taut, sparks flying. The
 * cut scene plays the same moment forward into the snap.
 */
function duelScene(seed, cut) {
  const roundIndex = cut ? 2 : 5; // Elang Perak for the cut, Raja Langit for the duel
  const rival = rivalForRound(roundIndex);
  const duel = createDuel({
    round: roundIndex + 1,
    rival,
    stats: statsFor([]),
    rng: createRandom((seed + roundIndex * 7919) >>> 0),
  });
  // Pin the geometry: player high on the rival's side, diving; rival climbing away.
  const p = duel.player.kite;
  p.pos.x = 815;
  p.pos.y = 180;
  p.vel.x = 140;
  p.vel.y = 370;
  const r = duel.rivalSide.kite;
  r.pos.x = 430;
  r.pos.y = 260;
  r.vel.x = -60;
  r.vel.y = -120;
  duel.rivalOverride = (d) => ({ tx: d.rivalSide.kite.pos.x, ty: d.rivalSide.kite.pos.y, pull: true });
  duel.player.rope.hp = 58;
  duel.rivalSide.rope.hp = cut ? 4 : 61;

  const control = { tx: 815, ty: 430, pull: false };
  let steps = 0;
  while (steps < 40 && duel.crossing === null) {
    duel.step(STEP, control);
    steps += 1;
  }
  const crossingStaged = duel.crossing !== null;
  if (cut) {
    duel.forceSnap('player');
    for (let i = 0; i < 12; i += 1) duel.step(STEP, control);
  } else {
    for (let i = 0; i < 6; i += 1) duel.step(STEP, control);
  }

  const bd = createBackdrop(roundIndex + 1, createRandom((seed + roundIndex * 131) >>> 0));
  const midWind = duel.wind.at(FIELD.width / 2, 320, { x: 0, y: 0 });
  settleBackdrop(bd, 45, midWind);
  const label = `RONDE ${roundIndex + 1} — ${rival.name}`;
  const info = {
    screen: cut ? 'cut' : 'duel',
    crossing: crossingStaged,
    snapActive: duel.phase === 'snap',
  };
  return {
    info,
    draw(ctx) {
      drawBackdrop(ctx, bd);
      drawDuelWorld(ctx, duel, 1.7);
      drawHUD(ctx, duel, label, 0);
    },
  };
}
