Original prompt: 開始製作遊戲,你可以開始製作程式碼了。第一個要做的是地圖編輯器,因為那也是我製作地圖的方式。請參閱相關的文件。 如果我還沒有生成一個圖片的話,那就使用placeholder的圖案就好了,完全不要花心思在一開始的介面上,能用就行了。 那些效果都要做出來,也就是像什麼重力的邏輯啦,還是什麼物件,都要有相對應的互動邏輯。 另外一般的那種彈射邏輯也要讓我可以測試出來。

## 2026-08-10 — 序章排除潛水服畫面、影片結束前進與篇章資源回滿

- 序章中含有人物潛水服的影片改用 `suit-free-right`／`suit-free-left` 取景，保留原始影片但不讓整套潛水服進入可見畫面。
- 影片觸發 `ended` 時直接切換下一張投影片；最後一支影片結束就關閉序章，不再把已播完的影片重新播放。
- 跨篇章載入時生命值與能量回滿，氧氣、經驗、Build、命數與 Resonance 保留。
- 英文序章旁白先翻譯完整句子，再依打字進度裁切，避免半句中文誤觸發 `English copy pending review`。

## 2026-08-10 — 修正下沉音樂與四分鐘潛水環境音

- Play 頁的第一章下沉音樂現在會在自動播放被拒絕後，於第一次點擊或按鍵時重新解鎖；同一個手勢也會重試潛水環境音。
- 4 分鐘 `underwater-loop.wav` 保留作為原始音源，新增約 4.8 MB 的 `underwater-loop.mp3` 作為瀏覽器播放檔，避免 69 MB WAV 載入過慢。
- 音樂預設音量由 `0.55` 提高到 `0.65`；音效主音量預設由 `0.65` 提高到 `0.75`，潛水環境音混音提高為 loop `0.82x`、氣泡 `0.24x`。

## 2026-08-10 — 還原經驗值、Resonance 血條與缺氧傷害平衡

- 敵人經驗值倍率還原為 `1x`，回到原本的階級獎勵，避免第一階段過快跳到高等級。
- Resonance 中立敵人不再顯示紅色生命條；仍保留中立狀態的共鳴視覺，且不會再受到傷害。
- 缺氧持續傷害由 `12` 提高為 `36 HP/s`（`3x`），並保留獨立倍率常數方便後續調整。

## 2026-08-10 — 瞄準子彈時間 0.5 倍速

- 正式 Play、敵人沙盒與地圖編輯器 Physics Test 共用 `AIM_TIME_SCALE = 0.5`；按住瞄準／拉射時，玩家、敵人、世界物件、投射物、攻擊前搖、冷卻、效果與資源計時全部以半速推進。
- 沙盒瞄準不再完全暫停世界，也不會強制把玩家速度歸零；保留慣性並以半速等待放開彈射。
- `render_game_to_text` 會回報目前 `aiming` 與 `timeScale`，方便靜態驗收與後續調整。

## 2026-08-10 — 光合作用氣泡、三倍經驗與支援物件密度調整

- 光合作用氣泡接觸後一次性消失，提供暫時零重力慣性；預設 `2.5` 秒免疫水域重力、`1.5` 秒禁止彈射，且所有遊玩／編輯器／沙盒輸入都會尊重彈射鎖定。
- 敵人掉落的經驗值統一乘以 `3`；升級門檻不變。玩家每次成功造成敵人傷害時，該敵人的 Resonance 值下降 `8` 點，最低歸零。
- 地圖生成器已把珊瑚群落與水草沿可抵達路線增加到原本約四倍，六份正式地圖同步重新產生；目前下沉／上升三部分分別為 `24/20`、`12/8`、`12/12`（珊瑚／水草）。

## 2026-08-10 — 氫氧礦石高速撞擊與速度 HUD

- 氫氧礦石的官方釋放門檻調整為 `110 m/s`；六份正式下沉／上升地圖的既有礦石資料同步更新，輕碰不再直接給氧氣。
- 遊玩頁左上方速度讀數改為 `速度 N m/s`，並同步更新中英文動態訊息與 Inspector 單位。
- 靜態驗證完成：針對測試 86/86、完整 `npm run check` 290/290、Vite `npm run build` 成功；依專案規則不執行瀏覽器／Playwright。

## 2026-08-09 — Step 111 complete

- 遊玩設定新增玩家減傷模式：標準 0%、30%、50%（預設推薦）、75%、90%，並以本機儲存保留選擇。
- 減傷直接接入共用 `applyDamage`，因此敵人、投射物、毒素、尖刺、地雷與缺氧等生命傷害一致套用；最高封頂 90%，不形成無敵。
- `render_game_to_text` 回報目前減傷百分比；完整 `npm run check` 224/224、Vite build 與針對性 60 項測試均已通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 61 — add the slow ping-pong abyss home background

- 只取使用者提供影片的 0～5 秒，移除原音軌，製作正播→反播的往返循環；0.67 倍速度下成品為 14.71 秒、1280×720、24 FPS，且不包含約第 6 秒才出現的鯨魚。
- 首頁加入全畫面固定深海背景影片，保留左側文字可讀性的深色漸層；影片使用預先算好的往返內容，因此原生 `loop` 回到第一幀時不會跳接。
- 頭盔與凸面地圖作為同一組移至中央偏右、向下 7%，桌面尺寸放大 1.2 倍；小螢幕保留較安全的 1.08 倍。
- 首頁專屬測試 6/6、完整 `npm run check` 221/221、Vite 正式建置與 `git diff --check` 通過；建置產物中的影片維持 H.264、1280×720、24 FPS、14.71 秒。
- 依專案指示未執行瀏覽器／Playwright；本步只提交首頁標記／樣式／測試、處理後影片與此進度紀錄，並推送至目前分支。

## 2026-08-09 — Step 60 — isolate and angle the home helmet, then strengthen its convex map lens

- 依回饋捨棄正面海床構圖；首頁改用只有頭盔本體的透明 PNG。頭盔朝左前方、略微上仰，右側結構因三分之四視角清楚可見。
- 移除舊海床背景與額外沉積粒子；地圖顯示區重新對準斜向面罩，保留玻璃弧形高光，但不再由素材繪製額外環境。
- 凸面地圖變形由原本只有中央輕微放大，改為「邊緣壓縮到 0.82／0.84 倍、中央放大到 1.16／1.13 倍」的雙軸逐列變形，讓六邊形格線明顯向外鼓起。
- 首頁專屬測試 5/5、完整 `npm run check` 212/212、Vite 正式建置與 `git diff --check` 通過；建置產物含新透明頭盔且不含被淘汰的海床場景圖。
- 依專案指示未執行瀏覽器／Playwright；本步只提交首頁頭盔素材、凸面演算、對應樣式／測試與此進度紀錄，並推送至目前分支。

## 2026-08-09 — Step 59 — replace the home placeholder with an abandoned-helmet map walkthrough

- 以新的海床遺留潛水頭盔主視覺取代首頁右側的 P／魚形 placeholder；中央凸面玻璃保留給動態地圖，不改動正式遊玩 HUD 面罩素材。
- 首頁會直接讀取 `maps/下沉篇` 的三份正式 JSON，依第一→第二→第三部分連續向下巡覽，畫出水域 Tile、障礙、放置物件、Edge 與 Actor 節點。
- 地圖 Canvas 先做水平與垂直切片變形，再由橢圓面罩、邊緣暗角與玻璃反光完成凸面閱讀；提供暫停／繼續與三段進度提示。
- 上浮篇尚無正式地圖，因此入口誠實標示「地圖待接入」，不以倒放下沉地圖冒充；播放器資料結構已預留上浮篇路線。
- 首頁專屬測試 3/3、語法檢查與 `git diff --check` 通過；乾淨 Vite 建置確認頭盔 PNG 與三份正式地圖 JSON 都進入產物。完整測試為 209/210，唯一失敗是既有未追蹤的深淵抹香鯨素材已存在，但舊測試仍期待 Boss 圖片為空，與本步首頁變更無關。
- 依專案指示未執行瀏覽器／Playwright；Git 提交／推送待本步最後範圍確認後執行。

## 2026-08-09 — Step 58 — make Torricelli detours a deliberate ascent/rest route

- 下沉篇第一部分的兩條 Torricelli 岔路現在由生成器明確分成兩段：靠近補氧空間的 6 個 row 使用 L1，讓玩家進入後在下沉篇自然向上浮；其餘較長的折返段使用 L-1，作為逆重力的困難攀爬。
- 新增 `terminalRestRows`／`ascentEndRow` metadata，並以地圖測試鎖定兩段不能被後續改動顛倒；不直接手改生成結果以免下次重新產生地圖時遺失規則。
- Torricelli 接觸仍會持續回復氧氣，且不需再次拖曳發射即可在一秒後恢復能量；新增物理回歸測試確認它在下沉篇 L1 休息室自然上浮、同時補氧與回能量。
- 靜態驗證：`npm run generate:maps`、`npm run check`（82/82）、`npm run build`、`git diff --check` 通過；依專案指示未執行瀏覽器／Playwright。

## 2026-08-08 — Step 57 — protect play HUD and strengthen chapter picker

- 將機械視窗框降為裝飾層，避免蓋住等級、經驗與深度等關鍵讀數。
- 將「下沉篇」章節選擇整合成全螢幕遊玩畫面內的中央導航面板，保留原生選擇操作與小螢幕安全區。
- 靜態檢查待本步完成後執行；瀏覽器／Playwright 依專案指示不執行。

## 2026-08-08 — Step 56 — sandbox parity with official play physics

- 沙盒玩家不再使用 P placeholder；改用 `PLAYER_ANIMATION_ASSETS` 的正式潛水夫精靈、方向鏡像與動畫狀態。
- 沙盒彈射改為直接呼叫正式 `launchActor`，因此長距離初速、能量結算、面向與動量保留都與遊玩頁一致。
- 沙盒每幀改為直接呼叫正式 `stepPhysics`，並在隱藏的全 L1/T1 水域測試地圖上運算正式重力、水平阻尼、邊界反射與氧氣時鐘；無限資源／無敵仍由沙盒開關包裝。
- `npm run check`：59 項測試通過；`npm run build`：Vite 建置通過；`git diff --check`：通過。依專案指示未執行瀏覽器／Playwright 驗收。

## 2026-08-08 — Step 21 in progress

- Moved the twelve committed music tracks into `src/assets/audio/music/` and renamed them to stable kebab-case names. The absent `Phase 2 / Boss 2.0` track remains explicitly absent.
- Moved downloaded SFX into `src/assets/audio/sfx/` by runtime role. The duplicate water-drop download is preserved under `_duplicates/` and is not imported.
- Added `src/assets/audio/CREDITS.md` with the user-provided `Impact Wet by original_sound` Attribution 3.0 line at the top, plus a readable attribution section.
- Added `src/sfx.js` with persistent SFX volume, ambience startup, one-shot playback, and event mappings for launch, collisions, portals, UI actions, oxygen pickups, explosions, and game-over feedback in the play page.
- Browser/Playwright validation remains intentionally skipped per user instruction. Static syntax, build, audio inventory, and Git checks remain required.

## 2026-08-08 — Step 20 in progress

- Added `src/music.js` as the shared music contract and controller. It maps Phase 1–3 Normal/Boss tracks, the available ascent `2.0` tracks, and `Main Menu.mp3`; the missing `Phase 2 (Boss 2.0).mp3` remains explicitly unavailable rather than falling back to another track.
- Main Menu starts at 1:15 when playback is allowed. All tracks use fade-out, a short delay, and fade-in from 0:00 for the next loop. Volume is persisted in local storage and exposed on the home and play pages.
- Play page now exposes music-only selectors for descent/ascent `2.0` and Normal/Boss. The ascent `2.0` option is labeled as pending acceptance and does not claim the maps are complete.
- Browser/Playwright validation remains intentionally skipped per user instruction. Static syntax/build checks and Git upload are still required.

## 2026-08-07 — Step 1 in progress

- User selected native Canvas + JavaScript (no engine dependency).
- Locked map layout to pointy-top axial `q,r`; map data is JSON with Chapter 1 base state and Chapter 2 cell/edge overrides.
- Implemented the pure map model and fixed-step physics module. The Canvas editor, JSON import/export, Chapter states, placeholder rendering, and static Node tests now cover five gravity levels, launch direction, spring reflection, current, coral/mine safety, weight stone destruction, checkpoint restoration, bubble gravity immunity, and seaweed attachment.
- Static verification passed: `npm run build` (Vite production build) and `npm run check` (8/8 physics tests). Browser validation was deliberately not run per user instruction.
- Remaining: commit and push this first playable map-editor implementation. Next implementation choice after this milestone: persistence format refinement, first real chapter map data, or game-runtime integration.
- Per user instruction, do not run browser/Playwright/screenshot validation. Use static code checks and pure Node tests only.

## 2026-08-07 — Step 2 in progress

- User asked for fine-grained Cells approximately one third of the player diameter, a direct palette beneath the map, and use of their generated Cell/object art.
- Editor now uses 24 px point-to-point Cells, a 72 px-diameter test player, a 36×25 default precision map, direct material palette, and copied runtime-safe asset files under `public/assets/editor/`.
- All motion-related constants are scaled to 0.1× together: launch, gravity, current, max speed, and weight-stone threshold. Static verification and scoped Git push remain to be completed.
- Static verification passed: Vite production build, 9 physics/model tests, and whitespace validation. Browser validation remains intentionally disabled per user direction.

## 2026-08-07 — Step 3 in progress

- User rejected the axial parallelogram view. The map generator now writes a visually rectangular odd-r grid (uniform columns per row, alternating hex tips at the left/right edge) while retaining axial coordinates for physics and Edges.
- Added a 50%–400% zoom slider directly below the map. Canvas rendering and pointer hit-testing use the same viewport transform so selecting/placing and playtest dragging remain aligned at every zoom level.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by the user.
- Legacy locally saved parallelogram maps now migrate automatically to the rectangular odd-r layout while preserving Cell, Edge, and chapter-override data.
- Added a pure viewport-coordinate test so pointer placement is verified against the same 50%–400% zoom transform used by Canvas rendering.

## 2026-08-07 — Step 4 in progress

- User requested the map maximum width and height at two thirds of the prior 36×25 default, without reducing first-open screen coverage, and a player at one third of the prior size.
- New map defaults are 24×17; first-open/demo zoom is 150% to retain comparable screen coverage; player diameter is 24 px instead of 72 px. Existing authored local maps are deliberately not cropped or resized.
- Demo object/Edge positions are now proportional to map dimensions and covered by a no-out-of-bounds validation test.

## 2026-08-07 — Step 5 in progress

- User requested gravity at 50%, player size at half its current size, horizontal-only drag that settles to a full stop, and separate authored Tile art for every gravity level.
- Located the five authored water Tiles under `GDD/07_技術/六邊形水域素材/`: L-1 rising, L0 neutral, L1 standard, L2 transition, and L3 deep. Runtime copies are being bound one-to-one to `gravityLevel`; the prior one-texture tint approach is removed.
- Static verification passed: 14/14 tests and Vite production build. The build contains all five distinct runtime water Tile files; browser validation remains disallowed.

## 2026-08-07 — Step 6 in progress

- User requested category Tabs for the direct-placement palette so one large, readable asset category is visible at a time, and removal of visible L-level text because the authored Tiles already communicate the water level by color.
- Palette categories now map to water gravity, environment effects, Cell objects, Actor/spawns, Edge interactions, and other terrain. Gravity Tile buttons and map Cells render without L-1/L0/L1/L2/L3 text.
- Static verification passed: 14/14 tests and Vite production build. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 7 in progress

- User requested that adjoining same-type Tiles read as one continuous field, while a change of gravity level or terrain remains visibly separated. Cell rendering now lets same-water Tile rims bleed past the Cell clip and draws only a very faint shared boundary; gravity/terrain transitions and the map perimeter receive a clear dark boundary.
- Audited all seven authored non-passable prototypes. Every source version contained one or more connector spokes/nodes; no clean unconnected version existed. Created a project runtime Tile by precisely removing only the central spoke and two nodes from the user-provided source while preserving its dark stone hex and outer rim. It is stored at `public/assets/editor/terrain/blocked-dark-stone.png` and is selectable under the water-gravity Tab; the terrain Tab retains only passable-water restoration.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 8 in progress

- Correcting the Step 7 blocked-Tile presentation mistake: the generated chroma-green background is removed to alpha, the visible “不可通行” label is removed, and the redundant “其他” Tab is removed. Selecting any water-gravity Tile now also restores that Cell to passable water, so no separate passable-water palette card is necessary.
- Every direct-placement material card now has a right-top `i` control. It flips the card to a purpose description and has a separate return control; opening this explanation never selects a brush or changes the map.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 9 complete

- Completed the three-resource player loop and an in-editor HUD. `health` remains a three-point survival resource; oxygen is now spent by every launch and cannot be spent below zero; the GDD's stamina is represented in code and HUD as `energy`, which pays for aiming and launches, recovers at rest, and recovers faster while attached to seaweed.
- Added an always-visible, non-interactive Canvas overlay: editor mode shows a HUD preview, and physics-test mode renders live health hearts plus oxygen and energy bars. Checkpoints refill all three resources; health/oxygen depletion still returns the tester to its most recent checkpoint.
- Starter balance values are centralised in `src/physics.js`; they are initial tuning rather than a claimed final GDD number. Static verification passed: `npm run check` (15/15 tests) and `npm run build`. Browser validation was deliberately not run per user direction.

## 2026-08-07 — Step 10 in progress

- Reclassified map materials by placement/attachment rather than by the prior technical data buckets: `水域上物件` combines overlays and Cell objects and may only be placed directly on passable water Cells; `邊緣沾黏` contains all Edge interactions and is placed only by clicking a shared hex edge, typically beside a blocked obstacle. Actor/spawn remains separate because it is not a map object attachment mode.
- Removed the duplicate category tool buttons so direct placement is the single place to select any material. Updated every information-card explanation to state the relevant placement mode.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 11 in progress

- Corrected edge attachment orientation: Cell-centre-to-centre is the Edge normal, so edge visual art is now rotated by an additional 90 degrees to lie tangent to the hex edge. Every bitmap-backed edge attachment receives its own short, outlined mounting frame so it remains legible against water.
- Reclassified water grass and coral cluster as new edge types. They are removed from the direct-water palette and now use an edge-attached anchor; if one adjacent Cell is blocked, their base faces the obstacle and their art extends into the passable-water side. Seaweed attachment physics now locates the nearest seaweed Edge, with a legacy Cell-object fallback only for older saved maps.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 12 in progress

- Correcting the Step 11 visual mistake: removed the rectangular neon mounting frame completely. Edge art now gets only a thin alpha-silhouette outline derived from the opaque pixels of its own PNG, so the separation follows the jellyfish/plant shape rather than the image bounds.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 13 in progress

- Corrected the remaining edge-art spacing from the measured transparent bottom padding in the water-grass and coral source sprites, so their opaque pixels now meet the hex Edge instead of visually floating above it.
- Edge attachments now always keep a very faint white silhouette outline. In physics test mode it becomes gold only while the player actually receives that attachment's benefit: within the new coral-cluster safety radius or attached to that seaweed Edge. Coral cluster now provides the corresponding safety effect in physics.
- Rebalanced Cell borders as requested: same-surface shared borders are slightly more visible, while gravity/terrain transitions are thinner and softer.
- Remaining: static verification, scoped commit, and push. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 11 in progress

- Replaced the previous 3/3 health representation with a 0–100 `health` bar plus a separate permanent `lives` counter. Reaching zero health or oxygen consumes exactly one life; Checkpoint respawn restores resources but never restores lives; the final life produces a permanent game-over state until a new test run starts.
- Added `src/game-data.js` as the central numerical contract for player resources, the four passive abilities, the four weapons, and all 19 authored enemy / Mini Boss / Final Boss definitions, including both mutated Mini Boss variants from the enemy encyclopedia. Every hostile entry exposes numeric health and attack/support skill data, including cooldown, damage, telegraph, range, projectile, area, status, or control values where applicable.
- Wired numerical helpers for derived passive modifiers, weapon damage and energy cost, player damage / shield / resource recovery, enemy-defeat resource rewards, and test-run respawn semantics. Static verification passed: `npm run check` (19/19 tests) and `npm run build`. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 13 complete

- Added the standalone enemy encyclopedia at `enemy-encyclopedia.html` and linked it from the map editor top bar. It renders all 19 numerical enemy contracts, filters by tier, shows health/move speed/skill count, and lists each skill's authored values.
- The first preview state is each enemy's natural floating GIF. Skill buttons switch the preview to the mapped attack GIF; mutated variants reuse their prototype's floating loop until a dedicated idle asset exists. Four Boss / Mini Boss entries remain visible with honest `動畫素材待補` states instead of invented previews.
- Copied 89 GIF files into `public/assets/enemies`, added the Vite multi-page input so production output includes `dist/enemy-encyclopedia.html`, and statically verified all mapped catalog paths resolve. `npm run check` passed (19/19 tests); `npm run build` passed. Browser validation remains prohibited by user instruction.

## 2026-08-07 — Step 14 in progress

- Reworked launch speed so pulls up to 90 px keep the existing 0.1× linear response, while excess distance adds a nonlinear long-launch boost. The pointer distance ceiling is now 420 px and the motion cap is 140 px/s, so long horizontal launches can travel materially farther.
- Added live edit-mode placement previews: Cell materials show a full gold or red hex outline, while Edge materials show only the shared hex side. Edge placement is valid only when at least one adjacent Cell is an impassable obstacle; invalid clicks are rejected with an editor status message.
- Every palette card now shows its material name below the image. Removed the Coral Safe Zone overlay from palette data, demo data, runtime safety logic, and its obsolete physics test; coral cluster remains as an Edge-attached protective object.
- Static verification passed: `npm run check` (20/20 tests) and `npm run build`. Browser validation remains intentionally disabled per user instruction.
- Remaining: scoped Git commit and push, then report the exact result to the user.

## 2026-08-08 — Step 18 in progress

- Corrected the layer UI model: T1/T2 are no longer separate water-gravity palette materials. Every L-1/L0/L1/L2/L3 water Tile keeps its gravity identity, and the selected Cell Inspector now exposes a `水域層級` selector for T1 or T2 plus a reset-to-T1 action.
- The layer portal and cross-layer physics remain unchanged; this only moves layer selection to the per-Cell parameter workflow requested by the user.
- Static verification passed: `npm run check` (26/26 tests), `npm run build`, and `git diff --check`. Browser validation remains intentionally disabled per user instruction.
- Remaining: scoped Git commit and push, then report the exact result to the user.

## 2026-08-08 — Step 16 refinement

- Updated the palette instructions and every water-object info card to describe free placement and object-owned hitboxes.
- Eraser preview now prioritizes a free object's silhouette before checking nearby Edges or Cells, and Cell fallback clearing also removes any free objects owned by that Cell.

## 2026-08-08 — Step 17 in progress

- Added independent water-layer data `T1` / `T2` to every Cell. The demo map includes a T2 region with a neutral dark veil, keeping the original L1/L2 gravity colour distinction intact.
- Same-gravity Cells on different water layers now receive the stronger transition border used for different surfaces.
- Added the `層間轉接門` Edge material. A T1↔T2 crossing without this Edge reflects the player like a blocked boundary; a valid portal crossing emits a transition event and allows passage. The palette only accepts the portal on a shared Edge whose two water Cells have different layers.
- Static verification passed: `npm run check` (25/25 tests), `npm run build`, and `git diff --check`. Browser validation remains intentionally disabled per user instruction.
- Remaining: scoped Git commit and push, then report the exact result to the user.

## 2026-08-08 — Step 16 in progress

- Changed `水域上物件` from Cell-snapped placement to free-snap placement. The selected object follows the cursor with its own silhouette-shaped gold outline, and clicking anywhere on the Canvas adds an independent instance rather than toggling a Cell slot.
- Persisted each free object under its nearest Cell with a world offset, visual size, and hitbox radius. Repeated clicks therefore add collision coverage; physics now checks each object's actual position/radius, while legacy Cell-centered objects remain compatible.
- The eraser can target a free object directly by its hitbox before falling back to an Edge or Cell target.
- Static verification passed: `npm run check` (21/21 tests), `npm run build`, and `git diff --check`. Browser validation remains intentionally disabled per user instruction.
- Remaining: scoped Git commit and push, then report the exact result to the user.

## 2026-08-08 — Step 15 in progress

- Replaced the old `清除 Edge` palette material with a dedicated `⌫ 橡皮擦` button in the upper-right of the material palette; the old left-side clear tool and Edge clear card are no longer exposed.
- Eraser preview follows cursor proximity: a whole Cell gets a gold/red hex outline, while a nearby shared Edge gets a gold/red single-side outline. Gold is shown only when Cell contents or an Edge actually exists; empty targets stay red and clicks are rejected.
- Static verification passed: `npm run check` (20/20 tests), `npm run build`, and `git diff --check`. Browser validation remains intentionally disabled per user instruction.
- Remaining: scoped Git commit and push, then report the exact result to the user.

## 2026-08-08 — Step 19 in progress

- Replaced the layer portal's temporary two-arrow marker with a generated deep-sea stone staircase asset. The source was generated with the Image Generation skill, chroma-key background was removed to real alpha, and the final asset is `public/assets/editor/edges/layer-portal-stair.png`.
- The staircase is rendered across the shared Edge rather than as an Edge-tangent symbol. Its high landing faces T1 and its low landing faces T2; reversing the two Cell layers flips the stair direction. The faint silhouette outline remains pixel-shaped, with no rectangular neon frame.
- Added an explicit `階梯大小` Edge Inspector setting for the portal. T1/T2-only placement validation and cross-layer passage physics are unchanged.
- Static verification passed: `npm run check` (26/26 tests), `npm run build`, `git diff --check`, and RGBA/alpha validation of the generated asset. Browser validation remains intentionally disabled per user instruction.
- Remaining: perform the scoped Git commit and push and report the exact result.

## 2026-08-07 — Step 15 complete

- Removed connected opaque matte backgrounds from all enemy animation GIFs while preserving the original sprite pixels and existing alpha information. The remover keys each frame from its border colour, so both pure black and the dark-blue juvenile seahorse matte are handled.
- Updated both app assets (`public/assets/enemies`, 89 GIFs) and GDD source previews (86 GIFs): 175 GIFs / 1362 frames total. Static alpha validation reports 0 corner errors across both trees.
- Added the repeatable `scripts/remove-gif-black-background.py` utility. `npm run check` passed (20/20 tests), `npm run build` passed, and Python syntax validation passed. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 16 complete

- Added the shared `src/afterimage.js` profile: four historical samples, nearest opacity 28%, exponential decay 0.58, and a 3 px per-sample drift so older ghosts visibly separate from the current sprite.
- Added a repeatable `scripts/create-gif-afterimage.py` generator and produced 89 transparent animated WebP previews under `public/assets/enemies-afterimage`. The encyclopedia now defaults to the formal trail and provides a switch to compare clean animation versus afterimage.
- Static validation passed: 89 WebP files / 690 frames, 3,158,586 partial-alpha pixels, 0 transparent-corner errors; all 19 enemy catalog mappings resolve. `npm run check` passed (20/20 tests), `npm run build` passed, and Python syntax validation passed. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 17 complete

- Fixed afterimage loop boundaries by wrapping the four historical samples across the animation cycle; the first frame now inherits the previous cycle's tail instead of flashing to a single sprite.
- Removed the fake `自然漂浮` skill tab. Skill buttons now toggle: selecting a skill opens its animation and detailed description; clicking the same skill again cancels it and restores the natural-floating state.
- Added complete ecology descriptions for all 19 enemies and detailed descriptions for all 48 authored attacks. Natural-floating cards show `生態觀察`; skill selection replaces it with the selected attack's explanation and numerical details.
- Static verification passed: all 89 afterimage WebP loops retain transparent corners and first-frame history, all catalog descriptions have no fallback text, `npm run check` passed (21/21 tests), and `npm run build` passed. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 18 complete

- Added a top-right `Lore 檔案` button to every enemy encyclopedia card. It opens a contextual Lore panel without disturbing the selected skill or natural-floating preview.
- Connected all 19 enemies to the existing `敵人圖鑑.md` creature references: real-world biological reference, identification features, and visual setting. The panel also states that these references provide silhouette/part/motion inspiration rather than a realistic copy.
- Kept Lore data separate from numerical combat contracts and skill descriptions. Static verification confirmed 19/19 enemies have all three Lore fields; `npm run check` passed (21/21 tests), `npm run build` passed, and `git diff --check` passed. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 19 complete

- Made Lore a focused reading mode: opening `Lore 檔案` resets the preview to natural floating and hides the skill controls, health/move-speed/skill statistics, ecology introduction, and selected-skill panel.
- Removed the redundant `再次點擊已選技能即可取消，回到自然漂浮` hint from every card.
- Static verification passed: the old hint is absent, the Lore focus CSS rule covers all requested sections, `npm run check` passed (21/21 tests), `npm run build` passed, and `git diff --check` passed. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 20 complete

- Rebuilt `maps/下沉篇/下沉篇-第2部分.json` as an independent 20×96 hot-spring route instead of copying and simplifying the Part 3 template.
- The new route uses four thermal chambers, alternating thermal banks, L1/L2/L3 gravity bands, alternating T1/T2 water layers, a conditional pressure seal, recovery objects, return currents, hazards, and a paired thermal-loop multi-portal. Its metadata now explicitly records independent generation.
- Updated the map README and map tests to protect the independent design. Descent-map tests passed 4/4 and the production build passed. The full `npm run check` currently has one unrelated pre-existing physics failure in dirty `src/physics.js`; all map tests and syntax checks pass. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 20 complete

- Added a shared official-settings contract for every Free Snap water object and editable Edge. New placements carry fixed official values, the Inspector can change one instance or restore that instance to the official defaults, and legacy Cell-centred objects remain selectable; selecting a legacy ink overlay promotes it to a configurable Free Snap object.
- Water-object tuning now drives physics: ink visibility range, mine damage, weight-stone break speed and downward weight, oxygen-ore yield plus impact threshold, photosynthesis-bubble oxygen plus gravity-immunity time, and Torricelli oxygen recovery per second. Spring jelly bounce and spike damage are likewise Edge parameters; seaweed and coral expose size only.
- Removed the selected-Cell neighbour connector lines. Fixed gravity levels remain explicit: L3 2.0G down, L2 1.5G down, L1 1.0G down, L0 0G, and L-1 1.0G up.
- Static verification passed: `npm run check` (24/24 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 21 complete

- Rendering now clips the alternating left/right half-Cell tips to a stable rectangular map silhouette without changing stored odd-r coordinates, Cells, Edges, or pointer hit-testing.
- Occupied Edge Snap locations gain a water-colour, lightened center-to-edge triangular sector; water objects and Edge art receive white silhouette outlines so Free Snap items remain visually distinct from Edge occupancy.
- Static-only verification passed: `npm run check` (27/27 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 23 in progress

- Added click-and-drag painting for Cell materials. Holding the pointer after selecting a gravity Tile or terrain brush captures the pointer, samples the path between events, and applies the same value to every crossed hexagon without toggling or repeating a Cell.
- Single-click placement remains unchanged. Free Snap water objects still place independently at the cursor, while play-mode player dragging keeps its existing launch behavior.
- Updated the palette hint to document the hold-and-drag workflow. Pointer cancellation, tool changes, and mode changes safely stop an active paint stroke.
- Static verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited per user instruction.
- Remaining: scoped commit and push; unrelated enemy preview changes in the working tree remain untouched.

## 2026-08-08 — Step 25 in progress

- Changed the default editor zoom from 150% to 200% and made the internal canvas width fit the stable map width at that default, so the left and right map edges meet the viewport without a horizontal crop.
- Wrapped the canvas in a vertical camera viewport. The viewport scrolls vertically without changing `state.zoom`; the canvas grows as the map grows and exposes scroll state through `render_game_to_text`.
- Added `ensureOddRRows` and downward authoring: clicking within the fixed column range below the current last row creates continuous odd-r Cell rows, while the bottom perimeter cap is omitted so the map does not look closed.
- Browser and Playwright checks remain prohibited per user instruction; static Node tests and Vite build are still required before commit and push.

## 2026-08-08 — Step 22 in progress

- Corrected the generated layer-portal placement: the stair is now reduced from 1.8× to 1.08× Edge length and its high-side contact edge is shifted onto the shared hex Edge instead of being centered over it.
- The stair extends toward the T2 side from that contact line; the T1/T2 direction flip is preserved, so the low landing remains on T2 while the attached diagonal edge stays aligned to the boundary.
- Static verification passed: `npm run check` (27/27 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited per user instruction.
- Remaining: scoped commit and push; unrelated enemy preview changes in the working tree remain untouched.

## 2026-08-08 — Step 23 complete

- Correcting Step 21's rendering mistake: the map trim now clips only the alternating left/right half-Cell tips. It no longer clips map height, so every authored water row remains visible and is merely trimmed at the two side boundaries.
- Static-only verification passed: `npm run check` (27/27 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 24 complete

- Replaced the object-filled demo map with a blank 24×17 authoring map: every Cell is passable `L0`/`T1` water, with no overlays, water objects, Actors, Edges, or chapter overrides.
- Retired the previous browser-local `v1` demo storage key and moved authored persistence to `v2`; the first refresh clears the old demo once, while later deliberate saves continue to persist normally.
- Static-only verification passed: `npm run check` (27/27 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 26 complete

- Fixed Free Snap placement crash: the placement path now calculates the target Cell centre explicitly instead of reading a missing `nearest.center` value.
- Added a visible water-object positioning selector with `自由放置` and `六邊形中央`; clicks in narrow geometric gaps resolve to the nearest water Cell, while blocked Cells remain rejected.
- Reworked the side clip to process each odd-r row independently, so both left and right outer Cells lose the same protruding half-Cell instead of alternating between a half and a full Cell.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 27 complete

- Clicking the already-active palette asset now cancels the gold selection frame and returns to Select mode with a grab cursor; dragging the canvas pans the map, including touch pointer input.
- Zooming from the slider or canvas wheel keeps the last pointed canvas location anchored by compensating the map pan before re-rendering.
- Reverted the row-by-row side clip after visual review. The global silhouette clip remains, while only the alternating full outer Cell surfaces are trimmed to their inner half so each row's two sides use matching half-Cell treatment.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 28 complete

- Replaced the surface-only outer-cell trim with a final perimeter mask applied after surfaces, objects, edges, actor art, and ink overlays. Any alternating outer Cell that would have remained whole now loses its outer half at the same final visual layer, keeping the left and right perimeter treatment symmetric.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 29 complete

- Removed the final perimeter mask that was creating dark triangular notches.
- Shifted the single render silhouette by half a Cell: the left edge now includes the previously clipped outer Cell, while the narrow protruding right-edge Cell is excluded from the render boundary.
- Re-centred the map origin against the shifted silhouette so the filled left edge stays inside the canvas.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 30 complete

- Added the final left-perimeter mask requested by the latest visual review, removing the remaining inward-facing outer-half fragments while preserving the right-side narrow-cell exclusion.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 31 complete

- Reverted the left-perimeter mask after visual review showed it created oversized dark triangular gaps. The rest of the perimeter and editor interaction changes remain unchanged.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 32 complete

- Replaced the mixed perimeter behavior with one global rectangular clip for the completed map. Both left and right sides use the same half-Cell inset; no per-Cell or per-row perimeter masks remain.
- Re-centred map-origin calculation against that full-map rectangle so the crop is a single symmetric viewport boundary rather than a collection of Cell edits.
- Static-only verification passed: `npm run check` (28/28 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 33 complete

- Moved the water-object placement switch directly below the palette Eraser button as requested; it is no longer in the left tools panel.
- Replaced the DOM-only select with explicit `Free Snap` and `六邊形中央` buttons backed by `state.objectPlacementMode`. Preview placement, saved offsets, status text, and `render_game_to_text` now use the same mode value.
- Static-only verification passed: `npm run check` (30/30 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 34 complete

- Added a dynamic microflow field for passable water. The field is a time-varying curl pattern with no fixed global direction; its region mean is subtracted so a connected water area does not drift as one body.
- Microflow regions are separated by gravity level, water layer, blocked terrain, and blocking Edges. T1 and T2 therefore keep independent motion fields.
- Added subtle per-Cell water arcs, particles, and brightness pulses for the visual motion layer. Player physics receives only 10% of the explicit current acceleration, while gravity and existing horizontal damping remain unchanged.
- Static verification passed: `npm run check` (30/30 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited per user instruction.

## 2026-08-08 — Step 36 complete

- Increased the microflow and water-motion presentation to 5x the original prototype strength while preserving curl flow, connected-region mean subtraction, and separate T1/T2 fields.
- Static verification passed for this tuning pass: `npm run check` (30/30 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited per user instruction.

## 2026-08-08 — Step 35 complete

- Added a right-side Inspector field for Razor water objects: each placed Razor can now use 1–4 blades, with the saved count driving the rotating visual while keeping the existing hitbox and damage contract.
- Made downward authoring explicit: clicking a dashed continuation Cell with a gravity or terrain brush extends only within the visible four-row buffer, preserves the map's screen anchor, and keeps the next four dashed rows available.
- Newly created continuation rows inherit each column's previous bottom-row gravity and water layer instead of resetting blindly to L0; the guide tint follows that same bottom-row gravity and the palette hint explains the direct placement action.
- Static verification passed: `npm run check` (30/30 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 36 complete

- Added a Free Snap one-time water button with a procedural visual, official size setting, pressed state, and Inspector field for one or more target Cell coordinates.
- Added conditional passage Cells. A closed gate is impassable; when its assigned button is touched, it checks the two upper NE/NW Cells, copies their matching water gravity, changes to passable water, and stays open.
- Added map validation for missing buttons, missing target Cells, non-gate targets, and invalid gate terrain/state, plus a physics regression test for one-time activation and gravity copying.
- Documented the button/gate authoring flow in the map-element and Tile Editor GDD files.
- Static-only verification passed: `npm run check` (31/31 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 37 complete

- Reworked conditional passage gates as a new full-Cell gravity Tile type, alongside L-1/L0/L1/L2/L3, with a fixed `L1` gravity level.
- Generated and integrated `conditional-L1.png`: the closed state is an L1 water tile sealed by crossed chains; the open state uses the brighter regular L1 water tile and keeps the same L1 gravity.
- Removed the previous incorrect behavior that copied gravity from the two Cells above the gate. The palette now places the conditional gate directly as a gravity Cell tool, and Inspector designation also forces L1.
- Removed the generated image's black surround with the chroma-key helper and verified transparent corners (`RGBA`, alpha `0`).
- Static-only verification passed: `npm run check` (31/31 tests), `npm run build`, `git diff --check`, and the conditional gate alpha check. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 38 complete

- Generated and chroma-key cleaned `public/assets/editor/actors/player-diver.png`, an ancient-relic human diver matching the project's deep-sea stone-carving and geometric biomimetic art direction.
- Replaced the player-start `P` marker in the editor and the playtest player's `P` circle with the diver artwork.
- Added a shared player animation: gentle buoyant bob, body sway, cyan core pulse, attached-state green glow, and rising oxygen bubbles; the palette also shows the diver artwork for the player-start material.
- Static verification passed: `npm run check` (44/44 tests), `npm run build`, `git diff --check`, and the player diver alpha check. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 38 in progress

- Fixed downward authoring and Free Snap placement target resolution: after extending the map, the editor now returns the resolved continuation Cell directly instead of re-running a boundary-sensitive geometric hit test.
- Static verification passed for this regression fix: `npm run check` (31/31 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited per user instruction.

## 2026-08-08 — Step 39 complete

- Added a standalone `sandbox.html` combat lab with click-to-place enemy instances, selected-enemy skill controls, automatic skill cycling, player attack testing, and a readable event/telemetry panel.
- Added `sandbox-sim.js`: all 19 enemy definitions can be spawned, every current attack type has a sandbox execution path, and effects cover contact/melee, projectiles, lobbed zones, summons, support/link, beams, split, clones, rule changes, gravity fields, and oxygen corruption.
- Added customizable weapon/level selection, all passive ability levels, invincibility, infinite oxygen/energy, pause/reset controls, animated enemy GIF reuse, and procedural fallback markers for enemies without authored GIFs.
- Static verification passed for this sandbox pass: `npm run check` (34/34 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited per user instruction.

## 2026-08-08 — Step 40 complete

- Added a dedicated `水域層級`整格筆刷 with T1/T2 cards. Selecting T2 and clicking or dragging now batch-paints water-layer data without opening each Cell Inspector; continuation rows keep the same downward authoring behavior.
- Replaced manual button target-coordinate input with an Inspector `開始拖曳連線` flow. Dragging a selected button onto a conditional gate stores the Cell link, draws a persistent editor-only arrow, and supports both one-time and toggle button modes.
- Replaced the perspective layer-portal staircase bitmap on the map with a symmetric vector marker anchored to the exact shared hex edge and T1/T2 center direction, so every edge orientation stays centered instead of leaning.
- Static-only verification passed: `npm run check` (36/36 tests), `npm run build`, `git diff --check`, and a pure Node toggle-button interaction check. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 41 complete

- Play page report: blocked hexes were visually rendered but ordinary terrain transitions did not collide, and the automatically selected water Cell was biased toward the right edge.
- Fixed: water-to-blocked transitions reflect the actor, the play page chooses a true map-centre water spawn, 4x world scale shows roughly 60% of the map horizontally, and pointer capture/drag handling is hardened.
- Added `window.render_game_to_text` and `window.advanceTime` hooks for deterministic play-state inspection.
- Static-only verification passed: `npm run check` (41/41 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 42 complete

- Play feedback exposed two runtime problems: terrain contact was only checked after Cell-centre crossing, and each launch preview rescanned the full 2,808-Cell map.
- Added direct water-to-blocked hex contact reflection, cached connected microflow regions and means, nearby odd-r point lookup, nearby Edge attachment lookup, and revision-aware object caches.
- Launch previews now share the immutable map, use 48 prediction steps, and throttle pointer recomputation to 45 ms. Added deterministic `render_game_to_text` / `advanceTime` hooks.
- Pure Node benchmark: 48-step trajectory preview dropped from about 550 ms to 8 ms first-run / 2 ms warm; 240 physics steps on the reference map dropped from about 3 s to about 26 ms.
- Static-only verification passed: `npm run check` (43/43 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 45 complete

- Removed vertical microflow acceleration from player physics. Water motion still has visual animation and a small horizontal perturbation, but it can no longer lift the player during an angled launch.
- Added a regression test asserting player microflow acceleration has `y === 0`.
- Static-only verification passed: `npm run check` (44/44 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 44 complete

- Increased launch momentum by an explicit 5x multiplier for both short and long launch distance terms.
- Added a temporary launch momentum cap of 700 px/s for 0.75 seconds, while ordinary drifting remains capped at 140 px/s.
- Added the play-page `∞ 無限氧氣／能量` toggle; enabled mode refills both resources before and after every fixed physics step and before launch costs.
- Matched the play transition seam to the supplied reference: same surfaces remain nearly merged, while water/blocked or other surface transitions use a deep dark seam.
- Static-only verification passed: `npm run check` (43/43 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 43 complete

- Synchronized the standalone play renderer with the editor's water presentation: animated local arcs, particles, and slow brightness breathing now run on every visible water Cell.
- Replaced per-Cell heavy strokes with editor-style shared-side boundaries: same terrain/gravity/layer is faint, transitions are clear, and no artificial outer grid cap is drawn.
- Static-only verification passed: `npm run check` (43/43 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 46 complete

- Fixed the actual standalone play page so it no longer draws the player as a `P` marker; it now loads the diver sprite and keeps a non-text diver silhouette while the image loads.
- Replaced the diver sprite with an opaque black visor that hides the face, while preserving the ancient carved-stone armor, cyan core, bubbles, and transparent background.
- Updated the play instructions and initial event text to refer to the diver.
- Static-only verification passed: `npm run check`, `npm run build`, `git diff --check`, and RGBA/alpha validation of `public/assets/editor/actors/player-diver.png`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 47 complete

- Traced the remaining upward drift to authored `current` Edges: diagonal current vectors were still injecting a vertical acceleration after water microflow `y` had been removed.
- Current Edges now keep their horizontal nudge but return `y: 0`; vertical motion is limited to launch impulse, Cell gravity, and explicit collision responses.
- Added a regression test for a diagonal current and reran static checks: `npm run check` (45/45 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 47 complete

- Changed both the play page and map-editor play mode to draw a straight launch guide made only from the actor-to-pointer direction and distance. The guide no longer renders the curved path produced by gravity or current.
- Kept `launchActor`, runtime physics, and `predictTrajectory` available for actual movement and tests; only the player-facing preview was simplified so gravity remains an experience-based judgment.
- Updated the player-operation, core-summary, physics-launch, and water-gravity GDD notes to record this intentional information boundary. Static syntax/build checks remain required; browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 49 complete

- Added player animation states for swimming, hurt, death, and fast ascent, with shared state selection used by both the editor Play mode and standalone `play.html`.
- Added generated black-visor diver variants: `player-diver-swim.png`, `player-diver-hurt.png`, `player-diver-death.png`, and `player-diver-fast-ascent.png`; all are RGBA cutouts with transparent corners.
- Damage now starts a short hurt timer, death preserves a short death pose at the impact position, and standalone play now handles death/respawn presentation consistently with the editor.
- Added a subtle pale-white silhouette outline around the diver so the player remains readable against dark water tiles.
- Static-only verification passed: `npm run check` (48/48 tests), `npm run build`, `git diff --check`, and alpha validation for all five diver assets. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 48 complete

- Replaced the bare straight launch line with a shared `潮壓脈衝導引`: soft cyan pressure wake, moving gold core, alternating hex pulse markers with asymmetric fins, an animated charge ring at the diver, and a hexagonal echo ring at the aimed landing point.
- The guide remains strictly collinear with the actor-to-pointer axis; marker count scales with drag distance, but no gravity/current curvature is revealed. Runtime physics and `predictTrajectory` remain untouched for actual movement and tests.
- Added `src/launch-guide.js` and pure geometry tests. Static verification passed `npm run check` (47/47 tests), `npm run build`, and `git diff --check`. Browser validation remains prohibited by user instruction.

## 2026-08-08 — Step 51 complete

- Replaced the four single-frame diver state assets in runtime use with four six-frame sprite groups: swim, hurt, death, and fast ascent.
- Generated 3×2 work sheets, removed the chroma-key background, sliced each group into six independent 512×512 RGBA PNGs, and added four GIF previews at 12 FPS.
- Swimming frames now alternate the flippers and lightly sway the arms/hoses; hurt, death, and fast ascent each have their own six-frame sequence.
- Sprite artwork is authored facing left. Runtime preserves the left-facing frames for left launches and mirrors them for rightward motion; the current pale-white silhouette outline remains enabled.
- Static-only verification passed: `npm run check` (51/51 tests), `npm run build`, `git diff --check`, six-frame/count checks for all four groups, and transparent-corner validation for all 24 PNGs. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 50 complete

- Removed the remaining visual position jump at blocked terrain and sealed water-layer boundaries: collision resolution now returns to the previous physics position instead of teleporting to a normal-offset point.
- Kept horizontal blocking/reflection and the no-upward-lift velocity guard; explicit spring and mine bounce behavior remains unchanged.
- Added a regression test for collision position correction. Static-only verification passed: `npm run check` (50/50 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 51 complete

- Changed the launch preview from a pointer-ended line into a real forward range preview: the dashed path now mirrors the pull distance in the opposite direction, while the solid path remains attached to the pulled pointer.
- Capped the visible forward range at the same 420px launch limit used by physics, retained the gyro/hex endpoint, and added a grey diver silhouette with a subtle breathing pulse at the predicted landing point. Gravity and current are intentionally absent from the preview.
- Added regression coverage for diagonal alignment, forward endpoint projection, and over-cap pulls. Static-only verification passed: `npm run check` (51/51 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.
## 2026-08-08 — Step 52 complete

- Separated launch energy from movement oxygen: each launch settles a fixed 5-energy cost, aiming is free, and oxygen now follows actual physics travel distance with a deliberately reduced `0.0003` per-pixel rate.
- Empty oxygen now applies gradual health starvation damage instead of immediate death. Empty energy does not kill or cancel a launch; the existing idle-rest recovery requires the player to stop moving.
- Moved editor and standalone-play resource HUDs to the bottom in the requested order: oxygen left, health center, energy right. The top-left readout now shows Attempts.
- Static-only verification passed: `npm run check` (52/52 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 53 complete

- Rebalanced oxygen per launch: the planned budget is `distance × 0.025`, so a 200 px medium launch budgets about 5 O₂ and a full 420 px launch about 10.5 O₂. The budget is still charged progressively from actual travel distance rather than removed at release.
- Reordered both HUDs to health left, oxygen center, energy right, while Attempts remains top-left. Launch logs now show the planned oxygen budget.
- Made launch-facing a hard rule: the actor keeps the left/right direction chosen by the latest horizontal launch instead of being flipped by current drift or reflection.
- Added a stationary rest animation for low-speed players that have contacted an impassable obstacle; the swim frame and body motion freeze so the legs no longer kick against the wall.
- Static-only verification passed: `npm run check` (53/53 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 57 complete

- Corrected the diver sprite mirror direction after visual review: the generated source poses are right-facing, so rightward travel keeps the source image and leftward travel mirrors it.
- Centralized the mirror rule in `getPlayerSpriteScaleX` and used it from both the map-editor renderer and standalone play renderer, preventing the two views from drifting apart again.
- Added a regression test for right/left/unknown facing scale signs. Static-only verification passed: `npm run check` (56/56 tests), `git diff --check`; browser and Playwright checks remain prohibited per user instruction.

## 2026-08-08 — Step 56 complete

- Updated the diver's physics-facing state at launch and after each movement step, so the sprite follows the actual horizontal travel direction and retains the last side during vertical drift.
- Removed time-based non-uniform scale pulses from swimming, hurt, death, and fast-ascent motion. Added small fixed per-frame envelope corrections and kept X/Y scale uniform so pose changes no longer read as the diver growing and shrinking.
- Added focused animation/facing regression tests and included them in `npm run check`. Browser and Playwright validation remain intentionally skipped per user instruction.

## 2026-08-08 — Step 55 complete

- Removed the standalone top-card appearance from the full-screen play page. The brand, centered map selector, settings button, and exit link now sit directly over the game canvas as an embedded top HUD.
- The map stage starts at the top of the viewport instead of below a separate header block; the settings drawer remains contextual and only appears after pressing 設定.
- Static-only verification passed: `npm run check` (53/53 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 54 complete

- Reworked the standalone play page into a full-screen play deck: removed the left-side control console and let the map stage own the viewport.
- Moved the map-part selector to the centered top bar. Added a top-right Settings drawer containing music arc/context, play/pause, volume, unlimited oxygen/energy, reset, camera status, and event history.
- Kept keyboard controls intact: `Space` pauses, `R` resets, and `Escape` closes Settings before leaving the play page.
- Placed help and vitals as lightweight overlays so they remain readable without reclaiming a permanent sidebar. UI hierarchy follows the game UI pattern of keeping high-frequency map choice central and low-frequency tools contextual.
- Static-only verification passed: `npm run check` (53/53 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 58 in progress

- Adopted the approved middle-scale visor layout: medium lower side resource bays, three compact upgrade sockets per side, and a medium bottom life dashboard.
- Generated and chroma-keyed the balanced visor frame into `public/assets/editor/hud/visor-frame-balanced.png`; the center viewport and life-dial center are transparent.
- Replaced the editor Play HUD and standalone play HUD with the visor layout. Oxygen uses a live vertical fill and percentage, energy maps the existing 0–100 value to five slots with 0.5-slot precision, and health uses ten clockwise segments from the bottom plus a live pointer and central value.
- Static-only checks currently pass: `npm run check` (59/59 tests), `npm run build`, `git diff --check`, and RGBA transparency validation. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 59 complete

- Tuned the approved visor HUD against the supplied play preview: O₂ moved slightly right/up, ENERGY moved slightly left and reduced, and the life core moved slightly right/up.
- Rotated the ten health markers with their 36-degree positions so they form a decagonal ring instead of ten horizontal dashes.
- Replaced stepped health colors with continuous hue interpolation from green through yellow to red, while retaining severity classes for fallback styling.
- Static-only verification passed: `npm run check` (59/59 tests), `npm run build`, and `git diff --check`. The attempted preview connection timed out without interacting with the game; no browser automation was performed.

## 2026-08-08 — Step 60 complete

- Applied the requested final HUD offsets: O₂ right 1px/up 3px, ENERGY left 1px/up 3px, and HP readout left 4px.
- Made the HP needle a continuous illuminated line from the dial center to its marker, while keeping the ten-segment decagonal health ring and continuous green-yellow-red interpolation.
- Generated and chroma-keyed the full-screen engineering surround into `public/assets/editor/hud/visor-surround-balanced.png`; its central window remains transparent so the live game view shows through.
- Added a restrained glass-reflection layer using edge-localized cyan highlights and soft transmission light, without washing over the playable map.
- Static-only verification passed: `npm run check`, `npm run build`, `git diff --check`, and RGBA transparency validation for the surround. The preview connection was attempted earlier but timed out; no browser automation result is being claimed.

## 2026-08-08 — Step 61 complete

- Applied the requested final micro-adjustments relative to the previous HUD layout: O₂ moved right 1px and up 2px, ENERGY moved left 1px and up 4px, and the HP readout moved left 7px.

## 2026-08-08 — Step 62 complete

- Moved O₂ upward another 4px and moved the HP readout left another 7px.
- Scaled each of the five ENERGY bars to 80% in both dimensions around its center, keeping the five-slot layout and half-step value logic unchanged.

## 2026-08-08 — Step 63 complete

- Added a live blue embedded DEPTH readout inside the play visor; it reports the diver's current map-row depth in metres and works for existing and future map parts.
- Replaced the top-right text settings control with a gear-only button and moved the exit action into the settings drawer. Escape now closes the drawer without leaving the play page.
- Reversed ENERGY fill ordering so energy is consumed from the top bar downward; the final remaining bar stays at the bottom.

## 2026-08-08 — Step 64 complete

- Added a blue embedded LEVEL/EXP readout beside the depth display. It currently shows Level 1 and `EXP 000 / 100`, with a progress bar ready for later experience rewards without inventing a reward rule yet.
- Moved the entire HP ring left 7px and reset the HP label/value to the exact center of that ring, so both remain visually centered.

## 2026-08-08 — Step 65 complete

- Added the adjustable enemy-tier experience contract: defeated enemies create stationary experience orbs at their defeat position, and the player must physically approach to collect them.
- Added progression state, level thresholds through Lv.12, pending level-up handling, category-first upgrade selection, weapon/passive candidates, active weapon switching, and the sandbox progression HUD.
- Locked the starting Build to one Lv.1 knife plus up to two additional weapons; the authored weapon cooldown and melee/projectile type now both apply in sandbox attacks.
- Updated the growth and weapon GDD entries to document the fixed knife, 11 post-start choices, orb rewards, and manual pickup rule. Static-only verification passed: `npm run check` (68/68 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-08 — Step 66 complete

- Embedded the chapter picker inside the full-screen map stage, above the LEVEL 01 card; moved DEPTH down and right so the visor machinery cannot cover it, and removed the bottom instructional strip.
- Rotated portal artwork along the shared hex edge and nudged it toward the water side when the neighboring cell is blocked, making the edge attachment read as a mounted transition instead of a floating overlap.
- Added collision-entry sound deduplication: wall and other contact sounds play once when entering a collision and stay quiet while the player remains held against it.
- Added a Settings toggle for the existing 240-second underwater ambience loop; it starts on interaction when autoplay is unavailable and can be turned off/on explicitly.
- Static-only verification passed: `npm run check` (68/68 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-09 — Step 67 complete

- Reworked the embedded chapter picker to use the same compact left-accent card language as the LEVEL 01 readout, with tighter vertical spacing so the two cards read as one HUD stack rather than an AI-generated navigation banner.
- Increased visor transmission/reflection contrast with layered glass sheen, diagonal highlights, edge glow, and reduced-motion fallbacks; the map remains visible through the transparent center.
- Made ambient audio startup resilient to autoplay rejection by listening in capture phase on trusted pointer/keyboard gestures, retrying after rejected attempts, and raising the 240-second underwater loop/bubble mix to an audible but subordinate level.
- Static-only verification passed: `npm run check` (70/70 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-09 — Step 68 complete

- Made gravity direction an arc-level rule instead of a Tile-level workaround: maps tagged `下沉篇` multiply water gravity by `-1`, so L1/L2/L3 pull toward screen-up and the player must launch upward to progress.
- Maps tagged `上升篇` keep the normal `+1` direction and pull toward screen-down; untagged test/sandbox maps retain the legacy downward default.
- Kept L-1 as the inverse of the active arc direction and L0 neutral. Trajectory prediction accepts the same direction option so previews cannot disagree with runtime physics.
- Added regression coverage for both 下沉篇 and 上升篇 direction rules. Static-only verification passed: `npm run check` (76/76 tests), `npm run build`, and `git diff --check`.

## 2026-08-09 — Step 69 complete

- Replaced velocity/resting-based energy recovery with a launch-action timer: each successful elastic launch starts a one-second delay, then energy recovers continuously even while the diver is still drifting.
- Seaweed retains its higher recovery rate but now respects the same one-second post-launch delay; failed too-short or energy-starved attempts do not reset the timer.
- Updated the stamina system and core summary documents to match the implemented rule. Added a regression test for recovery during movement and delay reset after a new launch.
- Static-only verification passed: `npm run check` (77/77 tests), `npm run build`, and `git diff --check`.

## 2026-08-09 — Step 68 complete

- Rebuilt Descent Parts 1 and 2 as independent authored routes instead of simplified copies: Part 1 is a forgiving deep-forest teaching route, while Part 2 is a thermal branch-and-gate challenge with an optional portal shortcut.
- Preserved the player's original 24×117 Part 3 terrain, gravity, T1/T2 layers, and multi-portal structure as the final exam; the generator now only adds encounter pacing, resources, and actor markers around that authored geometry.
- Added one real player start per map plus enemy, Mini Boss, and Boss markers, and made the standalone play page honor each authored start instead of falling back to the map centre.
- Established a teach-then-combine curve that uses every implemented free object and Edge interaction across the trilogy. Focused map checks cover structural validity, route connectivity, complete mechanic coverage, button-before-gate order, difficulty growth, and exact preservation of the player's Part 3 geometry.
- Static-only verification passed: focused map checks (8/8), full `npm run check` (74/74 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-09 — Step 69 complete

- Corrected Part 1's Torricelli-space interpretation: each reward is now an L-1 pocket at least six columns off the main axis, sealed from above so the player must first descend past its junction and then reverse upward by seven or eight rows.
- The first right-side detour teaches the reversal with a downward return current. The second left-side detour is longer and combines a stronger return current with a spike at the narrow throat.
- Added a focused structural test that proves neither Torricelli reward can be reached without first descending to its lower junction. Static-only verification passed: focused map checks (9/9), full `npm run check` (75/75 tests), `npm run build`, and `git diff --check`. Browser and Playwright checks remain prohibited by user instruction.

## 2026-08-09 — Step 70 complete

- Responded to the supplied gameplay crop showing that the first Torricelli reward still read as an ordinary open-water pickup. The previous reachability-only proof was insufficient because its three-column shaft and six-column connector did not create a visible local-room silhouette.
- Rebuilt both Part 1 detours as two-column ascent wells, separated from the main route by two- or three-column rock walls and entered only through narrow bottom tunnels. Each Torricelli object now sits at the capped top with four blocked neighbouring cells.
- Extended the regression check to enforce shaft width, separation-wall thickness, two-cell reward-row width, and at least three locally blocked neighbours. Static-only verification passed: full `npm run check` (76/76 tests), `npm run build`, and `git diff --check`; browser and Playwright checks remain prohibited by user instruction.

## 2026-08-09 — Step 71 complete

- Expanded only Part 1's vertical length from 72 to 160 rows while retaining the original 18-column width, following the user's explicit correction that length—not width—must double.
- Replaced the short corridor with five macro exploration sections containing four split-and-rejoin loops, 16 water regions, large forest-rock masses, long horizontal traverses, optional reward grottoes, and 18 paced resource objects.
- Kept sampled primary routes at least five Cells wide. Torricelli return caverns are now four Cells wide and require 18- or 23-row upward returns, preserving their risk/reward identity without precision movement.
- Added static checks for unchanged width, doubled height, exploration-loop count, region variety, broad route cross-sections, and a shortest completion route of at least 150 Cells. Static-only verification passed: focused map checks (10/10), full `npm run check` (78/78 tests), `npm run build`, and `git diff --check`; browser and Playwright remain prohibited by user instruction.

## 2026-08-09 — Step 73 complete

- Connected the authored `enemySpawn` actors to the standalone play page. Map load now creates deterministic chapter-appropriate regular enemies while leaving Mini Boss and Boss markers outside this small-enemy pass.
- Preserved the authored encounter density: Part 1 spawns 9 teaching enemies, Part 2 spawns 4 mid-tier enemies, and Part 3 spawns 6 advanced regular enemies. Existing markers may optionally override the assigned regular enemy with an explicit `enemyId`.
- Rendered the transparent natural-floating enemy assets with a small positional drift, fixed sprite size, camera culling, loading fallback, spawn-count event, and visible-enemy text state. Formal combat AI remains a separate follow-up rather than being implied by this visibility milestone.
- Static-only verification passed: focused play-enemy checks (3/3), full `npm run check` (85/85 tests), `npm run build`, and `git diff --check`. Browser and Playwright remain prohibited by user instruction.

## 2026-08-09 — Step 74 complete

- Corrected Step 73 after the user pointed to `GDD/05_內容/敵人/敵人配置.md`: all three current maps belong to Chapter 1 Descent and must use its documented 2 Lv.1 enemies, 4 core Lv.2 enemies, and 3 elite Lv.3 enemies. Removed Chapter 2-only split, symbiotic, and mutated enemies from these maps.
- Reinterpreted each authored `enemySpawn` as an encounter-group anchor. Nearby distinct passable Cells now expand those anchors into 40 enemies in Part 1, 40 in Part 2, and 48 in Part 3, instead of stacking many sprites on nine, four, or six coordinates.
- Part 1 establishes both Lv.1 enemies before transitioning into the complete four-enemy core pool. Part 2 keeps the complete core pool and introduces all three Descent elites. Part 3 keeps the core pool while increasing elite presence.
- Doubled both enemy render size and radius. Focused configuration checks passed (4/4), full `npm run check` passed (88/88), `npm run build` passed, and `git diff --check` passed. Browser and Playwright remain prohibited by user instruction.

## 2026-08-09 — Step 74 complete

- Added explicit Canvas-only knife upgrade profiles: Lv.1 path slash, Lv.2 two side trails at 70% main damage, and Lv.3 stationary area damage with a fixed tick interval.
- Added distinct Lv.1/Lv.2/Lv.3 arc, trail, and accent visuals without image assets.
- Enlarged the sandbox diver interaction zone, made diver control the default, and made enemy placement an explicit opt-in mode.
- Static-only verification passed: focused progression tests (15/15), full `npm run check` (87/87), `npm run build`, and `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 75 complete

- Replaced the short yellow knife arc with a visible white Canvas meteor slash that sweeps from the diver's facing direction and remains long enough to inspect.
- Lv.2 now renders two thinner side meteor trails; Lv.3 keeps the slash lingering and adds deterministic twinkling sparkles.
- Direct knife preview now creates the visual effect even when no enemy has been placed, so the sandbox's weapon button can demonstrate the effect without a hidden target prerequisite.
- Static-only verification passed: focused progression tests (17/17), full `npm run check` (90/90), `npm run build`, and `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 76 complete

- Added sandbox enemy behavior: movement tracking, melee contact cadence, rage cooldown scaling, automatic skill cycling, telegraph/cast windows, delayed rescue summons, link protection/healing, venom status damage, ink state, split children, continuous beam zones, knockback, and swept projectile collision.
- Added the same authored chase/attack cadence to the formal play scene, including blocked-cell stopping and telemetry for enemy health, state, facing, and pending skill casts.
- Added regression coverage for chase/contact damage, telegraphed attacks, six-second rescue, venom persistence, coral link protection, and formal play damage callbacks.
- Static-only verification passed: full `npm run check` (100/100 after the workspace's concurrent visor checks were present). Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 77 complete

- Corrected the knife visual contract after static simulation showed that Lv.2/Lv.3 effect objects existed but their side and lingering paths could be missed between frames.
- Lv.2 now keeps two separated, thinner side-meteor paths visible from the first frame and for 1.15 seconds; Lv.3 keeps its main white meteor slash for 4.2 seconds with a persistent glow and deterministic sparkles.
- Static-only verification passed: full `npm run check` (100/100), `npm run build`, and `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 78 complete

- Added a permanent semantic outline language to the real play scene: enemies are red, hazards orange, supplies green, mechanisms blue, and seaweed/coral support objects teal.
- Added first-contact visor identification with a green corner reticle, leader line, category, object name, and typed functional explanation. A guide remains while its first instance is visible, disappears when that instance leaves the viewport, and cannot repeat for that type until a full page refresh creates a new session.
- Covered Cell objects, free-snap objects, edge attachments, conditional gates, and authored enemies. Map changes clear only active callouts while preserving the current session's already-seen types.
- Static-only verification passed: focused discovery checks (3/3), full `npm run check` (100/100), `npm run build`, and `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 79 in progress

- Implemented a separate katana combat/effect contract instead of reusing the knife meteor trails. The katana now performs a short near-range arc slash at roughly two Cell widths.
- Lv.2 marks the next slash after movement as empowered: it changes colour, becomes visibly thicker, and applies double damage once. Lv.3 inherits that state and adds an outward expanding sword-qi effect rendered as only the outer arc; it removes enemy projectiles intersecting that arc.
- Added sandbox rendering, dynamic attack feedback, focused progression coverage, and clarified `GDD/05_內容/武器/武士刀.md`. A pre-existing sandbox enemy-instance tier omission was also repaired because the current link-support regression depended on that field.
- Focused progression tests pass (27/27). Full static check, build, diff check, scoped Git commit, and push remain to be completed. Browser/Playwright validation remains intentionally skipped per user instruction.

## 2026-08-09 — Step 80 complete

- Replaced marker-centred packs with a deterministic map-length distribution: 80% of regular enemies occupy evenly stratified water Cells, while 20% are nearby companions forming occasional small clusters. All spawns remain distinct and preserve the documented Chapter 1 roster progression.
- Added a 216-world-unit player-start safe radius and a 168-unit enemy activation radius, so no regular enemy starts in the opening viewport and distant enemies remain dormant instead of converging on the player from across the map.
- Removed the apparent touch-damage behavior by requiring every damaging enemy action to enter an authored or minimum 0.32-second cast before resolving. Physical sprite overlap alone does not damage the player.
- Added a clickable `OK` control to the lower-right corner of first-contact visor panels. It wins input priority over launch dragging and acknowledges that guide for the rest of the current page session.
- Static-only verification passed: focused enemy/discovery checks (13/13), full `npm run check` (119/119), `npm run build`, and scoped `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 81 complete

- Re-audited the authored Chapter 1 small-enemy skills instead of treating the previous green check as proof: the sandbox now has regression coverage for every Lv.1/Lv.2/Lv.3 encounter family, including spear/scatter projectiles, sniper telegraph, ray cast-position locking, mantis stun, coral healing/linking, delayed beacon assault, mortar spread, dual-core spiral shots, and split descendants.
- Aligned Part 2's runtime population with its current 38 eligible water Cells and guaranteed all three documented Lv.3 Descent elites are introduced even with sparse authored encounter anchors.
- Formal play keeps the same chase, cast-window, direct damage, knockback, and blocked-cell stopping path; the sandbox remains the detailed skill acceptance surface with `render_game_to_text` telemetry.
- Static-only verification passed: focused enemy/progression checks (45/45), full `npm run check` (119/119), `npm run build`, and `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 82 complete

- Connected the katana contract to the formal `play.html` scene instead of leaving it sandbox-only. Every map load now places a deterministic nearby showcase enemy, applies an initial katana slash to its health, and keeps the slash arc (plus Lv.3 outer sword-qi arc) visible after refresh.
- Added formal-play enemy health bars, hit flash feedback, katana telemetry, and Node regression coverage for visible Lv.1 damage, Lv.2 double damage, and persistent Lv.3 outer arc effects.
- Static-only verification passed: full `npm run check` (122/122), `npm run build`, and `git diff --check`. Browser/Playwright validation remains intentionally skipped per user instruction.

## 2026-08-09 — Step 83 in progress

- The user-provided screenshot was identified as the sandbox route: its dashed player interaction circle and yellow selected-enemy ring are sandbox-only, so the previous formal-play fix did not address the visible page.
- Added a sandbox-only refresh showcase that selects katana Lv.1, places a stationary crab 40 px in front of the diver, applies real auto-slash damage, and keeps the initial slash arc visible long enough to inspect. Core simulation defaults remain unchanged for existing tests.
- Static-only verification and scoped Git commit/push remain to be completed. Browser/Playwright validation remains intentionally skipped per user instruction.

## 2026-08-09 — Step 84 complete

- Generated and chroma-keyed `public/assets/editor/weapons/trident.png` as the shared deep-sea trident sprite; Lv.2 and Lv.3 stay data-driven so their size, glow, trail and burst treatment can be tuned without a second source image.
- Connected trident Lv.1–3 to the sandbox projectile pipeline: a stationary diver charges for 1.0 second before automatic firing, Lv.2 applies a 1.35-second stun, and Lv.3 emits a three-projectile spread with a longer glow and burst impact.
- Added Canvas sprite/trail/impact rendering, stationary-charge telemetry, projectile details in `render_game_to_text`, and regression tests for preview firing, one-second auto-fire, stun, and the Lv.3 burst.
- Static-only verification passed: `npm run check` (126/126), `npm run build`, and `git diff --check`. Browser/Playwright validation remains intentionally skipped per user instruction.

## 2026-08-09 — Step 85 complete

- Used image generation to create and chroma-key `public/assets/editor/weapons/abyssal-katana.png`: a transparent deep-sea katana with a weathered gunmetal blade, cyan bioluminescent edge, oxidized bronze pressure-ring guard, and navy wrapped grip.
- Replaced the Lv.1/Lv.2 giant white katana arc with the real katana sprite rotating clockwise around the diver's grip. Five or more historical blade poses trail behind it, with opacity decreasing as their angular distance from the current blade increases.
- Kept the combat range, damage, cooldown, and Lv.2 post-movement double-damage rules. Lv.3 alone now emits the former white arc as a separate forward-travelling shockwave that can destroy enemy projectiles.
- Synchronized formal play and sandbox rendering, updated the existing katana GDD and regression contracts, and verified the generated PNG has a real alpha channel. Static-only verification passed: focused katana/progression checks (44/44), full `npm run check` (126/126), `npm run build`, and `git diff --check`. Browser/Playwright validation remains prohibited by user instruction.

## 2026-08-09 — Step 86 in progress

- Third-part formal play now defaults its katana showcase to Lv.3 so the outward white sword-qi projectile is visible immediately; `?katanaLevel=1/2/3` remains an explicit override.
- Katana damage now applies to every active enemy inside the weapon radius, while preserving one swing animation and one damage instance per enemy.
- Added distinct katana Lv.2 gold / empowered pink and Lv.3 violet colour contracts. Knife Lv.1/Lv.2/Lv.3 now expose cyan / amber / violet trail, glow, sparkle, and area colours.
- Static-only verification passed: focused katana/progression checks (45/45), full `npm run check` (127/127), `npm run build`, and `git diff --check`. Browser/Playwright validation remains intentionally skipped by user instruction.

## 2026-08-09 — Step 87 complete

- Simplified the sandbox information hierarchy: removed the right-side player-status and skill-event telemetry panel, removed the visible infinite oxygen/energy toggle, and renamed the reset action to `重置玩家`.
- The sandbox now keeps oxygen and energy unlimited internally so combat previews are not blocked by resource management, while the central arena uses the freed right-side width through a two-column layout.
- Static-only verification passed: removed-DOM reference scan, `npm run check` (127/127), `npm run build`, and no browser/Playwright validation per user instruction.

## 2026-08-09 — Step 88 complete

- Corrected the sandbox Build contract to expose three weapon slots and three passive slots with the GDD-fixed Lv.3／Lv.2／Lv.1 caps; the first weapon slot remains the permanent knife slot, while the sandbox opens with a full 3/2/1 preview Build.
- Kept the legacy single-weapon `setSandboxBuild` call shape for focused weapon tests, while adding normalized multi-slot input for the actual Build panel and active-slot switching.
- Removed defeated enemies from the sandbox scene immediately after rewards and split handling, leaving only the short defeat effect and stationary experience orb instead of a blocking corpse.
- Added regression coverage for normalized weapon/passive slots and corpse removal; focused physics/progression tests passed 88/88. Full static verification passed: `npm run check` (128/128), `npm run build`, and `git diff --check`; browser/Playwright validation remains intentionally skipped.

## 2026-08-09 — Step 89 complete

- Added the formal visor HUD frame to the enemy validation sandbox, including the side O₂ and ENERGY readouts plus the bottom HP core. O₂ and ENERGY are rendered as full `∞ 無限` gauges, while HP continues to show actual combat damage.
- Changed the sandbox's hidden physics field from L1 to L0. Launches now preserve the player's chosen direction without a gravity-induced vertical drift; the formal play map's gravity rules remain unchanged.
- Updated sandbox telemetry and release status to expose `gravity: "zero"` and `zeroGravity: true`, and added regression coverage for neutral cells, unlimited resources, preserved vertical position, and horizontal momentum.
- Static-only verification passed: full `npm run check` (130/130), `npm run build`, and `git diff --check`; browser and Playwright remain intentionally skipped by user instruction.

## 2026-08-09 — Step 90 complete

- Reduced sandbox knife light pollution and frame cost: knife trails now use bounded normal alpha compositing, a maximum 8px main glow／4px side glow, six taper segments, six Lv.3 sparkle draws, and a dimmer six-spoke stationary area effect.
- Moved the three active weapon buttons beside the attack controls. The first slot remains the GDD-required permanent knife slot, while slots 2 and 3 can now be selected by click or the `1`／`2`／`3` shortcuts; each button exposes its current level and pressed state.
- Added regression coverage for activating every authored weapon slot and for the Lv.3 knife visual budget. Static-only verification passed: full `npm run check` (132/132), `npm run build`, and `git diff --check`; browser／Playwright validation remains intentionally skipped by user instruction.

## 2026-08-09 — Step 91 complete

- 沙盒入口現在會以空 Build 開始：武器與被動皆未裝備；三個武器槽都可選任何武器或「未裝備」，主槽不再強制小刀。正式流程仍保留初始小刀規則。
- 將武器與被動控制整合成主槽／副槽／副副槽三欄群組，並保留各欄 Lv.3／Lv.2／Lv.1 上限與空槽狀態；已裝備武器仍可切換檢視焦點並同時測試。
- 沙盒零重力改為真正的慣性模式：跳過重力、洋流、微流、特殊加速度與不等水阻，保持選定發射向量，不再出現左上發射時額外向上的偏差；邊界與碰撞仍由正式物理處理。
- 新增空 Build／非小刀主槽與精準發射向量回歸測試。靜態 `npm run check` 通過（138/138），`npm run build` 與 `git diff --check` 也通過；瀏覽器／Playwright 依指示不執行。

## 2026-08-09 — Step 92 complete

- 明確化沙盒攻擊控制文案為「同時使用已裝備武器」，避免把按鈕誤解成只測試主槽；按鈕與空白鍵都會呼叫三槽同時攻擊流程，1／2／3 只切換檢視焦點。
- 針對副槽三叉戟與副副槽武士刀保留獨立自動流程：三叉戟靜止約 1 秒後發射，武士刀在距離內自動揮擊，兩者不再依賴主槽是否是小刀。
- 靜態驗證通過：`npm run check`（138/138）、`npm run build`、`git diff --check`；瀏覽器／Playwright 依指示不執行。

## 2026-08-09 — Step 93 complete

- 為三個武器槽加入明確的「試射」入口；試射會先套用目前欄位選擇，再只發動該槽武器，讓三叉戟與輕量機槍不必依賴猜測總攻擊按鈕。
- 輕量機槍彈體繪製改用通用矩形路徑，不再依賴 `CanvasRenderingContext2D.roundRect`；三叉戟保留亮色武器本體、拖尾與等級散射特效。
- 靜態驗證通過：`npm run check`（138/138）、`npm run build`、`git diff --check`；瀏覽器／Playwright 依指示不執行。

## 2026-08-09 — Step 94 in progress

- 將 24 張玩家武器／被動 Logo 接入正式遊玩頁 HUD 的六個八邊形槽位：左側三格為主動武器，右側三格為被動能力；正式初始 Build 顯示小刀 Lv.1，其餘槽位保持空白。
- 新增 HUD icon 路徑與六槽位資料契約，讓未來升級只需更換 loadout，不需改 HTML 位置；靜態驗證與 Git 提交待本步完成後執行。

## 2026-08-09 — Step 95 in progress

- 將同一套六格 Logo HUD 接入敵人驗收沙盒；左側三格即時讀取 `state.build.weapons`，右側三格即時讀取 `state.build.passives`。
- 沙盒空 Build 時槽位維持空白；套用 Build 或升級後，HUD 與沙盒實際已裝備資料同步，並把 `hudLoadout` 納入沙盒文字狀態輸出。

## 2026-08-09 — Step 95 complete

- 正式遊玩頁的 canvas 改放進 HUD 鏡片內框專用 viewport，依 HUD 素材透明區縮小並保持 1200×680 原始比例；畫面不再繪製到兩側資源模組或底部 HP 核心的後方。
- 保留 canvas 的實際 DOM 矩形作為拖曳／彈射座標基準，縮放只改可視版面，不改遊戲物理與輸入方向；沙盒驗收頁維持原有圖層配置。
- 靜態驗證通過：`npm run check`（139/139）、`npm run build`、`git diff --check`；瀏覽器／Playwright 依指示不執行。

## 2026-08-09 — Step 96 complete

- 根據實際 HUD 截圖修正過度保守的鏡片安全區：canvas 由 `inset: 14.5% 13.6% 29.5%` 放大為 `inset: 9% 8% 15%`，不再縮成中央小矩形。
- 現在遊戲畫面接近整個鏡片開口；只保留外框邊界，底部 HP 核心維持作為 HUD 疊層，不再用它把整個可玩畫面壓縮掉。
- 靜態驗證通過：`npm run check`（140/140）、`npm run build`、`git diff --check`；瀏覽器／Playwright 依指示不執行。

## 2026-08-09 — Step 97 complete

- 移除正式遊玩頁進場時強制建立的武士刀展示斬擊與敵人搬移；玩家進入地圖時不再看到不必要的大劍，事件紀錄改為說明「範圍內有敵人才會揮刀」。
- 武士刀 Lv.1／Lv.2／Lv.3 的刀身長度、厚度與握柄支點縮為原本 50%，保留傷害、攻擊範圍與各等級能力資料。
- 武士刀沒有活著且位於攻擊範圍內的敵人時回傳 `noTarget`，不扣冷卻、不建立刀光、不造成傷害；重置玩家時也會清空上一輪武士刀效果。
- 新增近距離攻擊與無目標待命回歸測試，並完成 `npm run check`、`npm run build`、`git diff --check`；瀏覽器／Playwright 依指示不執行。

## 2026-08-09 — Step 98 complete

- 修正沙盒武器選擇與實際 Build 不同步的斷層：武器與被動下拉選單現在選擇後立即套用，移除容易讓人誤以為已裝備的額外「套用 Build」步驟。
- 三叉戟顯示靜止蓄能倒數、移動／拉射暫停原因；輕量機槍顯示自動六連射進度與下一輪冷卻。相同狀態也寫入 `render_game_to_text` 的 `autoWeapons` 欄位。
- 新增自動發射狀態與頁面接線回歸測試；瀏覽器／Playwright 依專案指示不執行，改以純 Node 狀態模擬、DOM 原始碼契約、完整靜態檢查與 Vite 建置驗證。

## 2026-08-09 — Step 99 complete

- 補齊正式遊玩頁已引用、卻尚未進入 Git 的 HUD 槽位標籤契約，避免遠端乾淨 checkout 因缺少 `getPlayerHudSlotLabel` export 而無法載入。
- 正式遊玩與沙盒共用武器／被動分組標籤、每格 `Level N · 名稱`，並把主槽放在最靠近中央 HP 的位置。
- 完整靜態驗證通過：`npm run check`（144/144）、`npm run build`、`git diff --check`；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 100 complete

- 沙盒所有自動近戰碰觸先進入至少 0.32 秒技能讀條，玩家與敵人本體重疊的第一幀不再直接扣血；手動技能驗收仍可直接觸發沒有 authored cast 的投射技能。
- 小刀移動路徑傷害改為讀取整個已裝備 Build，不再被目前檢視焦點槽位關閉；三叉戟／機槍等投射武器也不再被誤當作玩家身體碰撞傷害。
- 三叉戟 Lv.3 依既有 GDD 改回單發，命中後縮短下一次冷卻；輕量機槍 GDD 則同步較晚確認的 Lv.2 描邊後三發與 Lv.3 六色稜彩決策。
- 氧循環器重新對齊內容文件：Lv.1 氧氣倒數減耗 10%、Lv.2 最大氧氣 120%、Lv.3 只在低於 50% 氧氣時降低體力成本並提供減傷。
- 相關純 Node 回歸測試通過，Vite build 與限定檔案 `git diff --check` 通過；完整 check 當下僅被並行修復中的 Part 3 portal 數量舊斷言阻擋，並非本批功能失敗。未執行瀏覽器／Playwright。

## 2026-08-09 — Step 101 complete

- 移除變異蝦蛄與變異鸚鵡螺三組技能 GIF 的邊界連通黑幕，public 與 GDD 六份副本保持一致；逐幀透明檢查確認黑幕為 0，角色內部深色細節仍保留。
- 敵人圖鑑接上四名已有素材的 Mini Boss 自然漂浮畫面；沒有素材的最終 Boss 繼續誠實顯示待補，不偽造技能動畫。
- 世界圖鑑的四武器、四被動共 24 個等級卡改用既有 HUD icon，武器卡新增沙盒驗收入口；地圖條目明確區分 29 種放置語彙與 27 個唯一物件。
- 新增素材路徑、圖鑑覆蓋、透明背景與黑幕的靜態 gate；focused asset tests 6/6 與 Vite build 通過。完整 check 當下僅剩並行地圖批次的舊 portal 數量斷言，未執行瀏覽器／Playwright。

## 2026-08-09 — Step 102 complete

- 新增正式遊玩的純狀態戰鬥核心；新局只有永久保留的小刀 Lv.1，經驗光點停在敵人死亡位置，靠近拾取後才進入既有的分類與二選一升級流程。
- 小刀改為沿玩家移動路徑穿透全部敵人，Lv.2 加入兩側 70% 傷害軌跡，Lv.3 靜止時形成近身範圍；三叉戟會在停止移動且未拉射滿一秒後自動單發，Lv.2 暈眩、Lv.3 命中縮短冷卻。
- 輕量機槍自動鎖定一次方向完成六發，整輪只扣一次能量；Lv.2 僅後三發描邊，Lv.3 六發使用六色稜彩，沒有舊版雙傷或爆炸漂移。
- 建立正式 play 可用的 Build 同步、死亡獎勵、經驗拾取、升級、投射物 swept hit 與可序列化 render state API；相關 Node 測試 67/67 通過，未執行瀏覽器／Playwright。

## 2026-08-09 — Step 103 complete

- 三張下沉篇地圖加入位於末段且從起點可達的 `metadata.exitCellKey`；第三部分修為 portal-aware 雙向路線，起點能抵達 Mini Boss、Boss 與終點，38 條 multiPortal 全部有互相指回的有效目標。
- Part 2 配置稜鏡蟹守衛，Part 3 配置潮律鸚鵡螺與深淵抹香鯨；普通小怪仍維持 40／40／48，特殊敵人額外生成，不會吃掉原本的小怪名額。
- 第三部分同一格重複的托里拆利空間已去重；最終 Boss 沒有素材時使用誠實的程式 fallback，不借用其他敵人的圖冒充。
- 地圖與敵人 focused tests 21/21、完整 `npm run check` 155/155、Vite build 與 `git diff --check` 均通過；未執行瀏覽器／Playwright。

## 2026-08-09 — Step 104 complete

- 正式遊玩由第一部分開始，抵達各圖 `exitCellKey` 後依序銜接第二、第三部分並保留生命、資源、EXP 與 Build；第三部分必須擊敗實際生成的深淵抹香鯨再抵達終點才完成。
- 正式 HUD、經驗條與六個 Build 槽改以同一份 progression 為真相；小怪死亡留下靜止經驗光點，玩家靠近拾取後顯示分類與二選一升級，不再硬寫 Lv.1／EXP 0 或暗中固定施放武士刀。
- 小刀、武士刀、三叉戟與輕量機槍只在真正裝備時自動運作，正式地圖會繪製刀痕、刀身殘影、三叉戟、六連射子彈、命中特效與珊瑚生命連結保護。
- 正式敵技補上暈眩、鎖點後一秒自爆、具有飛行時間與 swept collision 的敵彈、迫擊鎖點區域、幼年海馬六秒召喚與珊瑚背海馬連結／治療；尚未完整模擬的 Boss 技能只顯示安全 telegraph，不再無條件隔空扣血。
- 建立全部地圖物件與 Edge 的正式視覺契約；Button 使用程式 glyph、潮流使用青藍箭頭、Barrier 使用橘色雙欄，不再引用不存在的 `button.png` 或拿紅色 Spike 冒充潮流；墨水區素材與限縮視野效果也接入。
- 完整 `npm run check` 188/188、Vite build、`git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 105 complete

- 正式遊玩補齊稜鏡巨蟹、潮律鸚鵡螺與深淵抹香鯨的 authored 技能 runtime：召喚、資源抽取、折射主光束、局部重力場、回程散彈、潮汐法則、獻祭回血／傷害疊層、重建回血、深淵化身、幼體型態、重力支配與腐化氧氣。
- Mini Boss／Boss 被動實際進入傷害管線：深海甲殼 0.75 承傷、五階段七秒潮汐護盾、半血深淵覺醒的移速／彈速／冷卻與 18 點荊棘反擊；不再只有資料定義。
- 普通敵人出生候選改用 portal／gate-aware 可達集合；三張圖的普通敵人不再生於永遠到不了的水域。Part 3 另將 2 個死物件與 8 條死 Edge 移回可玩路徑，並同步回地圖生成器。
- 正式地圖補上水草 E 鍵附著、Checkpoint 觸碰入口去重、永久死亡不可 R 鍵復活，並完整消費旋轉剃刀軸／數量、按鈕 pressed 狀態、潮流方向、Boss rules／summons／zones 視覺契約。
- 兩個遊玩入口改從 Part 1 進入，首頁與沙盒文案不再誤稱範本地圖或要求重新套用 Build；圖鑑只對已有素材承諾演示。
- 重跑 `npm run generate:maps` 成功，完整 `npm run check` 203/203、Vite build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 106 complete

- 使用內建 imagegen 依既有角色母圖完成四隻 Mini Boss 的 12 組技能動畫，並為深淵抹香鯨建立統一角色母圖、自然漂浮與六個戰場技能，共 19 組動畫、114 張 512×512 透明獨立 PNG。
- 每組同步產出 GDD GIF 預覽、正式 public GIF 與循環不重置的殘影 WebP；去背改用提高門檻的色相限定柔邊處理，修掉第一輪抽查發現的半透明黑霧，透明／黑幕 gate 通過。
- 世界圖鑑五隻 Boss 的 18 個 attack id 已全部接到各自技能動畫；正式遊玩中的深淵抹香鯨也改用自己的自然漂浮殘影素材，不再使用程式占位或借用其他敵人。
- GDD 五份既有需求文件加入可點擊的已完成素材索引，並明確規定每個技能各用一組連續六幀，不再把不同技能塞進同一組。
- 靜態驗證通過：19 GIF／19 WebP 均為六幀、素材測試 7/7、完整 `npm run check` 210/210、`npm run build`、`git diff --check`；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 106 complete

- 新增氧氣／能量共同驅動的生命恢復：兩者都達 60% 時回復 2 HP/s，兩者都達 80% 時改為 5 HP/s；使用氧氣實際上限計算比例，生命不超過 100，死亡狀態不會自行復活。
- 門檻與速率集中於 `RESOURCE_HEALTH_RECOVERY` 可調整資料契約，正式物理與沙盒共用；毒素測試改用低資源情境，避免沙盒無限資源的快速回血掩蓋持續傷害驗證。
- focused physics/progression tests 103/103、完整 `npm run check` 204/204 通過；Vite build 與 `git diff --check` 也通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 107 complete

- 所有敵人對玩家的最終生命傷害統一降為原始 authored 數值的 40%；正式敵技、沙盒敵技、毒素與 Boss 荊棘反傷共用同一資料契約，環境傷害維持原值。
- 首次接觸資訊卡改為單張 active 加 pending queue；整張卡片都可點擊關閉，按下後才顯示下一個仍在畫面內的目標，renderer 最多繪製一張。
- focused discovery／formal enemy／combat／katana／sandbox tests 101/101、完整 `npm run check` 206/206 通過；Vite build 與 `git diff --check` 也通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 108 complete

- 正式遊玩與沙盒敵人共用水平朝向規則：素材原始朝左，向右移動時水平翻面，停止後保留最後朝向。
- 正式遊玩中的移動型敵人會在直線路徑遇到阻擋 Cell、封閉 Edge 或錯誤水層時選擇可通行的側向路線；三種 authored 定點支援／砲台型敵人維持不移動。
- 所有敵方投射物速度降為 50%；投射物命中傷害在全敵人 40% 倍率後再減半，最終為原始傷害 20%，不影響玩家武器與非子彈敵技。
- focused enemy／sandbox／formal page tests 85/85、完整 `npm run check` 214/214 通過；Vite build 與 `git diff --check` 待本步收尾記錄。依專案規則不執行瀏覽器／Playwright。

## 2026-08-09 — Step 109 complete

- 正式遊玩不再固定繪製 `enemy.visual`；每隻敵人改以 runtime 的 `pendingSkill`、`suicideCharge`與 `lastResolvedSkill` 選擇觀察圖鑑中同 attack id 的動畫。
- 待機、追逐與移動狀態都會循環自然漂浮；施放技能時改為該技能專用殘影素材，結算後保留完整六幀 1.44 秒，重複施放會以每隻敵人獨立的 playback key 重新播放。
- 驗收沙盒同步修正技能動畫太早回 idle 與結算時二次重置的問題；技能從讀條到結算使用同一段完整動畫。
- focused 正式敵人／正式頁面／沙盒測試 36/36、完整 `npm run check` 218/218、Vite build 與 scoped `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 110 complete

- 修正 Step 109 只切換動畫 WebP 路徑、卻無法保證 Canvas 實際推進畫格的缺口；正式遊玩不再依賴 GIF／WebP 的瀏覽器動畫解碼。
- 42 組正式敵人自然漂浮／技能動畫各抽成六張獨立透明 PNG，共 252 張；renderer 依遊戲時間每 0.18 秒明確切換畫格，移動沿用自然漂浮，攻擊從對應技能第一幀開始。
- 靜態回歸逐組檢查六張畫格存在且至少兩張雜湊不同；252 張透明／黑幕 gate 全數通過。focused 34/34、完整 `npm run check` 220/220、Vite build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 111 complete

- 中心物件、自由放置物件與所有非空 Edge 共用固定 30 px 尺寸；正式遊玩、首頁地圖預覽、地圖編輯器、三張下沉地圖 JSON 與舊地圖載入正規化全部對齊。視覺尺寸不再改變既有碰撞足跡，避免相鄰六邊形互相誤觸。
- 正式 HUD 將永久嘗試次數與 0–100 HP 分離，章節上方固定顯示 `ATTEMPT 3/3`；死亡回最近 Checkpoint 後顯示 `ATTEMPT 2/3`，不再以「失去一條命」對玩家描述。
- 下沉篇第一部分新增純黑開場：Attempt 先出現、HUD 淡入，再用橫向橢圓完成三次睜閉眼與最後完全睜眼；約 5.85 秒演出期間暫停氧氣、敵人與玩家模擬，減少動態偏好會縮短演出。
- focused 物件／地圖／Attempt／正式頁面測試 80/80、完整 `npm run check` 230/230、Vite build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 112 complete

- 依使用者校正 Attempt 分隔格式：由錯誤的 `ATTEMPT 3-3` 改為 `ATTEMPT 3/3`，死亡後同步顯示 `ATTEMPT 2/3`；初始 HTML、runtime 狀態與回歸測試使用同一格式。
- focused Attempt／正式頁面測試 14/14、完整 `npm run check` 229/229、Vite build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 112 complete

- 首頁移除舊導覽、中文大標、功能卡片、音樂面板與地圖巡覽，只保留暗化後的 0～5 秒深海往返影片、中央頭盔與面罩內的 `THIRST FOR OXYGEN` Logo。
- 新增正面、18°、38° 三張透明頭盔，並以既有三分之四側面素材作為第四幀；點擊畫面任意位置或按 Enter／Space，會在 1.25 秒內逐幀轉向並由 1.1 倍縮至 0.9 倍。
- Logo 以獨立透明圖層放在面罩內，轉向時同步移動與縮放，不把文字重新交給生成器變形；所有新 PNG 皆確認 RGBA 與透明四角。
- 首頁專屬測試 5/5、完整 `npm run check` 229/229、Vite build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 113 complete

- 首頁正面頭盔由 1.1 倍縮為 0.88 倍，精確減少 20%；轉向完成後縮至 0.72 倍並右移 40vw，讓側面頭盔靠近右側且後緣僅輕微超出畫面。
- 深海背景影片的透明度由 0.42 提高至 0.76、亮度由 0.42 提高至 0.68，同時減輕外圍黑色遮罩，讓 0～5 秒往返動畫重新可辨識。
- `THIRST FOR OXYGEN` Logo 轉向前仍置於正面面罩；轉向時移到左側並解除圓形裁切，完成後顯示開始遊玩、世界圖鑑、敵人沙盒與地圖編輯器四個選單入口。
- 選單在側面狀態前保持 `inert`，轉向完成後才開放鍵盤與滑鼠操作；首頁專屬測試 5/5、完整 `npm run check` 229/229、Vite build 與 `git diff --check` 均通過，未執行瀏覽器／Playwright。

## 2026-08-09 — Step 114 complete

- 移動型敵人新增「出生水域巡游 → 開闊水域重新定位 → 短暫逗留」循環；未警戒時不再原地凍結，遠程敵人進入射程後也不再固定卡在玩家附近或底端。路徑會優先選擇鄰接水域較多的可達 Cell，轉向時保留原速度並平滑彎折；定點型支援敵人仍維持不移動。
- 求援幼年海馬召喚出的移動敵人套用同一巡游規則；正式遊玩 telemetry 新增 `movementGoal`，可辨識 home／engage／combat 與 travel／pause 狀態。驗收沙盒同步使用同一組巡游節奏與平滑轉向。
- 獅子魚砲手的毒刺直射維持單發、高傷害與 3 秒毒性，基礎彈速 380；棘刺散射固定五發、單發傷害較低、不帶毒，基礎彈速改為 190，正式與沙盒倍率套用後仍保持精確 2:1。戰鬥文件與精靈圖需求同步校正為五發。
- focused 敵人／移動／沙盒測試 90/90、完整 `npm run check` 235/235、Vite build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 114 complete

- 首頁側面頭盔由右移 40vw 改為 27vw，完成轉向後置於畫面右半部中央；面罩重新播放下沉篇第一至第三部分的正式地圖，保留凸面暗角與玻璃反光。
- 深海背景加入螃蟹守衛、獅子魚砲手與弧潮獵鰩；三者沿用正式遊戲各六幀自然漂浮素材，點擊後播放各自六幀技能動畫，再回到漂浮狀態。
- 游標／手指位置會形成中央明亮、外緣漸暗的手電筒光圈；敵人只在光圈掃過時顯現。首頁主選單音樂於第一次點擊或 Enter／Space 後啟動，並避免同一操作重複播放。
- 首頁專屬測試 7/7、Vite build 與 scoped `git diff --check` 通過；完整測試 230/231，唯一失敗為工作區既有的第一部分托里拆利空間數量 2／預期 4，未修改該地圖。依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 115 complete

- 使用新提供的 1280×720 Dreamina 深海影片取代首頁背景；保留前 5 秒並以 0.67 倍速度輸出正播＋倒播的 14.93 秒無縫循環，原始影片保持不變。
- 手電筒可發現的小怪由 3 隻提高為 8 隻，使用八種不同的正式敵人素材。所有敵人以 32 秒週期、八等分相位持續由左向右游動，分布於 8%～76% 畫面高度；靜態驗算的任一取樣時間至少有 6 隻仍在可見水平範圍。
- 初始正面頭盔新增 `Tap anywhere to begin`；轉向完成後側面頭盔下移到約四分之三畫面高度。點擊頭盔會短暫顯示 0.95 秒 `NO SIGNAL` 雜訊，再回到持續播放中的正式遊戲地圖。
- 首頁專屬測試 9/9、完整 `npm run check` 237/237、Vite build 與 scoped `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 116 complete

- 首頁頭盔金屬由明亮高彩度改為亮度 50%、低飽和、帶灰的深藍色調；側面光暈同步降至 24%，降低與深海岩石背景之間的色差。
- 面罩內正式地圖同步改為亮度 48%、低飽和深藍灰，玻璃反光與邊緣光也由亮青色改為較弱的灰藍色；側面頭盔由下移 28vh 收回至 20vh，中心約落在畫面 70% 高度。
- 八隻首頁動物保持素材原本的左向朝向，改由畫面右側游往左側；分成 26、34、44 秒三組速度。連續 10 分鐘逐秒驗算皆至少有 5 隻位於可見水平範圍，不會因速度差一起離場。
- 首頁專屬測試 9/9、完整 `npm run check` 237/237、Vite build 與 scoped `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 118 complete

- 新增上升篇第一至第三部分生成流程：完整鏡像下沉篇 Cell、Edge、條件門、按鈕目標、多邊傳送門、Actor 與 Boss，玩家從底部出生並由頂部出口完成。
- 上升篇以同部位的強化版為方向：敵人目標數 48／56／64，墨水迷霧 2／5／8，逐部追加尖刺、潮流與屏障；氧氣、托里拆利空間與 Checkpoint 逐部減少。
- 六角格鏡像依 odd-r 高度採合法圖形轉換：偶數高度使用 180 度反轉，奇數高度使用垂直反射，避免產生非相鄰 Edge。
- 正式遊玩地圖選單加入下沉／上升六張地圖；上升篇三段連續保留生命、資源、EXP 與 Build，並自動切換上升音樂、ASCENT 讀數與上升篇完成資訊。首頁預覽路線資料也不再把上升篇標為缺席。
- 地圖與正式遊玩 focused tests 66/66、完整 `npm run check` 241/241、Vite build 與 scoped `git diff --check` 均通過；三張上升篇 JSON 已確認進入 production bundle。依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 117 complete

- 正面面罩內的 `THIRST FOR OXYGEN` Logo 下移 3%；頭盔轉到側面後 Logo 回到主選單原本的置中位置，避免影響選單排版。
- 整個頭盔容器新增同步呼吸感，金屬、面罩地圖、反光與點擊區一起縮放與微幅上浮：正面每 5.6 秒循環、最大約 0.8%，側面每 6.2 秒循環、最大約 0.4%。四幀轉向期間仍由原本轉向動畫接管。
- `prefers-reduced-motion` 會關閉正面與側面呼吸，保留可讀性與既有快速轉向。首頁專屬測試 9/9、完整 `npm run check` 237/237、Vite build 與 scoped `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 119 complete

- 新增全遊戲共用語言設定，預設英文並以 `thirst-for-oxygen-language` 儲存在本機；首頁主選單加入第 05 項 Settings，可即時切換 English／繁體中文，且具備 Escape、背景關閉、鍵盤焦點循環與焦點回復。
- 正式遊玩、敵人沙盒、世界圖鑑與地圖編輯器全部接上相同設定。正式遊玩 Settings 亦可切換語言；戰鬥狀態、物理事件、HUD／Canvas 標示、工具與 Inspector 等動態文字均跟隨語言，切換不會重置 Build、關卡或編輯器狀態。
- 世界圖鑑英文版完整涵蓋 19 種敵人與技能／生態／Lore、29 個放置項、4 把武器各 3 級與 4 個被動各 3 級；繁中資料完整保留。英文資料 no-CJK gate、完整 `npm run check` 258/258、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 120 complete

- 修正英文語言層讓 Play 卡在純黑喚醒畫面的回歸：先前 MutationObserver 會和每幀 HUD／事件列表重建互相觸發，造成大量連鎖 microtask；現在改為將同一幀的文字異動合併，下一個 animation frame 僅處理一次。
- 新增 HUD 動態文字批次回歸，確認 Observer 當下不改寫、不阻塞，下一幀才把 `速度 12` 更新成 `SPEED 12`；繁中來源與同頁切換仍保留。
- focused 語言／喚醒／正式 Play 測試 18/18 通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 121 complete

- 新增正式 Resonance 擦彈系統：玩家持續貼近敵人本體或該敵人的子彈時，敵人血條下方的綠色能量條會累積；本體每秒 7、子彈每秒 11，離開後有 0.28 秒寬限，接著每秒衰減 18。一般敵人依 Tier 需要 110～130，共鳴 Mini Boss 需要 150、最終 Boss 需要 180，因此選擇共鳴明確比直接擊殺更需要持續承擔風險。
- 共鳴完成後只中立化該敵人個體：立刻停止追擊、技能與移動，清除它已發出的子彈、區域、規則與召喚排程；玩家的所有正式武器與武士刀也不再把它當目標。敵人不跟隨玩家、不攻擊玩家，也不轉為攻擊其他海洋生物。
- 19 種已定義敵人各自擁有可調整的永久 Buff 合約，涵蓋氧氣上限／消耗、武器傷害／能耗、彈射速度／能耗、減傷、回血與資源回生；同物種只解鎖一次 Buff，但後續個體仍可被中立化。
- 下沉篇第三部分完成後會保留同一個 actor、生命／資源、EXP、Build 與 Resonance 狀態，自動進入上升篇第一部分；共鳴中立的最終 Boss 也視為通關，無須再殺死它。
- `render_game_to_text` 與正式戰鬥狀態會回報已解鎖 Buff、各敵人的進度／需求／來源／中立狀態。針對性 Resonance、戰鬥、流程、Play 頁與物理測試 126/126，Vite production build 與 `git diff --check` 通過；依專案規則未執行瀏覽器／Playwright。
- Resonance 的跨篇章提示、完成訊息、19 個 Buff 名稱與效果敘述已補齊英文動態翻譯，預設英文介面不會混入繁中；語言／Play focused tests 15/15 通過。

## 2026-08-09 — Step 122 complete

- Resonance 難度明確拆成近戰／遠程：近戰依 Tier 只需 40／45／55／65，且本體貼近每秒累積 11，約 4～6 秒完成；遠程需要 90／100／115，Mini Boss 145、最終 Boss 170，本體每秒 8、子彈擦彈每秒 12，至少約 8～14 秒。
- Buff 改為每物種有限疊層。爆腹燈籠魚可疊 3 層，每層減傷 3%，三層採加法後精確為 9%；一般能力依強度上限 2～3 層，所有變異、Mini Boss 與最終 Boss 強力 Buff 上限 1 層。超過上限仍可中立化該個體，但不再增加 Buff。
- 共鳴敵人明確排除於正式 EXP 掉落流程，即使其他系統之後誤把它標成擊敗，也不會產生經驗光點。
- LEVEL 讀數現在可點擊開啟永久 Resonance Buff 面板，列出總層數、近戰／遠程類型、每個 Buff 的目前層數／上限與每層效果；支援按鈕關閉與 Escape，繁中／英文動態文字均完整。
- 完整 `npm run check` 272/272、Vite production build 與 `git diff --check` 通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 122 complete

- 移除首頁 Settings 選單列的整圈白色焦點框，改用左側 3px 光條保留鍵盤定位；同時清除冒險頭盔隱藏互動區的大型青色橢圓框，焦點回饋改為面罩內極淡的亮度。
- 新增首頁樣式回歸測試；完整 `npm run check` 269/269 與 production build 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-09 — Step 123 complete

- Start Game 改為 15.1 秒電影式載入轉場：Logo／主選單淡出並向左退場，新增的含聲影片全螢幕播放，底部以真實完成數顯示 328 份正式 Play 素材的載入進度；影片與素材都完成後才進入遊戲，個別素材失敗會明示備援數量而不永久卡住。
- 正式 Play 與首頁共用 `play-preload.js` 清單，涵蓋玩家動畫、敵人自然漂浮與技能幀、地圖物件、地形、武器、HUD 圖示與下沉篇第一部分地圖；六張正式地圖也改用 Vite production-safe URL。
- 首頁往返影片重新封裝為保留 AAC 立體聲的 14.93 秒版本；玩家第一次互動後以 0.82 音量解除靜音，載入影片保留原始環境聲並以 0.9 音量播放，主選單音樂不被強制停止。
- 新增 6 項載入／音訊契約測試；完整 `npm run check` 278/278、Vite production build、兩支影片 AAC 雙聲道檢查與 `git diff --check` 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 124 complete

- 首頁正面 Logo 與標題整體下移，盡量收進頭盔面罩；取消 NO SIGNAL 花屏，改回乾淨的深色面罩。
- 正面背景不再被照亮或變清楚；白色光圈改為沿頭盔透明輪廓直接發光，以亮邊、柔光與霧散三層形成真正的白色霧光，而非手電筒效果。
- Start Game 載入影片由第 3 秒開始，影片與 328 份正式遊戲素材同步載入；Logo／選單保持在影片上層並以 900ms 淡出、模糊與左移退場。
- 載入進度新增 12 秒視覺節奏限制：顯示比例取實際素材進度與時間進度的較小值，快取再快也不會提前顯示 100%，素材完成時約在影片結尾抵達 100%；真正較慢的載入仍以實際完成為準。
- 首頁 focused tests 19/19、完整 `npm run check` 281/281、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 125 complete

- 編輯器、驗收沙盒與世界圖鑑新增共用 `attachMenuMusic`，使用首頁相同的 `main-menu.mp3`、75 秒起始位置與既有音量設定。
- 三個頁面載入時先嘗試自動播放；若瀏覽器的自動播放政策阻擋，第一次點擊或 Enter／Space 會解鎖，不會因政策限制而永久無聲。
- 音樂啟動器集中在 `src/music.js`，保留原本 Play 頁的曲目切換與音樂控制，不重複建立各頁自己的音訊邏輯。
- 音樂入口 focused tests 2/2、完整 `npm run check`、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 126 complete

- LEVEL／EXP HUD 移除整張外框卡片，改成單一扁平資訊列；經驗條加寬並保留實際 EXP 收集時的填充更新。
- Resonance Buff 檢視入口移到 EXP 進度條本身：點擊或鍵盤聚焦進度條即可開啟 Buff 面板，取消額外的外層可點擊框。
- focused Play HUD tests 13/13、Vite production build 與本次檔案 `git diff --check` 通過；完整 `npm run check` 另有兩個既有非本次範圍失敗：動態英文翻譯混入中文，以及沙盒燈籠魚技能執行契約；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 124 complete

- 修正正式 Play 進場後只剩地圖、HUD 與玩家消失且無法操作的啟動回歸：Resonance／Level 檢視現在是可選附加介面，節點不同步時不再中斷 `setupWorld` 與每幀模擬。
- Play HTML 改為預設顯示 HUD，成功建立地圖、玩家、攝影機並完成首次 HUD 更新後才隱藏載入遮罩；初始化失敗時則解除喚醒透明狀態並明確顯示載入失敗，不再留下看似已載入的死畫面。
- 新增正式 Play 啟動保護回歸；完整 `npm run check` 280/280、Vite production build 與 scoped `git diff --check` 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 125 complete

- 依「網址直達正常、從主頁進入才壞」重新定位到 Start Game 預載流程：主頁原先會在跳轉前以 Image 解碼正式 Play 全部 327 份圖片，其中敵人動畫來源檔約 118 MB、玩家動畫約 55 MB，導頁後 Play 又會建立同一批圖片，造成兩個頁面的解碼與記憶體工作在首幀重疊。
- 主頁轉場改為只預載 12 份首畫面關鍵資源：第一張玩家游泳幀、六種地形、面罩／槽位 HUD、Lv.1 小刀圖示與第一部分地圖；敵人動畫預載降為 0，玩家動畫只保留 1 張。正式 Play 的 327 份完整素材清單不變，進入後仍會正常按需求載入。
- 導頁前會明確暫停載入影片，釋放影片解碼工作。新增主頁不可預解碼完整動畫庫的回歸；完整 `npm run check` 281/281、Vite production build 與 scoped `git diff --check` 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 126 complete

- 依「畫面先正常、隨後跳成 HUD／玩家消失」的時間順序，定位到正式 Play 在 `setupWorld` 成功後才啟動的 Part 1 喚醒動畫：它會把完整 HUD 透明化 5.85 秒並拒絕玩家 pointer input，因此外觀與操作都等同壞畫面。
- Part 1 現在於地圖、玩家與 HUD 建立完成後立即可操作，不再啟動喚醒透明／輸入鎖定。Attempt、HUD 與既有喚醒狀態模組仍保留，但正式進場不會再切入該狀態。
- 主頁關鍵預載補齊六張游泳幀，避免第一張玩家幀顯示後、動畫切到尚未完成的後續幀；關鍵預載共 17 份、敵人動畫仍為 0。完整 `npm run check` 281/281、Vite production build 與 scoped `git diff --check` 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 127 complete

- 更正 Step 126 的錯誤判斷並完整恢復既有 Part 1 進場演出：Attempt 顯示、HUD 慢慢淡入、三次眨眼、最後睜眼與演出結束後解除操作鎖定均保留，不再刪除先前完成的功能。
- 真正的崩潰原因是 `drawActor()` 誤用未宣告的 `PLAYER_ASSETS`；地形畫完後執行到玩家便拋出 `ReferenceError`，因此玩家、後續眨眼遮罩與下一幀排程全部消失。現已改回實際匯入的 `PLAYER_ANIMATION_ASSETS`。
- 新增玩家繪製資產名稱回歸，明確禁止 `PLAYER_ASSETS[animationState]` 再出現；相關測試 31/31、完整 `npm run check` 283/283、Vite production build 與 scoped `git diff --check` 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 128 complete

- 修正從主頁進入 Play 後偶發只剩瀏覽器預設排版的樣式失效：截圖證實玩家、Canvas 與發現卡均已執行，故障範圍限定為 `play.css` 與 `visor-hud.css` 未套用，而非再次刪除 HUD 或玩家。
- 保留 `play.html` 原有兩個 stylesheet link 作為首屏樣式，同時由已成功執行的 `play-page.js` 匯入同一組 CSS；因此只要遊戲模組能執行並畫出 Canvas，Play／HUD 樣式便會由同一模組圖保證安裝。
- 新增雙重樣式入口回歸；相關測試 19/19、完整 `npm run check` 284/284、Vite production build 與 scoped `git diff --check` 均通過。production `play.html` 仍只輸出兩個 stylesheet link，沒有重複 CSS 資產。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 128 complete

- 地圖編輯器不再顯示 Play 專用的氧氣、能量、生命值與 Attempts HUD；HUD 的正式遊戲程式與素材保留，只有編輯器畫布強制隱藏，蓋圖時不再被面罩遮住。
- 編輯器新增「目前遊玩地圖」清單，可直接載入下沉篇第一、二、三部分；載入後修改並按「儲存並套用到遊戲」，會覆寫 Play 實際讀取的同一份 JSON 地圖。
- 本機 Vite 開發伺服器新增受限制的地圖儲存入口，只允許三個既定地圖代號，拒絕任意檔名與路徑；匯入一般 JSON 或重設空白地圖後，不可直接覆寫正式遊玩地圖。
- 地圖編輯器專用測試 5/5、雙語測試 4/4、完整 `npm run check`、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 129 complete

- 爆腹燈籠魚保留視野追蹤，但只有身體與玩家真正重疊後才會在接觸位置開始 1 秒自爆倒數；移除原本鎖定遠方座標後無視牆面的直線衝刺，沙盒手動技能也遵守相同接觸條件。
- Resonance 全部 19 種永久 Buff 改為三倍細分層數：單層效果約為原本三分之一，滿層總強度維持原上限；冷光耐爆由每層 3%、3 層上限改為每層 1%、9 層上限。
- 小刀移動攻擊門檻降為 45 px/s，中等幅度彈射即可產生刀痕與路徑攻擊。敵人移動改用碰撞半徑檢查水域，卡在岩格或外邊界的敵人會被移回最近安全水域；新增隔牆燈籠魚不可接觸啟爆的回歸。
- 求援幼年海馬每次只召喚 1 隻 Lv.2 援軍；遊戲圖鑑、繁中／英文說明與既有 GDD 同步更新。
- 完整 `npm run check` 286/286、Vite production build 與 `git diff --check` 通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 130 complete

- 獅子魚砲手的毒刺直射改為半徑 7 的大型單發，棘刺散射改為半徑 3 的五枚小型彈體；正式遊戲與沙盒都能明顯區分兩種彈體尺寸。
- 兩招改為單一嚴格輪替節奏：毒刺直射施放後等待 1.35 秒冷卻，再施放棘刺散射；散射後等待 3.4 秒，再回到毒刺。修正原本輪替索引未真正套用到技能陣列的錯誤。
- 正式地圖的兩種獅子魚彈體加入逐段地形碰撞，命中不可通行 Cell、封閉 Edge 或水層邊界時立即消失，不會穿牆，也不會因單幀位移較大而越過阻擋。
- 所有仍可提供 Resonance 的敵人身後會繪製綠色低透明度實心範圍圓；半徑直接使用實際的敵人半徑、玩家半徑與共鳴擦身距離，成為真實判定範圍而非裝飾提示。
- 聚焦測試 101/101、完整 `npm run check` 289/289、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 131 complete

- 正式 Play 升級介面由扁平按鈕改為兩階段深淵牌組：先選定武器或被動牌組，再抽出兩張帶有既有進化圖示、目標 Level 與該級實際效果說明的卡牌。
- 選定牌組後會顯示封印狀態；`choosePlayUpgradeCategory` 同時加入核心鎖定，選擇武器後無法透過 UI 或再次呼叫函式切回被動，完成本次選牌後才會為下一次升級重設。
- 兩張候選卡依序由牌背翻至正面，武器／被動使用不同深海色調與金色牌緣；鍵盤焦點、窄螢幕排版、減少動態偏好與繁中／英文文案均保留。
- 升級候選補齊四武器與四被動的逐級真實說明及 24 張既有 Lv. 圖示路徑；圖示存在與英文內容另做靜態檢查。Focused tests 95/95、完整 `npm run check` 291/291、Vite production build 與 scoped `git diff --check` 均通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 132 complete

- 下沉篇第一部分由 160 列延長至 184 列；原熱泉門檻保留為 Boss 前檢查點，其下新增寬闊的稜鏡巨蟹封印房、三格入口閘門、三格出口閘門與房內氧氣／氣泡補給。
- 第一隻 Mini Boss `prismCrabGuardian` 已從第二部分移到第一部分房間中央；正式出口移至房間下方，第二部分不再重複生成同一隻 Mini Boss。
- 正式 Play 新增 Boss 房狀態機：玩家越過觸發線後上下閘門同步封閉，擊敗或 Resonance 中立化稜鏡巨蟹後才重新開啟；死亡回到房外 Checkpoint 時入口會重置供再次挑戰。
- Part 1 的篇章出口也會檢查 authored Boss 契約，不能只繞過房間抵達出口；新增封房、持續鎖定、解鎖、重試與地圖結構回歸測試。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — Step 133 complete

- 主角對敵人的全域基礎傷害倍率調整為 0.6，也就是所有武器傷害降低 40%；正式 Play、敵人沙盒與傷害預覽共用同一數值。
- 被動增傷、共鳴加成、側刃 70%、武士刀強化雙倍與敵人承傷倍率仍在新的 0.6 基準上相乘，不改變各自的相對效果。
- 珊瑚群落維持既有保護功能，沒有改成穿牆物件；新的牆邊穿行入口暫定規劃名為「潛壁鰓門」，等玩法規格確認後再實作與放入地圖。
- 傷害與進度聚焦測試 81/81、完整 `npm run check` 300/300、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器或 Playwright。

## 2026-08-10 — Step 134 complete

- 正式 Play 水域微動畫改為 16 組相位 Canvas 快取，以 30 FPS 更新流動細節；玩家、戰鬥、底圖與 HUD 仍維持每幀繪製。精靈發光輪廓改為有 1,800 萬像素上限的 LRU 快取，不再每幀重算多層 drop-shadow。
- 敵人 runtime 新增零複製 render view 與 instance ID 索引；每個物理步驟只回傳 Resonance 事件，完整快照只保留給 `render_game_to_text`。遠距生物以 0.25 秒低頻導航，進入玩家範圍後立即恢復完整模擬。
- Play 由原本一次建立 328 張圖片，改為 76 張共用基礎素材加當前地圖敵人幀；Part 1/2/3 分別為 196/238/256 張，減少約 40%/27%/22%。教學辨識掃描降為 120 ms 一次，並移除 HUD 長駐 backdrop-filter。
- 針對性測試 62/62、完整 `npm run check` 306/306、Vite production build 與 `git diff --check` 均通過；依專案規則未執行瀏覽器或 Playwright，因此不聲稱已實測 FPS。

## 2026-08-10 — Step 136 complete

- 正式 Play 的一般敵人警戒半徑由 168 提升到 264 世界單位，Mini Boss／Boss 使用 408；戰鬥漂移目標會隨玩家每約 24 世界單位的位置變化重新計算，不再沿用最多 5.2 秒前的舊目標。
- 原始資料中移速為 0 的求援幼年海馬、珊瑚背海馬與變異鸚鵡螺祭司保留支援／定點職能，但加入 12–16 的低速自然漂浮；近戰怪技能冷卻期間也會在玩家周圍重新選位，不再原地等待。
- Mini Boss／Boss 的控制型技能納入持續重新定位；每次 Boss 技能結束後保留 0.85 秒移動窗口，避免多招連續施放讓 Boss 全程停在 casting。Lv.1／2／3／4 的顯示尺寸固定為 28／34／40／46，Mini Boss 68、變異 Mini Boss 78、最終 Boss 96，碰撞半徑同步分級。
- 敵人聚焦測試 36/36、完整 `npm run check` 311/311、Vite production build 與 scoped `git diff --check` 全部通過；涵蓋零移速怪自然漂浮、三個特殊 Boss 隨玩家換位、Boss 技能間移動窗口與完整尺寸階級。依專案規則未執行瀏覽器或 Playwright。

## 2026-08-10 — Step 141 complete

- 下沉篇第一部分新增三張 ImageGen 深海序章示意圖：氧氣設施衰敗、Abyss Core 生命循環與機械拒絕、肉身潛水員與核心共鳴；圖片不烙任何文字，保留 Narrator UI 的可讀性與語言切換空間。
- 正式 Play 在既有閘門演出之前新增三頁故事入口；三張投影片與完整 HUD 同時存在於同一遊戲畫面，旁白逐字出現，首次點擊先補完文字，第二次才換頁；右下可略過序章，但不會略過後續閘門演出。
- 序章期間物理、戰鬥、氧氣倒數與敵人行為全部暫停；完成或略過後立即進入既有「閘門關閉 → 航程節點 → 閘門重新開啟」，閘門再次打開後才解鎖遊戲模擬。減少動態偏好僅關閉背景慢推鏡，不刪除文字與投影片。
- 既有 GDD 的主控台、願景核心摘要、玩家體驗、體驗核心摘要與設計決策同步記錄三頁內容、互動規則與未定義邊界。
- 聚焦 Node 測試 31/31、Vite production build 與 `git diff --check` 通過；完整 `npm run check` 在工作區其他未完成地圖／敵人平行修改上仍有 2 個既有失敗，未把那些無關修改混入本次修正；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — First-breath tutorial room in progress

- 新增小型「新手教學房・第一次呼吸」：第一次進入 Play 預設載入，房內放入彈射、Checkpoint、水草、氧氣礦石、清氧氣泡、托里切利空間、光合作用氣泡、重石、地雷、剃刀、按鈕與多種 Edge 的可操作示範。
- 教學進度以獨立狀態機記錄；核心流程教彈射、資源管理、Checkpoint、武器路徑，敵人則允許擊殺或 Resonance 中立兩種方式完成。
- 教學房底部 EXIT 與地圖選擇都保持自由離開；完成核心示範後自動進入下沉篇第一部分，離開偏好會儲存在本機，並可用 `?route=tutorial` 重新測試教學房。
- 本階段已完成教學資料層與 Play UI 接線；完整 `npm run check` 324/324、Vite production build 與 `git diff --check` 均通過。依專案規則不執行瀏覽器／Playwright。

## 2026-08-10 — Chapter 0 guided tutorial complete

- 教學房正式改為獨立的「第零篇章・第一次呼吸」（Part 0），由「深淵導航員」逐步給出標題、說明、當前操作與 Canvas GUIDE 目標標記；未完成當前知識點時，出口保持鎖定。
- 引導流程要求玩家實際完成 20 個操作：拉射、附著／離開水草、Checkpoint、氧氣與能量資源、各種物件與 Edge、潛壁鰓門、武器命中，最後必須以真正的 Resonance 中立化另一隻敵人；單純擊殺不會被算成 Resonance，失敗的低速撞擊也不會通過。
- 按 Enter 會開啟 Skip Tutorial? 確認；確認後只回到水下主控台，不會進入或把教學資源／進度繼承到正式篇章。完成教學後抵達 EXIT 也只回主控台。

## 2026-08-10 — 下沉篇第二部分四條托里切利回返洞

- 下沉篇第二部分由兩個普通托里切利物件補成四條偏軸高風險回返洞，分布在 row 8、24、46、68；每條三格寬，與主路保留岩牆，必須先下沉到下方接點再逆著重力回返。
- detour metadata 同時保存上行終點、接點、shaft 寬度、分隔牆與 T1/T2 水層；T2 熱泉支路不會被錯刻成 T1，並同步保留上升篇的地形鏡像。
- 地圖專項測試 22/22、完整 `npm run check` 328/328、Vite production build 與 `git diff --check` 通過；依專案規則未執行瀏覽器／Playwright。
- `tests/play-tutorial.test.mjs` 新增第零篇章、逐步 Gate、擊殺不等於 Resonance、Enter Skip 靜態回歸測試；聚焦測試 26/26，完整 `npm run check` 328/328，Vite production build 與 `git diff --check` 均通過。依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 ? Chapter 0 navigator dialogue in progress

- ????????????????????? Canvas GUIDE ???????????????????????????????????????????
- 20 ?????????? EXIT ???????????????????????????????????????????????
- ?? Node????? 27/27??? JavaScript ?? `node --check` ? `git diff --check` ????????????????Playwright?

## 2026-08-10 ? New Game now enters Chapter 0

- ???? `/play.html` ???? `thirst-for-oxygen-tutorial-exit` localStorage ??????????????????????????????????????????
- `?route=descent`?`?route=ascent` ??? route ?????????????? Skip ???????????????????????????
- ?? Play?Chapter 0 ???? 24/24??? JavaScript `node --check` ? `git diff --check` ????????????????Playwright?
## 2026-08-10 — First Breath becomes a 10-task guided room

- First Breath 改為 10 個可選任務：玩家可用 ←／→ 在 Guidance 與右側 FIRST BREATH 任務列表間切換，任務內仍要求實際完成拉射、資源管理、物件／Edge、擊殺或 Resonance；Enter 仍開啟 Skip Tutorial 確認。
- 左側 Resonance 訓練燈籠魚使用無限生命且不會自爆；右側擊殺訓練燈籠魚使用有限生命、不會自爆且停用 Resonance，兩條勝利方式在教學房內分開呈現。
- EXIT 移到出生區右側牆面並改為醒目的 EXIT／LOCKED 標記；珊瑚移到右側牆邊的 Edge，地雷與珊瑚分離，避免物件重疊或漂浮感。
- 聚焦測試 25/25、完整 `npm run check` 335/335、Vite production build 通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — First Breath restores twenty selectable tasks

- 修正任務清單：右側保留 20 個可用左右鍵切換的 First Breath 任務，完成任意 10 項即可解鎖 EXIT；不是把任務總數刪成 10 項。水草附著／離開仍作為一個完整知識點，所有 21 個實際操作保留。
- 左側 Resonance 訓練燈籠魚與右側擊殺訓練燈籠魚都固定不動；左側無限生命，右側改為 20 HP、有限生命且不會自爆。玩家必須自己靠近左側魚累積 Resonance。
- 珊瑚 Edge 從牆邊移到房間內側，兩端都連接可通行水格，避免珊瑚根貼住封閉牆面而難以互動。
- Chapter 0 First Breath 面板與左下 Guidance 對話框預設半透明，滑鼠懸浮或聚焦時才恢復高不透明度；20 項清單可滾動顯示。

## 2026-08-10 — First Breath cards no longer block controls

- Navigator 與 Guidance DOM 卡片改為穿透滑鼠事件，玩家可以在卡片覆蓋區直接拖曳潛水夫；卡片仍會依游標位置恢復高不透明度。
- 20 個任務的解鎖門檻明確顯示為 `10 / 20`，清單可用滑鼠滾輪或原生 scrollbar 拖動；讀取重石、深海地雷與洋流的 Visor 說明卡並按下 OK 後，會正式完成對應任務。
- Skip Tutorial 導航提示改為明確要求按 Enter；聚焦測試 34/34、完整 `npm run check` 342/342、Vite production build 通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — English Guidance control copy is fully separated

- 左下 Guidance 操作框不再翻譯串接後的複合句；當前操作與 First Breath 任務切換提示分開翻譯，英文模式不會殘留中文。
- 聚焦 i18n／Play 靜態測試 27/27 通過；依專案規則未執行瀏覽器／Playwright。

## 2026-08-10 — First Breath task list has a real scroll range

- 任務清單改成固定 96px 的兩欄滾動區，固定 grid row 高度並強制顯示 scrollbar；20 個任務不再因父卡高度或 auto overflow 而只呈現前 14 個。
- Scrollbar thumb 與 track 增加明確視覺樣式；Play 靜態結構測試補上真正 scroll range 的 CSS 契約。
