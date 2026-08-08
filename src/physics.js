import {
  DIRECTIONS,
  GRAVITY_LEVELS,
  allMapEdges,
  edgeKey,
  findCellContainingPoint,
  getActiveCell,
  getEditableCell,
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
import {
  getEdgeSetting,
  getFreeObjectHitRadius,
  getFreeObjectSetting,
} from './map-object-settings.js';
import { MULTI_PORTAL_EDGE_TYPE, getPortalPartnerEdge } from './portal.js';
import { PLAYER_DEATH_DURATION, PLAYER_HURT_DURATION } from './player-animation.js';

export const FIXED_STEP = 1 / 60;
export const SIMULATION_SPEED_SCALE = 0.1;
export const GRAVITY_SCALE = 0.5;
export const GAME_GRAVITY = 230 * SIMULATION_SPEED_SCALE * GRAVITY_SCALE;
// Preserve the familiar 0.1x feel for short pulls, while leaving headroom for
// long launches to travel farther instead of hitting the old cap immediately.
export const MAX_SPEED = 140;
export const LAUNCH_MOMENTUM_MULTIPLIER = 5;
export const MAX_LAUNCH_SPEED = MAX_SPEED * LAUNCH_MOMENTUM_MULTIPLIER;
export const MAX_HEALTH = RESOURCE_LIMITS.health;
export const MAX_OXYGEN = RESOURCE_LIMITS.oxygen;
export const MAX_ENERGY = RESOURCE_LIMITS.energy;
export const MAX_LIVES = RESOURCE_LIMITS.lives;
export const EDGE_ATTACHMENT_HELP_RADIUS = 18;
const LAUNCH_SPEED_PER_PIXEL = 2.9 * SIMULATION_SPEED_SCALE;
const LAUNCH_MOMENTUM_DURATION = 0.75;
const LAUNCH_LINEAR_DISTANCE = 90;
const LAUNCH_LONG_DISTANCE_GAIN = 0.05;
const LAUNCH_OXYGEN_BASE_COST = 2;
const LAUNCH_OXYGEN_COST_PER_PIXEL = 0.055;
const LAUNCH_ENERGY_BASE_COST = 3;
const LAUNCH_ENERGY_COST_PER_PIXEL = 0.08;
const AIM_ENERGY_PER_SECOND = 9;
const IDLE_ENERGY_RECOVERY_PER_SECOND = 8;
const SEAWEED_ENERGY_RECOVERY_PER_SECOND = 12;
const OXYGEN_DRAIN_PER_SECOND = 0.15;
const CURRENT_ACCELERATION = 74 * SIMULATION_SPEED_SCALE;
// The first pass was intentionally very quiet. Keep the curl/mean-subtraction
// model, but raise its readable strength to five times that prototype so the
// player can actually feel the water breathing without turning it into a belt.
export const MICROFLOW_INTENSITY = 5;
export const MICROFLOW_ACCELERATION = CURRENT_ACCELERATION * 0.1 * MICROFLOW_INTENSITY;
const MICROFLOW_SPATIAL_SCALE = 0.045;
const MICROFLOW_TIME_SCALE = 0.55;
const MICROFLOW_VECTOR_SCALE = 18;
const HORIZONTAL_WATER_DRAG = 0.96;
const VERTICAL_WATER_DRAG = 0.998;
const HORIZONTAL_STOP_SPEED = 0.15;
export const WORLD_BOUNDS = Object.freeze({ minX: 24, maxX: 976, minY: 24, maxY: 656 });
const microflowRegionCache = new WeakMap();
const microflowMeanCache = new WeakMap();
const contactObjectCache = new WeakMap();

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

function reflectWithoutUpwardLift(velocity, normal, multiplier = 0.72) {
  const reflected = reflect(velocity, normal, multiplier);
  // A blocked hex is a wall, not another gravity source. In screen space
  // negative y is upward, so a wall may not turn a downward/neutral velocity
  // upward, nor make an already-upward launch even more upward. Explicit
  // bounce objects (spring jelly, mines) continue to use full reflection.
  reflected.y = velocity.y <= 0
    ? Math.max(reflected.y, velocity.y)
    : Math.max(reflected.y, 0);
  return reflected;
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
  return clamp(Math.hypot(actor.x - pointer.x, actor.y - pointer.y), 0, 420);
}

function microflowStreamFunction(x, y, time) {
  const sx = x * MICROFLOW_SPATIAL_SCALE;
  const sy = y * MICROFLOW_SPATIAL_SCALE;
  const t = time * MICROFLOW_TIME_SCALE;
  return Math.sin(sx + t) * Math.cos(sy - t * 0.72)
    + 0.35 * Math.sin(sx * 0.65 - sy * 0.85 - t * 0.58);
}

export function sampleMicroflowVector(point, time = 0) {
  const delta = 0.25;
  const horizontalGradient = (microflowStreamFunction(point.x + delta, point.y, time)
    - microflowStreamFunction(point.x - delta, point.y, time)) / (delta * 2);
  const verticalGradient = (microflowStreamFunction(point.x, point.y + delta, time)
    - microflowStreamFunction(point.x, point.y - delta, time)) / (delta * 2);
  // A curl field keeps the local motion swirling instead of creating a
  // consistent source-to-destination push.
  return {
    x: verticalGradient * MICROFLOW_VECTOR_SCALE,
    y: -horizontalGradient * MICROFLOW_VECTOR_SCALE,
  };
}

function sameMicroflowSurface(left, right) {
  return Boolean(left && right
    && left.terrain === 'water'
    && right.terrain === 'water'
    && left.gravityLevel === right.gravityLevel
    && (left.waterLayer ?? 'T1') === (right.waterLayer ?? 'T1'));
}

export function getMicroflowRegionKeys({ map, startKey, chapter = 'chapter1' }) {
  const start = getActiveCell(map, startKey, chapter);
  if (!start || start.terrain !== 'water') return [];
  let chapterCache = microflowRegionCache.get(map)?.get(chapter);
  if (!chapterCache) {
    chapterCache = new Map();
    const visited = new Set();
    Object.keys(map.cells).forEach((rootKey) => {
      if (visited.has(rootKey)) return;
      const root = getActiveCell(map, rootKey, chapter);
      if (!root || root.terrain !== 'water') { visited.add(rootKey); return; }
      const region = [];
      const queue = [rootKey];
      visited.add(rootKey);
      while (queue.length) {
        const key = queue.shift();
        const cell = getActiveCell(map, key, chapter);
        if (!sameMicroflowSurface(root, cell)) continue;
        region.push(key);
        DIRECTIONS.forEach((_, directionIndex) => {
          const adjacentKey = neighborKey(key, directionIndex);
          if (visited.has(adjacentKey) || !map.cells[adjacentKey]) return;
          const edge = getEdgeBetween(map, key, adjacentKey, chapter);
          if (edge.blocksPassage) return;
          const adjacent = getActiveCell(map, adjacentKey, chapter);
          if (sameMicroflowSurface(root, adjacent)) {
            visited.add(adjacentKey);
            queue.push(adjacentKey);
          }
        });
      }
      region.forEach((key) => chapterCache.set(key, region));
    });
    const mapCache = microflowRegionCache.get(map) ?? new Map();
    mapCache.set(chapter, chapterCache);
    microflowRegionCache.set(map, mapCache);
  }
  return chapterCache.get(startKey) ?? [];
}

function invalidateMicroflowCache(map) {
  microflowRegionCache.delete(map);
  microflowMeanCache.delete(map);
}

export function getMicroflowAcceleration({ map, cellKey, position, chapter = 'chapter1', origin, time = 0 }) {
  const cell = getActiveCell(map, cellKey, chapter);
  if (!cell || cell.terrain !== 'water' || !Number.isFinite(time)) return { x: 0, y: 0 };
  const regionKeys = getMicroflowRegionKeys({ map, startKey: cellKey, chapter });
  if (!regionKeys.length) return { x: 0, y: 0 };
  const regionId = `${chapter}:${regionKeys[0]}`;
  const timeBucket = Math.floor(time * 12);
  let mapMeanCache = microflowMeanCache.get(map);
  if (!mapMeanCache) { mapMeanCache = new Map(); microflowMeanCache.set(map, mapMeanCache); }
  const meanKey = `${regionId}:${timeBucket}`;
  let mean = mapMeanCache.get(meanKey);
  if (!mean) {
    mean = regionKeys.reduce((total, key) => {
      const center = getHexCenter(getActiveCell(map, key, chapter), origin);
      const vector = sampleMicroflowVector(center, time);
      return { x: total.x + vector.x, y: total.y + vector.y };
    }, { x: 0, y: 0 });
    mean.x /= regionKeys.length;
    mean.y /= regionKeys.length;
    mapMeanCache.set(meanKey, mean);
  }
  const local = sampleMicroflowVector(position, time);
  return {
    x: (local.x - mean.x) * MICROFLOW_ACCELERATION,
    // The water can breathe sideways, but must never become a hidden lift
    // source. Vertical motion belongs only to launch impulse and gravity.
    y: 0,
  };
}

export function getLaunchSpeed(distance) {
  const shortDistance = Math.min(Math.max(0, distance), LAUNCH_LINEAR_DISTANCE);
  const excessDistance = Math.max(0, distance - LAUNCH_LINEAR_DISTANCE);
  return (LAUNCH_SPEED_PER_PIXEL * shortDistance
    + LAUNCH_LONG_DISTANCE_GAIN * excessDistance ** 1.5) * LAUNCH_MOMENTUM_MULTIPLIER;
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
    launchMomentumTimer: 0,
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
    facing: 'right',
    hurtTimer: 0,
    deathAnimation: null,
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
  if (damage > 0) actor.hurtTimer = PLAYER_HURT_DURATION;
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
  actor.deathAnimation = { x: actor.x, y: actor.y, timer: PLAYER_DEATH_DURATION, elapsed: 0, cause };
  actor.dead = true;
  actor.health = 0;
  actor.lives = Math.max(0, actor.lives - 1);
  actor.deathCause = cause;
  actor.gameOver = actor.lives <= 0;
  return { livesRemaining: actor.lives, gameOver: actor.gameOver, cause };
}

export function respawnActor(actor, spawn) {
  if (actor.gameOver) return false;
  const deathAnimation = actor.deathAnimation;
  actor.x = spawn.x;
  actor.y = spawn.y;
  actor.vx = 0;
  actor.vy = 0;
  actor.health = MAX_HEALTH;
  actor.energy = MAX_ENERGY;
  actor.derivedStats = getPlayerDerivedStats(actor.abilities, actor.oxygen);
  actor.oxygen = actor.derivedStats.maxOxygen;
  actor.dead = false;
  actor.hurtTimer = 0;
  actor.deathAnimation = deathAnimation;
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
  const speed = getLaunchSpeed(distance);
  actor.vx = direction.x * speed;
  actor.vy = direction.y * speed;
  if (Math.abs(direction.x) > 0.08) actor.facing = direction.x < 0 ? 'left' : 'right';
  actor.launchMomentumTimer = LAUNCH_MOMENTUM_DURATION;
  actor.oxygen = clamp(actor.oxygen - costs.oxygen, 0, maxOxygenFor(actor));
  actor.energy = clamp(actor.energy - costs.energy, 0, MAX_ENERGY);
  return { launched: true, speed, distance, costs };
}

export function toggleSeaweedAttachment(actor, map, chapter, origin) {
  if (actor.attached) {
    actor.attached = false;
    return { changed: true, attached: false, message: '已離開水草，重力重新生效。' };
  }
  for (const { key, a, b } of allMapEdges(map)) {
    const edge = getEdgeBetween(map, a, b, chapter);
    if (edge.type !== 'seaweed') continue;
    const centerA = getHexCenter(getActiveCell(map, a, chapter), origin);
    const centerB = getHexCenter(getActiveCell(map, b, chapter), origin);
    const position = { x: (centerA.x + centerB.x) / 2, y: (centerA.y + centerB.y) / 2 };
    if (Math.hypot(actor.x - position.x, actor.y - position.y) <= 42) {
      actor.x = position.x;
      actor.y = position.y;
      actor.vx = 0;
      actor.vy = 0;
      actor.attached = true;
      return { changed: true, attached: true, message: '已附著邊緣水草：暫停重力並回復體力。' };
    }
  }
  // Compatibility for maps authored before water grass became an Edge object.
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

export function isActorNearEdgeAttachment(actor, map, chapter, origin, type, radius = EDGE_ATTACHMENT_HELP_RADIUS) {
  const current = findCellContainingPoint(map, actor, chapter, origin);
  if (!current) return false;
  const candidateKeys = [current.key, ...DIRECTIONS.map((_, index) => neighborKey(current.key, index))];
  const candidateEdges = new Set();
  candidateKeys.forEach((key) => {
    DIRECTIONS.forEach((_, directionIndex) => {
      const adjacent = neighborKey(key, directionIndex);
      if (map.cells[adjacent]) candidateEdges.add(edgeKey(key, adjacent));
    });
  });
  return [...candidateEdges].some((key) => {
    const [a, b] = key.split('|');
    const edge = getEdgeBetween(map, a, b, chapter);
    if (edge.type !== type) return false;
    const centerA = getHexCenter(getActiveCell(map, a, chapter), origin);
    const centerB = getHexCenter(getActiveCell(map, b, chapter), origin);
    const midpoint = { x: (centerA.x + centerB.x) / 2, y: (centerA.y + centerB.y) / 2 };
    return Math.hypot(actor.x - midpoint.x, actor.y - midpoint.y) <= actor.radius + radius;
  });
}

function applyCurrentAcceleration(map, cellKey, chapter) {
  if (!cellKey) return { x: 0, y: 0 };
  let x = 0;
  DIRECTIONS.forEach((_, directionIndex) => {
    const adjacent = neighborKey(cellKey, directionIndex);
    if (!map.cells[adjacent]) return;
    const edge = getEdgeBetween(map, cellKey, adjacent, chapter);
    if (edge.type !== 'current' || edge.currentStrength <= 0) return;
    const vector = getDirectionVector(edge.currentDirection);
    const magnitude = CURRENT_ACCELERATION * edge.currentStrength;
    x += vector.x * magnitude;
  });
  // Authored current Edges may point diagonally for their visual language, but
  // they must not become a second gravity source. Keep their gameplay effect
  // as a horizontal nudge; vertical motion is owned by launch impulse and the
  // active Cell's gravity only.
  return { x, y: 0 };
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

function processCrossedEdge(map, actor, fromKey, toKey, chapter, origin, events, previousPosition = null) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const edge = getEdgeBetween(map, fromKey, toKey, chapter);
  const fromCell = getActiveCell(map, fromKey, chapter);
  const toCell = getActiveCell(map, toKey, chapter);
  const fromLayer = fromCell?.waterLayer ?? 'T1';
  const toLayer = toCell?.waterLayer ?? 'T1';
  const entersBlockedTerrain = fromCell?.terrain === 'water' && toCell?.terrain === 'blocked';
  const crossesWaterLayer = fromCell?.terrain === 'water'
    && toCell?.terrain === 'water'
    && fromLayer !== toLayer;
  if (edge.type === MULTI_PORTAL_EDGE_TYPE) {
    const portalTarget = getPortalPartnerEdge(map, { key: edgeKey(fromKey, toKey), edge }, chapter);
    if (!portalTarget) {
      const from = getHexCenter(fromCell, origin);
      const to = getHexCenter(toCell, origin);
      const normal = unitVector(from, to);
      const reflected = reflect({ x: actor.vx, y: actor.vy }, normal, 0.68);
      actor.vx = reflected.x;
      actor.vy = reflected.y;
      actor.x = from.x + normal.x * 8;
      actor.y = from.y + normal.y * 8;
      addEvent(events, 'multiPortal', '多邊傳送門尚未連接另一端：入口暫時阻擋。');
      return;
    }
    const targetFromCell = getActiveCell(map, portalTarget.a, chapter);
    const targetToCell = getActiveCell(map, portalTarget.b, chapter);
    const sourceFromCenter = getHexCenter(fromCell, origin);
    const sourceToCenter = getHexCenter(toCell, origin);
    const targetFromCenter = getHexCenter(targetFromCell, origin);
    const targetToCenter = getHexCenter(targetToCell, origin);
    const sourceAngle = Math.atan2(sourceToCenter.y - sourceFromCenter.y, sourceToCenter.x - sourceFromCenter.x);
    // A portal Edge is normally mounted on a blocked hex. Exit on the target
    // side that matches the terrain the actor came from, so the actor emerges
    // into water instead of being placed inside the black obstacle.
    const targetSideIsFrom = targetFromCell?.terrain === fromCell?.terrain;
    const targetSideCenter = targetSideIsFrom ? targetFromCenter : targetToCenter;
    const targetObstacleCenter = targetSideIsFrom ? targetToCenter : targetFromCenter;
    const targetAngle = Math.atan2(targetSideCenter.y - targetObstacleCenter.y, targetSideCenter.x - targetObstacleCenter.x);
    const rotation = targetAngle - sourceAngle;
    const velocity = {
      x: actor.vx * Math.cos(rotation) - actor.vy * Math.sin(rotation),
      y: actor.vx * Math.sin(rotation) + actor.vy * Math.cos(rotation),
    };
    actor.vx = velocity.x;
    actor.vy = velocity.y;
    actor.x = (targetFromCenter.x + targetToCenter.x) / 2 + Math.cos(targetAngle) * 8;
    actor.y = (targetFromCenter.y + targetToCenter.y) / 2 + Math.sin(targetAngle) * 8;
    addEvent(events, 'multiPortal', `多邊傳送門：已傳送至另一端 Edge（${portalTarget.key}）。`);
    return;
  }
  if (entersBlockedTerrain && edge.type === 'none') {
    const from = getHexCenter(fromCell, origin);
    const to = getHexCenter(toCell, origin);
    const normal = unitVector(from, to);
    const reflected = reflectWithoutUpwardLift({ x: actor.vx, y: actor.vy }, normal, 0.72);
    actor.vx = reflected.x;
    actor.vy = reflected.y;
    actor.x = previousPosition?.x ?? (from.x + normal.x * 8);
    actor.y = previousPosition?.y ?? (from.y + normal.y * 8);
    addEvent(events, 'terrainBoundary', '不可通行障礙物：已阻擋並反彈玩家。');
    return;
  }
  if (crossesWaterLayer && edge.type !== 'layerPortal') {
    const from = getHexCenter(fromCell, origin);
    const to = getHexCenter(toCell, origin);
    const normal = unitVector(from, to);
    const reflected = reflectWithoutUpwardLift({ x: actor.vx, y: actor.vy }, normal, 0.68);
    actor.vx = reflected.x;
    actor.vy = reflected.y;
    actor.x = previousPosition?.x ?? (from.x + normal.x * 8);
    actor.y = previousPosition?.y ?? (from.y + normal.y * 8);
    addEvent(events, 'layerBoundary', `水域層級邊界：T${fromLayer.slice(1)} 與 T${toLayer.slice(1)} 之間沒有層間轉接門。`);
    return;
  }
  if (crossesWaterLayer && edge.type === 'layerPortal') {
    addEvent(events, 'layerPortal', `層間轉接門：已從 ${fromLayer} 進入 ${toLayer}。`);
    return;
  }
  if (!edge.blocksPassage && edge.type !== 'springJelly') return;
  const from = getHexCenter(getActiveCell(map, fromKey, chapter), origin);
  const to = getHexCenter(getActiveCell(map, toKey, chapter), origin);
  const normal = unitVector(from, to);
  const multiplier = edge.type === 'springJelly' ? getEdgeSetting(edge, 'bounceMultiplier') : 0.68;
  const reflected = reflect({ x: actor.vx, y: actor.vy }, normal, multiplier);
  actor.vx = reflected.x;
  actor.vy = reflected.y;
  actor.x = from.x + normal.x * 8;
  actor.y = from.y + normal.y * 8;
  if (edge.type === 'springJelly') addEvent(events, 'springJelly', '彈簧水母：依入射角反射並加速。');
  else if (edge.type === 'spike') {
    const damage = applyDamage(actor, getEdgeSetting(edge, 'damage'), 'spike', 'contact');
    addEvent(events, 'spike', `尖刺阻擋：反彈並受到 ${Math.round(damage.applied)} 點傷害。`);
  } else addEvent(events, 'barrier', '障礙 Edge 阻擋：速度已反彈。');
}

function processTerrainContact(map, actor, cellKey, chapter, origin, events, previousPosition = null) {
  const cell = getActiveCell(map, cellKey, chapter);
  if (!cell || cell.terrain !== 'water') return false;
  const from = getHexCenter(cell, origin);
  for (let directionIndex = 0; directionIndex < DIRECTIONS.length; directionIndex += 1) {
    const adjacentKey = neighborKey(cellKey, directionIndex);
    const adjacent = getActiveCell(map, adjacentKey, chapter);
    if (!adjacent || adjacent.terrain !== 'blocked') continue;
    const edge = getEdgeBetween(map, cellKey, adjacentKey, chapter);
    if (edge.type !== 'none' || edge.blocksPassage) continue;
    const to = getHexCenter(adjacent, origin);
    const normal = unitVector(from, to);
    const centerDistance = Math.hypot(to.x - from.x, to.y - from.y);
    const boundaryDistance = centerDistance / 2;
    const distanceIntoSide = (actor.x - from.x) * normal.x + (actor.y - from.y) * normal.y;
    const approaching = actor.vx * normal.x + actor.vy * normal.y > 0;
    if (distanceIntoSide + actor.radius <= boundaryDistance || !approaching) continue;
    const reflected = reflectWithoutUpwardLift({ x: actor.vx, y: actor.vy }, normal, 0.72);
    actor.vx = reflected.x;
    actor.vy = reflected.y;
    if (previousPosition) {
      actor.x = previousPosition.x;
      actor.y = previousPosition.y;
    } else {
      const safeDistance = Math.max(0, boundaryDistance - actor.radius - 0.2);
      actor.x = from.x + normal.x * safeDistance;
      actor.y = from.y + normal.y * safeDistance;
    }
    addEvent(events, 'terrainBoundary', '不可通行障礙物：接觸邊界後反彈。');
    return true;
  }
  return false;
}

function removeContactObject(map, contact, chapter) {
  const ownerKey = contact.ownerKey ?? contact.key;
  const editable = getActiveCell(map, ownerKey, chapter);
  if (!editable) return;
  if (contact.free) {
    patchCell(map, ownerKey, { freeObjects: editable.freeObjects.filter((_, index) => index !== contact.index) }, chapter);
  } else {
    patchCell(map, ownerKey, { objects: editable.objects.filter((candidate) => candidate !== contact.object) }, chapter);
  }
}

function openConditionalGate(map, gateKey, chapter, events, mutateMap) {
  const gate = getActiveCell(map, gateKey, chapter);
  if (!gate?.conditionalGate || gate.conditionalGate.opened) return false;
  if (!mutateMap) return false;
  patchCell(map, gateKey, {
    terrain: 'water',
    gravityLevel: 'L1',
    conditionalGate: { ...gate.conditionalGate, opened: true },
  }, chapter);
  invalidateMicroflowCache(map);
  return true;
}

function toggleConditionalGate(map, gateKey, chapter, mutateMap) {
  const gate = getActiveCell(map, gateKey, chapter);
  if (!gate?.conditionalGate || !mutateMap) return false;
  const opened = !Boolean(gate.conditionalGate.opened);
  patchCell(map, gateKey, {
    terrain: opened ? 'water' : 'blocked',
    gravityLevel: 'L1',
    conditionalGate: { ...gate.conditionalGate, opened },
  }, chapter);
  invalidateMicroflowCache(map);
  return true;
}

function markButtonPressed(map, contact, chapter, pressed = true) {
  const ownerKey = contact.ownerKey ?? contact.key;
  const editable = getEditableCell(map, ownerKey, chapter);
  if (!editable) return;
  const property = contact.free ? 'freeObjects' : 'objects';
  const nextObjects = editable[property].map((object, index) => (
    index === contact.index ? { ...object, pressed } : object
  ));
  patchCell(map, ownerKey, { [property]: nextObjects }, chapter);
}

function getContactObjects(map, chapter, origin) {
  let chapterCache = contactObjectCache.get(map);
  if (!chapterCache) { chapterCache = new Map(); contactObjectCache.set(map, chapterCache); }
  const revision = Number(map.__physicsRevision) || 0;
  const cached = chapterCache.get(chapter);
  if (cached?.revision === revision) return cached.contacts;
  const contacts = [];
  Object.entries(map.cells).forEach(([key]) => {
    const objectCell = getActiveCell(map, key, chapter);
    const center = getHexCenter(objectCell, origin);
    objectCell.objects.forEach((object, index) => contacts.push({ key: `${key}:object:${index}`, ownerKey: key, objectCell, object, position: center, hitRadius: getFreeObjectHitRadius(object), index, free: false }));
    (objectCell.freeObjects ?? []).forEach((object, index) => {
      const offset = object.offset ?? { x: 0, y: 0 };
      contacts.push({ key: `${key}:free:${index}`, ownerKey: key, objectCell, object, position: { x: center.x + offset.x, y: center.y + offset.y }, hitRadius: getFreeObjectHitRadius(object), free: true, index });
    });
  });
  chapterCache.set(chapter, { revision, contacts });
  return contacts;
}

function processCellObjects(map, actor, chapter, origin, events, mutateMap, dt) {
  actor.safe = false;
  actor.inInk = false;
  actor.inkVisionRange = null;
  const current = findCellContainingPoint(map, actor, chapter, origin);
  if (!current) return;
  const cell = current.cell;
  const coralClusterSafe = isActorNearEdgeAttachment(actor, map, chapter, origin, 'coralCluster');
  actor.safe = coralClusterSafe;
  actor.inInk = cell.overlays.includes('ink');
  if (actor.inInk) actor.inkVisionRange = getFreeObjectSetting({ kind: 'ink' }, 'visibilityRadius');
  if (coralClusterSafe) addEvent(events, 'coralCluster', '邊緣珊瑚群落：玩家處於保護範圍。');
  const contactObjects = getContactObjects(map, chapter, origin);

  const activeToggleButtons = new Set();
  contactObjects.forEach(({ key, ownerKey, objectCell, object, position, hitRadius, free, index }) => {
      const liveCell = getActiveCell(map, ownerKey, chapter);
      const liveObjects = free ? (liveCell?.freeObjects ?? []) : (liveCell?.objects ?? []);
      if (!liveObjects.includes(object)) return;
      if (object.kind === 'ink' && Math.hypot(actor.x - position.x, actor.y - position.y) <= actor.radius + hitRadius) {
        actor.inInk = true;
        const range = getFreeObjectSetting(object, 'visibilityRadius');
        actor.inkVisionRange = Math.min(actor.inkVisionRange ?? range, range);
      }
      const distance = Math.hypot(actor.x - position.x, actor.y - position.y);
      if (distance > actor.radius + hitRadius) return;

      if (object.kind === 'button') {
        const buttonMode = object.mode === 'toggle' ? 'toggle' : 'once';
        if (buttonMode === 'toggle') activeToggleButtons.add(key);
        if (!object.pressed) {
          const changedGates = mutateMap
            ? (object.targetGates ?? []).filter((gateKey) => buttonMode === 'toggle'
              ? toggleConditionalGate(map, gateKey, chapter, mutateMap)
              : openConditionalGate(map, gateKey, chapter, events, mutateMap)).length
            : 0;
          if (mutateMap) markButtonPressed(map, { ownerKey, index, free }, chapter);
          addEvent(events, 'button', changedGates > 0
            ? buttonMode === 'toggle'
              ? `按鈕：已切換 ${changedGates} 個條件通行門。`
              : `按鈕：已開啟 ${changedGates} 個條件通行門。`
            : buttonMode === 'toggle'
              ? '按鈕：已切換，但沒有可切換的條件通行門。'
              : '按鈕：已按下，但沒有可開啟的條件通行門。');
        }
      }

      if (object.kind === 'razor' && !isOnCooldown(actor, `razor:${key}`)) {
        const direction = distance > 0.001 ? unitVector(position, actor) : { x: 0, y: -1 };
        const knockbackSpeed = getFreeObjectSetting(object, 'knockbackSpeed') ?? 58;
        actor.vx = direction.x * knockbackSpeed;
        actor.vy = direction.y * knockbackSpeed;
        const damageAmount = getFreeObjectSetting(object, 'damage') ?? 20;
        const damage = actor.safe ? { applied: 0 } : applyDamage(actor, damageAmount, 'razor', 'contact');
        actor.cooldowns[`razor:${key}`] = 0.35;
        addEvent(events, 'razor', actor.safe
          ? '剃刀：碰觸後被強制推開；珊瑚保護範圍抵銷了傷害。'
          : `剃刀：碰觸後被強制推開並受到 ${Math.round(damage.applied)} 點傷害。`);
      }
      if (object.kind === 'mine' && !isOnCooldown(actor, `mine:${key}`)) {
        const normal = unitVector(position, actor);
        const bounced = reflect({ x: actor.vx, y: actor.vy }, normal, 1.03);
        actor.vx = bounced.x;
        actor.vy = bounced.y;
        const damage = actor.safe ? { applied: 0 } : applyDamage(actor, getFreeObjectSetting(object, 'damage'), 'deepSeaMine', 'contact');
        actor.cooldowns[`mine:${key}`] = 0.5;
        addEvent(events, 'mine', actor.safe ? '深海地雷：珊瑚群落保護範圍抵銷了傷害。' : `深海地雷：強力反彈並受到 ${Math.round(damage.applied)} 點傷害。`);
      }
      if (object.kind === 'weightStone' && !isOnCooldown(actor, `stone:${key}`)) {
        const impact = Math.hypot(actor.vx, actor.vy);
        if (impact >= getFreeObjectSetting(object, 'breakSpeed') && mutateMap) {
          removeContactObject(map, { key, ownerKey, object, free, index }, chapter);
          actor.cooldowns[`stone:${key}`] = 0.5;
          addEvent(events, 'weightStone', '重石已被足夠的撞擊力擊碎。');
        } else {
          const normal = unitVector(position, actor);
          const bounced = reflect({ x: actor.vx, y: actor.vy }, normal, 0.55);
          actor.vx = bounced.x;
          actor.vy = Math.abs(bounced.y) + getFreeObjectSetting(object, 'weight');
          actor.cooldowns[`stone:${key}`] = 0.35;
          addEvent(events, 'weightStone', '重石壓下玩家：撞擊力不足以擊碎。');
        }
      }
      if (object.kind === 'oxygen' && !isOnCooldown(actor, `oxygen:${key}`)) {
        const impact = Math.hypot(actor.vx, actor.vy);
        const requiredSpeed = getFreeObjectSetting(object, 'activationSpeed');
        if (impact >= requiredSpeed) {
          const oxygen = recoverPlayerResource(actor, 'oxygen', getFreeObjectSetting(object, 'oxygenAmount'), 'oxygenOre');
          if (mutateMap) removeContactObject(map, { key, ownerKey, object, free, index }, chapter);
          actor.cooldowns[`oxygen:${key}`] = 0.5;
          addEvent(events, 'oxygen', `氧氣礦石：撞擊後釋放 ${Math.round(oxygen.recovered)} O₂。`);
        } else {
          actor.cooldowns[`oxygen:${key}`] = 0.25;
          addEvent(events, 'oxygen', `氧氣礦石：需要 ${Math.round(requiredSpeed)} px/s 撞擊才會釋放氧氣。`);
        }
      }
      if (object.kind === 'torricelli') {
        const oxygen = recoverPlayerResource(actor, 'oxygen', getFreeObjectSetting(object, 'oxygenRecoveryPerSecond') * dt, 'torricelli');
        if (oxygen.recovered > 0 && !isOnCooldown(actor, `torricelli:${key}`)) {
          actor.cooldowns[`torricelli:${key}`] = 0.5;
          addEvent(events, 'torricelli', `托里切利空間：以 ${getFreeObjectSetting(object, 'oxygenRecoveryPerSecond')} O₂/s 回復氧氣。`);
        }
      }
      if (object.kind === 'bubble' && actor.gravityImmunity <= 0) {
        const duration = getFreeObjectSetting(object, 'gravityImmunitySeconds');
        const oxygen = recoverPlayerResource(actor, 'oxygen', getFreeObjectSetting(object, 'oxygenAmount'), 'photosynthesisBubble');
        actor.gravityImmunity = duration;
        actor.cooldowns[`bubble:${key}`] = Math.max(0.1, duration);
        addEvent(events, 'bubble', `光合作用氣泡：+${Math.round(oxygen.recovered)} O₂，${duration} 秒免疫水域重力。`);
      }
      if (object.kind === 'checkpoint') {
        actor.spawn = { x: position.x, y: position.y };
        actor.health = MAX_HEALTH;
        actor.oxygen = maxOxygenFor(actor);
        actor.energy = MAX_ENERGY;
        addEvent(events, 'checkpoint', 'Checkpoint：已更新重生點並回滿資源。');
      }
  });
  if (mutateMap) {
    Object.entries(map.cells).forEach(([cellKey]) => {
      const editable = getEditableCell(map, cellKey, chapter);
      const nextObjects = editable.objects.map((object, index) => (
        object.kind === 'button' && object.mode === 'toggle' && object.pressed && !activeToggleButtons.has(`${cellKey}:object:${index}`)
          ? { ...object, pressed: false }
          : object
      ));
      const nextFreeObjects = (editable.freeObjects ?? []).map((object, index) => (
        object.kind === 'button' && object.mode === 'toggle' && object.pressed && !activeToggleButtons.has(`${cellKey}:free:${index}`)
          ? { ...object, pressed: false }
          : object
      ));
      const changed = nextObjects.some((object, index) => object !== editable.objects[index])
        || nextFreeObjects.some((object, index) => object !== (editable.freeObjects ?? [])[index]);
      if (changed) patchCell(map, cellKey, { objects: nextObjects, freeObjects: nextFreeObjects }, chapter);
    });
  }
  if (actor.inInk) addEvent(events, 'ink', '墨水區：預覽視野受限。');
}

export function stepPhysics({ map, chapter = 'chapter1', actor, dt = FIXED_STEP, origin, bounds = WORLD_BOUNDS, mutateMap = true, time = null }) {
  const events = [];
  actor.hurtTimer = Math.max(0, (actor.hurtTimer ?? 0) - dt);
  if (actor.deathAnimation) {
    actor.deathAnimation.timer = Math.max(0, actor.deathAnimation.timer - dt);
    actor.deathAnimation.elapsed = Math.min(PLAYER_DEATH_DURATION, (actor.deathAnimation.elapsed ?? 0) + dt);
    if (actor.deathAnimation.timer <= 0 && !actor.dead && !actor.gameOver) actor.deathAnimation = null;
  }
  Object.keys(actor.cooldowns).forEach((key) => {
    actor.cooldowns[key] = Math.max(0, actor.cooldowns[key] - dt);
  });
  actor.gravityImmunity = Math.max(0, actor.gravityImmunity - dt);
  actor.launchMomentumTimer = Math.max(0, (actor.launchMomentumTimer ?? 0) - dt);
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
  const microflow = getMicroflowAcceleration({
    map,
    cellKey: before?.key,
    position: actor,
    chapter,
    origin,
    time,
  });
  const special = actor.specialAcceleration ?? { x: 0, y: 0 };
  const horizontalDrag = Math.pow(HORIZONTAL_WATER_DRAG, dt * 60);
  const verticalDrag = Math.pow(VERTICAL_WATER_DRAG, dt * 60);
  actor.vx = (actor.vx + (current.x + microflow.x + special.x) * dt) * horizontalDrag;
  if (Math.abs(actor.vx) > 1) actor.facing = actor.vx < 0 ? 'left' : 'right';
  if (Math.abs(actor.vx) < HORIZONTAL_STOP_SPEED) actor.vx = 0;
  actor.vy = (actor.vy + (zoneGravity + current.y + microflow.y + special.y) * dt) * verticalDrag;
  const speed = Math.hypot(actor.vx, actor.vy);
  const speedLimit = actor.launchMomentumTimer > 0 ? MAX_LAUNCH_SPEED : MAX_SPEED;
  if (speed > speedLimit) {
    actor.vx = (actor.vx / speed) * speedLimit;
    actor.vy = (actor.vy / speed) * speedLimit;
  }
  const previousPosition = { x: actor.x, y: actor.y };
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  processBoundary(actor, bounds, events);
  const after = findCellContainingPoint(map, actor, chapter, origin);
  const terrainContact = processTerrainContact(map, actor, before?.key, chapter, origin, events, previousPosition);
  if (!terrainContact) processCrossedEdge(map, actor, before?.key, after?.key, chapter, origin, events, previousPosition);
  // Consume oxygen before contact rewards so Checkpoint and oxygen sources can
  // fulfill their documented promise of restoring the resource to its maximum.
  actor.oxygen = Math.max(0, actor.oxygen - (OXYGEN_DRAIN_PER_SECOND + Math.hypot(actor.vx, actor.vy) / 3000) * dt);
  processCellObjects(map, actor, chapter, origin, events, mutateMap, dt);
  if (Math.hypot(actor.vx, actor.vy) < 1) {
    actor.energy = Math.min(MAX_ENERGY, actor.energy + IDLE_ENERGY_RECOVERY_PER_SECOND * dt);
  }
  return events;
}

export function predictTrajectory({ map, chapter, actor, pointer, origin, steps = 120, time = null }) {
  // The preview never mutates Cells or objects, so sharing the immutable map
  // avoids cloning thousands of Cells on every pointer move.
  const previewMap = map;
  const ghost = JSON.parse(JSON.stringify(actor));
  if (!launchActor(ghost, pointer).launched) return [];
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    stepPhysics({ map: previewMap, chapter, actor: ghost, origin, mutateMap: false, time: Number.isFinite(time) ? time + index * FIXED_STEP : null });
    points.push({ x: ghost.x, y: ghost.y });
  }
  return points;
}

export function getCurrentEdgeSummary(map, chapter) {
  return allMapEdges(map)
    .map(({ key }) => ({ key, edge: map.edges[key] ? getEdgeBetween(map, ...key.split('|'), chapter) : null }))
    .filter(({ edge }) => edge?.type === 'current');
}
