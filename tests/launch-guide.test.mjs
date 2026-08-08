import assert from 'node:assert/strict';
import test from 'node:test';
import { getLaunchGuideGeometry } from '../src/launch-guide.js';

test('launch guide keeps every marker on the straight actor-to-pointer axis', () => {
  const from = { x: 12, y: 30 };
  const to = { x: 168, y: 94 };
  const geometry = getLaunchGuideGeometry(from, to, 48);
  const cross = (point) => ((point.x - from.x) * geometry.dy) - ((point.y - from.y) * geometry.dx);
  geometry.points.forEach((point) => assert.ok(Math.abs(cross(point)) < 1e-8));
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
});
