# Three Realms: English Quest

A browser-based top-down action RPG built with Phaser 3, TypeScript, and Vite. In **Chapter 1 — The Awakening of Wind**, teenage ninja Eiku trains in Hidden Bamboo Village. The village and characters use original provisional game artwork.

## Run locally

Use Node.js 20.19+ or 22.12+ (modern LTS recommended) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For an iPad or iPhone on the same network, open the displayed network URL in Safari and rotate to landscape. The development server listens on all interfaces, so use a trusted network. No account, API key, or external service is required.

```sh
npm run build
npm run preview
```

The build type-checks the project and emits static files into `dist/`. Preview serves that production build. For a clean install from the committed lockfile, use `npm ci`.

## 第一章「風之覺醒」

| 操作 | 鍵盤 | 觸控 |
| --- | --- | --- |
| 移動 | WASD 或方向鍵 | 左側搖桿 |
| 面向目標揮劍 | J | 揮劍 |
| 短距離閃避 | 空白鍵 | 閃避 |
| 對話、啟動石陣或讀取風語石 | E | 互動 |

1. 點「進村探險」，往北找玄翁長老。面向稻草人揮劍，再練一次閃避。
2. 到村莊左側「竹林試煉」入口互動，依金色標記到西南、西北及東北石陣。每處有兩波風靈。金色範圍亮起時移開，等風靈攻擊後反擊。
3. 在東南收下風之碎片，回南側風語石跟念一次。錄音、回聽與朗讀皆可選，按「輔助練習」，或辨識相符後按「繼續試煉」。
4. 到北側石陣喚醒風之守衛。避開金圈和直線風痕，等守衛進入回復期再反擊。擊敗後解鎖風刃，同一個揮劍按鈕會打得更遠，石陣上的稻草人可用來試招。
5. 失去所有生命會回到目前關卡的檢查點，回滿生命並保留已完成的石陣。重新載入也會接續目前關卡。開新遊戲可使用無痕視窗；清除本網站資料會移除既有進度。

Demo 的首次遊玩目標是約 10–15 分鐘。自動走流程用於驗證通關，遊玩時長還需要以目標年齡玩家的首次試玩評估。

## Code layout

- `src/scenes` contains the title and village scenes and village artwork.
- `src/entities`, `src/combat`, and `src/input` contain character state, sword behavior, and keyboard and touch input.
- `src/quests`, `src/progression`, and `src/save` contain chapter metadata, checkpoints, and versioned local storage.
- `src/speech` defines the speech recognition contract for a future implementation.
- `src/i18n/zh-TW.ts` contains the Taiwanese Traditional Chinese game text. Use `data-text` and `data-label` for markup, and import `messages` for dynamic text. Keep save identifiers and intentional English-learning content independent of UI translations.

## 英語跟讀練習

和玄翁長老對話可練習介紹佩劍或出發用語。取得風之碎片後，風語石會先引導玩家練習 **I can run.**，再挑戰守衛。兩處的「選擇句子」都能選到六課，其他句子可以自由練習。各課的中文提示、難度、情境和獎勵定義於 `src/learning/lessons.ts`。

- 點「聽英文」或「慢速英文」可聽瀏覽器示範。展開「提示與錄音」可聽繁中提示、錄音或回聽。錄音在目前練習中暫存，離開時清除。
- 「語音辨識」會顯示 en-US 辨識文字。比對忽略大小寫、標點與常見語助詞。主要結果有明確文字時，即使備選文字相符，仍以主要結果為準；若主要結果只有語助詞或空白，才採用完整相符的備選。相符只代表文字對上，沒有發音評分。
- 未支援、權限遭拒或收音失敗時，仍可跟念後選「輔助練習」。風語石的指定句可用任一方式完成。各課只在首次完成時給英文經驗值，輔助完成之後可升為辨識完成，重練與提升狀態都不重複給分。已完成的課仍可重練。
- 學習進度獨立於既有章節存檔，只保存課程狀態及已獲經驗值。遊戲不保存語音檔或辨識文字。辨識由瀏覽器處理，可能使用瀏覽器供應商的遠端服務，無法保證離線。錄音需要 HTTPS 或 localhost。

iPad 與 iPhone 驗收請分別於 Safari 分頁和主畫面版，在長老和風語石都實念六課。刻意說錯動詞、省略助動詞、使用否定，再測試首次授權、拒絕、斷網、旋轉中止、切到背景重試及手動錄音回聽。最後重新載入，確認經驗值與狀態保留，並以輔助練習完成章節測一次。

在 Node.js 24 可執行 `node --test tests/*.test.mjs`，驗證章節、學習進度、舊存檔、文字比對、備選文字與音訊生命週期。測試中的辨識事件由替身提供。

## 在 iPad 或 iPhone 從主畫面啟動

1. 用 Safari 開啟 [三界：英語探險](https://hotblakt.github.io/three-realms-english-quest/)。
2. 點「分享」，再點「加入主畫面」。若有「以網頁 App 開啟」選項，請開啟它，再點「加入」。
3. 回到主畫面，點「三界探險」，把裝置轉成橫向。在支援獨立視窗的 iOS 版本中，透過主畫面啟動時會使用獨立視窗。從 Safari 分頁開啟時，工具列仍由 Safari 管理。

### iPad 與 iPhone 實機驗收

- **安裝與啟動**：在兩種裝置確認主畫面圖示、繁中名稱與啟動路徑。從圖示啟動後，確認沒有一般 Safari 分頁的網址列與分頁列。
- **工具列及安全區**：用 Safari 分頁開啟，測試顯示或收合工具列、左右兩個橫向方向、iPhone 瀏海和主畫面指示條是否遮住按鈕。iPad 也可試分割畫面。
- **方向與操作**：在村莊與跟讀畫面轉直向再轉回。確認提示出現、遊戲停住、錄音取消，轉回後能繼續。測試雙指移動加攻擊、對話捲動與 VoiceOver 的按鈕標籤。
- **音訊與存檔**：在 Safari 與主畫面版本各自測試麥克風允許及拒絕、錄音回聽和中英文朗讀。完成訓練後從同一入口重新開啟，確認進度保留。

## Milestone 5A 美術

- 村莊地表、石板路、竹林、屋瓦、池塘和鳥居使用專案內的原創繪圖。地表與竹林在場景第一次建立時烘成兩張貼圖，後續只更新燈光和少量落葉。
- `src/art/actorArtwork.ts` 繪製影空與玄翁長老的暫用貼圖。正式影空圖集的命名、四向動作與腳底對齊見[圖集規格](art/production/eiku/README.md)。遊戲可在正式圖集交付後載入，碰撞本體獨立於美術。
- 影空與玄翁長老的角色圖、房屋與樹木細節、稻草人及風系特效為本里程碑暫用的原創遊戲內美術。正式角色圖集、逐格揮劍與閃避動作、長老對話立繪仍待製作。

## 影空美術工作台

GitHub Pages 路徑為 [影空美術工作台](https://hotblakt.github.io/three-realms-english-quest/art-workbench/)。本機開發時可在 `npm run dev` 的網址加上 `/art-workbench/`；正式預覽沿用 GitHub Pages 的專案子路徑。工作台使用遊戲的隱竹村場景素材與現用角色正面影格。100% 為遊戲世界倍率，候選格使用 2/3 倍。可切換原始圖、背景和取樣方式，調整候選格的位置，或展開僅供參考的四向待機動畫。工作台和遊戲是兩個獨立的建置入口。

## 6D 世界與美術規劃

- [美術指引與現況稽核](docs/art-direction.md)
- [製作規格、6D-2／6D-3 順序及首件生成提示](docs/asset-production-guide.md)
- [三界架構與霧竹林路線](docs/world-design.md)
