import {
  ENEMY_DEFINITIONS,
  ENEMY_ORDER,
  PASSIVE_ABILITIES,
  WEAPONS,
  createEnemyState,
  getEnemyDamageToPlayer,
  getEnemyProjectileSpeed,
  getWeaponStats,
} from './game-data.js';
import { syncEnemyFacing } from './enemy-movement.js';
import {
  createEmptyMap,
} from './map-model.js';
import {
  FIXED_STEP,
  MAX_ENERGY,
  MAX_HEALTH,
  MAX_OXYGEN,
  applyDamage,
  applyEnemyDefeatRewards,
  createTestActor,
  launchActor,
  setPlayerLoadout,
  stepPhysics,
} from './physics.js';
import {
  applyUpgradeChoice,
  collectExperienceOrbs as collectExperienceOrbsFromWorld,
  createExperienceOrb,
  createProgressionState,
  BUILD_SLOT_LEVEL_CAPS,
  getActiveWeapon,
  getAvailableUpgradeCategories,
  getEnemyExperienceReward,
  getUpgradeChoices,
  setActiveWeapon,
} from './progression.js';
import { getKatanaWavePose } from './katana-visual.js';

export const SANDBOX_WIDTH = 960;
export const SANDBOX_HEIGHT = 560;
export const SANDBOX_FIXED_STEP = FIXED_STEP;
export const SANDBOX_ENEMY_ACTION_VISUAL_HOLD = 1.44;
// The diver sprite is intentionally smaller than the control affordance. The
// sandbox should test combat, not punish a click that lands a few pixels beside
// the diver while the user is trying to start a launch.
export const SANDBOX_PLAYER_INTERACTION_RADIUS = 82;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const angleBetween = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
const unique = (values) => [...new Set(values)];

function normalizeBuildEntries(entries, definitions, maxEntries, { ensureKnife = false } = {}) {
  const source = Array.isArray(entries) ? entries : [];
  const normalized = [];
  if (ensureKnife) {
    const requestedKnife = source.find((entry) => entry?.id === 'knife');
    const knifeLevel = clamp(
      Math.round(Number(requestedKnife?.level) || 1),
      1,
      Math.min(definitions.knife?.maxLevel ?? 1, BUILD_SLOT_LEVEL_CAPS[0]),
    );
    normalized.push({ id: 'knife', level: knifeLevel });
  }
  source.forEach((entry) => {
    const id = entry?.id;
    if (!definitions[id] || normalized.some((owned) => owned.id === id) || normalized.length >= maxEntries) return;
    const slotCap = BUILD_SLOT_LEVEL_CAPS[normalized.length] ?? BUILD_SLOT_LEVEL_CAPS[BUILD_SLOT_LEVEL_CAPS.length - 1];
    const level = clamp(
      Math.round(Number(entry.level) || 1),
      1,
      Math.min(definitions[id].maxLevel ?? 1, slotCap),
    );
    normalized.push({ id, level });
  });
  return normalized;
}

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

// The sandbox is a combat test harness. Keep a generous hidden L0/T1 water
// field behind the 960x560 stage so the shared physics can resolve a Cell
// everywhere the pointer can reach without applying a gravity shortcut.
const SANDBOX_PHYSICS_ORIGIN = Object.freeze({ x: 18, y: 18 });
const SANDBOX_PHYSICS_BOUNDS = Object.freeze({ minX: 10, maxX: SANDBOX_WIDTH - 10, minY: 10, maxY: SANDBOX_HEIGHT - 10 });

function createSandboxPhysicsMap() {
  const map = createEmptyMap({ width: 52, height: 32 });
  Object.values(map.cells).forEach((cell) => {
    cell.gravityLevel = 'L0';
    cell.waterLayer = 'T1';
  });
  return map;
}

function logEvent(state, message, level = 'info') {
  state.logs.unshift({ time: state.time, message, level });
  state.logs = state.logs.slice(0, 80);
}

function activeEnemies(state) {
  return state.enemies.filter((enemy) => !enemy.defeated);
}

function getEquippedWeaponEntries(state) {
  const entries = Array.isArray(state.build?.weapons)
    ? state.build.weapons
    : state.build?.weaponId
      ? [{ id: state.build.weaponId, level: state.build.weaponLevel ?? 1 }]
      : [];
  return entries.filter((entry) => entry && WEAPONS[entry.id]);
}

function getEquippedWeaponEntry(state, weaponId) {
  return getEquippedWeaponEntries(state).find((entry) => entry.id === weaponId) ?? null;
}

function enemyDefinition(enemy) {
  return ENEMY_DEFINITIONS[enemy.enemyId ?? enemy.id];
}

const CONTACT_ATTACK_TYPES = new Set(['contact', 'melee']);
const RANGED_ATTACK_TYPES = new Set(['projectile', 'spread', 'lobbed', 'boomerangSpread', 'shieldBoomerang']);
const CORE_SUMMON_IDS = Object.freeze(['crabGuard', 'lobsterSoldier', 'lionfishGunner', 'squidAssassin']);

function hasPlayerDamage(skill) {
  return Number(skill?.damage ?? 0) > 0
    || Number(skill?.damagePerSecond ?? 0) > 0
    || Number(skill?.aftermathDamage ?? 0) > 0;
}

function isEnemyEnraged(enemy) {
  return Number(enemy.health) > 0 && Number(enemy.maxHealth) > 0 && enemy.health / enemy.maxHealth <= 0.3;
}

function enemyCooldownMultiplier(enemy) {
  return isEnemyEnraged(enemy) ? 0.65 : 1;
}

function getContactAttack(enemy) {
  return enemyDefinition(enemy)?.attacks.find((skill) => CONTACT_ATTACK_TYPES.has(skill.type)) ?? null;
}

function getPreferredEnemyDistance(enemy) {
  const definition = enemyDefinition(enemy);
  const contact = getContactAttack(enemy);
  // Stop just inside the collision envelope; leaving an eight-pixel gap here
  // makes a melee enemy orbit forever without ever reaching its attack.
  if (contact) return Math.max(28, (contact.range ?? contact.radius ?? 44) + enemy.radius + 2);
  const ranged = definition?.attacks.find((skill) => RANGED_ATTACK_TYPES.has(skill.type));
  if (ranged) return clamp((ranged.range ?? 280) * 0.55, 110, 240);
  return 74;
}

function getNextReadySkill(enemy, distance) {
  const attacks = enemyDefinition(enemy)?.attacks ?? [];
  if (!attacks.length) return null;
  const start = Math.max(0, enemy.nextAutoSkillIndex ?? 0) % attacks.length;
  for (let offset = 0; offset < attacks.length; offset += 1) {
    const index = (start + offset) % attacks.length;
    const skill = attacks[index];
    if ((enemy.cooldowns[skill.id] ?? 0) > 0) continue;
    if (CONTACT_ATTACK_TYPES.has(skill.type) && distance > (skill.range ?? skill.radius ?? 44) + enemy.radius + 12) continue;
    if (skill.type === 'suicideCharge' && distance > (skill.triggerRange ?? 260)) continue;
    return { skill, index };
  }
  return null;
}

function setAnimation(enemy, skillId, time) {
  enemy.animation = skillId ?? 'idle';
  enemy.animationToken += 1;
  enemy.animationUntil = time + Math.max(
    SANDBOX_ENEMY_ACTION_VISUAL_HOLD,
    enemyDefinition(enemy)?.attacks.find((skill) => skill.id === skillId)?.telegraph ?? 0,
  );
}

function addEffect(state, effect) {
  const nextEffect = {
    id: state.nextEffectId++,
    startedAt: state.time,
    elapsed: 0,
    duration: 0.8,
    ...effect,
  };
  state.effects.push(nextEffect);
  return nextEffect;
}

function beginSuicideCharge(state, enemy, skill) {
  enemy.suicideCharge = {
    skillId: skill.id,
    phase: 'seeking',
    targetX: state.actor.x,
    targetY: state.actor.y,
    remaining: skill.detonationDelay ?? 1,
  };
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.animation = skill.id;
  enemy.animationUntil = Math.max(
    enemy.animationUntil,
    state.time + (skill.detonationDelay ?? 1) + 0.4,
  );
  logEvent(state, `${enemyDefinition(enemy).name} 已鎖定定點，抵達後將在 ${skill.detonationDelay ?? 1} 秒後爆炸。`, 'warning');
}

function detonateSuicideCharge(state, enemy, skill) {
  const origin = { x: enemy.x, y: enemy.y };
  areaDamage(state, origin, skill.radius ?? 52, skill.damage ?? 0, `${enemyDefinition(enemy).name}・${skill.name}`);
  addEffect(state, { type: 'detonation', x: origin.x, y: origin.y, radius: skill.radius ?? 52, duration: 0.7, colour: '#ffb86e' });
  logEvent(state, `${enemyDefinition(enemy).name} 抵達定點後爆炸。`, 'danger');
  enemy.suicideCharge = null;
  defeatEnemy(state, enemy);
}

function updateSuicideCharge(state, enemy, dt) {
  const charge = enemy.suicideCharge;
  if (!charge) return false;
  const skill = enemyDefinition(enemy).attacks.find((candidate) => candidate.id === charge.skillId);
  if (!skill) {
    enemy.suicideCharge = null;
    return false;
  }
  if (charge.phase === 'seeking') {
    const distance = Math.hypot(charge.targetX - enemy.x, charge.targetY - enemy.y);
    const travel = (enemy.moveSpeed ?? enemyDefinition(enemy).moveSpeed) * dt;
    if (distance <= Math.max(8, travel)) {
      enemy.x = charge.targetX;
      enemy.y = charge.targetY;
      charge.phase = 'detonating';
      charge.remaining = skill.detonationDelay ?? 1;
      enemy.animationUntil = state.time + charge.remaining;
      addEffect(state, { type: 'telegraph', x: enemy.x, y: enemy.y, radius: skill.radius ?? 52, duration: charge.remaining, colour: '#ffb86e' });
      logEvent(state, `${enemyDefinition(enemy).name} 已抵達定點，倒數 ${charge.remaining} 秒。`, 'warning');
    } else {
      const angle = Math.atan2(charge.targetY - enemy.y, charge.targetX - enemy.x);
      enemy.x += Math.cos(angle) * travel;
      enemy.y += Math.sin(angle) * travel;
    }
    return true;
  }
  charge.remaining -= dt;
  enemy.vx = 0;
  enemy.vy = 0;
  if (charge.remaining <= 0) detonateSuicideCharge(state, enemy, skill);
  return true;
}

function syncSandboxBuild(state) {
  const active = state.progression.weapons.length ? getActiveWeapon(state.progression) : null;
  const loadoutWeapon = active ?? { id: 'knife', level: 1 };
  const previousWeaponId = state.build?.weaponId;
  state.build = {
    weaponId: active?.id ?? null,
    weaponLevel: active?.level ?? 0,
    weapons: state.progression.weapons.map((weapon) => ({ ...weapon })),
    activeWeaponSlot: state.progression.activeWeaponSlot,
    passives: state.progression.passives.map((passive) => ({ ...passive })),
  };
  setPlayerLoadout(state.actor, state.build.passives, loadoutWeapon);
  if (previousWeaponId !== active?.id) state.actor.katanaEmpoweredNextSlash = false;
  return state.build;
}

function openUpgradeChoice(state) {
  if ((state.progression.pendingLevelUps ?? 0) <= 0) {
    state.awaitingUpgrade = false;
    state.upgradeCategory = null;
    state.upgradeChoices = [];
    return [];
  }
  state.awaitingUpgrade = true;
  state.upgradeCategory = null;
  state.upgradeChoices = [];
  state.upgradeCategories = getAvailableUpgradeCategories(state.progression);
  if (!state.upgradeCategories.length) {
    state.progression.pendingLevelUps = 0;
    state.awaitingUpgrade = false;
  }
  return state.upgradeCategories;
}

export function chooseUpgradeCategory(state, category) {
  if (!state.awaitingUpgrade) return { ok: false, reason: 'noLevelUp' };
  const choices = getUpgradeChoices(state.progression, category, 2);
  if (!choices.length) return { ok: false, reason: 'category' };
  state.upgradeCategory = category;
  state.upgradeChoices = choices;
  return { ok: true, category, choices };
}

export function chooseUpgrade(state, choice) {
  if (!state.awaitingUpgrade) return { ok: false, reason: 'noLevelUp' };
  const result = applyUpgradeChoice(state.progression, choice);
  if (!result.ok) return result;
  syncSandboxBuild(state);
  openUpgradeChoice(state);
  const definition = result.choice.category === 'weapon' ? WEAPONS[result.choice.id] : PASSIVE_ABILITIES[result.choice.id];
  logEvent(state, `升級完成：${definition.name} Lv.${result.choice.level}。`, 'safe');
  if (state.awaitingUpgrade) logEvent(state, '還有新的升級選擇，請先完成 Build。', 'safe');
  else logEvent(state, '升級選擇完成，玩家可以繼續探索。', 'safe');
  return { ...result, build: state.build, pendingLevelUps: state.progression.pendingLevelUps };
}

export function setSandboxActiveWeapon(state, slotOrId) {
  if (!state.progression.weapons.length) {
    logEvent(state, '目前沒有已裝備武器可切換。', 'warning');
    return null;
  }
  const active = setActiveWeapon(state.progression, slotOrId);
  syncSandboxBuild(state);
  state.actor.tridentStationaryTime = 0;
  logEvent(state, `切換武器：${WEAPONS[active.id]?.name ?? active.id} Lv.${active.level}。`, 'safe');
  return active;
}

function collectSandboxExperience(state) {
  const result = collectExperienceOrbsFromWorld(state.progression, state.experienceOrbs, state.actor);
  state.experienceOrbs = result.remaining;
  result.collected.forEach((orb) => {
    addEffect(state, { type: 'experience', x: orb.x, y: orb.y, radius: 18, duration: 0.45, colour: '#b7f4ff' });
    logEvent(state, `拾取經驗光點 +${Math.round(orb.value)}。`, 'safe');
  });
  if (result.levelUps > 0) {
    syncSandboxBuild(state);
    openUpgradeChoice(state);
    logEvent(state, `玩家升級至 Lv.${state.progression.level}，請選擇武器或能力。`, 'safe');
  }
  return result;
}

function applyPlayerDamage(state, amount, source, damageType = 'generic') {
  const result = state.invincible
    ? { applied: 0, blocked: true }
    : applyDamage(state.actor, getEnemyDamageToPlayer(amount, damageType), source, damageType);
  if (result.applied > 0) {
    logEvent(state, `玩家受到 ${Math.round(result.applied)} 傷害（${source}）。`, 'danger');
  } else if (state.invincible) {
    logEvent(state, `無敵模式抵銷了 ${source}。`, 'safe');
  }
  if (state.actor.health <= 0) {
    state.actor.health = MAX_HEALTH;
    logEvent(state, '沙盒自動重置玩家生命，方便繼續驗收。', 'safe');
  }
  return result;
}

function damageEnemy(state, enemy, amount, source) {
  if (!enemy || enemy.defeated) return 0;
  if (enemy.enemyId === 'coralBackSeahorse' && (enemy.linkedTargets?.length ?? (enemy.linkedTarget ? 1 : 0)) > 0) {
    logEvent(state, `${enemyDefinition(enemy).name} 仍受生命連結保護，必須先清除 Lv.2 夥伴。`, 'warning');
    return 0;
  }
  const linkedProtector = enemy.linkedProtection
    ? state.enemies.find((candidate) => candidate.instanceId === enemy.linkedProtection && !candidate.defeated)
    : null;
  if (linkedProtector) {
    logEvent(state, `${enemyDefinition(enemy).name} 受到生命連結保護，必須先切斷支援。`, 'warning');
    return 0;
  }
  const damage = Math.max(0, amount * (state.actor.derivedStats?.currentDamageMultiplier ?? 1));
  enemy.health = Math.max(0, enemy.health - damage);
  enemy.lastHitAt = state.time;
  addEffect(state, { type: 'hit', x: enemy.x, y: enemy.y, radius: enemy.radius + 10, duration: 0.18, colour: '#fff0a8' });
  logEvent(state, `${enemyDefinition(enemy).name} 受到 ${Math.round(damage)} 傷害（${source}）。`);
  if (enemy.health <= 0) defeatEnemy(state, enemy);
  return damage;
}

function defeatEnemy(state, enemy) {
  if (enemy.defeated) return;
  enemy.defeated = true;
  state.enemies.forEach((candidate) => {
    if (candidate.linkedProtection === enemy.instanceId) candidate.linkedProtection = null;
    if (candidate.linkedTarget === enemy.instanceId) candidate.linkedTarget = null;
  });
  enemy.animation = 'defeated';
  enemy.animationToken += 1;
  addEffect(state, { type: 'defeat', x: enemy.x, y: enemy.y, radius: 28, duration: 0.7, colour: '#f6e66d' });
  logEvent(state, `${enemyDefinition(enemy).name} 已被擊敗。`, 'safe');
  applyEnemyDefeatRewards(state.actor);
  const experienceValue = getEnemyExperienceReward(enemy.enemyId);
  state.experienceOrbs.push(createExperienceOrb(
    `exp-${state.nextExperienceOrbId++}`,
    enemy.x,
    enemy.y,
    experienceValue,
    enemy.enemyId,
  ));
  logEvent(state, `經驗光點 +${experienceValue} 留在原地，靠近後才會拾取。`, 'safe');
  const split = enemyDefinition(enemy).attacks.find((attack) => attack.type === 'split');
  if (split && (enemy.splitGeneration ?? 0) < 2) {
    for (let index = 0; index < (split.childCount ?? 2); index += 1) {
      spawnSandboxEnemy(state, 'splitLanternfish', {
        x: enemy.x + (index === 0 ? -26 : 26),
        y: enemy.y + 16,
      }, {
        health: split.childHealth ?? 28,
        maxHealth: split.childHealth ?? 28,
        moveSpeed: split.childSpeed ?? 122,
        radius: Math.max(14, enemy.radius * 0.72),
        splitGeneration: (enemy.splitGeneration ?? 0) + 1,
      });
    }
    logEvent(state, `${enemyDefinition(enemy).name} 死亡分裂成 ${(split.childCount ?? 2)} 隻更快的小型個體。`, 'warning');
  }
  if (state.selectedEnemyInstanceId === enemy.instanceId) state.selectedEnemyInstanceId = null;
  state.enemies = state.enemies.filter((candidate) => candidate !== enemy);
}

function spawnProjectile(state, source, options) {
  const angle = options.angle ?? angleBetween(source, state.actor);
  const authoredSpeed = Math.max(0, Number(options.speed) || 0);
  const speed = options.source === 'enemy' && !options.enemySpeedBalanced
    ? getEnemyProjectileSpeed(authoredSpeed)
    : authoredSpeed;
  state.projectiles.push({
    id: state.nextProjectileId++,
    x: options.x ?? source.x,
    y: options.y ?? source.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    source: options.source ?? 'enemy',
    ownerId: source.instanceId,
    damage: options.damage ?? 0,
    damageType: options.damageType ?? (options.source === 'enemy' ? 'projectile' : 'ranged'),
    life: options.life ?? ((options.returnDelay ?? 0) + (options.range ?? 360) / Math.max(speed, 1)),
    age: 0,
    returnDelay: options.returnDelay ?? null,
    returning: false,
    applies: options.applies ?? null,
    effectDuration: options.effectDuration ?? 0,
    persistent: Boolean(options.persistent),
    weaponId: options.weaponId ?? null,
    weaponLevel: options.weaponLevel ?? null,
    shotIndex: options.shotIndex ?? null,
    burstId: options.burstId ?? null,
    visual: options.visual ? { ...options.visual } : null,
    stunDuration: options.stunDuration ?? 0,
    impactStyle: options.impactStyle ?? null,
    impactRadius: options.impactRadius ?? 0,
    impactDuration: options.impactDuration ?? 0,
    impactRingCount: options.impactRingCount ?? 0,
    spiral: Boolean(options.spiral),
    spiralRate: options.spiralRate ?? 0,
    spiralInterval: options.spiralInterval ?? 0.24,
    nextSpiralAt: options.nextSpiralAt ?? 0.24,
    radius: options.radius ?? 6,
    colour: options.colour ?? '#a5e8ff',
  });
}

function spawnSkillProjectiles(state, enemy, skill, type = skill.type) {
  const count = Math.max(1, Math.round(skill.projectileCount ?? 1));
  const spread = ((skill.spreadDegrees ?? (count > 1 ? 18 : 0)) * Math.PI) / 180;
  const centre = angleBetween(enemy, state.actor);
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0 : index / (count - 1) - 0.5;
    spawnProjectile(state, enemy, {
      angle: centre + ratio * spread,
      speed: skill.projectileSpeed ?? 280,
      range: skill.range ?? 360,
      damage: skill.damage ?? 0,
      source: 'enemy',
      colour: type === 'shieldBoomerang' ? '#f6e66d' : '#a5e8ff',
      returnDelay: skill.returnDelay,
      applies: skill.applies,
      effectDuration: skill.duration,
      persistent: skill.persistent,
      spiral: skill.id === 'dualCoreMagic' || skill.id === 'mutantDualCoreMagic',
      spiralRate: index % 2 === 0 ? 1.8 : -1.8,
      spiralInterval: 0.24,
    });
  }
}

function shouldTelegraphSkill(skill, minimumCast = false) {
  if (!skill) return false;
  if (skill.type === 'lobbed' || skill.type === 'suicideCharge' || skill.id === 'beaconAssault') return false;
  return Number(skill.castTime ?? skill.telegraph ?? 0) > 0 || (minimumCast && hasPlayerDamage(skill));
}

function skillCastDuration(skill, minimumCast = false) {
  const authored = Math.max(0, Number(skill.castTime ?? skill.telegraph ?? 0));
  return authored > 0 ? authored : minimumCast && hasPlayerDamage(skill) ? 0.32 : 0;
}

function startEnemySkillCast(state, enemy, skill, { minimumCast = false } = {}) {
  const duration = skillCastDuration(skill, minimumCast);
  if (!shouldTelegraphSkill(skill, minimumCast) || duration <= 0) return false;
  enemy.pendingSkill = {
    skillId: skill.id,
    remaining: duration,
    targetX: state.actor.x,
    targetY: state.actor.y,
  };
  if (enemy.enemyId === 'squidAssassin' && skill.id === 'inkShadowSlash') enemy.hidden = true;
  enemy.state = 'casting';
  enemy.animationUntil = Math.max(enemy.animationUntil, state.time + duration);
  addEffect(state, {
    type: 'telegraph',
    x: skill.type === 'melee' || skill.type === 'teleportMelee' || skill.type === 'projectile' ? state.actor.x : enemy.x,
    y: skill.type === 'melee' || skill.type === 'teleportMelee' || skill.type === 'projectile' ? state.actor.y : enemy.y,
    radius: skill.radius ?? skill.range ?? enemy.radius + 18,
    duration,
    colour: '#ffb86e',
  });
  logEvent(state, `${enemyDefinition(enemy).name} 進入 ${skill.name} 預警，${duration.toFixed(1)} 秒後施放。`, 'warning');
  return true;
}

function splitSkillValue(enemy, skill, key, fallback) {
  const generation = Math.max(0, Number(enemy.splitGeneration ?? 0));
  if (enemy.enemyId !== 'splitLanternfish' || generation <= 0) return skill[key] ?? fallback;
  return (skill[key] ?? fallback) * (0.72 ** generation);
}

function areaDamage(state, origin, radius, damage, source, damageType = 'area') {
  if (distanceBetween(origin, state.actor) <= radius) applyPlayerDamage(state, damage, source, damageType);
  addEffect(state, { type: 'area', x: origin.x, y: origin.y, radius, duration: 0.55, colour: '#ffb86e' });
}

function applyKnockback(state, origin, radius, strength) {
  if (!strength || distanceBetween(origin, state.actor) > radius + state.actor.radius) return;
  const angle = angleBetween(origin, state.actor);
  state.actor.vx += Math.cos(angle) * strength;
  state.actor.vy += Math.sin(angle) * strength;
}

function summonFromSkill(state, enemy, skill) {
  const summonId = enemyDefinition(enemy).id === 'juvenileSeahorseCaller'
    ? CORE_SUMMON_IDS[(state.nextEnemyId - 1) % CORE_SUMMON_IDS.length]
    : 'juvenileSeahorseCaller';
  const count = clamp(Math.round(skill.summonCount ?? 1), 1, 8);
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    spawnSandboxEnemy(state, summonId, {
      x: clamp(enemy.x + Math.cos(angle) * (skill.summonRadius ? 34 : 24), 36, SANDBOX_WIDTH - 36),
      y: clamp(enemy.y + Math.sin(angle) * (skill.summonRadius ? 34 : 24), 36, SANDBOX_HEIGHT - 36),
    });
  }
  logEvent(state, `${enemyDefinition(enemy).name} 召喚 ${count} 名援軍。`, 'warning');
}

export function createSandboxState() {
  const actor = createTestActor({ x: 150, y: SANDBOX_HEIGHT / 2 });
  actor.activeEffects = {};
  actor.katanaEmpoweredNextSlash = false;
  actor.tridentStationaryTime = 0;
  actor.stunnedUntil = 0;
  const state = {
    time: 0,
    running: true,
    autoCycle: false,
    invincible: false,
    infiniteResources: true,
    zeroGravity: true,
    aiming: false,
    aimPoint: null,
    selectedEnemyInstanceId: null,
    selectedSkillId: null,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextEffectId: 1,
    nextWeaponBurstId: 1,
    nextExperienceOrbId: 1,
    enemies: [],
    projectiles: [],
    experienceOrbs: [],
    zones: [],
    effects: [],
    logs: [],
    rules: [],
    physicsMap: createSandboxPhysicsMap(),
    physicsOrigin: SANDBOX_PHYSICS_ORIGIN,
    physicsBounds: SANDBOX_PHYSICS_BOUNDS,
    actor,
    progression: createProgressionState(),
    awaitingUpgrade: false,
    upgradeCategory: null,
    upgradeCategories: [],
    upgradeChoices: [],
    build: { weaponId: 'knife', weaponLevel: 1, weapons: [{ id: 'knife', level: 1 }], activeWeaponSlot: 0, passives: [] },
    weaponBurst: null,
  };
  syncSandboxBuild(state);
  logEvent(state, '沙盒已準備：點擊場地放置敵人。');
  return state;
}

export function spawnSandboxEnemy(state, enemyId, position = { x: 620, y: SANDBOX_HEIGHT / 2 }, overrides = {}) {
  if (!ENEMY_DEFINITIONS[enemyId]) return null;
  const definition = ENEMY_DEFINITIONS[enemyId];
  const base = createEnemyState(enemyId);
  const enemy = {
    ...base,
    instanceId: `enemy-${state.nextEnemyId++}`,
    enemyId,
    x: clamp(position.x, 32, SANDBOX_WIDTH - 32),
    y: clamp(position.y, 32, SANDBOX_HEIGHT - 32),
    tier: definition.tier,
    vx: 0,
    vy: 0,
    moveSpeed: definition.moveSpeed,
    radius: clamp(Math.sqrt(definition.maxHealth) * 1.15, 18, 48),
    animation: 'idle',
    animationToken: 0,
    animationUntil: 0,
    state: 'idle',
    facing: 'left',
    nextAutoAt: 0,
    nextAutoSkillIndex: 0,
    linkedTarget: null,
    linkedTargets: [],
    linkedProtection: null,
    splitGeneration: 0,
    enraged: false,
    pendingSkill: null,
    beacon: null,
    stunnedUntil: 0,
    rescueCompleted: false,
    hidden: false,
    defeated: false,
    cooldowns: {},
    activeEffects: {},
    ...overrides,
  };
  state.enemies.push(enemy);
  state.selectedEnemyInstanceId = enemy.instanceId;
  logEvent(state, `已放置 ${definition.name}。`);
  return enemy;
}

export function clearSandboxEnemies(state) {
  state.enemies = [];
  state.projectiles = [];
  state.experienceOrbs = [];
  state.effects = [];
  state.weaponBurst = null;
  state.selectedEnemyInstanceId = null;
  state.selectedSkillId = null;
  logEvent(state, '已清除沙盒敵人與場上技能效果。');
}

export function setSandboxBuild(state, {
  weaponId = 'knife',
  weaponLevel = 1,
  weapons = null,
  activeWeaponSlot = null,
  passives = [],
  allowEmpty = false,
} = {}) {
  const validWeaponId = WEAPONS[weaponId] ? weaponId : 'knife';
  const validLevel = clamp(Math.round(Number(weaponLevel) || 1), 1, WEAPONS[validWeaponId].maxLevel);
  const requestedWeapons = Array.isArray(weapons)
    ? weapons
    : [{ id: 'knife', level: weaponId === 'knife' ? validLevel : 1 }, ...(weaponId !== 'knife' ? [{ id: validWeaponId, level: validLevel }] : [])];
  const validWeapons = Array.isArray(weapons)
    ? normalizeBuildEntries(requestedWeapons, WEAPONS, 3, { ensureKnife: !allowEmpty })
    : requestedWeapons;
  const validPassives = normalizeBuildEntries(
    unique(passives
      .filter((ability) => PASSIVE_ABILITIES[ability.id] && Number(ability.level) > 0)
      .map((ability) => ({ id: ability.id, level: Number(ability.level) }))),
    PASSIVE_ABILITIES,
    3,
  );
  state.progression.weapons = validWeapons;
  state.progression.passives = validPassives;
  const requestedActiveSlot = activeWeaponSlot == null
    ? (Array.isArray(weapons) ? 0 : (weaponId === 'knife' ? 0 : 1))
    : Math.round(Number(activeWeaponSlot));
  state.progression.activeWeaponSlot = clamp(requestedActiveSlot, 0, Math.max(0, validWeapons.length - 1));
  state.progression.pendingLevelUps = 0;
  state.awaitingUpgrade = false;
  state.upgradeCategory = null;
  state.upgradeCategories = [];
  state.upgradeChoices = [];
  syncSandboxBuild(state);
  state.actor.health = MAX_HEALTH;
  state.actor.oxygen = state.actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
  state.actor.energy = MAX_ENERGY;
  state.actor.katanaEmpoweredNextSlash = false;
  state.actor.tridentStationaryTime = 0;
  state.weaponBurst = null;
  return state.build;
}

export function resetSandboxPlayer(state) {
  state.actor.x = 150;
  state.actor.y = SANDBOX_HEIGHT / 2;
  state.actor.vx = 0;
  state.actor.vy = 0;
  state.actor.health = MAX_HEALTH;
  state.actor.oxygen = state.actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
  state.actor.energy = MAX_ENERGY;
  state.actor.launchMomentumTimer = 0;
  state.actor.facing = 'right';
  state.actor.blockedResting = false;
  state.actor.attached = false;
  state.actor.invulnerability = 0;
  state.actor.hurtTimer = 0;
  state.actor.deathAnimation = null;
  state.actor.dead = false;
  state.actor.gameOver = false;
  state.actor.activeEffects = {};
  state.actor.stunnedUntil = 0;
  state.actor.inInk = false;
  state.actor.inkUntil = 0;
  state.actor.katanaEmpoweredNextSlash = false;
  state.actor.tridentStationaryTime = 0;
  state.weaponBurst = null;
  state.aiming = false;
  state.aimPoint = null;
  logEvent(state, '玩家已重置。', 'safe');
}

export function beginSandboxAim(state, point) {
  if (!point || state.awaitingUpgrade || state.actor.attached || state.actor.dead || (state.actor.stunnedUntil ?? 0) > state.time) {
    return { ok: false, reason: state.awaitingUpgrade ? 'upgrade' : (state.actor.stunnedUntil ?? 0) > state.time ? 'stunned' : 'unavailable' };
  }
  state.aiming = true;
  state.aimPoint = { x: point.x, y: point.y };
  state.actor.vx = 0;
  state.actor.vy = 0;
  return { ok: true };
}

export function isSandboxPlayerHit(state, point) {
  if (!state?.actor || !point) return false;
  return distanceBetween(state.actor, point) <= Math.max(SANDBOX_PLAYER_INTERACTION_RADIUS, state.actor.radius + 24);
}

export function updateSandboxAim(state, point) {
  if (!state.aiming || !point) return { ok: false, reason: 'notAiming' };
  state.aimPoint = {
    x: clamp(point.x, 0, SANDBOX_WIDTH),
    y: clamp(point.y, 0, SANDBOX_HEIGHT),
  };
  return { ok: true, distance: Math.hypot(state.actor.x - state.aimPoint.x, state.actor.y - state.aimPoint.y) };
}

export function releaseSandboxAim(state, point = state.aimPoint) {
  if (!state.aiming) return { ok: false, reason: 'notAiming' };
  updateSandboxAim(state, point);
  const energyBefore = state.actor.energy;
  if (state.infiniteResources) state.actor.energy = MAX_ENERGY;
  const launch = launchActor(state.actor, state.aimPoint);
  if (state.infiniteResources) {
    state.actor.energy = MAX_ENERGY;
    state.actor.oxygen = state.actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
  }
  const result = { ok: launch.launched, ...launch };
  if (launch.launched) {
    addEffect(state, { type: 'launch', x: state.actor.x, y: state.actor.y, radius: 22, duration: 0.35, colour: '#f6e66d' });
    logEvent(state, `玩家彈射：距離 ${Math.round(launch.distance)}、初速 ${Math.round(launch.speed)}；沙盒零重力物理已接管。`, 'safe');
  } else if (state.infiniteResources) {
    state.actor.energy = energyBefore >= MAX_ENERGY ? MAX_ENERGY : energyBefore;
  }
  state.aiming = false;
  state.aimPoint = null;
  if (!result.launched) {
    const reason = result.reason === 'tooClose' ? '蓄力距離太短' : result.reason === 'attached' ? '玩家目前附著中' : '能量不足';
    logEvent(state, `彈射失敗：${reason}。`, 'warning');
  }
  return result;
}

export function executeEnemySkill(state, instanceId = state.selectedEnemyInstanceId, skillId = state.selectedSkillId, options = {}) {
  const enemy = state.enemies.find((candidate) => candidate.instanceId === instanceId && !candidate.defeated);
  if (!enemy) return { ok: false, reason: 'enemy' };
  const definition = enemyDefinition(enemy);
  const skill = definition.attacks.find((candidate) => candidate.id === skillId) ?? definition.attacks[0];
  if (!skill) return { ok: false, reason: 'skill' };
  if (enemy.rescueCompleted && skill.id === 'callForHelp' && !options.resolve) return { ok: false, reason: 'completed' };
  if (enemy.suicideCharge) return { ok: false, reason: 'busy' };
  // Manual sandbox selection is an inspection tool: choosing another skill
  // cancels the previous preview so every authored skill can be tested
  // without waiting through an earlier telegraph.
  if (enemy.pendingSkill && !options.resolve) {
    enemy.pendingSkill = null;
    enemy.state = 'idle';
    enemy.hidden = false;
  }
  if (!options.resolve && (enemy.cooldowns[skill.id] ?? 0) > 0) {
    logEvent(state, `${skill.name} 冷卻中：${enemy.cooldowns[skill.id].toFixed(1)} 秒。`, 'warning');
    return { ok: false, reason: 'cooldown' };
  }
  if (!options.resolve) enemy.cooldowns[skill.id] = (skill.cooldown ?? 0) * enemyCooldownMultiplier(enemy);
  if (options.resolve) {
    enemy.animation = skill.id;
    enemy.animationUntil = Math.max(enemy.animationUntil, state.time + SANDBOX_ENEMY_ACTION_VISUAL_HOLD);
  } else {
    setAnimation(enemy, skill.id, state.time);
  }
  if (!options.resolve && startEnemySkillCast(state, enemy, skill, { minimumCast: options.minimumCast ?? hasPlayerDamage(skill) })) {
    return { ok: true, pending: true, enemy: enemy.instanceId, skill: skill.id };
  }
  const distance = distanceBetween(enemy, state.actor);
  const source = `${definition.name}・${skill.name}`;
  logEvent(state, `${source} 已啟動。`);

  switch (skill.type) {
    case 'suicideCharge':
      beginSuicideCharge(state, enemy, skill);
      break;
    case 'contact':
      if (distance <= splitSkillValue(enemy, skill, 'radius', 42) + enemy.radius + state.actor.radius) {
        const contactRadius = splitSkillValue(enemy, skill, 'radius', 42);
        areaDamage(state, enemy, contactRadius, skill.damage ?? 0, source);
        if (skill.id === 'wingRam') applyKnockback(state, enemy, contactRadius, 105);
      }
      break;
    case 'melee':
      if (distance <= (skill.range ?? 48) + enemy.radius + state.actor.radius) {
        const damage = skill.id === 'shortThrust' ? 0 : (skill.damage ?? 0);
        applyPlayerDamage(state, damage, source, 'melee');
        if (skill.id === 'shortThrust') applyKnockback(state, enemy, skill.range ?? 42, 96);
      }
      addEffect(state, { type: 'slash', x: enemy.x, y: enemy.y, radius: skill.range ?? 48, duration: 0.4, angle: angleBetween(enemy, state.actor), colour: '#ff8d8d' });
      break;
    case 'dash':
    case 'teleportMelee': {
      const angle = angleBetween(enemy, state.actor);
      if (skill.type === 'dash') {
        const dashDistance = Math.min(skill.range ?? 150, Math.max(0, distance - 28));
        const nextX = enemy.x + Math.cos(angle) * dashDistance;
        const nextY = enemy.y + Math.sin(angle) * dashDistance;
        const clampedX = clamp(nextX, 32, SANDBOX_WIDTH - 32);
        const clampedY = clamp(nextY, 32, SANDBOX_HEIGHT - 32);
        enemy.x = clampedX;
        enemy.y = clampedY;
        if (Math.abs(nextX - clampedX) > 0.01 || Math.abs(nextY - clampedY) > 0.01) {
          enemy.stunnedUntil = state.time + 0.45;
          enemy.state = 'stunned';
          addEffect(state, { type: 'selfStun', x: enemy.x, y: enemy.y, radius: enemy.radius + 8, duration: 0.45, colour: '#9db7cc' });
        }
      } else if (skill.id === 'beaconAssault' && !options.beaconResolve) {
        enemy.beacon = {
          targetX: state.actor.x,
          targetY: state.actor.y,
          remaining: 0.8,
          skillId: skill.id,
        };
        addEffect(state, { type: 'beacon', x: enemy.beacon.targetX, y: enemy.beacon.targetY, radius: 18, duration: 0.8, colour: '#f6e66d' });
        logEvent(state, `${definition.name} 投出信標，0.8 秒後突襲。`, 'warning');
        break;
      } else {
        enemy.x = clamp(state.actor.x - Math.cos(angle) * 28, 32, SANDBOX_WIDTH - 32);
        enemy.y = clamp(state.actor.y - Math.sin(angle) * 28, 32, SANDBOX_HEIGHT - 32);
      }
      if (distanceBetween(enemy, state.actor) <= (skill.range ?? 150) + enemy.radius + state.actor.radius) applyPlayerDamage(state, skill.damage ?? 0, source, 'melee');
      if (skill.inkDuration) {
        state.actor.inInk = true;
        state.actor.inkUntil = state.time + skill.inkDuration;
      }
      addEffect(state, { type: skill.type, x: enemy.x, y: enemy.y, radius: 38, duration: 0.6, colour: '#e98dff' });
      break;
    }
    case 'projectile':
    case 'spread':
    case 'boomerangSpread':
    case 'shieldBoomerang':
      spawnSkillProjectiles(state, enemy, skill);
      break;
    case 'lobbed':
      state.zones.push({
        x: state.actor.x,
        y: state.actor.y,
        radius: skill.radius ?? 56,
        delay: skill.telegraph ?? 1,
        damage: skill.damage ?? 0,
        damageType: 'projectile',
        source,
        ownerId: enemy.instanceId,
        elapsed: 0,
        triggered: false,
        knockback: skill.knockback ?? (skill.id.toLowerCase().includes('arctide') ? 105 : 0),
        spreadCount: skill.id.toLowerCase().includes('mortar') ? 3 : 0,
        spreadDegrees: skill.id.toLowerCase().includes('mortar') ? 42 : 0,
        spreadSpeed: skill.id.toLowerCase().includes('mortar') ? 205 : 0,
        spreadDamage: skill.id.toLowerCase().includes('mortar') ? (skill.damage ?? 0) * 0.65 : 0,
      });
      addEffect(state, { type: 'telegraph', x: state.actor.x, y: state.actor.y, radius: skill.radius ?? 56, duration: skill.telegraph ?? 1, colour: '#ffb86e' });
      break;
    case 'areaStun':
    case 'gravityField':
    case 'destroyableGravityOrb':
      areaDamage(state, enemy, skill.radius ?? 100, skill.damage ?? 0, source);
      if (skill.type === 'areaStun') {
        applyKnockback(state, enemy, skill.radius ?? 100, 72);
        addEffect(state, { type: 'stunWave', x: enemy.x, y: enemy.y, radius: skill.radius ?? 100, duration: 0.75, colour: '#9ed9ff' });
      }
      state.rules.push({ label: skill.type, remaining: skill.duration ?? 2, multiplier: skill.gravityMultiplier ?? 1 });
      if (skill.stun) {
        state.actor.stunnedUntil = Math.max(state.actor.stunnedUntil ?? 0, state.time + skill.stun);
        state.actor.vx = 0;
        state.actor.vy = 0;
      }
      break;
    case 'summon':
    case 'summonWave':
    case 'repeatSummon':
    case 'sacrificeSummon':
      summonFromSkill(state, enemy, skill);
      break;
    case 'summonResourceDrain':
      summonFromSkill(state, enemy, skill);
      if (!state.infiniteResources) {
        state.actor.energy = Math.max(0, state.actor.energy - (skill.energyDrain ?? 0));
        state.actor.oxygen = Math.max(0, state.actor.oxygen - (skill.oxygenDrain ?? 0));
      }
      break;
    case 'supportPulse':
      activeEnemies(state).forEach((candidate) => {
        if (distanceBetween(enemy, candidate) <= (skill.radius ?? 110)) candidate.health = Math.min(candidate.maxHealth, candidate.health + candidate.maxHealth * (skill.healRatio ?? 0.08));
      });
      addEffect(state, { type: 'support', x: enemy.x, y: enemy.y, radius: skill.radius ?? 110, duration: 0.9, colour: '#80f2c2' });
      break;
    case 'link':
      enemy.linkedTargets = activeEnemies(state)
        .filter((candidate) => candidate.instanceId !== enemy.instanceId
          && candidate.tier === 2
          && distanceBetween(enemy, candidate) <= (skill.linkRange ?? 180))
        .map((candidate) => candidate.instanceId);
      enemy.linkedTarget = enemy.linkedTargets[0] ?? null;
      enemy.linkedTargets.forEach((targetId) => {
        const target = state.enemies.find((candidate) => candidate.instanceId === targetId);
        if (target) target.linkedProtection = enemy.instanceId;
      });
      addEffect(state, { type: 'link', x: enemy.x, y: enemy.y, radius: skill.linkRange ?? 180, duration: 1.2, colour: '#ff9ae6' });
      break;
    case 'reflectedBeam':
    case 'reflectedBeamSplit': {
      const beam = { x: enemy.x, y: enemy.y, targetX: state.actor.x, targetY: state.actor.y, radius: 10, duration: skill.duration ?? 3, damagePerSecond: skill.damagePerSecond ?? 24, source, elapsed: 0, continuous: true, triggered: false };
      state.zones.push(beam);
      addEffect(state, { type: 'beam', x: enemy.x, y: enemy.y, targetX: state.actor.x, targetY: state.actor.y, radius: 10, duration: skill.duration ?? 3, colour: '#bca7ff' });
      break;
    }
    case 'split':
      for (let index = 0; index < (skill.childCount ?? 2); index += 1) {
        spawnSandboxEnemy(state, 'splitLanternfish', {
          x: enemy.x + index * 24 - 12,
          y: enemy.y + 20,
        }, {
          health: skill.childHealth ?? 28,
          maxHealth: skill.childHealth ?? 28,
          moveSpeed: skill.childSpeed ?? 122,
          radius: Math.max(14, enemy.radius * 0.72),
          splitGeneration: (enemy.splitGeneration ?? 0) + 1,
        });
      }
      logEvent(state, `${definition.name} 立即分裂出 ${(skill.childCount ?? 2)} 隻小型個體。`, 'warning');
      break;
    case 'rebuildArena':
      enemy.health = Math.min(enemy.maxHealth, enemy.health + enemy.maxHealth * (skill.healPerSecondRatio ?? 0.02) * (skill.duration ?? 8));
      addEffect(state, { type: 'rebuild', x: enemy.x, y: enemy.y, radius: 130, duration: skill.duration ?? 8, colour: '#8bd8ff' });
      break;
    case 'cloneBarrage':
      spawnSkillProjectiles(state, enemy, skill);
      spawnSandboxEnemy(state, enemy.enemyId, { x: enemy.x + 42, y: enemy.y + 22 }, { health: enemy.maxHealth * (skill.cloneHealthRatio ?? 0.18) });
      break;
    case 'speedForm':
      enemy.activeEffects.speedForm = skill.duration ?? 7;
      addEffect(state, { type: 'speed', x: enemy.x, y: enemy.y, radius: enemy.radius + 12, duration: skill.duration ?? 7, colour: '#ffcd7d' });
      break;
    case 'gravityRule':
    case 'ruleChange':
    case 'ruleCombination':
      state.rules = unique([...(skill.gravityModes ?? skill.combinations ?? ['gravityShift'])]).map((label) => ({ label, remaining: skill.duration ?? 4 }));
      addEffect(state, { type: 'rule', x: SANDBOX_WIDTH / 2, y: SANDBOX_HEIGHT / 2, radius: 220, duration: skill.duration ?? 4, colour: '#79c7ff' });
      break;
    case 'corruptOxygen':
      if (!state.infiniteResources) state.actor.oxygen = Math.max(0, state.actor.oxygen - (skill.oxygenDrain ?? 35));
      state.zones.push({ x: state.actor.x, y: state.actor.y, radius: skill.explosionRadius ?? 96, delay: 0.9, damage: skill.damage ?? 0, source, elapsed: 0, triggered: false, oxygenDrain: skill.oxygenDrain ?? 35 });
      break;
    default:
      if (skill.damage > 0) applyPlayerDamage(state, skill.damage, source);
      addEffect(state, { type: 'generic', x: enemy.x, y: enemy.y, radius: enemy.radius + 20, duration: 0.8, colour: '#d7e9ff' });
      break;
  }
  return { ok: true, enemy: enemy.instanceId, skill: skill.id };
}

function knifeDirection(state, target = null) {
  const targetDelta = target
    ? { x: target.x - state.actor.x, y: target.y - state.actor.y }
    : { x: 0, y: 0 };
  const targetLength = Math.hypot(targetDelta.x, targetDelta.y);
  if (targetLength > 0) return { x: targetDelta.x / targetLength, y: targetDelta.y / targetLength };
  const velocityLength = Math.hypot(state.actor.vx, state.actor.vy);
  if (velocityLength > 0) return { x: state.actor.vx / velocityLength, y: state.actor.vy / velocityLength };
  return { x: state.actor.facing === 'left' ? -1 : 1, y: 0 };
}

function shortestAngleDifference(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

function katanaDirectionAngle(state, target = null) {
  if (target) return angleBetween(state.actor, target);
  const velocityLength = Math.hypot(state.actor.vx, state.actor.vy);
  if (velocityLength > 0) return Math.atan2(state.actor.vy, state.actor.vx);
  return state.actor.facing === 'left' ? Math.PI : 0;
}

function isWithinKatanaArc(state, enemy, weapon) {
  const distance = distanceBetween(state.actor, enemy);
  const reach = weapon.range + Math.min(8, enemy.radius * 0.25);
  return distance <= reach;
}

function katanaWaveContainsPoint(wave, point, progress = 0) {
  const pose = getKatanaWavePose(wave, progress);
  const dx = point.x - pose.x;
  const dy = point.y - pose.y;
  const distance = Math.hypot(dx, dy);
  const radialDistance = Math.abs(distance - pose.radius);
  const angle = Math.atan2(dy, dx);
  const arcHalf = ((wave.arcDegrees ?? 90) * Math.PI) / 360;
  return radialDistance <= (wave.thickness ?? 8) * 0.5 + (point.radius ?? 0)
    && Math.abs(shortestAngleDifference(angle, pose.angle)) <= arcHalf;
}

function addKatanaWave(state, weapon, angle) {
  const wave = weapon.effect?.wave;
  if (!wave) return null;
  const effect = addEffect(state, {
    type: 'katanaWave',
    style: wave.style,
    x: state.actor.x,
    y: state.actor.y,
    angle,
    startDistance: wave.startDistance ?? 22,
    travelDistance: wave.travelDistance ?? 132,
    radius: wave.radius ?? 22,
    arcDegrees: wave.arcDegrees ?? weapon.hitArcDegrees ?? 100,
    duration: wave.duration ?? 0.24,
    lineWidth: wave.lineWidth ?? 4,
    thickness: wave.thickness ?? 8,
    colour: wave.colour ?? '#70f6ff',
    glowColour: wave.glowColour ?? wave.colour ?? '#b8fbff',
    destroyedProjectiles: 0,
  });
  return effect;
}

function performKatanaSlash(state, weapon, target = null) {
  const effect = weapon.effect ?? {};
  const angle = katanaDirectionAngle(state, target);
  const empowered = Boolean(effect.empowerAfterMovement && state.actor.katanaEmpoweredNextSlash);
  const damageMultiplier = empowered ? (effect.empoweredDamageMultiplier ?? 2) : 1;
  const hitEnemies = activeEnemies(state).filter((enemy) => isWithinKatanaArc(state, enemy, weapon));
  hitEnemies.forEach((enemy) => {
    damageEnemy(state, enemy, weapon.damage * damageMultiplier, empowered ? '武士刀・強化揮擊' : '武士刀・順時針揮擊');
  });
  if (empowered) state.actor.katanaEmpoweredNextSlash = false;
  addEffect(state, {
    type: 'katanaSwing',
    style: effect.style ?? 'katanaClockwiseSwing',
    x: state.actor.x,
    y: state.actor.y,
    angle,
    arcDegrees: effect.arcDegrees ?? weapon.hitArcDegrees ?? 100,
    duration: effect.duration ?? 0.3,
    sprite: effect.sprite,
    weaponLength: effect.weaponLength ?? 72,
    weaponThickness: effect.weaponThickness ?? 11.2,
    gripPivot: effect.gripPivot ?? 14,
    afterimageCount: effect.afterimageCount ?? 5,
    afterimageAngleStepDegrees: effect.afterimageAngleStepDegrees ?? 11,
    afterimageAlpha: effect.afterimageAlpha ?? 0.34,
    colour: empowered ? (effect.empoweredColour ?? effect.colour ?? '#ff5c8a') : (effect.colour ?? '#73d9ff'),
    glowColour: empowered ? (effect.empoweredGlowColour ?? effect.glowColour ?? '#ff9eb8') : (effect.glowColour ?? '#9be8ff'),
    empowered,
    hitCount: hitEnemies.length,
    damageMultiplier,
  });
  const wave = addKatanaWave(state, weapon, angle);
  return { hit: hitEnemies.length > 0, hitCount: hitEnemies.length, empowered, angle, wave };
}

function markKatanaMovement(state, previousPosition) {
  const entry = getEquippedWeaponEntry(state, 'katana');
  if (!entry) return;
  const effect = getWeaponStats('katana', entry.level).effect ?? {};
  if (!effect.empowerAfterMovement) return;
  if (distanceBetween(state.actor, previousPosition) >= 1.5) state.actor.katanaEmpoweredNextSlash = true;
}

function processKatanaAutoAttack(state) {
  const entry = getEquippedWeaponEntry(state, 'katana');
  if (state.aiming || !entry) return;
  const weapon = getWeaponStats('katana', entry.level);
  const cooldownKey = 'weapon:katana';
  if ((state.actor.cooldowns[cooldownKey] ?? 0) > 0) return;
  const target = activeEnemies(state)
    .filter((enemy) => distanceBetween(state.actor, enemy) <= weapon.range + Math.min(8, enemy.radius * 0.25))
    .sort((left, right) => distanceBetween(state.actor, left) - distanceBetween(state.actor, right))[0];
  if (!target) return;
  const result = performKatanaSlash(state, weapon, target);
  state.actor.cooldowns[cooldownKey] = weapon.cooldown ?? 0;
  if (result.hit) logEvent(state, `武士刀 Lv.${entry.level} 順時針揮刀命中 ${result.hitCount} 個目標。`, 'safe');
}

function projectileDirectionAngle(state, target = null) {
  if (target) return angleBetween(state.actor, target);
  const velocityLength = Math.hypot(state.actor.vx, state.actor.vy);
  if (velocityLength > 0) return Math.atan2(state.actor.vy, state.actor.vx);
  return state.actor.facing === 'left' ? Math.PI : 0;
}

function addTridentImpactEffect(state, projectile, enemy) {
  const visual = projectile.visual ?? {};
  addEffect(state, {
    type: 'tridentImpact',
    style: projectile.impactStyle ?? visual.impactStyle ?? 'tridentImpact',
    x: enemy.x,
    y: enemy.y,
    radius: projectile.impactRadius || visual.impactRadius || 20,
    duration: projectile.impactDuration || visual.impactDuration || 0.35,
    ringCount: projectile.impactRingCount || visual.impactRingCount || 1,
    colour: visual.colour ?? '#73e6ff',
    glowColour: visual.glowColour ?? '#d9fbff',
    stunDuration: projectile.stunDuration ?? visual.stunDuration ?? 0,
  });
}

function processTridentAutoAttack(state, dt) {
  const entry = getEquippedWeaponEntry(state, 'trident');
  if (!entry || state.aiming || state.actor.attached || state.actor.dead) {
    state.actor.tridentStationaryTime = 0;
    return;
  }
  const weapon = getWeaponStats('trident', entry.level);
  const effect = weapon.effect ?? {};
  const speed = Math.hypot(state.actor.vx, state.actor.vy);
  if (speed > (effect.stationarySpeedThreshold ?? 8)) {
    state.actor.tridentStationaryTime = 0;
    return;
  }
  state.actor.tridentStationaryTime = (state.actor.tridentStationaryTime ?? 0) + dt;
  if (state.actor.tridentStationaryTime < (effect.stationaryDelay ?? 1)) return;
  const result = playerAttack(state, { auto: true, weaponId: 'trident', weaponLevel: entry.level });
  if (result.ok || result.reason === 'energy' || result.reason === 'cooldown') state.actor.tridentStationaryTime = 0;
}

function getLightMachineGunShotVisual(weapon, shotIndex) {
  const effect = weapon.effect ?? {};
  const level = weapon.level ?? 1;
  const visual = { ...effect };
  if (level === 2 && shotIndex >= 3) {
    visual.bulletStyle = effect.alternateBulletStyle ?? 'outlined';
    visual.bulletColour = effect.alternateBulletColour ?? effect.bulletColour;
    visual.bulletOutline = effect.alternateBulletOutline ?? effect.bulletOutline;
  }
  if (level >= 3 && Array.isArray(effect.bulletPalette) && effect.bulletPalette.length) {
    visual.bulletColour = effect.bulletPalette[shotIndex % effect.bulletPalette.length];
  }
  return visual;
}

function fireLightMachineGunShot(state, burst, shotIndex) {
  const weapon = { ...WEAPONS.lightMachineGun, ...getWeaponStats('lightMachineGun', burst.weaponLevel), level: burst.weaponLevel };
  const visual = getLightMachineGunShotVisual(weapon, shotIndex);
  spawnProjectile(state, state.actor, {
    angle: burst.angle,
    speed: weapon.projectileSpeed,
    range: weapon.range,
    damage: weapon.damage,
    source: 'player',
    damageType: 'player',
    colour: visual.bulletColour ?? '#8fe8ff',
    radius: Math.max(3, (visual.bulletWidth ?? 5) * 0.5),
    weaponId: 'lightMachineGun',
    weaponLevel: burst.weaponLevel,
    shotIndex,
    burstId: burst.id,
    visual,
  });
  const muzzle = state.effects.find((effect) => effect.id === burst.effectId);
  if (muzzle) muzzle.firedShots = shotIndex + 1;
}

function beginLightMachineGunBurst(state, weapon, weaponLevel, angle, targetId = null) {
  const effect = weapon.effect ?? {};
  const shotCount = Math.max(1, Math.round(weapon.burstCount ?? 6));
  const interval = Math.max(0.02, Number(weapon.burstInterval ?? 0.08));
  const id = state.nextWeaponBurstId++;
  const gunEffect = addEffect(state, {
    type: 'lightMachineGun',
    style: effect.style ?? 'lightMachineGun',
    x: state.actor.x,
    y: state.actor.y,
    angle,
    duration: interval * (shotCount - 1) + 0.24,
    gunLength: effect.gunLength ?? 66,
    gunWidth: effect.gunWidth ?? 14,
    sprite: effect.sprite ?? '/assets/editor/weapons/light-machine-gun.png',
    gunColour: effect.gunColour ?? '#263b52',
    gunAccent: effect.gunAccent ?? '#73e6ff',
    muzzleColour: effect.muzzleColour ?? '#d9fbff',
    shotCount,
    firedShots: 0,
    weaponLevel,
  });
  const burst = {
    id,
    weaponId: 'lightMachineGun',
    weaponLevel,
    angle,
    targetId,
    shotCount,
    interval,
    nextShotIndex: 1,
    nextShotAt: state.time + interval,
    finishAt: state.time + interval * (shotCount - 1) + 0.18,
    effectId: gunEffect.id,
  };
  state.weaponBurst = burst;
  fireLightMachineGunShot(state, burst, 0);
  return burst;
}

function updateLightMachineGunBurst(state) {
  const burst = state.weaponBurst;
  if (!burst) return;
  const entry = getEquippedWeaponEntry(state, 'lightMachineGun');
  if (!entry || entry.level !== burst.weaponLevel) {
    state.weaponBurst = null;
    return;
  }
  const muzzle = state.effects.find((effect) => effect.id === burst.effectId);
  if (muzzle) {
    muzzle.x = state.actor.x;
    muzzle.y = state.actor.y;
  }
  while (burst.nextShotIndex < burst.shotCount && state.time + 1e-8 >= burst.nextShotAt) {
    fireLightMachineGunShot(state, burst, burst.nextShotIndex);
    burst.nextShotIndex += 1;
    burst.nextShotAt += burst.interval;
  }
  if (burst.nextShotIndex >= burst.shotCount && state.time >= burst.finishAt) state.weaponBurst = null;
}

function processLightMachineGunAutoAttack(state) {
  const entry = getEquippedWeaponEntry(state, 'lightMachineGun');
  if (!entry || state.aiming || state.actor.attached || state.actor.dead) return;
  if (state.weaponBurst?.weaponId === 'lightMachineGun') return;
  const cooldownKey = 'weapon:lightMachineGun';
  if ((state.actor.cooldowns[cooldownKey] ?? 0) > 0) return;
  playerAttack(state, { auto: true, weaponId: 'lightMachineGun', weaponLevel: entry.level });
}

export function getSandboxAutoWeaponStatuses(state) {
  const pauseReason = !state.running
    ? '沙盒已暫停'
    : state.awaitingUpgrade
      ? '等待升級選擇'
      : state.actor.dead
        ? '玩家死亡'
        : state.aiming
          ? '拉射中'
          : state.actor.attached
            ? '附著中'
            : null;
  return getEquippedWeaponEntries(state)
    .filter((entry) => entry.id === 'trident' || entry.id === 'lightMachineGun')
    .map((entry) => {
      const weapon = getWeaponStats(entry.id, entry.level);
      if (entry.id === 'trident') {
        const delay = weapon.effect?.stationaryDelay ?? 1;
        const threshold = weapon.effect?.stationarySpeedThreshold ?? 8;
        const speed = Math.hypot(state.actor.vx, state.actor.vy);
        const cooldown = Math.max(0, state.actor.cooldowns?.['weapon:trident'] ?? 0);
        const stationary = Math.min(delay, Math.max(0, state.actor.tridentStationaryTime ?? 0));
        if (pauseReason) return { id: entry.id, level: entry.level, phase: 'paused', label: `暫停：${pauseReason}` };
        if (speed > threshold) return { id: entry.id, level: entry.level, phase: 'moving', label: `移動中；停止後蓄能 ${delay.toFixed(1)} 秒` };
        const remaining = Math.max(cooldown, delay - stationary);
        return {
          id: entry.id,
          level: entry.level,
          phase: remaining > 0 ? 'charging' : 'ready',
          label: remaining > 0 ? `${remaining.toFixed(1)} 秒後自動發射` : '準備自動發射',
          remaining,
          progress: delay > 0 ? stationary / delay : 1,
        };
      }
      const burst = state.weaponBurst?.weaponId === 'lightMachineGun' ? state.weaponBurst : null;
      if (burst) {
        return {
          id: entry.id,
          level: entry.level,
          phase: 'burst',
          label: `自動六連射 ${Math.min(burst.nextShotIndex, burst.shotCount)}/${burst.shotCount}`,
          remaining: Math.max(0, burst.finishAt - state.time),
        };
      }
      if (pauseReason) return { id: entry.id, level: entry.level, phase: 'paused', label: `暫停：${pauseReason}` };
      const remaining = Math.max(0, state.actor.cooldowns?.['weapon:lightMachineGun'] ?? 0);
      return {
        id: entry.id,
        level: entry.level,
        phase: remaining > 0 ? 'cooldown' : 'ready',
        label: remaining > 0 ? `${remaining.toFixed(1)} 秒後下一輪` : '準備自動六連射',
        remaining,
      };
    });
}

function knifeSwipeSegment(state, weapon, target = null) {
  const direction = knifeDirection(state, target);
  const targetDistance = target ? Math.hypot(target.x - state.actor.x, target.y - state.actor.y) : 0;
  const distance = target
    ? Math.min(Math.max(targetDistance, weapon.range * 0.7), weapon.range + 18)
    : weapon.range + 18;
  return {
    start: { x: state.actor.x + direction.x * 8, y: state.actor.y + direction.y * 8 },
    end: { x: state.actor.x + direction.x * (8 + distance), y: state.actor.y + direction.y * (8 + distance) },
  };
}

function addKnifeMeteorEffect(state, weapon, start, end, { offset = 0, side = false } = {}) {
  const effect = weapon.effect ?? {};
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const shiftedStart = { x: start.x + normal.x * offset, y: start.y + normal.y * offset };
  const shiftedEnd = { x: end.x + normal.x * offset, y: end.y + normal.y * offset };
  const duration = side ? (effect.sideTrailDuration ?? effect.duration ?? 0.7) : (effect.duration ?? 0.7);
  addEffect(state, {
    type: side ? 'knifeTrail' : 'playerSlash',
    style: side ? 'knifeMeteorSide' : 'knifeMeteor',
    x: shiftedStart.x,
    y: shiftedStart.y,
    startX: shiftedStart.x,
    startY: shiftedStart.y,
    targetX: shiftedEnd.x,
    targetY: shiftedEnd.y,
    radius: weapon.range,
    duration,
    sweepDuration: Math.min(effect.sweepDuration ?? 0.24, duration * 0.45),
    trailLength: side ? 0.78 : (effect.trailLength ?? 0.82),
    lineWidth: side ? (effect.sideTrailWidth ?? Math.max(2, (effect.lineWidth ?? 6) * 0.42)) : (effect.lineWidth ?? 6),
    headRadius: side ? Math.max(4, (effect.headRadius ?? 7) * 0.58) : (effect.headRadius ?? 7),
    pathAlpha: effect.pathAlpha ?? 0,
    lingerMinAlpha: effect.lingerMinAlpha ?? 0.2,
    sparkleCount: side ? 0 : (effect.sparkleCount ?? 0),
    sparkleBudget: side ? 0 : (effect.sparkleBudget ?? effect.sparkleCount ?? 0),
    glowBlur: effect.glowBlur,
    sideGlowBlur: effect.sideGlowBlur,
    angle: Math.atan2(dy, dx),
    colour: side ? (effect.sideTrailColour ?? effect.colour ?? '#e6faff') : (effect.colour ?? '#ffffff'),
    glowColour: effect.glowColour ?? '#dffbff',
    sparkleColour: effect.sparkleColour ?? '#d8faff',
  });
}

function addKnifeMeteorEffects(state, weapon, start, end) {
  const effect = weapon.effect ?? {};
  addKnifeMeteorEffect(state, weapon, start, end);
  const sideCount = Math.max(0, Math.round(effect.sideTrailCount ?? 0));
  const sideOffset = effect.sideTrailOffset ?? 18;
  for (let index = 0; index < sideCount; index += 1) {
    const offset = (index - (sideCount - 1) / 2) * sideOffset * 2;
    addKnifeMeteorEffect(state, weapon, start, end, { offset, side: true });
  }
}

export function playerAttack(state, options = {}) {
  if (state.awaitingUpgrade) return { ok: false, reason: 'upgrade' };
  const auto = Boolean(options.auto);
  const selectedWeaponId = options.weaponId ?? state.build?.weaponId;
  if (!selectedWeaponId || !WEAPONS[selectedWeaponId]) {
    logEvent(state, '目前沒有裝備武器，無法發動攻擊。', 'warning');
    return { ok: false, reason: 'noWeapon' };
  }
  const weaponDefinition = WEAPONS[selectedWeaponId];
  const weaponLevel = clamp(
    Math.round(Number(options.weaponLevel ?? state.build.weaponLevel ?? 1) || 1),
    1,
    weaponDefinition.maxLevel,
  );
  const weapon = { ...weaponDefinition, ...getWeaponStats(selectedWeaponId, weaponLevel), level: weaponLevel };
  state.actor.cooldowns ??= {};
  const cooldownKey = `weapon:${weaponDefinition.id}`;
  if (state.weaponBurst?.weaponId === weaponDefinition.id) {
    return { ok: false, reason: 'burst', remaining: Math.max(0, state.weaponBurst.finishAt - state.time) };
  }
  const cooldownRemaining = state.actor.cooldowns[cooldownKey] ?? 0;
  if (cooldownRemaining > 0) {
    logEvent(state, `${weaponDefinition.name} 冷卻中：${cooldownRemaining.toFixed(1)} 秒。`, 'warning');
    return { ok: false, reason: 'cooldown', remaining: cooldownRemaining };
  }
  const target = state.enemies.find((enemy) => enemy.instanceId === state.selectedEnemyInstanceId && !enemy.defeated) ?? activeEnemies(state)[0];
  const canShowKnifePreview = weapon.type === 'melee' && weapon.effect?.style === 'knifeMeteor';
  const canShowKatanaPreview = weapon.type === 'melee' && weapon.effect?.style === 'katanaClockwiseSwing';
  const canShowTridentPreview = weaponDefinition.id === 'trident';
  const canShowLightMachineGunPreview = weaponDefinition.id === 'lightMachineGun';
  if (!target && !canShowKnifePreview && !canShowKatanaPreview && !canShowTridentPreview && !canShowLightMachineGunPreview) {
    logEvent(state, '沒有可攻擊的敵人。', 'warning');
    return { ok: false, reason: 'target' };
  }
  const cost = weapon.energyCost * (state.actor.derivedStats?.weaponEnergyCostMultiplier ?? 1);
  if (!state.infiniteResources && state.actor.energy < cost) {
    logEvent(state, `${weaponDefinition.name}：能量不足。`, 'warning');
    return { ok: false, reason: 'energy' };
  }
  if (!state.infiniteResources) state.actor.energy -= cost;
  let hit = false;
  if (weapon.type === 'melee') {
    if (canShowKatanaPreview) {
      const result = performKatanaSlash(state, weapon, target);
      hit = result.hit;
    } else {
      hit = Boolean(target && distanceBetween(state.actor, target) <= weapon.range);
    }
    if (hit && !canShowKatanaPreview) damageEnemy(state, target, weapon.damage, weaponDefinition.name);
    if (canShowKnifePreview) {
      const swipe = knifeSwipeSegment(state, weapon, target);
      addKnifeMeteorEffects(state, weapon, swipe.start, swipe.end);
      if (weapon.effect?.sideTrailDamageMultiplier) {
        applyKnifeSideTrailDamage(state, weapon, swipe.start, swipe.end, target?.instanceId ?? null);
      }
    } else if (!canShowKatanaPreview) {
      const attackAngle = target ? angleBetween(state.actor, target) : (state.actor.facing === 'left' ? Math.PI : 0);
      addEffect(state, { type: 'playerSlash', x: state.actor.x, y: state.actor.y, radius: weapon.range, duration: 0.45, angle: attackAngle, colour: '#f6e66d' });
    }
    if (!hit && target) logEvent(state, `${weaponDefinition.name}：目標不在 ${Math.round(weapon.range)} px 近戰距離內。`, 'warning');
    if (!target) logEvent(state, `${weaponDefinition.name}：展示刀身順時針揮擊${canShowKatanaPreview && weapon.effect?.wave ? '與白色飛行衝擊波' : ''}（目前沒有目標）。`, 'safe');
  } else {
    if (weaponDefinition.id === 'lightMachineGun') {
      const angle = projectileDirectionAngle(state, target);
      const burst = beginLightMachineGunBurst(state, weapon, weaponLevel, angle, target?.instanceId ?? null);
      state.actor.cooldowns[cooldownKey] = weapon.cooldown ?? 0.72;
      logEvent(state, `${auto ? '自動發射' : '玩家使用'} 輕量機槍 Lv.${weaponLevel}：固定方向六發連射。`, 'safe');
      return {
        ok: true,
        hit: false,
        weaponId: weaponDefinition.id,
        weaponLevel,
        burstCount: burst.shotCount,
        angle,
        targetId: burst.targetId,
      };
    }
    const count = weapon.projectileCount ?? 1;
    const spread = ((weapon.spreadDegrees ?? 0) * Math.PI) / 180;
    const angle = projectileDirectionAngle(state, target);
    const visual = weapon.effect ?? {};
    for (let index = 0; index < count; index += 1) {
      const ratio = count === 1 ? 0 : index / (count - 1) - 0.5;
      spawnProjectile(state, state.actor, {
        angle: angle + ratio * spread,
        speed: weapon.projectileSpeed,
        range: weapon.range,
        damage: weapon.damage,
        source: 'player',
        damageType: 'player',
        colour: visual.colour ?? '#f6e66d',
        radius: visual.projectileRadius,
        weaponId: weaponDefinition.id,
        weaponLevel,
        visual,
        stunDuration: visual.stunDuration,
        impactStyle: visual.impactStyle,
        impactRadius: visual.impactRadius,
        impactDuration: visual.impactDuration,
        impactRingCount: visual.impactRingCount,
      });
    }
    if (weaponDefinition.id === 'trident') state.actor.tridentStationaryTime = 0;
  }
  state.actor.cooldowns[cooldownKey] = weapon.cooldown ?? 0;
  logEvent(state, `${auto ? '自動發動' : '玩家使用'} ${weaponDefinition.name} Lv.${weaponLevel}。`, 'safe');
  return { ok: true, hit, weaponId: weaponDefinition.id, weaponLevel };
}

export function playerAttackAllWeapons(state, { auto = false } = {}) {
  if (state.awaitingUpgrade) return { ok: false, reason: 'upgrade', results: [] };
  const equipped = getEquippedWeaponEntries(state);
  if (!equipped.length) return { ok: false, reason: 'noWeapon', results: [], firedWeaponIds: [] };
  const results = equipped.map((entry) => playerAttack(state, {
    auto,
    weaponId: entry.id,
    weaponLevel: entry.level,
  }));
  const firedWeaponIds = results
    .filter((result) => result.ok)
    .map((result) => result.weaponId)
    .filter(Boolean);
  return {
    ok: firedWeaponIds.length > 0,
    results,
    firedWeaponIds,
  };
}

function updateProjectiles(state, dt) {
  const generated = [];
  state.projectiles = state.projectiles.filter((projectile) => {
    projectile.life -= dt;
    projectile.age = (projectile.age ?? 0) + dt;
    if (projectile.life <= 0) return false;
    if (projectile.returnDelay != null && projectile.age >= projectile.returnDelay) projectile.returning = true;
    const target = projectile.returning && projectile.source === 'enemy' ? state.enemies.find((enemy) => enemy.instanceId === projectile.ownerId) : state.actor;
    if (target && projectile.returning) {
      const angle = angleBetween(projectile, target);
      projectile.vx = Math.cos(angle) * Math.hypot(projectile.vx, projectile.vy);
      projectile.vy = Math.sin(angle) * Math.hypot(projectile.vx, projectile.vy);
    }
    if (projectile.spiral) {
      projectile.angle += (projectile.spiralRate ?? 0) * dt;
      const speed = Math.hypot(projectile.vx, projectile.vy);
      projectile.vx = Math.cos(projectile.angle) * speed;
      projectile.vy = Math.sin(projectile.angle) * speed;
      while (projectile.age >= (projectile.nextSpiralAt ?? projectile.spiralInterval ?? 0.24)) {
        const owner = state.enemies.find((candidate) => candidate.instanceId === projectile.ownerId);
        if (owner) generated.push({
          owner,
          x: projectile.x,
          y: projectile.y,
          angle: projectile.angle + Math.PI / 2,
          speed: Math.max(120, speed * 0.72),
          range: 180,
          damage: projectile.damage * 0.45,
          source: 'enemy',
          colour: '#d2b5ff',
        });
        projectile.nextSpiralAt = (projectile.nextSpiralAt ?? projectile.spiralInterval ?? 0.24) + (projectile.spiralInterval ?? 0.24);
      }
    }
    const previousPosition = { x: projectile.x, y: projectile.y };
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.source === 'enemy') {
      const wave = state.effects.find((effect) => effect.type === 'katanaWave' && effect.style === 'katanaProjectileWave'
        && effect.elapsed < effect.duration);
      if (wave) {
        const progress = wave.duration > 0 ? wave.elapsed / wave.duration : 1;
        const sweptHit = katanaWaveContainsPoint(wave, projectile, progress)
          || katanaWaveContainsPoint(wave, previousPosition, progress);
        if (sweptHit) {
          wave.destroyedProjectiles = (wave.destroyedProjectiles ?? 0) + 1;
          return false;
        }
      }
    }
    if (projectile.source === 'player') {
      const hit = activeEnemies(state).find((enemy) => distanceToSegment(enemy, previousPosition, projectile) <= enemy.radius + projectile.radius);
      if (hit) {
        const isTrident = projectile.weaponId === 'trident';
        const appliedDamage = damageEnemy(
          state,
          hit,
          projectile.damage,
          isTrident ? `三叉戟 Lv.${projectile.weaponLevel ?? 1}` : '玩家投射物',
        );
        if (isTrident && appliedDamage > 0) {
          if (projectile.stunDuration > 0) {
            hit.stunnedUntil = Math.max(hit.stunnedUntil ?? 0, state.time + projectile.stunDuration);
            hit.vx = 0;
            hit.vy = 0;
            hit.state = 'stunned';
            logEvent(state, `${enemyDefinition(hit).name} 被三叉戟 Lv.${projectile.weaponLevel ?? 1} 暈眩 ${projectile.stunDuration.toFixed(1)} 秒。`, 'safe');
          }
          addTridentImpactEffect(state, projectile, hit);
          const cooldownReduction = Math.max(0, Number(projectile.visual?.cooldownReductionOnHit ?? 0));
          if (cooldownReduction > 0) {
            const cooldownKey = 'weapon:trident';
            state.actor.cooldowns[cooldownKey] = Math.max(0, (state.actor.cooldowns[cooldownKey] ?? 0) - cooldownReduction);
            logEvent(state, `三叉戟 Lv.${projectile.weaponLevel ?? 1} 命中：下次發射提前 ${cooldownReduction.toFixed(2)} 秒。`, 'safe');
          }
        }
        return false;
      }
    } else if (distanceToSegment(state.actor, previousPosition, projectile) <= state.actor.radius + projectile.radius) {
      applyPlayerDamage(state, projectile.damage, '敵人投射物', projectile.damageType);
      if (projectile.applies) {
        state.actor.activeEffects ??= {};
        state.actor.activeEffects[projectile.applies] = Math.max(
          state.actor.activeEffects[projectile.applies] ?? 0,
          projectile.effectDuration || 0,
        );
      }
      return false;
    }
    return projectile.x > -40 && projectile.x < SANDBOX_WIDTH + 40 && projectile.y > -40 && projectile.y < SANDBOX_HEIGHT + 40;
  });
  generated.forEach(({ owner, ...options }) => spawnProjectile(state, owner, { ...options, enemySpeedBalanced: true }));
}

function spawnZoneSpread(state, zone) {
  if (!zone.spreadCount || !zone.ownerId) return;
  const owner = state.enemies.find((candidate) => candidate.instanceId === zone.ownerId && !candidate.defeated);
  if (!owner) return;
  const baseAngle = angleBetween(owner, zone);
  const spread = (zone.spreadDegrees ?? 42) * Math.PI / 180;
  for (let index = 0; index < zone.spreadCount; index += 1) {
    const ratio = zone.spreadCount === 1 ? 0 : index / (zone.spreadCount - 1) - 0.5;
    spawnProjectile(state, owner, {
      x: zone.x,
      y: zone.y,
      angle: baseAngle + ratio * spread,
      speed: zone.spreadSpeed ?? 200,
      range: 180,
      damage: zone.spreadDamage ?? 0,
      source: 'enemy',
      colour: '#80e8ff',
    });
  }
}

function updateZones(state, dt) {
  state.zones = state.zones.filter((zone) => {
    zone.elapsed += dt;
    if (zone.continuous) {
      const withinBeam = distanceToSegment(
        state.actor,
        { x: zone.x, y: zone.y },
        { x: zone.targetX, y: zone.targetY },
      ) <= (zone.radius ?? 10) + state.actor.radius;
      if (withinBeam) applyPlayerDamage(state, (zone.damagePerSecond ?? 0) * dt, zone.source, 'ranged');
      return zone.elapsed < (zone.duration ?? 3);
    }
    if (!zone.triggered && zone.elapsed >= zone.delay) {
      zone.triggered = true;
      areaDamage(state, zone, zone.radius, zone.damage, zone.source, zone.damageType ?? 'area');
      applyKnockback(state, zone, zone.radius, zone.knockback);
      spawnZoneSpread(state, zone);
      if (zone.oxygenDrain && !state.infiniteResources) state.actor.oxygen = Math.max(0, state.actor.oxygen - zone.oxygenDrain);
    }
    return zone.elapsed < zone.delay + 0.7;
  });
}

function applyKnifeSideTrailDamage(state, weapon, start, end, primaryEnemyId = null) {
  const effect = weapon.effect;
  if (!effect?.sideTrailDamageMultiplier) return;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const fallbackAngle = state.actor.vx || state.actor.vy
    ? Math.atan2(state.actor.vy, state.actor.vx)
    : (state.actor.facing === 'left' ? Math.PI : 0);
  const angle = length > 0 ? Math.atan2(dy, dx) : fallbackAngle;
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  const offset = effect.sideTrailOffset ?? 22;
  const sideRadius = effect.sideTrailRadius ?? 18;
  const sideCount = Math.max(1, Math.round(effect.sideTrailCount ?? 2));
  for (let index = 0; index < sideCount; index += 1) {
    const side = (index - (sideCount - 1) / 2) * 2;
    const sideStart = { x: start.x + normal.x * offset * side, y: start.y + normal.y * offset * side };
    const sideEnd = { x: end.x + normal.x * offset * side, y: end.y + normal.y * offset * side };
    activeEnemies(state).forEach((enemy) => {
      if (enemy.instanceId === primaryEnemyId || (enemy.knifeSideHitCooldownUntil ?? 0) > state.time) return;
      if (distanceToSegment(enemy, sideStart, sideEnd) > enemy.radius + sideRadius) return;
      damageEnemy(state, enemy, weapon.damage * effect.sideTrailDamageMultiplier, `小刀 Lv.${weapon.level ?? state.build.weaponLevel} 側刃`);
      enemy.knifeSideHitCooldownUntil = state.time + 0.25;
    });
  }
}

function processKnifeMovementEffect(state, previousPosition) {
  const entry = getEquippedWeaponEntry(state, 'knife');
  if (state.aiming || !entry) return;
  const distance = distanceBetween(state.actor, previousPosition);
  if (distance < 1.5) return;
  const weapon = getWeaponStats('knife', entry.level);
  const cooldownKey = 'weapon:knife:visual';
  if ((state.actor.cooldowns[cooldownKey] ?? 0) > 0) return;
  state.actor.cooldowns[cooldownKey] = 0.12;
  const direction = knifeDirection(state);
  const length = Math.max(distance, weapon.range * 0.7);
  const start = { x: previousPosition.x, y: previousPosition.y };
  const end = { x: start.x + direction.x * length, y: start.y + direction.y * length };
  addKnifeMeteorEffects(state, weapon, start, end);
}

function processPlayerEnemyCollisions(state, previousPosition = state.actor) {
  const actor = state.actor;
  const speed = Math.hypot(actor.vx, actor.vy);
  const knifeEntry = getEquippedWeaponEntry(state, 'knife');
  if (speed < 18 || !knifeEntry) return;
  const weapon = getWeaponStats('knife', knifeEntry.level);
  const pathStart = previousPosition ?? actor;
  const pathEnd = { x: actor.x, y: actor.y };
  activeEnemies(state).forEach((enemy) => {
    const contact = distanceBetween(actor, enemy) <= actor.radius + enemy.radius;
    const pathHit = distanceToSegment(enemy, pathStart, pathEnd) <= actor.radius + enemy.radius + 8;
    if (!contact && !pathHit) return;
    if (state.time < (enemy.playerHitCooldownUntil ?? 0)) return;
    damageEnemy(state, enemy, weapon.damage, `移動路徑・${WEAPONS.knife.name}`);
    enemy.playerHitCooldownUntil = state.time + 0.28;
    const swipe = knifeSwipeSegment(state, { ...weapon, level: knifeEntry.level }, enemy);
    addKnifeMeteorEffects(state, weapon, swipe.start, swipe.end);
    if (weapon.effect?.sideTrailDamageMultiplier) applyKnifeSideTrailDamage(state, weapon, swipe.start, swipe.end, enemy.instanceId);
    addEffect(state, { type: 'playerHit', x: enemy.x, y: enemy.y, radius: enemy.radius + 12, duration: 0.28, colour: '#f6e66d' });
  });
}

function processStationaryKnifeArea(state) {
  const entry = getEquippedWeaponEntry(state, 'knife');
  if (state.aiming || !entry || entry.level < 3) return;
  if (Math.hypot(state.actor.vx, state.actor.vy) > 8) return;
  const weapon = getWeaponStats('knife', 3);
  const effect = weapon.effect;
  const radius = effect?.stationaryAreaRadius ?? 62;
  const cooldownKey = 'weapon:knife:stationaryArea';
  if ((state.actor.cooldowns[cooldownKey] ?? 0) > 0) return;
  state.actor.cooldowns[cooldownKey] = effect?.stationaryTickInterval ?? 0.34;
  let hitCount = 0;
  activeEnemies(state).forEach((enemy) => {
    if (distanceBetween(state.actor, enemy) > radius + enemy.radius) return;
    const damage = damageEnemy(
      state,
      enemy,
      weapon.damage * (effect?.stationaryDamageMultiplier ?? 0.55),
      '小刀 Lv.3 停止範圍',
    );
    if (damage > 0) hitCount += 1;
  });
  addEffect(state, {
    type: 'knifeArea',
    style: 'knifeArea',
    x: state.actor.x,
    y: state.actor.y,
    radius,
    duration: Math.min(0.38, effect?.stationaryTickInterval ?? 0.34),
    colour: effect.areaColour ?? effect.colour ?? '#b8f5ff',
    glowColour: effect.glowColour ?? effect.areaColour ?? '#b8f5ff',
    hitCount,
  });
}

function updateLinkedSupport(state, enemy, dt) {
  if (enemy.enemyId !== 'coralBackSeahorse') return;
  const skill = enemyDefinition(enemy).attacks.find((candidate) => candidate.id === 'lifeLink');
  const range = skill?.linkRange ?? 180;
  const previousTargets = new Set(enemy.linkedTargets ?? (enemy.linkedTarget ? [enemy.linkedTarget] : []));
  const targets = activeEnemies(state).filter((candidate) => candidate.instanceId !== enemy.instanceId
    && candidate.tier === 2
    && distanceBetween(enemy, candidate) <= range);
  const nextTargetIds = new Set(targets.map((candidate) => candidate.instanceId));
  previousTargets.forEach((targetId) => {
    if (nextTargetIds.has(targetId)) return;
    const target = state.enemies.find((candidate) => candidate.instanceId === targetId);
    if (target?.linkedProtection === enemy.instanceId) target.linkedProtection = null;
  });
  enemy.linkedTargets = [...nextTargetIds];
  enemy.linkedTarget = enemy.linkedTargets[0] ?? null;
  if (!targets.length) {
    enemy.linkedTarget = null;
    return;
  }
  let totalHeal = 0;
  targets.forEach((target) => {
    target.linkedProtection = enemy.instanceId;
    const heal = target.maxHealth * (skill?.healPerSecondRatio ?? 0.03) * dt;
    target.health = Math.min(target.maxHealth, target.health + heal);
    totalHeal += heal;
  });
  enemy.health = Math.min(enemy.maxHealth, enemy.health + totalHeal);
}

function updateEnemyMovement(state, enemy, dt) {
  const definition = enemyDefinition(enemy);
  if (!definition || definition.moveSpeed <= 0) return;
  const distance = distanceBetween(enemy, state.actor);
  const preferredDistance = getPreferredEnemyDistance(enemy);
  const speedMultiplier = enemy.activeEffects.speedForm ? 1.7 : 1;
  if (distance > preferredDistance) {
    const angle = angleBetween(enemy, state.actor);
    const speed = (enemy.moveSpeed ?? definition.moveSpeed) * speedMultiplier;
    enemy.vx = Math.cos(angle) * speed;
    enemy.vy = Math.sin(angle) * speed;
    enemy.x = clamp(enemy.x + enemy.vx * dt, 30, SANDBOX_WIDTH - 30);
    enemy.y = clamp(enemy.y + enemy.vy * dt, 30, SANDBOX_HEIGHT - 30);
    enemy.state = 'chasing';
    syncEnemyFacing(enemy);
  } else {
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.state = 'attacking';
  }
}

function attemptContactAttack(state, enemy) {
  const skill = getContactAttack(enemy);
  if (!skill || state.time < (enemy.contactAttackCooldownUntil ?? 0)) return;
  const distance = distanceBetween(enemy, state.actor);
  const reach = (skill.range ?? skill.radius ?? 44) + enemy.radius + state.actor.radius;
  if (distance > reach) return;
  const result = executeEnemySkill(state, enemy.instanceId, skill.id, { minimumCast: true });
  if (result.ok) enemy.contactAttackCooldownUntil = state.time + Math.max((skill.cooldown ?? 0) * enemyCooldownMultiplier(enemy), 0.38);
}

function updateBeaconAssault(state, enemy, dt) {
  if (!enemy.beacon) return false;
  enemy.beacon.remaining -= dt;
  enemy.state = 'casting';
  enemy.vx = 0;
  enemy.vy = 0;
  if (enemy.beacon.remaining > 1e-6) return true;
  const skillId = enemy.beacon.skillId;
  enemy.beacon = null;
  const result = executeEnemySkill(state, enemy.instanceId, skillId, { resolve: true, beaconResolve: true });
  if (result.ok) enemy.state = 'attacking';
  return true;
}

function updatePendingEnemySkill(state, enemy, dt) {
  if (!enemy.pendingSkill) return false;
  enemy.pendingSkill.remaining -= dt;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.state = 'casting';
  if (enemy.pendingSkill.remaining > 1e-6) return true;
  const { skillId } = enemy.pendingSkill;
  enemy.pendingSkill = null;
  enemy.hidden = false;
  const result = executeEnemySkill(state, enemy.instanceId, skillId, { resolve: true });
  if (skillId === 'callForHelp' && result.ok) enemy.rescueCompleted = true;
  if (result.ok) enemy.state = 'attacking';
  return true;
}

function updateJuvenileRescue(state, enemy) {
  if (enemy.enemyId !== 'juvenileSeahorseCaller' || enemy.rescueCompleted || enemy.pendingSkill) return false;
  const skill = enemyDefinition(enemy).attacks.find((candidate) => candidate.id === 'callForHelp');
  if (!skill || (enemy.cooldowns[skill.id] ?? 0) > 0) return false;
  if (distanceBetween(enemy, state.actor) > (skill.summonRadius ?? 190)) return false;
  const result = executeEnemySkill(state, enemy.instanceId, skill.id);
  return result.ok;
}

function updateEnemies(state, dt) {
  activeEnemies(state).forEach((enemy) => {
    const definition = enemyDefinition(enemy);
    Object.keys(enemy.cooldowns).forEach((key) => { enemy.cooldowns[key] = Math.max(0, enemy.cooldowns[key] - dt); });
    Object.keys(enemy.activeEffects).forEach((key) => {
      enemy.activeEffects[key] -= dt;
      if (enemy.activeEffects[key] <= 0) delete enemy.activeEffects[key];
    });
    const nowEnraged = isEnemyEnraged(enemy);
    if (nowEnraged && !enemy.enraged) logEvent(state, `${definition.name} 進入怒氣模式：攻擊冷卻縮短。`, 'warning');
    enemy.enraged = nowEnraged;
    if (enemy.animation !== 'idle' && state.time >= enemy.animationUntil) enemy.animation = 'idle';
    if (enemy.stunnedUntil && state.time < enemy.stunnedUntil) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = 'stunned';
      return;
    }
    if (enemy.stunnedUntil && state.time >= enemy.stunnedUntil) enemy.stunnedUntil = 0;
    if (updateBeaconAssault(state, enemy, dt)) return;
    if (updatePendingEnemySkill(state, enemy, dt)) return;
    if (updateJuvenileRescue(state, enemy)) return;
    updateLinkedSupport(state, enemy, dt);
    if (updateSuicideCharge(state, enemy, dt)) return;
    updateEnemyMovement(state, enemy, dt);
    attemptContactAttack(state, enemy);
    if (!state.autoCycle || state.time < (enemy.nextAutoAt ?? 0)) return;
    const distance = distanceBetween(enemy, state.actor);
    const ready = getNextReadySkill(enemy, distance);
    if (!ready) return;
    const result = executeEnemySkill(state, enemy.instanceId, ready.skill.id, { minimumCast: true });
    enemy.nextAutoSkillIndex = (ready.index + 1) % definition.attacks.length;
    // Contact attacks are also handled by collision cadence. Other skills use
    // a short scheduler gap so zero-cooldown skills remain readable in the lab.
    enemy.nextAutoAt = state.time + (result.ok ? Math.max(ready.skill.cooldown ?? 0, 0.35) : 0.2);
  });
}

function updatePlayerStatusEffects(state, dt) {
  const effects = state.actor.activeEffects ?? {};
  Object.entries(effects).forEach(([effect, remaining]) => {
    const next = Math.max(0, remaining - dt);
    if (effect === 'venom' && !state.invincible) applyPlayerDamage(state, 4 * dt, '毒刺持續傷害', 'venom');
    effects[effect] = next;
    if (next <= 0) delete effects[effect];
  });
  state.actor.stunnedUntil = Math.max(0, state.actor.stunnedUntil ?? 0);
}

export function stepSandbox(state, dt = SANDBOX_FIXED_STEP) {
  if (!state.running || state.awaitingUpgrade) return state;
  state.time += dt;
  state.actor.cooldowns ??= {};
  Object.keys(state.actor.cooldowns ?? {}).forEach((key) => {
    state.actor.cooldowns[key] = Math.max(0, state.actor.cooldowns[key] - dt);
  });
  updateLightMachineGunBurst(state);
  if (state.infiniteResources) {
    state.actor.oxygen = state.actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
    state.actor.energy = MAX_ENERGY;
  }
  updatePlayerStatusEffects(state, dt);
  if (state.actor.inInk && state.time >= (state.actor.inkUntil ?? 0)) state.actor.inInk = false;
  // Keep the sandbox invincibility switch as a wrapper around the official
  // damage gate; all movement, gravity, drag, boundary reflection, oxygen,
  // facing and launch momentum now come from the production step.
  if (state.invincible) state.actor.invulnerability = Math.max(state.actor.invulnerability ?? 0, dt + 0.01);
  const previousPosition = { x: state.actor.x, y: state.actor.y };
  const physicsEvents = state.aiming ? [] : stepPhysics({
    map: state.physicsMap,
    chapter: 'chapter1',
    actor: state.actor,
    dt,
    origin: state.physicsOrigin,
    bounds: state.physicsBounds,
    mutateMap: false,
    time: state.time,
    zeroGravity: state.zeroGravity,
  });
  if ((state.actor.stunnedUntil ?? 0) > state.time) {
    state.actor.vx = 0;
    state.actor.vy = 0;
  }
  physicsEvents
    .filter((event) => event.type === 'oxygenStarvation' || event.type === 'checkpoint')
    .forEach((event) => logEvent(state, event.message, event.type === 'oxygenStarvation' ? 'danger' : 'safe'));
  if (state.actor.health <= 0) {
    state.actor.health = MAX_HEALTH;
    state.actor.dead = false;
    state.actor.gameOver = false;
    state.actor.invulnerability = 1;
    logEvent(state, '沙盒自動重置玩家生命，方便繼續驗收。', 'safe');
  }
  if (state.infiniteResources) {
    state.actor.oxygen = state.actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
    state.actor.energy = MAX_ENERGY;
  }
  updateEnemies(state, dt);
  markKatanaMovement(state, previousPosition);
  processKatanaAutoAttack(state);
  processTridentAutoAttack(state, dt);
  processLightMachineGunAutoAttack(state);
  processKnifeMovementEffect(state, previousPosition);
  processPlayerEnemyCollisions(state, previousPosition);
  processStationaryKnifeArea(state);
  updateProjectiles(state, dt);
  collectSandboxExperience(state);
  updateZones(state, dt);
  state.effects = state.effects.filter((effect) => {
    effect.elapsed += dt;
    return effect.elapsed < effect.duration;
  });
  state.rules = state.rules.map((rule) => ({ ...rule, remaining: rule.remaining - dt })).filter((rule) => rule.remaining > 0);
  return state;
}

export function listSandboxSkills(enemyId) {
  return (ENEMY_DEFINITIONS[enemyId]?.attacks ?? []).map((skill) => ({ ...skill }));
}

export function getSandboxEnemyIds() {
  return [...ENEMY_ORDER];
}
