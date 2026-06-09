# OpenKore 功能融合設計文件

> 目的：把 OpenKore（仙境傳說 RO 的自動外掛）的**設定檔指令與玩法概念**對照到「外掛模擬器」，
> 逐項決定**留 / 改 / 刪**。我們借用的是「概念與 config 詞彙」，程式一律**自行重寫**
> （OpenKore 為 GPL 授權的 Perl 程式且綁真實遊戲，不複製其碼）。

## 圖例

| 標記 | 意義 |
|---|---|
| 🟢 已有 | 目前 MVP 已實作 |
| 🔵 建議新增 | 適合單機文字模擬，能加深策略，建議做 |
| 🟡 可改進 | 已有但可做得更像 OpenKore / 更有深度 |
| 🔴 建議刪除 | 屬連線/多人/封包等，單機文字模擬不適用 |
| ⚪ 觀望 | 有趣但成本高或非核心，列為後期 |

---

## A. 戰鬥行為（attack*）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `attackAuto` | 自動攻擊模式（0 不打 / 1 被動 / 2 主動 / 3+ 更細） | 🟢 已有 | 我們的 `attackMode` 0/1/2 |
| `mon_control`（每怪設定） | **逐隻怪**設定：打不打、最低 HP/SP 才打、最低等級才打、看到就逃 | 🔵 強烈建議 | RO 外掛精華。讓玩家挑「只打划算的怪、跳過硬怪」，策略大增 |
| `attackDistance` / `attackMaxDistance` | 近戰/遠程攻擊距離 | ⚪ 觀望 | 需要「距離」概念，目前是抽象回合制，先不做 |
| `attackChangeTarget` | 目標打不到就換目標 | 🔵 建議 | 可簡化為「遇到逃跑/打不死的怪就換一隻」 |
| `attackLooters` | 自動攻擊搶你戰利品的玩家 | 🔴 刪除 | 多人專屬 |
| `attackEquip_*` / `autoSwitch` | 戰鬥時換裝備 | ⚪ 觀望 | 需先有「裝備系統」，列後期 |
| `runFromTarget` | 距離太近就跑開（風箏） | ⚪ 觀望 | 同樣需距離概念 |
| `aggressiveAntiKS` / `avoidGM` | 反搶怪 / 躲 GM | 🔴 刪除 | 多人/反偵測，單機無意義 |

---

## B. HP/SP 恢復與休息（sitAuto / useSelf_item）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `useSelf_item {}` | 條件達成自動吃道具（hp/sp 條件） | 🟢 已有 | 我們已支援 `hp/sp < >` |
| `sitAuto_hp` / `sitAuto_sp` | **坐下休息回血回魔**，但坐著不能動/不能打 | 🔵 強烈建議 | **解決「SP 沒用、回血太佛」**：坐著回復＝放棄練功時間，產生取捨 |
| `sitAuto_idle` | 閒置時自動坐下 | 🔵 建議 | 配合上面 |
| useSelf_item 更多條件 | 例：HP 與 SP 同時判斷、依怪物種類 | 🟡 可改進 | 條件式可擴充 |

> 💡 **重點**：加入「坐下休息」後，VIT/INT 的回復屬性、SP 才真正有意義——
> 玩家要在「吃藥(花錢)」「坐著回(花時間)」之間權衡。

---

## C. 技能系統（skills / autoSpell）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `attackSkillSlot {}` | 設定攻擊技能與施放條件（SP 夠、怪 HP%、機率） | 🔵 強烈建議 | **讓 SP 有用**：技能比平砍強但耗 SP，要管理資源 |
| `useSelf_skill {}` | 對自己放技能（補血、加攻） | 🔵 建議 | 劍士可有「自我增益」 |
| `skillsAddAuto` | 自動分配技能點 | 🔵 建議 | 升級給技能點，玩家設定加點順序 |
| `autoSpell` | 特定情況自動施法 | ⚪ 觀望 | 進階版攻擊技能，可後期 |
| `monsterSkill {}` / `partySkill {}` | 對特定怪/隊友放技能 | 🟡/🔴 | 對怪→可留簡化版；對隊友→多人，刪 |

> 需要新增資料表 `skills`（技能ID、名稱、SP消耗、倍率、職業、習得等級）。

---

## D. 道具管理（items_control / pickupitems）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `itemsTakeAuto` | 自動撿物（0/1/2） | 🟢 已有 | |
| `items_control`（每物設定） | **逐項道具**：保留幾個、賣不賣、存不存倉庫 | 🔵 強烈建議 | 取代目前「全賣 sellAuto」，改成精細控制：留藥水、賣垃圾 |
| `pickupitems`（每物撿取規則） | 哪些撿、哪些不撿 | 🔵 建議 | 配合上面 |
| `itemsMaxWeight` / 重量 | **背包重量上限**，超重會變慢/不能動 | 🔵 建議 | 經典 RO 機制，逼玩家回城清包，產生節奏 |
| `cart` 手推車 | 額外負重 | ⚪ 觀望 | 重量系統的延伸，後期 |

---

## E. 自動買 / 賣 / 倉庫（buyAuto / sellAuto / storageAuto）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `buyAuto {}` | 低於數量自動向 NPC 補貨 | 🟢 已有 | 但目前「免費瞬移」太佛，見 G |
| `sellAuto` | 賣戰利品 | 🟢 已有 | 建議併入 `items_control` 精細化 |
| `storageAuto {}` / `getAuto {}` | 自動存倉/取倉，倉庫保留最低 zeny | 🔵 建議 | 加「倉庫」當儲物空間，配合重量系統 |
| `minStorageZeny` | 存倉前保留最低金錢 | 🔵 建議 | 小巧但實用 |
| `dealAuto` | 自動接受玩家交易 | 🔴 刪除 | 多人 |

---

## F. 傳送 / 逃脫（teleportAuto / route_teleport）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `teleportAuto_hp` / `_sp` | HP/SP 過低自動瞬移逃跑 | 🔵 強烈建議 | **降低死亡風險的策略選項**，消耗「蒼蠅之翼」道具(花錢) |
| `teleportAuto_maxDmg` / `_deadly` | 單次受創過大/致命傷時逃 | 🔵 建議 | 應對高傷怪 |
| `teleportAuto_atkMiss` | 連續 miss 就逃（打不到的怪） | ⚪ 觀望 | |
| `route_teleport` | 移動時用瞬移加速 | ⚪ 觀望 | 需移動系統 |
| 蝴蝶之翼（回存檔點） | 用道具回城 | 🔵 建議 | 配合 buyAuto/補貨的移動成本 |

---

## G. 移動 / 路線（lockMap / route_*）

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `lockMap` | **鎖定只在某張圖**練功 | 🟢 已有 | 我們的 `map` |
| `saveMap` | 死亡/回城的存檔點 | 🟢 已有 | |
| 地圖間移動需時間 | 走到別張圖、走去 NPC 要花回合 | 🔵 強烈建議 | **解決「買藥免費瞬移」**：補貨要花時間走回城，或花錢用翼 |
| `route_randomWalk` | 閒置時隨機走動找怪 | 🔵 建議 | 影響「遇怪頻率」，可當效率變數 |
| `lockMap_*`（區域/座標） | 鎖定地圖某區塊 | ⚪ 觀望 | 需座標系統 |
| 連接地圖 `connections` | 圖與圖相鄰關係 | 🟢 已有(資料) | 目前 maps.csv 已有，尚未用於移動 |

---

## H. 進階自動化

| OpenKore 指令 | 作用 | 建議 | 備註 |
|---|---|---|---|
| `autoConfChange {}` | **依等級自動切換 config** | 🔵 建議 | 超契合核心玩法：玩家設「1-5級在A圖、6級後去B圖」 |
| `eventMacro` / 巨集 | 自訂腳本/條件觸發（if/then） | ⚪ 觀望(殺手鐧) | OpenKore 最強功能，超契合「寫設定找最佳解」，但工程量大，列為招牌後期目標 |
| `autoRestart` | 掛機重啟排程 | 🔴 刪除 | 對應真實掛機防偵測 |
| `autoResponse` | 自動回聊天 | 🔴 刪除 | 多人 |
| `autoMakeArrows` | 自動製箭 | ⚪ 觀望 | 需製作系統 |

---

## I. 一律刪除（單機文字模擬不適用）

連線與帳號：`master` / `server` / `username` / `loginPinCode` / `XKore*` / `char`
多人互動：`follow*` / `party*` / `tankMode` / `dealAuto` / `guild*` / `tankersList`
反偵測：`avoidGM*` / `avoidList` / `autoRestart` / `dcOnDeath` / `dcPause`
夥伴系統：`homunculus*` / `pet*` / `mercenary*`（⚪ 也許後期做成「寵物/傭兵」放置夥伴）
維護雜項：`repairAuto` / `attendanceAuto` / `portalCompile` / 封包 `debugPacket*` / 聊天紀錄 `logChat*`

---

## 兩個現有痛點 → OpenKore 怎麼解

1. **「買藥免費瞬移」太佛**
   → 加 **G 移動時間成本** + **F 用翼道具(花錢)回城/逃跑**。
   補貨從此要付出「時間」或「金錢」，買多買少成為真正的取捨。

2. **「SP 幾乎沒用」**
   → 加 **B 坐下休息** + **C 技能系統**。
   技能耗 SP 但更強；SP 沒了要坐著回(花時間)或喝魔water(花錢)。INT/VIT 屬性也跟著有意義。

---

## 建議的開發優先序（提案，待你篩選）

**第一波（CP 值最高，直接深化核心）**
1. 🔵 `mon_control` 逐怪控制（A）
2. 🔵 `sitAuto` 坐下休息（B）
3. 🔵 技能系統 `attackSkillSlot` + `skills` 資料表（C）
4. 🔵 移動時間成本 + 翼道具（F/G）

**第二波（資源管理深度）**
5. 🔵 `items_control` 精細道具管理 + 重量系統（D）
6. 🔵 倉庫 `storageAuto`（E）
7. 🔵 `autoConfChange` 依等級切換設定（H）

**招牌後期目標**
8. ⚪ `eventMacro` 自訂巨集腳本（H）— 真正讓玩家「寫程式打遊戲」

**也許做成特色**
9. ⚪ 夥伴系統（homunculus/pet 改成放置夥伴）
