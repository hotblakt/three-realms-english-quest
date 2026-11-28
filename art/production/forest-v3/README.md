# 7C-B1｜霧竹林 3.0 角色美術製作準備

Production B · Batch 002 · AI Development Pipeline 4.0。基準為 PR #42 合併提交 `9721c466691c33de53a03d653b1673b50ed002c4`。第一優先是疾風身份主圖。四個新角色的主圖、方向與動畫均待製作人核准。本批交付文字規格與離線查驗工具，生成費用與可用點數未取得資料。

- [角色主圖製作簡報及四份獨立提示](character-masters.md)
- [動畫、執行規格、品檢與交接](animation-and-acceptance.md)
- [候選紀錄範本](candidate-manifest.template.json) · [候選本機驗證器](validate-candidate.py)

## 核對依據

| 已檢閱參考 | Batch 002 採用方式 |
| --- | --- |
| [疾風設計](../../../docs/production/hayate-companion-design.md) | 白毛、青藍紋、喉前鈴、左側圍巾結及四向足點。已審閱私有美術庫正式清單，未找到可驗證的疾風核准主圖。 |
| [戰鬥設計](../../../docs/production/combat-system-design.md) | 竹芽扇形、風籽線形、守護者扇掃及震波，造型與地面傷害範圍各自定義。 |
| [整合契約](../../../docs/production/forest-v3-integration-contract.md) · [素材製作計畫](../../../docs/production/forest-v3-asset-production-plan.md) | 以 12 月 22 日展示的素材順序、足點、P0 解碼上限與戰鬥事件為準。僅採疾風反擊窗提示，風護延後。 |
| [核准影空南向主圖](../../reference/eiku-v2-south-master.png) · [四向驗收](../../../docs/eiku-multidirection-actions.md) | 原圖的黑髮、琥珀眼、深炭服、藍圍巾與局部暖金呈現清楚明暗層次。保留既有裝備位置和動作比例，場景畫質以已核准 runtime 四向對照。 |
| [Forest 2.0 正式升版](../../../docs/forest-v2-production-promotion.md) · [手機神龕](../../preview/forest-batch-c/iphone.webp) · [橋面](../../preview/forest-batch-c/bridge.webp) | 核對斜俯視地面、青色溪水、暖石燈與深竹冠。淺霧底要保住疾風輪廓，竹葉背景上仍須辨識竹芽，風籽亮紋避開溪水亮度，守護者陰影與神龕不可混成一塊。 |

製作人依序審閱主圖、四方向與動畫，再審查整合候選。Production A、C 與 QA 可並行。A 提供安全腳點和六個取景位置，C 提供實際事件窗及警示形狀，QA 與整合分支驗證真機、選用素材備援和同時記憶體峰值。
