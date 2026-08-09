import { ENEMY_DEFINITIONS, getEnemyDamageToPlayer, getEnemyProjectileSpeed } from './game-data.js';
import { ENEMY_ENCYCLOPEDIA } from './enemy-encyclopedia.js';
import { easeEnemyVelocity, getEnemyLoiterPlan, syncEnemyFacing } from './enemy-movement.js';
import {
  DIRECTIONS,
  HEX_SIZE,
  edgeKey,
  findCellContainingPoint,
  getActiveCell,
  getActiveEdge,
  getHexCenter,
  neighborKey,
} from './map-model.js';

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
export const PLAY_ENEMY_ACTION_VISUAL_HOLD = 1.44;
export const PLAY_ENEMY_FRAME_COUNT = 6;
export const PLAY_ENEMY_FRAME_DURATION = 0.18;

const encyclopediaById = Object.freeze(Object.fromEntries(
  ENEMY_ENCYCLOPEDIA.map((entry) => [entry.id, entry]),
));

export const PLAY_ENEMY_VISUAL_SETS = Object.freeze(Object.fromEntries(
  [...DESCENT_ENEMY_ROSTER, ...PLAY_SPECIAL_ENEMY_IDS].map((enemyId) => {
    const visuals = encyclopediaById[enemyId]?.visuals;
    return [enemyId, Object.freeze({
      idle: visuals?.afterimageIdle ?? visuals?.idle ?? null,
      actions: Object.freeze({ ...(visuals?.afterimageActions ?? visuals?.actions ?? {}) }),
    })];
  }),
));

// Backwards-compatible idle lookup for spawn data and external diagnostics.
export const PLAY_ENEMY_VISUALS = Object.freeze(Object.fromEntries(
  Object.entries(PLAY_ENEMY_VISUAL_SETS).map(([enemyId, visualSet]) => [enemyId, visualSet.idle]),
));

export const PLAY_ENEMY_ANIMATED_ASSET_PATHS = Object.freeze([...new Set(
  Object.values(PLAY_ENEMY_VISUAL_SETS).flatMap((visualSet) => [visualSet.idle, ...Object.values(visualSet.actions)]).filter(Boolean),
)]);

export function getPlayEnemyFramePaths(animatedPath) {
  const match = String(animatedPath ?? '').match(/^\/assets\/enemies-afterimage\/([^/]+)\/reconstructed-preview__(.+)\.webp$/i);
  if (!match) return Object.freeze([]);
  const [, enemyId, animationSlug] = match;
  return Object.freeze(Array.from({ length: PLAY_ENEMY_FRAME_COUNT }, (_, index) => (
    `/assets/enemy-frames/${enemyId}/${animationSlug}/${String(index + 1).padStart(2, '0')}.png`
  )));
}

export const PLAY_ENEMY_ASSET_PATHS = Object.freeze(
  PLAY_ENEMY_ANIMATED_ASSET_PATHS.flatMap((animatedPath) => getPlayEnemyFramePaths(animatedPath)),
);

function activeEnemyVisualAction(enemy, now) {
  const explicit = enemy.visualAction;
  if (explicit) {
    const isCasting = enemy.pendingSkill?.skillId === explicit.skillId;
    const isCharging = enemy.suicideCharge?.skillId === explicit.skillId;
    if (isCasting || isCharging || now <= Number(explicit.holdUntil ?? -Infinity)) return explicit;
  }
  if (enemy.pendingSkill?.skillId) {
    return {
      skillId: enemy.pendingSkill.skillId,
      sequence: enemy.pendingSkill.visualSequence ?? 0,
      startedAt: enemy.pendingSkill.startedAt ?? now,
    };
  }
  if (enemy.suicideCharge?.skillId) {
    return {
      skillId: enemy.suicideCharge.skillId,
      sequence: enemy.suicideCharge.visualSequence ?? 0,
      startedAt: enemy.suicideCharge.startedAt ?? now,
    };
  }
  const resolved = enemy.lastResolvedSkill;
  if (resolved?.supported !== false && Number.isFinite(resolved?.resolvedAt)
    && now - resolved.resolvedAt <= PLAY_ENEMY_ACTION_VISUAL_HOLD) {
    return {
      skillId: resolved.skillId,
      sequence: resolved.visualSequence ?? 0,
      startedAt: resolved.resolvedAt,
    };
  }
  return null;
}

export function getPlayEnemyVisualState(enemy, time = 0) {
  const now = Number.isFinite(time) ? time : 0;
  const visualSet = PLAY_ENEMY_VISUAL_SETS[enemy?.enemyId];
  if (!visualSet) return Object.freeze({ path: null, mode: 'missing', actionId: null, playbackKey: 'missing' });
  const activeAction = activeEnemyVisualAction(enemy, now);
  const actionPath = activeAction ? visualSet.actions[activeAction.skillId] : null;
  if (actionPath) {
    return Object.freeze({
      path: actionPath,
      mode: 'action',
      actionId: activeAction.skillId,
      playbackKey: `${enemy.instanceId ?? enemy.enemyId}:${activeAction.skillId}:${activeAction.sequence ?? activeAction.startedAt ?? 0}`,
    });
  }
  return Object.freeze({
    path: visualSet.idle,
    mode: 'idle',
    actionId: null,
    playbackKey: `${enemy.instanceId ?? enemy.enemyId}:idle`,
  });
}

export function getPlayEnemyFrameState(enemy, time = 0) {
  const now = Number.isFinite(time) ? time : 0;
  const visualState = getPlayEnemyVisualState(enemy, now);
  const framePaths = getPlayEnemyFramePaths(visualState.path);
  if (!framePaths.length) return Object.freeze({ ...visualState, animatedPath: visualState.path, frameIndex: 0, frameCount: 0 });
  const activeAction = visualState.mode === 'action' ? activeEnemyVisualAction(enemy, now) : null;
  const idleOffset = ((Number(enemy?.phase) || 0) / (Math.PI * 2)) * PLAY_ENEMY_FRAME_COUNT * PLAY_ENEMY_FRAME_DURATION;
  const elapsed = visualState.mode === 'action'
    ? Math.max(0, now - Number(activeAction?.startedAt ?? now))
    : Math.max(0, now + idleOffset);
  const frameIndex = Math.floor(elapsed / PLAY_ENEMY_FRAME_DURATION) % PLAY_ENEMY_FRAME_COUNT;
  return Object.freeze({
    ...visualState,
    animatedPath: visualState.path,
    path: framePaths[frameIndex],
    frameIndex,
    frameCount: PLAY_ENEMY_FRAME_COUNT,
  });
}

function beginPlayEnemyVisualAction(enemy, skillId, time) {
  const sequence = (enemy.visualActionSequence ?? 0) + 1;
  enemy.visualActionSequence = sequence;
  enemy.visualAction = {
    skillId,
    sequence,
    startedAt: time,
    holdUntil: time + PLAY_ENEMY_ACTION_VISUAL_HOLD,
  };
  return enemy.visualAction;
}

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

function isReachableWaterCell(map, key, chapter, openedGates) {
  const cell = getActiveCell(map, key, chapter);
  return cell?.terrain === 'water' || Boolean(cell?.conditionalGate && openedGates.has(key));
}

function canTraversePlayCells(map, fromKey, toKey, chapter, openedGates) {
  const from = getActiveCell(map, fromKey, chapter);
  const to = getActiveCell(map, toKey, chapter);
  if (!from || !to || !isReachableWaterCell(map, toKey, chapter, openedGates)) return false;
  const edge = getActiveEdge(map, edgeKey(fromKey, toKey), chapter);
  if (edge?.blocksPassage && edge.type !== 'layerPortal') return false;
  if (from.waterLayer !== to.waterLayer && edge?.type !== 'layerPortal') return false;
  return true;
}

function getPlayPortalDestinations(map, chapter, openedGates) {
  const destinations = new Map();
  Object.keys(map.edges).forEach((key) => {
    const edge = getActiveEdge(map, key, chapter);
    if (edge?.type !== 'multiPortal' || !edge.portalTargetKey) return;
    const sourceCellKey = edge.cells?.find((cellKey) => isReachableWaterCell(map, cellKey, chapter, openedGates));
    const target = getActiveEdge(map, edge.portalTargetKey, chapter);
    const targetCellKey = target?.cells?.find((cellKey) => isReachableWaterCell(map, cellKey, chapter, openedGates));
    if (sourceCellKey && targetCellKey) destinations.set(sourceCellKey, targetCellKey);
  });
  return destinations;
}

function getReachablePlayCellsForOpenedGates(map, chapter, openedGates) {
  const start = Object.keys(map.cells).find((key) => (
    getActiveCell(map, key, chapter)?.actors?.some((actor) => actor.kind === 'playerStart')
  ));
  if (!start) return new Set();
  const portals = getPlayPortalDestinations(map, chapter, openedGates);
  const reachable = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const key = queue.shift();
    DIRECTIONS.forEach((_, direction) => {
      const next = neighborKey(key, direction);
      if (reachable.has(next) || !canTraversePlayCells(map, key, next, chapter, openedGates)) return;
      reachable.add(next);
      queue.push(next);
    });
    const portalDestination = portals.get(key);
    if (portalDestination && !reachable.has(portalDestination)) {
      reachable.add(portalDestination);
      queue.push(portalDestination);
    }
  }
  return reachable;
}

export function getReachablePlayCellKeys(map, chapter = 'chapter1') {
  const openedGates = new Set();
  let reachable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    reachable = getReachablePlayCellsForOpenedGates(map, chapter, openedGates);
    reachable.forEach((key) => {
      const cell = getActiveCell(map, key, chapter);
      [...(cell?.objects ?? []), ...(cell?.freeObjects ?? [])].forEach((object) => {
        if (object.kind !== 'button') return;
        (object.targetGates ?? []).forEach((gateKey) => {
          if (openedGates.has(gateKey)) return;
          openedGates.add(gateKey);
          changed = true;
        });
      });
    });
  }
  return reachable;
}

function getWaterCandidates(map, chapter) {
  const reachable = getReachablePlayCellKeys(map, chapter);
  return Object.keys(map.cells).flatMap((cellKey) => {
    const cell = getActiveCell(map, cellKey, chapter);
    if (!cell || cell.terrain !== 'water' || !reachable.has(cellKey) || cell.actors?.some((actor) => actor.kind === 'playerStart')) return [];
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
  const authoredTargetCount = Number(map?.metadata?.enemyTargetCount);
  const targetCount = Number.isFinite(authoredTargetCount)
    ? Math.max(1, Math.min(96, Math.round(authoredTargetCount)))
    : PLAY_ENEMY_TARGETS[part];
  const spawnCells = markers.length ? getDistributedSpawnCells(map, chapter, origin, targetCount, markers) : [];
  const localCounts = new Map();

  const createInstance = ({ enemyId, spawn, anchorCellKey, instanceId, markerKind }) => {
    const definition = ENEMY_DEFINITIONS[enemyId];
    const position = getHexCenter(spawn.cell, origin);
    const tierWeight = enemyTierWeight(definition.tier);
    const instance = {
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
      visualAction: null,
      visualActionSequence: 0,
      stunnedUntil: 0,
      linkedTarget: null,
      linkedTargets: [],
      linkedProtection: null,
      rescueCompleted: false,
      activeEffects: {},
      passiveState: null,
      baseDamageTakenMultiplier: definition.passive?.damageTakenMultiplier ?? 1,
      damageTakenMultiplier: definition.passive?.damageTakenMultiplier ?? 1,
      outgoingDamageMultiplier: 1,
      projectileSpeedMultiplier: 1,
      damageStack: 0,
      defeated: false,
    };
    initializePlayEnemyPassive(instance, definition);
    return instance;
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
      rules: [],
      summons: [],
      effects: [],
      nextProjectileId: 1,
      nextZoneId: 1,
      nextEffectId: 1,
      nextSummonId: 1,
      nextSummonEventId: 1,
      nextRuleId: 1,
      playerResources: null,
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

function playEnemyDamageAmount(enemy, amount) {
  return Math.max(0, Number(amount ?? 0))
    * (1 + Math.max(0, Number(enemy.damageStack ?? 0)))
    * (enemy.outgoingDamageMultiplier ?? 1);
}

function playEnemyCooldownMultiplier(enemy) {
  return (enemy.activeEffects?.speedForm?.cooldownMultiplier ?? 1)
    * (enemy.passiveState?.cooldownMultiplier ?? 1);
}

function initializePlayEnemyPassive(enemy, definition) {
  if (enemy.passiveState) return enemy.passiveState;
  const passive = definition.passive ?? {};
  enemy.baseDamageTakenMultiplier = passive.damageTakenMultiplier ?? 1;
  enemy.damageTakenMultiplier ??= enemy.baseDamageTakenMultiplier;
  enemy.outgoingDamageMultiplier ??= 1;
  enemy.projectileSpeedMultiplier ??= 1;
  enemy.passiveState = {
    id: passive.id ?? null,
    phaseCount: passive.phaseCount ?? 0,
    triggeredPhases: 0,
    shieldUntil: 0,
    invulnerableDuration: passive.invulnerableDuration ?? 0,
    damageMultiplier: passive.damageMultiplier ?? 1,
    moveSpeedMultiplier: 1,
    projectileSpeedMultiplier: 1,
    cooldownMultiplier: 1,
    thornsDamage: passive.thornsDamage ?? 0,
    enraged: false,
  };
  return enemy.passiveState;
}

function updatePlayEnemyPassive(runtime, enemy, definition) {
  const passive = definition.passive ?? {};
  const state = initializePlayEnemyPassive(enemy, definition);
  if (passive.id === 'tidalShield') {
    const healthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 0;
    const crossed = Math.min(state.phaseCount, Math.floor((1 - healthRatio) * state.phaseCount + 1e-9));
    if (crossed > state.triggeredPhases) {
      state.triggeredPhases = crossed;
      state.shieldUntil = runtime.time + state.invulnerableDuration;
      addPlayEnemyEffect(runtime, {
        type: 'tidalShield',
        ownerId: enemy.instanceId,
        phase: crossed,
        phaseCount: state.phaseCount,
        x: enemy.x,
        y: enemy.y,
        duration: state.invulnerableDuration,
      });
    }
    const shielded = runtime.time < state.shieldUntil;
    enemy.invulnerableUntil = shielded ? state.shieldUntil : 0;
    enemy.damageTakenMultiplier = shielded ? 0 : enemy.baseDamageTakenMultiplier;
    enemy.outgoingDamageMultiplier = state.damageMultiplier ** state.triggeredPhases;
  }
  if (passive.id === 'abyssAwakening') {
    const enraged = enemy.health > 0 && enemy.health < enemy.maxHealth * 0.5;
    if (enraged && !state.enraged) {
      addPlayEnemyEffect(runtime, {
        type: 'abyssAwakening',
        ownerId: enemy.instanceId,
        x: enemy.x,
        y: enemy.y,
        duration: 1,
      });
    }
    state.enraged = enraged;
    state.moveSpeedMultiplier = enraged ? (passive.moveSpeedMultiplier ?? 1) : 1;
    state.projectileSpeedMultiplier = enraged ? (passive.projectileSpeedMultiplier ?? 1) : 1;
    state.cooldownMultiplier = enraged ? (passive.cooldownMultiplier ?? 1) : 1;
    enemy.projectileSpeedMultiplier = state.projectileSpeedMultiplier;
  }
}

function attackReach(enemy, skill) {
  return (skill.range ?? skill.radius ?? 44) + enemy.radius + (enemy.actorRadius ?? 6);
}

const PLAY_ENEMY_STEERING_OFFSETS = Object.freeze([
  0,
  Math.PI / 3,
  -Math.PI / 3,
  Math.PI / 2,
  -Math.PI / 2,
  Math.PI * 2 / 3,
  -Math.PI * 2 / 3,
]);

function canOccupyPlayEnemyPoint(world, fromPoint, nextPoint) {
  if (!world?.map) return true;
  const chapter = world.chapter ?? 'chapter1';
  const origin = world.origin ?? { x: 0, y: 0 };
  const current = findCellContainingPoint(world.map, fromPoint, chapter, origin);
  const candidate = findCellContainingPoint(world.map, nextPoint, chapter, origin);
  if (!candidate || candidate.cell.terrain === 'blocked') return false;
  if (!current || current.key === candidate.key) return true;
  const edge = getActiveEdge(world.map, edgeKey(current.key, candidate.key), chapter);
  if (edge?.blocksPassage && edge.type !== 'layerPortal') return false;
  if (current.cell.waterLayer !== candidate.cell.waterLayer && edge?.type !== 'layerPortal') return false;
  return true;
}

export function getPlayEnemySteeringAngle(enemy, target, speed, elapsed, world = null) {
  const directAngle = angleBetween(enemy, target);
  if (!world?.map) return directAngle;
  const probeDistance = Math.max(Math.max(0, speed) * Math.max(elapsed, 1 / 60), HEX_SIZE * 1.65);
  const candidates = PLAY_ENEMY_STEERING_OFFSETS.map((offset) => {
    const angle = directAngle + offset;
    const point = {
      x: enemy.x + Math.cos(angle) * probeDistance,
      y: enemy.y + Math.sin(angle) * probeDistance,
    };
    if (!canOccupyPlayEnemyPoint(world, enemy, point)) return null;
    return {
      angle,
      score: distanceBetween(point, target) + Math.abs(offset) * HEX_SIZE * 0.28,
    };
  }).filter(Boolean).sort((left, right) => left.score - right.score);
  return candidates[0]?.angle ?? null;
}

function getLocalReachablePlayEnemyCells(enemy, world, maxSteps = 8) {
  if (!world?.map) return [];
  const chapter = world.chapter ?? 'chapter1';
  const origin = world.origin ?? { x: 0, y: 0 };
  const start = findCellContainingPoint(world.map, enemy, chapter, origin);
  if (!start || start.cell.terrain === 'blocked') return [];
  const visited = new Set([start.key]);
  const queue = [{ key: start.key, depth: 0 }];
  const reachable = [];
  while (queue.length) {
    const current = queue.shift();
    const cell = getActiveCell(world.map, current.key, chapter);
    if (!cell || cell.terrain === 'blocked') continue;
    reachable.push({ key: current.key, cell, point: getHexCenter(cell, origin) });
    if (current.depth >= maxSteps) continue;
    const fromPoint = getHexCenter(cell, origin);
    DIRECTIONS.forEach((_, direction) => {
      const nextKey = neighborKey(current.key, direction);
      if (visited.has(nextKey)) return;
      const nextCell = getActiveCell(world.map, nextKey, chapter);
      if (!nextCell || nextCell.terrain === 'blocked') return;
      const nextPoint = getHexCenter(nextCell, origin);
      if (!canOccupyPlayEnemyPoint(world, fromPoint, nextPoint)) return;
      visited.add(nextKey);
      queue.push({ key: nextKey, depth: current.depth + 1 });
    });
  }
  return reachable;
}

function playEnemyCellOpenness(candidate, world) {
  if (!world?.map) return 6;
  const chapter = world.chapter ?? 'chapter1';
  const origin = world.origin ?? { x: 0, y: 0 };
  return DIRECTIONS.reduce((count, _, direction) => {
    const nextCell = getActiveCell(world.map, neighborKey(candidate.key, direction), chapter);
    if (!nextCell || nextCell.terrain === 'blocked') return count;
    const nextPoint = getHexCenter(nextCell, origin);
    return count + (canOccupyPlayEnemyPoint(world, candidate.point, nextPoint) ? 1 : 0);
  }, 0);
}

export function getPlayEnemyLoiterTarget(enemy, center, radius, time, world = null, bounds = null, mode = 'home') {
  const plan = getEnemyLoiterPlan(enemy, time, { center, radius, bounds, margin: enemy.radius ?? 18 });
  const cacheKey = `${mode}:${plan.cycle}`;
  if (enemy.loiterTarget?.key === cacheKey) return { ...enemy.loiterTarget, phase: plan.phase };
  let target = { x: plan.x, y: plan.y };
  const candidates = getLocalReachablePlayEnemyCells(enemy, world);
  if (candidates.length) {
    const ranked = candidates.map((candidate) => {
      const openness = playEnemyCellOpenness(candidate, world);
      const desiredDistance = Math.hypot(candidate.point.x - plan.x, candidate.point.y - plan.y);
      const ringError = Math.abs(Math.hypot(candidate.point.x - center.x, candidate.point.y - center.y) - plan.distance);
      return {
        ...candidate,
        openness,
        score: desiredDistance + ringError * 0.35 + (6 - openness) * HEX_SIZE * 3,
      };
    }).sort((left, right) => left.score - right.score || right.openness - left.openness || left.key.localeCompare(right.key));
    target = ranked[0]?.point ?? target;
  }
  enemy.loiterTarget = { key: cacheKey, mode, cycle: plan.cycle, x: target.x, y: target.y };
  return { ...enemy.loiterTarget, phase: plan.phase };
}

function stopPlayEnemyMovement(enemy, state) {
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.state = state;
}

function movePlayEnemyToward(enemy, target, speed, elapsed, world, bounds, state) {
  if (distanceBetween(enemy, target) <= Math.max(8, speed * elapsed)) {
    stopPlayEnemyMovement(enemy, state === 'chasing' ? 'attacking' : 'loitering');
    return false;
  }
  const angle = getPlayEnemySteeringAngle(enemy, target, speed, elapsed, world);
  if (angle == null) {
    stopPlayEnemyMovement(enemy, 'blocked');
    return false;
  }
  easeEnemyVelocity(enemy, angle, speed, elapsed);
  const nextPosition = { x: enemy.x + enemy.vx * elapsed, y: enemy.y + enemy.vy * elapsed };
  if (!canOccupyPlayEnemyPoint(world, enemy, nextPosition)) {
    stopPlayEnemyMovement(enemy, 'blocked');
    return false;
  }
  enemy.x = nextPosition.x;
  enemy.y = nextPosition.y;
  enemy.state = state;
  syncEnemyFacing(enemy);
  if (bounds) {
    enemy.x = clampValue(enemy.x, bounds.minX, bounds.maxX);
    enemy.y = clampValue(enemy.y, bounds.minY, bounds.maxY);
  }
  return true;
}

function hasPlayerDamage(skill) {
  return Number(skill?.damage ?? 0) > 0
    || Number(skill?.damagePerSecond ?? 0) > 0
    || Number(skill?.aftermathDamage ?? 0) > 0;
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
  const scaledDamage = getEnemyDamageToPlayer(amount, damageType);
  if (typeof onDamage === 'function') onDamage(scaledDamage, source, damageType);
  else actor.health = Math.max(0, actor.health - scaledDamage);
  actor.hurtTimer = Math.max(actor.hurtTimer ?? 0, 0.18);
}

function spawnPlayEnemyProjectiles(runtime, enemy, skill, target) {
  const count = Math.max(1, Math.round(skill.projectileCount ?? 1));
  const spread = ((skill.spreadDegrees ?? (count > 1 ? 18 : 0)) * Math.PI) / 180;
  const centre = angleBetween(enemy, target);
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0 : index / (count - 1) - 0.5;
    const angle = centre + ratio * spread;
    const speed = Math.max(1, getEnemyProjectileSpeed(skill.projectileSpeed ?? 280) * (enemy.projectileSpeedMultiplier ?? 1));
    const outboundDistance = skill.range
      ?? (skill.returnDelay ? speed * skill.returnDelay : distanceBetween(enemy, target));
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
      speed,
      angle,
      age: 0,
      radius: skill.projectileRadius ?? 6,
      remainingDistance: outboundDistance,
      outboundDistance,
      returnDelay: skill.returnDelay ?? null,
      returning: false,
      damage: playEnemyDamageAmount(enemy, skill.damage),
      applies: skill.applies ?? null,
      effectDuration: skill.duration ?? 0,
      cloneHealthRatio: skill.cloneHealthRatio ?? null,
      maxReflections: skill.maxReflections ?? null,
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

function updatePlayEnemyProjectiles(runtime, enemies, actor, dt, onDamage) {
  runtime.projectiles = runtime.projectiles.filter((projectile) => {
    projectile.age += dt;
    const owner = enemies.find((enemy) => enemy.instanceId === projectile.ownerId && !enemy.defeated);
    if (projectile.returnDelay != null && projectile.age >= projectile.returnDelay) projectile.returning = true;
    if (projectile.returning) {
      if (!owner) return false;
      const returnAngle = angleBetween(projectile, owner);
      projectile.angle = returnAngle;
      projectile.vx = Math.cos(returnAngle) * projectile.speed;
      projectile.vy = Math.sin(returnAngle) * projectile.speed;
    }
    const previous = { x: projectile.x, y: projectile.y };
    const travel = Math.hypot(projectile.vx, projectile.vy) * dt;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (!projectile.returning) projectile.remainingDistance -= travel;
    if (distanceToSegment(actor, previous, projectile) <= (actor.radius ?? 0) + projectile.radius) {
      playEnemyDamage(actor, projectile.damage, `${projectile.enemyId}・${projectile.skillName}`, onDamage, 'projectile');
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
    if (projectile.returning) {
      return !owner || distanceToSegment(owner, previous, projectile) > (owner.radius ?? 0) + projectile.radius;
    }
    return projectile.returnDelay != null || projectile.remainingDistance > 0;
  });
}

function updatePlayEnemyZones(runtime, actor, dt, onDamage) {
  runtime.zones = runtime.zones.filter((zone) => {
    if (zone.type === 'reflectedBeam') {
      zone.remaining -= dt;
      if (distanceToSegment(actor, zone, { x: zone.targetX, y: zone.targetY }) <= (actor.radius ?? 0)) {
        playEnemyDamage(actor, zone.damagePerSecond * dt, zone.source, onDamage, 'ranged');
      }
      return zone.remaining > 1e-6;
    }
    if (zone.type === 'corruptOxygen') {
      zone.remaining -= dt;
      if (zone.remaining > 1e-6) return true;
      if (zone.phase === 'bubble') {
        if (distanceBetween(zone, actor) <= zone.radius + (actor.radius ?? 0)) {
          playEnemyDamage(actor, zone.damage, zone.source, onDamage, 'ranged');
          actor.oxygen = Math.max(0, (actor.oxygen ?? 0) - zone.oxygenDrain);
        }
        zone.phase = 'oxygenZone';
        zone.remaining = zone.oxygenZoneDuration;
        addPlayEnemyEffect(runtime, {
          type: 'corruptedOxygenExplosion',
          ownerId: zone.ownerId,
          skillId: zone.skillId,
          x: zone.x,
          y: zone.y,
          radius: zone.radius,
          oxygenDrain: zone.oxygenDrain,
          duration: 0.8,
        });
        return zone.remaining > 0;
      }
      return false;
    }
    if (zone.type === 'sludge') {
      zone.remaining -= dt;
      return zone.remaining > 1e-6;
    }
    zone.remaining -= dt;
    if (zone.remaining > 1e-6) return true;
    if (distanceBetween(zone, actor) <= zone.radius + (actor.radius ?? 0)) {
      playEnemyDamage(actor, zone.damage, zone.source, onDamage, zone.damageType ?? 'ranged');
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

function updatePlayEnemyRules(runtime, enemies, dt) {
  runtime.rules = runtime.rules.filter((rule) => {
    rule.remaining -= dt;
    const owner = enemies.find((enemy) => enemy.instanceId === rule.ownerId && !enemy.defeated);
    if (rule.type === 'rebuildArena' && owner) {
      owner.health = Math.min(owner.maxHealth, owner.health + owner.maxHealth * rule.healPerSecondRatio * dt);
    }
    if (rule.type === 'speedForm' && owner?.activeEffects?.speedForm) {
      owner.activeEffects.speedForm.remaining = Math.max(0, rule.remaining);
    }
    if (rule.remaining <= 1e-6 && rule.type === 'speedForm' && owner?.activeEffects?.speedForm) {
      delete owner.activeEffects.speedForm;
      owner.damageTakenMultiplier = owner.baseDamageTakenMultiplier ?? 1;
    }
    return rule.remaining > 1e-6;
  });
}

function addPlayEnemyRule(runtime, rule) {
  const next = {
    id: `play-enemy-rule-${runtime.nextRuleId++}`,
    ...rule,
  };
  runtime.rules.push(next);
  return next;
}

function addPlayEnemySummonEvent(runtime, event) {
  const next = {
    id: `play-enemy-summon-${runtime.nextSummonEventId++}`,
    createdAt: runtime.time,
    ...event,
  };
  runtime.summons.push(next);
  return next;
}

function createSummonedPlayEnemy(runtime, enemyId, summoner, x, y, index) {
  const definition = ENEMY_DEFINITIONS[enemyId];
  const tierWeight = enemyTierWeight(definition.tier);
  const summoned = {
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
    visualAction: null,
    visualActionSequence: 0,
    stunnedUntil: 0,
    linkedTarget: null,
    linkedTargets: [],
    linkedProtection: null,
    rescueCompleted: false,
    activeEffects: {},
    passiveState: null,
    baseDamageTakenMultiplier: definition.passive?.damageTakenMultiplier ?? 1,
    damageTakenMultiplier: definition.passive?.damageTakenMultiplier ?? 1,
    outgoingDamageMultiplier: 1,
    projectileSpeedMultiplier: 1,
    damageStack: 0,
    defeated: false,
  };
  initializePlayEnemyPassive(summoned, definition);
  return summoned;
}

function summonJuvenileHelp(runtime, enemies, enemy, skill, bounds) {
  const count = clampValue(Math.round(skill.summonCount ?? 2), 1, 8);
  const spawnedIds = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count;
    const enemyId = DESCENT_CORE_ENEMIES[(runtime.nextSummonId + index - 1) % DESCENT_CORE_ENEMIES.length];
    let x = enemy.x + Math.cos(angle) * 34;
    let y = enemy.y + Math.sin(angle) * 34;
    if (bounds) {
      x = clampValue(x, bounds.minX, bounds.maxX);
      y = clampValue(y, bounds.minY, bounds.maxY);
    }
    const summoned = createSummonedPlayEnemy(runtime, enemyId, enemy, x, y, index);
    enemies.push(summoned);
    spawnedIds.push(summoned.instanceId);
  }
  enemy.rescueCompleted = true;
  addPlayEnemySummonEvent(runtime, {
    ownerId: enemy.instanceId,
    skillId: skill.id,
    count,
    enemyTier: 2,
    spawnedIds,
    status: 'active',
  });
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

function summonSpecialWave(runtime, enemies, enemy, skill, pool, bounds, sacrificeDelay = null) {
  const count = clampValue(Math.round(skill.summonCount ?? 1), 1, 8);
  const spawnedIds = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count;
    const enemyId = pool[index % pool.length];
    let x = enemy.x + Math.cos(angle) * 34;
    let y = enemy.y + Math.sin(angle) * 34;
    if (bounds) {
      x = clampValue(x, bounds.minX, bounds.maxX);
      y = clampValue(y, bounds.minY, bounds.maxY);
    }
    const summoned = createSummonedPlayEnemy(runtime, enemyId, enemy, x, y, index);
    enemies.push(summoned);
    spawnedIds.push(summoned.instanceId);
  }
  const event = addPlayEnemySummonEvent(runtime, {
    ownerId: enemy.instanceId,
    skillId: skill.id,
    count,
    enemyTier: pool === DESCENT_LV1_ENEMIES ? 1 : pool === DESCENT_CORE_ENEMIES ? 2 : 'chapter1',
    spawnedIds,
    status: 'active',
    sacrificeAt: sacrificeDelay == null ? null : runtime.time + sacrificeDelay,
    healRatioPerSacrifice: skill.healRatioPerSacrifice ?? 0,
    damageStackPerSacrifice: skill.damageStackPerSacrifice ?? 0,
  });
  addPlayEnemyEffect(runtime, {
    type: 'summon',
    ownerId: enemy.instanceId,
    skillId: skill.id,
    x: enemy.x,
    y: enemy.y,
    count,
    summonEventId: event.id,
    duration: 0.9,
  });
  return event;
}

function updatePlayEnemySummons(runtime, enemies) {
  runtime.summons.forEach((summon) => {
    if (summon.status !== 'active' || summon.sacrificeAt == null || runtime.time < summon.sacrificeAt) return;
    const owner = enemies.find((enemy) => enemy.instanceId === summon.ownerId && !enemy.defeated);
    const survivors = summon.spawnedIds
      .map((id) => enemies.find((enemy) => enemy.instanceId === id))
      .filter((enemy) => enemy && !enemy.defeated && enemy.health > 0);
    survivors.forEach((enemy) => {
      enemy.health = 0;
      enemy.defeated = true;
      enemy.state = 'sacrificed';
    });
    summon.status = 'sacrificed';
    summon.sacrificedCount = survivors.length;
    summon.resolvedAt = runtime.time;
    if (!owner) return;
    owner.health = Math.min(owner.maxHealth, owner.health + owner.maxHealth * summon.healRatioPerSacrifice * survivors.length);
    owner.damageStack = (owner.damageStack ?? 0) + summon.damageStackPerSacrifice * survivors.length;
    addPlayEnemyEffect(runtime, {
      type: 'sacrifice',
      ownerId: owner.instanceId,
      skillId: summon.skillId,
      summonEventId: summon.id,
      x: owner.x,
      y: owner.y,
      sacrificedCount: survivors.length,
      duration: 1,
    });
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
  const visualAction = beginPlayEnemyVisualAction(enemy, skill.id, runtime.time);
  enemy.suicideCharge = {
    skillId: skill.id,
    phase: 'seeking',
    targetX: actor.x,
    targetY: actor.y,
    remaining: skill.detonationDelay ?? 1,
    startedAt: runtime.time,
    visualSequence: visualAction.sequence,
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
  const visualAction = enemy.visualAction?.skillId === skill.id
    ? enemy.visualAction
    : beginPlayEnemyVisualAction(enemy, skill.id, runtime.time);
  visualAction.holdUntil = Math.max(visualAction.holdUntil, runtime.time + PLAY_ENEMY_ACTION_VISUAL_HOLD);
  enemy.lastResolvedSkill = {
    skillId: skill.id,
    skillType: skill.type,
    resolvedAt: runtime.time,
    visualSequence: visualAction.sequence,
    supported: true,
  };
  if (skill.type === 'teleportMelee' || skill.type === 'dash') {
    const angle = angleBetween(enemy, actor);
    enemy.x = actor.x - Math.cos(angle) * 28;
    enemy.y = actor.y - Math.sin(angle) * 28;
    if (distanceBetween(enemy, actor) <= attackReach(enemy, { ...skill, range: skill.range ?? 56 })) playEnemyDamage(actor, playEnemyDamageAmount(enemy, skill.damage), source, onDamage, damageType);
    return;
  }
  if (skill.type === 'contact' || skill.type === 'melee') {
    if (distance <= attackReach(enemy, skill)) {
      const angle = angleBetween(enemy, actor);
      if (skill.id === 'shortThrust' || skill.id === 'wingRam') {
        actor.vx = (actor.vx ?? 0) + Math.cos(angle) * 96;
        actor.vy = (actor.vy ?? 0) + Math.sin(angle) * 96;
      }
      if (skill.id !== 'shortThrust') playEnemyDamage(actor, playEnemyDamageAmount(enemy, skill.damage), source, onDamage, damageType);
    }
    return;
  }
  if (['projectile', 'spread', 'boomerangSpread', 'shieldBoomerang', 'cloneBarrage'].includes(skill.type)) {
    if (skill.type === 'cloneBarrage') {
      addPlayEnemySummonEvent(runtime, {
        ownerId: enemy.instanceId,
        skillId: skill.id,
        count: skill.projectileCount ?? 1,
        kind: 'abyssEcho',
        healthEach: enemy.maxHealth * (skill.cloneHealthRatio ?? 0),
        spawnedIds: [],
        status: 'echoBarrage',
      });
    }
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
      damage: playEnemyDamageAmount(enemy, skill.damage),
      damageType: 'projectile',
      source,
    });
    return;
  }
  if (skill.type === 'areaStun' || skill.type === 'gravityField') {
    if (distance <= (skill.radius ?? 96) + (actor.radius ?? 0)) {
      playEnemyDamage(actor, playEnemyDamageAmount(enemy, skill.damage), source, onDamage, damageType);
      if (skill.stun) {
        actor.stunnedUntil = Math.max(actor.stunnedUntil ?? 0, runtime.time + skill.stun);
        actor.vx = 0;
        actor.vy = 0;
      }
    }
    addPlayEnemyEffect(runtime, { type: skill.type, ownerId: enemy.instanceId, skillId: skill.id, x: enemy.x, y: enemy.y, radius: skill.radius ?? 96, duration: skill.duration ?? 0.75 });
    if (skill.type === 'gravityField') {
      addPlayEnemyRule(runtime, {
        type: 'gravityField',
        ownerId: enemy.instanceId,
        skillId: skill.id,
        x: enemy.x,
        y: enemy.y,
        radius: skill.radius,
        duration: skill.duration,
        remaining: skill.duration,
        gravityMultiplier: skill.gravityMultiplier,
        stun: skill.stun,
      });
    }
    return;
  }
  if (skill.type === 'summonResourceDrain') {
    summonSpecialWave(runtime, enemies, enemy, skill, DESCENT_LV1_ENEMIES, bounds);
    const inEncounterRange = distance <= PLAY_ENEMY_ACTIVATION_RADIUS;
    if (inEncounterRange) {
      actor.energy = Math.max(0, (actor.energy ?? 0) - (skill.energyDrain ?? 0));
      actor.oxygen = Math.max(0, (actor.oxygen ?? 0) - (skill.oxygenDrain ?? 0));
    }
    addPlayEnemyEffect(runtime, {
      type: 'resourceDrain',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      x: enemy.x,
      y: enemy.y,
      energyDrain: skill.energyDrain ?? 0,
      oxygenDrain: skill.oxygenDrain ?? 0,
      applied: inEncounterRange,
      duration: 0.8,
    });
    return;
  }
  if (skill.type === 'reflectedBeam') {
    const target = lockedTarget ?? actor;
    runtime.zones.push({
      id: `play-enemy-zone-${runtime.nextZoneId++}`,
      type: 'reflectedBeam',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      source,
      x: enemy.x,
      y: enemy.y,
      targetX: target.x,
      targetY: target.y,
      duration: skill.duration,
      remaining: skill.duration,
      damagePerSecond: playEnemyDamageAmount(enemy, skill.damagePerSecond),
      maxReflections: skill.maxReflections,
      reflectionPath: null,
      reflectionGeometryAuthored: false,
    });
    addPlayEnemyEffect(runtime, {
      type: 'reflectedBeam',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      x: enemy.x,
      y: enemy.y,
      targetX: target.x,
      targetY: target.y,
      damagePerSecond: skill.damagePerSecond,
      maxReflections: skill.maxReflections,
      duration: skill.duration,
    });
    return;
  }
  if (skill.type === 'summon' && enemy.enemyId === 'juvenileSeahorseCaller') {
    summonJuvenileHelp(runtime, enemies, enemy, skill, bounds);
    return;
  }
  if (skill.type === 'summon' && enemy.enemyId === 'tideLawNautilus') {
    summonSpecialWave(runtime, enemies, enemy, skill, DESCENT_CORE_ENEMIES, bounds);
    return;
  }
  if (skill.type === 'ruleChange') {
    const modes = skill.gravityModes ?? [];
    const mode = modes.length ? modes[runtime.nextRuleId % modes.length] : null;
    addPlayEnemyRule(runtime, {
      type: 'tidalLaw',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      mode,
      modes: [...modes],
      duration: skill.duration,
      remaining: skill.duration,
    });
    addPlayEnemyEffect(runtime, { type: 'tidalLaw', ownerId: enemy.instanceId, skillId: skill.id, mode, x: enemy.x, y: enemy.y, duration: skill.duration });
    return;
  }
  if (skill.type === 'sacrificeSummon') {
    summonSpecialWave(runtime, enemies, enemy, skill, DESCENT_ENEMY_ROSTER, bounds, 30);
    return;
  }
  if (skill.type === 'rebuildArena') {
    addPlayEnemyRule(runtime, {
      type: 'rebuildArena',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      duration: skill.duration,
      remaining: skill.duration,
      healPerSecondRatio: skill.healPerSecondRatio,
      arenaGeometryAuthored: false,
    });
    addPlayEnemyEffect(runtime, { type: 'rebuildArena', ownerId: enemy.instanceId, skillId: skill.id, x: enemy.x, y: enemy.y, duration: skill.duration });
    return;
  }
  if (skill.type === 'speedForm') {
    enemy.activeEffects ??= {};
    enemy.activeEffects.speedForm = {
      remaining: skill.duration,
      damageTakenMultiplier: skill.damageTakenMultiplier,
      moveSpeedMultiplier: skill.moveSpeedMultiplier,
      cooldownMultiplier: skill.cooldownMultiplier,
      sludgeDuration: skill.sludgeDuration,
    };
    enemy.damageTakenMultiplier = skill.damageTakenMultiplier;
    addPlayEnemyRule(runtime, {
      type: 'speedForm',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      duration: skill.duration,
      remaining: skill.duration,
      damageTakenMultiplier: skill.damageTakenMultiplier,
      moveSpeedMultiplier: skill.moveSpeedMultiplier,
      cooldownMultiplier: skill.cooldownMultiplier,
      sludgeDuration: skill.sludgeDuration,
      sludgeSlowMultiplier: null,
    });
    addPlayEnemyEffect(runtime, { type: 'speedForm', ownerId: enemy.instanceId, skillId: skill.id, x: enemy.x, y: enemy.y, duration: skill.duration });
    return;
  }
  if (skill.type === 'gravityRule') {
    addPlayEnemyRule(runtime, {
      type: 'gravityDominion',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      duration: skill.duration,
      remaining: skill.duration,
      gravityLevelShift: skill.gravityLevelShift,
      directionToggle: true,
      damage: skill.damage,
      damageSuppressed: true,
    });
    addPlayEnemyEffect(runtime, { type: 'gravityDominion', ownerId: enemy.instanceId, skillId: skill.id, x: enemy.x, y: enemy.y, gravityLevelShift: skill.gravityLevelShift, damageSuppressed: true, duration: skill.duration });
    return;
  }
  if (skill.type === 'corruptOxygen') {
    const target = lockedTarget ?? actor;
    runtime.zones.push({
      id: `play-enemy-zone-${runtime.nextZoneId++}`,
      type: 'corruptOxygen',
      phase: 'bubble',
      ownerId: enemy.instanceId,
      skillId: skill.id,
      source,
      x: target.x,
      y: target.y,
      radius: skill.explosionRadius,
      remaining: skill.bubbleLifetime,
      bubbleLifetime: skill.bubbleLifetime,
      oxygenZoneDuration: skill.oxygenZoneDuration,
      oxygenDrain: skill.oxygenDrain,
      damage: playEnemyDamageAmount(enemy, skill.damage),
    });
    addPlayEnemyEffect(runtime, { type: 'corruptedOxygenBubble', ownerId: enemy.instanceId, skillId: skill.id, x: target.x, y: target.y, radius: skill.explosionRadius, duration: skill.bubbleLifetime });
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
  updatePlayEnemyProjectiles(runtime, enemies, actor, elapsed, onDamage);
  updatePlayEnemyZones(runtime, actor, elapsed, onDamage);
  updatePlayEnemyRules(runtime, enemies, elapsed);
  updatePlayEnemySummons(runtime, enemies);
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
    enemy.activeEffects ??= {};
    enemy.linkedTargets ??= [];
    updatePlayEnemyPassive(runtime, enemy, definition);
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
        if ((enemy.moveSpeed ?? 0) > 0 && world?.map) {
          const target = getPlayEnemyLoiterTarget(
            enemy,
            { x: enemy.homeX ?? enemy.x, y: enemy.homeY ?? enemy.y },
            HEX_SIZE * 6,
            runtime.time,
            world,
            bounds,
            'home',
          );
          enemy.movementGoal = { x: target.x, y: target.y, mode: 'home', phase: target.phase };
          if (target.phase === 'travel') movePlayEnemyToward(enemy, target, enemy.moveSpeed * 0.58, elapsed, world, bounds, 'roaming');
          else stopPlayEnemyMovement(enemy, 'loitering');
        } else {
          stopPlayEnemyMovement(enemy, 'idle');
        }
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
    const rangedMover = definition.attacks.some((skill) => ['projectile', 'spread', 'lobbed', 'boomerangSpread', 'shieldBoomerang', 'cloneBarrage'].includes(skill.type));
    if ((enemy.moveSpeed ?? 0) > 0 && distance > preferred) {
      const moveSpeedMultiplier = (enemy.activeEffects.speedForm?.moveSpeedMultiplier ?? 1)
        * (enemy.passiveState?.moveSpeedMultiplier ?? 1);
      const speed = enemy.moveSpeed * moveSpeedMultiplier;
      enemy.movementGoal = { x: actor.x, y: actor.y, mode: 'engage', phase: 'travel' };
      movePlayEnemyToward(enemy, actor, speed, elapsed, world, bounds, 'chasing');
    } else if ((enemy.moveSpeed ?? 0) > 0 && rangedMover) {
      const moveSpeedMultiplier = (enemy.activeEffects.speedForm?.moveSpeedMultiplier ?? 1)
        * (enemy.passiveState?.moveSpeedMultiplier ?? 1);
      const target = getPlayEnemyLoiterTarget(
        enemy,
        actor,
        Math.max(84, preferred),
        runtime.time,
        world,
        bounds,
        'combat',
      );
      enemy.movementGoal = { x: target.x, y: target.y, mode: 'combat', phase: target.phase };
      if (target.phase === 'travel') movePlayEnemyToward(enemy, target, enemy.moveSpeed * moveSpeedMultiplier, elapsed, world, bounds, 'repositioning');
      else stopPlayEnemyMovement(enemy, 'loitering');
    } else {
      enemy.movementGoal = null;
      stopPlayEnemyMovement(enemy, 'attacking');
    }
    const attacks = definition.attacks ?? [];
    if (!attacks.length) return;
    const start = enemy.nextSkillIndex % attacks.length;
    const selected = attacks.map((skill, index) => ({ skill, index: (start + index) % attacks.length }))
      .find(({ skill }) => canUsePlaySkill(enemy, skill, distance));
    if (!selected) return;
    const { skill, index } = selected;
    enemy.nextSkillIndex = (index + 1) % attacks.length;
    enemy.cooldowns[skill.id] = Math.max(0.2, Number(skill.cooldown ?? 0.6) * playEnemyCooldownMultiplier(enemy));
    if (skill.type === 'suicideCharge') {
      beginSuicideCharge(runtime, enemy, skill, actor);
      return;
    }
    const authoredCastTime = Number(skill.castTime ?? skill.telegraph ?? 0);
    const castTime = authoredCastTime > 0 ? authoredCastTime : hasPlayerDamage(skill) ? .32 : 0;
    if (castTime > 0) {
      const visualAction = beginPlayEnemyVisualAction(enemy, skill.id, runtime.time);
      enemy.pendingSkill = {
        skillId: skill.id,
        remaining: castTime,
        targetX: actor.x,
        targetY: actor.y,
        startedAt: runtime.time,
        visualSequence: visualAction.sequence,
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
  runtime.playerResources = {
    health: actor.health ?? null,
    oxygen: actor.oxygen ?? null,
    energy: actor.energy ?? null,
    stunnedUntil: actor.stunnedUntil ?? 0,
  };
  return getPlayEnemyRenderState(enemies, runtime.time);
}

export function getPlayEnemyRenderState(enemies, time = null) {
  const runtime = getPlayEnemyRuntime(enemies);
  const now = Number.isFinite(time) ? time : runtime.time;
  return {
    time: now,
    projectiles: runtime.projectiles.map((projectile) => ({ ...projectile })),
    zones: runtime.zones.map((zone) => ({ ...zone })),
    rules: runtime.rules.map((rule) => ({ ...rule, modes: rule.modes ? [...rule.modes] : undefined })),
    summons: runtime.summons.map((summon) => ({ ...summon, spawnedIds: [...(summon.spawnedIds ?? [])] })),
    effects: runtime.effects.map((effect) => ({ ...effect })),
    playerResources: runtime.playerResources ? { ...runtime.playerResources } : null,
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
      activeEffects: Object.fromEntries(Object.entries(enemy.activeEffects ?? {}).map(([key, value]) => [key, value && typeof value === 'object' ? { ...value } : value])),
      passiveState: enemy.passiveState ? { ...enemy.passiveState } : null,
      invulnerableUntil: enemy.invulnerableUntil ?? 0,
      damageTakenMultiplier: enemy.damageTakenMultiplier ?? 1,
      outgoingDamageMultiplier: enemy.outgoingDamageMultiplier ?? 1,
      projectileSpeedMultiplier: enemy.projectileSpeedMultiplier ?? 1,
      damageStack: enemy.damageStack ?? 0,
      movementGoal: enemy.movementGoal ? { ...enemy.movementGoal } : null,
      visual: getPlayEnemyFrameState(enemy, now),
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
