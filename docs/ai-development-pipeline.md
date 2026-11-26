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
