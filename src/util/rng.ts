// 可重現的偽隨機數產生器 (mulberry32)。
// 固定 seed → 相同結果，方便玩家比較不同 config 的效率。
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // 回傳 [0,1)
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // [0,100)
  percent(): number {
    return this.next() * 100;
  }

  // 整數 [min,max]
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(rate: number): boolean {
    return this.next() < rate;
  }
}
