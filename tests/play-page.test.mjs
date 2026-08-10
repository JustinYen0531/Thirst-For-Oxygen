import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const page = read('../src/play-page.js');
const preload = read('../src/play-preload.js');
const sandbox = read('../src/sandbox-page.js');
const html = read('../play.html');
const home = read('../home.html');
const css = read('../src/play.css');
const storyIntro = read('../src/play-story-intro.js');

test('formal Play runtime owns both gameplay styles in addition to HTML early-paint links', () => {
  assert.match(html, /href="\/src\/play\.css"/);
  assert.match(html, /href="\/src\/visor-hud\.css"/);
  assert.match(page, /import '\.\/play\.css';/);
  assert.match(page, /import '\.\/visor-hud\.css';/);
});

test('formal play connects the shared combat build instead of a hard-coded HUD showcase', () => {
  assert.match(page, /createPlayCombatState\(\)/);
  assert.match(page, /stepPlayCombat\(combatState/);
  assert.match(page, /getPlayerHudSlots\(combatState\.build\)/);
  assert.match(page, /recordPlayEnemyDefeats\(combatState, enemies, actor\)/);
  assert.doesNotMatch(page, /const PLAYER_LEVEL|const PLAYER_EXPERIENCE|PLAYER_HUD_LOADOUT/);
});

test('formal play exposes Resonance bars, neutral partners, permanent buffs, and descent-to-ascent carryover', () => {
  assert.match(page, /if \(enemy\.resonanceNeutral\) return;/);
  assert.match(page, /drawEnemyResonanceBar\(enemy/);
  assert.match(page, /drawEnemyResonanceRange\(enemy/);
  assert.match(page, /RESONANCE_RULES\.bodyGrazePadding/);
  assert.match(page, /context\.fillStyle = 'rgba\(73, 231, 131, \.09\)'/);
  assert.match(page, /context\.fill\(\);/);
  assert.match(page, /resonanceState: combatState\.resonance/);
  assert.match(page, /enemyResult\?\.resonanceEvents\?\.length/);
  assert.match(page, /beginArcTransition\('ascent', 1\)/);
  assert.match(page, /下沉→上升：生命與能量已回滿；氧氣、Build 與 Resonance 永久 Buff 保留/);
  assert.match(page, /neutral: Boolean\(enemy\.resonanceNeutral\)/);
  assert.match(html, /id="play-level-inspect"/);
  assert.match(html, /class="experience-track" id="play-experience-track"/);
  assert.match(html, /id="play-resonance-panel"/);
  assert.match(page, /\$\{entry\.stacks\}\/\$\{entry\.maxStacks\}/);
  assert.match(page, /不提供 EXP/);
});

test('sandbox also hides the enemy health bar after Resonance neutrality', () => {
  assert.match(sandbox, /if \(!enemy\.resonanceNeutral\) \{/);
});

test('optional Resonance inspection cannot prevent the player and HUD from booting', () => {
  assert.doesNotMatch(html, /play-stage-frame is-awakening/);
  assert.match(page, /if \(!resonancePanel \|\| !levelInspect\) return/);
  assert.match(page, /if \(!resonanceCount \|\| !resonanceBuffs\) return/);
  assert.match(page, /levelInspect\?\.addEventListener/);
  assert.match(page, /querySelector\('#play-experience-track'\)/);
  assert.match(read('../src/play.css'), /\.level-readout[\s\S]*pointer-events: none/);
  assert.match(read('../src/play.css'), /\.experience-track[\s\S]*height: 9px[\s\S]*cursor: pointer/);
  assert.match(page, /loadingMask\.classList\.add\('is-hidden'\);/);
  assert.match(page, /loadingMask\.classList\.remove\('is-hidden'\);/);
});

test('play settings expose a persistent player damage-reduction mode', () => {
  assert.match(html, /id="play-damage-reduction"/);
  ['0', '0.3', '0.5', '0.75', '0.9'].forEach((value) => assert.match(html, new RegExp(`<option value="${value}"`)));
  assert.match(page, /thirst-for-oxygen-play-damage-reduction/);
  assert.match(page, /setPlayerDamageReduction\(actor, playerDamageReduction\)/);
  assert.match(page, /damageReductionPercent: Math\.round\(playerDamageReduction \* 100\)/);
});

test('formal play renders and reports stationary experience orbs, projectiles, and upgrades', () => {
  assert.match(page, /drawExperienceOrbs\(\)/);
  assert.match(page, /drawCombatProjectiles\(\)/);
  assert.match(page, /choosePlayUpgradeCategory/);
  assert.match(page, /choosePlayUpgrade\(combatState/);
  assert.match(html, /id="play-upgrade-overlay"/);
  assert.match(html, /id="play-upgrade-categories"/);
  assert.match(html, /id="play-upgrade-choices"/);
});

test('level-up uses sealed decks and two illustrated flip cards instead of flat AI-style slots', () => {
  assert.match(html, /LEVEL UP \/ ABYSSAL DRAW/);
  assert.match(html, /牌組一旦選定，本次抽取不可更換/);
  assert.match(page, /createUpgradeDeckButton/);
  assert.match(page, /createLockedUpgradeDeck/);
  assert.match(page, /createUpgradeCard/);
  assert.match(page, /combatState\.upgradeChoices\.map\(createUpgradeCard\)/);
  assert.match(page, /icon\.src = choice\.icon/);
  assert.match(page, /LEVEL \$\{String\(choice\.level\)\.padStart\(2, '0'\)\}/);
  assert.match(css, /@keyframes upgrade-card-reveal/);
  assert.match(css, /rotateY\(180deg\)/);
  assert.match(css, /backface-visibility: hidden/);
});

test('the public play entry starts at Part 1 and stage exits preserve the run', () => {
  assert.match(page, /MAP_ROUTES/);
  assert.match(page, /let mapArc = 'descent';/);
  assert.match(page, /let mapPart = 1;/);
  assert.match(page, /loadMap\(nextPart, \{ preserveRun: true, arc: mapArc \}\)/);
  assert.match(page, /getPlayStageExitState\(\{ map, mapPart, actor, enemies, origin \}\)/);
  assert.match(html, /<option value="descent:1" selected>/);
  assert.match(html, /<option value="ascent:1">上升篇・第一部分<\/option>/);
  assert.doesNotMatch(home, /play\.html\?part=3/);
  assert.match(home, /data-turn-state="front"/);
  assert.match(home, /src="\/src\/home-page\.js"/);
});

test('formal play uses honest programmatic fallbacks instead of broken or wrong assets', () => {
  assert.doesNotMatch(page, /button\.png/);
  assert.doesNotMatch(page, /current:\s*['"]\/assets\/editor\/edges\/edge-spike-barrier\.png/);
  assert.match(page, /PLAY_BASE_IMAGE_ASSET_PATHS/);
  assert.match(page, /ensureImageAssets\(getPlayEnemyAssetPaths/);
  assert.match(preload, /getPlayWorldAssetPaths\(\)/);
  assert.match(page, /drawProgrammaticEdge/);
});

test('formal play preserves permanent game over and exposes the authored seaweed interaction', () => {
  assert.match(page, /if \(!actor \|\| actor\.gameOver\) return/);
  assert.match(page, /toggleSeaweedAttachment\(actor, map, 'chapter1', origin\)/);
});

test('formal play consumes rotating razor, button state, and authored current direction visuals', () => {
  assert.match(page, /function drawRazorObject/);
  assert.match(page, /visual\.componentAssetPaths\[0\]/);
  assert.match(page, /getFreeObjectSetting\(object, 'rotationSpeed'\)/);
  assert.match(page, /Boolean\(object\.pressed\)/);
  assert.match(page, /getDirectionVector\(edge\.currentDirection \?\? 0\)/);
});

test('formal play renders serialized Boss rules, summons, beams, and oxygen corruption', () => {
  assert.match(page, /runtime\.rules\.forEach/);
  assert.match(page, /runtime\.summons\.filter/);
  assert.match(page, /zone\.type === 'reflectedBeam'/);
  assert.match(page, /zone\.type === 'corruptOxygen'/);
  assert.match(page, /'abyssAwakening'/);
});

test('formal play draws deterministic static frames selected by runtime skill state', () => {
  assert.match(page, /PLAY_BASE_IMAGE_ASSET_PATHS/);
  assert.match(page, /getPlayEnemyRenderView\(enemies, worldTime\)/);
  assert.match(preload, /PLAY_ENEMY_ASSET_PATHS/);
  assert.match(page, /PLAYER_ANIMATION_ASSETS\[animationState\]\?\.\[frameIndex\]/);
  assert.doesNotMatch(page, /PLAYER_ASSETS\[animationState\]/);
  assert.match(page, /getPlayEnemyFrameState\(enemy, worldTime\)/);
  assert.match(page, /images\.get\(visualState\.path\)/);
  assert.doesNotMatch(page, /enemyAnimationImages/);
  assert.doesNotMatch(page, /images\.get\(enemy\.visual\)/);
});

test('Part 1 presents Attempt separately from HP and preserves the authored awakening mask', () => {
  assert.match(html, /id="play-attempts"[^>]*>ATTEMPT 3\/3</);
  assert.doesNotMatch(html, /Attempts 3\/3/);
  assert.match(page, /enabled: !storyIntroState\.active && mapPart === 1 && !previousActor/);
  assert.match(page, /stepPlayAwakening\(awakeningState, scaledElapsed\)/);
  assert.match(page, /if \(paused \|\| storyIntroState\.active \|\| awakeningState\.awaitingTrigger \|\| awakeningState\.active \|\| actor\.dead/);
  assert.match(page, /context\.ellipse\(/);
  assert.match(page, /mapPart === 1 && !preserveRun \? '' : mapArc === 'ascent' \? '正在逆游上升…' : '正在潛入水域…'/);
  assert.match(page, /attemptsReadout\.textContent = attempt\.label/);
  assert.match(page, /getPlayAttemptState\(actor\)\.label}，已回到最近啟用的 Checkpoint/);
  assert.doesNotMatch(page, /失去 1 條命/);
});

test('Part 1 presents the three-slide narrator before the existing awakening', () => {
  assert.match(html, /id="play-story-intro"/);
  assert.match(html, /id="play-story-video"[^>]*muted[^>]*playsinline/);
  assert.doesNotMatch(html, /id="play-story-video"[^>]*loop/);
  assert.match(html, /id="play-story-narrator"/);
  assert.match(html, /id="play-story-skip"/);
  assert.match(page, /advancePlayStoryIntro/);
  assert.match(page, /advancePlayStoryIntroAfterVideo/);
  assert.match(page, /getPlayStoryIntroNarratorText\(storyIntroState, translateStoryText\)/);
  assert.match(page, /stepPlayStoryIntro/);
  assert.match(page, /storyIntroState\.active/);
  assert.match(page, /finishStoryIntro/);
  assert.match(page, /storyIntro:\s*\{\s*\.\.\.getPlayStoryIntroRenderState\(storyIntroState\)/);
  assert.match(page, /stageWrap\?\.classList\.toggle\('is-story-intro', visible\)/);
  assert.match(page, /createStoryTypingSound/);
  assert.match(page, /storyIntroCoverMode/);
  assert.match(page, /route-lock/);
  assert.match(page, /'complete'\]\.includes\(awakening\.phase\)/);
  assert.match(page, /const dragHitRadius = Math\.max\(96/);
  assert.match(page, /> dragHitRadius\) return/);
  assert.match(page, /canvas\.setPointerCapture\(event\.pointerId\)/);
  assert.match(page, /storyIntroVideo\.playbackRate = 0\.5/);
  assert.match(page, /storyIntroVideo\?\.addEventListener\('ended'/);
  assert.match(page, /storyIntroOverlay\.dataset\.storyFraming = story\.mediaFraming/);
  assert.match(storyIntro, /PLAY_STORY_INTRO_SLIDES/);
  assert.match(css, /\.play-story-intro-overlay/);
  assert.match(css, /z-index: 1/);
  assert.match(css, /\.play-stage-wrap\.is-story-intro \.stage-meta/);
  assert.match(css, /\.play-story-narrator \{[^}]*padding:/);
  assert.match(css, /\.play-story-footer button \{[^}]*border: 0/);
  assert.match(css, /play-story-breathe/);
  assert.match(css, /data-story-framing="suit-free-right"/);
  assert.match(css, /data-story-framing="suit-free-left"/);
});

test('chapter transitions refill health and energy while preserving the run', () => {
  assert.match(page, /actor\.health = MAX_HEALTH/);
  assert.match(page, /actor\.energy = MAX_ENERGY/);
  assert.match(page, /生命與能量已回滿；氧氣、經驗與 Build 已保留/);
});
