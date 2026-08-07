import {
  DIRECTIONS,
  GRAVITY_LEVELS,
  allMapEdges,
  findCellContainingPoint,
  getActiveCell,
  getDirectionVector,
  getEdgeBetween,
  getHexCenter,
  neighborKey,
  patchCell,
} from './map-model.js';
import {
  getPlayerDerivedStats,
  RESOURCE_LIMITS,
} from './game-data.js';

export const FIXED_STEP = 1 / 60;
export const SIMULATION_SPEED_SCALE = 0.1;
export const GRAVITY_SCALE = 0.5;
export const GAME_GRAVITY = 230 * SIMULATION_SPEED_SCALE * GRAVITY_SCALE;
export const MAX_SPEED = 560 * SIMULATION_SPEED_SCALE;
export const MAX_HEALTH = RESOURCE_LIMITS.health;
export const MAX_OXYGEN = RESOURCE_LIMITS.oxygen;
export const MAX_ENERGY = RESOURCE_LIMITS.energy;
export const MAX_LIVES = RESOURCE_LIMITS.lives;
const LAUNCH_SPEED_PER_PIXEL = 2.9 * SIMULATION_SPEED_SCALE;
const LAUNCH_OXYGEN_BASE_COST = 2;
const LAUNCH_OXYGEN_COST_PER_PIXEL = 0.055;
const LAUNCH_ENERGY_BASE_COST = 3;
const LAUNCH_ENERGY_COST_PER_PIXEL = 0.08;
const AIM_ENERGY_PER_SECOND = 9;
const IDLE_ENERGY_RECOVERY_PER_SECOND = 8;
const SEAWEED_ENERGY_RECOVERY_PER_SECOND = 12;
const OXYGEN_DRAIN_PER_SECOND = 0.15;
const CURRENT_ACCELERATION = 74 * SIMULATION_SPEED_SCALE;
const WEIGHT_STONE_BREAK_SPEED = 310 * SIMULATION_SPEED_SCALE;
const HORIZONTAL_WATER_DRAG = 0.96;
const VERTICAL_WATER_DRAG = 0.998;
const HORIZONTAL_STOP_SPEED = 0.15;
export const WORLD_BOUNDS = Object.freeze({ minX: 24, maxX: 976, minY: 24, maxY: 656 });

function maxOxygenFor(actor) {
  return actor.derivedStats?.maxOxygen ?? MAX_OXYGEN;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function reflect(velocity, normal, multiplier = 0.72) {
  const dot = velocity.x * normal.x + velocity.y * normal.y;
  return {
    x: (velocity.x - 2 * dot * normal.x) * multiplier,
    y: (velocity.y - 2 * dot * normal.y) * multiplier,
  };
}

function unitVector(from, to) {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function isOnCooldown(actor, key) {
  return (actor.cooldowns[key] ?? 0) > 0;
}

function addEvent(events, type, message) {
  events.push({ type, message });
}

function launchDistance(actor, pointer) {
  return clamp(Math.hypot(actor.x - pointer.x, actor.y - pointer.y), 0, 170);
}

export function getLaunchCosts(distance, actor = null) {
  const oxygenMultiplier = actor?.derivedStats?.launchOxygenCostMultiplier ?? 1;
  const energyMultiplier = actor?.derivedStats?.launchEnergyCostMultiplier ?? 1;
  return {
    oxygen: (LAUNCH_OXYGEN_BASE_COST + distance * LAUNCH_OXYGEN_COST_PER_PIXEL) * oxygenMultiplier,
    energy: (LAUNCH_ENERGY_BASE_COST + distance * LAUNCH_ENERGY_COST_PER_PIXEL) * energyMultiplier,
  };
}

export function drainAimEnergy(actor, dt = FIXED_STEP) {
  const multiplier = actor.derivedStats?.aimEnergyCostMultiplier ?? 1;
  const used = Math.min(actor.energy, AIM_ENERGY_PER_SECOND * multiplier * dt);
  actor.energy = Math.max(0, actor.energy - used);
  return used;
}

export function createTestActor(position = { x: 180, y: 180 }) {
  const abilities = [];
  return {
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    radius: 6,
    health: MAX_HEALTH,
    oxygen: MAX_OXYGEN,
    energy: MAX_ENERGY,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    abilities,
    activeWeapon: { id: 'knife', level: 1 },
    derivedStats: getPlayerDerivedStats(abilities, MAX_OXYGEN),
    dead: false,
    gameOver: false,
    invulnerability: 0,
    shieldTimer: 0,
    shieldCooldown: 0,
    attached: false,
    gravityImmunity: 0,
    safe: false,
    inInk: false,
    spawn: { ...position },
    cooldowns: {},
  };
}

export function findPlayerStart(map, chapter, origin) {
  for (const [key, baseCell] of Object.entries(map.cells)) {
    const cell = getActiveCell(map, key, chapter);
    if (cell.terrain !== 'blocked' && cell.actors.some((actor) => actor.kind === 'playerStart')) {
      return getHexCenter(cell, origin);
    }
  }
  const first = getActiveCell(map, '0,0', chapter) ?? Object.values(map.cells)[0];
  return getHexCenter(first, origin);
}

export function resetTestActor(actor, map, chapter, origin) {
  const spawn = findPlayerStart(map, chapter, origin);
  const lives = Number.isFinite(actor.lives) ? actor.lives : MAX_LIVES;
  const abilities = actor.abilities ?? [];
  const weapon = actor.activeWeapon ?? { id: 'knife', level: 1 };
  Object.assign(actor, createTestActor(spawn));
  actor.lives = lives;
  setPlayerLoadout(actor, abilities, weapon);
  if (lives <= 0) {
    actor.health = 0;
    actor.dead = true;
    actor.gameOver = true;
  }
  return actor;
}

export function startTestRun(actor, map, chapter, origin) {
  const spawn = findPlayerStart(map, chapter, origin);
  Object.assign(actor, createTestActor(spawn));
  return actor;
}

export function setPlayerLoadout(actor, abilities = [], weapon = { id: 'knife', level: 1 }) {
  actor.abilities = abilities.map((ability) => ({ ...ability }));
  actor.activeWeapon = { ...weapon };
  actor.derivedStats = getPlayerDerivedStats(actor.abilities, actor.oxygen);
  return actor.derivedStats;
}

export function applyDamage(actor, amount, source = 'unknown', damageType = 'generic') {
  if (actor.gameOver || actor.dead || actor.invulnerability > 0 || actor.shieldTimer > 0) return { applied: 0, source, damageType, blocked: true };
  let multiplier = 1;
  if (damageType === 'ranged') multiplier *= actor.derivedStats?.rangedDamageTakenMultiplier ?? 1;
  if (actor.oxygen < MAX_OXYGEN * 0.5) multiplier *= actor.derivedStats?.lowOxygenDamageTakenMultiplier ?? 1;
  const damage = Math.max(0, amount * multiplier);
  actor.health = Math.max(0, actor.health - damage);
  const threshold = (actor.derivedStats?.shieldThresholdRatio ?? 0) * MAX_HEALTH;
  if (threshold > 0 && damage >= threshold && actor.shieldCooldown <= 0) {
    actor.shieldTimer = actor.derivedStats.shieldDuration;
    actor.shieldCooldown = actor.derivedStats.shieldCooldown;
  }
  return { applied: damage, source, damageType, blocked: false, defeated: actor.health <= 0 };
}

export function recoverPlayerResource(actor, resource, amount, source = 'unknown') {
  const limits = { health: MAX_HEALTH, oxygen: maxOxygenFor(actor), energy: MAX_ENERGY };
  const maximum = limits[resource];
  if (!maximum || amount <= 0) return { recovered: 0, source, resource };
  const before = actor[resource];
  actor[resource] = Math.min(maximum, before + amount);
  const recovered = actor[resource] - before;
  if ((resource === 'oxygen' || resource === 'energy') && recovered > 0) {
    actor.health = Math.min(MAX_HEALTH, actor.health + (recovered / maximum) * MAX_HEALTH * (actor.derivedStats?.resourceRecoveryHealthRatio ?? 0));
  }
  return { recovered, source, resource };
}

export function applyEnemyDefeatRewards(actor) {
  const energy = recoverPlayerResource(actor, 'energy', MAX_ENERGY * (actor.derivedStats?.killEnergyRecoveryRatio ?? 0), 'enemyDefeat');
  const oxygen = recoverPlayerResource(actor, 'oxygen', maxOxygenFor(actor) * (actor.derivedStats?.killOxygenRecoveryRatio ?? 0), 'enemyDefeat');
  return { energy, oxygen };
}

export function registerPlayerDeath(actor, cause = 'damage') {
  if (actor.dead || actor.gameOver) return { livesRemaining: actor.lives, gameOver: actor.gameOver, cause };
  actor.dead = true;
  actor.health = 0;
  actor.lives = Math.max(0, actor.lives - 1);
  actor.deathCause = cause;
  actor.gameOver = actor.lives <= 0;
  return { livesRemaining: actor.lives, gameOver: actor.gameOver, cause };
}

export function respawnActor(actor, spawn) {
  if (actor.gameOver) return false;
  actor.x = spawn.x;
  actor.y = spawn.y;
  actor.vx = 0;
  actor.vy = 0;
  actor.health = MAX_HEALTH;
  actor.energy = MAX_ENERGY;
  actor.derivedStats = getPlayerDerivedStats(actor.abilities, actor.oxygen);
  actor.oxygen = actor.derivedStats.maxOxygen;
  actor.dead = false;
  actor.invulnerability = 1;
  actor.shieldTimer = 0;
  actor.shieldCooldown = 0;
  return true;
}

export function launchActor(actor, pointer) {
  if (actor.attached) return { launched: false, reason: 'attached' };
  const distance = launchDistance(actor, pointer);
  if (distance < 5) return { launched: false, reason: 'tooClose' };
  const costs = getLaunchCosts(distance, actor);
  if (actor.oxygen < costs.oxygen) return { launched: false, reason: 'oxygen', costs };
  if (actor.energy < costs.energy) return { launched: false, reason: 'energy', costs };
  const direction = unitVector(pointer, actor);
  const speed = LAUNCH_SPEED_PER_PIXEL * distance;
  actor.vx = direction.x * speed;
  actor.vy = direction.y * speed;
  actor.oxygen = clamp(actor.oxygen - costs.oxygen, 0, maxOxygenFor(actor));
  actor.energy = clamp(actor.energy - costs.energy, 0, MAX_ENERGY);
  return { launched: true, speed, distance, costs };
}

export function toggleSeaweedAttachment(actor, map, chapter, origin) {
  if (actor.attached) {
    actor.attached = false;
    return { changed: true, attached: false, message: '已離開水草，重力重新生效。' };
  }
  for (const [key] of Object.entries(map.cells)) {
    const cell = getActiveCell(map, key, chapter);
    if (!cell.objects.some((object) => object.kind === 'seaweed')) continue;
    const position = getHexCenter(cell, origin);
    if (Math.hypot(actor.x - position.x, actor.y - position.y) <= 42) {
      actor.x = position.x;
      actor.y = position.y;
      actor.vx = 0;
      actor.vy = 0;
      actor.attached = true;
      return { changed: true, attached: true, message: '已附著水草：暫停重力並回復體力。' };
    }
  }
  return { changed: false, attached: false, message: '附近沒有可附著的水草。' };
}

function applyCurrentAcceleration(map, cellKey, chapter) {
  if (!cellKey) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  DIRECTIONS.forEach((_, directionIndex) => {
    const adjacent = neighborKey(cellKey, directionIndex);
    if (!map.cells[adjacent]) return;
    const edge = getEdgeBetween(map, cellKey, adjacent, chapter);
    if (edge.type !== 'current' || edge.currentStrength <= 0) return;
    const vector = getDirectionVector(edge.currentDirection);
    const magnitude = CURRENT_ACCELERATION * edge.currentStrength;
    x += vector.x * magnitude;
    y += vector.y * magnitude;
  });
  return { x, y };
}

function processBoundary(actor, bounds, events) {
  let collided = false;
  if (actor.x - actor.radius < bounds.minX) {
    actor.x = bounds.minX + actor.radius;
    actor.vx = Math.abs(actor.vx) * 0.72;
    collided = true;
  }
  if (actor.x + actor.radius > bounds.maxX) {
    actor.x = bounds.maxX - actor.radius;
    actor.vx = -Math.abs(actor.vx) * 0.72;
    collided = true;
  }
  if (actor.y - actor.radius < bounds.minY) {
    actor.y = bounds.minY + actor.radius;
    actor.vy = Math.abs(actor.vy) * 0.72;
    collided = true;
  }
  if (actor.y + actor.radius > bounds.maxY) {
    actor.y = bounds.maxY - actor.radius;
    actor.vy = -Math.abs(actor.vy) * 0.72;
    collided = true;
  }
  if (collided) addEvent(events, 'wall', '碰到測試區邊界：速度已反彈。');
}

function processCrossedEdge(map, actor, fromKey, toKey, chapter, origin, events) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const edge = getEdgeBetween(map, fromKey, toKey, chapter);
  if (!edge.blocksPassage && edge.type !== 'springJelly') return;
  const from = getHexCenter(getActiveCell(map, fromKey, chapter), origin);
  const to = getHexCenter(getActiveCell(map, toKey, chapter), origin);
  const normal = unitVector(from, to);
  const multiplier = edge.type === 'springJelly' ? 1.08 : 0.68;
  const reflected = reflect({ x: actor.vx, y: actor.vy }, normal, multiplier);
  actor.vx = reflected.x;
  actor.vy = reflected.y;
  actor.x = from.x + normal.x * 8;
  actor.y = from.y + normal.y * 8;
  if (edge.type === 'springJelly') addEvent(events, 'springJelly', '彈簧水母：依入射角反射並加速。');
  else if (edge.type === 'spike') {
    const damage = applyDamage(actor, 20, 'spike', 'contact');
    addEvent(events, 'spike', `尖刺阻擋：反彈並受到 ${Math.round(damage.applied)} 點傷害。`);
  } else addEvent(events, 'barrier', '障礙 Edge 阻擋：速度已反彈。');
}

function processCellObjects(map, actor, chapter, origin, events, mutateMap) {
  actor.safe = false;
  actor.inInk = false;
  const current = findCellContainingPoint(map, actor, chapter, origin);
  if (!current) return;
  const cell = current.cell;
  actor.safe = cell.overlays.includes('coral');
  actor.inInk = cell.overlays.includes('ink');
  if (cell.overlays.includes('coral')) addEvent(events, 'coral', '珊瑚安全區：玩家處於安全狀態。');
  if (cell.overlays.includes('ink')) addEvent(events, 'ink', '墨水區：預覽視野受限。');

  Object.entries(map.cells).forEach(([key]) => {
    const objectCell = getActiveCell(map, key, chapter);
    const position = getHexCenter(objectCell, origin);
    const distance = Math.hypot(actor.x - position.x, actor.y - position.y);
    if (distance > actor.radius + 22) return;

    objectCell.objects.forEach((object) => {
      if (object.kind === 'mine' && !isOnCooldown(actor, `mine:${key}`)) {
        const normal = unitVector(position, actor);
        const bounced = reflect({ x: actor.vx, y: actor.vy }, normal, 1.03);
        actor.vx = bounced.x;
        actor.vy = bounced.y;
        const damage = actor.safe ? { applied: 0 } : applyDamage(actor, 24, 'deepSeaMine', 'contact');
        actor.cooldowns[`mine:${key}`] = 0.5;
        addEvent(events, 'mine', actor.safe ? '深海地雷：珊瑚安全區抵銷了傷害。' : `深海地雷：強力反彈並受到 ${Math.round(damage.applied)} 點傷害。`);
      }
      if (object.kind === 'weightStone' && !isOnCooldown(actor, `stone:${key}`)) {
        const impact = Math.hypot(actor.vx, actor.vy);
        if (impact >= WEIGHT_STONE_BREAK_SPEED && mutateMap) {
          const editable = getActiveCell(map, key, chapter);
          patchCell(map, key, { objects: editable.objects.filter((candidate) => candidate !== object) }, chapter);
          actor.cooldowns[`stone:${key}`] = 0.5;
          addEvent(events, 'weightStone', '重石已被足夠的撞擊力擊碎。');
        } else {
          const normal = unitVector(position, actor);
          const bounced = reflect({ x: actor.vx, y: actor.vy }, normal, 0.55);
          actor.vx = bounced.x;
          actor.vy = Math.abs(bounced.y) + 4;
          actor.cooldowns[`stone:${key}`] = 0.35;
          addEvent(events, 'weightStone', '重石壓下玩家：撞擊力不足以擊碎。');
        }
      }
      if (object.kind === 'oxygen') {
        actor.oxygen = maxOxygenFor(actor);
        addEvent(events, 'oxygen', '氧氣來源：氧氣已補滿。');
      }
      if (object.kind === 'torricelli') {
        actor.oxygen = Math.min(maxOxygenFor(actor), actor.oxygen + 20);
        addEvent(events, 'torricelli', '托里切利空間：獲得短暫氧氣補給。');
      }
      if (object.kind === 'bubble' && actor.gravityImmunity <= 0) {
        actor.gravityImmunity = 2.5;
        addEvent(events, 'bubble', '光合作用氣泡：暫時免疫水域重力，保留現有速度。');
      }
      if (object.kind === 'checkpoint') {
        actor.spawn = { x: position.x, y: position.y };
        actor.health = MAX_HEALTH;
        actor.oxygen = maxOxygenFor(actor);
        actor.energy = MAX_ENERGY;
        addEvent(events, 'checkpoint', 'Checkpoint：已更新重生點並回滿資源。');
      }
    });
  });
}

export function stepPhysics({ map, chapter = 'chapter1', actor, dt = FIXED_STEP, origin, bounds = WORLD_BOUNDS, mutateMap = true }) {
  const events = [];
  Object.keys(actor.cooldowns).forEach((key) => {
    actor.cooldowns[key] = Math.max(0, actor.cooldowns[key] - dt);
  });
  actor.gravityImmunity = Math.max(0, actor.gravityImmunity - dt);
  actor.invulnerability = Math.max(0, actor.invulnerability - dt);
  actor.shieldTimer = Math.max(0, actor.shieldTimer - dt);
  actor.shieldCooldown = Math.max(0, actor.shieldCooldown - dt);
  if (actor.attached) {
    actor.energy = Math.min(MAX_ENERGY, actor.energy + SEAWEED_ENERGY_RECOVERY_PER_SECOND * dt);
    return events;
  }

  const before = findCellContainingPoint(map, actor, chapter, origin);
  const activeCell = before?.cell;
  const zoneGravity = actor.gravityImmunity > 0 ? 0 : (GRAVITY_LEVELS[activeCell?.gravityLevel] ?? 0) * GAME_GRAVITY;
  const current = applyCurrentAcceleration(map, before?.key, chapter);
  const special = actor.specialAcceleration ?? { x: 0, y: 0 };
  const horizontalDrag = Math.pow(HORIZONTAL_WATER_DRAG, dt * 60);
  const verticalDrag = Math.pow(VERTICAL_WATER_DRAG, dt * 60);
  actor.vx = (actor.vx + (current.x + special.x) * dt) * horizontalDrag;
  if (Math.abs(actor.vx) < HORIZONTAL_STOP_SPEED) actor.vx = 0;
  actor.vy = (actor.vy + (zoneGravity + current.y + special.y) * dt) * verticalDrag;
  const speed = Math.hypot(actor.vx, actor.vy);
  if (speed > MAX_SPEED) {
    actor.vx = (actor.vx / speed) * MAX_SPEED;
    actor.vy = (actor.vy / speed) * MAX_SPEED;
  }
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  processBoundary(actor, bounds, events);
  const after = findCellContainingPoint(map, actor, chapter, origin);
  processCrossedEdge(map, actor, before?.key, after?.key, chapter, origin, events);
  // Consume oxygen before contact rewards so Checkpoint and oxygen sources can
  // fulfill their documented promise of restoring the resource to its maximum.
  actor.oxygen = Math.max(0, actor.oxygen - (OXYGEN_DRAIN_PER_SECOND + Math.hypot(actor.vx, actor.vy) / 3000) * dt);
  processCellObjects(map, actor, chapter, origin, events, mutateMap);
  if (Math.hypot(actor.vx, actor.vy) < 1) {
    actor.energy = Math.min(MAX_ENERGY, actor.energy + IDLE_ENERGY_RECOVERY_PER_SECOND * dt);
  }
  return events;
}

export function predictTrajectory({ map, chapter, actor, pointer, origin, steps = 120 }) {
  const previewMap = JSON.parse(JSON.stringify(map));
  const ghost = JSON.parse(JSON.stringify(actor));
  if (!launchActor(ghost, pointer).launched) return [];
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    stepPhysics({ map: previewMap, chapter, actor: ghost, origin, mutateMap: true });
    points.push({ x: ghost.x, y: ghost.y });
  }
  return points;
}

export function getCurrentEdgeSummary(map, chapter) {
  return allMapEdges(map)
    .map(({ key }) => ({ key, edge: map.edges[key] ? getEdgeBetween(map, ...key.split('|'), chapter) : null }))
    .filter(({ edge }) => edge?.type === 'current');
}
