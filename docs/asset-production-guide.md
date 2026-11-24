# 美術資產製作規格

## 座標與交付

以世界座標像素為基準，沿用 720 × 400 的遊戲視窗與 2.5D 三分之四角度。下表的執行尺寸是首輪驗收值；畫布留白、物件占地與碰撞由放置資料固定。正交投影，垂直線維持垂直，方向與光源依[美術指引](art-direction.md)。透明交付用直通道 RGBA，檢查髮尖、半透明霧與 alpha 邊在深淺底的表現。素材比對在實際 100% 遊戲尺度，120% 用來查邊。

高解析分層原稿留在 `art/source/<category>/` 或外部授權的原稿庫，工作台候選放 `art/preview/<asset>/`，核准後才匯出至 `art/production/<category>/`。Vite 僅由正式或工作台入口選擇性引入，不把原稿庫放在 `public/`。既有工作台按需載入的參考檔仍可沿用。

## 分類規格

以下尺寸為像素；主稿以分層 PSD／KRA 或原始 PNG 留存。名稱以小寫短橫線為主，圖集影格沿用既有約定。

| 類別 | 主稿 → 執行尺寸／格式 | 透明度、透視、原點、圖層 | 例名及匯入、驗收 |
| --- | --- | --- | --- |
| 角色主圖 | 2048 × 2048 或以上 → 不進遊戲，審查 PNG 1024 × 1024 | 透明角色層與背景／陰影分開。四向維持頭身、同一鏡頭，標腳底中點。 | `eiku-v2-south-master.png`。對照核准設定；按比例縮小初測剪影。 |
| 四向角色與待機／行走／揮劍／閃避 | 單格主稿至少 768 × 768 → 96 或 192 格透明 PNG 圖集與 JSON | 四向獨立繪製，支撐腳穩定，站姿高 62–66（2× 為 124–132），腳底 (48,72) 或 (96,144)。角色深度依腳底，劍氣、地影分離。 | `eiku/south/idle/00` 等。沿用每向每動作 8 格，待機 6、步行 12、揮劍 32、閃避 50 FPS。停播後回到原地，不裁切、旋轉或鏡像。驗證完整鍵、循環接點、腳底及武器遮擋。 |
| NPC 立繪 | 1536 × 1536 → 384–512 方形透明 WebP／PNG | 胸像、平視或微俯，視線向對話對象，底部中央對齊面板。 | `geno-portrait-calm.webp`。對話按需載入，測窄橫向面板不遮字。 |
| 敵人與靈伴 | 單格 512–768 → 小型 96–128、守衛 192 方格 RGBA PNG + JSON | 俯視、人與靈伴同一平面，浮空件也用地面投影錨點。輪廓區分遊戲角色，攻擊預警獨立。 | `wind-guardian/north/idle/00`、`mist-spirit/south/idle/00`。對照真實戰鬥範圍、遮擋及警示形狀。 |
| 地表與地磚 | 無縫 1024–2048 → 128–256 平鋪 WebP，過渡用 RGBA PNG | 俯視平面，左上原點；主地表可全不透明，過渡需透明邊。 | `forest-ground-moss-01.webp`。重複鋪 3 × 3 檢查接縫、方向、對比。 |
| 建築與屋瓦 | 2048 方形分層 → 每件 256–512 RGBA PNG | 屋身與屋瓦分檔，共用牆基正面中點。牆身獨立碰撞，屋瓦可淡化。 | `village-house-a-body.png`、`village-house-a-roof.png`。測前後走動與足點，屋瓦淡化時牆面保持清楚。 |
| 竹林與植栽 | 1024 方形 → 256 RGBA PNG | 同視角、竹根中點定位，靠路的竹叢依根排序；遠林可合成，前景保留獨立件。 | `forest-bamboo-clump-01.png`。走過根深度測遮擋，剪影避免大塊遮滿路面。 |
| 岩石、橋、水、燈籠 | 1024–2048 → 128–384／件；水 128–256 平鋪 WebP，其餘 RGBA PNG | 岩石／燈籠用底部中心；橋面用左上角，橋欄依欄腳排序；水底層與透明岸緣分開。水、橋通行資料獨立於圖像；燈光獨立。 | `forest-rock-01.png`、`forest-bridge-deck.png`、`forest-water-still.webp`、`forest-lantern-01.png`。測橋面可通行、岸線碰撞、燈光與前景。 |
| 寶箱與互動物 | 768 方形 → 96–128 RGBA PNG | 開關各狀態同一箱底中心。層級隨錨點，互動區另外定義。 | `forest-chest-closed.png`、`forest-chest-open.png`。驗證狀態切換不跳位、兩方向靠近皆可互動。 |
| 地影、粒子、燈光 | 256–512 → 32–128 RGBA PNG | 地影與燈光用中心錨點；風痕各自分層，柔透明漸層無破邊。 | `fx-contact-soft.png`、`fx-leaf-01.png`、`fx-glow-warm.png`。測深淺地面、低動態模式、粒子批次與透明疊加。 |
| UI 圖示與面板 | 256–1024 → 圖示 48／96 PNG 或 SVG，面板切片 128–256 PNG | 正視，圖示置中，面板邊角可延展；透明邊無色暈，UI 獨立於世界。 | `ui-icon-companion.png`、`ui-panel-dialogue.png`。測亮暗對比、繁中長字串、44 px 以上操作區、iOS 安全區。 |

## 96／192 比較與預算

1. 先做同一張 96、192 px 候選。192 採 1/3、96 採 2/3，顯示高度都約 41–44 世界單位，碰撞體與腳底位置保持相同。用工作台比較 100% 與 120%，在裝置上截取同一路段、屋瓦遮擋、靜止臉部及快動作。固定內部畫布可能限制高解析收益。
2. 以現有鏡頭為基準，另在隔離測試將鏡頭放大到 1.1×。檢查是否仍看得到守衛預警、前方路線、HUD 和觸控；若縮減視野或掉幀，保留原鏡頭。測試 Phaser 實際畫布輸出，避免以 CSS 放大冒充解析度提升。
3. 192 px 完整四向可試每動作一頁 8 × 4、裁格間各留 2 px，196 格距約 1568 × 784。一頁解碼約 4.7 MiB，四頁約 18.8 MiB（RGBA、不含額外副本）。現行單頁載入器不直接接受此格式。實測畫質有益後才增加可選多頁描述，保留舊 JSON 與現用備援。
4. 起始驗收預算：單一貼圖邊長 ≤2048 px，每區環境圖解碼合計約 ≤16 MiB，共用光影/UI ≤4 MiB，活躍角色／敵人約 ≤24 MiB，常駐貼圖目標約 ≤48 MiB；網路首區新增壓縮資產約 ≤4 MB。這些是工程預算，未經實機基準實測。切區先載目的區，再釋放無引用的舊區資源，量測轉場時的尖峰；不可只用 PNG 檔案大小替代記憶體估算。
5. 用既有貼圖快取、相同圖集批次與靜態合層。霧只用少量位圖疊加，行動版保留已有限量的風葉；裝置以 60 FPS 為目標、持續低於 30 FPS 或掉幀影響躲避就退回 96 格或減少透明層。用 Safari 實機走村口、屋後、守衛區及兩次切區，確認控制可用並記錄幀時間、讀取時間及重載狀況。

## 6D-2 / 6D-3 優先順序

| 階段 | 順序 | 交付與先決條件 |
| --- | --- | --- |
| 6D-2 | P0・第一件 | 霧竹林前景竹叢 A 單件。先審剪影、根點、透明邊及角色穿越遮擋。 |
| 6D-2 | P0 | 與首件同筆觸的疏竹 B、林地與石路過渡、遠處霧層、扣住村口的入口地標。只做一小段可比較的垂直切片。 |
| 6D-2 | P1 | 少量岩石、暖燈、寶箱開關與橋／岸樣件，校對占地及互動。成果先於工作台或獨立預覽審閱。 |
| 6D-3 | P0 | 手修影空南向眼部、銀牌和風紋；同一姿勢試 96／192，核准後各畫北、西、東站姿。 |
| 6D-3 | P0 | 四向走、待、攻、閃，先跑通一個方向的輸出與戰鬥驗收，再完成剩餘方向。 |
| 6D-3 | P1 | 霧竹林風靈、靈伴剪影與玄翁立繪，補少量霧、光和掉落提示。收藏系統另案。 |

### 首件生成規格：霧竹林前景竹叢 A

交付一張 1024 × 1024 RGBA PNG（可分層原稿另存），目標執行圖 256 × 256。竹根群基準點 `(512,848)`，縮圖後 `(128,212)`。有效輪廓包含 5–7 株成熟竹、兩小支嫩葉，主要占約 640 × 760 px，保留至少 48 px 透明邊。同一俯視三分之四角度，光從左上，葉片成組分層；值域低於守衛預警，恰好可顯示角色在竹後。畫進剪影裡的竹根與葉梗可以接地，地面陰影、霧、地磚則另外疊加。輸出檢查透明度、剪影、落點及尺寸；生成結果若不精確，重新定位畫布並手修，經使用者核准才進正式圖集。

**ChatGPT Image Generation 提示詞（英文）：**

> Create ONE original transparent prop for an elegant hand-painted Japanese anime fantasy action RPG named Three Realms: English Quest: a foreground clump of bamboo for the Misty Bamboo Forest. Deliver a 1024×1024 PNG with genuine transparent background. Use orthographic top-down three-quarter view, camera looking down about 30 degrees, vertical trunks upright on a shared ground plane. Paint five to seven mature, subtly curved bamboo stems with distinct joints and grouped pointed leaves, plus two small shoots at the base. Use deep bamboo green #263F35, muted mid green #527356 and restrained cool teal in the shadows; soft diffuse light from upper left. Elegant hand-painted anime environment art, readable groups of leaves, calm and atmospheric. Center the cluster, with the root contact center at pixel (512, 848); visible silhouette roughly 640 pixels wide by 760 pixels tall; at least 48 pixels of transparent padding on every edge. Stagger the stems so a small character behind the clump can remain partially visible. Single isolated prop only. No floor, no baked shadow, no background, no mist, no text, no frame, no checkerboard, no pixel art, no copyrighted characters or franchise references. Keep all leaves and roots inside the canvas. The asset must read clearly when reduced to 256×256.
