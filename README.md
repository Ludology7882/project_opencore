# 外掛模擬器 (Plugin Simulator) — MVP v1.0

以 MMORPG 外掛（如 **OpenKore**）為介面的文字冒險／掛機模擬遊戲。
你**不直接控制角色**，而是透過編輯設定檔 `config.txt` 讓角色自動練功、補血、撿物、買賣，
然後觀看滾動日誌、比較結算效率，找出最有效率的練功與賺錢組合。

> 本專案為依據《外掛模擬器 GDD v1》製作的可執行原型（v1.0 範圍）。

---

## 快速開始

需要 Node.js 18+（開發以 Node 22 測試）。

```bash
npm install          # 安裝開發相依（typescript / @types/node）
npm start            # 編譯並執行（讀取 ./config.txt）
npm run play         # 同上，但日誌逐行滾動輸出（--delay 40）
```

常用參數：

```bash
node dist/index.js --ticks 120          # 模擬 120 回合
node dist/index.js --seed 7             # 換亂數種子（固定 → 可重現，方便比較 config）
node dist/index.js --delay 40           # 逐行滾動輸出，營造掛機感
node dist/index.js --config my.txt      # 指定其他 config 檔
node dist/index.js --no-color           # 關閉顏色
node dist/index.js --help               # 全部選項
```

執行結束會印出**結算**，含 `經驗/回合`、`淨金錢/回合` 等效率指標 —
改 `config.txt` 再跑一次（同 `--seed`），就能比較哪種設定更有效率。

---

## 玩法：編輯 `config.txt`

設定檔採 OpenKore 風格。`#` 之後為註解。

| 設定 | 說明 |
|---|---|
| `map` | 練功地圖：`A` 新手草原 / `B` 哥布林森林 / `C` 半獸人谷地 |
| `saveMap` | 存檔點（死亡後復活處），預設 `A` |
| `attackMode` | `0` 不攻擊 / `1` 被動(被打才還手) / `2` 主動攻擊 |
| `itemsTakeAuto` | `0` 不撿 / `1` 脫戰才撿 / `2` 看到就撿 |
| `sellAuto` | `0` 不賣戰利品 / `1` 全部賣掉 |

**自動使用物品** — 條件達成時自動吃道具（一個區塊一件物品，名稱留空＝停用）：

```
useSelf_item 補血藥水 {
    hp < 50%
}
```
條件支援 `hp`/`sp`，搭配 `<`／`>`，數字可加 `%`（佔最大值百分比）或用絕對值。

**自動購買物品** — 身上數量低於 `minAmount` 時補貨到 `maxAmount`：

```
buyAuto 補血藥水 {
    npc A
    minAmount 5
    maxAmount 20
    disabled 0
}
```

---

## 內容資料（Excel → CSV → 遊戲）

依 GDD「資料與邏輯分離」原則，所有內容放在 `data/*.csv`，改數值**無須動程式碼**：

| 檔案 | 用途 | 主要欄位 |
|---|---|---|
| `data/jobs.csv` | 職業 | 初始 HP/SP/攻防、六大屬性、每級成長 |
| `data/maps.csv` | 地圖 | 出沒怪物、連接地圖、是否城鎮 |
| `data/monsters.csv` | 怪物 | HP/攻防/命中/迴避/經驗/金錢/等級 |
| `data/items.csv` | 道具 | 類型(heal_hp/heal_sp/loot)、效果、買賣價 |
| `data/drops.csv` | 掉落表 | 怪物→道具 的掉落機率 |

> 維護流程：用 Excel 編輯（一工作表＝一類資料）→ 匯出 CSV → 覆蓋 `data/` → 重新執行。

---

## 已實作的 v1.0 機制（對應 GDD 4.3）

- **角色數值**：HP / SP / LV(上限 10) / EXP / Money
- **等級成長**：每級 +50 HP、+20 SP；每 2 級 +1 攻防；每 5 級 +1 命中/迴避/爆擊
- **六大屬性**：STR/AGI/VIT/DEX/INT/LUK 之加成（攻擊、迴避、攻速、HP/SP%、回復等）全照 GDD 公式
- **經驗值**：費氏數列 `2,3,5,8,13,21,34,55,89`（LV1→2 ... LV9→10）
- **戰鬥**：命中／迴避／爆擊判定、攻速(ASPD)額外攻擊
- **難度曲線**：等級差 > 5 不給經驗（GDD 4.5）
- **失敗懲罰**：死亡失去本級經驗 + 10% 金錢，回存檔點復活（GDD 4.6）
- **config 全功能**：map / saveMap / attackMode / itemsTakeAuto / sellAuto / useSelf_item / buyAuto

---

## 程式結構

```
data/                 內容資料表 (CSV)
config.txt            玩家設定檔
src/
  index.ts            CLI 進入點與結算輸出
  types.ts            資料表型別
  data/csv.ts         極簡 CSV 解析（零依賴）
  data/loader.ts      載入 CSV → 遊戲資料
  config/parser.ts    config.txt 解析器（OpenKore 風格）
  config/types.ts     config 結構
  game/stats.ts       屬性／等級數值公式
  game/character.ts   角色模型（升級、背包）
  game/combat.ts      戰鬥判定
  game/engine.ts      掛機模擬主迴圈
  game/logger.ts      滾動日誌輸出
  util/rng.ts         可重現亂數
```

---

## 尚未納入 v1.0（GDD 標示「先不做」或後續）

劇情/敘事、NPC、多角色切換、技能系統、地圖移動消耗時間等。歡迎在 GDD 擴充後再迭代。
