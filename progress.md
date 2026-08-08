Original prompt: 開始製作遊戲,你可以開始製作程式碼了。第一個要做的是地圖編輯器,因為那也是我製作地圖的方式。請參閱相關的文件。 如果我還沒有生成一個圖片的話,那就使用placeholder的圖案就好了,完全不要花心思在一開始的介面上,能用就行了。 那些效果都要做出來,也就是像什麼重力的邏輯啦,還是什麼物件,都要有相對應的互動邏輯。 另外一般的那種彈射邏輯也要讓我可以測試出來。

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
