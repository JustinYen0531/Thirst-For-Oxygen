import assert from 'node:assert/strict';
import test from 'node:test';
import { getLaunchGuideGeometry } from '../src/launch-guide.js';

test('launch guide keeps every marker on the straight actor-to-pointer axis', () => {
  const from = { x: 12, y: 30 };
  const to = { x: 168, y: 94 };
  const geometry = getLaunchGuideGeometry(from, to, 48);
  const cross = (point) => ((point.x - from.x) * geometry.dy) - ((point.y - from.y) * geometry.dx);
  geometry.points.forEach((point) => assert.ok(Math.abs(cross(point)) < 1e-8));
  geometry.forwardPoints.forEach((point) => assert.ok(Math.abs(cross(point)) < 1e-8));
  geometry.markers.forEach((marker) => assert.ok(Math.abs(cross(marker)) < 1e-8));
  assert.ok(geometry.markers.length >= 3);
  assert.ok(geometry.markers.length <= 8);
});

test('launch guide exposes charge length without simulating gravity', () => {
  const short = getLaunchGuideGeometry({ x: 0, y: 0 }, { x: 30, y: 0 });
  const long = getLaunchGuideGeometry({ x: 0, y: 0 }, { x: 300, y: 0 });
  assert.equal(short.distance, 30);
  assert.equal(long.distance, 300);
  assert.ok(long.markers.length > short.markers.length);
  assert.equal(long.points.at(-1).x, 300);
  assert.equal(long.points.at(-1).y, 0);
  assert.equal(long.projectedTo.x, -300);
  assert.equal(long.projectedTo.y, 0);
  assert.equal(long.forwardPoints.at(-1).x, -300);
  assert.equal(long.forwardPoints.at(-1).y, 0);
});

test('forward preview stops at the real launch cap while the pull line keeps its full length', () => {
  const geometry = getLaunchGuideGeometry({ x: 40, y: 18 }, { x: 940, y: 18 });
  assert.equal(geometry.pullDistance, 900);
  assert.equal(geometry.distance, 420);
  assert.equal(geometry.projectedTo.x, -380);
  assert.equal(geometry.projectedTo.y, 18);
  assert.equal(geometry.forwardPoints.at(-1).x, -380);
  assert.equal(geometry.forwardPoints.at(-1).y, 18);
});
