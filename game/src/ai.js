// The rival pilot: a small state machine that circles, climbs for position, commits to a
// dive across your string, then retreats to regroup — with each rival's temperament from
// kites.js (aggression, dive frequency, skill) shaping how often it attacks, how cleanly
// it aims, and how quickly it reacts. It reads the same world the player does: both kite
// bodies, both anchors, and its own string's health.
import { FIELD } from './config.js';

export const AI_CIRCLE = 'circle';
export const AI_CLIMB = 'climb';
export const AI_DIVE = 'dive';
export const AI_REGROUP = 'regroup';

/**
 * Create a pilot for a rival definition. `rng` is the duel's seeded generator, so a
 * rival flies the same lines every time a round is replayed with the same seed.
 */
export function createAI(def, rng) {
  const ai = def.ai;
  return {
    def,
    state: AI_CIRCLE,
    timer: rng.range(0.6, 1.6),
    orbitPhase: rng.range(0, Math.PI * 2),
    orbitDir: rng.chance(0.5) ? 1 : -1,
    aimError: { x: 0, y: 0 },
    /**
     * Choose this step's control. ctx: {self, foe, selfAnchor, foeAnchor, selfHpFrac,
     * time} — kite bodies for self and foe, the anchors, own string health 0..1.
     */
    update(dt, ctx) {
      const p = ai;
      this.timer -= dt;
      const self = ctx.self.pos;
      const foe = ctx.foe.pos;
      const noise = (1 - p.skill) * 130;

      if (this.timer <= 0) {
        this.state = this.choose(ctx, rng);
        this.aimError.x = rng.range(-noise, noise);
        this.aimError.y = rng.range(-noise, noise) * 0.7;
        this.timer = this.stateDuration(rng);
      }

      switch (this.state) {
        case AI_CLIMB: {
          // Take the high ground over the foe, string pulled taut.
          return {
            tx: foe.x + this.aimError.x * 0.5,
            ty: Math.max(90, foe.y - 190 + this.aimError.y),
            pull: true,
          };
        }
        case AI_DIVE: {
          // Commit: aim through the foe's string line, below and past the foe, released.
          const midX = (ctx.foeAnchor.x + foe.x) / 2;
          const midY = (ctx.foeAnchor.y + foe.y) / 2;
          const past = 170;
          const dx = midX - self.x;
          const dy = midY - self.y;
          const d = Math.hypot(dx, dy) || 1;
          return {
            tx: midX + (dx / d) * past + this.aimError.x,
            ty: midY + (dy / d) * past + this.aimError.y + 60,
            pull: false,
          };
        }
        case AI_REGROUP: {
          // Fall back toward home sky, high and safe, string slack to recover nerve.
          return {
            tx: ctx.selfAnchor.x + (FIELD.width / 2 - ctx.selfAnchor.x) * 0.22,
            ty: 170 + this.aimError.y,
            pull: self.y > 260,
          };
        }
        case AI_CIRCLE:
        default: {
          // Loiter on a wide orbit that drifts toward the foe's half as aggression grows.
          this.orbitPhase += dt * 0.55 * this.orbitDir;
          const cx = FIELD.width / 2 + (foe.x - FIELD.width / 2) * p.aggression * 0.55;
          const cy = 290;
          return {
            tx: cx + Math.cos(this.orbitPhase) * 350,
            ty: cy + Math.sin(this.orbitPhase) * 150 - 40,
            pull: self.y > cy - 20,
          };
        }
      }
    },
    /** Pick the next state from temperament and the state of the fight. */
    choose(ctx, rng) {
      const p = ai;
      if (ctx.selfHpFrac < 0.3 && rng.chance(0.6)) return AI_REGROUP;
      if (this.state === AI_DIVE) return rng.chance(0.45) ? AI_REGROUP : AI_CIRCLE;
      if (this.state === AI_CLIMB) return rng.chance(0.35 + p.diveFreq * 0.55) ? AI_DIVE : AI_CIRCLE;
      // From circle: climb first if below the foe, else attack by temperament.
      if (ctx.self.pos.y > ctx.foe.pos.y - 60 && rng.chance(0.4 + p.aggression * 0.4)) return AI_CLIMB;
      if (rng.chance(p.aggression * 0.55 + p.diveFreq * 0.3)) return AI_CLIMB;
      return AI_CIRCLE;
    },
    /** How long a state lasts; skilled rivals commit shorter, cleaner. */
    stateDuration(rng) {
      switch (this.state) {
        case AI_DIVE:
          return rng.range(1.1, 1.7);
        case AI_CLIMB:
          return rng.range(1.2, 2.2);
        case AI_REGROUP:
          return rng.range(1.4, 2.4);
        default:
          return rng.range(1.6, 3.2);
      }
    },
  };
}
