# 三界 AI 開發流程 3.0

## 決策原則

- **品質優先。** 先寫可驗收的目標。遊戲手感、可讀性、無障礙與存檔相容性都是交付條件。
- **長期可重玩。** 優先維護能在後續章節持續擴充的玩法與學習回饋，並用實際試玩驗證。
- **自動化優先。** 可重現的安裝、建置、輸入驗證與回歸檢查交給 CI。美術、手感及行動裝置體驗仍需人工驗收。
- **可並行就並行。** 獨立的建置與素材驗證可同時做。共同介面先對齊，再整合依賴工作。
- **可重用、可擴充。** 延用既有遊戲系統，讓章節、素材與資料格式可獨立演進。
- **合理成本。** 先驗證小樣本，通過再擴大批次。涉及費用的工作先由製作人批准。
- **安全與品質管控。** 採最小權限，追蹤來源與提交，保留人類核准及可查核的發布證據。

## 團隊分工

| 角色 | 執行者 | 職責 |
|---|---|---|
| 製作人 | 人類 | 確認目標、預算、驗收條件與發布授權 |
| 技術總監 | ChatGPT | 界定架構、品質門檻與技術取捨 |
| 製作與發布管理 | Work | 核對授權、PR、CI、部署與驗收證據，回報阻礙 |
| 首席工程師 | Codex | 實作、測試、維護與交付可審閱的變更 |
| 美術設計 | ChatGPT Images | 提供原創視覺候選與風格迭代，交由製作人驗收 |
| 動畫製作 | FrameSprite | 產出動畫原始資料，依規格交付供逐格檢閱 |

## 品質門檻

`PR Quality` 在指向 `main` 的 PR 與合併佇列候選上執行。Node.js 24 負責 `npm ci`、正式建置與全部 Node 測試，Python 3.12 在獨立工作執行既有 Python 回歸測試。彙整工作 `PR quality gate` 只有兩項工作都成功才通過。既有測試涵蓋第一章流程、戰鬥規則、英文學習、語音回復、舊存檔與動畫資料。PWA、觸控和實機語音另列發布煙霧測試。

本機執行 `npm ci`、`npm run build`、`node --test tests/*.test.mjs`，並在 Python 3.12 的虛擬環境執行 `python -m pip install -r tests/requirements.txt` 及 `python -B -m unittest discover -s tests -p 'test_*.py'`。

本工作流程使用 `checkout@v6`、`setup-node@v6` 和 `setup-python@v6`，其上游 action metadata 均宣告 Node.js 24。Node.js 專案版本與 Action 自身執行階段各自設定。既有 Pages 建置已用 Node.js 24。Pages 的 `upload-pages-artifact@v4` 為 composite action，內部 artifact 上傳仍為 v4。現行 `deploy-pages@v4` 的內部執行階段為 Node.js 20。上游已有 Node.js 24 的 `deploy-pages@v5` 及新版上傳 Action，本次保留現有發布組合，升級留待可驗證實際部署的變更。npm 鎖檔與遊戲執行依賴維持原樣。

[發布協定](release-management.md) · [開發指標](development-metrics.md)

## Pipeline 3.1｜素材交付

**ChatGPT Images → ChatGPT Library → Work Asset Manager → Private GitHub → Codex → Work Release Manager**

1. ChatGPT Images 完成候選稿後，Work 使用已登入且獲授權的瀏覽器工作階段，從 ChatGPT Library 取得原檔。Work Asset Manager 保留原始位元組，將來源、候選狀態、尺寸、alpha 與 SHA-256 列入交付清單。
2. Work 將原始檔與候選衍生圖打包至私有 GitHub 分支，交接固定提交、路徑、ZIP 大小及 SHA-256。Codex 使用獲授權的唯讀 Git 取得同一份 ZIP，核對總大小與雜湊，安全解壓並核對 CRC 與逐項清單。
3. Codex 驗收畫面，將必要的最佳化執行圖與來源追溯資料提交至遊戲 PR。Work Release Manager 使用既有發版流程檢查 PR、CI 與部署，並依授權進行下一步。

批次 A 的交付紀錄為 **158 秒、人工介入 0 秒、17,560,997 bytes**。固定提交取得的 ZIP 與交付大小、SHA-256 完全一致，通過逐位元組等同性驗證。這組數字只涵蓋該次素材傳輸。來源與執行檔雜湊見 [批次 A 來源清單](forest-batch-a-provenance.json)。

瀏覽器登入與私有庫讀寫權限分屬不同階段。既有瀏覽器工作階段失效時，由具權限的人重新登入服務，交接紀錄只傳遞提交、路徑與雜湊。這次驗證的交付大小不能用來推定 ChatGPT Library 或 Work 的檔案大小上限。GitHub 網頁上傳單檔上限為 25 MiB，普通 Git 推送上限為 100 MiB。若後續交付超過已驗證的管道限制，可按批次拆包，逐包標記大小和雜湊，仍交接到固定提交。[GitHub 檔案大小限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

## 實機啟動事故與發版門檻

1. **記錄並恢復最後已知可用版。** 實機啟動阻斷時，記錄失敗版本、裝置、可見階段與最後核准 SHA。在獨立修復分支恢復已驗收的執行路徑。保留候選素材、提交歷史、測試與玩家資料。
2. **在孤立入口做變因隔離。** 由基準逐一增加下載、解碼、紋理註冊及場景渲染。通過診斷後，以同一順序建立獨立發版候選，保持正常入口可用。
3. **以發版候選的實機結果作為門檻。** CI 與桌面瀏覽器模擬先通過，之後由製作人在 iPhone／iPad Safari 與支援的主畫面模式驗證候選版冷啟動、重訪、重試及核心玩法。Work 確認受驗收 SHA 對應待發布提交。
4. **讓診斷從 HTML 啟動。** 在入口模組前建立可見階段和時限。顯示網路、解碼、註冊、必要幀、場景建立及首次繪製；區分必要資產鎖定及選用資產備援。日誌留在本機頁面，重試保留存檔。

[Batch B 事故比對與候選驗收](forest-batch-b-validated-reintegration.md)

5. **升版共用已驗收啟動路徑。** 讓候選與正式入口共用啟動程式，核對建置入口、必要資源與素材 SHA-256，再於兩個 URL 驗證載入、退化、重試及核心玩法。候選過關可準備升版，事故結案仍以正式入口的製作人實機驗收為準。
6. **保留可審查的復原。** 記錄最後核准 SHA 和升版提交，若正式入口回歸，以新 PR 反轉該次升版並重新驗證。保留候選、診斷、素材與玩家存檔，由獲授權人員確認復原發布。

[霧竹林生態 1.0 升版與復原紀錄](forest-ecology-v1-promotion.md)

### 霧竹林 2.0 升版

PR #37 候選實機 6／8、PR #38 修正實機 5／5。正式入口採用同一地標與渲染實作，素材須與受驗收提交逐位元組相符；角色診斷留在候選入口。製作人於正式 URL 完成驗收後，才將 Forest 2.0 標為新的正式基準。若遇阻斷，透過受保護 PR 將正式入口切回已核准 Batch B，保留其他入口、歷史與存檔。[升版、品質證據與復原程序](forest-v2-production-promotion.md)

## AI Development Pipeline 4.0｜任務控制台 2.0

Forest 2.0 已成為穩定基準。PR #39 合併提交為 `62e590f665781822ac48bf691e6507f920bf6b68`，製作人提報 Safari 實機 5／5。影空移動 1.1、森林水系 1.0、森林生態 1.0、森林地標與風靈 1.0 沿用已接受版本。

用單一登錄記錄任務依賴、手動交接、提交與證據，並限制三條獨立製作流加一條發布或品檢流。從 `/mission-control/` 查閱一項優先製作人行動。唯讀 GitHub 結果以有時間戳的快照呈現。狀態來源、量測與重複回報規則見 [任務控制台手冊](ai-mission-control.md)。發布授權、保護及實機品質門檻沿用現有 [發布協定](release-management.md)。

### 7A-3｜PR #40 發布門檻

製作人已授權 Pages 建置工作使用 `contents: read`、`actions: read`、`pull-requests: read` 查詢任務快照。部署權限與儲存庫保護維持既有設定。排程改用相同的儲存庫相對路徑比較鍵，拒絕跳脫或無法判定的範圍，並保守處理大小寫與父子目錄。PR #40 已登錄為待審閱。快照只有在授權建置後更新，未知與過期仍明示。[修正與權限邊界](ai-mission-control.md)

### 7A-5｜驗收結案與並行製作

PR #40 製作人 iPhone Safari 6／6，Mission Control 2.0 基礎結案。Forest 2.0 仍是穩定遊戲基準。三個獨立設計分支及一個品檢分支可排程。四項都完成後才審查整合契約，製作人核准後才開始實作。共用場景由單一整合分支負責。[12 月 22 日展示、依賴及寫入範圍](forest-v3-production-plan.md)
