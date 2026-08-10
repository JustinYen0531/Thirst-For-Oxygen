import {
  PASSIVE_ABILITIES,
  WEAPONS,
  getEnemyExperienceReward as getEnemyExperienceRewardFromData,
} from './game-data.js';

// The initial knife is free and occupies the first weapon slot. With the
// existing 3/2/1 slot caps, the normal build has eleven post-start choices:
// five remaining weapon upgrades/acquisitions and six passive choices.
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
  2350, // Lv.11
  2750, // Lv.12
]);
export const PLAYER_MAX_LEVEL = EXPERIENCE_THRESHOLDS.length;

const CATEGORY_KEYS = Object.freeze(['weapon', 'passive']);
const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
const PASSIVE_IDS = Object.freeze(Object.keys(PASSIVE_ABILITIES));
const UPGRADE_LEVEL_SUMMARIES = Object.freeze({
  weapon: Object.freeze({
    knife: Object.freeze({
      1: '移動路徑形成可穿透敵人的近距離斬擊。',
      2: '主斬擊兩側新增傷害軌跡，各造成主傷害的 70%。',
      3: '停止移動時持續對周圍敵人造成範圍傷害。',
    }),
    katana: Object.freeze({
      1: '自動對近距離敵人順時針揮擊，敵人越多可命中越多次。',
      2: '每次完成移動後，下一次武士刀斬擊造成雙倍傷害。',
      3: '斬擊發射大型白色劍氣，並能摧毀敵方投射物。',
    }),
    trident: Object.freeze({
      1: '停止移動一秒後，自動發射高傷害單發三叉戟。',
      2: '三叉戟命中時造成暈眩，使敵人停止移動與攻擊。',
      3: '三叉戟成功命中後，縮短下一次自動發射的冷卻。',
    }),
    lightMachineGun: Object.freeze({
      1: '沿同一個鎖定方向自動完成六連射，再進入冷卻。',
      2: '六連射後三發獲得醒目描邊，傷害維持相同。',
      3: '六發子彈各自呈現不同稜彩顏色，但不產生爆炸。',
    }),
  }),
  passive: Object.freeze({
    oxygenCirculator: Object.freeze({
      1: '氧氣消耗降低 10%，延長離開補給路線的探索時間。',
      2: '最大氧氣上限提高 20%，保留第一級效果。',
      3: '低氧時降低能量消耗並獲得減傷，保留前兩級效果。',
    }),
    pressureStabilizer: Object.freeze({
      1: '瞄準、彈射與武器使用的能量消耗降低 10%。',
      2: '能量消耗降低 20%，擊殺時恢復最大能量的 5%。',
      3: '能量消耗降低 30%，擊殺時恢復 8% 能量與 4% 氧氣。',
    }),
    ecologicalCarapace: Object.freeze({
      1: '受到的遠程傷害降低 20%。',
      2: '承受高額單次傷害時獲得兩秒護盾，冷卻八秒。',
      3: '恢復氧氣或能量時同步恢復部分生命，保留前兩級效果。',
    }),
    abyssalAmplifier: Object.freeze({
      1: '所有武器造成的傷害提高 10%。',
      2: '所有武器造成的傷害提高至 20%。',
      3: '武器傷害提高至 30%，高氧氣時再提高 15%。',
    }),
  }),
});

function getUpgradeIconPath(category, id, level) {
  const family = category === 'weapon' ? 'weapons' : 'passives';
  return `./assets/editor/icons/${family}/${id}/lv${level}.png`;
}

function createUpgradeCandidate(category, action, definition, level) {
  return {
    category,
    action,
    id: definition.id,
    name: definition.name,
    level,
    label: `${definition.name} Lv.${level}`,
    detail: UPGRADE_LEVEL_SUMMARIES[category]?.[definition.id]?.[level]
      ?? (category === 'weapon' ? '提升武器等級與攻擊規格。' : '提升被動能力等級與效果。'),
    icon: getUpgradeIconPath(category, definition.id, level),
  };
}

function clampLevel(level) {
  return Math.max(PLAYER_START_LEVEL, Math.min(PLAYER_MAX_LEVEL, Math.round(Number(level) || PLAYER_START_LEVEL)));
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
    candidates.push(createUpgradeCandidate(category, 'upgrade', definition, entry.level + 1));
  });

  if (entries.length < (category === 'weapon' ? MAX_WEAPON_SLOTS : MAX_PASSIVE_SLOTS)) {
    ids.forEach((id) => {
      if (getOwnedEntry(entries, id)) return;
      const definition = definitions[id];
      candidates.push(createUpgradeCandidate(category, 'acquire', definition, 1));
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
