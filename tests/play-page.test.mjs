import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const page = read('../src/play-page.js');
const gameSettings = read('../src/game-settings.js');
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
  assert.match(page, /生命與能量已回滿；氧氣、Build 與 Resonance 永久 Buff 保留/);
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
  assert.match(page, /const playableWorldReady = Boolean\(map && actor\);/);
  assert.match(page, /loadingMask\.classList\.toggle\('is-hidden', playableWorldReady\);/);
  assert.match(read('../src/play.css'), /\.loading-mask\.is-hidden \{ visibility: hidden;/);
});

test('play settings expose a persistent player damage-reduction mode', () => {
  assert.match(html, /id="play-damage-reduction"/);
  ['0', '0.3', '0.5', '0.75', '0.9'].forEach((value) => assert.match(html, new RegExp(`<option value="${value}"`)));
  assert.match(gameSettings, /thirst-for-oxygen-play-damage-reduction/);
  assert.match(page, /setPlayerDamageReduction\(actor, playerDamageReduction\)/);
  assert.match(page, /damageReductionPercent: Math\.round\(playerDamageReduction \* 100\)/);
});

test('play settings prioritize assistance, keep audio together, and remove diagnostic clutter', () => {
  const difficultyIndex = html.indexOf('id="difficulty-settings-title"');
  const musicIndex = html.indexOf('id="music-settings-title"');
  const languageIndex = html.indexOf('id="language-settings-title"');
  assert.ok(difficultyIndex < musicIndex && musicIndex < languageIndex);
  assert.doesNotMatch(html, /id="play-tools-title"|>測試工具</);
  assert.match(html, /id="play-resource-cost-reduction"/);
  ['0', '0.3', '0.5', '0.75', '0.9'].forEach((value) => assert.match(html, new RegExp(`<option value="${value}"`)));
  assert.match(html, /id="play-ambient-card"/);
  assert.match(html, /240 秒循環/);
  assert.match(page, /attachSfxVolumeControl\(document\.querySelector\('#play-ambient-volume-control'\)/);
  assert.doesNotMatch(html, /play-unlimited-resources|play-camera-readout|play-map-title|play-events|Camera Status|Test Log/);
  assert.doesNotMatch(page, /unlimitedResources|refillUnlimitedResources|eventsList|cameraReadout|mapTitle/);
  assert.match(page, /resourceCostReductionPercent: Math\.round\(resourceCostReduction \* 100\)/);
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

test('descent completion pauses on Mission Complete before showing the Ascent prototype notice', () => {
  assert.match(html, /id="play-prototype-overlay"/);
  assert.match(html, /MISSION COMPLETE/);
  assert.match(html, /The Core has been retrieved\./);
  assert.match(html, /The ascent has begun\.\.\./);
  assert.match(html, /Prototype Notice/);
  assert.match(html, /The Descent Chapter is fully playable\./);
  assert.match(html, /The Ascent Chapter has been designed,/);
  assert.match(html, /Continue Prototype/);
  assert.match(html, /Return to Main Menu/);
  assert.match(css, /@keyframes play-prototype-blackout/);
  assert.match(page, /const PROTOTYPE_MISSION_HOLD_MS = 2200/);
  assert.match(page, /prototypeMissionTimer = window\.setTimeout/);
  assert.match(page, /showDescentPrototypeNotice\(\)/);
  assert.match(page, /resetDescentPrototypeNotice\(\);\s*runCompleted = false;\s*beginArcTransition\('ascent', 1\)/);
  assert.match(page, /prototypeMenuButton\?\.addEventListener\('click'/);
  assert.match(page, /window\.location\.href = '\.\/home\.html'/);
});

test('formal developer panel teleports to an authored safe depth instead of changing only the HUD label', () => {
  assert.match(html, /id="play-dev-depth-form"/);
  assert.match(html, /id="play-dev-depth"[^>]*type="number"[^>]*min="0"/);
  assert.match(html, /id="play-dev-depth-range"/);
  assert.match(page, /findPlayDepthTeleportTarget\(map/);
  assert.match(page, /function teleportPlayActorToDepth\(requestedDepth\)/);
  assert.match(page, /actor\.x = target\.x;\s*actor\.y = target\.y;\s*actor\.vx = 0;\s*actor\.vy = 0;/);
  assert.match(page, /updateVisibleRenderEntries\(true\)/);
  assert.match(page, /playDevDepthForm\?\.addEventListener\('submit'/);
  assert.match(page, /depth: actor \? \{/);
});

test('Chapter 0 Tutorial uses its dedicated Tutorial music', () => {
  const music = read('../src/music.js');
  assert.match(music, /import tutorialSource from ['"]\.\/assets\/audio\/music\/tutorial\.mp3['"];/);
  assert.match(music, /tutorial: phaseTrack\('Tutorial', tutorialSource\)/);
  assert.match(music, /if \(arc === 'tutorial'\) return MUSIC_TRACKS\.tutorial;/);
  assert.match(page, /createMusicController\(getMusicTrack\(\{ part: TUTORIAL_PART, arc: TUTORIAL_ROUTE \}\)\)/);
  assert.match(page, /const gameplayMusicArc = mapArc === TUTORIAL_ROUTE \? TUTORIAL_ROUTE : musicArcSelect\.value;/);
  assert.match(page, /getMusicTrack\(\{ part: mapPart, arc: gameplayMusicArc, mode: musicModeSelect\.value \}\)/);
});

test('Part 2 Boss room replaces the generic Exit marker and advances directly to Part 3', () => {
  assert.match(page, /if \(map\?\.metadata\?\.bossRoom\?\.autoAdvancePart && !bossRoomState\.completed\) return;/);
  assert.match(page, /bossRoomResult\.events\.some\(\(event\) => event\.type === 'bossRoomCleared'\)/);
  assert.match(page, /beginStageTransition\(autoAdvancePart\)/);
  assert.match(page, /loadMap\(nextPart, \{ preserveRun: true, arc: mapArc \}\)/);
});

test('every authored Boss room switches to its Boss track and resets for the next part', () => {
  assert.match(page, /function setGameplayMusicMode\(mode\)/);
  assert.match(page, /if \(bossRoomResult\.events\.some\(\(event\) => event\.type === 'bossRoomSealed'\)\) setGameplayMusicMode\('boss'\)/);
  assert.match(page, /mapPart = nextPart;\s*setGameplayMusicMode\('normal'\)/);
});

test('Chapter 0 tutorial cards let Canvas controls pass through while retaining hover feedback', () => {
  assert.doesNotMatch(page, /tutorialDialogueNavigation|navigationCopy/);
  assert.doesNotMatch(html, /id="play-tutorial-dialogue-navigation"/);
  assert.match(page, /const tutorialControlHint = tutorial\.currentStep\.controlHint/);
  assert.match(page, /tutorialDialogueControl\.textContent = tutorial\.autoReady/);
  assert.match(page, /tutorialEnglishText\(tutorialNavigationHint\)/);
  assert.match(page, /tutorialStepProgress\.textContent = `\$\{tutorial\.completedCoreSteps\} \/ \$\{tutorial\.completionTarget\}`/);
  assert.match(page, /tutorialTaskProgress\.textContent = `\$\{tutorial\.completedCoreSteps\} \/ \$\{tutorial\.totalCoreSteps\}`/);
  assert.match(page, /tutorialStepProgress\.classList\.toggle\('is-ready'/);
  assert.match(page, /tutorialStepProgress\.classList\.toggle\('is-locked'/);
  assert.match(page, /const tutorialEnglishText =/);
  assert.match(page, /getPlayTutorialGuideKeyForSelectedTask/);
  assert.match(page, /reopenDiscoveryGuide/);
  assert.match(page, /reopenSelectedTutorialGuide\(\)/);
  assert.match(page, /selectPlayTutorialTask\(tutorialState, event\.code === 'ArrowLeft' \? -1 : 1\);\s*reopenSelectedTutorialGuide\(\)/);
  assert.match(html, /data-gameplay-language="fixed-en"/);
  assert.match(page, /updateTutorialCardHover/);
  assert.match(page, /tutorialTaskList\.scrollTop \+= event\.deltaY/);
  assert.match(css, /\.play-tutorial-panel[^\n]*pointer-events: none/);
  assert.match(css, /\.play-tutorial-dialogue[^\n]*pointer-events: none/);
  assert.match(css, /\.play-tutorial-panel[^\n]*opacity: 1/);
  assert.match(css, /\.play-tutorial-dialogue[^\n]*opacity: 1/);
  assert.doesNotMatch(css, /\.play-tutorial-(?:panel|dialogue)[^\n]*opacity: \.42/);
  assert.match(css, /\.play-tutorial-task-list \{[^\n]*pointer-events: auto/);
  assert.match(css, /\.play-tutorial-object-list \{[^\n]*grid-auto-rows: max-content[^\n]*height: 96px[^\n]*overflow-y: scroll/);
  assert.match(css, /\.play-tutorial-task-list::-webkit-scrollbar-thumb/);
  assert.match(css, /\.play-tutorial-progress\.is-locked/);
  assert.match(css, /\.play-tutorial-progress\.is-ready/);
  assert.doesNotMatch(css, /\.play-tutorial-dialogue-navigation/);
  assert.match(css, /\.play-tutorial-panel\.is-pointer-over/);
  assert.match(css, /\.play-tutorial-dialogue\.is-pointer-over/);
});

test('a plain New Game always starts in Chapter 0 while explicit routes stay available', () => {
  assert.match(page, /if \(MAP_ROUTES\[requestedRoute\]\) mapArc = requestedRoute;\s*else mapArc = TUTORIAL_ROUTE;/);
  assert.doesNotMatch(page, /hasTutorialExitPreference|TUTORIAL_STORAGE_KEY/);
  assert.match(home, /id="home-start-game" href="\.\/play\.html"/);
});

test('formal play uses honest programmatic fallbacks instead of broken or wrong assets', () => {
  assert.doesNotMatch(page, /button\.png/);
  assert.doesNotMatch(page, /current:\s*['"]\/assets\/editor\/edges\/edge-spike-barrier\.png/);
  assert.match(page, /PLAY_BASE_IMAGE_ASSET_PATHS/);
  assert.match(page, /ensureImageAssets\(getPlayEnemyAssetPaths/);
  assert.match(preload, /getPlayWorldAssetPaths\(\)/);
  assert.match(page, /drawProgrammaticEdge/);
});

test('formal play preserves permanent game over and exposes the shared E interaction', () => {
  assert.match(page, /if \(!actor \|\| actor\.gameOver\) return/);
  assert.match(page, /activateNearbyInteraction\(actor, map, 'chapter1', origin\)/);
  assert.match(page, /invisibleRemaining/);
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
  assert.match(page, /stepPlayAwakening\(awakeningState, scaledElapsed\)/);
  assert.match(page, /if \(paused \|\| storyIntroState\.active \|\| awakeningState\.awaitingTrigger \|\| awakeningState\.active \|\| actor\.dead/);
  assert.match(page, /enabled: [^\n]*mapPart === 1 && !previousActor/);
  assert.match(page, /stageFrame\.addEventListener\('pointerdown',[\s\S]*beginPlayAwakening\(awakeningState\)[\s\S]*\{ capture: true \}\)/);
  assert.match(page, /if \(awakeningState\.awaitingTrigger \|\| awakeningState\.active\)/);
  assert.match(page, /stepPlayAwakening\(awakeningState, scaledElapsed\)/);
  assert.match(page, /if \(paused \|\| [^\n]*awakeningState\.awaitingTrigger \|\| awakeningState\.active \|\| actor\.dead/);
  assert.match(page, /context\.ellipse\(/);
  assert.match(page, /mapPart === 1 && !preserveRun \? '' : mapArc === 'ascent' \? '正在逆游上升…' : '正在潛入水域…'/);
  assert.match(page, /attemptsReadout\.textContent = attempt\.label/);
  assert.match(page, /getPlayAttemptState\(actor\)\.label}，已回到最近啟用的 Checkpoint/);
  assert.doesNotMatch(page, /失去 1 條命/);
});

test('Part 1 presents the three-slide narrator before the existing shutter awakening', () => {
  assert.match(html, /id="play-story-intro"/);
  assert.match(html, /id="play-story-video"[^>]*muted[^>]*playsinline/);
  assert.doesNotMatch(html, /id="play-story-video"[^>]*loop/);
  assert.match(html, /id="play-story-narrator"/);
  assert.match(html, /id="play-story-skip"/);
  assert.match(page, /createPlayStoryIntroState/);
  assert.match(page, /advancePlayStoryIntro/);
  assert.match(page, /advancePlayStoryIntroAfterVideo/);
  assert.match(page, /getPlayStoryIntroNarratorText\(storyIntroState, translateStoryText\)/);
  assert.match(page, /stepPlayStoryIntro/);
  assert.match(page, /storyIntroState.active/);
  assert.match(page, /finishStoryIntro/);
  assert.match(page, /storyIntro:\s*\{\s*\.\.\.getPlayStoryIntroRenderState\(storyIntroState\)/);
  assert.match(page, /if \(awakeningState\.awaitingTrigger\) beginPlayAwakening\(awakeningState\)/);
  assert.match(page, /stageWrap\?\.classList\.toggle\('is-story-intro', visible\)/);
  assert.match(page, /createStoryTypingSound/);
  assert.match(page, /storyIntroVideo\.playbackRate = 0\.5/);
  assert.match(page, /storyIntroVideo\?\.addEventListener\('ended'/);
  assert.match(page, /storyIntroOverlay\.dataset\.storyFraming = story\.mediaFraming/);
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
  assert.match(css, /\.play-story-intro-overlay \{[^}]*z-index: auto[^}]*isolation: auto/);
  assert.match(css, /\.play-story-topline \{[^}]*z-index: 5/);
  assert.match(css, /\.play-story-narrator \{[^}]*z-index: 5/);
  assert.match(css, /\.play-stage-wrap\.is-story-intro \.stage-meta/);
  assert.match(css, /\.play-story-narrator \{[^}]*padding:/);
  assert.match(css, /\.play-story-footer button \{[^}]*border: 0/);
  assert.doesNotMatch(css, /\.play-stage-frame\.is-story-intro[\s\S]*\.play-resource-hud \{ opacity: 0/);
  assert.match(css, /\.play-story-intro-overlay/);
  assert.match(css, /play-story-breathe/);
  assert.match(css, /data-story-framing="suit-free-right"/);
  assert.match(css, /data-story-framing="suit-free-left"/);
});

test('chapter transitions refill health and energy while preserving the run', () => {
  assert.match(page, /actor\.health = MAX_HEALTH/);
  assert.match(page, /actor\.energy = MAX_ENERGY/);
  assert.match(page, /生命與能量已回滿；氧氣、經驗與 Build 已保留/);
});

test('completing Tutorial enters the Descent Part 1 story slides instead of home', () => {
  assert.match(html, /<optgroup label="Tutorial">\s*<option value="tutorial:0">Tutorial<\/option>/);
  assert.match(html, /<p class="eyebrow">TUTORIAL<\/p><h2 id="play-tutorial-title">Tutorial<\/h2>/);
  assert.match(page, /const MAP_ROUTES = Object\.freeze\([\s\S]*label: 'Tutorial'/);
  assert.match(page, /function leaveTutorial\(reason = 'skipped'\)[\s\S]*beginArcTransition\('descent', 1\);/);
  assert.match(page, /Tutorial 完成：[^\n]*前往下沉篇第一部分/);
  assert.doesNotMatch(page, /Tutorial 完成：[^\n]*返回水下主控台/);
  const tutorialLeaveBlock = page.match(/function leaveTutorial\(reason = 'skipped'\)[\s\S]*?[\r\n]}[\r\n]+[\r\n]+function mapSelectionValue/);
  assert.ok(tutorialLeaveBlock, 'Tutorial leave handler should be present');
  assert.match(tutorialLeaveBlock[0], /beginArcTransition\('descent', 1\)/);
  assert.doesNotMatch(tutorialLeaveBlock[0], /window\.location\.href/);
  assert.match(html, /Skipping enters Descent Part 1 and opens its story slides/);
});
