import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnergyHud, getHealthHud, getOxygenHud, getPlayerHudIconPath, getPlayerHudSlots } from '../src/visor-hud.js';

test('player HUD maps the starter knife to the first weapon slot', () => {
  assert.equal(getPlayerHudIconPath('weapon', 'knife', 1), '/assets/editor/icons/weapons/knife/lv1.png');
  const slots = getPlayerHudSlots({ weapons: [{ id: 'knife', level: 1 }], passives: [] });
  assert.equal(slots.length, 6);
  assert.deepEqual(slots[0], {
    key: 'weapon-0', kind: 'weapon', index: 0, id: 'knife', level: 1, name: '小刀',
    path: '/assets/editor/icons/weapons/knife/lv1.png',
  });
  assert.equal(slots[1].path, null);
  assert.equal(slots[3].path, null);
});

test('player HUD maps equipped sandbox weapons and passives to their own sides', () => {
  const slots = getPlayerHudSlots({
    weapons: [{ id: 'knife', level: 1 }, { id: 'trident', level: 2 }],
    passives: [{ id: 'abyssalAmplifier', level: 3 }],
  });
  assert.equal(slots[0].path, '/assets/editor/icons/weapons/knife/lv1.png');
  assert.equal(slots[1].path, '/assets/editor/icons/weapons/trident/lv2.png');
  assert.equal(slots[2].path, null);
  assert.equal(slots[3].path, '/assets/editor/icons/passives/abyssalAmplifier/lv3.png');
  assert.equal(slots[4].path, null);
  assert.equal(slots[5].path, null);
});

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
