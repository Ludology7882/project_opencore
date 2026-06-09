// config.txt 解析後的結構 — 對應 GDD 4.3「config - v1.0」

export type AttackMode = 0 | 1 | 2; // 0 不攻擊 / 1 被動 / 2 主動
export type ItemsTakeAuto = 0 | 1 | 2; // 0 不撿 / 1 脫戰才撿 / 2 看到就撿
export type SellAuto = 0 | 1; // 0 不賣 / 1 戰利品全賣

export type Stat = 'hp' | 'sp';
export type Op = '<' | '>';

// useSelf_item [物品名稱] { hp < 75% }
export interface UseSelfItemRule {
  item: string; // 物品名稱（空字串代表停用此區塊）
  stat: Stat;
  op: Op;
  value: number;
  isPercent: boolean;
}

// buyAuto [物品名稱] { npc A, minAmount 5, maxAmount 20, disabled 0 }
export interface BuyAutoRule {
  item: string;
  npc: string; // NPC 所在地圖（v1.0 以城鎮 mapId 表示）
  minAmount: number;
  maxAmount: number;
  disabled: boolean;
}

export interface GameConfig {
  map: string;
  saveMap: string;
  attackMode: AttackMode;
  itemsTakeAuto: ItemsTakeAuto;
  sellAuto: SellAuto;
  useSelfItems: UseSelfItemRule[];
  buyAuto: BuyAutoRule[];
}

export const DEFAULT_CONFIG: GameConfig = {
  map: 'A',
  saveMap: 'A',
  attackMode: 2,
  itemsTakeAuto: 1,
  sellAuto: 1,
  useSelfItems: [],
  buyAuto: [],
};
