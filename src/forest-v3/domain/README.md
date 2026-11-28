# 霧竹林 3.0｜戰鬥與疾風領域交接

7C-C1／Production Batch 002。以 PR #42 整合契約及 PR #39 穩定遊戲為基準。[整合契約](../../../docs/production/forest-v3-integration-contract.md) · [戰鬥](../../../docs/production/combat-system-design.md) · [疾風](../../../docs/production/hayate-companion-design.md) · [展示品檢](../../../docs/production/demo-acceptance-plan.md)

## 匯出與所有權

| 模組 | 接點 |
| --- | --- |
| `contracts.ts` | `WorldGeometry`、區域與場域進出資料、一次性 `PlayerInput`、`CombatEvent`、`CompanionSnapshot`、`HudState`、動畫與音效提示型別。所有位置都以 Y 向下的世界 XY 腳底點表示。 |
| `tuning.ts`、`enemy.ts` | `tuning`、`enemies`、`encounters` 公開初始參數。敵人狀態、共用攻擊名額與輪替為領域實作。可在 `EncounterOptions` 注入完整的敵人及遭遇定義。 |
| `encounter.ts` | `Encounter` 擁有遭遇狀態、敵人、碰撞採樣、劍擊、閃避、反擊、風刃與資源。供場景呼叫 `enter`、`update`、`pause`、`resume`、`retry`、`retreat`、`settle`。用 `hud`、`playerPosition`、`enemyState`、`projectileState`、`drainEvents` 讀取結果。 |
| `companion.ts` | `Recruitment` 接收安全互動及 `recognized`／`assisted` 完成訊號，傳回提案。`companionSnapshot` 讀已提交資料，`Hayate` 輸出跟隨、等待、復位、安全側點及提示決策。 |
| `progression.ts` | `RewardStorage`、`RewardProposal`、`TransactionResult`、`receiptFor`、純函式 `applyReward`、`proposeWindRune`，以及隔離的 `MemoryRewardStorage`。 |
| `presentation.ts` | `EventGate`、`animationCue` 與 `audioCue`。場景仍可依原始事件選擇符合 QA 的文字與圖形提示。 |

`index.ts` 為公開入口。時鐘需回傳單調遞增的毫秒值。戰鬥以 1 ms 步進檢查被跨過的時間窗，場景每幀傳移動向量及動作邊緣。暫停與背景事件在場景端接線，停止傳入舊輸入。恢復後有 300 ms 重讀期，遊戲時間在此期間同樣凍結。嘗試 ID 由呼叫端注入，應跨場景唯一。重試建立新 ID，重設敵人、資源、緩衝與冷卻。

## 數值與場景接線

- 劍擊前搖／有效／收招為 60／90／150 ms，扇形 55 單位、106°。閃避 310 單位／秒、160 ms 免傷、550 ms 冷卻，反擊窗 900 ms。生命 5、靈力上限 4、入場與重試有 2 靈力。受擊保護 950 ms。風刃釋放扣 2，射程 144／風紋 168。
- 竹芽扇形、風籽直線投射、守護者交替扇掃與震波。守護者只在核心收招時受傷。敵人共用一個攻擊名額，預警至活動或投射結束全程持有，相鄰出招至少隔 250 ms。完整初始參數見 `tuning.ts`。
- A 提供 `AreaReady/Exit` 與 `ArenaEntered/Exited` 對應、合法敵出生點、相機可讀範圍、安全回程錨點、可達足跡與離鏡判斷。場景就緒才呼叫 `enter`。幾何適配器需在碰撞後回傳腳底點，玩家形體為半寬 9、高半徑 8，其他足點使用半徑。揮劍及標形由 `intersects` 判定並另查阻擋。投射由 `sweep` 交回最早接觸，牆優先同時接觸。測試中的 `mockWorld` 只模擬簡化幾何。
- 進場後以領域腳點與碰撞為主，整合器維持原有四向 Run／Idle、足點、遮擋及相機。避免同時讓場景位移系統再推動戰鬥角色。離場使用回傳腳點，跨區沿用 A 的安全落點與既有回程。疾風沿合法足跡，橋上由 A 供單列錨點。進新場景時先等待就緒。
- 動畫使用地面預警、劍弧、閃避輪廓和風刃軌跡。保持地面標形與有效窗同步。依 `ActionStarted` 顯示起手，依 `HitWindowOpened` 顯示投射；其移動用 `projectileState`。依命中事件顯示護殼、無敵或有效傷害。保留現有素材門檻，Attack、Dash、North Cast 不影響任何判定。音效用短提示、格擋、命中與獎勵，靜音保留圖示或字幕。

## 事件

每筆戰鬥事件有 `encounterId, attemptId, seq, atMs, type`。嘗試內序號遞增，時間為有效戰鬥時間。HUD、動畫、音效及疾風只讀。離場事件應在下一場入場前消費，場景切換時重置呈現層與事件閘。

| 事件 | 欄位與用途 |
| --- | --- |
| `AttackTelegraphed`、`HitWindowOpened`、`AttackEnded` | `attackId, sourceId, shape, origin, facing, opensAt, closesAt`。結束含 `reason`，投射可比預計窗口更早結束。 |
| `ActionStarted`、`HitResolved` | 動作含 `action, origin, facing`。命中含 `attackId, sourceId, targetId, result, hpDelta, spiritDelta`，以嘗試／攻擊／目標去重。 |
| `CounterOffered`、`CounterEnded` | `windowId`，開啟附 `deadline, windBladeReady, safeAnchorId`。疾風每次嘗試只提示一次，同一事件重送或過期無效。 |
| `EncounterFailed`、`ArenaExited` | `checkpointId`，退出附 `landmarkId`。關閉未完成窗口，清場上敵與投射；場景選擇重試、撤退或外部回程。 |
| `RewardCommitted`、`EncounterCleared` | 交易確認才發首通通知，有 `rewardId, firstClear`。已通關練習只發清除事件，不再提交獎勵。 |

## 存檔交易與回報

正式整合分支是唯一落盤所有者。它負責讀取存檔版本、遷移、舊檔缺欄初始化、保存未知或受損資料、`lastSafe` 與 Chapter 1 進度，再將已確認的 `Progress` 傳入領域。收據鍵是存檔槽／來源／獎勵。適配器需逐槽序列化，原子寫入收據、清場、寶藏、旗標與疾風成長，然後回傳確認。多分頁與重新載入共用收據。交易失敗可重試或走安全退路；交易執行中等待完成，避免退出後誤顯未確認結果。

主徑竹芽與西岔寶箱各提供一枚風印。共同的東岸房只記清場，保留契約的兩個風印來源。風紋需要第一章已解鎖風刃且在安全點操作；風印作解鎖條件。守護者徽章允許重玩入口，交易可提出既有 `east-return` 旗標，世界整合須保持原回程隨時可用，勿以旗標封鎖。雙向 `guardian-revisit` 延後。守護者收據同時是疾風羈絆 II 的去重來源，先通關再收集時可補登。

疾風交流用 `Come with me.`，安全互動打開、退出或轉場呼叫 `cancel`。場景只轉發辨識成功或玩家完成輔助步驟，領域不接觸麥克風或內容資料。未收集仍可交戰，未備妥美術時可使用文字提示；Wind Shield 延後。與 B 確認安全側點、角色視覺與事件使用後再上線。

## 測試與剩餘驗證

在儲存庫根目錄執行 `node --test --test-isolation=none src/forest-v3/domain/*.test.mjs`。既有回歸使用 `node --test --test-isolation=none tests/*.test.mjs` 及 `python -B -m unittest discover -s tests -p 'test_*.py'`。專用測試使用手動時鐘、幾何替身及記憶體交易驗證窗口、去重、資源、敵人協調、守護者、疾風、暫停與失敗。實機碰撞和場地可讀性、場景與存檔適配器、跨分頁原子交易、兒童手感與數值平衡仍需整合後驗證。先在目前的 iPhone、iPad 量測，再決定發布門檻。
