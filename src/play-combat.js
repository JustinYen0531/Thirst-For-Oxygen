import {
  PASSIVE_ABILITIES,
  WEAPONS,
  ENEMY_DEFINITIONS,
  getEnemyDamageToPlayer,
  getPlayerDerivedStats,
  getWeaponStats,
} from './game-data.js';
import {
  applyDamage,
  applyEnemyDefeatRewards,
  setPlayerLoadout,
} from './physics.js';
import {
  BUILD_SLOT_LEVEL_CAPS,
  applyUpgradeChoice,
  collectExperienceOrbs,
  createExperienceOrb,
  createProgressionState,
  getAvailableUpgradeCategories,
  getEnemyExperienceReward,
  getExperienceProgress,
  getUpgradeChoices,
} from './progression.js';
import {
  applyResonanceBuffsToStats,
  createResonanceState,
  getResonanceRenderState,
  reduceEnemyResonanceOnDamage,
  RESONANCE_BUFFS,
} from './resonance.js';

export const PLAY_COMBAT_FIXED_STEP = 1 / 60;
export const KNIFE_DASH_MINIMUM_SPEED = 45;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared > 0
    ? clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
    : 0;
  const closest = { x: start.x + dx * ratio, y: start.y + dy * ratio };
  return distanceBetween(point, closest);
}

function activeEnemies(enemies) {
  // A tutorial target can opt out of Resonance while remaining a valid weapon
  // target. Keep those two combat contracts separate: the right training fish
  // must be killable even though it is not a Resonance lesson.
  return (enemies ?? []).filter((enemy) => (
    enemy
    && !enemy.defeated
    && !enemy.resonanceNeutral
    && Number(enemy.health) > 0
  ));
}

function enemyKey(enemy, index = 0) {
  return enemy.instanceId ?? enemy.id ?? enemy.enemyId ?? `enemy-${index}`;
}

function equippedWeapon(state, weaponId) {
  return state.build.weapons.find((entry) => entry.id === weaponId) ?? null;
}

function addEffect(state, effect) {
  const next = {
    id: `combat-effect-${state.nextEffectId++}`,
    elapsed: 0,
    duration: 0.4,
    ...effect,
  };
  state.effects.push(next);
  return next;
}

function openUpgrade(state) {
  if ((state.progression.pendingLevelUps ?? 0) <= 0) {
    state.awaitingUpgrade = false;
    state.upgradeCategory = null;
    state.upgradeCategories = [];
    state.upgradeChoices = [];
    return [];
  }
  state.upgradeCategories = getAvailableUpgradeCategories(state.progression);
  state.awaitingUpgrade = state.upgradeCategories.length > 0;
  state.upgradeCategory = null;
  state.upgradeChoices = [];
  if (!state.awaitingUpgrade) state.progression.pendingLevelUps = 0;
  return state.upgradeCategories;
}

function normalizeRestoredEntries(entries, definitions, maximum, ensureKnife = false) {
  const normalized = [];
  if (ensureKnife) {
    const requested = (entries ?? []).find((entry) => entry?.id === 'knife');
    normalized.push({ id: 'knife', level: clamp(Math.round(Number(requested?.level) || 1), 1, BUILD_SLOT_LEVEL_CAPS[0]) });
  }
  (entries ?? []).forEach((entry) => {
    if (!definitions[entry?.id] || normalized.some((owned) => owned.id === entry.id) || normalized.length >= maximum) return;
    const cap = Math.min(definitions[entry.id].maxLevel, BUILD_SLOT_LEVEL_CAPS[normalized.length]);
    normalized.push({ id: entry.id, level: clamp(Math.round(Number(entry.level) || 1), 1, cap) });
  });
  return normalized;
}

export function createPlayCombatState() {
  const progression = createProgressionState();
  return {
    time: 0,
    progression,
    build: {
      weapons: progression.weapons.map((entry) => ({ ...entry })),
      passives: [],
    },
    experienceOrbs: [],
    projectiles: [],
    effects: [],
    weaponBurst: null,
    weaponCooldowns: {},
    tridentStationaryTime: 0,
    tridentReady: false,
    nextProjectileId: 1,
    nextEffectId: 1,
    nextOrbId: 1,
    nextBurstId: 1,
    resonance: createResonanceState(),
    rewardedEnemyIds: new Set(),
    awaitingUpgrade: false,
    upgradeCategory: null,
    upgradeCategories: [],
    upgradeChoices: [],
  };
}

export function syncPlayCombatBuild(state, actor = null) {
  state.build = {
    weapons: state.progression.weapons.map((entry) => ({ ...entry })),
    passives: state.progression.passives.map((entry) => ({ ...entry })),
  };
  if (actor) {
    const activeWeapon = state.build.weapons[0] ?? { id: 'knife', level: 1 };
    setPlayerLoadout(actor, state.build.passives, activeWeapon);
    actor.derivedStats = applyResonanceBuffsToStats(actor.derivedStats, state.resonance);
  }
  return state.build;
}

// Save restoration and focused Node tests can hydrate an authored build through
// the same 3/2/1 caps. The formal new-run path does not call this and therefore
// always begins with only the Lv.1 knife.
export function restorePlayCombatBuild(state, { weapons = [], passives = [], ensureKnife = true } = {}, actor = null) {
  state.progression.weapons = normalizeRestoredEntries(weapons, WEAPONS, 3, ensureKnife);
  state.progression.passives = normalizeRestoredEntries(passives, PASSIVE_ABILITIES, 3, false);
  state.progression.activeWeaponSlot = 0;
  state.weaponBurst = null;
  state.weaponCooldowns = {};
  state.tridentStationaryTime = 0;
  state.tridentReady = false;
  return syncPlayCombatBuild(state, actor);
}

export function restorePlayCombatResonance(state, entries = [], actor = null) {
  const resonance = createResonanceState();
  for (const [enemyId, rawStacks] of entries) {
    const definition = RESONANCE_BUFFS[enemyId];
    if (!definition) continue;
    const stacks = clamp(Math.round(Number(rawStacks) || 0), 0, definition.maxStacks);
    if (stacks <= 0) continue;
    resonance.unlockedEnemyIds.add(enemyId);
    resonance.stacksByEnemyId.set(enemyId, stacks);
  }
  state.resonance = resonance;
  syncPlayCombatBuild(state, actor);
  return getResonanceRenderState(state.resonance);
}

export function choosePlayUpgradeCategory(state, category) {
  if (!state.awaitingUpgrade) return { ok: false, reason: 'noLevelUp' };
  if (state.upgradeCategory && state.upgradeCategory !== category) {
    return {
      ok: false,
      reason: 'categoryLocked',
      category: state.upgradeCategory,
      choices: state.upgradeChoices,
    };
  }
  if (state.upgradeCategory === category && state.upgradeChoices.length) {
    return { ok: true, category, choices: state.upgradeChoices, locked: true };
  }
  const choices = getUpgradeChoices(state.progression, category, 2);
  if (!choices.length) return { ok: false, reason: 'category' };
  state.upgradeCategory = category;
  state.upgradeChoices = choices;
  return { ok: true, category, choices };
}

export function choosePlayUpgrade(state, choice, actor = null) {
  if (!state.awaitingUpgrade) return { ok: false, reason: 'noLevelUp' };
  const result = applyUpgradeChoice(state.progression, choice);
  if (!result.ok) return result;
  syncPlayCombatBuild(state, actor);
  openUpgrade(state);
  return {
    ...result,
    build: state.build,
    awaitingUpgrade: state.awaitingUpgrade,
    categories: state.upgradeCategories,
  };
}

export function recordPlayEnemyDefeats(state, enemies, actor = null) {
  const dropped = [];
  (enemies ?? []).forEach((enemy, index) => {
    if (enemy.resonanceNeutral) return;
    if (!enemy.defeated && Number(enemy.health) > 0) return;
    enemy.defeated = true;
    const key = enemyKey(enemy, index);
    if (state.rewardedEnemyIds.has(key)) return;
    state.rewardedEnemyIds.add(key);
    const value = getEnemyExperienceReward(enemy.enemyId ?? enemy.id);
    if (value > 0) {
      const orb = createExperienceOrb(`play-exp-${state.nextOrbId++}`, enemy.x, enemy.y, value, enemy.enemyId ?? enemy.id);
      state.experienceOrbs.push(orb);
      dropped.push(orb);
    }
    if (actor) applyEnemyDefeatRewards(actor);
  });
  return dropped;
}

export function collectPlayCombatExperience(state, actor) {
  const result = collectExperienceOrbs(state.progression, state.experienceOrbs, actor);
  state.experienceOrbs = result.remaining;
  if (result.levelUps > 0) openUpgrade(state);
  return result;
}

function damageEnemy(state, actor, enemy, rawDamage, source) {
  if (!enemy || enemy.defeated || enemy.resonanceNeutral || Number(enemy.health) <= 0) return 0;
  if (enemy.tutorialInfiniteHealth) {
    addEffect(state, { type: 'weaponHit', weaponId: source, x: enemy.x, y: enemy.y, damage: 0, duration: 0.18 });
    return 0;
  }
  if (enemy.linkedProtection) {
    addEffect(state, { type: 'weaponBlocked', weaponId: source, protectorId: enemy.linkedProtection, x: enemy.x, y: enemy.y, duration: 0.24 });
    return 0;
  }
  const multiplier = actor?.derivedStats?.currentDamageMultiplier
    ?? getPlayerDerivedStats(state.build.passives, actor?.oxygen).currentDamageMultiplier;
  const passive = ENEMY_DEFINITIONS[enemy.enemyId]?.passive;
  const enemyMultiplier = Math.max(0, Number(enemy.damageTakenMultiplier
    ?? passive?.damageTakenMultiplier
    ?? passive?.rangedDamageTakenMultiplier
    ?? 1));
  const damage = Math.max(0, rawDamage * multiplier * enemyMultiplier);
  enemy.health = Math.max(0, enemy.health - damage);
  if (damage > 0) reduceEnemyResonanceOnDamage(enemy);
  if (damage > 0 && enemy.passiveState?.enraged && Number(passive?.thornsDamage) > 0) {
    const retaliation = applyDamage(actor, getEnemyDamageToPlayer(passive.thornsDamage), `${enemy.name ?? enemy.enemyId}・${passive.name}`, 'contact');
    addEffect(state, { type: 'thornsHit', weaponId: source, ownerId: enemy.instanceId, x: actor.x, y: actor.y, damage: retaliation.applied, duration: 0.24 });
  }
  enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, 0.18);
  if (enemy.health <= 0) {
    enemy.defeated = true;
    enemy.state = 'defeated';
  }
  addEffect(state, { type: 'weaponHit', weaponId: source, x: enemy.x, y: enemy.y, damage, duration: 0.18 });
  return damage;
}

function spendWeaponEnergy(state, actor, weaponId, weapon) {
  const multiplier = actor?.derivedStats?.weaponEnergyCostMultiplier ?? 1;
  const cost = Math.max(0, (weapon.energyCost ?? 0) * multiplier);
  if ((actor?.energy ?? 0) < cost) return { ok: false, cost };
  actor.energy -= cost;
  return { ok: true, cost };
}

function spawnProjectile(state, options) {
  const projectile = {
    id: `play-projectile-${state.nextProjectileId++}`,
    x: options.x,
    y: options.y,
    vx: Math.cos(options.angle) * options.speed,
    vy: Math.sin(options.angle) * options.speed,
    angle: options.angle,
    remainingDistance: options.range,
    radius: options.radius ?? 5,
    ...options,
  };
  state.projectiles.push(projectile);
  return projectile;
}

function nearestEnemy(actor, enemies, maximumRange = Infinity) {
  return activeEnemies(enemies)
    .map((enemy) => ({ enemy, distance: distanceBetween(actor, enemy) }))
    .filter((entry) => entry.distance <= maximumRange)
    .sort((left, right) => left.distance - right.distance)[0]?.enemy ?? null;
}

function weaponAngle(actor, target) {
  if (target) return Math.atan2(target.y - actor.y, target.x - actor.x);
  const velocity = Math.hypot(actor.vx ?? 0, actor.vy ?? 0);
  if (velocity > 1) return Math.atan2(actor.vy, actor.vx);
  return actor.facing === 'left' ? Math.PI : 0;
}

function fireTrident(state, actor, enemies, entry) {
  const weapon = getWeaponStats('trident', entry.level);
  const energy = spendWeaponEnergy(state, actor, 'trident', weapon);
  if (!energy.ok) return null;
  const target = nearestEnemy(actor, enemies, weapon.range);
  const angle = weaponAngle(actor, target);
  const visual = weapon.effect ?? {};
  const projectile = spawnProjectile(state, {
    weaponId: 'trident',
    weaponLevel: entry.level,
    x: actor.x,
    y: actor.y,
    angle,
    speed: weapon.projectileSpeed,
    range: weapon.range,
    damage: weapon.damage,
    radius: visual.projectileRadius ?? 8,
    visual: { ...visual },
    stunDuration: entry.level >= 2 ? (visual.stunDuration ?? 1.35) : 0,
    cooldownReduction: entry.level >= 3 ? (visual.cooldownReductionOnHit ?? 0) : 0,
  });
  state.weaponCooldowns.trident = weapon.cooldown;
  addEffect(state, { type: 'tridentFired', weaponId: 'trident', level: entry.level, x: actor.x, y: actor.y, angle, duration: 0.25 });
  return projectile;
}

function processTrident(state, actor, enemies, dt, aiming) {
  const entry = equippedWeapon(state, 'trident');
  const weapon = entry ? getWeaponStats('trident', entry.level) : null;
  const threshold = weapon?.effect?.stationarySpeedThreshold ?? 12;
  if (!entry || aiming || actor.dead || actor.attached || Math.hypot(actor.vx ?? 0, actor.vy ?? 0) > threshold) {
    state.tridentStationaryTime = 0;
    state.tridentReady = false;
    return;
  }
  state.tridentStationaryTime += dt;
  if (state.tridentStationaryTime >= (weapon.effect?.stationaryDelay ?? 1)) state.tridentReady = true;
  if (state.tridentReady && (state.weaponCooldowns.trident ?? 0) <= 0) fireTrident(state, actor, enemies, entry);
}

function machineGunShotVisual(weapon, level, shotIndex) {
  const visual = { ...(weapon.effect ?? {}) };
  if (level >= 2 && shotIndex >= 3) {
    visual.bulletStyle = visual.alternateBulletStyle ?? 'outlined';
    visual.bulletColour = visual.alternateBulletColour ?? visual.bulletColour;
    visual.bulletOutline = visual.alternateBulletOutline ?? visual.bulletOutline;
  }
  if (level >= 3 && visual.bulletPalette?.length) {
    visual.bulletColour = visual.bulletPalette[shotIndex % visual.bulletPalette.length];
  }
  return visual;
}

function fireMachineGunShot(state, actor, burst, shotIndex) {
  const weapon = getWeaponStats('lightMachineGun', burst.level);
  const visual = machineGunShotVisual(weapon, burst.level, shotIndex);
  return spawnProjectile(state, {
    weaponId: 'lightMachineGun',
    weaponLevel: burst.level,
    shotIndex,
    burstId: burst.id,
    x: actor.x,
    y: actor.y,
    angle: burst.angle,
    speed: weapon.projectileSpeed,
    range: weapon.range,
    damage: weapon.damage,
    radius: Math.max(3, (visual.bulletWidth ?? 5) * 0.5),
    visual,
  });
}

function beginMachineGunBurst(state, actor, enemies, entry) {
  const weapon = getWeaponStats('lightMachineGun', entry.level);
  const energy = spendWeaponEnergy(state, actor, 'lightMachineGun', weapon);
  if (!energy.ok) return null;
  const target = nearestEnemy(actor, enemies, weapon.range);
  const count = Math.max(1, Math.round(weapon.burstCount ?? 6));
  const interval = Math.max(0.02, Number(weapon.burstInterval ?? 0.08));
  const burst = {
    id: `play-burst-${state.nextBurstId++}`,
    weaponId: 'lightMachineGun',
    level: entry.level,
    angle: weaponAngle(actor, target),
    targetId: target ? enemyKey(target) : null,
    shotCount: count,
    nextShotIndex: 1,
    nextShotAt: state.time + interval,
    interval,
    finishAt: state.time + interval * (count - 1),
  };
  state.weaponBurst = burst;
  state.weaponCooldowns.lightMachineGun = weapon.cooldown;
  fireMachineGunShot(state, actor, burst, 0);
  addEffect(state, { type: 'lightMachineGunBurst', weaponId: 'lightMachineGun', level: entry.level, x: actor.x, y: actor.y, angle: burst.angle, shotCount: count, duration: interval * (count - 1) + 0.2 });
  return burst;
}

function updateMachineGunBurst(state, actor) {
  const burst = state.weaponBurst;
  if (!burst) return;
  while (burst.nextShotIndex < burst.shotCount && state.time + 1e-8 >= burst.nextShotAt) {
    fireMachineGunShot(state, actor, burst, burst.nextShotIndex);
    burst.nextShotIndex += 1;
    burst.nextShotAt += burst.interval;
  }
  if (burst.nextShotIndex >= burst.shotCount && state.time + 1e-8 >= burst.finishAt) state.weaponBurst = null;
}

function processMachineGun(state, actor, enemies, aiming) {
  const entry = equippedWeapon(state, 'lightMachineGun');
  if (!entry || aiming || actor.dead || actor.attached || state.weaponBurst || (state.weaponCooldowns.lightMachineGun ?? 0) > 0) return;
  beginMachineGunBurst(state, actor, enemies, entry);
}

function updateProjectiles(state, actor, enemies, dt) {
  state.projectiles = state.projectiles.filter((projectile) => {
    const previous = { x: projectile.x, y: projectile.y };
    const travel = Math.hypot(projectile.vx, projectile.vy) * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.remainingDistance -= travel;
    const hit = activeEnemies(enemies).find((enemy) => (
      distanceToSegment(enemy, previous, projectile) <= (enemy.radius ?? 0) + projectile.radius
    ));
    if (hit) {
      damageEnemy(state, actor, hit, projectile.damage, projectile.weaponId);
      if (projectile.weaponId === 'trident') {
        if (projectile.stunDuration > 0 && !hit.defeated) {
          hit.stunnedUntil = Math.max(hit.stunnedUntil ?? 0, state.time + projectile.stunDuration);
          hit.vx = 0;
          hit.vy = 0;
          hit.state = 'stunned';
        }
        if (projectile.cooldownReduction > 0) {
          const before = Math.max(0, state.weaponCooldowns.trident ?? 0);
          state.weaponCooldowns.trident = Math.max(0, before - projectile.cooldownReduction);
          addEffect(state, { type: 'tridentCooldownReduced', weaponId: 'trident', before, after: state.weaponCooldowns.trident, duration: 0.6 });
        }
      }
      return false;
    }
    if (projectile.remainingDistance <= 0) {
      return false;
    }
    return true;
  });
}

function processKnifePath(state, actor, enemies, previousPosition) {
  const entry = equippedWeapon(state, 'knife');
  if (!entry || !previousPosition) return;
  const weapon = getWeaponStats('knife', entry.level);
  const movement = distanceBetween(previousPosition, actor);
  if (movement / PLAY_COMBAT_FIXED_STEP < KNIFE_DASH_MINIMUM_SPEED) return;
  const start = { x: previousPosition.x, y: previousPosition.y };
  const end = { x: actor.x, y: actor.y };
  const hits = [];
  const mainHitIds = new Set();
  activeEnemies(enemies).forEach((enemy) => {
    if ((enemy.playKnifeHitCooldownUntil ?? 0) > state.time) return;
    if (distanceToSegment(enemy, start, end) > (enemy.radius ?? 0) + (actor.radius ?? 0) + 8) return;
    damageEnemy(state, actor, enemy, weapon.damage, 'knife');
    enemy.playKnifeHitCooldownUntil = state.time + (weapon.cooldown ?? 0.45);
    const key = enemyKey(enemy);
    hits.push(key);
    mainHitIds.add(key);
  });
  addEffect(state, { type: 'knifePath', weaponId: 'knife', level: entry.level, start, end, hitIds: hits, duration: weapon.effect?.duration ?? 0.68 });
  if (entry.level < 2) return;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const offset = weapon.effect?.sideTrailOffset ?? 24;
  [-1, 1].forEach((side) => {
    const sideStart = { x: start.x + normal.x * offset * side, y: start.y + normal.y * offset * side };
    const sideEnd = { x: end.x + normal.x * offset * side, y: end.y + normal.y * offset * side };
    const sideHits = [];
    activeEnemies(enemies).forEach((enemy) => {
      if (mainHitIds.has(enemyKey(enemy))) return;
      if ((enemy.playKnifeSideHitCooldownUntil ?? 0) > state.time) return;
      if (distanceToSegment(enemy, sideStart, sideEnd) > (enemy.radius ?? 0) + (weapon.effect?.sideTrailRadius ?? 20)) return;
      damageEnemy(state, actor, enemy, weapon.damage * 0.7, 'knifeSideTrail');
      enemy.playKnifeSideHitCooldownUntil = state.time + (weapon.cooldown ?? 0.45);
      sideHits.push(enemyKey(enemy));
    });
    addEffect(state, { type: 'knifeSidePath', weaponId: 'knife', level: entry.level, start: sideStart, end: sideEnd, hitIds: sideHits, damageMultiplier: 0.7, duration: weapon.effect?.sideTrailDuration ?? 1.15 });
  });
}

function processStationaryKnife(state, actor, enemies) {
  const entry = equippedWeapon(state, 'knife');
  if (!entry || entry.level < 3 || Math.hypot(actor.vx ?? 0, actor.vy ?? 0) > 8) return;
  const weapon = getWeaponStats('knife', 3);
  const cooldownKey = 'knifeStationaryArea';
  if ((state.weaponCooldowns[cooldownKey] ?? 0) > 0) return;
  state.weaponCooldowns[cooldownKey] = weapon.effect?.stationaryTickInterval ?? 0.34;
  const radius = weapon.effect?.stationaryAreaRadius ?? 62;
  const hits = [];
  activeEnemies(enemies).forEach((enemy) => {
    if (distanceBetween(actor, enemy) > radius + (enemy.radius ?? 0)) return;
    damageEnemy(state, actor, enemy, weapon.damage * (weapon.effect?.stationaryDamageMultiplier ?? 0.55), 'knifeStationaryArea');
    hits.push(enemyKey(enemy));
  });
  addEffect(state, { type: 'knifeStationaryArea', weaponId: 'knife', level: 3, x: actor.x, y: actor.y, radius, hitIds: hits, duration: 0.34 });
}

export function stepPlayCombat(state, {
  actor,
  enemies = [],
  previousPosition = actor ? { x: actor.x, y: actor.y } : null,
  dt = PLAY_COMBAT_FIXED_STEP,
  aiming = false,
} = {}) {
  if (!state || !actor) return { ok: false, reason: 'missingState' };
  if (state.awaitingUpgrade) return { ok: false, reason: 'upgrade', state };
  const elapsed = Math.max(0, Number(dt) || 0);
  state.time += elapsed;
  actor.derivedStats = applyResonanceBuffsToStats(
    getPlayerDerivedStats(state.build.passives, actor.oxygen),
    state.resonance,
  );
  Object.keys(state.weaponCooldowns).forEach((key) => {
    state.weaponCooldowns[key] = Math.max(0, state.weaponCooldowns[key] - elapsed);
  });
  if (actor.insideWall) {
    state.weaponBurst = null;
    state.tridentStationaryTime = 0;
    state.tridentReady = false;
    updateProjectiles(state, actor, enemies, elapsed);
    const dropped = recordPlayEnemyDefeats(state, enemies, actor);
    const collected = collectPlayCombatExperience(state, actor);
    state.effects = state.effects.filter((effect) => {
      effect.elapsed += elapsed;
      return effect.elapsed < effect.duration;
    });
    return { ok: true, suppressed: 'insideWall', dropped, collected, state };
  }
  updateMachineGunBurst(state, actor);
  updateProjectiles(state, actor, enemies, elapsed);
  processKnifePath(state, actor, enemies, previousPosition);
  processStationaryKnife(state, actor, enemies);
  processTrident(state, actor, enemies, elapsed, aiming);
  processMachineGun(state, actor, enemies, aiming);
  const dropped = recordPlayEnemyDefeats(state, enemies, actor);
  const collected = collectPlayCombatExperience(state, actor);
  state.effects = state.effects.filter((effect) => {
    effect.elapsed += elapsed;
    return effect.elapsed < effect.duration;
  });
  return { ok: true, dropped, collected, state };
}

export function getPlayCombatRenderState(state) {
  const progress = getExperienceProgress(state.progression);
  return {
    time: state.time,
    resonance: getResonanceRenderState(state.resonance),
    build: {
      weapons: state.build.weapons.map((entry) => ({ ...entry })),
      passives: state.build.passives.map((entry) => ({ ...entry })),
    },
    progression: {
      ...progress,
      pendingLevelUps: state.progression.pendingLevelUps,
      awaitingUpgrade: state.awaitingUpgrade,
      category: state.upgradeCategory,
      categories: [...state.upgradeCategories],
      choices: state.upgradeChoices.map((choice) => ({ ...choice })),
    },
    experienceOrbs: state.experienceOrbs.map((orb) => ({ ...orb })),
    projectiles: state.projectiles.map((projectile) => ({
      id: projectile.id,
      weaponId: projectile.weaponId,
      weaponLevel: projectile.weaponLevel,
      shotIndex: projectile.shotIndex,
      x: projectile.x,
      y: projectile.y,
      angle: projectile.angle,
      remainingDistance: projectile.remainingDistance,
      damage: projectile.damage,
      style: projectile.visual?.bulletStyle,
      colour: projectile.visual?.bulletColour ?? projectile.visual?.colour,
    })),
    effects: state.effects.map((effect) => ({ ...effect })),
    burst: state.weaponBurst ? { ...state.weaponBurst } : null,
    cooldowns: { ...state.weaponCooldowns },
    trident: {
      stationaryTime: state.tridentStationaryTime,
      ready: state.tridentReady,
    },
  };
}

export function getPlayCombatHudState(state) {
  const progress = getExperienceProgress(state.progression);
  return {
    resonance: getResonanceRenderState(state.resonance),
    progression: {
      ...progress,
      pendingLevelUps: state.progression.pendingLevelUps,
      awaitingUpgrade: state.awaitingUpgrade,
    },
  };
}
