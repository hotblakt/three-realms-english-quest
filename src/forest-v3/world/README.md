# 霧竹林 3.0 世界幾何交接

Production A，Milestone 7C-A1。實作基準為 PR #42 `9721c466691c33de53a03d653b1673b50ed002c4`，穩定遊戲對照為 PR #39 `62e590f665781822ac48bf691e6507f920bf6b68`。[整合契約](../../../docs/production/forest-v3-integration-contract.md)

## 座標與介面

世界為 1220 × 890，物理邊界為 x 24–1196、y 30–864，X 向右、Y 向下。腳點是 Phaser 18 × 16 碰撞體中心，也用於影空貼圖足點與 Y 深度。矩形以四邊表達，貼邊可通行。掃掠會連續檢查整塊碰撞體。場景呈現繼續使用既有的溪岸畫法、橋面、竹冠與神龕淡化。

| 模組 | 由 `index.ts` 匯出的接點 |
| --- | --- |
| `collision.ts` | `worldSize`、`worldBounds`、`playerBody`、`hardColliders`、`collidersIn`、`isClearArea`、`isWalkable`、`canTraverse`／`canTraversePath`。碰撞資料重用原地圖的溪段與植被座標、素材目錄的岩石寬度，對照 ForestScene 的靜態碰撞配置。 |
| `world.ts` | `forestRegionId` 對應 `forestSceneKey`，另有 `regions`、`landmarks`、`interactions`、`checkpoints`、`safeAnchors`、`returnShortcut`。用 `isRegionWalkable`、`regionsAt` 及 `getSafeAnchors` 查詢區內足點，可指定碰撞體尺寸。分區矩形可重疊，表示查詢範圍和錨點歸屬。 |
| `routes.ts` | `routes`、`routeNodes`、`getRoutePoints`、`isRouteWalkable`、`routeClearance`、`findRoute`。路網只使用列出的中心線，`findRoute` 回傳節點序列。原東側互動捷徑須顯式傳入 `allowShortcut`，由場景執行。 |
| `encounters.ts` | `encounterAreas` 含房界、入場、出生半徑、撤離和檢查點。另有 `isEncounterWalkable`、`encounterRetreatPath`、`encounterCameraBounds`、`guardianGeometry` 與 `guardianClearance`。鏡頭矩形包含房界、入口與撤離，實機可視範圍由整合器量測。 |
| `events.ts` | `WorldEvent` 是 `type` 判別聯集。 `AreaReady`／`AreaExit` 的 payload 為 `{regionId, spawnId}`。 `ArenaEntered`／`ArenaExited` 的 payload 為 `{landmarkId, checkpointId}`。 `WorldEventPayloads` 可供會以事件名稱分派的整合器使用。 |
| `validation.ts` | `validateWorldGeometry()` 回傳問題、中心線淨空、橋口、守護者預警及閃避證據。 `diagnose.mjs` 可在命令列重現，發現問題時以非零狀態結束。 |

## 路網示意

```text
村莊側落點 ⇄ 南口 ⇄ 分岔 ⇄ 石燈練習 ⇄ 橋西 ⇄ 木橋 ⇄ 橋東 ⇄ 東岸會合
                      ╰⇄ 寶箱互動點 ⇄ 瀑布觀景               ├⇄ 東岸撤離點 ⇄ 東岸遭遇
                                                             ├⇄ 神龕外側 ⇄ 疾風安全側點
                                                             ├⇄ 守護者檢查點 ⇄ 空地入口
                                                             ╰⇄ 東側捷徑 → 南口
```

西側依契約沿原岔往返。檢查使用 18 × 16 原身體，新增通行帶以 54 × 48 為目標。契約以版面矩形記錄 44 單位橋口。Phaser 靜態矩形定位會取整半尺寸，正式場景的實際橋口為 44.5 單位，玩家中心 y 437.5–466 可雙向通行。接橋舊路、東岸接橋路與沿用這段的遭遇接近路，約有每側 11.00–15.00 單位額外淨空。西岔寶箱路約 12.63，觀景段約 3.10，須優先做觸控及遮擋走查。這些是沿中心線的矩形淨空，手機上可辨識的石徑寬度需要另測。

## 遭遇交接

守護者候選場界 x 1042–1196、y 357–469。出生與預警原點 (1069,413)，固定朝東驗證 120 × 34 震波及半徑 72、總角 100° 扇掃。證據包含向兩側各移動 49.6 單位，讓整個玩家碰撞體離開兩種預警，以及由兩個落點至場外檢查點的連續撤離。入口使用 (1061,327) 繞開舊岩的擴張碰撞範圍，疾風在 (1085,330) 待位。

這個場界高度 112 單位，無法容納朝南或北的全長震波。若 C 採用跟隨玩家的任意鎖向，應先限制出招於經驗證的朝東方位並同步顯示相同的命中形狀，或另選較大空地並重新驗證全向預警與躲避，維持原地形碰撞。扇掃東向外包框距場界上下各約 0.85 單位，視覺外框、震波效果與鏡頭裁切需另驗。

整合前需逐項確認：

1. 將世界 ID `misty-bamboo-forest` 映射至現有 `misty-forest`。以實際入場、跨區退出與進出遭遇發送契約事件。點位需先合法才移動玩家。 `village-return` 是森林端候選錨點，村莊落點、雙向場景切換及載入失敗復原由整合器驗收。
2. 接上寶箱、瀑布觀景與神龕外側互動，沿用既有神龕深度和東岔單向返程。雙向快速重訪延後。疾風的離鏡復位需以實際鏡頭及貼圖足點再次過濾安全錨點。
3. C 接上練習、近遠搭配與守護者房，以東岸清場決定守護者進入資格，保留退出。依第一章既有進度使用風刃。場景負責確認預警和傷害在同一幾何、檢查點回復及中途退出後的事件生命週期。
4. 在整合候選一併走完兩條探索路線、原橋雙向、東岔返回、疾風招募與拒麥後返回。優先量測目前 iPhone/iPad Safari 與主畫面模式的遮擋、視野、雙指操作和效能，再確認發布門檻。

## 重現

```sh
node src/forest-v3/world/diagnose.mjs
node --test --test-isolation=none tests/*.test.mjs src/forest-v3/world/*.test.mjs
python -B -m unittest discover -s tests -p 'test_*.py'
npm ci
npm run build
```

原 Node glob 只覆蓋 `tests/`，需顯式帶上本目錄。部分執行環境的 Node 預設程序隔離只回報檔案層級，`--test-isolation=none` 可逐項取得測試計數。數學驗證涵蓋靜態碰撞與資料契約。可另在本機啟動 Vite 3000 埠，使用已有 Python Playwright 和 Chromium 執行下列 Forest 2.0 場景煙霧測試。

```sh
CHROMIUM_PATH=/usr/bin/chromium python -B src/forest-v3/world/baseline-smoke.py
```

場景煙霧測試採原 Forest 2.0 正式入口，比對實際 Phaser 障礙矩形及操作過橋與返程。Forest 3.0 西側觀景、新遭遇、美術與輸入手感等，待新資料接入場景才有可玩證據。
