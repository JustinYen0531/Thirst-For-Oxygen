import {
  ENEMY_DEFINITIONS,
  PASSIVE_ABILITIES,
  WEAPONS,
  getEnemyExperienceReward as getEnemyExperienceRewardFromData,
} from './game-data.js';

// The initial knife is free and occupies the first weapon slot. With the
// existing 3/2/1 slot caps, the normal build has nine post-start level choices
// (weapon upgrades/acquisitions plus three passive slots).
export const PLAYER_START_LEVEL = 1;
export const MAX_WEAPON_SLOTS = 3;
export const MAX_PASSIVE_SLOTS = 3;
export const BUILD_SLOT_LEVEL_CAPS = Object.freeze([3, 2, 1]);
export const EXPERIENCE_THRESHOLDS = Object.freeze([
  0,    // Lv.1
  100,  // Lv.2
  230,  // Lv.3
  390,  // Lv.4
  580,  // Lv.5
  800,  // Lv.6
  1050, // Lv.7
  1330, // Lv.8
  1640, // Lv.9
  1980, // Lv.10
]);
export const PLAYER_MAX_LEVEL = EXPERIENCE_THRESHOLDS.length;

const CATEGORY_KEYS = Object.freeze(['weapon', 'passive']);
const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
const PASSIVE_IDS = Object.freeze(Object.keys(PASSIVE_ABILITIES));

function clampLevel(level) {
  return Math.max(PLAYER_START_LEVEL, Math.min(PLAYER_MAX_LEVEL, Math.round(Number(level) || PLAYER_START_LEVEL)));
}

function copyBuildEntries(entries = []) {
  return entries.map((entry) => ({ id: entry.id, level: Math.max(1, Math.round(Number(entry.level) || 1)) }));
}

export function getExperienceThreshold(level) {
  return EXPERIENCE_THRESHOLDS[clampLevel(level) - 1];
}

export function getExperienceToNextLevel(level) {
  const safeLevel = clampLevel(level);
  if (safeLevel >= PLAYER_MAX_LEVEL) return 0;
  return EXPERIENCE_THRESHOLDS[safeLevel] - EXPERIENCE_THRESHOLDS[safeLevel - 1];
}

export function getExperienceProgress(progression) {
  const level = clampLevel(progression?.level);
  const currentThreshold = getExperienceThreshold(level);
  const nextThreshold = level >= PLAYER_MAX_LEVEL
    ? currentThreshold
    : getExperienceThreshold(level + 1);
  const current = Math.max(0, (progression?.totalExperience ?? 0) - currentThreshold);
  const required = Math.max(0, nextThreshold - currentThreshold);
  return {
    level,
    current,
    required,
    ratio: required > 0 ? Math.min(1, current / required) : 1,
    total: Math.max(0, progression?.totalExperience ?? 0),
    atMaxLevel: level >= PLAYER_MAX_LEVEL,
  };
}

export function getLevelForExperience(totalExperience = 0) {
  const total = Math.max(0, Number(totalExperience) || 0);
  let level = PLAYER_START_LEVEL;
  EXPERIENCE_THRESHOLDS.forEach((threshold, index) => {
    if (total >= threshold) level = index + 1;
  });
  return level;
}

export function createProgressionState() {
  return {
    level: PLAYER_START_LEVEL,
    experience: 0,
    totalExperience: 0,
    pendingLevelUps: 0,
    weapons: [{ id: 'knife', level: 1 }],
    passives: [],
    activeWeaponSlot: 0,
    offerOffsets: { weapon: 0, passive: 0 },
  };
}

export function addExperience(progression, amount) {
  const gained = Math.max(0, Number(amount) || 0);
  if (!progression || gained <= 0) return { gained: 0, levelUps: 0, levels: [] };
  const previousLevel = clampLevel(progression.level);
  progression.totalExperience = Math.max(0, progression.totalExperience ?? 0) + gained;
  progression.level = getLevelForExperience(progression.totalExperience);
  progression.experience = getExperienceProgress(progression).current;
  const levelUps = Math.max(0, progression.level - previousLevel);
  progression.pendingLevelUps = Math.max(0, progression.pendingLevelUps ?? 0) + levelUps;
  return {
    gained,
    levelUps,
    levels: Array.from({ length: levelUps }, (_, index) => previousLevel + index + 1),
  };
}

export function getEnemyExperienceReward(enemyId) {
  return getEnemyExperienceRewardFromData(enemyId);
}

function getOwnedEntry(entries, id) {
  return entries.find((entry) => entry.id === id) ?? null;
}

function getSlotCap(entries, index) {
  return BUILD_SLOT_LEVEL_CAPS[Math.min(index, BUILD_SLOT_LEVEL_CAPS.length - 1)];
}

export function getUpgradeCandidates(progression, category) {
  if (!CATEGORY_KEYS.includes(category)) return [];
  const entries = category === 'weapon' ? (progression?.weapons ?? []) : (progression?.passives ?? []);
  const definitions = category === 'weapon' ? WEAPONS : PASSIVE_ABILITIES;
  const ids = category === 'weapon' ? WEAPON_IDS : PASSIVE_IDS;
  const candidates = [];

  entries.forEach((entry, index) => {
    const definition = definitions[entry.id];
    const cap = Math.min(definition?.maxLevel ?? 1, getSlotCap(entries, index));
    if (!definition || entry.level >= cap) return;
    candidates.push({
      category,
      action: 'upgrade',
      id: entry.id,
      level: entry.level + 1,
      label: `${definition.name} Lv.${entry.level + 1}`,
      detail: category === 'weapon' ? '提升武器等級與攻擊規格。' : '提升被動能力等級與效果。',
    });
  });

  if (entries.length < (category === 'weapon' ? MAX_WEAPON_SLOTS : MAX_PASSIVE_SLOTS)) {
    ids.forEach((id) => {
      if (getOwnedEntry(entries, id)) return;
      const definition = definitions[id];
      candidates.push({
        category,
        action: 'acquire',
        id,
        level: 1,
        label: `${definition.name} Lv.1`,
        detail: category === 'weapon' ? '加入新的武器槽位；小刀永遠保留在 Build。' : '加入新的被動能力槽位。',
      });
    });
  }
  return candidates;
}

export function getAvailableUpgradeCategories(progression) {
  return CATEGORY_KEYS.filter((category) => getUpgradeCandidates(progression, category).length > 0);
}

export function getUpgradeChoices(progression, category, count = 2) {
  const candidates = getUpgradeCandidates(progression, category);
  if (!candidates.length) return [];
  const offset = Math.max(0, Math.floor(progression?.offerOffsets?.[category] ?? 0)) % candidates.length;
  const choiceCount = Math.min(Math.max(1, count), candidates.length);
  return Array.from({ length: choiceCount }, (_, index) => candidates[(offset + index) % candidates.length]);
}

export function applyUpgradeChoice(progression, choice) {
  if (!progression || !choice || !CATEGORY_KEYS.includes(choice.category)) return { ok: false, reason: 'choice' };
  const legal = getUpgradeCandidates(progression, choice.category).find((candidate) => (
    candidate.action === choice.action && candidate.id === choice.id && candidate.level === choice.level
  ));
  if (!legal) return { ok: false, reason: 'unavailable' };

  const entries = choice.category === 'weapon' ? progression.weapons : progression.passives;
  const existingIndex = entries.findIndex((entry) => entry.id === choice.id);
  if (choice.action === 'acquire') entries.push({ id: choice.id, level: 1 });
  else if (existingIndex >= 0) entries[existingIndex].level = choice.level;
  else return { ok: false, reason: 'entry' };

  progression.pendingLevelUps = Math.max(0, (progression.pendingLevelUps ?? 0) - 1);
  progression.offerOffsets[choice.category] = Math.max(0, progression.offerOffsets[choice.category] ?? 0) + 1;
  return { ok: true, choice: legal, pendingLevelUps: progression.pendingLevelUps };
}

export function getActiveWeapon(progression) {
  const slot = Math.max(0, Math.min((progression?.weapons?.length ?? 1) - 1, progression?.activeWeaponSlot ?? 0));
  return progression?.weapons?.[slot] ?? { id: 'knife', level: 1 };
}

export function setActiveWeapon(progression, slotOrId) {
  if (!progression?.weapons?.length) return { id: 'knife', level: 1 };
  const slot = typeof slotOrId === 'number'
    ? slotOrId
    : progression.weapons.findIndex((entry) => entry.id === slotOrId);
  progression.activeWeaponSlot = Math.max(0, Math.min(progression.weapons.length - 1, slot >= 0 ? slot : 0));
  return getActiveWeapon(progression);
}

export function createExperienceOrb(id, x, y, value, source = 'enemyDefeat') {
  return {
    id,
    x,
    y,
    value: Math.max(0, Number(value) || 0),
    radius: 7,
    source,
    collected: false,
  };
}

export function collectExperienceOrbs(progression, orbs, actor, pickupRadius = 8) {
  const remaining = [];
  const collected = [];
  let levelUps = 0;
  (orbs ?? []).forEach((orb) => {
    const distance = Math.hypot((actor?.x ?? 0) - orb.x, (actor?.y ?? 0) - orb.y);
    if (distance <= (actor?.radius ?? 0) + (orb.radius ?? 7) + pickupRadius) {
      const reward = addExperience(progression, orb.value);
      collected.push({ ...orb, collected: true, reward });
      levelUps += reward.levelUps;
    } else {
      remaining.push(orb);
    }
  });
  return { remaining, collected, levelUps };
}
