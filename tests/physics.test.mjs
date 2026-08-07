import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyMap,
  cellKeyFromColumn,
  getActiveCell,
  getHexCenter,
  HEX_SIZE,
  migrateMapToOddR,
  screenPointToWorldPoint,
  patchCell,
  patchEdge,
} from '../src/map-model.js';
import {
  FIXED_STEP,
  GAME_GRAVITY,
  MAX_SPEED,
  SIMULATION_SPEED_SCALE,
  createTestActor,
  launchActor,
  stepPhysics,
  toggleSeaweedAttachment,
} from '../src/physics.js';

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
  assert.ok(neutral.vx > 39, 'L0 should not clear horizontal velocity');
  assert.ok(Math.abs(neutral.vy) < 0.01, 'L0 should add no vertical gravity');
});

test('launch velocity is opposite the pull direction', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  const speed = launchActor(actor, { x: 120, y: 200 });
  assert.ok(speed > 0);
  assert.ok(actor.vx > 0);
  assert.equal(actor.vy, 0);
  assert.ok(speed < 30, 'launch speed should use the 0.1 simulation scale');
});

test('all primary motion limits use the 0.1 simulation scale', () => {
  assert.equal(SIMULATION_SPEED_SCALE, 0.1);
  assert.equal(GAME_GRAVITY, 23);
  assert.equal(MAX_SPEED, 56);
});

test('precision editor uses a rectangular odd-r grid at three Cells across one player diameter', () => {
  const map = createEmptyMap();
  const actor = createTestActor();
  assert.deepEqual(map.layout, { orientation: 'pointy', coordinateSystem: 'axial', rowLayout: 'odd-r rectangle', width: 36, height: 25 });
  assert.equal(HEX_SIZE * 2 * 3, actor.radius * 2);
  assert.ok(map.cells[cellKeyFromColumn(0, 0)]);
  assert.ok(map.cells[cellKeyFromColumn(0, 24)]);
  assert.ok(map.cells[cellKeyFromColumn(35, 24)]);
  assert.equal(Object.keys(map.cells).length, 36 * 25);
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

test('spring jelly reflects a crossing player', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0' });
  patchCell(map, '1,0', { gravityLevel: 'L0' });
  patchEdge(map, '0,0', '1,0', { type: 'springJelly', blocksPassage: true });
  const actor = actorIn(map, '0,0');
  actor.vx = 500;
  let events = [];
  for (let index = 0; index < 15; index += 1) {
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

test('coral safety prevents a mine from dealing damage', () => {
  const map = createEmptyMap({ width: 1, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L0', overlays: ['coral'], objects: [{ kind: 'mine' }] });
  const actor = actorIn(map, '0,0');
  actor.vx = 100;
  const events = stepPhysics({ map, actor, origin: ORIGIN });
  assert.ok(events.some((event) => event.type === 'mine'));
  assert.equal(actor.health, 3);
  assert.equal(actor.safe, true);
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
  visitor.stamina = 5;
  const checkpointEvents = stepPhysics({ map, actor: visitor, origin: ORIGIN });
  assert.ok(checkpointEvents.some((event) => event.type === 'checkpoint'));
  assert.equal(visitor.health, 3);
  assert.equal(visitor.oxygen, 100);
  assert.equal(visitor.stamina, 100);
});

test('bubble grants gravity immunity and seaweed suspends gravity', () => {
  const map = createEmptyMap({ width: 2, height: 1 });
  patchCell(map, '0,0', { gravityLevel: 'L3', objects: [{ kind: 'bubble' }] });
  patchCell(map, '1,0', { gravityLevel: 'L3', objects: [{ kind: 'seaweed' }] });
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
  assert.ok(seaweedActor.stamina > 100 - 0.01);
});
