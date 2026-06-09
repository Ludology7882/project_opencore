// config.txt 解析後的結構 — 對應 GDD 4.3 及 OpenKore 概念融合（docs/openkore-design.md）

export type AttackMode = 0 | 1 | 2; // 0 不攻擊 / 1 被動 / 2 主動
export type ItemsTakeAuto = 0 | 1 | 2; // 0 不撿 / 1 脫戰才撿 / 2 看到就撿
export type SellAuto = 0 | 1; // 0 不賣 / 1 戰利品全賣

export type Stat = 'hp' | 'sp';
export type Op = '<' | '>';

// 通用條件，如 hp < 75% / sp > 20
export interface Condition {
  stat: Stat;
  op: Op;
  value: number;
  isPercent: boolean;
}

// useSelf_item [物品名稱] { hp < 75% }
export interface UseSelfItemRule {
  item: string;
  stat: Stat;
  op: Op;
  value: number;
  isPercent: boolean;
}

// buyAuto [物品名稱] { npc A, minAmount 5, maxAmount 20, disabled 0 }
export interface BuyAutoRule {
  item: string;
  npc: string;
  minAmount: number;
  maxAmount: number;
  disabled: boolean;
}

// mon_control [怪物名稱|all] { attack 1, minHp 50%, minLevel 3, teleport 0 }
// 逐怪行為控制（OpenKore mon_control.txt）
export interface MonControlRule {
  monster: string; // 怪物名稱，'all' 為預設
  attack: number; // -1 完全不打 / 0 被動 / 1 主動
  minHpPercent: number; // 自身 HP% 高於此才主動開打（0 = 不限制）
  minSpPercent: number; // 自身 SP% 高於此才主動開打
  minLevel: number; // 自身等級 >= 此才打（用於跳過太強的怪）
  teleport: boolean; // true = 看到就用蒼蠅之翼逃離（避開此怪）
}

// attackSkillSlot [技能名稱] { sp > 20, monsters 哥布林, notMonsters 波利, disabled 0 }
export interface AttackSkillRule {
  skill: string;
  hp?: Condition; // 自身 HP 條件（可選）
  sp?: Condition; // 自身 SP 條件（可選）
  monsters: string[]; // 只對這些怪使用（空 = 所有怪）
  notMonsters: string[]; // 不對這些怪使用
  disabled: boolean;
}

// 坐下休息（OpenKore sitAuto）：HP/SP 低於 lower% 就坐下回復，回到 upper% 才起身
export interface SitAutoConfig {
  hpLower: number; // %，0 = 關閉
  hpUpper: number; // %
  spLower: number; // %，0 = 關閉
  spUpper: number; // %
}

export interface GameConfig {
  map: string;
  saveMap: string;
  attackMode: AttackMode;
  itemsTakeAuto: ItemsTakeAuto;
  sellAuto: SellAuto;
  useSelfItems: UseSelfItemRule[];
  buyAuto: BuyAutoRule[];
  // --- OpenKore 融合 ---
  monControl: MonControlRule[];
  attackSkills: AttackSkillRule[];
  sitAuto: SitAutoConfig;
  teleportAutoHp: number; // HP% 低於此用蒼蠅之翼逃跑（0 = 關閉）
  teleportAutoSp: number; // SP% 低於此逃跑（0 = 關閉）
}

export const DEFAULT_CONFIG: GameConfig = {
  map: 'A',
  saveMap: 'A',
  attackMode: 2,
  itemsTakeAuto: 1,
  sellAuto: 1,
  useSelfItems: [],
  buyAuto: [],
  monControl: [],
  attackSkills: [],
  sitAuto: { hpLower: 0, hpUpper: 100, spLower: 0, spUpper: 100 },
  teleportAutoHp: 0,
  teleportAutoSp: 0,
};
