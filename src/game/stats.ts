// 數值計算 — 完全依 GDD 4.3「角色 - v1.0」的等級與屬性成長公式。
import { Job } from '../types';

export interface Attributes {
  str: number;
  agi: number;
  vit: number;
  dex: number;
  int: number;
  luk: number;
}

export interface DerivedStats {
  maxHp: number;
  maxSp: number;
  atk: number;
  def: number;
  hit: number;
  flee: number;
  crit: number; // 爆擊率 %
  aspd: number; // 攻擊速度加成 %
  hpRegen: number; // 每 tick HP 回復
  spRegen: number; // 每 tick SP 回復
}

export function attributesAt(job: Job, level: number): Attributes {
  const ups = Math.max(0, level - 1);
  return {
    str: job.str + job.strGrowth * ups,
    agi: job.agi + job.agiGrowth * ups,
    vit: job.vit + job.vitGrowth * ups,
    dex: job.dex + job.dexGrowth * ups,
    int: job.int + job.intGrowth * ups,
    luk: job.luk + job.lukGrowth * ups,
  };
}

export function computeDerived(job: Job, level: number): DerivedStats {
  const ups = Math.max(0, level - 1);
  const a = attributesAt(job, level);

  // --- 等級帶來的成長 ---
  let maxHp = job.baseHp + 50 * ups; // 每 1 級 +50
  let maxSp = job.baseSp + 20 * ups; // 每 1 級 +20
  let atk = job.baseAtk + Math.floor(ups / 2); // 每 2 級 +1
  let def = job.baseDef + Math.floor(ups / 2); // 每 2 級 +1
  let hit = Math.floor(ups / 5); // 每 5 級 +1
  let flee = Math.floor(ups / 5);
  let crit = Math.floor(ups / 5);
  let aspd = 0;
  let hpRegen = 0;
  let spRegen = 0;

  // --- 力量 STR：每 1 點 ATK+1；每 5 點額外 ATK+3 ---
  atk += a.str + Math.floor(a.str / 5) * 3;

  // --- 敏捷 AGI：每 1 點 FLEE+1；每 5 點攻速 +1% ---
  flee += a.agi;
  aspd += Math.floor(a.agi / 5);

  // --- 體質 VIT：每 1 點最大HP +1%；每 2 點 DEF+1；每 5 點 HP回復 +10 ---
  maxHp += Math.floor(maxHp * (a.vit / 100));
  def += Math.floor(a.vit / 2);
  hpRegen += Math.floor(a.vit / 5) * 10;

  // --- 靈巧 DEX：每 1 點 HIT+1；每 5 點攻速 +1% ---
  hit += a.dex;
  aspd += Math.floor(a.dex / 5);

  // --- 智力 INT：每 1 點最大SP +1%；每 3 點 SP回復 +2 ---
  maxSp += Math.floor(maxSp * (a.int / 100));
  spRegen += Math.floor(a.int / 3) * 2;

  // --- 幸運 LUK：每 1 點爆擊 +0.3；每 3 點 ATK+1,HIT+1；每 5 點 FLEE+1 ---
  crit += a.luk * 0.3;
  atk += Math.floor(a.luk / 3);
  hit += Math.floor(a.luk / 3);
  flee += Math.floor(a.luk / 5);

  return {
    maxHp,
    maxSp,
    atk,
    def,
    hit,
    flee,
    crit: Math.round(crit * 10) / 10,
    aspd,
    hpRegen,
    spRegen,
  };
}

// 升級所需經驗值：費氏數列第 4 項起 — 2,3,5,8,13,21,34,55,89
// 索引以「當前等級」對應（LV1→2 需要 2，LV9→10 需要 89）
export const EXP_TABLE = [2, 3, 5, 8, 13, 21, 34, 55, 89];
export const MAX_LEVEL = 10;

export function expToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return EXP_TABLE[level - 1] ?? Infinity;
}
