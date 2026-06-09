// 戰鬥計算 — 命中、迴避、爆擊、傷害。
import { Rng } from '../util/rng';
import { DerivedStats } from './stats';

export interface Combatant {
  name: string;
  atk: number;
  def: number;
  hit: number;
  flee: number;
  crit: number; // %
}

export interface AttackResult {
  hit: boolean;
  crit: boolean;
  damage: number;
}

const BASE_HIT = 80; // 基礎命中率

// 一次攻擊判定：attacker 打 defender
export function resolveAttack(attacker: Combatant, defender: Combatant, rng: Rng): AttackResult {
  // 命中率 = 基礎 + 攻方HIT - 守方FLEE，夾在 5%~99%
  const hitChance = Math.max(5, Math.min(99, BASE_HIT + attacker.hit - defender.flee));
  if (rng.percent() >= hitChance) {
    return { hit: false, crit: false, damage: 0 };
  }
  const crit = rng.percent() < attacker.crit;
  // 傷害 = ATK - DEF，至少 1；爆擊無視防禦且 ×1.5
  let damage = crit ? attacker.atk : Math.max(1, attacker.atk - defender.def);
  if (crit) damage = Math.floor(damage * 1.5);
  damage = Math.max(1, damage);
  return { hit: true, crit, damage };
}

export function toCombatant(name: string, d: DerivedStats): Combatant {
  return { name, atk: d.atk, def: d.def, hit: d.hit, flee: d.flee, crit: d.crit };
}
