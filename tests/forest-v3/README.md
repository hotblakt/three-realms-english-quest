# 7C-QA1｜Forest 3.0 獨立品檢

Production Batch 002。PR #39 `62e590f665781822ac48bf691e6507f920bf6b68` 是遊戲對照，PR #42 `9721c466691c33de53a03d653b1673b50ed002c4` 是製作與測試基準。製作人已決定重用第一章風刃、保留東端原單向回程、延期雙向快速重訪、先測目前 iPhone 與 iPad，量測後再決定效能放行門檻。10–15 分鐘展示的整合候選、兒童試玩與成人彩排尚未取證。[展示計畫](../../docs/production/demo-acceptance-plan.md) · [整合契約](../../docs/production/forest-v3-integration-contract.md) · [素材計畫](../../docs/production/forest-v3-asset-production-plan.md) · [AI 開發流程](../../docs/ai-development-pipeline.md)

## 重現與範圍

從 repo 根目錄執行。保留歷史物件，兩個 SHA 各建隔離 checkout／worktree，Node.js 24 以鎖檔安裝並建置。套件與 Playwright 可用既有環境或隔離工具安裝，遊戲依賴與測試配置沿用原版。

```sh
npm ci
npm run build
node --test tests/*.test.mjs
python -m pip install -r tests/requirements.txt
python -B -m unittest discover -s tests -p 'test_*.py'
node --test --test-isolation=none tests/forest-v3/*.test.mjs
```

兩個 checkout 各開 Vite preview 與 Vite dev。下列假設 PR #39 的 preview／dev 分別為 4174／5174，PR #42 分別為 4173／5173。提供外部 Playwright 的套件名或絕對模組路徑給 `PLAYWRIGHT_MODULE`，需要時由 `CHROMIUM_PATH` 指定系統 Chromium。輸出路徑可指定至暫存資料夾。

```sh
stable=http://127.0.0.1:4174/three-realms-english-quest/
production=http://127.0.0.1:4173/three-realms-english-quest/
node tests/forest-v3/measure.mjs "$stable" /tmp/stable-phone.json canvas phone 900
node tests/forest-v3/measure.mjs "$production" /tmp/production-phone.json canvas phone 30
node tests/forest-v3/measure.mjs "$stable" /tmp/stable-tablet.json webgl tablet 30
node tests/forest-v3/measure.mjs "$stable" /tmp/stable-desktop.json canvas desktop 10
node tests/forest-v3/startup-smoke.mjs "$stable" "$production" /tmp/startup-smoke.json
FOREST_IDLE_30S=1 FOREST_VISIT_SETTLE_MS=30000 node tests/forest-v3/visual.mjs \
  http://127.0.0.1:5174/ http://127.0.0.1:5173/ /tmp/forest-visual-canvas canvas
node tests/forest-v3/visual.mjs \
  http://127.0.0.1:5174/ http://127.0.0.1:5173/ /tmp/forest-visual-webgl webgl
```

## 畫面與流程

固定畫面包含入口、竹冠、橋水、西寶箱區、神龕前後、東回程，共七個鏡位。瀑布新觀景點另等候選。測試 tab 攔截開發用 boot 模組取得場景，固定腳點、相機及 Idle 幀後擷取原始 Canvas PNG。相同 renderer 逐 RGBA 通道比對；另以顯示／隱藏角色驗證可見像素、四方向 Run→Idle、神龕透明度和可選 30 秒待機。互動打開西寶箱，三次觸控東回程回到南入口。鏡位移動由測試直接放置，實際可走路線、碰撞、安全折返仍需候選正常操作。像素差異預設失敗。候選有審閱通過的刻意改圖時，可用 `FOREST_APPROVED_VISUAL_CHANGES=1` 產生並記錄差值，仍須對照核准原畫並逐鏡位人工審查。畫面、角色吸引力、陰影、可讀性、手感及節奏由獨立審查者和製作人分開簽核。

既有 Node 測試覆蓋章節戰鬥／進度、舊檔、學習與語音備援、四向動畫、啟動、圖集退化、竹冠與神龕；Python 檢查既有素材。原瀏覽器腳本檢查 Canvas／WebGL 正式入口角色幀、遮擋及與 Batch C 對照。HTML 原有診斷從載入模組前開始，記錄環境、紋理、必要動作、場景建立、首次 POST_RENDER 和失敗重試。正式 build 錯誤注入煙測覆蓋 Batch B／C 的各別 404 備援、必要北向 Run 缺檔或停滯的鎖定、20 秒看門狗、復原與資料保留、模擬橫直／直橫暫停及觸點釋放。PWA、物理雙指、實機收音、繪製與記憶體取證另走[實機流程](real-device.md)。

## 候選測例與整合輸入

`acceptance.json` 的 20 個 ID 與核准品檢計畫一一對應，包含前置、操作者行動、預期結果與依賴。所有候選案例預設跳過，清楚呈現未測。整合後由測試介面或實機記錄產出真實觀測，透過 `FOREST_QA_CANDIDATE_SHA` 和 `FOREST_QA_CANDIDATE_EVIDENCE` 執行。JSON 頂層設 `sha`、`cases`，各 ID 的記錄含同一 `sha`、`rawEvidence` 的原始報告路徑或證據連結，以及與案例欄位同形的 `observed`。自動比對接受客觀結果；QA 仍需核對來源、原始時間樣本及人工簽核。禁止以複製期望值作證據。效能樣本數與完整性已列入觀測，提議的數值另需核准。兒童樣本與成人試玩依原計畫另行紀錄。G01 驗既有單向回程，G07 驗風刃可用和風紋強化，R01 用守護者練習、另一條路與未領寶藏驗重玩。

`node tests/forest-v3/contract.mjs <packet.json> <asset-root>` 驗證工作流／整合器從固定候選提取的資料。以 `contract.test.mjs` 的合成封包理解格式，其資料只測檢查器。實際契約欄位由介面轉接到固定格式，尚未接入 A／B／C。各工作流先自交 SHA 和證據，完整封包需由整合候選產出。可選第三參數 `world`、`assets`、`domain` 可獨立驗證各流；在世界與領域模式用 `-` 代替 asset-root，領域獨立模式先用契約錨點集作對照。

- **A 世界** 提供區域、對應 Phaser key、已定案與草案地標、碰撞責任、單向回程、可達安全足點，以及區域／場地事件。草案坐標仍須用品檢路線和碰撞檢查證明。兩條路接到東岸，西岔安全原路折返。另用 `node tests/forest-v3/geometry.mjs <geometry.json>` 驗證 A 匯出的實際 AABB 圖層、物理邊界、合法互動足點和主徑／西岔／回程的掃掠碰撞。格式見 `geometry.test.mjs`。腳點用身體中心，不使用寶箱圖像中心。
- **B 角色與資產** 提供 `hayate` 狀態和批准證據，來源稿作者、授權、固定版本及雜湊，並附執行期頁面、實際檔案 SHA-256 及批准參照。逐個核對 PNG／WebP 標頭與 RGBA 預算，身份主圖、四向參考及試閱稿不得當成執行貼圖。候選整合器用紋理註冊清單交叉核對 `resident` 欄位。授權與畫質仍要審原始記錄。
- **C 戰鬥** 提供三遭遇 ID、與 A 地標對應、同嘗試內依序的時間與序號、預警／命中／反擊事件及兩次傷害去重的可重跑測例。合成封包固定使用 ms、XY 陣列及羈絆 0／1／2；這些表示法是 QA 轉接格式。碰撞幾何、實際狀態變更和戰鬥排序需以候選跑跡證明。
- **整合器** 提供同一版本的單一寫檔所有者、上次安全點、遭遇、寶藏、捷徑、靈伴和收據。收據唯一鍵為槽位／來源／獎勵。發出首通事件須有對應已落盤收據。待候選再以寫入攔截、雙頁及重載測交易原子性，靜態封包無法證明寫檔時序。任何跨流修改共用檔案留給指定整合分支。

環境、量測分布、實際觀察與效能建議見[基準報告](baseline-results.md)。發布阻擋、畫面品質偏差與回退依原展示計畫與契約，須附候選 SHA 的證據。
