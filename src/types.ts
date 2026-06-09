// 共用型別定義 — 對應 GDD 第 7 章「資料表清單」
// 內容資料（職業/地圖/怪物/道具/掉落）與程式邏輯分離，皆來自 data/*.csv

export interface Job {
  jobId: string;
  name: string;
  baseHp: number;
  baseSp: number;
  baseAtk: number;
  baseDef: number;
  // LV1 初始六大屬性
  str: number;
  agi: number;
  vit: number;
  dex: number;
  int: number;
  luk: number;
  // 每升 1 級屬性成長
  strGrowth: number;
  agiGrowth: number;
  vitGrowth: number;
  dexGrowth: number;
  intGrowth: number;
  lukGrowth: number;
}

export interface GameMap {
  mapId: string;
  name: string;
  monsters: string[]; // 出沒怪物 monsterId
  connections: string[]; // 連接地圖 mapId
  isTown: boolean; // 城鎮（有 NPC 商店、可作存檔點）
}

export interface Monster {
  monsterId: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  hit: number;
  flee: number;
  exp: number;
  money: number;
}

export type ItemType = 'heal_hp' | 'heal_sp' | 'loot';

export interface Item {
  itemId: string;
  name: string;
  type: ItemType;
  effectValue: number; // heal_hp/heal_sp 的回復量
  buyPrice: number;
  sellPrice: number;
}

export interface Drop {
  monsterId: string;
  itemId: string;
  rate: number; // 0..1
}

export interface GameData {
  jobs: Map<string, Job>;
  maps: Map<string, GameMap>;
  monsters: Map<string, Monster>;
  items: Map<string, Item>;
  dropsByMonster: Map<string, Drop[]>;
  // 以中文名稱反查 itemId，供 config 中以名稱指定道具
  itemIdByName: Map<string, string>;
}
