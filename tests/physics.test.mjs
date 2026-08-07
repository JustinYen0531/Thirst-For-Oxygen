import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyMap,
  createBlankMap,
  cellKeyFromColumn,
  getActiveCell,
  findCellContainingPoint,
  getOddRRectangularBounds,
  getHexCenter,
  HEX_SIZE,
  migrateMapToOddR,
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
  SIMULATION_SPEED_SCALE,
  createTestActor,
  drainAimEnergy,
  getLaunchCosts,
  getLaunchSpeed,
  launchActor,
  applyDamage,
  applyEnemyDefeatRewards,
  recoverPlayerResource,
  registerPlayerDeath,
  respawnActor,
  stepPhysics,
  toggleSeaweedAttachment,
} from '../src/physics.js';
import {
  ENEMY_DEFINITIONS,
  ENEMY_ORDER,
  PASSIVE_ABILITIES,
  WEAPONS,
  calculateWeaponDamage,
  createEnemyState,
  getPassiveModifiers,
  getWeaponStats,
  getWeaponUseCost,
} from '../src/game-data.js';
import {
  getEdgeSetting,
  getFreeObjectSetting,
  getOfficialEdgeState,
  getOfficialFreeObjectState,
} from '../src/map-object-settings.js';

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

test('launch velocity is opposite the pull direction', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  const launch = launchActor(actor, { x: 120, y: 200 });
  assert.ok(launch.launched);
  assert.ok(launch.speed > 0);
  assert.ok(actor.vx > 0);
  assert.equal(actor.vy, 0);
  assert.ok(launch.speed < 30, 'launch speed should use the 0.1 simulation scale');
  assert.ok(actor.oxygen < 100, 'launch should consume oxygen');
  assert.ok(actor.energy < 100, 'launch should consume energy');
});

test('long launches gain extra speed while short launches keep the old scale', () => {
  assert.equal(getLaunchSpeed(80), 23.2);
  assert.ok(getLaunchSpeed(240) > getLaunchSpeed(80) * 2.5);
  assert.ok(getLaunchSpeed(420) > getLaunchSpeed(240));
});

test('launch requires both oxygen and energy, while aiming consumes energy', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  const costs = getLaunchCosts(80);
  actor.oxygen = costs.oxygen - 0.01;
  assert.equal(launchActor(actor, { x: 120, y: 200 }).reason, 'oxygen');

  actor.oxygen = 100;
  actor.energy = costs.energy - 0.01;
  assert.equal(launchActor(actor, { x: 120, y: 200 }).reason, 'energy');

  actor.energy = 10;
  drainAimEnergy(actor, 0.5);
  assert.ok(actor.energy < 10);
});

test('all primary motion limits use the 0.1 simulation scale', () => {
  assert.equal(SIMULATION_SPEED_SCALE, 0.1);
  assert.equal(GRAVITY_SCALE, 0.5);
  assert.equal(GAME_GRAVITY, 11.5);
  assert.equal(MAX_SPEED, 140);
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
  assert.deepEqual(getOfficialFreeObjectState('ink'), { size: 22, params: { visibilityRadius: 110 } });
  assert.deepEqual(getOfficialFreeObjectState('weightStone'), { size: 17, params: { breakSpeed: 31, weight: 4 } });
  assert.deepEqual(getOfficialEdgeState('springJelly'), { size: 1, params: { bounceMultiplier: 1.08 } });
  assert.equal(getFreeObjectSetting({ kind: 'mine', params: { damage: 37 } }, 'damage'), 37);
  assert.equal(getEdgeSetting({ type: 'spike', params: { damage: 46 } }, 'damage'), 46);
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
  assert.ok(torricelliActor.oxygen > 22, 'Torricelli recovery should use the configured per-second rate');
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
  stepPhysics({ map, actor: bubbleActor, origin: ORIGIN });
  assert.ok(bubbleActor.gravityImmunity > 2.4);
  assert.ok(bubbleActor.vy < afterContact + 0.2, 'the next step should not add L3 gravity');

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

test('health is 0-100 and losing all health permanently consumes one life', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  assert.equal(actor.health, 100);
  assert.equal(actor.lives, MAX_LIVES);
  const hit = applyDamage(actor, 100, 'test', 'generic');
  assert.equal(hit.defeated, true);
  const death = registerPlayerDeath(actor, 'damage');
  assert.equal(death.livesRemaining, MAX_LIVES - 1);
  assert.equal(actor.health, 0);
  assert.equal(respawnActor(actor, { x: 240, y: 240 }), true);
  assert.equal(actor.health, MAX_HEALTH);
  assert.equal(actor.lives, MAX_LIVES - 1);
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

function setPlayerLoadoutForTest(actor) {
  actor.derivedStats = {
    ...actor.derivedStats,
    killEnergyRecoveryRatio: 0.04,
    killOxygenRecoveryRatio: 0.04,
  };
}
