# Thirst for Oxygen — GDD 主控台

本頁是 Game Design Document 的導航入口。詳細規則、內容與未來待補資料，請進入下方對應文件。

## 文件狀態

| 區域 | 狀態 | 入口 |
| --- | --- | --- |
| 遊戲願景 | 已分類 | [01_Vision](01_Vision/) |
| 核心玩法 | 已分類 | [02_Core_Gameplay](02_Core_Gameplay/) |
| 系統設計 | 已分類 | [03_Systems](03_Systems/) |
| 世界與關卡 | 已分類 | [04_World_Level](04_World_Level/) |
| 內容資料 | 部分分類 | [05_Content](05_Content/) |
| 玩家體驗 | 尚未在原始 GDD 定義 | [06_Experience](06_Experience/) |
| 技術規格 | 尚未在原始 GDD 定義 | [07_Technical](07_Technical/) |
| 平衡與測試 | 尚未在原始 GDD 定義 | [08_Balance_Testing](08_Balance_Testing/) |
| 管理與決策 | 部分分類 | [09_Management](09_Management/) |

## 遊戲摘要

玩家扮演一名潛入深海竊取秘寶的小偷，在取得寶藏後意外喚醒沉睡於深海的守護者——深海之王。玩家必須一邊躲避追擊，一邊利用有限的氧氣向海面逃亡。

## 核心設計支柱

1. 氧氣同時是移動成本與生存壓力。
2. 物理彈射讓移動具有風險與不可完全預測性。
3. 水域環境會改變玩家的移動規則。
4. 戰鬥與 Roguelike Build 支援玩家突破上升路線。
5. Checkpoint 與 Boss 將逃亡旅程切成階段。

## 核心循環

探索 → 利用彈射移動 → 消耗氧氣與體力 → 收集氧氣 → 擊敗小怪 → 獲得經驗 → 升級 Build → 擊敗 Boss → 解鎖下一區 → 持續向海面逃亡

## 重要依賴關係

- [氧氣系統](03_Systems/Oxygen_System.md) ↔ [彈射移動](02_Core_Gameplay/Physics_Launch.md)
- [體力系統](03_Systems/Stamina_System.md) ↔ [玩家操作](02_Core_Gameplay/Player_Actions.md)
- [氧氣來源](04_World_Level/Oxygen_Sources.md) ↔ [關卡流程](04_World_Level/Level_Flow.md)
- [戰鬥系統](03_Systems/Combat_System.md) ↔ [武器內容](05_Content/Weapons/)
- [Build 成長](03_Systems/Progression_Build_System.md) ↔ [Boss 內容](05_Content/Bosses/Bosses.md)

## 待補文件

空白文件代表原始 GDD 尚未提及該主題，後續可直接在該位置補充。
