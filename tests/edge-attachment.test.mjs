import assert from 'node:assert/strict';
import test from 'node:test';
import { getEdgeAttachmentGeometry } from '../src/edge-attachment.js';

const EPSILON = 1e-9;

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < EPSILON, `${message}: expected ${expected}, got ${actual}`);
}

function transformedLocalY(angle) {
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

test('wall attachment lies along the shared edge and is inset into blocked terrain', () => {
  const geometry = getEdgeAttachmentGeometry(
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    'water',
    'blocked',
    { edgeLength: 12, blockedInset: 1.5 },
  );

  assert.deepEqual(geometry.edgeStart, { x: 10, y: -6 });
  assert.deepEqual(geometry.edgeEnd, { x: 10, y: 6 });
  assert.deepEqual(geometry.attachmentPoint, { x: 11.5, y: 0 });
  const spikeDirection = transformedLocalY(geometry.pointsIntoOpenAngle);
  assertNear(spikeDirection.x, -1, 'spikes point toward open water');
  assertNear(spikeDirection.y, 0, 'spikes do not point along the wall');
});

test('wall-facing artwork remains correct when blocked and water cells swap sides', () => {
  const geometry = getEdgeAttachmentGeometry(
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    'blocked',
    'water',
    { edgeLength: 12, blockedInset: 2 },
  );

  assert.deepEqual(geometry.attachmentPoint, { x: 8, y: 0 });
  const spikeDirection = transformedLocalY(geometry.pointsIntoOpenAngle);
  assertNear(spikeDirection.x, 1, 'spikes point toward open water');
  assertNear(spikeDirection.y, 0, 'spikes do not point along the wall');
  const plantGrowthDirection = transformedLocalY(geometry.growsIntoOpenAngle + Math.PI);
  assertNear(plantGrowthDirection.x, 1, 'plant top grows toward open water');
  assertNear(plantGrowthDirection.y, 0, 'plant top does not grow along the wall');
});
