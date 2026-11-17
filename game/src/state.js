// The saved game and the upgrade pool. The save is one small object in localStorage —
// campaign progress, the upgrades won, the best endless streak, the sound preference —
// read defensively: a missing or damaged save is just a fresh start. Upgrades are data
// plus one function that folds the owned list into the player's flight and string stats.
import { SAVE_KEY } from './config.js';

/** The six between-round upgrades. Effects fold multiplicatively/additively in statsFor. */
export const UPGRADES = [
  { id: 'gelasan', name: 'Gelasan Tajam', desc: '+25% damage benang saat memotong', glyph: '✦' },
  { id: 'panjang', name: 'Benang Panjang', desc: '+15% panjang benang & jangkauan', glyph: '➶' },
  { id: 'ringan', name: 'Rangka Ringan', desc: '+18% kelincahan bermanuver', glyph: '➤' },
  { id: 'lilin', name: 'Lapisan Lilin', desc: '+30 HP benang maksimum', glyph: '❖' },
  { id: 'ekor', name: 'Ekor Penyeimbang', desc: 'Angin 45% lebih lemah pengaruhnya', glyph: '≋' },
  { id: 'kaca', name: 'Kaca Ganda', desc: 'Damage ×1.5 saat menukik (SERRATED)', glyph: '⚔' },
];

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id) || UPGRADES[0];
}

/**
 * Fold the owned upgrade ids into the stats the duel flies with:
 * cutMul (string damage), lengthMul (string length), agilityMul, maxStringHp,
 * windMul (how much wind reaches the kite; below 1 is steadier), diveMul (diving bonus).
 */
export function statsFor(owned) {
  const stats = { cutMul: 1, lengthMul: 1, agilityMul: 1, maxStringHp: 100, windMul: 1, diveMul: 1 };
  for (const id of owned) {
    if (id === 'gelasan') stats.cutMul *= 1.25;
    else if (id === 'panjang') stats.lengthMul *= 1.15;
    else if (id === 'ringan') stats.agilityMul *= 1.18;
    else if (id === 'lilin') stats.maxStringHp += 30;
    else if (id === 'ekor') stats.windMul *= 0.55;
    else if (id === 'kaca') stats.diveMul *= 1.5;
  }
  return stats;
}

/** Three distinct upgrade choices for the reward screen, shuffled from the pool. */
export function offerUpgrades(rng) {
  return rng.shuffled(UPGRADES).slice(0, 3);
}

/** A fresh save: nothing won, nothing flown, sound on. */
export function defaultSave() {
  return {
    nextRound: 0, // 0-based index of the next rival to face
    beaten: [], // rival names, in the order they fell
    upgrades: [], // owned upgrade ids
    completed: false,
    bestStreak: 0,
    muted: false,
  };
}

/** Read the save; any failure at all returns a fresh one. */
export function loadSave() {
  try {
    if (typeof localStorage === 'undefined') return defaultSave();
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const save = defaultSave();
    if (Number.isInteger(parsed.nextRound)) save.nextRound = Math.max(0, Math.min(7, parsed.nextRound));
    if (Array.isArray(parsed.beaten)) save.beaten = parsed.beaten.filter((n) => typeof n === 'string');
    if (Array.isArray(parsed.upgrades)) save.upgrades = parsed.upgrades.filter((id) => UPGRADES.some((u) => u.id === id));
    save.completed = parsed.completed === true;
    if (Number.isFinite(parsed.bestStreak)) save.bestStreak = Math.max(0, Math.floor(parsed.bestStreak));
    save.muted = parsed.muted === true;
    return save;
  } catch {
    return defaultSave();
  }
}

/** Write the save; storage being unavailable is not an error worth surfacing. */
export function storeSave(save) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private windows and full quotas: the campaign simply lasts this visit.
  }
}
