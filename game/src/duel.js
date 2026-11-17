// One duel: two kites, two strings, one sky. The duel owns the wind, the crossing
// detection, the abrasion that saws strings apart, the snap and its slow motion, and the
// style score. It is driven with fixed steps and a player control {tx, ty, pull}; the
// rival is flown by ai.js unless an override is installed (tests and screenshot scenes).
// step() returns event flags so the caller can make noise about what happened.
import { COMBAT, FIELD, FLIGHT, PLAYER_ANCHOR, RIVAL_ANCHOR, ROPE, ROOF_Y } from './config.js';
import {
  clamp, createKiteBody, createRope, createWind, segIntersect, severRope, stepKiteBody, stepRope,
} from './physics.js';
import { PLAYER_DESIGN } from './kites.js';
import { createAI } from './ai.js';

export const EV_ZING = 1; // strings are grinding this step
export const EV_SNAP = 2; // a string just snapped
export const EV_OVER = 4; // the round just ended
export const EV_SERRATED = 8; // a diving cut bit this step

const _wind = { x: 0, y: 0 };

/**
 * Create a duel. opts: {round (1-based, for weather), rival (a def from kites.js),
 * stats (the player's folded upgrade stats), rng, statScale (endless difficulty, 1 = none)}.
 */
export function createDuel(opts) {
  const rival = opts.rival;
  const stats = opts.stats;
  const scale = opts.statScale || 1;
  const rng = opts.rng;

  const playerLen = ROPE.baseLength * stats.lengthMul;
  const rivalLen = ROPE.baseLength;
  const playerKite = createKiteBody(330, 250, PLAYER_DESIGN);
  const rivalKite = createKiteBody(950, 225, rival);
  playerKite.restY = ROOF_Y - 6;
  rivalKite.restY = ROOF_Y - 6;
  const playerRope = createRope(PLAYER_ANCHOR, playerKite.pos, playerLen);
  playerRope.hp = playerRope.maxHp = stats.maxStringHp;
  const rivalRope = createRope(RIVAL_ANCHOR, rivalKite.pos, rivalLen);
  rivalRope.hp = rivalRope.maxHp = Math.round(rival.ai.stringHp * scale);

  const duel = {
    round: opts.round,
    rival,
    stats,
    rng,
    wind: createWind(rng, opts.round),
    player: { kite: playerKite, rope: playerRope, anchor: PLAYER_ANCHOR, len: playerLen },
    rivalSide: { kite: rivalKite, rope: rivalRope, anchor: RIVAL_ANCHOR, len: rivalLen },
    ai: createAI(rival, rng),
    rivalOverride: null,
    phase: 'fight', // fight -> snap -> over
    time: 0,
    snapClock: 0,
    crossing: null, // {x, y, relSpeed, paramA, paramB} while the strings touch
    sparks: [],
    floaters: [],
    result: null,
    cutSpeed: 0,
    serratedCool: { player: 0, rival: 0 },
    sparkAcc: 0,
    playerControl: { tx: 330, ty: 250, pull: false },

    /** Advance one fixed step. Returns EV_* flags for what happened. */
    step(dt, control) {
      let events = 0;
      this.playerControl = control;
      const timeScale = this.phase === 'snap' ? COMBAT.snapSlowmo : 1;
      const pdt = dt * timeScale;
      this.time += pdt;
      this.wind.update(pdt);
      this.serratedCool.player = Math.max(0, this.serratedCool.player - dt);
      this.serratedCool.rival = Math.max(0, this.serratedCool.rival - dt);

      // --- controls -----------------------------------------------------
      let rivalControl;
      if (this.phase !== 'fight') {
        rivalControl = { tx: FIELD.width / 2, ty: 200, pull: true };
      } else if (this.rivalOverride) {
        rivalControl = this.rivalOverride(this);
      } else {
        rivalControl = this.ai.update(pdt, {
          self: this.rivalSide.kite,
          foe: this.player.kite,
          selfAnchor: RIVAL_ANCHOR,
          foeAnchor: PLAYER_ANCHOR,
          selfHpFrac: this.rivalSide.rope.hp / this.rivalSide.rope.maxHp,
          time: this.time,
        });
      }
      // --- kites --------------------------------------------------------
      this.wind.at(this.player.kite.pos.x, this.player.kite.pos.y, _wind);
      stepKiteBody(this.player.kite, this.phase === 'fight' ? control : winnerControlFor(this, 'player', control), _wind, pdt, {
        maxSpeed: FLIGHT.maxSpeed,
        agilityMul: stats.agilityMul,
        windMul: stats.windMul,
        anchor: PLAYER_ANCHOR,
        stringLen: this.player.len,
      });
      this.wind.at(this.rivalSide.kite.pos.x, this.rivalSide.kite.pos.y, _wind);
      stepKiteBody(this.rivalSide.kite, this.phase === 'fight' ? rivalControl : winnerControlFor(this, 'rival', rivalControl), _wind, pdt, {
        maxSpeed: FLIGHT.maxSpeed * rival.ai.speed * Math.min(1.25, scale),
        agilityMul: rival.ai.agility,
        windMul: 1,
        anchor: RIVAL_ANCHOR,
        stringLen: this.rivalSide.len,
      });
      bounceBodies(this.player.kite, this.rivalSide.kite);

      // --- strings ------------------------------------------------------
      this.wind.at(FIELD.width / 2, 320, _wind);
      stepRope(this.player.rope, this.player.kite.pos, _wind, pdt);
      stepRope(this.rivalSide.rope, this.rivalSide.kite.pos, _wind, pdt);

      // --- combat -------------------------------------------------------
      if (this.phase === 'fight') {
        events |= this.combat(pdt);
        if (this.rivalSide.rope.hp <= 0 || this.player.rope.hp <= 0) {
          const loser = this.rivalSide.rope.hp <= 0 && this.rivalSide.rope.hp <= this.player.rope.hp ? 'rival' : 'player';
          this.beginSnap(loser);
          events |= EV_SNAP;
        }
      } else {
        this.crossing = null;
      }

      // --- particles & floaters ----------------------------------------
      this.updateFx(dt);
      if (this.phase === 'snap') {
        this.snapClock += dt;
        if (this.snapClock >= COMBAT.snapSeconds) {
          this.phase = 'over';
          this.finishResult();
          events |= EV_OVER;
        }
      }
      return events;
    },

    /** Crossing detection + abrasion for one step. Returns event flags. */
    combat(dt) {
      let events = 0;
      const a = this.player.rope.points;
      const b = this.rivalSide.rope.points;
      let best = null;
      for (let i = 0; i < a.length - 1; i += 1) {
        for (let j = 0; j < b.length - 1; j += 1) {
          const hit = segIntersect(a[i].x, a[i].y, a[i + 1].x, a[i + 1].y, b[j].x, b[j].y, b[j + 1].x, b[j + 1].y);
          if (hit === null) continue;
          const paramA = (i + hit.t) / ROPE.segments;
          const paramB = (j + hit.u) / ROPE.segments;
          const rvx = this.player.kite.vel.x * paramA - this.rivalSide.kite.vel.x * paramB;
          const rvy = this.player.kite.vel.y * paramA - this.rivalSide.kite.vel.y * paramB;
          const rel = Math.hypot(rvx, rvy);
          if (best === null || rel > best.relSpeed) {
            best = { x: hit.x, y: hit.y, relSpeed: rel, paramA, paramB, rvx, rvy };
          }
        }
      }
      this.crossing = best;
      if (best === null) return events;
      // A side grinds when its string is taut — or when its kite is driving across at
      // speed, which holds its line hard against the other string just the same. This
      // is why the dive is the cut in real layangan aduan.
      const engaged = (side) => side.rope.tension >= ROPE.tautAt
        || Math.hypot(side.kite.vel.x, side.kite.vel.y) > 300
        || side.kite.vel.y > COMBAT.diveSpeed;
      if (!engaged(this.player) || !engaged(this.rivalSide)) return events;

      events |= EV_ZING;
      const pVelY = this.player.kite.vel.y * best.paramA;
      const rVelY = this.rivalSide.kite.vel.y * best.paramB;
      const playerDiving = pVelY > COMBAT.diveSpeed;
      const rivalDiving = rVelY > COMBAT.diveSpeed;
      const toRival = (best.relSpeed * COMBAT.abradeK * this.stats.cutMul
        * (playerDiving ? COMBAT.diveBonus * this.stats.diveMul : 1) + COMBAT.grindWear * this.stats.cutMul) * dt;
      const toPlayer = (best.relSpeed * COMBAT.abradeK * this.rival.ai.sharpness
        * (rivalDiving ? COMBAT.diveBonus : 1) + COMBAT.grindWear * this.rival.ai.sharpness) * dt;
      this.rivalSide.rope.hp -= toRival;
      this.player.rope.hp -= toPlayer;
      this.cutSpeed = best.relSpeed;

      if (playerDiving && this.serratedCool.player <= 0) {
        this.addFloater(best.x, best.y - 14, 'SERRATED!', '#ffd94d');
        this.serratedCool.player = 1.4;
        events |= EV_SERRATED;
      }
      if (rivalDiving && this.serratedCool.rival <= 0) {
        this.addFloater(best.x, best.y + 22, 'SERRATED!', '#ff9a8a');
        this.serratedCool.rival = 1.4;
      }
      this.sparkAcc += dt * 46;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const ang = this.rng.range(0, Math.PI * 2);
        const sp = this.rng.range(40, 190);
        this.sparks.push({
          x: best.x, y: best.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
          life: this.rng.range(0.25, 0.55), maxLife: 0.55,
        });
      }
      return events;
    },

    /** Start the snap: sever the loser's string at the crossing (or its middle). */
    beginSnap(loserSide) {
      const loser = loserSide === 'player' ? this.player : this.rivalSide;
      const cut = this.crossing !== null
        ? { x: this.crossing.x, y: this.crossing.y }
        : loser.rope.points[Math.floor(loser.rope.points.length / 2)];
      severRope(loser.rope, cut);
      loser.kite.fallen = true;
      loser.kite.vel.x *= 0.4;
      loser.kite.vel.y = Math.min(loser.kite.vel.y, 40);
      this.phase = 'snap';
      this.snapClock = 0;
      this.result = {
        winner: loserSide === 'player' ? 'rival' : 'player',
        loser: loserSide,
        cutSpeed: Math.round(this.cutSpeed),
        timeSec: Math.round(this.time),
        damageTakenPct: 0,
        damageDealtPct: 0,
        score: 0,
      };
    },

    /** Force a snap outcome — screenshot scenes stage the moment with this. */
    forceSnap(winnerSide) {
      this.beginSnap(winnerSide === 'player' ? 'rival' : 'player');
    },

    /** Score the finished round once the slow motion has played out. */
    finishResult() {
      const r = this.result;
      if (r === null) return;
      const playerFrac = clamp(this.player.rope.hp / this.player.rope.maxHp, 0, 1);
      const rivalFrac = clamp(this.rivalSide.rope.hp / this.rivalSide.rope.maxHp, 0, 1);
      r.damageTakenPct = Math.round((1 - playerFrac) * 100);
      r.damageDealtPct = Math.round((1 - rivalFrac) * 100);
      if (r.winner === 'player') {
        r.score = Math.max(100, Math.round(600 + r.cutSpeed * 1.5 + playerFrac * 400 - r.timeSec * 2));
      } else {
        r.score = Math.round(r.timeSec * 3 + r.damageDealtPct * 3);
      }
    },

    addFloater(x, y, text, color) {
      this.floaters.push({ x, y, text, color, life: 1.15, maxLife: 1.15 });
    },

    updateFx(dt) {
      for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
        const s = this.sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          this.sparks.splice(i, 1);
          continue;
        }
        s.vy += 300 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
        const f = this.floaters[i];
        f.life -= dt;
        f.y -= 34 * dt;
        if (f.life <= 0) this.floaters.splice(i, 1);
      }
    },
  };
  return duel;
}

/** After the snap, the winner flies a lazy victory circle; the loser is ballistic. */
function winnerControlFor(duel, side, fallback) {
  if (duel.result === null) return fallback;
  const isWinner = (side === 'player') === (duel.result.winner === 'player');
  if (!isWinner) return fallback;
  return {
    tx: FIELD.width / 2 + Math.cos(duel.time * 0.55) * 250,
    ty: 205 + Math.sin(duel.time * 0.55) * 55,
    pull: true,
  };
}

/** Kite bodies that meet bounce softly apart; cloth and bamboo do no damage. */
function bounceBodies(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const d = Math.hypot(dx, dy);
  const min = 52;
  if (d === 0 || d >= min) return;
  const push = ((min - d) / 2) * 0.8;
  const nx = dx / d;
  const ny = dy / d;
  if (!a.fallen) {
    a.pos.x -= nx * push;
    a.pos.y -= ny * push;
  }
  if (!b.fallen) {
    b.pos.x += nx * push;
    b.pos.y += ny * push;
  }
  const rvx = b.vel.x - a.vel.x;
  const rvy = b.vel.y - a.vel.y;
  const along = rvx * nx + rvy * ny;
  if (along < 0) {
    const impulse = -along * 0.35;
    a.vel.x -= nx * impulse;
    a.vel.y -= ny * impulse;
    b.vel.x += nx * impulse;
    b.vel.y += ny * impulse;
  }
}
