import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyMap,
  createBlankMap,
  cellKeyFromColumn,
  edgeKey,
  ensureOddRRows,
  getActiveCell,
  findCellContainingPoint,
  getOddRRectangularBounds,
  getHexCenter,
  HEX_SIZE,
  migrateMapToOddR,
  neighborKey,
  screenPointToWorldPoint,
  validateMap,
  patchCell,
  patchEdge,
} from '../src/map-model.js';
import {
  FIXED_STEP,
  GAME_GRAVITY,
  GRAVITY_SCALE,
  MAX_HEALTH,
  MAX_LIVES,
  MAX_SPEED,
  MAX_LAUNCH_SPEED,
  LAUNCH_MOMENTUM_MULTIPLIER,
  ENERGY_COST_PER_LAUNCH,
  OXYGEN_DURATION_SECONDS,
  OXYGEN_DRAIN_PER_SECOND,
  OXYGEN_COST_PER_DISTANCE,
  OXYGEN_STARVATION_DAMAGE_PER_SECOND,
  SIMULATION_SPEED_SCALE,
  createTestActor,
  drainAimEnergy,
  getLaunchCosts,
  getLaunchSpeed,
  getOxygenDrainPerSecond,
  getOxygenSecondsRemaining,
  getResourceHealthRecoveryPerSecond,
  launchActor,
  getMicroflowAcceleration,
  getMicroflowRegionKeys,
  sampleMicroflowVector,
  applyDamage,
  applyEnemyDefeatRewards,
  recoverPlayerResource,
  registerPlayerDeath,
  respawnActor,
  setPlayerDamageReduction,
  stepPhysics,
  toggleSeaweedAttachment,
} from '../src/physics.js';
import {
  ENEMY_DEFINITIONS,
  ENEMY_ORDER,
  PASSIVE_ABILITIES,
  RESOURCE_HEALTH_RECOVERY,
  WEAPONS,
  calculateWeaponDamage,
  createEnemyState,
  getPassiveModifiers,
  getPlayerDerivedStats,
  getWeaponStats,
  getWeaponUseCost,
} from '../src/game-data.js';
import {
  FAST_ASCENT_VELOCITY,
  PLAYER_ANIMATION_ASSETS,
  getPlayerAnimationFrameIndex,
  getPlayerFacingDirection,
  getPlayerAnimationPosition,
  getPlayerAnimationState,
} from '../src/player-animation.js';
import {
  beginSandboxAim,
  createSandboxState,
  executeEnemySkill,
  getSandboxEnemyIds,
  playerAttack,
  releaseSandboxAim,
  setSandboxBuild,
  spawnSandboxEnemy,
  stepSandbox,
  updateSandboxAim,
} from '../src/sandbox-sim.js';
import {
  MAP_OBJECT_SIZE,
  getEdgeSetting,
  getFreeObjectSetting,
  getOfficialEdgeState,
  getOfficialFreeObjectState,
  normalizeMapObjectSizes,
} from '../src/map-object-settings.js';
import {
  MULTI_PORTAL_EDGE_TYPE,
  connectPortalGroups,
  getPortalGroupEdges,
} from '../src/portal.js';

const ORIGIN = { x: 76, y: 82 };

function actorIn(map, key) {
  return createTestActor(getHexCenter(getActiveCell(map, key), ORIGIN));
}

test('L3 produces stronger downward acceleration than L1', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L1' });
  patchCell(map, '1,0', { gravityLevel: 'L3' });
  const l1 = actorIn(map, '0,0');
  const l3 = actorIn(map, '1,0');
  stepPhysics({ map, actor: l1, origin: ORIGIN });
  stepPhysics({ map, actor: l3, origin: ORIGIN });
  assert.ok(l1.vy > 0);
  assert.ok(l3.vy > l1.vy * 1.9);
});

test('L-1 accelerates upward and L0 preserves inertia', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L-1' });
  patchCell(map, '1,0', { gravityLevel: 'L0' });
  const upward = actorIn(map, '0,0');
  const neutral = actorIn(map, '1,0');
  neutral.vx = 40;
  stepPhysics({ map, actor: upward, origin: ORIGIN });
  stepPhysics({ map, actor: neutral, origin: ORIGIN });
  assert.ok(upward.vy < 0);
  assert.ok(neutral.vx > 38, 'L0 should decay horizontal velocity instead of clearing it in one step');
  assert.ok(Math.abs(neutral.vy) < 0.01, 'L0 should add no vertical gravity');
});

test('descent maps reverse water gravity while ascent maps pull downward', () => {
  const map = createEmptyMap({ width: 1, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L1' });
  map.metadata = { chapter: '下沉篇' };
  const descentActor = actorIn(map, '0,0');
  stepPhysics({ map, actor: descentActor, origin: ORIGIN });
  assert.ok(descentActor.vy < 0, 'descent maps should pull the diver toward screen-up');

  map.metadata = { chapter: '上升篇' };
  const ascentActor = actorIn(map, '0,0');
  stepPhysics({ map, actor: ascentActor, origin: ORIGIN });
  assert.ok(ascentActor.vy > 0, 'ascent maps should pull the diver toward screen-down');
});

test('launch velocity is opposite the pull direction', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  const oxygenBefore = actor.oxygen;
  const launch = launchActor(actor, { x: 120, y: 200 });
  assert.ok(launch.launched);
  assert.ok(launch.speed > 0);
  assert.ok(actor.vx > 0);
  assert.equal(actor.vy, 0);
  assert.ok(launch.speed > 100, 'launch speed should include the requested five-times momentum boost');
  assert.equal(actor.oxygen, oxygenBefore, 'oxygen is not charged by launching');
  assert.equal(actor.energy, 100 - ENERGY_COST_PER_LAUNCH, 'one launch should settle one fixed energy cost');
  assert.equal(getLaunchCosts(200).oxygen, 0, 'medium launch should not budget oxygen');
  assert.equal(getLaunchCosts(420).oxygen, 0, 'long launch should not budget oxygen');
});

test('energy starts recovering one second after the last launch even while drifting', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  const actor = actorIn(map, '0,0');
  actor.energy = 20;
  actor.vx = 40;
  stepPhysics({ map, actor, origin: ORIGIN, dt: 0.99 });
  assert.equal(actor.energy, 20, 'energy should wait for the full one-second recovery delay');
  stepPhysics({ map, actor, origin: ORIGIN, dt: 0.01 });
  assert.ok(actor.energy > 20, 'energy should recover while the diver is still moving');

  const launch = launchActor(actor, { x: actor.x + 20, y: actor.y });
  assert.ok(launch.launched);
  const afterLaunch = actor.energy;
  stepPhysics({ map, actor, origin: ORIGIN, dt: 0.5 });
  assert.equal(actor.energy, afterLaunch, 'a new launch should restart the one-second delay');
});

test('high oxygen and energy recover health at moderate and fast rates', () => {
  assert.deepEqual(RESOURCE_HEALTH_RECOVERY, {
    moderateThresholdRatio: 0.6,
    moderateHealthPerSecond: 2,
    fastThresholdRatio: 0.8,
    fastHealthPerSecond: 5,
  });

  const thresholdActor = createTestActor();
  thresholdActor.health = 50;
  thresholdActor.oxygen = 60;
  thresholdActor.energy = 60;
  assert.equal(getResourceHealthRecoveryPerSecond(thresholdActor), 2, 'both resources at sixty percent should enable moderate recovery');
  thresholdActor.oxygen = 80;
  thresholdActor.energy = 80;
  assert.equal(getResourceHealthRecoveryPerSecond(thresholdActor), 5, 'both resources at eighty percent should enable fast recovery');
  thresholdActor.energy = 79.9;
  assert.equal(getResourceHealthRecoveryPerSecond(thresholdActor), 2, 'fast recovery requires both resources to reach eighty percent');
  thresholdActor.oxygen = 59.9;
  thresholdActor.energy = 100;
  assert.equal(getResourceHealthRecoveryPerSecond(thresholdActor), 0, 'one resource below sixty percent disables recovery');

  const map = createEmptyMap({ width: 1, height: 1 });
  const moderate = actorIn(map, '0,0');
  moderate.health = 40;
  moderate.oxygen = 72.5;
  moderate.energy = 70;
  moderate.energyRecoveryDelay = 10;
  stepPhysics({ map, actor: moderate, origin: ORIGIN, dt: 1 });
  assert.equal(moderate.health, 42);

  const fast = actorIn(map, '0,0');
  fast.health = 40;
  fast.oxygen = 92.5;
  fast.energy = 90;
  fast.energyRecoveryDelay = 10;
  stepPhysics({ map, actor: fast, origin: ORIGIN, dt: 1 });
  assert.equal(fast.health, 45);

  fast.health = 99;
  stepPhysics({ map, actor: fast, origin: ORIGIN, dt: 1 });
  assert.equal(fast.health, MAX_HEALTH, 'resource recovery must never exceed the health cap');
});

test('long launches gain extra speed while short launches keep the old scale', () => {
  assert.equal(getLaunchSpeed(80), 116);
  assert.ok(getLaunchSpeed(240) > getLaunchSpeed(80) * 2.5);
  assert.ok(getLaunchSpeed(420) > getLaunchSpeed(240));
});

test('launch only requires energy and aiming is free', () => {
  let actor = createTestActor({ x: 200, y: 200 });
  const costs = getLaunchCosts(80);
  assert.equal(costs.oxygen, 0);
  actor.oxygen = 0;
  assert.ok(launchActor(actor, { x: 120, y: 200 }).launched, 'oxygen starvation does not prevent movement');

  actor = createTestActor({ x: 200, y: 200 });
  actor.energy = costs.energy - 0.01;
  assert.equal(launchActor(actor, { x: 120, y: 200 }).reason, 'energy');

  actor.energy = 10;
  const energyBeforeAim = actor.energy;
  drainAimEnergy(actor, 0.5);
  assert.equal(actor.energy, energyBeforeAim, 'holding aim must not spend energy');
});

test('oxygen is a fixed forty-second timer independent of travel distance', () => {
  const map = createEmptyMap({ width: 3, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0' });
  patchCell(map, '1,0', { gravityLevel: 'L0' });
  patchCell(map, '2,0', { gravityLevel: 'L0' });
  const idle = actorIn(map, '1,0');
  const moving = actorIn(map, '1,0');
  moving.vx = 120;
  const idleBefore = idle.oxygen;
  const movingBefore = moving.oxygen;
  stepPhysics({ map, actor: idle, origin: ORIGIN, dt: 1 });
  stepPhysics({ map, actor: moving, origin: ORIGIN, dt: 1 });
  assert.equal(OXYGEN_DURATION_SECONDS, 40);
  assert.equal(OXYGEN_STARVATION_DAMAGE_PER_SECOND, 12, 'oxygen starvation should keep the authored fourfold damage');
  assert.ok(Math.abs((idleBefore - idle.oxygen) - OXYGEN_DRAIN_PER_SECOND) < 0.0001, 'one second should consume the fixed oxygen rate');
  assert.ok(Math.abs((movingBefore - moving.oxygen) - OXYGEN_DRAIN_PER_SECOND) < 0.0001, 'travel distance must not change oxygen consumption');
  assert.equal(Math.round(getOxygenSecondsRemaining(idle)), 39, 'HUD time should show thirty-nine seconds after one second');
  assert.equal(OXYGEN_COST_PER_DISTANCE, 0, 'distance oxygen compatibility constant must stay disabled');

  for (let index = 0; index < OXYGEN_DURATION_SECONDS - 1; index += 1) stepPhysics({ map, actor: idle, origin: ORIGIN, dt: 1 });
  assert.equal(idle.oxygen, 0, 'a full tank should reach zero after forty elapsed seconds');
  assert.ok(idle.health < MAX_HEALTH, 'empty oxygen should slowly damage health');
  assert.ok(idle.health > MAX_HEALTH - OXYGEN_STARVATION_DAMAGE_PER_SECOND * 2, 'starvation damage should be gradual and cooldown-limited');
});

test('all primary motion limits use the 0.1 simulation scale', () => {
  assert.equal(SIMULATION_SPEED_SCALE, 0.1);
  assert.equal(GRAVITY_SCALE, 0.5);
  assert.equal(GAME_GRAVITY, 11.5);
  assert.equal(MAX_SPEED, 140);
  assert.equal(LAUNCH_MOMENTUM_MULTIPLIER, 5);
  assert.equal(MAX_LAUNCH_SPEED, 700);
});

test('compact editor uses a rectangular odd-r grid with one-Cell player diameter', () => {
  const map = createEmptyMap();
  const actor = createTestActor();
  assert.deepEqual(map.layout, { orientation: 'pointy', coordinateSystem: 'axial', rowLayout: 'odd-r rectangle', width: 24, height: 17 });
  assert.equal(HEX_SIZE, actor.radius * 2);
  assert.ok(map.cells[cellKeyFromColumn(0, 0)]);
  assert.ok(map.cells[cellKeyFromColumn(0, 16)]);
  assert.ok(map.cells[cellKeyFromColumn(23, 16)]);
  assert.equal(Object.keys(map.cells).length, 24 * 17);
});

test('odd-r authoring maps can grow downward without changing their column width', () => {
  const map = createEmptyMap({ width: 3, height: 2 });
  patchCell(map, cellKeyFromColumn(0, 1), { gravityLevel: 'L3', waterLayer: 'T2' });
  patchCell(map, cellKeyFromColumn(1, 1), { gravityLevel: 'L1', waterLayer: 'T1' });
  ensureOddRRows(map, 5);
  assert.equal(map.layout.width, 3);
  assert.equal(map.layout.height, 6);
  assert.ok(map.cells[cellKeyFromColumn(0, 5)]);
  assert.ok(map.cells[cellKeyFromColumn(2, 5)]);
  assert.equal(map.cells[cellKeyFromColumn(0, 5)].gravityLevel, 'L3');
  assert.equal(map.cells[cellKeyFromColumn(0, 5)].waterLayer, 'T2');
  assert.equal(map.cells[cellKeyFromColumn(1, 5)].gravityLevel, 'L1');
  assert.equal(map.cells[cellKeyFromColumn(1, 5)].waterLayer, 'T1');
  assert.equal(Object.keys(map.cells).length, 18);
  ensureOddRRows(map, 3);
  assert.equal(map.layout.height, 6);
  assert.equal(Object.keys(map.cells).length, 18);
});

test('odd-r rectangular bounds trim alternating side tips without changing Cells', () => {
  const map = createEmptyMap({ width: 3, height: 2 });
  const bounds = getOddRRectangularBounds(map, { x: 0, y: 0 });
  const halfWidth = (Math.sqrt(3) * HEX_SIZE) / 2;
  assert.equal(bounds.left, 0);
  assert.equal(bounds.right, Math.sqrt(3) * HEX_SIZE * 2.5);
  assert.equal(bounds.top, -HEX_SIZE);
  assert.equal(bounds.bottom, HEX_SIZE * 2.5);
  assert.equal(getHexCenter(getActiveCell(map, '0,0'), { x: 0, y: 0 }).x - halfWidth < bounds.left, true);
});

test('legacy axial-parallelogram maps migrate without losing Cell content', () => {
  const rectangular = createEmptyMap({ width: 3, height: 3 });
  const legacy = JSON.parse(JSON.stringify(rectangular));
  legacy.layout = { orientation: 'pointy', coordinateSystem: 'axial', width: 3, height: 3 };
  legacy.cells = Object.fromEntries(Object.values(rectangular.cells).map((cell) => {
    const column = cell.q + Math.floor(cell.r / 2);
    const oldKey = `${column},${cell.r}`;
    return [oldKey, { ...cell, q: column }];
  }));
  legacy.cells['0,2'].objects = [{ kind: 'mine' }];
  const migrated = migrateMapToOddR(legacy);
  const lowerLeft = cellKeyFromColumn(0, 2);
  assert.equal(migrated.layout.rowLayout, 'odd-r rectangle');
  assert.deepEqual(migrated.cells[lowerLeft].objects, [{ kind: 'mine' }]);
  assert.equal(Object.keys(migrated.cells).length, 9);
});

test('zoomed screen coordinates map back to the intended world Cell', () => {
  const worldPoint = screenPointToWorldPoint({ x: 700, y: 440 }, { x: 500, y: 340 }, 2);
  assert.deepEqual(worldPoint, { x: 600, y: 390 });
});

test('odd-r point lookup only needs nearby row and column candidates', () => {
  const map = createEmptyMap({ width: 24, height: 117 });
  const target = cellKeyFromColumn(12, 58);
  const point = getHexCenter(getActiveCell(map, target), ORIGIN);
  assert.equal(findCellContainingPoint(map, point, 'chapter1', ORIGIN).key, target);
});

test('new authoring map is empty and every water Cell starts at L0', () => {
  const map = createBlankMap();
  const errors = validateMap(map).filter((result) => result.level === 'error');
  assert.equal(map.layout.width, 24);
  assert.equal(map.layout.height, 17);
  Object.values(map.cells).forEach((cell) => {
    assert.equal(cell.terrain, 'water');
    assert.equal(cell.gravityLevel, 'L0');
    assert.equal(cell.waterLayer, 'T1');
    assert.deepEqual(cell.overlays, []);
    assert.deepEqual(cell.objects, []);
    assert.deepEqual(cell.freeObjects, []);
    assert.deepEqual(cell.actors, []);
  });
  assert.deepEqual(map.edges, {});
  assert.deepEqual(map.chapterStates, { chapter1: { cells: {}, edges: {} }, chapter2: { cells: {}, edges: {} } });
  assert.equal(errors.length, 0, errors.map((result) => result.message).join('; '));
});

test('horizontal velocity settles to zero while vertical gravity continues', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L1' });
  const actor = actorIn(map, '0,0');
  actor.vx = 40;
  for (let index = 0; index < 180; index += 1) stepPhysics({ map, actor, origin: ORIGIN });
  assert.equal(actor.vx, 0);
  assert.ok(actor.vy > 0, 'vertical gravity must continue after horizontal motion stops');
});

test('dynamic microflow changes over time without a persistent directional push', () => {
  const map = createEmptyMap({ width: 3, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0' });
  patchCell(map, '1,0', { gravityLevel: 'L0' });
  patchCell(map, '2,0', { gravityLevel: 'L0' });
  const center = getHexCenter(getActiveCell(map, '1,0'), ORIGIN);
  const first = sampleMicroflowVector(center, 0);
  const later = sampleMicroflowVector(center, 4);
  assert.notDeepEqual(first, later, 'microflow should evolve instead of becoming a fixed current');
  const acceleration = getMicroflowAcceleration({ map, cellKey: '1,0', position: center, origin: ORIGIN, time: 4 });
  assert.ok(Math.hypot(acceleration.x, acceleration.y) < 1, 'microflow physics must stay low amplitude');
});

test('microflow never adds hidden vertical lift to a player', () => {
  const map = createEmptyMap({ width: 1, height: 1 });
  const center = getHexCenter(getActiveCell(map, '0,0'), ORIGIN);
  const acceleration = getMicroflowAcceleration({ map, cellKey: '0,0', position: center, origin: ORIGIN, time: 7 });
  assert.equal(acceleration.y, 0);
});

test('microflow regions stop at gravity or water-layer changes', () => {
  const map = createEmptyMap({ width: 4, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L1', waterLayer: 'T1' });
  patchCell(map, '1,0', { gravityLevel: 'L1', waterLayer: 'T1' });
  patchCell(map, '2,0', { gravityLevel: 'L1', waterLayer: 'T2' });
  patchCell(map, '3,0', { gravityLevel: 'L2', waterLayer: 'T2' });
  assert.deepEqual(new Set(getMicroflowRegionKeys({ map, startKey: '0,0' })), new Set(['0,0', '1,0']));
  assert.deepEqual(new Set(getMicroflowRegionKeys({ map, startKey: '2,0' })), new Set(['2,0']));
});

test('spring jelly reflects a crossing player', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0' });
  patchCell(map, '1,0', { gravityLevel: 'L0' });
  patchEdge(map, '0,0', '1,0', { type: 'springJelly', blocksPassage: true });
  const actor = actorIn(map, '0,0');
  actor.vx = 500;
  let events = [];
  for (let index = 0; index < 90; index += 1) {
    events = stepPhysics({ map, actor, origin: ORIGIN, dt: FIXED_STEP });
    if (events.some((event) => event.type === 'springJelly')) break;
  }
  assert.ok(events.some((event) => event.type === 'springJelly'));
  assert.ok(actor.vx < 0, 'reflection should reverse eastward velocity');
});

test('current applies horizontal acceleration from an Edge', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0' });
  patchEdge(map, '0,0', '1,0', { type: 'current', currentDirection: 0, currentStrength: 1.5 });
  const actor = actorIn(map, '0,0');
  stepPhysics({ map, actor, origin: ORIGIN });
  assert.ok(actor.vx > 0.1, 'eastward current should add positive x velocity at the slowed scale');
});

test('diagonal current never adds hidden vertical lift', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0' });
  patchEdge(map, '0,0', '1,0', { type: 'current', currentDirection: 1, currentStrength: 1.5 });
  const actor = actorIn(map, '0,0');
  stepPhysics({ map, actor, origin: ORIGIN });
  assert.equal(actor.vy, 0, 'a diagonal current must not change vertical velocity');
});

test('water layer boundaries block until a layer portal is installed', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0', waterLayer: 'T1' });
  patchCell(map, '1,0', { gravityLevel: 'L0', waterLayer: 'T2' });
  const actor = actorIn(map, '0,0');
  actor.vx = 140;
  let events = [];
  for (let index = 0; index < 30; index += 1) {
    events = stepPhysics({ map, actor, origin: ORIGIN });
    if (events.some((event) => event.type === 'layerBoundary')) break;
  }
  assert.ok(events.some((event) => event.type === 'layerBoundary'));
  assert.equal(findCellContainingPoint(map, actor, 'chapter1', ORIGIN).key, '0,0');

  patchEdge(map, '0,0', '1,0', { type: 'layerPortal', blocksPassage: false });
  actor.x = getHexCenter(getActiveCell(map, '0,0'), ORIGIN).x;
  actor.y = getHexCenter(getActiveCell(map, '0,0'), ORIGIN).y;
  actor.vx = 140;
  for (let index = 0; index < 30; index += 1) {
    events = stepPhysics({ map, actor, origin: ORIGIN });
    if (events.some((event) => event.type === 'layerPortal')) break;
  }
  assert.ok(events.some((event) => event.type === 'layerPortal'));
  assert.equal(findCellContainingPoint(map, actor, 'chapter1', ORIGIN).key, '1,0');
});

test('free-snap water objects use their own position and hitbox', () => {
  const map = createEmptyMap({ width: 1, height: 1 });
  patchCell(map, '0,0', {
    gravityLevel: 'L0',
    freeObjects: [{ kind: 'mine', offset: { x: 10, y: 0 }, hitRadius: 7 }],
  });
  const actor = actorIn(map, '0,0');
  const center = getHexCenter(getActiveCell(map, '0,0'), ORIGIN);
  actor.x = center.x + 10;
  actor.y = center.y;
  const events = stepPhysics({ map, actor, origin: ORIGIN });
  assert.ok(events.some((event) => event.type === 'mine'));
  assert.equal(actor.health, MAX_HEALTH - 24);
  assert.equal(validateMap(map).some((result) => result.level === 'error'), false);
});

test('official object and Edge settings stay explicit and resettable', () => {
  assert.equal(MAP_OBJECT_SIZE, 30);
  assert.deepEqual(getOfficialFreeObjectState('ink'), { size: 30, params: { visibilityRadius: 110 } });
  assert.deepEqual(getOfficialFreeObjectState('razor'), { size: 30, params: { count: 1, damage: 20, knockbackSpeed: 58, rotationSpeed: 180 } });
  assert.deepEqual(getOfficialFreeObjectState('button'), { size: 30, params: {} });
  assert.deepEqual(getOfficialFreeObjectState('weightStone'), { size: 30, params: { breakSpeed: 31, weight: 4 } });
  assert.deepEqual(getOfficialFreeObjectState('oxygen'), { size: 30, params: { oxygenAmount: 100, activationSpeed: 110 } });
  assert.deepEqual(getOfficialEdgeState('springJelly'), { size: 30, params: { bounceMultiplier: 1.08 } });
  assert.equal(getFreeObjectSetting({ kind: 'mine', size: 17 }, 'size'), 30);
  assert.equal(getEdgeSetting({ type: 'spike', size: 1 }, 'size'), 30);
  assert.equal(getFreeObjectSetting({ kind: 'mine', params: { damage: 37 } }, 'damage'), 37);
  assert.equal(getFreeObjectSetting({ kind: 'razor', params: { count: 4 } }, 'count'), 4);
  assert.equal(getEdgeSetting({ type: 'spike', params: { damage: 46 } }, 'damage'), 46);
});

test('loaded legacy maps normalize base and chapter object sizes to thirty pixels', () => {
  const map = {
    cells: { a: { objects: [{ kind: 'mine', size: 17 }], freeObjects: [{ kind: 'razor', size: 48 }] } },
    edges: { e: { type: 'spike', size: 1 } },
    chapterStates: {
      chapter1: {
        cells: { a: { freeObjects: [{ kind: 'button', size: 24 }] } },
        edges: { e: { type: 'current', size: 1 } },
      },
    },
  };
  normalizeMapObjectSizes(map);
  assert.equal(map.cells.a.objects[0].size, MAP_OBJECT_SIZE);
  assert.equal(map.cells.a.freeObjects[0].size, MAP_OBJECT_SIZE);
  assert.equal(map.edges.e.size, MAP_OBJECT_SIZE);
  assert.equal(map.chapterStates.chapter1.cells.a.freeObjects[0].size, MAP_OBJECT_SIZE);
  assert.equal(map.chapterStates.chapter1.edges.e.size, MAP_OBJECT_SIZE);
});

test('free-object parameters drive oxygen, mine damage, and Torricelli recovery', () => {
  const map = createEmptyMap({ width: 1, height: 1 });
  patchCell(map, '0,0', {
    gravityLevel: 'L0',
    freeObjects: [{ kind: 'mine', offset: { x: 0, y: 0 }, size: 20, params: { damage: 37 } }],
  });
  const mineActor = actorIn(map, '0,0');
  stepPhysics({ map, actor: mineActor, origin: ORIGIN });
  assert.equal(mineActor.health, MAX_HEALTH - 37);

  const oxygenMap = createEmptyMap({ width: 1, height: 1 });
  patchCell(oxygenMap, '0,0', {
    gravityLevel: 'L0',
    freeObjects: [{ kind: 'oxygen', offset: { x: 0, y: 0 }, size: 20, params: { oxygenAmount: 35, activationSpeed: 10 } }],
  });
  const oxygenActor = actorIn(oxygenMap, '0,0');
  oxygenActor.oxygen = 0;
  oxygenActor.vx = 20;
  stepPhysics({ map: oxygenMap, actor: oxygenActor, origin: ORIGIN });
  assert.ok(oxygenActor.oxygen >= 34, 'custom oxygen amount should be granted after the configured impact speed');
  assert.equal(getActiveCell(oxygenMap, '0,0').freeObjects.length, 0, 'spent oxygen ore should be removed');

  const torricelliMap = createEmptyMap({ width: 1, height: 1 });
  patchCell(torricelliMap, '0,0', {
    gravityLevel: 'L0',
    freeObjects: [{ kind: 'torricelli', offset: { x: 0, y: 0 }, size: 20, params: { oxygenRecoveryPerSecond: 25 } }],
  });
  const torricelliActor = actorIn(torricelliMap, '0,0');
  torricelliActor.oxygen = 10;
  stepPhysics({ map: torricelliMap, actor: torricelliActor, origin: ORIGIN, dt: 0.5 });
  assert.ok(Math.abs(torricelliActor.oxygen - (10 + (25 - OXYGEN_DRAIN_PER_SECOND) * 0.5)) < 0.0001, 'Torricelli recovery should use the configured per-second rate after the oxygen clock');

  const descentRestMap = createEmptyMap({ width: 1, height: 1 });
  descentRestMap.metadata = { chapter: '下沉篇' };
  patchCell(descentRestMap, '0,0', {
    gravityLevel: 'L1',
    freeObjects: [{ kind: 'torricelli', offset: { x: 0, y: 0 }, size: 20, params: { oxygenRecoveryPerSecond: 25 } }],
  });
  const descentRestActor = actorIn(descentRestMap, '0,0');
  descentRestActor.oxygen = 10;
  descentRestActor.energy = 0;
  descentRestActor.energyRecoveryDelay = 0;
  const beforeRestY = descentRestActor.y;
  stepPhysics({ map: descentRestMap, actor: descentRestActor, origin: ORIGIN, dt: 0.5 });
  assert.ok(descentRestActor.y < beforeRestY, 'the L1 Torricelli rest room should naturally float upward in a descent map');
  assert.ok(descentRestActor.oxygen > 10, 'resting in Torricelli space should refill oxygen while floating');
  assert.ok(descentRestActor.energy > 0, 'resting in Torricelli space should allow idle energy recovery without another launch');
});

test('custom edge parameters control spring force and spike damage', () => {
  const springMap = createEmptyMap({ width: 2, height: 1 });
  patchCell(springMap, '0,0', { gravityLevel: 'L0' });
  patchCell(springMap, '1,0', { gravityLevel: 'L0' });
  patchEdge(springMap, '0,0', '1,0', { type: 'springJelly', blocksPassage: true, params: { bounceMultiplier: 1.8 } });
  const springActor = actorIn(springMap, '0,0');
  springActor.vx = 140;
  let springEvents = [];
  for (let index = 0; index < 20; index += 1) {
    springEvents = stepPhysics({ map: springMap, actor: springActor, origin: ORIGIN });
    if (springEvents.some((event) => event.type === 'springJelly')) break;
  }
  assert.ok(springEvents.some((event) => event.type === 'springJelly'));
  assert.ok(Math.abs(springActor.vx) > 100, 'custom spring force should preserve a stronger rebound');

  const spikeMap = createEmptyMap({ width: 2, height: 1 });
  patchCell(spikeMap, '0,0', { gravityLevel: 'L0' });
  patchCell(spikeMap, '1,0', { gravityLevel: 'L0' });
  patchEdge(spikeMap, '0,0', '1,0', { type: 'spike', blocksPassage: true, params: { damage: 46 } });
  const spikeActor = actorIn(spikeMap, '0,0');
  spikeActor.vx = 140;
  let spikeEvents = [];
  for (let index = 0; index < 20; index += 1) {
    spikeEvents = stepPhysics({ map: spikeMap, actor: spikeActor, origin: ORIGIN });
    if (spikeEvents.some((event) => event.type === 'spike')) break;
  }
  assert.ok(spikeEvents.some((event) => event.type === 'spike'));
  assert.equal(spikeActor.health, MAX_HEALTH - 46);
});

test('edge-attached coral cluster protects a nearby player', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0', objects: [{ kind: 'mine' }] });
  patchCell(map, '1,0', { gravityLevel: 'L0' });
  patchEdge(map, '0,0', '1,0', { type: 'coralCluster', blocksPassage: false });
  const actor = actorIn(map, '0,0');
  actor.vx = 100;
  const events = stepPhysics({ map, actor, origin: ORIGIN });
  assert.ok(events.some((event) => event.type === 'coralCluster'));
  assert.equal(actor.safe, true);
  assert.equal(actor.health, MAX_HEALTH);
});

test('high-speed impact breaks a weight stone and checkpoint restores resources', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0', objects: [{ kind: 'weightStone' }] });
  const breaker = actorIn(map, '0,0');
  breaker.vx = 400;
  const stoneEvents = stepPhysics({ map, actor: breaker, origin: ORIGIN });
  assert.ok(stoneEvents.some((event) => event.type === 'weightStone'));
  assert.deepEqual(getActiveCell(map, '0,0').objects, []);

  patchCell(map, '1,0', { gravityLevel: 'L0', objects: [{ kind: 'checkpoint' }] });
  const visitor = actorIn(map, '1,0');
  visitor.health = 1;
  visitor.oxygen = 12;
  visitor.energy = 5;
  const checkpointEvents = stepPhysics({ map, actor: visitor, origin: ORIGIN });
  assert.ok(checkpointEvents.some((event) => event.type === 'checkpoint'));
  assert.equal(stepPhysics({ map, actor: visitor, origin: ORIGIN }).some((event) => event.type === 'checkpoint'), false);
  visitor.x = ORIGIN.x;
  visitor.y = ORIGIN.y;
  stepPhysics({ map, actor: visitor, origin: ORIGIN });
  visitor.x = getHexCenter(getActiveCell(map, '1,0', 'chapter1'), ORIGIN).x;
  visitor.y = getHexCenter(getActiveCell(map, '1,0', 'chapter1'), ORIGIN).y;
  assert.equal(stepPhysics({ map, actor: visitor, origin: ORIGIN }).some((event) => event.type === 'checkpoint'), true);
  assert.equal(visitor.health, MAX_HEALTH);
  assert.equal(visitor.oxygen, 100);
  assert.equal(visitor.energy, 100);
});

test('bubble grants gravity immunity and seaweed suspends gravity', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L3', objects: [{ kind: 'bubble' }] });
  patchCell(map, '1,0', { gravityLevel: 'L3' });
  patchEdge(map, '0,0', '1,0', { type: 'seaweed', blocksPassage: false });
  const bubbleActor = actorIn(map, '0,0');
  stepPhysics({ map, actor: bubbleActor, origin: ORIGIN });
  const afterContact = bubbleActor.vy;
  assert.equal(map.cells['0,0'].objects.some((object) => object.kind === 'bubble'), false, 'a photosynthesis bubble is consumed on contact');
  assert.equal(bubbleActor.launchLockTimer, 1.5);
  assert.deepEqual(launchActor(bubbleActor, { x: bubbleActor.x + 80, y: bubbleActor.y }), { launched: false, reason: 'bubbleLock' });
  stepPhysics({ map, actor: bubbleActor, origin: ORIGIN });
  assert.ok(bubbleActor.gravityImmunity > 2.4);
  assert.ok(bubbleActor.launchLockTimer > 1.4);
  assert.ok(bubbleActor.vy < afterContact + 0.2, 'the next step should not add L3 gravity');
  stepPhysics({ map, actor: bubbleActor, origin: ORIGIN, dt: 1.6 });
  assert.equal(bubbleActor.launchLockTimer, 0);
  assert.equal(launchActor(bubbleActor, { x: bubbleActor.x + 80, y: bubbleActor.y }).launched, true);

  const seaweedActor = actorIn(map, '1,0');
  const attached = toggleSeaweedAttachment(seaweedActor, map, 'chapter1', ORIGIN);
  assert.equal(attached.attached, true);
  stepPhysics({ map, actor: seaweedActor, origin: ORIGIN });
  assert.equal(seaweedActor.vy, 0);
  assert.ok(seaweedActor.energy > 100 - 0.01);
});

test('razor free object damages and forcibly displaces the actor', () => {
  const map = createEmptyMap({ width: 1, height: 1 });
  patchCell(map, '0,0', {
    gravityLevel: 'L0',
    freeObjects: [{
      kind: 'razor',
      offset: { x: 0, y: 0 },
      size: 48,
      params: { damage: 20, knockbackSpeed: 58, rotationSpeed: 180 },
    }],
  });
  const actor = actorIn(map, '0,0');
  const beforeHealth = actor.health;
  const events = stepPhysics({ map, actor, origin: ORIGIN });
  assert.ok(events.some((event) => event.type === 'razor'));
  assert.equal(actor.health, beforeHealth - 20);
  assert.ok(Math.hypot(actor.vx, actor.vy) >= 58);
});

test('a button opens its explicitly assigned gate once and keeps the gate at L1', () => {
  const map = createEmptyMap({ width: 3, height: 2 });
  const gateKey = cellKeyFromColumn(1, 1);
  patchCell(map, '1,0', { gravityLevel: 'L3' });
  patchCell(map, '2,0', { gravityLevel: 'L-1' });
  patchCell(map, gateKey, { terrain: 'blocked', gravityLevel: 'L1', conditionalGate: { opened: false } });
  patchCell(map, '0,0', {
    freeObjects: [{ kind: 'button', offset: { x: 0, y: 0 }, targetGates: [gateKey] }],
  });
  const actor = actorIn(map, '0,0');
  const firstEvents = stepPhysics({ map, actor, origin: ORIGIN });
  assert.equal(getActiveCell(map, gateKey).terrain, 'water');
  assert.equal(getActiveCell(map, gateKey).gravityLevel, 'L1');
  assert.equal(getActiveCell(map, gateKey).conditionalGate.opened, true);
  assert.equal(getActiveCell(map, '0,0').freeObjects[0].pressed, true);
  assert.ok(firstEvents.some((event) => event.type === 'button'));

  const secondEvents = stepPhysics({ map, actor, origin: ORIGIN });
  assert.equal(secondEvents.some((event) => event.type === 'button'), false, 'a pressed button must not trigger again');
});

test('blocked terrain reflects a player instead of becoming passable', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '1,0', { terrain: 'blocked' });
  const actor = actorIn(map, '0,0');
  actor.vx = 140;
  const before = actor.x;
  const events = [];
  for (let index = 0; index < 30 && !events.some((event) => event.type === 'terrainBoundary'); index += 1) {
    events.push(...stepPhysics({ map, actor, origin: ORIGIN }));
  }
  assert.ok(events.some((event) => event.type === 'terrainBoundary'));
  assert.ok(actor.x < getHexCenter(getActiveCell(map, '1,0'), ORIGIN).x - actor.radius);
  assert.ok(actor.x > before);
  assert.ok(actor.vx < 0, 'blocked terrain should reflect horizontal velocity');
});

test('blocked terrain cannot turn downward motion into hidden upward lift', () => {
  const map = createEmptyMap({ width: 2, height: 2 });
  patchCell(map, '0,0', { gravityLevel: 'L1' });
  patchCell(map, '0,1', { terrain: 'blocked' });
  const actor = actorIn(map, '0,0');
  actor.vx = 140;
  actor.vy = 140;
  let events = [];
  for (let index = 0; index < 30 && !events.some((event) => event.type === 'terrainBoundary'); index += 1) {
    events = events.concat(stepPhysics({ map, actor, origin: ORIGIN }));
  }
  assert.ok(events.some((event) => event.type === 'terrainBoundary'));
  assert.ok(actor.vy >= 0, 'a blocked wall must not create upward velocity in a downward-gravity Cell');
});

test('blocked terrain collision does not teleport the player upward', () => {
  const map = createEmptyMap({ width: 2, height: 2 });
  patchCell(map, '0,0', { gravityLevel: 'L1' });
  patchCell(map, '0,1', { terrain: 'blocked' });
  const actor = actorIn(map, '0,0');
  actor.vx = 140;
  actor.vy = 140;
  let events = [];
  let collisionStepY = actor.y;
  for (let index = 0; index < 30 && !events.some((event) => event.type === 'terrainBoundary'); index += 1) {
    collisionStepY = actor.y;
    events = events.concat(stepPhysics({ map, actor, origin: ORIGIN }));
  }
  assert.ok(events.some((event) => event.type === 'terrainBoundary'));
  assert.ok(actor.y >= collisionStepY, 'collision resolution must not jump the player to a smaller y position');
});

test('multi-edge portals pair equal edge groups and teleport the actor', () => {
  const map = createEmptyMap({ width: 12, height: 3 });
  const origin = { x: 120, y: 120 };
  const firstGroup = 'portal-test-a';
  const secondGroup = 'portal-test-b';
  const firstEdges = [];
  const secondEdges = [];
  for (let column = 1; column <= 3; column += 1) {
    const firstA = cellKeyFromColumn(column, 1);
    const firstB = neighborKey(firstA, 0);
    const secondA = cellKeyFromColumn(column + 7, 1);
    const secondB = neighborKey(secondA, 0);
    patchCell(map, firstB, { terrain: 'blocked' });
    patchCell(map, secondB, { terrain: 'blocked' });
    patchEdge(map, firstA, firstB, { type: MULTI_PORTAL_EDGE_TYPE, portalGroupId: firstGroup, portalSlot: column - 1, portalTargetKey: null });
    patchEdge(map, secondA, secondB, { type: MULTI_PORTAL_EDGE_TYPE, portalGroupId: secondGroup, portalSlot: column - 1, portalTargetKey: null });
    firstEdges.push(edgeKey(firstA, firstB));
    secondEdges.push(edgeKey(secondA, secondB));
  }
  const connection = connectPortalGroups(map, firstGroup, secondGroup);
  assert.deepEqual(connection, { ok: true, count: 3 });
  assert.deepEqual(getPortalGroupEdges(map, firstGroup).map((entry) => entry.edge.portalTargetKey), secondEdges);
  const sourceCell = getActiveCell(map, cellKeyFromColumn(1, 1));
  const actor = createTestActor(getHexCenter(sourceCell, origin));
  actor.vx = 120;
  const events = [];
  for (let index = 0; index < 30 && !events.some((event) => event.type === 'multiPortal'); index += 1) {
    events.push(...stepPhysics({ map, actor, origin, mutateMap: false }));
  }
  assert.ok(events.some((event) => event.type === 'multiPortal'), 'crossing a paired portal Edge should teleport');
  assert.ok(actor.x > getHexCenter(getActiveCell(map, cellKeyFromColumn(8, 1)), origin).x - 20, 'actor should arrive near the paired group');
  assert.equal(validateMap(map).some((result) => result.level === 'error'), false);
});

test('health is 0-100 and losing all health permanently consumes one life', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  assert.equal(actor.health, 100);
  assert.equal(actor.lives, MAX_LIVES);
  const hit = applyDamage(actor, 100, 'test', 'generic');
  assert.equal(hit.defeated, true);
  const death = registerPlayerDeath(actor, 'damage');
  assert.equal(death.livesRemaining, MAX_LIVES - 1);
  assert.equal(actor.health, 0);
  actor.activeEffects = { venom: { remaining: 2.5 } };
  actor.stunnedUntil = 99;
  assert.equal(respawnActor(actor, { x: 240, y: 240 }), true);
  assert.equal(actor.health, MAX_HEALTH);
  assert.equal(actor.lives, MAX_LIVES - 1);
  assert.deepEqual(actor.activeEffects, {});
  assert.equal(actor.stunnedUntil, 0);
});

test('play assistance supports the authored player damage-reduction choices', () => {
  const choices = new Map([[0, 100], [0.3, 70], [0.5, 50], [0.75, 25], [0.9, 10]]);
  choices.forEach((expectedDamage, reduction) => {
    const actor = createTestActor();
    assert.equal(setPlayerDamageReduction(actor, reduction), reduction);
    assert.ok(Math.abs(applyDamage(actor, 100, 'difficulty assistance').applied - expectedDamage) < 1e-9);
  });
  const actor = createTestActor();
  assert.equal(setPlayerDamageReduction(actor, 4), 0.9, '減傷必須封頂於 90% 而不是形成無敵');
});

test('the last life enters permanent game over and cannot respawn', () => {
  const actor = createTestActor();
  actor.lives = 1;
  actor.health = 0;
  const death = registerPlayerDeath(actor, 'damage');
  assert.equal(death.gameOver, true);
  assert.equal(actor.lives, 0);
  assert.equal(respawnActor(actor, { x: 1, y: 1 }), false);
});

test('player animation states prioritize death, hurt, fast ascent, and swimming', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  assert.equal(getPlayerAnimationState(actor), 'swim');
  actor.vy = FAST_ASCENT_VELOCITY - 1;
  assert.equal(getPlayerAnimationState(actor), 'fastAscent');
  actor.vy = 0;
  actor.hurtTimer = 0.2;
  assert.equal(getPlayerAnimationState(actor), 'hurt');
  actor.deathAnimation = { x: 321, y: 123, timer: 0.4 };
  assert.equal(getPlayerAnimationState(actor), 'death');
  assert.deepEqual(getPlayerAnimationPosition(actor), { x: 321, y: 123 });
  assert.equal(getPlayerAnimationFrameIndex('swim', 0), 0);
  assert.equal(getPlayerAnimationFrameIndex('swim', 0.5), 0);
  actor.deathAnimation = null;
  actor.facing = 'left';
  actor.vx = 80;
  assert.equal(getPlayerFacingDirection(actor), 'left');
  actor.facing = 'right';
  actor.vx = -80;
  assert.equal(getPlayerFacingDirection(actor), 'right');
  actor.vx = 0;
  actor.vy = 0;
  actor.hurtTimer = 0;
  actor.blockedResting = true;
  assert.equal(getPlayerAnimationState(actor), 'rest');
  assert.equal(Object.values(PLAYER_ANIMATION_ASSETS).every((frames) => frames.length === 6), true);
});

test('all defined weapons, passive abilities, and enemy attack contracts are numeric', () => {
  assert.deepEqual(Object.keys(WEAPONS), ['knife', 'katana', 'trident', 'lightMachineGun']);
  Object.values(WEAPONS).forEach((weapon) => {
    [1, 2, 3].forEach((level) => {
      const stats = getWeaponStats(weapon.id, level);
      assert.ok(stats.damage > 0);
      assert.ok(stats.cooldown > 0);
      assert.ok(calculateWeaponDamage(weapon.id, level) > 0);
    });
  });
  assert.deepEqual(Object.keys(PASSIVE_ABILITIES), ['oxygenCirculator', 'pressureStabilizer', 'ecologicalCarapace', 'abyssalAmplifier']);
  assert.equal(getPassiveModifiers([{ id: 'oxygenCirculator', level: 3 }]).maxOxygenMultiplier, 1.2);
  assert.equal(getPassiveModifiers([{ id: 'pressureStabilizer', level: 3 }]).launchEnergyCostMultiplier, 0.7);
  assert.equal(getWeaponUseCost('knife', 1, [{ id: 'pressureStabilizer', level: 3 }]), 2.8);

  assert.equal(ENEMY_ORDER.length, 19);
  ENEMY_ORDER.forEach((enemyId) => {
    const definition = ENEMY_DEFINITIONS[enemyId];
    const state = createEnemyState(enemyId);
    assert.equal(state.health, definition.maxHealth);
    assert.ok(definition.attacks.length > 0, `${enemyId} should expose attack or support skills`);
    definition.attacks.forEach((skill) => {
      assert.equal(typeof skill.id, 'string');
      assert.ok(skill.cooldown >= 0);
      assert.ok(skill.damage >= 0);
    });
  });
});

test('passive recovery and shield thresholds are numerical gameplay rules', () => {
  const actor = createTestActor();
  setPlayerLoadoutForTest(actor);
  actor.energy = 50;
  actor.oxygen = 50;
  const rewards = applyEnemyDefeatRewards(actor);
  assert.equal(rewards.energy.recovered, 4);
  assert.equal(rewards.oxygen.recovered, 4);
  actor.health = 80;
  assert.equal(recoverPlayerResource(actor, 'health', 20).recovered, 20);
  actor.derivedStats.shieldThresholdRatio = 0.2;
  actor.derivedStats.shieldDuration = 2;
  actor.derivedStats.shieldCooldown = 8;
  applyDamage(actor, 20, 'test', 'generic');
  assert.ok(actor.shieldTimer > 0);
  assert.equal(applyDamage(actor, 20, 'test', 'generic').blocked, true);
});

test('all four passive abilities apply their authored gameplay effects', () => {
  const oxygenStats = getPlayerDerivedStats([{ id: 'oxygenCirculator', level: 3 }], 55);
  assert.equal(oxygenStats.maxOxygen, 120);
  assert.equal(oxygenStats.oxygenDrainMultiplier, 0.9);
  assert.equal(oxygenStats.launchEnergyCostMultiplier, 0.7);
  assert.equal(oxygenStats.weaponEnergyCostMultiplier, 0.7);
  assert.equal(oxygenStats.lowOxygenDamageTakenMultiplier, 0.85);
  const oxygenActor = createTestActor();
  oxygenActor.derivedStats = oxygenStats;
  oxygenActor.oxygen = 55;
  assert.equal(applyDamage(oxygenActor, 20, 'low-oxygen test').applied, 17);
  const oxygenHealthyStats = getPlayerDerivedStats([{ id: 'oxygenCirculator', level: 3 }], 80);
  assert.equal(oxygenHealthyStats.launchEnergyCostMultiplier, 1, '氧氣高於一半時不應取得低氧體力減耗');
  const oxygenDrainActor = createTestActor();
  oxygenDrainActor.derivedStats = getPlayerDerivedStats([{ id: 'oxygenCirculator', level: 1 }], 100);
  assert.equal(getOxygenDrainPerSecond(oxygenDrainActor), OXYGEN_DRAIN_PER_SECOND * 0.9);

  const pressureStats = getPlayerDerivedStats([{ id: 'pressureStabilizer', level: 3 }]);
  const pressureActor = createTestActor();
  pressureActor.derivedStats = pressureStats;
  pressureActor.energy = 0;
  pressureActor.oxygen = 0;
  assert.equal(getLaunchCosts(100, pressureActor).energy, 3.5);
  const pressureRewards = applyEnemyDefeatRewards(pressureActor);
  assert.equal(pressureRewards.energy.recovered, 8);
  assert.equal(pressureRewards.oxygen.recovered, 4);

  const carapaceActor = createTestActor();
  carapaceActor.derivedStats = getPlayerDerivedStats([{ id: 'ecologicalCarapace', level: 3 }]);
  assert.equal(applyDamage(carapaceActor, 20, 'ranged test', 'ranged').applied, 16);
  carapaceActor.health = MAX_HEALTH;
  const shieldHit = applyDamage(carapaceActor, 25, 'shield test');
  assert.equal(shieldHit.applied, 25);
  assert.equal(carapaceActor.shieldTimer, 2);
  assert.equal(applyDamage(carapaceActor, 1, 'shield test').blocked, true);

  const amplifierLoadout = [{ id: 'abyssalAmplifier', level: 3 }];
  assert.ok(Math.abs(calculateWeaponDamage('knife', 1, { loadout: amplifierLoadout, oxygen: 100 }) - 26.91 * 0.6) < 1e-9);
  assert.ok(Math.abs(calculateWeaponDamage('knife', 1, { loadout: amplifierLoadout, oxygen: 40 }) - 23.4 * 0.6) < 1e-9);
});

test('sandbox can run every defined enemy skill without a missing implementation', () => {
  const state = createSandboxState();
  getSandboxEnemyIds().forEach((enemyId, index) => {
    const enemy = spawnSandboxEnemy(state, enemyId, { x: 600 + (index % 4) * 70, y: 120 + (index % 5) * 70 });
    ENEMY_DEFINITIONS[enemyId].attacks.forEach((skill) => {
      if (skill.type === 'suicideCharge') {
        enemy.x = state.actor.x;
        enemy.y = state.actor.y;
      }
      const result = executeEnemySkill(state, enemy.instanceId, skill.id);
      assert.equal(result.ok, true, `${enemyId}/${skill.id} should be executable in the sandbox`);
      enemy.cooldowns[skill.id] = 0;
    });
  });
  assert.ok(state.logs.length > getSandboxEnemyIds().length, 'sandbox should record skill events for inspection');
});

test('sandbox build customization and invincibility preserve weapon/passive behavior', () => {
  const state = createSandboxState();
  setSandboxBuild(state, {
    weaponId: 'trident',
    weaponLevel: 3,
    passives: [{ id: 'abyssalAmplifier', level: 3 }, { id: 'pressureStabilizer', level: 2 }],
  });
  assert.deepEqual(state.actor.activeWeapon, { id: 'trident', level: 3 });
  assert.equal(state.actor.abilities.length, 2);
  assert.ok(state.actor.derivedStats.damageMultiplier > 1);
  state.invincible = true;
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 20, y: state.actor.y });
  executeEnemySkill(state, enemy.instanceId, 'clawSwipe');
  assert.equal(state.actor.health, MAX_HEALTH);
});

test('sandbox player projectile attack reaches a placed enemy', () => {
  const state = createSandboxState();
  setSandboxBuild(state, { weaponId: 'trident', weaponLevel: 3 });
  const enemy = spawnSandboxEnemy(state, 'crabGuard', { x: state.actor.x + 120, y: state.actor.y });
  state.selectedEnemyInstanceId = enemy.instanceId;
  assert.equal(playerAttack(state).ok, true);
  for (let index = 0; index < 120; index += 1) stepSandbox(state);
  assert.ok(enemy.health < enemy.maxHealth, 'a sandbox projectile should damage the selected enemy');
});

test('sandbox player uses zero gravity while preserving launch direction', () => {
  const state = createSandboxState();
  state.actor.y = 120;
  state.actor.vx = 40;
  const startY = state.actor.y;
  stepSandbox(state);
  assert.equal(state.infiniteResources, true, 'the sandbox should keep O2 and energy unlimited');
  assert.ok(Object.values(state.physicsMap.cells).every((cell) => cell.gravityLevel === 'L0'), 'the sandbox physics field should be neutral gravity');
  assert.equal(state.actor.y, startY, 'zero gravity should not move the diver vertically');
  assert.equal(state.actor.vy, 0, 'zero gravity should not add vertical velocity');
  assert.ok(state.actor.x > 150, 'horizontal launch momentum should remain available for combat testing');
});

test('sandbox zero gravity preserves the exact selected launch vector over time', () => {
  const state = createSandboxState();
  state.actor.x = 420;
  state.actor.y = 280;
  assert.equal(beginSandboxAim(state, { x: state.actor.x, y: state.actor.y }).ok, true);
  updateSandboxAim(state, { x: state.actor.x + 160, y: state.actor.y + 120 });
  assert.equal(releaseSandboxAim(state).launched, true);
  const initialVelocity = { x: state.actor.vx, y: state.actor.vy };
  const initialPosition = { x: state.actor.x, y: state.actor.y };
  const dt = 0.25;

  stepSandbox(state, dt);

  assert.equal(state.zeroGravity, true);
  assert.ok(initialVelocity.x < 0 && initialVelocity.y < 0, 'pulling down-right should launch upper-left');
  assert.ok(Math.abs(state.actor.vx - initialVelocity.x) < 1e-9, 'horizontal launch velocity should not drift');
  assert.ok(Math.abs(state.actor.vy - initialVelocity.y) < 1e-9, 'vertical launch velocity should not drift');
  assert.ok(Math.abs((state.actor.x - initialPosition.x) - initialVelocity.x * dt) < 1e-9);
  assert.ok(Math.abs((state.actor.y - initialPosition.y) - initialVelocity.y * dt) < 1e-9);
});

test('sandbox elastic launch moves the player and damages enemies on collision', () => {
  const state = createSandboxState();
  const enemy = spawnSandboxEnemy(state, 'juvenileSeahorseCaller', { x: state.actor.x + 20, y: state.actor.y });
  assert.equal(beginSandboxAim(state, { x: state.actor.x, y: state.actor.y }).ok, true);
  updateSandboxAim(state, { x: state.actor.x - 80, y: state.actor.y });
  const launch = releaseSandboxAim(state);
  assert.equal(launch.launched, true);
  assert.ok(state.actor.vx > 0, 'pulling left should launch the player right');
  for (let index = 0; index < 120; index += 1) stepSandbox(state);
  assert.ok(enemy.health < enemy.maxHealth, 'elastic collision should use the equipped weapon damage');
});

function setPlayerLoadoutForTest(actor) {
  actor.derivedStats = {
    ...actor.derivedStats,
    killEnergyRecoveryRatio: 0.04,
    killOxygenRecoveryRatio: 0.04,
  };
}
