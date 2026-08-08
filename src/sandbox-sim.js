import {
  ENEMY_DEFINITIONS,
  ENEMY_ORDER,
  PASSIVE_ABILITIES,
  WEAPONS,
  createEnemyState,
  getWeaponStats,
} from './game-data.js';
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
  getActiveWeapon,
  getAvailableUpgradeCategories,
  getEnemyExperienceReward,
  getUpgradeChoices,
  setActiveWeapon,
} from './progression.js';

export const SANDBOX_WIDTH = 960;
export const SANDBOX_HEIGHT = 560;
export const SANDBOX_FIXED_STEP = FIXED_STEP;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const angleBetween = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
const unique = (values) => [...new Set(values)];

// The sandbox is a test harness, but its player must live in the same kind of
// L1 water field as the official play page. Keep a generous hidden map behind
// the 960x560 stage so the shared physics can resolve a Cell everywhere the
// pointer can reach without introducing an editor-specific gravity shortcut.
const SANDBOX_PHYSICS_ORIGIN = Object.freeze({ x: 18, y: 18 });
const SANDBOX_PHYSICS_BOUNDS = Object.freeze({ minX: 10, maxX: SANDBOX_WIDTH - 10, minY: 10, maxY: SANDBOX_HEIGHT - 10 });

function createSandboxPhysicsMap() {
  const map = createEmptyMap({ width: 52, height: 32 });
  Object.values(map.cells).forEach((cell) => {
    cell.gravityLevel = 'L1';
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

function enemyDefinition(enemy) {
  return ENEMY_DEFINITIONS[enemy.enemyId ?? enemy.id];
}

function setAnimation(enemy, skillId, time) {
  enemy.animation = skillId ?? 'idle';
  enemy.animationToken += 1;
  enemy.animationUntil = time + Math.max(0.8, enemyDefinition(enemy)?.attacks.find((skill) => skill.id === skillId)?.telegraph ?? 0.8);
}

function addEffect(state, effect) {
  state.effects.push({
    id: state.nextEffectId++,
    startedAt: state.time,
    elapsed: 0,
    duration: 0.8,
    ...effect,
  });
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
  enemy.animationToken += 1;
  enemy.animationUntil = state.time + (skill.detonationDelay ?? 1) + 0.4;
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
    const travel = enemyDefinition(enemy).moveSpeed * dt;
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
  const active = getActiveWeapon(state.progression);
  state.build = {
    weaponId: active.id,
    weaponLevel: active.level,
    weapons: state.progression.weapons.map((weapon) => ({ ...weapon })),
    activeWeaponSlot: state.progression.activeWeaponSlot,
    passives: state.progression.passives.map((passive) => ({ ...passive })),
  };
  setPlayerLoadout(state.actor, state.build.passives, active);
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
  const active = setActiveWeapon(state.progression, slotOrId);
  syncSandboxBuild(state);
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
    : applyDamage(state.actor, amount, source, damageType);
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
  if (split) {
    for (let index = 0; index < (split.childCount ?? 2); index += 1) {
      spawnSandboxEnemy(state, 'explodingLanternfish', {
        x: enemy.x + (index === 0 ? -26 : 26),
        y: enemy.y + 16,
      }, { health: split.childHealth ?? 28, moveSpeed: split.childSpeed ?? 122 });
    }
    logEvent(state, `${enemyDefinition(enemy).name} 觸發死亡分裂。`, 'warning');
  }
}

function spawnProjectile(state, source, options) {
  const angle = options.angle ?? angleBetween(source, state.actor);
  state.projectiles.push({
    id: state.nextProjectileId++,
    x: options.x ?? source.x,
    y: options.y ?? source.y,
    vx: Math.cos(angle) * options.speed,
    vy: Math.sin(angle) * options.speed,
    angle,
    source: options.source ?? 'enemy',
    ownerId: source.instanceId,
    damage: options.damage ?? 0,
    damageType: options.damageType ?? 'ranged',
    life: options.life ?? ((options.range ?? 360) / Math.max(options.speed, 1)),
    returnDelay: options.returnDelay ?? null,
    returning: false,
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
    });
  }
}

function areaDamage(state, origin, radius, damage, source, damageType = 'area') {
  if (distanceBetween(origin, state.actor) <= radius) applyPlayerDamage(state, damage, source, damageType);
  addEffect(state, { type: 'area', x: origin.x, y: origin.y, radius, duration: 0.55, colour: '#ffb86e' });
}

function summonFromSkill(state, enemy, skill) {
  const summonId = enemyDefinition(enemy).id === 'juvenileSeahorseCaller' ? 'explodingLanternfish' : 'juvenileSeahorseCaller';
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
  const state = {
    time: 0,
    running: true,
    autoCycle: false,
    invincible: false,
    infiniteResources: false,
    aiming: false,
    aimPoint: null,
    selectedEnemyInstanceId: null,
    selectedSkillId: null,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextEffectId: 1,
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
    vx: 0,
    vy: 0,
    radius: clamp(Math.sqrt(definition.maxHealth) * 1.15, 18, 48),
    animation: 'idle',
    animationToken: 0,
    animationUntil: 0,
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
  state.selectedEnemyInstanceId = null;
  state.selectedSkillId = null;
  logEvent(state, '已清除沙盒敵人與場上技能效果。');
}

export function setSandboxBuild(state, { weaponId = 'knife', weaponLevel = 1, passives = [] } = {}) {
  const validWeaponId = WEAPONS[weaponId] ? weaponId : 'knife';
  const validLevel = clamp(Math.round(Number(weaponLevel) || 1), 1, WEAPONS[validWeaponId].maxLevel);
  const validPassives = unique(passives
    .filter((ability) => PASSIVE_ABILITIES[ability.id] && Number(ability.level) > 0)
    .map((ability) => ({ id: ability.id, level: clamp(Math.round(Number(ability.level)), 1, PASSIVE_ABILITIES[ability.id].maxLevel) })));
  state.progression.weapons = [{ id: 'knife', level: weaponId === 'knife' ? validLevel : 1 }];
  if (weaponId !== 'knife') state.progression.weapons.push({ id: validWeaponId, level: validLevel });
  state.progression.passives = validPassives;
  state.progression.activeWeaponSlot = weaponId === 'knife' ? 0 : 1;
  state.progression.pendingLevelUps = 0;
  state.awaitingUpgrade = false;
  state.upgradeCategory = null;
  state.upgradeCategories = [];
  state.upgradeChoices = [];
  syncSandboxBuild(state);
  state.actor.health = MAX_HEALTH;
  state.actor.oxygen = MAX_OXYGEN;
  state.actor.energy = MAX_ENERGY;
  return state.build;
}

export function resetSandboxPlayer(state) {
  state.actor.x = 150;
  state.actor.y = SANDBOX_HEIGHT / 2;
  state.actor.vx = 0;
  state.actor.vy = 0;
  state.actor.health = MAX_HEALTH;
  state.actor.oxygen = MAX_OXYGEN;
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
  state.aiming = false;
  state.aimPoint = null;
  logEvent(state, '玩家已重置。', 'safe');
}

export function beginSandboxAim(state, point) {
  if (!point || state.awaitingUpgrade || state.actor.attached || state.actor.dead) return { ok: false, reason: state.awaitingUpgrade ? 'upgrade' : 'unavailable' };
  state.aiming = true;
  state.aimPoint = { x: point.x, y: point.y };
  state.actor.vx = 0;
  state.actor.vy = 0;
  return { ok: true };
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
    state.actor.oxygen = MAX_OXYGEN;
  }
  const result = { ok: launch.launched, ...launch };
  if (launch.launched) {
    addEffect(state, { type: 'launch', x: state.actor.x, y: state.actor.y, radius: 22, duration: 0.35, colour: '#f6e66d' });
    logEvent(state, `玩家彈射：距離 ${Math.round(launch.distance)}、初速 ${Math.round(launch.speed)}；正式 L1 物理已接管。`, 'safe');
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

export function executeEnemySkill(state, instanceId = state.selectedEnemyInstanceId, skillId = state.selectedSkillId) {
  const enemy = state.enemies.find((candidate) => candidate.instanceId === instanceId && !candidate.defeated);
  if (!enemy) return { ok: false, reason: 'enemy' };
  const definition = enemyDefinition(enemy);
  const skill = definition.attacks.find((candidate) => candidate.id === skillId) ?? definition.attacks[0];
  if (!skill) return { ok: false, reason: 'skill' };
  if (enemy.suicideCharge) return { ok: false, reason: 'busy' };
  if ((enemy.cooldowns[skill.id] ?? 0) > 0) {
    logEvent(state, `${skill.name} 冷卻中：${enemy.cooldowns[skill.id].toFixed(1)} 秒。`, 'warning');
    return { ok: false, reason: 'cooldown' };
  }
  enemy.cooldowns[skill.id] = skill.cooldown ?? 0;
  setAnimation(enemy, skill.id, state.time);
  const distance = distanceBetween(enemy, state.actor);
  const source = `${definition.name}・${skill.name}`;
  logEvent(state, `${source} 已啟動。`);

  switch (skill.type) {
    case 'suicideCharge':
      beginSuicideCharge(state, enemy, skill);
      break;
    case 'contact':
      if (distance <= (skill.radius ?? 42)) areaDamage(state, enemy, skill.radius ?? 42, skill.damage ?? 0, source);
      break;
    case 'melee':
      if (distance <= (skill.range ?? 48)) applyPlayerDamage(state, skill.damage ?? 0, source, 'melee');
      addEffect(state, { type: 'slash', x: enemy.x, y: enemy.y, radius: skill.range ?? 48, duration: 0.4, angle: angleBetween(enemy, state.actor), colour: '#ff8d8d' });
      break;
    case 'dash':
    case 'teleportMelee': {
      const angle = angleBetween(enemy, state.actor);
      enemy.x = clamp(state.actor.x - Math.cos(angle) * 28, 32, SANDBOX_WIDTH - 32);
      enemy.y = clamp(state.actor.y - Math.sin(angle) * 28, 32, SANDBOX_HEIGHT - 32);
      if (distance <= (skill.range ?? 150)) applyPlayerDamage(state, skill.damage ?? 0, source, 'melee');
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
      state.zones.push({ x: state.actor.x, y: state.actor.y, radius: skill.radius ?? 56, delay: skill.telegraph ?? 1, damage: skill.damage ?? 0, source, elapsed: 0, triggered: false });
      addEffect(state, { type: 'telegraph', x: state.actor.x, y: state.actor.y, radius: skill.radius ?? 56, duration: skill.telegraph ?? 1, colour: '#ffb86e' });
      break;
    case 'areaStun':
    case 'gravityField':
    case 'destroyableGravityOrb':
      areaDamage(state, enemy, skill.radius ?? 100, skill.damage ?? 0, source);
      state.rules.push({ label: skill.type, remaining: skill.duration ?? 2, multiplier: skill.gravityMultiplier ?? 1 });
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
      enemy.linkedTarget = activeEnemies(state).find((candidate) => candidate.instanceId !== enemy.instanceId && distanceBetween(enemy, candidate) <= (skill.linkRange ?? 180))?.instanceId ?? null;
      addEffect(state, { type: 'link', x: enemy.x, y: enemy.y, radius: skill.linkRange ?? 180, duration: 1.2, colour: '#ff9ae6' });
      break;
    case 'reflectedBeam':
    case 'reflectedBeamSplit':
      addEffect(state, { type: 'beam', x: enemy.x, y: enemy.y, targetX: state.actor.x, targetY: state.actor.y, radius: 10, duration: skill.duration ?? 3, colour: '#bca7ff' });
      applyPlayerDamage(state, (skill.damagePerSecond ?? 24) * 0.35, source, 'ranged');
      break;
    case 'split':
      for (let index = 0; index < (skill.childCount ?? 2); index += 1) spawnSandboxEnemy(state, 'explodingLanternfish', { x: enemy.x + index * 24 - 12, y: enemy.y + 20 });
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

export function playerAttack(state) {
  if (state.awaitingUpgrade) return { ok: false, reason: 'upgrade' };
  const weaponDefinition = WEAPONS[state.build.weaponId] ?? WEAPONS.knife;
  const weapon = { ...weaponDefinition, ...getWeaponStats(state.build.weaponId, state.build.weaponLevel) };
  state.actor.cooldowns ??= {};
  const cooldownKey = `weapon:${weaponDefinition.id}`;
  const cooldownRemaining = state.actor.cooldowns[cooldownKey] ?? 0;
  if (cooldownRemaining > 0) {
    logEvent(state, `${weaponDefinition.name} 冷卻中：${cooldownRemaining.toFixed(1)} 秒。`, 'warning');
    return { ok: false, reason: 'cooldown', remaining: cooldownRemaining };
  }
  const target = state.enemies.find((enemy) => enemy.instanceId === state.selectedEnemyInstanceId && !enemy.defeated) ?? activeEnemies(state)[0];
  if (!target) {
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
    hit = distanceBetween(state.actor, target) <= weapon.range;
    if (hit) damageEnemy(state, target, weapon.damage, weaponDefinition.name);
    addEffect(state, { type: 'playerSlash', x: state.actor.x, y: state.actor.y, radius: weapon.range, duration: 0.25, angle: angleBetween(state.actor, target), colour: '#f6e66d' });
    if (!hit) logEvent(state, `${weaponDefinition.name}：目標不在 ${Math.round(weapon.range)} px 近戰距離內。`, 'warning');
  } else {
    const count = weapon.projectileCount ?? 1;
    const spread = ((weapon.spreadDegrees ?? 0) * Math.PI) / 180;
    const angle = angleBetween(state.actor, target);
    for (let index = 0; index < count; index += 1) {
      const ratio = count === 1 ? 0 : index / (count - 1) - 0.5;
      spawnProjectile(state, state.actor, { angle: angle + ratio * spread, speed: weapon.projectileSpeed, range: weapon.range, damage: weapon.damage, source: 'player', damageType: 'player', colour: '#f6e66d' });
    }
  }
  state.actor.cooldowns[cooldownKey] = weapon.cooldown ?? 0;
  logEvent(state, `玩家使用 ${weaponDefinition.name} Lv.${state.build.weaponLevel}。`, 'safe');
  return { ok: true, hit };
}

function updateProjectiles(state, dt) {
  state.projectiles = state.projectiles.filter((projectile) => {
    projectile.life -= dt;
    if (projectile.life <= 0) return false;
    if (projectile.returnDelay != null && projectile.life <= projectile.returnDelay) projectile.returning = true;
    const target = projectile.returning && projectile.source === 'enemy' ? state.enemies.find((enemy) => enemy.instanceId === projectile.ownerId) : state.actor;
    if (target && projectile.returning) {
      const angle = angleBetween(projectile, target);
      projectile.vx = Math.cos(angle) * Math.hypot(projectile.vx, projectile.vy);
      projectile.vy = Math.sin(angle) * Math.hypot(projectile.vx, projectile.vy);
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.source === 'player') {
      const hit = activeEnemies(state).find((enemy) => distanceBetween(projectile, enemy) <= enemy.radius + projectile.radius);
      if (hit) {
        damageEnemy(state, hit, projectile.damage, '玩家投射物');
        return false;
      }
    } else if (distanceBetween(projectile, state.actor) <= state.actor.radius + projectile.radius) {
      applyPlayerDamage(state, projectile.damage, '敵人投射物', projectile.damageType);
      return false;
    }
    return projectile.x > -40 && projectile.x < SANDBOX_WIDTH + 40 && projectile.y > -40 && projectile.y < SANDBOX_HEIGHT + 40;
  });
}

function updateZones(state, dt) {
  state.zones = state.zones.filter((zone) => {
    zone.elapsed += dt;
    if (!zone.triggered && zone.elapsed >= zone.delay) {
      zone.triggered = true;
      areaDamage(state, zone, zone.radius, zone.damage, zone.source);
      if (zone.oxygenDrain && !state.infiniteResources) state.actor.oxygen = Math.max(0, state.actor.oxygen - zone.oxygenDrain);
    }
    return zone.elapsed < zone.delay + 0.7;
  });
}

function processPlayerEnemyCollisions(state) {
  const actor = state.actor;
  const speed = Math.hypot(actor.vx, actor.vy);
  if (speed < 18) return;
  const weapon = getWeaponStats(state.build.weaponId, state.build.weaponLevel);
  activeEnemies(state).forEach((enemy) => {
    if (distanceBetween(actor, enemy) > actor.radius + enemy.radius) return;
    if (state.time < (enemy.playerHitCooldownUntil ?? 0)) return;
    damageEnemy(state, enemy, weapon.damage, `彈射撞擊・${WEAPONS[state.build.weaponId].name}`);
    enemy.playerHitCooldownUntil = state.time + 0.28;
    if (state.build.weaponId === 'knife') {
      addEffect(state, { type: 'playerHit', x: enemy.x, y: enemy.y, radius: enemy.radius + 12, duration: 0.28, colour: '#f6e66d' });
      return;
    }
    const length = distanceBetween(actor, enemy) || 1;
    const normalX = (actor.x - enemy.x) / length;
    const normalY = (actor.y - enemy.y) / length;
    const normalVelocity = actor.vx * normalX + actor.vy * normalY;
    actor.vx = (actor.vx - 2 * normalVelocity * normalX) * 0.62;
    actor.vy = (actor.vy - 2 * normalVelocity * normalY) * 0.62;
    actor.x = enemy.x + normalX * (actor.radius + enemy.radius + 1);
    actor.y = enemy.y + normalY * (actor.radius + enemy.radius + 1);
    addEffect(state, { type: 'playerHit', x: enemy.x, y: enemy.y, radius: enemy.radius + 12, duration: 0.28, colour: '#f6e66d' });
  });
}

function updateEnemies(state, dt) {
  activeEnemies(state).forEach((enemy) => {
    const definition = enemyDefinition(enemy);
    Object.keys(enemy.cooldowns).forEach((key) => { enemy.cooldowns[key] = Math.max(0, enemy.cooldowns[key] - dt); });
    Object.keys(enemy.activeEffects).forEach((key) => {
      enemy.activeEffects[key] -= dt;
      if (enemy.activeEffects[key] <= 0) delete enemy.activeEffects[key];
    });
    if (enemy.animation !== 'idle' && state.time >= enemy.animationUntil) enemy.animation = 'idle';
    if (updateSuicideCharge(state, enemy, dt)) return;
    if (definition.moveSpeed > 0) {
      const distance = distanceBetween(enemy, state.actor);
      if (distance > 100) {
        const angle = angleBetween(enemy, state.actor);
        const speedMultiplier = enemy.activeEffects.speedForm ? 1.7 : 1;
        enemy.x = clamp(enemy.x + Math.cos(angle) * definition.moveSpeed * speedMultiplier * dt, 30, SANDBOX_WIDTH - 30);
        enemy.y = clamp(enemy.y + Math.sin(angle) * definition.moveSpeed * speedMultiplier * dt, 30, SANDBOX_HEIGHT - 30);
      }
    }
    if (!state.autoCycle) return;
    const skill = definition.attacks.find((candidate) => (enemy.cooldowns[candidate.id] ?? 0) <= 0);
    if (skill && state.time >= (enemy.nextAutoAt ?? 0)) {
      executeEnemySkill(state, enemy.instanceId, skill.id);
      // Contact skills often have no authored cooldown because they are tied
      // to collision state. The sandbox still needs a readable cadence rather
      // than firing them once every simulation frame.
      enemy.nextAutoAt = state.time + Math.max(skill.cooldown ?? 0, 1.2);
    }
  });
}

export function stepSandbox(state, dt = SANDBOX_FIXED_STEP) {
  if (!state.running || state.awaitingUpgrade) return state;
  state.time += dt;
  state.actor.cooldowns ??= {};
  Object.keys(state.actor.cooldowns ?? {}).forEach((key) => {
    state.actor.cooldowns[key] = Math.max(0, state.actor.cooldowns[key] - dt);
  });
  if (state.infiniteResources) {
    state.actor.oxygen = MAX_OXYGEN;
    state.actor.energy = MAX_ENERGY;
    state.actor.health = MAX_HEALTH;
  }
  // Keep the sandbox invincibility switch as a wrapper around the official
  // damage gate; all movement, gravity, drag, boundary reflection, oxygen,
  // facing and launch momentum now come from the production step.
  if (state.invincible) state.actor.invulnerability = Math.max(state.actor.invulnerability ?? 0, dt + 0.01);
  const physicsEvents = state.aiming ? [] : stepPhysics({
    map: state.physicsMap,
    chapter: 'chapter1',
    actor: state.actor,
    dt,
    origin: state.physicsOrigin,
    bounds: state.physicsBounds,
    mutateMap: false,
    time: state.time,
  });
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
    state.actor.oxygen = MAX_OXYGEN;
    state.actor.energy = MAX_ENERGY;
    state.actor.health = MAX_HEALTH;
  }
  updateEnemies(state, dt);
  processPlayerEnemyCollisions(state);
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
