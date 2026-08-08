import { ENEMY_DEFINITIONS } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import { HEX_SIZE, findCellContainingPoint, getActiveCell, getHexCenter } from './map-model.js';

export const DESCENT_LV1_ENEMIES = Object.freeze(['explodingLanternfish', 'juvenileSeahorseCaller']);
export const DESCENT_CORE_ENEMIES = Object.freeze(['crabGuard', 'lobsterSoldier', 'lionfishGunner', 'squidAssassin']);
export const DESCENT_ELITE_ENEMIES = Object.freeze(['mantisShrimpBrute', 'nautilusOracle', 'arcTideRay']);
export const DESCENT_ENEMY_ROSTER = Object.freeze([
  ...DESCENT_LV1_ENEMIES,
  ...DESCENT_CORE_ENEMIES,
  ...DESCENT_ELITE_ENEMIES,
]);

// All three current maps are sections of Chapter 1: Descent. Their encounter
// progression follows GDD/05_內容/敵人/敵人配置.md instead of treating each map
// part as a separate enemy tier.
export const PLAY_ENEMY_POOLS = Object.freeze({
  1: Object.freeze([...DESCENT_LV1_ENEMIES, ...DESCENT_CORE_ENEMIES]),
  2: Object.freeze([...DESCENT_CORE_ENEMIES, ...DESCENT_ELITE_ENEMIES]),
  3: Object.freeze([...DESCENT_CORE_ENEMIES, ...DESCENT_ELITE_ENEMIES]),
});

export const PLAY_ENEMY_TARGETS = Object.freeze({ 1: 40, 2: 40, 3: 48 });
export const PLAY_ENEMY_RENDER_SCALE = 2;
export const PLAY_ENEMY_SPAWN_SAFE_RADIUS = HEX_SIZE * 18;
export const PLAY_ENEMY_ACTIVATION_RADIUS = HEX_SIZE * 14;

const encyclopediaById = Object.freeze(Object.fromEntries(
  ENEMY_ENCYCLOPEDIA.map((entry) => [entry.id, entry]),
));

export const PLAY_ENEMY_VISUALS = Object.freeze(Object.fromEntries(
  DESCENT_ENEMY_ROSTER.map((enemyId) => {
    const visuals = encyclopediaById[enemyId]?.visuals;
    return [enemyId, visuals?.afterimageIdle ?? visuals?.idle ?? null];
  }),
));

function isDescentEnemy(enemyId) {
  return DESCENT_ENEMY_ROSTER.includes(enemyId);
}

function cellColumn(cell) {
  return cell.q + Math.floor(cell.r / 2);
}

function encounterEnemyId(mapPart, encounterIndex, encounterCount, localIndex, globalIndex) {
  const progress = encounterCount <= 1 ? 1 : encounterIndex / (encounterCount - 1);
  if (mapPart === 1) {
    if (progress < 0.34) return DESCENT_LV1_ENEMIES[globalIndex % DESCENT_LV1_ENEMIES.length];
    return DESCENT_CORE_ENEMIES[(globalIndex + encounterIndex) % DESCENT_CORE_ENEMIES.length];
  }
  if (mapPart === 2) {
    if (progress >= 0.5 && localIndex % 5 === 4) {
      return DESCENT_ELITE_ENEMIES[(encounterIndex + Math.floor(localIndex / 5)) % DESCENT_ELITE_ENEMIES.length];
    }
    return DESCENT_CORE_ENEMIES[(globalIndex + encounterIndex) % DESCENT_CORE_ENEMIES.length];
  }
  if (localIndex % 4 === 3) {
    return DESCENT_ELITE_ENEMIES[(encounterIndex + Math.floor(localIndex / 4)) % DESCENT_ELITE_ENEMIES.length];
  }
  return DESCENT_CORE_ENEMIES[(globalIndex + encounterIndex) % DESCENT_CORE_ENEMIES.length];
}

function getWaterCandidates(map, chapter) {
  return Object.keys(map.cells).flatMap((cellKey) => {
    const cell = getActiveCell(map, cellKey, chapter);
    if (!cell || cell.terrain !== 'water' || cell.actors?.some((actor) => actor.kind === 'playerStart')) return [];
    return [{ cellKey, cell }];
  });
}

function cellDistance(left, right, origin) {
  const leftPosition = getHexCenter(left.cell, origin);
  const rightPosition = getHexCenter(right.cell, origin);
  return Math.hypot(leftPosition.x - rightPosition.x, leftPosition.y - rightPosition.y);
}

function minimumCellDistance(candidate, selected, origin) {
  if (!selected.length) return Infinity;
  return Math.min(...selected.map((entry) => cellDistance(candidate, entry, origin)));
}

function isClearSpawnCell(candidate) {
  return !(candidate.cell.objects?.length || candidate.cell.freeObjects?.length || candidate.cell.conditionalGate);
}

function getDistributedSpawnCells(map, chapter, origin, targetCount, markers) {
  const allCandidates = getWaterCandidates(map, chapter);
  const playerStarts = Object.keys(map.cells).flatMap((cellKey) => {
    const cell = getActiveCell(map, cellKey, chapter);
    return cell?.actors?.some((actor) => actor.kind === 'playerStart') ? [{ cellKey, cell }] : [];
  });
  const safeCandidates = allCandidates.filter((candidate) => (
    playerStarts.every((start) => cellDistance(candidate, start, origin) >= PLAY_ENEMY_SPAWN_SAFE_RADIUS)
  ));
  const candidates = safeCandidates.length >= targetCount ? safeCandidates : allCandidates;
  const ordered = [...candidates].sort((left, right) => (
    left.cell.r - right.cell.r
    || cellColumn(left.cell) - cellColumn(right.cell)
  ));
  const clusterCount = Math.min(Math.floor(targetCount * .2), targetCount - 1);
  const spreadCount = targetCount - clusterCount;
  const spread = [];
  const usedCellKeys = new Set();

  for (let index = 0; index < spreadCount; index += 1) {
    const bandStart = Math.floor(index * ordered.length / spreadCount);
    const bandEnd = Math.max(bandStart + 1, Math.floor((index + 1) * ordered.length / spreadCount));
    const band = ordered.slice(bandStart, bandEnd).filter((candidate) => !usedCellKeys.has(candidate.cellKey));
    const selected = (band.length ? band : ordered.filter((candidate) => !usedCellKeys.has(candidate.cellKey)))
      .sort((left, right) => (
        Number(isClearSpawnCell(right)) - Number(isClearSpawnCell(left))
        || minimumCellDistance(right, spread, origin) - minimumCellDistance(left, spread, origin)
        || cellColumn(left.cell) - cellColumn(right.cell)
      ))[0];
    if (!selected) break;
    usedCellKeys.add(selected.cellKey);
    spread.push({ ...selected, spawnPattern: 'spread' });
  }

  const preferredClusterCenters = [];
  markers.forEach((marker) => {
    const nearest = spread
      .filter((candidate) => !preferredClusterCenters.includes(candidate))
      .sort((left, right) => cellDistance(left, marker, origin) - cellDistance(right, marker, origin))[0];
    if (nearest) preferredClusterCenters.push(nearest);
  });
  while (preferredClusterCenters.length < clusterCount) {
    const candidate = spread
      .filter((entry) => !preferredClusterCenters.includes(entry))
      .sort((left, right) => (
        minimumCellDistance(right, preferredClusterCenters, origin) - minimumCellDistance(left, preferredClusterCenters, origin)
      ))[0];
    if (!candidate) break;
    preferredClusterCenters.push(candidate);
  }

  const clustered = [];
  preferredClusterCenters.slice(0, clusterCount).forEach((center) => {
    const unused = ordered.filter((candidate) => !usedCellKeys.has(candidate.cellKey));
    const nearby = unused.filter((candidate) => cellDistance(candidate, center, origin) <= HEX_SIZE * 2.6);
    const companion = (nearby.length ? nearby : unused)
      .sort((left, right) => (
        cellDistance(left, center, origin) - cellDistance(right, center, origin)
        || Number(left.cell.region !== center.cell.region) - Number(right.cell.region !== center.cell.region)
        || Number(isClearSpawnCell(right)) - Number(isClearSpawnCell(left))
      ))[0];
    if (!companion) return;
    usedCellKeys.add(companion.cellKey);
    clustered.push({ ...companion, spawnPattern: 'cluster' });
  });

  return [...spread, ...clustered]
    .slice(0, targetCount)
    .sort((left, right) => left.cell.r - right.cell.r || cellColumn(left.cell) - cellColumn(right.cell));
}

export function createPlayEnemies(map, mapPart, chapter = 'chapter1', origin = { x: 0, y: 0 }) {
  const part = PLAY_ENEMY_TARGETS[mapPart] ? Number(mapPart) : 1;
  const markers = [];

  Object.keys(map.cells).forEach((cellKey) => {
    const cell = getActiveCell(map, cellKey, chapter);
    if (!cell || cell.terrain !== 'water') return;
    (cell.actors ?? []).forEach((marker, markerIndex) => {
      if (marker.kind === 'enemySpawn') markers.push({ cellKey, cell, marker, markerIndex });
    });
  });

  markers.sort((left, right) => (
    left.cell.r - right.cell.r
    || cellColumn(left.cell) - cellColumn(right.cell)
    || left.markerIndex - right.markerIndex
  ));
  if (!markers.length) return [];

  const targetCount = PLAY_ENEMY_TARGETS[part];
  const spawnCells = getDistributedSpawnCells(map, chapter, origin, targetCount, markers);
  const localCounts = new Map();

  return spawnCells.map((spawn, globalIndex) => {
      const encounterIndex = Math.min(markers.length - 1, Math.floor(globalIndex * markers.length / spawnCells.length));
      const marker = markers[encounterIndex];
      const localIndex = localCounts.get(encounterIndex) ?? 0;
      localCounts.set(encounterIndex, localIndex + 1);
      const configuredEnemyId = encounterEnemyId(part, encounterIndex, markers.length, localIndex, globalIndex);
      const enemyId = isDescentEnemy(marker.marker.enemyId) ? marker.marker.enemyId : configuredEnemyId;
      const definition = ENEMY_DEFINITIONS[enemyId];
      const position = getHexCenter(spawn.cell, origin);
      return {
        instanceId: `map-enemy-${spawn.cellKey}-${globalIndex}`,
        enemyId,
        name: definition.name,
        tier: definition.tier,
        anchorCellKey: marker.cellKey,
        spawnCellKey: spawn.cellKey,
        spawnPattern: spawn.spawnPattern,
        x: position.x,
        y: position.y,
        homeX: position.x,
        homeY: position.y,
        health: definition.maxHealth,
        maxHealth: definition.maxHealth,
        moveSpeed: definition.moveSpeed ?? 0,
        vx: 0,
        vy: 0,
        radius: (4.5 + definition.tier * 0.65) * PLAY_ENEMY_RENDER_SCALE,
        renderSize: (12 + definition.tier * 1.8) * PLAY_ENEMY_RENDER_SCALE,
        visual: PLAY_ENEMY_VISUALS[enemyId] ?? encyclopediaById[enemyId]?.visuals?.idle ?? null,
        phase: ((spawn.cell.q * 31 + spawn.cell.r * 17 + globalIndex * 13) % 360) * Math.PI / 180,
        state: 'idle',
        facing: 'left',
        alerted: false,
        cooldowns: {},
        nextSkillIndex: 0,
        pendingSkill: null,
        defeated: false,
      };
  });
}

const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const angleBetween = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

function attackReach(enemy, skill) {
  return (skill.range ?? skill.radius ?? 44) + enemy.radius + (enemy.actorRadius ?? 6);
}

function preferredDistance(enemy, definition) {
  const contact = definition.attacks.find((skill) => skill.type === 'contact' || skill.type === 'melee');
  if (contact) return Math.max(24, (contact.range ?? contact.radius ?? 44) + enemy.radius + 2);
  const ranged = definition.attacks.find((skill) => skill.range || ['projectile', 'spread', 'lobbed'].includes(skill.type));
  return clampValue((ranged?.range ?? 280) * 0.55, 90, 220);
}

function canUsePlaySkill(enemy, skill, distance) {
  if ((enemy.cooldowns[skill.id] ?? 0) > 0) return false;
  if (skill.type === 'contact' || skill.type === 'melee') return distance <= attackReach(enemy, skill);
  if (skill.type === 'suicideCharge') return distance <= (skill.triggerRange ?? 260);
  return true;
}

function playEnemyDamage(actor, amount, source, onDamage, damageType = 'generic') {
  if (!amount || actor.dead || actor.invulnerability > 0) return;
  if (typeof onDamage === 'function') onDamage(amount, source, damageType);
  else actor.health = Math.max(0, actor.health - amount);
  actor.hurtTimer = Math.max(actor.hurtTimer ?? 0, 0.18);
}

function resolvePlayEnemySkill(enemy, skill, actor, onDamage) {
  const distance = distanceBetween(enemy, actor);
  const source = `${enemy.name}・${skill.name}`;
  const damageType = ['contact', 'melee', 'teleportMelee', 'dash', 'suicideCharge'].includes(skill.type) ? 'generic' : 'ranged';
  if (skill.type === 'teleportMelee' || skill.type === 'dash') {
    const angle = angleBetween(enemy, actor);
    enemy.x = actor.x - Math.cos(angle) * 28;
    enemy.y = actor.y - Math.sin(angle) * 28;
    if (distanceBetween(enemy, actor) <= attackReach(enemy, { ...skill, range: skill.range ?? 56 })) playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
    return;
  }
  if (skill.type === 'contact' || skill.type === 'melee') {
    if (distance <= attackReach(enemy, skill)) {
      const angle = angleBetween(enemy, actor);
      if (skill.id === 'shortThrust' || skill.id === 'wingRam') {
        actor.vx += Math.cos(angle) * 96;
        actor.vy += Math.sin(angle) * 96;
      }
      if (skill.id !== 'shortThrust') playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
    }
    return;
  }
  // The play page intentionally keeps projectiles lightweight: the sandbox
  // owns their full swept collision model, while the authored encounter still
  // needs a deterministic ranged hit cadence in the real map.
  if (skill.type === 'lobbed' || skill.type === 'areaStun' || skill.type === 'gravityField') {
    if (distance <= (skill.radius ?? 96) + actor.radius) playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
    return;
  }
  if (skill.type === 'suicideCharge') {
    if (distance <= (skill.radius ?? 52) + actor.radius) playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
    enemy.defeated = true;
    enemy.health = 0;
    return;
  }
  if (skill.damage > 0) playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
}

/** Advance authored descent enemies in the real play scene. */
export function updatePlayEnemies(enemies, actor, dt, time = 0, onDamage = null, bounds = null, world = null) {
  if (!actor) return;
  enemies.forEach((enemy) => {
    if (enemy.defeated) return;
    const definition = ENEMY_DEFINITIONS[enemy.enemyId];
    if (!definition) return;
    Object.keys(enemy.cooldowns).forEach((key) => { enemy.cooldowns[key] = Math.max(0, enemy.cooldowns[key] - dt); });
    const distance = distanceBetween(enemy, actor);
    if (!enemy.pendingSkill) {
      if (distance <= PLAY_ENEMY_ACTIVATION_RADIUS) enemy.alerted = true;
      else if (distance > PLAY_ENEMY_ACTIVATION_RADIUS * 1.35) enemy.alerted = false;
      if (!enemy.alerted) {
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.state = 'idle';
        return;
      }
    }
    if (enemy.pendingSkill) {
      enemy.pendingSkill.remaining -= dt;
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = 'casting';
      if (enemy.pendingSkill.remaining > 1e-6) return;
      const skill = definition.attacks.find((candidate) => candidate.id === enemy.pendingSkill.skillId);
      enemy.pendingSkill = null;
      if (skill) resolvePlayEnemySkill(enemy, skill, actor, onDamage);
      enemy.state = enemy.defeated ? 'defeated' : 'attacking';
      return;
    }
    const preferred = preferredDistance(enemy, definition);
    if ((enemy.moveSpeed ?? 0) > 0 && distance > preferred) {
      const angle = angleBetween(enemy, actor);
      enemy.vx = Math.cos(angle) * enemy.moveSpeed;
      enemy.vy = Math.sin(angle) * enemy.moveSpeed;
      const nextPosition = { x: enemy.x + enemy.vx * dt, y: enemy.y + enemy.vy * dt };
      const nextCell = world?.map
        ? findCellContainingPoint(world.map, nextPosition, world.chapter ?? 'chapter1', world.origin ?? { x: 0, y: 0 })
        : null;
      if (nextCell?.cell?.terrain === 'blocked') {
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.state = 'blocked';
      } else {
        enemy.x = nextPosition.x;
        enemy.y = nextPosition.y;
        enemy.state = 'chasing';
      }
      if (Math.abs(enemy.vx) > 1) enemy.facing = enemy.vx < 0 ? 'left' : 'right';
      if (bounds) {
        enemy.x = clampValue(enemy.x, bounds.minX, bounds.maxX);
        enemy.y = clampValue(enemy.y, bounds.minY, bounds.maxY);
      }
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = 'attacking';
    }
    const attacks = definition.attacks ?? [];
    if (!attacks.length) return;
    const start = enemy.nextSkillIndex % attacks.length;
    const selected = attacks.map((skill, index) => ({ skill, index: (start + index) % attacks.length }))
      .find(({ skill }) => canUsePlaySkill(enemy, skill, distance));
    if (!selected) return;
    const { skill, index } = selected;
    enemy.nextSkillIndex = (index + 1) % attacks.length;
    enemy.cooldowns[skill.id] = skill.cooldown ?? 0.6;
    const authoredCastTime = Number(skill.castTime ?? skill.telegraph ?? skill.detonationDelay ?? 0);
    const castTime = authoredCastTime > 0 ? authoredCastTime : skill.damage > 0 ? .32 : 0;
    if (castTime > 0) {
      enemy.pendingSkill = { skillId: skill.id, remaining: castTime };
      enemy.state = 'casting';
      return;
    }
    resolvePlayEnemySkill(enemy, skill, actor, onDamage);
  });
}

export function getPlayEnemyPose(enemy, timeSeconds) {
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  return {
    x: enemy.x + Math.cos(time * 0.72 + enemy.phase) * 0.42,
    y: enemy.y + Math.sin(time * 1.08 + enemy.phase) * 0.82,
  };
}

export function isPlayEnemyVisible(enemy, camera, viewport, padding = 48) {
  return enemy.x >= camera.x - padding
    && enemy.x <= camera.x + viewport.width + padding
    && enemy.y >= camera.y - padding
    && enemy.y <= camera.y + viewport.height + padding;
}
