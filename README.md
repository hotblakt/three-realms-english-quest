# Three Realms: English Quest

A browser-based top-down action RPG built with Phaser 3, TypeScript, and Vite. In **Chapter 1 — The Awakening of Wind**, teenage ninja Eiku trains in Hidden Bamboo Village. The village and characters use original placeholder artwork drawn in Phaser.

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

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move in four directions | WASD or arrow keys | Left joystick |
| Sword slash in facing direction | J | 揮劍 |
| Dodge in facing direction | Space | 閃避 |
| Talk to Elder Geno / advance dialogue | E | 對話 / 繼續 |

## Test the playable route

1. Open the title screen and select **進村探險**.
2. Follow the path north. Press **E** or **對話** near Elder Geno. Close his dialogue and check that the objective changes to practicing on the straw dummy.
3. Walk east to the straw dummy, face it, and slash within range. The dummy recoils and the HUD displays **風之訓練完成！**. Reload and enter again to check that the objective persists. Clear this site's local storage to restart the chapter objectives.
4. Move against a hut to check collision. Walk onto the thorn patch southwest of the spawn to lose health. Check that a dodge moves Eiku faster, briefly protects him from damage, and has a cooldown. At zero health, Eiku respawns at the starting point with full health.
5. Repeat on iPad and iPhone Safari in landscape. Check joystick release, pressing an action while holding the joystick, and visibility of the HUD, dialogue, and controls near the screen edges.

## Code layout

- `src/scenes` contains the title and village scenes and village artwork.
- `src/entities`, `src/combat`, and `src/input` contain character state, sword behavior, and keyboard and touch input.
- `src/quests`, `src/progression`, and `src/save` contain chapter metadata, training steps, and versioned local storage.
- `src/speech` defines the speech recognition contract for a future implementation.
- `src/i18n/zh-TW.ts` contains the Taiwanese Traditional Chinese game text. Use `data-text` and `data-label` for markup, and import `messages` for dynamic text. Keep save identifiers and intentional English-learning content independent of UI translations.

## 英語跟讀練習

在吉諾長老的對話選「英語跟讀」。點「聽長老說」或「重播英文」可聽瀏覽器朗讀。可用的聲音依裝置和瀏覽器而定，畫面也會顯示文字。

1. 點「開始錄音」，允許麥克風，念出 **I can run.** 後點「停止錄音」。每次最多錄 15 秒。
2. 點「聽我的錄音」確認有聲音，然後「回到對話」。錄音只在目前的練習畫面保留，離開時會清除。這個練習目前沒有辨識、評分或完成判定。
3. 封鎖麥克風權限並重試，確認畫面顯示中文提示，仍可閱讀句子及返回。錄音需要 HTTPS 或 localhost。
4. 在 iPad Safari 橫向開啟 GitHub Pages 網站，確認第一次授權、拒絕後重試、停止與回聽、離開時麥克風指示消失，以及中文與英文聲音是否可用。檢查瀏覽器工具列展開時的按鈕位置。

在 Node.js 24 可執行 `node --test tests/audio-capture.test.mjs` 驗證擷取流程、拒絕權限與音軌清理。這些測試使用替代的媒體物件。

## 在 iPad 或 iPhone 從主畫面啟動

1. 用 Safari 開啟 [三界：英語探險](https://hotblakt.github.io/three-realms-english-quest/)。
2. 點「分享」，再點「加入主畫面」。若有「以網頁 App 開啟」選項，請開啟它，再點「加入」。
3. 回到主畫面，點「三界探險」，把裝置轉成橫向。在支援獨立視窗的 iOS 版本中，透過主畫面啟動時會使用獨立視窗。從 Safari 分頁開啟時，工具列仍由 Safari 管理。

### iPad 與 iPhone 實機驗收

- **安裝與啟動**：在兩種裝置確認主畫面圖示、繁中名稱與啟動路徑。從圖示啟動後，確認沒有一般 Safari 分頁的網址列與分頁列。
- **工具列及安全區**：用 Safari 分頁開啟，測試顯示或收合工具列、左右兩個橫向方向、iPhone 瀏海和主畫面指示條是否遮住按鈕。iPad 也可試分割畫面。
- **方向與操作**：在村莊與跟讀畫面轉直向再轉回。確認提示出現、遊戲停住、錄音取消，轉回後能繼續。測試雙指移動加攻擊、對話捲動與 VoiceOver 的按鈕標籤。
- **音訊與存檔**：在 Safari 與主畫面版本各自測試麥克風允許及拒絕、錄音回聽和中英文朗讀。完成訓練後從同一入口重新開啟，確認進度保留。
