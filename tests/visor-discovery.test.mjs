import assert from 'node:assert/strict';
import test from 'node:test';
import { setLanguage } from '../src/i18n.js';
import { ENEMY_ORDER } from '../src/game-data.js';
import { translateGameplayText } from '../src/i18n-gameplay.js';
import {
  DISCOVERY_COLORS,
  EDGE_DISCOVERY_GUIDES,
  OBJECT_DISCOVERY_GUIDES,
  acknowledgeDiscoveryGuide,
  createDiscoverySession,
  getDiscoveryTypedDescription,
  getEnemyDiscoveryGuide,
  reopenDiscoveryGuide,
  updateDiscoverySession,
} from '../src/visor-discovery.js';
import { drawDiscoveryGuides, getDiscoveryGuideLayout, hitTestDiscoveryAcknowledgement } from '../src/visor-discovery-renderer.js';

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
  assert.match(OBJECT_DISCOVERY_GUIDES.seaweed.description, /字母 E.*不會下墜/);
  assert.match(OBJECT_DISCOVERY_GUIDES.coralCluster.description, /字母 E.*2\.5 秒隱形/);
  assert.match(EDGE_DISCOVERY_GUIDES.wallGillGate.description, /字母 E.*進入.*按 E/);
});

test('English discovery cards draw no CJK copy into the Canvas', () => {
  setLanguage('en');
  const textDraws = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {}, strokeRect() {},
    fillText(text) { textDraws.push(String(text)); },
    set lineWidth(_) {}, set strokeStyle(_) {}, set shadowColor(_) {}, set shadowBlur(_) {}, set fillStyle(_) {}, set font(_) {}, set textBaseline(_) {}, set textAlign(_) {},
  };
  const session = createDiscoverySession();
  const [active] = updateDiscoverySession(session, [{
    instanceId: 'oxygen-1',
    guideKey: 'object:oxygen',
    guide: OBJECT_DISCOVERY_GUIDES.oxygen,
    x: 40,
    y: 30,
    size: 16,
  }], 0);

  drawDiscoveryGuides(context, [{ ...active, startedAt: 0 }], { x: 0, y: 0 }, { width: 240, height: 160 }, 20);

  assert.ok(textDraws.length > 0);
  assert.equal(textDraws.some((value) => /[\u3400-\u9fff\uf900-\ufaff]/.test(value)), false, textDraws.join(' | '));
});

test('English discovery cards show the full explanation on their first frame', () => {
  setLanguage('en');
  const textDraws = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {}, strokeRect() {},
    fillText(text) { textDraws.push(String(text)); },
    set lineWidth(_) {}, set strokeStyle(_) {}, set shadowColor(_) {}, set shadowBlur(_) {}, set fillStyle(_) {}, set font(_) {}, set textBaseline(_) {}, set textAlign(_) {},
  };
  const active = {
    ...target('oxygen-bubble-1', 'object:oxygenBubble', OBJECT_DISCOVERY_GUIDES.oxygenBubble),
    startedAt: 0,
  };
  drawDiscoveryGuides(context, [active], { x: 0, y: 0 }, { width: 240, height: 160 }, 0);

  assert.equal(textDraws.some((value) => value.includes('Instantly restores')), true, textDraws.join(' | '));
});

test('every discovery guide has complete English copy instead of the generic pending placeholder', () => {
  const guides = [
    ...Object.values(OBJECT_DISCOVERY_GUIDES),
    ...Object.values(EDGE_DISCOVERY_GUIDES),
    ...ENEMY_ORDER.map(getEnemyDiscoveryGuide),
  ];
  guides.forEach((guide) => {
    ['categoryLabel', 'title', 'description'].forEach((field) => {
      const translated = translateGameplayText(guide[field], 'en');
      if (/[\u3400-\u9fff\uf900-\ufaff]/.test(guide[field])) assert.notEqual(translated, guide[field], `${field}: untranslated source`);
      assert.equal(/[\u3400-\u9fff\uf900-\ufaff]/.test(translated), false, `${field}: ${guide[field]}`);
    });
  });
});

test('long enemy discovery copy wraps into a larger panel without ellipsis', () => {
  setLanguage('en');
  const textDraws = [];
  const context = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, fillRect() {}, strokeRect() {},
    fillText(text) { textDraws.push(String(text)); },
    set lineWidth(_) {}, set strokeStyle(_) {}, set shadowColor(_) {}, set shadowBlur(_) {}, set fillStyle(_) {}, set font(_) {}, set textBaseline(_) {}, set textAlign(_) {},
  };
  const active = {
    ...target('crab-1', 'enemy:crabGuard', getEnemyDiscoveryGuide('crabGuard')),
    startedAt: 0,
  };
  const layout = getDiscoveryGuideLayout(active, 0, { x: 0, y: 0 }, { width: 240, height: 160 });
  drawDiscoveryGuides(context, [active], { x: 0, y: 0 }, { width: 240, height: 160 }, 100);
  assert.ok(layout.panelWidth > 66);
  assert.ok(layout.panelHeight > 28);
  assert.equal(textDraws.some((value) => value.includes('Primary actions:')), true, textDraws.join(' | '));
  assert.equal(textDraws.some((value) => value.includes('…')), false, textDraws.join(' | '));
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

test('an acknowledged guide can be reopened by a tutorial task without auto-reappearing after OK', () => {
  const session = createDiscoverySession();
  const mine = target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine);
  updateDiscoverySession(session, [mine], 1);
  assert.equal(acknowledgeDiscoveryGuide(session, 'object:mine'), true);
  assert.equal(reopenDiscoveryGuide(session, mine, 4), true);
  assert.deepEqual([...session.activeByGuideKey.keys()], ['object:mine']);
  assert.equal(updateDiscoverySession(session, [], 5).length, 1);
  assert.equal(acknowledgeDiscoveryGuide(session, 'object:mine'), true);
  assert.equal(updateDiscoverySession(session, [mine], 6).length, 0);
});

test('new discoveries queue and expose only one active card at a time', () => {
  const session = createDiscoverySession();
  const mine = target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine);
  const razor = target('razor-1', 'object:razor', OBJECT_DISCOVERY_GUIDES.razor);
  const oxygen = target('oxygen-1', 'object:oxygen', OBJECT_DISCOVERY_GUIDES.oxygen);

  let active = updateDiscoverySession(session, [mine, razor, oxygen], 1);
  assert.deepEqual(active.map((entry) => entry.guideKey), ['object:mine']);
  assert.deepEqual([...session.pendingByGuideKey.keys()], ['object:razor', 'object:oxygen']);
  assert.equal(session.activeByGuideKey.size, 1);

  assert.equal(acknowledgeDiscoveryGuide(session, 'object:mine'), true);
  active = updateDiscoverySession(session, [mine, razor, oxygen], 2);
  assert.deepEqual(active.map((entry) => entry.guideKey), ['object:razor']);
  assert.deepEqual([...session.pendingByGuideKey.keys()], ['object:oxygen']);
  assert.equal(session.activeByGuideKey.size, 1);
});

test('the entire visor card acknowledges its discovery while OK remains a visual cue', () => {
  const active = { ...target('mine-1', 'object:mine', OBJECT_DISCOVERY_GUIDES.mine), startedAt: 0 };
  const layout = getDiscoveryGuideLayout(active, 0, { x: 0, y: 0 }, { width: 240, height: 160 });
  assert.ok(layout.ok.x > layout.panelX + layout.panelWidth * .7);
  assert.ok(layout.ok.y > layout.panelY + layout.panelHeight * .65);
  const hit = hitTestDiscoveryAcknowledgement([{ guideKey: active.guideKey, ...layout.panel }], {
    x: layout.panel.x + layout.panel.width * .25,
    y: layout.panel.y + layout.panel.height * .5,
  });
  assert.equal(hit.guideKey, 'object:mine');
});
