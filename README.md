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
3. 在東南收下風之碎片，回南側風語石跟念一次。錄音、回聽與朗讀皆可選，按「練習完成」即可繼續。
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

在玄翁長老的對話可先試「英語跟讀」，取得風之碎片後也會在風語石遇到這項挑戰。點「聽長老說」或「重播英文」可聽瀏覽器朗讀。可用的聲音依裝置和瀏覽器而定，畫面也會顯示文字。

1. 點「開始錄音」，允許麥克風，念出 **I can run.** 後點「停止錄音」。每次最多錄 15 秒。
2. 點「聽我的錄音」回聽。錄音只在目前的練習畫面保留，離開時會清除。在風語石由玩家自行確認「練習完成」，目前沒有語音辨識或評分。
3. 封鎖麥克風權限並重試，確認畫面顯示中文提示，仍可閱讀句子、開口跟念並按「練習完成」。錄音需要 HTTPS 或 localhost。
4. 在 iPad Safari 橫向開啟 GitHub Pages 網站，確認第一次授權、拒絕後重試、停止與回聽、離開時麥克風指示消失，以及中文與英文聲音是否可用。檢查瀏覽器工具列展開時的按鈕位置。

### 風語石的瀏覽器語音辨識

在風語石可選「語音辨識」，念出 **I can run.**，畫面會顯示瀏覽器辨識出的英文。文字比對忽略大小寫、標點及常見的英文語助詞 um、uh、erm，保留否定與不同單字。相符訊息只代表文字對上，沒有發音分數。辨識結果不寫入存檔，也不會自動推進章節。

語音辨識使用瀏覽器的 SpeechRecognition 或 webkitSpeechRecognition，與手動錄音分開使用。不同瀏覽器、iOS 版本與主畫面模式的支援、權限及隱私行為可能不同。瀏覽器可能將語音送至自己的遠端服務處理，無法保證離線，也未加入遊戲自己的辨識伺服器。未支援、權限遭拒或網路失敗時，仍可跟念並按「練習完成」。

請分別在 iPad 和 iPhone 的 Safari 分頁及主畫面版實測 en-US 語音辨識、首次授權與拒絕、斷網、停止與重試、辨識途中旋轉到直向或切到背景，以及返回後切換錄音／回聽。現有測試以替代的辨識事件覆蓋狀態流程，不能驗證 Safari 的實際文字結果。

在 Node.js 24 可執行 `node --test tests/*.test.mjs`，驗證音訊擷取、章節順序、舊存檔移轉、語音失敗時的進度，檢查點與攻擊範圍，以及語音轉文字的介面、比對、重試與清理。

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
