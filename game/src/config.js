// Shared constants for LAYANGAN — War of Strings: the field, the fixed step, the anchors the
// strings fly from, the physics tuning every other module reads, and the sky palettes that
// deepen as the campaign climbs from gold afternoon to purple night.

/** The virtual field every coordinate lives in; the renderer scales it to the window. */
export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: the duel advances in these and only these. */
export const STEP = 1 / 60;

/** Where the skyline's rooftops sit; kites rest here when they fall. */
export const ROOF_Y = 632;

/** The two handlers' rooftops: the player's bottom-left, the rival's bottom-right. */
export const PLAYER_ANCHOR = { x: 168, y: 614 };
export const RIVAL_ANCHOR = { x: 1112, y: 614 };

/** Kite flight tuning (pixels, seconds). */
export const FLIGHT = {
  maxSpeed: 430, // the player's top speed; rivals scale it by their own speed factor
  seekGain: 2.4, // how hard velocity leans toward the seek target
  agility: 3.6, // how fast velocity itself can turn
  pullClimb: 660, // upward acceleration while tarik (pull) is held
  pullStrain: 340, // outward strain along the string while pulling: rides the leash taut
  sink: 330, // downward drift while gliding released
  diveBoost: 300, // extra acceleration along the velocity once a dive is falling
  stallSpeed: 95, // below this the kite flutters and sinks
  stallSink: 300,
  windGrip: 0.85, // how much of the wind becomes kite acceleration
};

/** String tuning. */
export const ROPE = {
  segments: 14,
  baseLength: 800, // the player's string length before upgrades
  gravity: 60, // a light string sags a little; the kites' pull keeps it near-straight
  windShare: 0.45, // how much wind the string itself feels
  iterations: 3,
  tautAt: 0.86, // tension at or above this can cut
  goldAt: 0.94, // tension in this zone fills the HUD meter gold
};

/** Combat tuning: abrasion per second of taut crossing contact. */
export const COMBAT = {
  abradeK: 0.0175, // damage = relative speed * abradeK * sharpness * dive factor
  grindWear: 0.55, // flat wear per second whenever strings cross taut, speed or not
  diveSpeed: 150, // downward speed past this counts as a serrated dive
  diveBonus: 1.7, // damage multiplier for the side diving across
  snapSlowmo: 0.3, // time scale during the snap moment
  snapSeconds: 1.25, // real seconds the slow motion lasts
};

/** localStorage key (one namespace, versioned). */
export const SAVE_KEY = 'layangan.save.v1';

/** The font stack every canvas text uses. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Sky palettes by campaign round (1-based; index 0 repeats round 1 for safety). Each is a
 * vertical gradient (top, mid, horizon), how present the sun and moon are, how many stars
 * show, and what share of skyline windows burn lit.
 */
export const SKIES = [
  { top: '#3f6ea6', mid: '#c97e4e', horizon: '#ffd98a', sun: 0.98, moon: 0, stars: 0, windowLit: 0.0 },
  { top: '#3f6ea6', mid: '#d98a52', horizon: '#ffd98a', sun: 0.95, moon: 0, stars: 0, windowLit: 0.05 },
  { top: '#46689c', mid: '#e08a4e', horizon: '#ffb35c', sun: 0.8, moon: 0, stars: 0, windowLit: 0.15 },
  { top: '#3d4e8a', mid: '#d96f4e', horizon: '#ff8c42', sun: 0.62, moon: 0, stars: 12, windowLit: 0.3 },
  { top: '#353a6e', mid: '#b84a63', horizon: '#f76b6b', sun: 0.45, moon: 0.15, stars: 40, windowLit: 0.5 },
  { top: '#2c2a5e', mid: '#8e3d63', horizon: '#d94f70', sun: 0.28, moon: 0.4, stars: 90, windowLit: 0.7 },
  { top: '#241f4e', mid: '#5e2f63', horizon: '#9b4d8f', sun: 0.12, moon: 0.7, stars: 150, windowLit: 0.9 },
  { top: '#120e2e', mid: '#33204f', horizon: '#4a2a6e', sun: 0, moon: 1, stars: 220, windowLit: 1 },
];

/** The palette for a 1-based round; endless and late rounds clamp to the night sky. */
export function skyForRound(round) {
  return SKIES[Math.max(1, Math.min(SKIES.length - 1, round))];
}
