# 霧竹林可步行原型

從美術工作台選「遊玩霧竹林原型」，或開啟 [GitHub Pages 預覽路徑](https://hotblakt.github.io/three-realms-english-quest/forest-preview/)（合併部署後生效）。入口內循石路走到溪邊，從木橋過溪。西側岔路可找寶箱。北側鳥居通往靈伴留聲處，其東側支路可回南入口。鍵盤可用方向鍵或 WASD、J 揮劍、空白鍵閃避、E 互動。觸控使用搖桿和右側按鈕。

原型為獨立 Vite 頁面，重用影空、輸入、揮劍、Phaser Arcade 與橫向版面。場景的地表、溪水、橋面、阻擋和依腳點排序的景物分層。相機跟隨角色，受地圖邊界限制。寶箱、靈伴提示與捷徑僅使用本次遊玩的記憶體狀態。

## 素材與處理

[素材清單](misty-forest-runtime-assets.json)記錄固定的來源 commit、ZIP SHA-256、全部十張原始 PNG 的尺寸與雜湊，以及每張 WebP 的尺寸、檔案大小、雜湊和 Phaser 原點。來源裁切矩形為相對原圖尺寸的 `[左, 上, 右, 下]`。獨立物件完成裁切後再依 alpha 包圍盒去空白，並等比例降採樣。地面與溪水裁片用來平鋪，溪水裁片單獨套用在溪道輪廓內。橋與溪岸、鳥居與兩盞燈採原構圖，避免切斷橋架、草根與燈旁落光。岩石拆出大小兩種，寶箱拆成開關件，底霧與靈伴的局部霧各用一張。

- 地面原稿為 RGB，其餘九張為 RGBA。物件壓掉 1–3/255 的零散 alpha，保留陰影與半透明邊。霧只清掉 1/255，避免切出硬線。
- 地面邊緣做 34 px 羽化，相對兩側最外列逐像素相等，並驗證無損 WebP 解碼。3×3 並排圖左為調整前、右為調整後。大面積仍可看出苔紋重複。
- 橋和鳥居色彩較亮，搬入場景時用環境色調壓低。橋圖與延伸溪床的交界仍可看出材質和水勢差異。岩石中號件、霧光圖的金色斜光束留在原稿庫，這版採兩種岩石和局部燈光，減少重疊及明亮區域。
- 十張原稿皆留在私有素材庫。公開庫的紋理為 14 張無損 WebP，約 0.87 MiB，單以圖片像素估算 RGBA 展開約 2.23 MiB。霧、落葉、漣漪採少量定位精靈，減少動態時停播環境運動。實機 Safari 的首屏載入、GPU 記憶體及長時間畫面速率仍待量測。

## 預覽與驗證

- [南側入口](../art/preview/misty-forest/entrance.webp)
- [木橋過溪](../art/preview/misty-forest/bridge.webp)
- [北側鳥居](../art/preview/misty-forest/shrine.webp)
- [西側寶箱](../art/preview/misty-forest/treasure.webp)
- [模擬 iPhone 橫向](../art/preview/misty-forest/iphone-landscape.webp)
- [地面 3×3 前後對照](../art/preview/misty-forest/ground-3x3.webp)

執行 `npm ci`、`npm run build` 和 `node --test tests/*.test.mjs`。用 `npm run preview` 檢查正式建置的工作台入口和子路徑素材。瀏覽器驗收可從南入口沿主路至鳥居，嘗試離橋過溪、穿行竹叢前後、開箱、查看靈伴提示與用捷徑折返。橫向版面測試包含桌面 1100×625、模擬 iPad 1180×820 和模擬 iPhone 852×393。
