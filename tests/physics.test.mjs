import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyMap,
  getActiveCell,
  getHexCenter,
  patchCell,
  patchEdge,
} from '../src/map-model.js';
import {
  FIXED_STEP,
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
  neutral.vx = 200;
  stepPhysics({ map, actor: upward, origin: ORIGIN });
  stepPhysics({ map, actor: neutral, origin: ORIGIN });
  assert.ok(upward.vy < 0);
  assert.ok(neutral.vx > 190, 'L0 should not clear horizontal velocity');
  assert.ok(Math.abs(neutral.vy) < 0.01, 'L0 should add no vertical gravity');
});

test('launch velocity is opposite the pull direction', () => {
  const actor = createTestActor({ x: 200, y: 200 });
  const speed = launchActor(actor, { x: 120, y: 200 });
  assert.ok(speed > 0);
  assert.ok(actor.vx > 0);
  assert.equal(actor.vy, 0);
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
  assert.ok(actor.vx > 1, 'eastward current should add positive x velocity');
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
