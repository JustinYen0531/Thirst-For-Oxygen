import { ENEMY_DEFINITIONS } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import { findCellContainingPoint, getActiveCell, getHexCenter } from './map-model.js';

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

function candidateScore(candidate, marker, origin) {
  const position = getHexCenter(candidate.cell, origin);
  const anchor = getHexCenter(marker.cell, origin);
  const regionPenalty = candidate.cell.region === marker.cell.region ? 0 : 100000;
  const occupiedPenalty = (candidate.cell.objects?.length || candidate.cell.freeObjects?.length) ? 10000 : 0;
  return regionPenalty + occupiedPenalty + (position.x - anchor.x) ** 2 + (position.y - anchor.y) ** 2;
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
  const baseGroupSize = Math.floor(targetCount / markers.length);
  const largerGroupCount = targetCount % markers.length;
  const candidates = getWaterCandidates(map, chapter);
  const usedCellKeys = new Set();
  const enemies = [];

  markers.forEach((marker, encounterIndex) => {
    const groupSize = baseGroupSize + (encounterIndex < largerGroupCount ? 1 : 0);
    const nearbyCells = candidates
      .filter((candidate) => !usedCellKeys.has(candidate.cellKey))
      .sort((left, right) => (
        candidateScore(left, marker, origin) - candidateScore(right, marker, origin)
        || left.cell.r - right.cell.r
        || cellColumn(left.cell) - cellColumn(right.cell)
      ));

    for (let localIndex = 0; localIndex < groupSize; localIndex += 1) {
      const candidate = nearbyCells.find(({ cellKey }) => !usedCellKeys.has(cellKey));
      const spawnCellKey = candidate?.cellKey ?? marker.cellKey;
      const spawnCell = candidate?.cell ?? marker.cell;
      if (candidate) usedCellKeys.add(candidate.cellKey);
      const globalIndex = enemies.length;
      const configuredEnemyId = encounterEnemyId(part, encounterIndex, markers.length, localIndex, globalIndex);
      const enemyId = isDescentEnemy(marker.marker.enemyId) ? marker.marker.enemyId : configuredEnemyId;
      const definition = ENEMY_DEFINITIONS[enemyId];
      const position = getHexCenter(spawnCell, origin);
      const repeatedOffset = candidate ? { x: 0, y: 0 } : {
        x: Math.cos(localIndex * 2.4) * (3 + localIndex),
        y: Math.sin(localIndex * 2.4) * (3 + localIndex),
      };
      enemies.push({
        instanceId: `map-enemy-${marker.cellKey}-${marker.markerIndex}-${localIndex}`,
        enemyId,
        name: definition.name,
        tier: definition.tier,
        anchorCellKey: marker.cellKey,
        spawnCellKey,
        x: position.x + repeatedOffset.x,
        y: position.y + repeatedOffset.y,
        health: definition.maxHealth,
        maxHealth: definition.maxHealth,
        moveSpeed: definition.moveSpeed ?? 0,
        vx: 0,
        vy: 0,
        radius: (4.5 + definition.tier * 0.65) * PLAY_ENEMY_RENDER_SCALE,
        renderSize: (12 + definition.tier * 1.8) * PLAY_ENEMY_RENDER_SCALE,
        visual: PLAY_ENEMY_VISUALS[enemyId] ?? encyclopediaById[enemyId]?.visuals?.idle ?? null,
        phase: ((spawnCell.q * 31 + spawnCell.r * 17 + globalIndex * 13) % 360) * Math.PI / 180,
        state: 'idle',
        facing: 'left',
        cooldowns: {},
        nextSkillIndex: 0,
        pendingSkill: null,
        defeated: false,
      });
    }
  });

  return enemies;
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

function playEnemyDamage(actor, amount, source, onDamage) {
  if (!amount || actor.dead || actor.invulnerability > 0) return;
  if (typeof onDamage === 'function') onDamage(amount, source);
  else actor.health = Math.max(0, actor.health - amount);
  actor.hurtTimer = Math.max(actor.hurtTimer ?? 0, 0.18);
}

function resolvePlayEnemySkill(enemy, skill, actor, onDamage) {
  const distance = distanceBetween(enemy, actor);
  const source = `${enemy.name}・${skill.name}`;
  if (skill.type === 'teleportMelee' || skill.type === 'dash') {
    const angle = angleBetween(enemy, actor);
    enemy.x = actor.x - Math.cos(angle) * 28;
    enemy.y = actor.y - Math.sin(angle) * 28;
    if (distanceBetween(enemy, actor) <= attackReach(enemy, { ...skill, range: skill.range ?? 56 })) playEnemyDamage(actor, skill.damage, source, onDamage);
    return;
  }
  if (skill.type === 'contact' || skill.type === 'melee') {
    if (distance <= attackReach(enemy, skill)) playEnemyDamage(actor, skill.damage, source, onDamage);
    return;
  }
  // The play page intentionally keeps projectiles lightweight: the sandbox
  // owns their full swept collision model, while the authored encounter still
  // needs a deterministic ranged hit cadence in the real map.
  if (skill.type === 'lobbed' || skill.type === 'areaStun' || skill.type === 'gravityField') {
    if (distance <= (skill.radius ?? 96) + actor.radius) playEnemyDamage(actor, skill.damage, source, onDamage);
    return;
  }
  if (skill.type === 'suicideCharge') {
    if (distance <= (skill.radius ?? 52) + actor.radius) playEnemyDamage(actor, skill.damage, source, onDamage);
    enemy.defeated = true;
    enemy.health = 0;
    return;
  }
  if (skill.damage > 0) playEnemyDamage(actor, skill.damage, source, onDamage);
}

/** Advance authored descent enemies in the real play scene. */
export function updatePlayEnemies(enemies, actor, dt, time = 0, onDamage = null, bounds = null, world = null) {
  if (!actor) return;
  enemies.forEach((enemy) => {
    if (enemy.defeated) return;
    const definition = ENEMY_DEFINITIONS[enemy.enemyId];
    if (!definition) return;
    Object.keys(enemy.cooldowns).forEach((key) => { enemy.cooldowns[key] = Math.max(0, enemy.cooldowns[key] - dt); });
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
    const distance = distanceBetween(enemy, actor);
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
    const castTime = skill.type === 'lobbed' || skill.type === 'suicideCharge' ? 0 : Number(skill.castTime ?? skill.telegraph ?? 0);
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
