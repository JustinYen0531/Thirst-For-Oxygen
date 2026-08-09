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
export const PLAY_SPECIAL_ENEMY_IDS = Object.freeze([
  'prismCrabGuardian',
  'tideLawNautilus',
  'abyssalSpermWhale',
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
  [...DESCENT_ENEMY_ROSTER, ...PLAY_SPECIAL_ENEMY_IDS].map((enemyId) => {
    const visuals = encyclopediaById[enemyId]?.visuals;
    return [enemyId, visuals?.afterimageIdle ?? visuals?.idle ?? null];
  }),
));

function isDescentEnemy(enemyId) {
  return DESCENT_ENEMY_ROSTER.includes(enemyId);
}

function enemyTierWeight(tier) {
  if (Number.isFinite(Number(tier))) return Number(tier);
  return { miniBoss: 4, mutatedMiniBoss: 5, finalBoss: 6 }[tier] ?? 2;
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
  const specialMarkers = [];

  Object.keys(map.cells).forEach((cellKey) => {
    const cell = getActiveCell(map, cellKey, chapter);
    if (!cell || cell.terrain !== 'water') return;
    (cell.actors ?? []).forEach((marker, markerIndex) => {
      if (marker.kind === 'enemySpawn') markers.push({ cellKey, cell, marker, markerIndex });
      if (['miniBossSpawn', 'bossSpawn'].includes(marker.kind) && ENEMY_DEFINITIONS[marker.enemyId]) {
        specialMarkers.push({ cellKey, cell, marker, markerIndex });
      }
    });
  });

  markers.sort((left, right) => (
    left.cell.r - right.cell.r
    || cellColumn(left.cell) - cellColumn(right.cell)
    || left.markerIndex - right.markerIndex
  ));
  const targetCount = PLAY_ENEMY_TARGETS[part];
  const spawnCells = markers.length ? getDistributedSpawnCells(map, chapter, origin, targetCount, markers) : [];
  const localCounts = new Map();

  const createInstance = ({ enemyId, spawn, anchorCellKey, instanceId, markerKind }) => {
    const definition = ENEMY_DEFINITIONS[enemyId];
    const position = getHexCenter(spawn.cell, origin);
    const tierWeight = enemyTierWeight(definition.tier);
    return {
      instanceId,
      enemyId,
      name: definition.name,
      tier: definition.tier,
      markerKind,
      anchorCellKey,
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
      radius: (4.5 + tierWeight * 0.65) * PLAY_ENEMY_RENDER_SCALE,
      renderSize: (12 + tierWeight * 1.8) * PLAY_ENEMY_RENDER_SCALE,
      visual: PLAY_ENEMY_VISUALS[enemyId] ?? null,
      phase: ((spawn.cell.q * 31 + spawn.cell.r * 17) % 360) * Math.PI / 180,
      state: 'idle',
      facing: 'left',
      alerted: false,
      cooldowns: {},
      nextSkillIndex: 0,
      pendingSkill: null,
      suicideCharge: null,
      stunnedUntil: 0,
      linkedTarget: null,
      linkedTargets: [],
      linkedProtection: null,
      rescueCompleted: false,
      defeated: false,
    };
  };

  const regularEnemies = spawnCells.map((spawn, globalIndex) => {
      const encounterIndex = Math.min(markers.length - 1, Math.floor(globalIndex * markers.length / spawnCells.length));
      const marker = markers[encounterIndex];
      const localIndex = localCounts.get(encounterIndex) ?? 0;
      localCounts.set(encounterIndex, localIndex + 1);
      const configuredEnemyId = encounterEnemyId(part, encounterIndex, markers.length, localIndex, globalIndex);
      const enemyId = isDescentEnemy(marker.marker.enemyId) ? marker.marker.enemyId : configuredEnemyId;
      return createInstance({
        enemyId,
        spawn,
        anchorCellKey: marker.cellKey,
        instanceId: `map-part-${part}-enemy-${spawn.cellKey}-${globalIndex}`,
        markerKind: 'enemySpawn',
      });
  });

  const specialEnemies = specialMarkers.map((entry, index) => createInstance({
    enemyId: entry.marker.enemyId,
    spawn: { cellKey: entry.cellKey, cell: entry.cell, spawnPattern: 'special' },
    anchorCellKey: entry.cellKey,
    instanceId: `map-part-${part}-special-${entry.marker.kind}-${entry.cellKey}-${index}`,
    markerKind: entry.marker.kind,
  }));

  return [...regularEnemies, ...specialEnemies];
}

const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const angleBetween = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);
const playEnemyRuntimes = new WeakMap();

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared > 0
    ? clampValue(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
    : 0;
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
}

function getPlayEnemyRuntime(enemies) {
  let runtime = playEnemyRuntimes.get(enemies);
  if (!runtime) {
    runtime = {
      time: 0,
      projectiles: [],
      zones: [],
      effects: [],
      nextProjectileId: 1,
      nextZoneId: 1,
      nextEffectId: 1,
      nextSummonId: 1,
    };
    playEnemyRuntimes.set(enemies, runtime);
  }
  return runtime;
}

function addPlayEnemyEffect(runtime, effect) {
  const next = {
    id: `play-enemy-effect-${runtime.nextEffectId++}`,
    elapsed: 0,
    duration: 0.6,
    ...effect,
  };
  runtime.effects.push(next);
  return next;
}

function tickPlayEnemyEffects(runtime, dt) {
  runtime.effects = runtime.effects.filter((effect) => {
    effect.elapsed += dt;
    return effect.elapsed < effect.duration;
  });
}

function activePlayEnemies(enemies) {
  return enemies.filter((enemy) => !enemy.defeated && Number(enemy.health) > 0);
}

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
  if (skill.type === 'summon' && enemy.enemyId === 'juvenileSeahorseCaller') {
    return !enemy.rescueCompleted && distance <= (skill.summonRadius ?? 190);
  }
  if (skill.type === 'link' || skill.type === 'split') return false;
  if (['projectile', 'spread', 'boomerangSpread', 'shieldBoomerang', 'cloneBarrage'].includes(skill.type)) {
    return distance <= (skill.range ?? 520);
  }
  return true;
}

function playEnemyDamage(actor, amount, source, onDamage, damageType = 'generic') {
  if (!amount || actor.dead || actor.invulnerability > 0) return;
  if (typeof onDamage === 'function') onDamage(amount, source, damageType);
  else actor.health = Math.max(0, actor.health - amount);
  actor.hurtTimer = Math.max(actor.hurtTimer ?? 0, 0.18);
}

function spawnPlayEnemyProjectiles(runtime, enemy, skill, target) {
  const count = Math.max(1, Math.round(skill.projectileCount ?? 1));
  const spread = ((skill.spreadDegrees ?? (count > 1 ? 18 : 0)) * Math.PI) / 180;
  const centre = angleBetween(enemy, target);
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0 : index / (count - 1) - 0.5;
    const angle = centre + ratio * spread;
    const speed = Math.max(1, Number(skill.projectileSpeed ?? 280));
    runtime.projectiles.push({
      id: `play-enemy-projectile-${runtime.nextProjectileId++}`,
      ownerId: enemy.instanceId,
      enemyId: enemy.enemyId,
      skillId: skill.id,
      skillName: skill.name,
      x: enemy.x,
      y: enemy.y,
      previousX: enemy.x,
      previousY: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      radius: skill.projectileRadius ?? 6,
      remainingDistance: skill.range ?? 360,
      damage: skill.damage ?? 0,
      applies: skill.applies ?? null,
      effectDuration: skill.duration ?? 0,
      colour: skill.type === 'spread' ? '#d6b6ff' : '#a5e8ff',
    });
  }
  addPlayEnemyEffect(runtime, {
    type: 'projectileVolley',
    ownerId: enemy.instanceId,
    skillId: skill.id,
    x: enemy.x,
    y: enemy.y,
    targetX: target.x,
    targetY: target.y,
    projectileCount: count,
    duration: 0.3,
  });
}

function updatePlayEnemyProjectiles(runtime, actor, dt, onDamage) {
  runtime.projectiles = runtime.projectiles.filter((projectile) => {
    const previous = { x: projectile.x, y: projectile.y };
    const travel = Math.hypot(projectile.vx, projectile.vy) * dt;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.remainingDistance -= travel;
    if (distanceToSegment(actor, previous, projectile) <= (actor.radius ?? 0) + projectile.radius) {
      playEnemyDamage(actor, projectile.damage, `${projectile.enemyId}・${projectile.skillName}`, onDamage, 'ranged');
      if (projectile.applies) {
        actor.activeEffects ??= {};
        actor.activeEffects[projectile.applies] = {
          remaining: projectile.effectDuration,
          source: projectile.skillId,
        };
      }
      addPlayEnemyEffect(runtime, {
        type: 'projectileImpact',
        ownerId: projectile.ownerId,
        skillId: projectile.skillId,
        x: projectile.x,
        y: projectile.y,
        duration: 0.3,
      });
      return false;
    }
    return projectile.remainingDistance > 0;
  });
}

function updatePlayEnemyZones(runtime, actor, dt, onDamage) {
  runtime.zones = runtime.zones.filter((zone) => {
    zone.remaining -= dt;
    if (zone.remaining > 1e-6) return true;
    if (distanceBetween(zone, actor) <= zone.radius + (actor.radius ?? 0)) {
      playEnemyDamage(actor, zone.damage, zone.source, onDamage, 'ranged');
    }
    addPlayEnemyEffect(runtime, {
      type: 'areaImpact',
      ownerId: zone.ownerId,
      skillId: zone.skillId,
      x: zone.x,
      y: zone.y,
      radius: zone.radius,
      duration: 0.55,
    });
    return false;
  });
}

function createSummonedPlayEnemy(runtime, enemyId, summoner, x, y, index) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  const tierWeight = enemyTierWeight(definition.tier);
  return {
    instanceId: `play-summon-${summoner.instanceId}-${runtime.nextSummonId++}-${index}`,
    enemyId,
    name: definition.name,
    tier: definition.tier,
    markerKind: 'summoned',
    anchorCellKey: summoner.anchorCellKey ?? null,
    spawnCellKey: null,
    spawnPattern: 'summoned',
    summonedBy: summoner.instanceId,
    x,
    y,
    homeX: x,
    homeY: y,
    health: definition.maxHealth,
    maxHealth: definition.maxHealth,
    moveSpeed: definition.moveSpeed ?? 0,
    vx: 0,
    vy: 0,
    radius: (4.5 + tierWeight * 0.65) * PLAY_ENEMY_RENDER_SCALE,
    renderSize: (12 + tierWeight * 1.8) * PLAY_ENEMY_RENDER_SCALE,
    visual: PLAY_ENEMY_VISUALS[enemyId] ?? null,
    phase: (runtime.nextSummonId * 47 % 360) * Math.PI / 180,
    state: 'idle',
    facing: index % 2 ? 'left' : 'right',
    alerted: true,
    cooldowns: {},
    nextSkillIndex: 0,
    pendingSkill: null,
    suicideCharge: null,
    stunnedUntil: 0,
    linkedTarget: null,
    linkedTargets: [],
    linkedProtection: null,
    rescueCompleted: false,
    defeated: false,
  };
}

function summonJuvenileHelp(runtime, enemies, enemy, skill, bounds) {
  const count = clampValue(Math.round(skill.summonCount ?? 2), 1, 8);
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count;
    const enemyId = DESCENT_CORE_ENEMIES[(runtime.nextSummonId + index - 1) % DESCENT_CORE_ENEMIES.length];
    let x = enemy.x + Math.cos(angle) * 34;
    let y = enemy.y + Math.sin(angle) * 34;
    if (bounds) {
      x = clampValue(x, bounds.minX, bounds.maxX);
      y = clampValue(y, bounds.minY, bounds.maxY);
    }
    enemies.push(createSummonedPlayEnemy(runtime, enemyId, enemy, x, y, index));
  }
  enemy.rescueCompleted = true;
  addPlayEnemyEffect(runtime, {
    type: 'summon',
    ownerId: enemy.instanceId,
    skillId: skill.id,
    x: enemy.x,
    y: enemy.y,
    count,
    duration: 0.9,
  });
}

function updateLinkedSupport(runtime, enemies, enemy, definition, dt) {
  if (enemy.enemyId !== 'coralBackSeahorse') return;
  const link = definition.attacks.find((skill) => skill.type === 'link');
  if (!link) return;
  const previous = new Set(enemy.linkedTargets ?? []);
  const targets = activePlayEnemies(enemies).filter((candidate) => (
    candidate !== enemy
    && candidate.tier === 2
    && distanceBetween(enemy, candidate) <= (link.linkRange ?? 180)
  ));
  const nextIds = new Set(targets.map((candidate) => candidate.instanceId));
  previous.forEach((targetId) => {
    if (nextIds.has(targetId)) return;
    const target = enemies.find((candidate) => candidate.instanceId === targetId);
    if (target?.linkedProtection === enemy.instanceId) target.linkedProtection = null;
  });
  enemy.linkedTargets = [...nextIds];
  enemy.linkedTarget = enemy.linkedTargets[0] ?? null;
  let totalHeal = 0;
  targets.forEach((target) => {
    target.linkedProtection = link.linkedInvulnerable ? enemy.instanceId : null;
    const heal = target.maxHealth * (link.healPerSecondRatio ?? 0.03) * dt;
    const before = target.health;
    target.health = Math.min(target.maxHealth, target.health + heal);
    totalHeal += target.health - before;
  });
  enemy.health = Math.min(enemy.maxHealth, enemy.health + totalHeal);
  if (targets.length && !previous.size) {
    addPlayEnemyEffect(runtime, {
      type: 'lifeLink',
      ownerId: enemy.instanceId,
      targetIds: [...nextIds],
      x: enemy.x,
      y: enemy.y,
      duration: 0.8,
    });
  }
}

function beginSuicideCharge(runtime, enemy, skill, actor) {
  enemy.suicideCharge = {
    skillId: skill.id,
    phase: 'seeking',
    targetX: actor.x,
    targetY: actor.y,
    remaining: skill.detonationDelay ?? 1,
  };
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.state = 'charging';
  addPlayEnemyEffect(runtime, {
    type: 'lockedTarget',
    ownerId: enemy.instanceId,
    skillId: skill.id,
    x: actor.x,
    y: actor.y,
    radius: skill.radius ?? 52,
    duration: 0.8,
  });
}

function updateSuicideCharge(runtime, enemy, definition, actor, dt, onDamage, bounds) {
  const charge = enemy.suicideCharge;
  if (!charge) return false;
  const skill = definition.attacks.find((candidate) => candidate.id === charge.skillId);
  if (!skill) {
    enemy.suicideCharge = null;
    return false;
  }
  if (charge.phase === 'seeking') {
    const target = { x: charge.targetX, y: charge.targetY };
    const distance = distanceBetween(enemy, target);
    const travel = (enemy.moveSpeed ?? definition.moveSpeed ?? 0) * dt;
    if (distance <= Math.max(8, travel)) {
      enemy.x = target.x;
      enemy.y = target.y;
      charge.phase = 'detonating';
      charge.remaining = skill.detonationDelay ?? 1;
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = 'detonating';
      addPlayEnemyEffect(runtime, {
        type: 'detonationTelegraph',
        ownerId: enemy.instanceId,
        skillId: skill.id,
        x: enemy.x,
        y: enemy.y,
        radius: skill.radius ?? 52,
        duration: charge.remaining,
      });
    } else {
      const angle = angleBetween(enemy, target);
      enemy.vx = Math.cos(angle) * (enemy.moveSpeed ?? definition.moveSpeed ?? 0);
      enemy.vy = Math.sin(angle) * (enemy.moveSpeed ?? definition.moveSpeed ?? 0);
      enemy.x += Math.cos(angle) * travel;
      enemy.y += Math.sin(angle) * travel;
      enemy.state = 'charging';
      if (Math.abs(enemy.vx) > 1) enemy.facing = enemy.vx < 0 ? 'left' : 'right';
      if (bounds) {
        enemy.x = clampValue(enemy.x, bounds.minX, bounds.maxX);
        enemy.y = clampValue(enemy.y, bounds.minY, bounds.maxY);
      }
    }
    return true;
  }
  charge.remaining -= dt;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.state = 'detonating';
  if (charge.remaining > 1e-6) return true;
  const origin = { x: charge.targetX, y: charge.targetY };
  if (distanceBetween(origin, actor) <= (skill.radius ?? 52) + (actor.radius ?? 0)) {
    playEnemyDamage(actor, skill.damage, `${enemy.name}・${skill.name}`, onDamage, 'generic');
  }
  addPlayEnemyEffect(runtime, {
    type: 'detonation',
    ownerId: enemy.instanceId,
    skillId: skill.id,
    x: origin.x,
    y: origin.y,
    radius: skill.radius ?? 52,
    duration: 0.7,
  });
  enemy.suicideCharge = null;
  enemy.defeated = true;
  enemy.health = 0;
  enemy.state = 'defeated';
  return true;
}

function resolvePlayEnemySkill(runtime, enemies, enemy, skill, actor, onDamage, lockedTarget = null, bounds = null) {
  const distance = distanceBetween(enemy, actor);
  const source = `${enemy.name}・${skill.name}`;
  const damageType = ['contact', 'melee', 'teleportMelee', 'dash'].includes(skill.type) ? 'generic' : 'ranged';
  enemy.lastResolvedSkill = { skillId: skill.id, skillType: skill.type, resolvedAt: runtime.time, supported: true };
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
        actor.vx = (actor.vx ?? 0) + Math.cos(angle) * 96;
        actor.vy = (actor.vy ?? 0) + Math.sin(angle) * 96;
      }
      if (skill.id !== 'shortThrust') playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
    }
    return;
  }
  if (['projectile', 'spread', 'boomerangSpread', 'shieldBoomerang', 'cloneBarrage'].includes(skill.type)) {
    spawnPlayEnemyProjectiles(runtime, enemy, skill, lockedTarget ?? actor);
    return;
  }
  if (skill.type === 'lobbed') {
    const target = lockedTarget ?? actor;
    runtime.zones.push({
      id: `play-enemy-zone-${runtime.nextZoneId++}`,
      ownerId: enemy.instanceId,
      skillId: skill.id,
      x: target.x,
      y: target.y,
      radius: skill.radius ?? 56,
      remaining: 0.28,
      damage: skill.damage ?? 0,
      source,
    });
    return;
  }
  if (skill.type === 'areaStun' || skill.type === 'gravityField') {
    if (distance <= (skill.radius ?? 96) + (actor.radius ?? 0)) {
      playEnemyDamage(actor, skill.damage, source, onDamage, damageType);
      if (skill.stun) {
        actor.stunnedUntil = Math.max(actor.stunnedUntil ?? 0, runtime.time + skill.stun);
        actor.vx = 0;
        actor.vy = 0;
      }
    }
    addPlayEnemyEffect(runtime, { type: skill.type, ownerId: enemy.instanceId, skillId: skill.id, x: enemy.x, y: enemy.y, radius: skill.radius ?? 96, duration: skill.duration ?? 0.75 });
    return;
  }
  if (skill.type === 'summon' && enemy.enemyId === 'juvenileSeahorseCaller') {
    summonJuvenileHelp(runtime, enemies, enemy, skill, bounds);
    return;
  }
  if (skill.type === 'supportPulse') {
    const healedIds = [];
    activePlayEnemies(enemies).forEach((candidate) => {
      if (distanceBetween(enemy, candidate) > (skill.radius ?? 110)) return;
      candidate.health = Math.min(candidate.maxHealth, candidate.health + candidate.maxHealth * (skill.healRatio ?? 0.08));
      healedIds.push(candidate.instanceId);
    });
    addPlayEnemyEffect(runtime, { type: 'supportPulse', ownerId: enemy.instanceId, skillId: skill.id, x: enemy.x, y: enemy.y, radius: skill.radius ?? 110, healedIds, duration: 0.9 });
    return;
  }
  // Complex Mini Boss/Boss contracts remain renderable but cannot silently
  // become unavoidable global damage merely because their type is not yet
  // simulated by the formal play scene.
  enemy.lastResolvedSkill.supported = false;
  addPlayEnemyEffect(runtime, {
    type: 'unsupportedSkill',
    ownerId: enemy.instanceId,
    skillId: skill.id,
    skillType: skill.type,
    x: enemy.x,
    y: enemy.y,
    targetX: lockedTarget?.x ?? actor.x,
    targetY: lockedTarget?.y ?? actor.y,
    damageSuppressed: true,
    duration: 0.8,
  });
}

/** Advance authored descent enemies in the real play scene. */
export function updatePlayEnemies(enemies, actor, dt, time = null, onDamage = null, bounds = null, world = null) {
  if (!actor) return;
  const elapsed = Math.max(0, Number(dt) || 0);
  const runtime = getPlayEnemyRuntime(enemies);
  runtime.time = Number.isFinite(time) ? time : runtime.time + elapsed;
  tickPlayEnemyEffects(runtime, elapsed);
  updatePlayEnemyProjectiles(runtime, actor, elapsed, onDamage);
  updatePlayEnemyZones(runtime, actor, elapsed, onDamage);
  enemies.forEach((candidate) => {
    if (!candidate.linkedProtection) return;
    const protector = enemies.find((enemy) => enemy.instanceId === candidate.linkedProtection);
    if (!protector || protector.defeated || !protector.linkedTargets?.includes(candidate.instanceId)) candidate.linkedProtection = null;
  });
  [...enemies].forEach((enemy) => {
    if (enemy.defeated) return;
    const definition = ENEMY_DEFINITIONS[enemy.enemyId];
    if (!definition) return;
    enemy.cooldowns ??= {};
    enemy.linkedTargets ??= [];
    if ((enemy.stunnedUntil ?? 0) > runtime.time) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = 'stunned';
      return;
    }
    if ((enemy.stunnedUntil ?? 0) > 0) enemy.stunnedUntil = 0;
    Object.keys(enemy.cooldowns).forEach((key) => { enemy.cooldowns[key] = Math.max(0, enemy.cooldowns[key] - elapsed); });
    updateLinkedSupport(runtime, enemies, enemy, definition, elapsed);
    if (updateSuicideCharge(runtime, enemy, definition, actor, elapsed, onDamage, bounds)) return;
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
      enemy.pendingSkill.remaining -= elapsed;
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.state = 'casting';
      if (enemy.pendingSkill.remaining > 1e-6) return;
      const pending = enemy.pendingSkill;
      const skill = definition.attacks.find((candidate) => candidate.id === pending.skillId);
      enemy.pendingSkill = null;
      if (skill) resolvePlayEnemySkill(runtime, enemies, enemy, skill, actor, onDamage, { x: pending.targetX, y: pending.targetY }, bounds);
      enemy.state = enemy.defeated ? 'defeated' : 'attacking';
      return;
    }
    const preferred = preferredDistance(enemy, definition);
    if ((enemy.moveSpeed ?? 0) > 0 && distance > preferred) {
      const angle = angleBetween(enemy, actor);
      enemy.vx = Math.cos(angle) * enemy.moveSpeed;
      enemy.vy = Math.sin(angle) * enemy.moveSpeed;
      const nextPosition = { x: enemy.x + enemy.vx * elapsed, y: enemy.y + enemy.vy * elapsed };
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
    enemy.cooldowns[skill.id] = Math.max(0.2, Number(skill.cooldown ?? 0.6));
    if (skill.type === 'suicideCharge') {
      beginSuicideCharge(runtime, enemy, skill, actor);
      return;
    }
    const authoredCastTime = Number(skill.castTime ?? skill.telegraph ?? 0);
    const castTime = authoredCastTime > 0 ? authoredCastTime : skill.damage > 0 ? .32 : 0;
    if (castTime > 0) {
      enemy.pendingSkill = {
        skillId: skill.id,
        remaining: castTime,
        targetX: actor.x,
        targetY: actor.y,
      };
      enemy.state = 'casting';
      addPlayEnemyEffect(runtime, {
        type: 'telegraph',
        ownerId: enemy.instanceId,
        skillId: skill.id,
        x: actor.x,
        y: actor.y,
        radius: skill.radius ?? skill.range ?? enemy.radius + 18,
        duration: castTime,
      });
      return;
    }
    resolvePlayEnemySkill(runtime, enemies, enemy, skill, actor, onDamage, { x: actor.x, y: actor.y }, bounds);
  });
  return getPlayEnemyRenderState(enemies, runtime.time);
}

export function getPlayEnemyRenderState(enemies, time = null) {
  const runtime = getPlayEnemyRuntime(enemies);
  const now = Number.isFinite(time) ? time : runtime.time;
  return {
    time: now,
    projectiles: runtime.projectiles.map((projectile) => ({ ...projectile })),
    zones: runtime.zones.map((zone) => ({ ...zone })),
    effects: runtime.effects.map((effect) => ({ ...effect })),
    enemies: enemies.map((enemy) => ({
      instanceId: enemy.instanceId,
      enemyId: enemy.enemyId,
      state: enemy.state,
      stunnedRemaining: Math.max(0, (enemy.stunnedUntil ?? 0) - now),
      pendingSkill: enemy.pendingSkill ? { ...enemy.pendingSkill } : null,
      suicideCharge: enemy.suicideCharge ? { ...enemy.suicideCharge } : null,
      linkedTarget: enemy.linkedTarget ?? null,
      linkedTargets: [...(enemy.linkedTargets ?? [])],
      linkedProtection: enemy.linkedProtection ?? null,
      summonedBy: enemy.summonedBy ?? null,
      lastResolvedSkill: enemy.lastResolvedSkill ? { ...enemy.lastResolvedSkill } : null,
    })),
  };
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
