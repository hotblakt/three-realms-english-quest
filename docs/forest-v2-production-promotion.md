# 霧竹林 2.0｜正式入口升版

本分支以 PR #38 的 `efec7b1960cd5f02423ad63a8037f22153916b9b` 為基準，把已驗收的森林地標與風靈系統 1.0 接到 `/forest-preview/`。PR #36 的 `afb60145c4cda66db8e1a82e2e34216a7993649b` 是上次已接受的 Batch B 正式配置。Forest 2.0 將在授權發布及正式入口實機驗收後成為新基準。

## 製作人實機證據

PR #37 候選為 6／8，PR #38 修正為 5／5。製作人在 Safari 確認開放路徑待機、神龕後方待機 30 秒、反覆 Run → Idle、神龕恢復透明度及自然風靈效果。這組證據適用於已接受的候選入口。原始 Safari 回報的根因尚未完全確定，正式入口升版仍需實機驗收。[遮擋調查紀錄](forest-batch-c-visibility-fix.md)

## 入口與穩定系統

正式入口與 Batch C 候選共用已驗收的 `launchForest` 和同一個地標準備函式。候選才傳入角色紀錄的觀察函式，正式介面沒有這個按鈕，且不請求觀察模組。Batch B 比較入口與 A–E 診斷維持原用途。未另製地標渲染規則，也未修改神龕淡化公式。保留 Eiku Movement System 1.1、Forest Water System 1.0、Forest Ecology System 1.0、原木橋、碰撞、路線、互動、英語學習、存檔及 PWA。

沿用 PR #36 啟動架構。Batch B／C 各自下載並驗證 SHA-256、顯式解碼及註冊紋理，選用管線各有五秒時限。Batch B 失敗會用原竹林，Batch C 失敗會用原地標。四向 Run／Idle 保持必要門檻，二十秒看門狗、首次繪製完成及重試保留本機資料的行為維持原設定。

## 素材與記憶體

55 個既有 `public` 檔案加上 Batch C 圖集，共 56 個檔案與 PR #38 和 `dist` 的 SHA-256 相符。接受的素材來源分別為 [Batch A](forest-batch-a-provenance.json)、[Batch B](forest-batch-b-provenance.json) 與 [Batch C](forest-batch-c-provenance.json)。Batch C 的來源提交為 `471479f70e2d8e67d3a9a7d184ad2c71c5eda3e3`，執行圖集 SHA-256 為 `f5cd72a801cb554046d995cc9fbe99c202033f0e433d0d90c3000a6d922c8e35`。圖集維持 640 × 336 無損 WebP，191,210 bytes、0.820 MiB RGBA。預設 256 px 角色的全場景紋理約 52.09 MiB（Batch B 基準 51.27 MiB 加 0.82 MiB）。此估算不含 Canvas、GPU 暫存或切換較大角色圖集後的快取。

## PR 復原程序

若尚未發布，維持現有公開版。若升版發布後正式入口有阻斷，由目前 `main` 開復原分支，透過受保護 PR 把正式 HTML 的入口模組改回 Batch B 啟動模組。保留候選、A–E 診斷、素材、歷史與玩家存檔。若採完整反轉，僅反轉本次升版合入所對應的提交，例如 merge commit 可用 `git revert -m 1 <升版合併提交>`，squash commit 則直接反轉該提交。以 PR #36 和升版前 PR #38 正常入口為比對基準。通過 CI 及正式子路徑複驗後，由有權限人員批准、合併及部署復原；核對正式入口使用 Batch B，並複驗 Safari 冷啟動、重訪、走動及存檔保留。

## 開發指標

新增或重壓縮圖集 0 件，付費呼叫 0 次，人工介入 0 秒。最終驗收門檻及復原流程同步記錄於 [AI 開發流程](ai-development-pipeline.md)。

## 自動化品質證據

- `npm ci`、正式建置、54 項 Node 及 10 項 Python 測試均通過。第一章進村、工作台往返、Batch B／C 候選及 A–E 診斷均通過 Chromium 煙霧測試。
- GitHub Pages 子路徑下，模擬 iPhone／iPad 橫向各通過一次冷啟動及三次重訪，強制 Canvas／WebGL 均繪製 Batch B 與 C。注入 Batch B 404 時保留 Batch C，Batch C 缺檔、停滯、解碼及紋理註冊錯誤時保留 Batch B。必要動畫缺檔或停滯保持鎖定，移除故障後重試保留本機儲存標記。
- 正常入口四向移動、北向收步足點、竹冠遮擋、溪岸碰撞、木橋、神龕、寶箱、捷徑、減少動態與兩種行動橫向觸控通過。正常入口神龕後側在第 1、5、15、30 秒的 Canvas 差分分別為 3,535、3,585、3,540、3,586 個角色像素。
- 使用 `node scripts/check-forest-idle-rendering.mjs http://localhost:5173 canvas --production` 或用 `webgl` 取代 `canvas` 可複驗。這沿用候選版既有的外部 Playwright 測試，並擴充為正式入口實測及固定鏡位比對，不需添加遊戲依賴。
- Canvas 和 WebGL 各通過六組 Run／Idle 實際繪製檢查。開放石徑、木橋、神龕前、神龕後及回到神龕前共五個固定畫面，正式入口與 Batch C 候選在各渲染器內的 PNG 完全一致。回到前方時神龕透明度恢復為 1。

本輪從取得基準到完成本機品質檢查的實測經過時間為 2270 秒。
