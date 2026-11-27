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
