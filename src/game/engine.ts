// 模擬引擎 — 依 config 自動掛機練功，輸出滾動日誌。
// 採「時間預算」模型：每個動作（戰鬥/坐下/移動）消耗時間單位(tick)，
// 直到用完 maxTicks 或達最高等級。
import { GameData, Monster, Item, Skill } from '../types';
import { GameConfig, Condition, MonControlRule } from '../config/types';
import { Character } from './character';
import { Logger } from './logger';
import { Rng } from '../util/rng';
import { resolveAttack, toCombatant, Combatant } from './combat';
import { MAX_LEVEL, expToNext } from './stats';

const LEVEL_DIFF_LIMIT = 5; // GDD 4.5：等級差超過 5 等得不到經驗值
const MOVE_COST_PER_HOP = 2; // 跨一張地圖消耗的時間單位
const FLY_WING = 'fly_wing';
const BUTTERFLY_WING = 'butterfly_wing';

type FightResult = 'killed' | 'died' | 'escaped';

export interface RunStats {
  ticks: number;
  kills: number;
  deaths: number;
  escapes: number;
  sitTicks: number;
  travelTicks: number;
  expGained: number;
  moneyEarned: number;
  moneySpent: number;
  startMoney: number;
  endMoney: number;
  startLevel: number;
  endLevel: number;
}

export class Engine {
  private data: GameData;
  private cfg: GameConfig;
  private char: Character;
  private log: Logger;
  private rng: Rng;
  private currentMap: string;
  private adjacency: Map<string, Set<string>> = new Map();
  private time = 0;
  private started = false;

  private stats: RunStats;

  constructor(data: GameData, cfg: GameConfig, char: Character, log: Logger, rng: Rng) {
    this.data = data;
    this.cfg = cfg;
    this.char = char;
    this.log = log;
    this.rng = rng;
    this.currentMap = cfg.map;
    this.buildAdjacency();
    this.stats = {
      ticks: 0,
      kills: 0,
      deaths: 0,
      escapes: 0,
      sitTicks: 0,
      travelTicks: 0,
      expGained: 0,
      moneyEarned: 0,
      moneySpent: 0,
      startMoney: char.money,
      endMoney: char.money,
      startLevel: char.level,
      endLevel: char.level,
    };
  }

  private buildAdjacency(): void {
    for (const m of this.data.maps.values()) {
      if (!this.adjacency.has(m.mapId)) this.adjacency.set(m.mapId, new Set());
      for (const c of m.connections) {
        this.adjacency.get(m.mapId)!.add(c);
        if (!this.adjacency.has(c)) this.adjacency.set(c, new Set());
        this.adjacency.get(c)!.add(m.mapId); // 雙向
      }
    }
  }

  // 兩張地圖之間的步數（BFS）。同圖回 0，無法連通回 2（保底）。
  private mapHops(from: string, to: string): number {
    if (from === to) return 0;
    const seen = new Set<string>([from]);
    let frontier: string[] = [from];
    let dist = 0;
    while (frontier.length) {
      dist++;
      const next: string[] = [];
      for (const m of frontier) {
        for (const n of this.adjacency.get(m) ?? []) {
          if (n === to) return dist;
          if (!seen.has(n)) {
            seen.add(n);
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    return 2;
  }

  private item(itemId: string): Item | undefined {
    return this.data.items.get(itemId);
  }
  private itemByName(name: string): Item | undefined {
    const id = this.data.itemIdByName.get(name);
    return id ? this.data.items.get(id) : undefined;
  }

  private hpPct(): number {
    return (this.char.hp / this.char.derived.maxHp) * 100;
  }
  private spPct(): number {
    return (this.char.sp / this.char.derived.maxSp) * 100;
  }

  private condMet(c: Condition): boolean {
    const cur = c.stat === 'hp' ? this.char.hp : this.char.sp;
    const max = c.stat === 'hp' ? this.char.derived.maxHp : this.char.derived.maxSp;
    const threshold = c.isPercent ? (c.value / 100) * max : c.value;
    return c.op === '<' ? cur < threshold : cur > threshold;
  }

  private mapName(id: string): string {
    return this.data.maps.get(id)?.name ?? id;
  }

  // 開場（只執行一次）：印出起始狀態並移動到練功地圖
  async begin(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.log.log('system', `===== 外掛模擬器 啟動 =====`);
    await this.log.log(
      'system',
      `角色：${this.char.job.name}  LV${this.char.level}  HP${this.char.hp}/${this.char.derived.maxHp}  SP${this.char.sp}/${this.char.derived.maxSp}  所持金 ${this.char.money}z`,
    );
    const map = this.data.maps.get(this.cfg.map);
    if (!map) {
      await this.log.log('death', `設定錯誤：找不到地圖「${this.cfg.map}」`);
      return;
    }
    await this.log.log('move', `移動到練功地圖：${map.name}(${map.mapId})  攻擊模式 ${this.cfg.attackMode}`);
  }

  // 即時套用新設定（角色狀態保留，可中途換圖／改策略）
  async applyConfig(cfg: GameConfig): Promise<void> {
    const oldMap = this.cfg.map;
    this.cfg = cfg;
    if (cfg.map !== oldMap) {
      this.currentMap = cfg.map;
      await this.log.log('move', `★ 套用新設定：改往 ${this.mapName(cfg.map)}(${cfg.map}) 練功`);
    } else {
      await this.log.log('system', `★ 已套用新設定`);
    }
  }

  // 推進一個時間單位的決策循環（補貨 → 休息 → 戰鬥/待機）。
  // remaining 用於限制休息/移動不超過剩餘時間（即時模式給很大值）。
  async tick(remaining: number = Number.MAX_SAFE_INTEGER): Promise<void> {
    const map = this.data.maps.get(this.cfg.map);
    this.log.setTick(this.time + 1);
    if (!map) {
      await this.log.log('death', `設定錯誤：找不到地圖「${this.cfg.map}」，待機中。`);
      this.time++;
      return;
    }

    // 1) 補貨（可能花費移動時間）
    const travel = await this.maybeRestock(remaining);
    this.time += travel;
    if (travel >= remaining) return;

    // 2) 坐下休息
    const sat = await this.maybeSit(remaining - travel);
    this.time += sat;
    if (travel + sat >= remaining) return;

    // 3) 待機條件
    if (this.cfg.attackMode === 0 || map.monsters.length === 0) {
      await this.log.log('system', `待機中…（attackMode 0 或本圖無怪）`);
      this.regen();
      this.time++;
      return;
    }

    // 4) 依 mon_control 挑怪
    const mon = this.chooseMonster(map.monsters);
    if (!mon) {
      await this.log.log('system', `沒有符合條件可打的怪（mon_control 過濾），待機回復。`);
      this.regen();
      this.time++;
      return;
    }

    // 5) 戰鬥
    await this.fight(mon);
    this.time++;
    this.regen();
  }

  // 目前狀態快照（供即時 UI 顯示）
  getState() {
    return {
      level: this.char.level,
      maxLevel: this.char.level >= MAX_LEVEL,
      exp: this.char.exp,
      expNext: this.char.level >= MAX_LEVEL ? 0 : expToNext(this.char.level),
      hp: this.char.hp,
      maxHp: this.char.derived.maxHp,
      sp: this.char.sp,
      maxSp: this.char.derived.maxSp,
      money: this.char.money,
      map: this.cfg.map,
      mapName: this.mapName(this.cfg.map),
      time: this.time,
      stats: { ...this.stats, endMoney: this.char.money, endLevel: this.char.level },
    };
  }

  // CLI：跑固定回合數後回傳結算（達最高等級即停）
  async run(maxTicks: number): Promise<RunStats> {
    await this.begin();
    if (!this.data.maps.get(this.cfg.map)) return this.finish();
    while (this.time < maxTicks && this.char.level < MAX_LEVEL) {
      await this.tick(maxTicks - this.time);
    }
    if (this.char.level >= MAX_LEVEL) {
      this.log.setTick(this.time);
      await this.log.log('level', `已達最高等級 LV${MAX_LEVEL}，停止練功。`);
    }
    this.stats.ticks = Math.min(this.time, maxTicks);
    return this.finish();
  }

  // 站立時的微量自然回復
  private regen(): void {
    this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + this.char.derived.hpRegen);
    this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + this.char.derived.spRegen);
  }

  // ---- mon_control：挑選要打的怪 ----
  private monControlFor(monsterName: string): MonControlRule {
    const exact = this.cfg.monControl.find((r) => r.monster === monsterName);
    if (exact) return exact;
    const all = this.cfg.monControl.find((r) => r.monster.toLowerCase() === 'all');
    if (all) return all;
    return { monster: monsterName, attack: 1, minHpPercent: 0, minSpPercent: 0, minLevel: 0, teleport: false };
  }

  private chooseMonster(monsterIds: string[]): Monster | undefined {
    const candidates: Monster[] = [];
    for (const id of monsterIds) {
      const mon = this.data.monsters.get(id);
      if (!mon) continue;
      const rule = this.monControlFor(mon.name);
      if (rule.attack < 1 || rule.teleport) continue; // 不打 / 被動 / 避開
      if (this.char.level < rule.minLevel) continue; // 等級不足，先不打
      if (rule.minHpPercent > 0 && this.hpPct() < rule.minHpPercent) continue; // HP 不夠
      if (rule.minSpPercent > 0 && this.spPct() < rule.minSpPercent) continue; // SP 不夠
      candidates.push(mon);
    }
    if (candidates.length === 0) return undefined;
    return candidates[this.rng.int(0, candidates.length - 1)];
  }

  // ---- 坐下休息 ----
  private async maybeSit(remaining: number): Promise<number> {
    const s = this.cfg.sitAuto;
    const needHp = s.hpLower > 0 && this.hpPct() < s.hpLower;
    const needSp = s.spLower > 0 && this.spPct() < s.spLower;
    if ((!needHp && !needSp) || remaining <= 0) return 0;

    const sitHp = Math.max(this.char.derived.hpRegen * 2, Math.ceil(this.char.derived.maxHp * 0.12));
    const sitSp = Math.max(this.char.derived.spRegen * 2, Math.ceil(this.char.derived.maxSp * 0.12));
    await this.log.log('system', `坐下休息…（HP ${this.char.hp}/${this.char.derived.maxHp} SP ${this.char.sp}/${this.char.derived.maxSp}）`);

    let rounds = 0;
    const cap = Math.min(remaining, 2000); // 防呆：避免 upper 設超過 100% 造成無限坐
    while (rounds < cap) {
      const hpDone = s.hpLower <= 0 || this.char.hp >= this.char.derived.maxHp || this.hpPct() >= s.hpUpper;
      const spDone = s.spLower <= 0 || this.char.sp >= this.char.derived.maxSp || this.spPct() >= s.spUpper;
      if (hpDone && spDone) break;
      this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + sitHp);
      this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + sitSp);
      rounds++;
    }
    this.stats.sitTicks += rounds;
    await this.log.log('system', `休息結束（耗時 ${rounds}）→ HP ${this.char.hp}/${this.char.derived.maxHp} SP ${this.char.sp}/${this.char.derived.maxSp}`);
    return rounds;
  }

  // ---- 戰鬥 ----
  private async fight(monDef: Monster): Promise<FightResult> {
    let monHp = monDef.hp;
    const player: Combatant = toCombatant(this.char.job.name, this.char.derived);
    const monster: Combatant = {
      name: monDef.name,
      atk: monDef.atk,
      def: monDef.def,
      hit: monDef.hit,
      flee: monDef.flee,
      crit: 0,
    };

    await this.log.log('combat', `遭遇 ${monDef.name}(LV${monDef.level}) HP${monDef.hp}`);
    const playerFirst = this.cfg.attackMode === 2;

    let round = 0;
    while (monHp > 0 && this.char.alive && round < 100) {
      round++;
      await this.applyUseSelfItems();

      if (playerFirst) {
        monHp = await this.playerAction(player, monster, monHp, monDef);
        if (monHp <= 0) break;
      }

      // 怪物攻擊
      const mr = resolveAttack(monster, player, this.rng);
      if (mr.hit) {
        this.char.hp -= mr.damage;
        await this.log.log('combat', `  ${monDef.name} 攻擊，造成 ${mr.damage} 傷害 → HP ${Math.max(0, this.char.hp)}/${this.char.derived.maxHp}`);
      } else {
        await this.log.log('combat', `  ${monDef.name} 的攻擊被閃避`);
      }
      this.char.clamp();

      // 危急時用蒼蠅之翼逃跑（teleportAuto）
      if (await this.tryTeleportEscape(monDef)) {
        return 'escaped';
      }
      if (!this.char.alive) break;

      await this.applyUseSelfItems();
      if (!playerFirst) {
        monHp = await this.playerAction(player, monster, monHp, monDef);
      }
    }

    if (!this.char.alive) {
      await this.handleDeath(monDef);
      return 'died';
    }
    if (monHp <= 0) {
      await this.onKill(monDef);
      return 'killed';
    }
    return 'escaped';
  }

  // 玩家行動：優先施放符合條件的攻擊技能，否則普通攻擊
  private async playerAction(player: Combatant, monster: Combatant, monHp: number, monDef: Monster): Promise<number> {
    const skill = this.chooseSkill(monDef);
    if (skill) {
      this.char.sp = Math.max(0, this.char.sp - skill.spCost);
      const scaled: Combatant = { ...player, atk: Math.floor((player.atk * skill.powerPct) / 100) };
      const r = resolveAttack(scaled, monster, this.rng);
      if (r.hit) {
        monHp -= r.damage;
        const tag = r.crit ? '【爆擊】' : '';
        await this.log.log('combat', `  ${tag}施放「${skill.name}」(SP-${skill.spCost})，造成 ${r.damage} 傷害 → 敵HP ${Math.max(0, monHp)}`);
      } else {
        await this.log.log('combat', `  施放「${skill.name}」失誤（被閃避）`);
      }
      return monHp;
    }
    return this.playerStrike(player, monster, monHp);
  }

  private chooseSkill(monDef: Monster): Skill | undefined {
    for (const rule of this.cfg.attackSkills) {
      if (rule.disabled) continue;
      const id = this.data.skillIdByName.get(rule.skill);
      if (!id) continue;
      const sk = this.data.skills.get(id);
      if (!sk) continue;
      if (sk.job !== this.char.job.jobId) continue;
      if (this.char.level < sk.reqLevel) continue;
      if (rule.monsters.length > 0 && !rule.monsters.includes(monDef.name)) continue;
      if (rule.notMonsters.includes(monDef.name)) continue;
      if (rule.hp && !this.condMet(rule.hp)) continue;
      if (rule.sp && !this.condMet(rule.sp)) continue;
      if (this.char.sp < sk.spCost) continue;
      return sk;
    }
    return undefined;
  }

  // 普通攻擊（含攻速 ASPD 額外攻擊）
  private async playerStrike(player: Combatant, monster: Combatant, monHp: number): Promise<number> {
    const aspd = this.char.derived.aspd;
    const extraAttacks = Math.floor(aspd / 100) + (this.rng.percent() < aspd % 100 ? 1 : 0);
    const attacks = 1 + extraAttacks;
    for (let i = 0; i < attacks && monHp > 0; i++) {
      const r = resolveAttack(player, monster, this.rng);
      if (r.hit) {
        monHp -= r.damage;
        const tag = r.crit ? '【爆擊】' : '';
        await this.log.log('combat', `  ${tag}攻擊 ${monster.name}，造成 ${r.damage} 傷害 → 敵HP ${Math.max(0, monHp)}`);
      } else {
        await this.log.log('combat', `  攻擊 ${monster.name} 失誤（被閃避）`);
      }
    }
    return monHp;
  }

  // teleportAuto：HP/SP 過低時用蒼蠅之翼逃離
  private async tryTeleportEscape(monDef: Monster): Promise<boolean> {
    const hpTrig = this.cfg.teleportAutoHp > 0 && this.hpPct() < this.cfg.teleportAutoHp;
    const spTrig = this.cfg.teleportAutoSp > 0 && this.spPct() < this.cfg.teleportAutoSp;
    if (!hpTrig && !spTrig) return false;
    if (this.char.itemCount(FLY_WING) <= 0) return false; // 沒翼可逃
    this.char.consumeItem(FLY_WING);
    this.stats.escapes++;
    await this.log.log('item', `  ⚡ 危急！使用蒼蠅之翼逃離 ${monDef.name}（剩 ${this.char.itemCount(FLY_WING)} 翼）`);
    return true;
  }

  // useSelf_item：依條件自動使用道具
  private async applyUseSelfItems(): Promise<void> {
    for (const rule of this.cfg.useSelfItems) {
      const item = this.itemByName(rule.item);
      if (!item) continue;
      if (!this.condMet({ stat: rule.stat, op: rule.op, value: rule.value, isPercent: rule.isPercent })) continue;
      if (this.char.itemCount(item.itemId) <= 0) continue;
      this.char.consumeItem(item.itemId);
      if (item.type === 'heal_hp') {
        this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + item.effectValue);
      } else if (item.type === 'heal_sp') {
        this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + item.effectValue);
      }
      await this.log.log('item', `  使用 ${item.name}（${rule.stat.toUpperCase()} ${rule.op} ${rule.value}${rule.isPercent ? '%' : ''}）→ HP ${this.char.hp}/${this.char.derived.maxHp} SP ${this.char.sp}/${this.char.derived.maxSp}（剩 ${this.char.itemCount(item.itemId)}）`);
    }
  }

  private async onKill(monDef: Monster): Promise<void> {
    this.stats.kills++;

    const diff = Math.abs(this.char.level - monDef.level);
    if (diff > LEVEL_DIFF_LIMIT) {
      await this.log.log('combat', `擊倒 ${monDef.name}！但等級差 ${diff} > ${LEVEL_DIFF_LIMIT}，未獲得經驗值。`);
    } else {
      const gained = monDef.exp;
      this.stats.expGained += gained;
      const ups = this.char.gainExp(gained);
      await this.log.log('combat', `擊倒 ${monDef.name}！獲得經驗 +${gained}（${this.char.exp}/${this.char.level >= MAX_LEVEL ? '--' : expToNext(this.char.level)}）`);
      if (ups > 0) {
        await this.log.log('level', `*** 升級！ LV${this.char.level}  最大HP ${this.char.derived.maxHp} / 最大SP ${this.char.derived.maxSp} / ATK ${this.char.derived.atk} / DEF ${this.char.derived.def} ***`);
      }
    }

    const money = monDef.money + this.rng.int(0, Math.ceil(monDef.money * 0.3));
    this.char.money += money;
    this.stats.moneyEarned += money;
    await this.log.log('item', `  拾獲 ${money}z`);

    if (this.cfg.itemsTakeAuto !== 0) {
      const drops = this.data.dropsByMonster.get(monDef.monsterId) ?? [];
      for (const d of drops) {
        if (this.rng.chance(d.rate)) {
          const it = this.item(d.itemId);
          if (!it) continue;
          this.char.addItem(it.itemId, 1);
          await this.log.log('item', `  撿取 ${it.name} ×1`);
        }
      }
    }

    if (this.cfg.sellAuto === 1) await this.sellLoot();
  }

  private async sellLoot(): Promise<void> {
    let total = 0;
    for (const [itemId, count] of Array.from(this.char.inventory.entries())) {
      const it = this.item(itemId);
      if (!it || it.type !== 'loot') continue;
      total += it.sellPrice * count;
      this.char.inventory.delete(itemId);
    }
    if (total > 0) {
      this.char.money += total;
      this.stats.moneyEarned += total;
      await this.log.log('shop', `  自動賣出戰利品，獲得 ${total}z（所持金 ${this.char.money}z）`);
    }
  }

  // 補貨 + 移動成本。回傳本次花費的時間單位。
  private async maybeRestock(remaining: number): Promise<number> {
    const needsBuy = (item: Item, minAmount: number) =>
      this.char.itemCount(item.itemId) < minAmount && Math.floor(this.char.money / Math.max(1, item.buyPrice)) > 0;

    const active = this.cfg.buyAuto.filter((r) => {
      if (r.disabled || !r.item) return false;
      const it = this.itemByName(r.item);
      return !!it && it.buyPrice > 0 && needsBuy(it, r.minAmount);
    });
    if (active.length === 0 || remaining <= 0) return 0;

    // 依目的地（NPC 所在城鎮）分組，一趟處理同城鎮的所有採購
    const dests = Array.from(new Set(active.map((r) => r.npc || this.cfg.saveMap)));
    let travel = 0;
    for (const dest of dests) {
      if (travel >= remaining) break;
      travel += await this.travelCost(dest);
      for (const rule of active.filter((r) => (r.npc || this.cfg.saveMap) === dest)) {
        await this.buyOne(rule.item, rule.minAmount, rule.maxAmount, dest);
      }
    }
    this.stats.travelTicks += travel;
    return travel;
  }

  private async travelCost(dest: string): Promise<number> {
    const hops = this.mapHops(this.currentMap, dest);
    if (hops === 0) return 1; // 已在城鎮
    let cost = 2 * hops * MOVE_COST_PER_HOP; // 來回步行
    // 蝴蝶之翼：若目的地是存檔點，瞬間到達省去去程
    if (dest === this.cfg.saveMap && this.char.itemCount(BUTTERFLY_WING) > 0) {
      this.char.consumeItem(BUTTERFLY_WING);
      cost = hops * MOVE_COST_PER_HOP + 1;
      await this.log.log('move', `  使用蝴蝶之翼瞬移回 ${dest} 補貨（剩 ${this.char.itemCount(BUTTERFLY_WING)} 翼）`);
    } else {
      await this.log.log('move', `  步行前往 ${dest} 補貨（來回約 ${cost} 時間）`);
    }
    return cost;
  }

  private async buyOne(itemName: string, minAmount: number, maxAmount: number, dest: string): Promise<void> {
    const it = this.itemByName(itemName);
    if (!it || it.buyPrice <= 0) return;
    const have = this.char.itemCount(it.itemId);
    if (have >= minAmount) return;
    const want = Math.max(0, maxAmount - have);
    const affordable = Math.floor(this.char.money / it.buyPrice);
    const buy = Math.min(want, affordable);
    if (buy <= 0) {
      await this.log.log('shop', `  想購買 ${it.name} 但金錢不足（所持金 ${this.char.money}z）`);
      return;
    }
    const cost = buy * it.buyPrice;
    this.char.money -= cost;
    this.char.addItem(it.itemId, buy);
    this.stats.moneySpent += cost;
    await this.log.log('shop', `  在 ${dest} 購買 ${it.name} ×${buy}（-${cost}z，剩 ${this.char.money}z，庫存 ${this.char.itemCount(it.itemId)}）`);
  }

  // 死亡懲罰（GDD 4.6）
  private async handleDeath(monDef: Monster): Promise<void> {
    this.stats.deaths++;
    const lostExp = this.char.exp;
    const lostMoney = Math.floor(this.char.money * 0.1);
    this.char.exp = 0;
    this.char.money -= lostMoney;
    await this.log.log('death', `你被 ${monDef.name} 擊倒了！失去經驗 ${lostExp}、金錢 ${lostMoney}z。`);

    const saveMap = this.data.maps.get(this.cfg.saveMap);
    await this.log.log('death', `回到存檔點 ${saveMap ? saveMap.name : this.cfg.saveMap}，原地復活。`);
    this.char.hp = this.char.derived.maxHp;
    this.char.sp = this.char.derived.maxSp;
    this.currentMap = this.cfg.map;
  }

  private finish(): RunStats {
    this.stats.endMoney = this.char.money;
    this.stats.endLevel = this.char.level;
    return this.stats;
  }
}
