import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISCOVERY_COLORS,
  EDGE_DISCOVERY_GUIDES,
  OBJECT_DISCOVERY_GUIDES,
  acknowledgeDiscoveryGuide,
  createDiscoverySession,
  getDiscoveryTypedDescription,
  getEnemyDiscoveryGuide,
  updateDiscoverySession,
} from '../src/visor-discovery.js';
import { getDiscoveryGuideLayout, hitTestDiscoveryAcknowledgement } from '../src/visor-discovery-renderer.js';

function target(instanceId, guideKey, guide) {
  return { instanceId, guideKey, guide, x: 10, y: 20, size: 16 };
}

test('semantic outline colours match the authored visual language', () => {
  assert.equal(DISCOVERY_COLORS.enemy, '#ff5364');
  assert.equal(DISCOVERY_COLORS.danger, '#ff9b45');
  assert.equal(DISCOVERY_COLORS.supply, '#71e88f');
  assert.equal(DISCOVERY_COLORS.mechanism, '#52aaff');
  assert.equal(OBJECT_DISCOVERY_GUIDES.seaweed.colour, DISCOVERY_COLORS.support);
  assert.equal(OBJECT_DISCOVERY_GUIDES.coralCluster.colour, DISCOVERY_COLORS.support);
  assert.equal(EDGE_DISCOVERY_GUIDES.spike.colour, DISCOVERY_COLORS.danger);
  assert.equal(getEnemyDiscoveryGuide('crabGuard').colour, DISCOVERY_COLORS.enemy);
});

test('a first-contact guide disappears on exit and never repeats in the same session', () => {
  const session = createDiscoverySession();
  const firstMine = target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine);
  assert.equal(updateDiscoverySession(session, [firstMine], 1).length, 1);
  assert.equal(updateDiscoverySession(session, [firstMine], 2).length, 1);
  assert.equal(updateDiscoverySession(session, [], 3).length, 0);
  const secondMine = target('mine-2', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine);
  assert.equal(updateDiscoverySession(session, [secondMine], 4).length, 0);

  const refreshedSession = createDiscoverySession();
  assert.equal(updateDiscoverySession(refreshedSession, [secondMine], 0).length, 1);
});

test('the visor description types in while the target remains visible', () => {
  const session = createDiscoverySession();
  const mine = target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine);
  const [active] = updateDiscoverySession(session, [mine], 2);
  const early = getDiscoveryTypedDescription(active, 2.1, 10);
  const later = getDiscoveryTypedDescription(active, 3, 10);
  assert.ok(early.length >= 1);
  assert.ok(later.length > early.length);
  assert.ok(OBJECT_DISCOVERY_GUIDES.mine.description.startsWith(later));
});

test('the OK control acknowledges a guide for the rest of the current session', () => {
  const session = createDiscoverySession();
  const mine = target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine);
  updateDiscoverySession(session, [mine], 1);
  assert.equal(acknowledgeDiscoveryGuide(session, 'object:mine'), true);
  assert.equal(session.activeByGuideKey.size, 0);
  assert.equal(updateDiscoverySession(session, [mine], 2).length, 0);
  assert.equal(acknowledgeDiscoveryGuide(session, 'object:mine'), false);
});

test('the OK hit target occupies the lower-right corner of its visor panel', () => {
  const active = { ...target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine), startedAt: 0 };
  const layout = getDiscoveryGuideLayout(active, 0, { x: 0, y: 0 }, { width: 240, height: 160 });
  assert.ok(layout.ok.x > layout.panelX + layout.panelWidth * .7);
  assert.ok(layout.ok.y > layout.panelY + layout.panelHeight * .65);
  const hit = hitTestDiscoveryAcknowledgement([{ guideKey: active.guideKey, ...layout.ok }], {
    x: layout.ok.x + layout.ok.width / 2,
    y: layout.ok.y + layout.ok.height / 2,
  });
  assert.equal(hit.guideKey, 'object:mine');
});
