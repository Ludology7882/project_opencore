import { Job } from '../types';
import { computeDerived, DerivedStats, attributesAt, Attributes, expToNext, MAX_LEVEL } from './stats';

export class Character {
  job: Job;
  level: number;
  exp: number;
  hp: number;
  sp: number;
  money: number;
  inventory: Map<string, number> = new Map(); // itemId -> 數量
  derived: DerivedStats;

  constructor(job: Job, level = 1, money = 0) {
    this.job = job;
    this.level = level;
    this.exp = 0;
    this.money = money;
    this.derived = computeDerived(job, level);
    this.hp = this.derived.maxHp;
    this.sp = this.derived.maxSp;
  }

  get attributes(): Attributes {
    return attributesAt(this.job, this.level);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  recompute(): void {
    const prevMaxHp = this.derived.maxHp;
    const prevMaxSp = this.derived.maxSp;
    this.derived = computeDerived(this.job, this.level);
    // 升級時補滿差額（最大值上升）
    this.hp += this.derived.maxHp - prevMaxHp;
    this.sp += this.derived.maxSp - prevMaxSp;
    this.clamp();
  }

  clamp(): void {
    this.hp = Math.max(0, Math.min(this.hp, this.derived.maxHp));
    this.sp = Math.max(0, Math.min(this.sp, this.derived.maxSp));
  }

  // 取得經驗，回傳升級次數（供日誌使用）
  gainExp(amount: number): number {
    let levelUps = 0;
    this.exp += amount;
    while (this.level < MAX_LEVEL && this.exp >= expToNext(this.level)) {
      this.exp -= expToNext(this.level);
      this.level++;
      levelUps++;
      this.recompute();
      this.hp = this.derived.maxHp; // 升級回滿
      this.sp = this.derived.maxSp;
    }
    if (this.level >= MAX_LEVEL) this.exp = 0;
    return levelUps;
  }

  addItem(itemId: string, count = 1): void {
    this.inventory.set(itemId, (this.inventory.get(itemId) ?? 0) + count);
  }

  itemCount(itemId: string): number {
    return this.inventory.get(itemId) ?? 0;
  }

  // 消耗一件道具，成功回傳 true
  consumeItem(itemId: string): boolean {
    const n = this.inventory.get(itemId) ?? 0;
    if (n <= 0) return false;
    if (n === 1) this.inventory.delete(itemId);
    else this.inventory.set(itemId, n - 1);
    return true;
  }
}
