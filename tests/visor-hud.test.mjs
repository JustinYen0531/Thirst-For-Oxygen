import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnergyHud, getHealthHud, getOxygenHud } from '../src/visor-hud.js';

test('oxygen HUD exposes a percentage and normalized fill', () => {
  assert.deepEqual(getOxygenHud(40, 100), { value: 40, ratio: 0.4, label: '40%' });
});

test('energy HUD rounds to half-slot increments across five slots', () => {
  const hud = getEnergyHud(90, 100);
  assert.equal(hud.label, '4.5/5');
  assert.deepEqual(hud.fills, [0.5, 1, 1, 1, 1]);
  assert.equal(getEnergyHud(70, 100).label, '3.5/5');
  assert.deepEqual(getEnergyHud(70, 100).fills, [0, 0.5, 1, 1, 1]);
  assert.deepEqual(getEnergyHud(20, 100).fills, [0, 0, 0, 0, 1]);
});

test('health HUD uses ten clockwise segments and severity tones', () => {
  const full = getHealthHud(100, 100);
  assert.equal(full.tone, 'full');
  assert.equal(full.color, 'hsl(120 84% 68%)');
  assert.deepEqual(full.fills, Array(10).fill(1));

  const warning = getHealthHud(65, 100);
  assert.equal(warning.tone, 'warning');
  assert.equal(warning.color, 'hsl(78 84% 68%)');
  assert.deepEqual(warning.fills.slice(0, 7), [1, 1, 1, 1, 1, 1, 0.5]);

  const critical = getHealthHud(20, 100);
  assert.equal(critical.tone, 'critical');
  assert.equal(critical.color, 'hsl(24 84% 68%)');
  assert.deepEqual(critical.fills, [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
});
