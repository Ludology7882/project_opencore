// 模擬引擎 — 依 config 自動掛機練功，輸出滾動日誌。
import { GameData, Monster, Item } from '../types';
import { GameConfig } from '../config/types';
import { Character } from './character';
import { Logger } from './logger';
import { Rng } from '../util/rng';
import { resolveAttack, toCombatant, Combatant } from './combat';
import { MAX_LEVEL, expToNext } from './stats';

const LEVEL_DIFF_LIMIT = 5; // GDD 4.5：等級差超過 5 等得不到經驗值

export interface RunStats {
  ticks: number;
  kills: number;
  deaths: number;
  expGained: number;
  moneyEarned: number; // 打怪 + 賣出
  moneySpent: number; // 購買
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

  private stats: RunStats;

  constructor(data: GameData, cfg: GameConfig, char: Character, log: Logger, rng: Rng) {
    this.data = data;
    this.cfg = cfg;
    this.char = char;
    this.log = log;
    this.rng = rng;
    this.currentMap = cfg.map;
    this.stats = {
      ticks: 0,
      kills: 0,
      deaths: 0,
      expGained: 0,
      moneyEarned: 0,
      moneySpent: 0,
      startMoney: char.money,
      endMoney: char.money,
      startLevel: char.level,
      endLevel: char.level,
    };
  }

  private item(itemId: string): Item | undefined {
    return this.data.items.get(itemId);
  }

  private itemByName(name: string): Item | undefined {
    const id = this.data.itemIdByName.get(name);
    return id ? this.data.items.get(id) : undefined;
  }

  async run(maxTicks: number): Promise<RunStats> {
    const map = this.data.maps.get(this.cfg.map);
    await this.log.log('system', `===== 外掛模擬器 啟動 =====`);
    await this.log.log('system', `角色：${this.char.job.name}  LV${this.char.level}  HP${this.char.hp}/${this.char.derived.maxHp}  所持金 ${this.char.money}z`);
    if (!map) {
      await this.log.log('death', `設定錯誤：找不到地圖「${this.cfg.map}」`);
      return this.finish();
    }
    await this.log.log('move', `移動到練功地圖：${map.name}(${map.mapId})  攻擊模式 ${this.cfg.attackMode}`);

    for (let tick = 1; tick <= maxTicks; tick++) {
      if (this.char.level >= MAX_LEVEL) {
        await this.log.log('level', `已達最高等級 LV${MAX_LEVEL}，停止練功。`);
        break;
      }
      this.stats.ticks = tick;
      this.log.setTick(tick);

      // 開戰前先補貨（buyAuto）
      await this.runBuyAuto();

      if (this.cfg.attackMode === 0 || map.monsters.length === 0) {
        await this.log.log('system', `待機中…（attackMode 0 或本圖無怪）HP回復 +${this.char.derived.hpRegen}`);
        this.regen();
        continue;
      }

      // 隨機遭遇一隻本圖怪物
      const monId = map.monsters[this.rng.int(0, map.monsters.length - 1)];
      const mon = this.data.monsters.get(monId);
      if (!mon) continue;

      await this.fight(mon);
      this.regen();
    }

    return this.finish();
  }

  private regen(): void {
    this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + this.char.derived.hpRegen);
    this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + this.char.derived.spRegen);
  }

  private async fight(monDef: Monster): Promise<void> {
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

    const playerFirst = this.cfg.attackMode === 2; // 主動先攻；被動由怪先攻

    let round = 0;
    while (monHp > 0 && this.char.alive && round < 100) {
      round++;

      await this.applyUseSelfItems();

      if (playerFirst) {
        monHp = await this.playerStrike(player, monster, monHp);
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
      if (!this.char.alive) break;

      await this.applyUseSelfItems();

      if (!playerFirst) {
        monHp = await this.playerStrike(player, monster, monHp);
      }
    }

    if (!this.char.alive) {
      await this.handleDeath(monDef);
      return;
    }
    if (monHp <= 0) {
      await this.onKill(monDef);
    }
  }

  // 玩家攻擊（含攻速 ASPD 的額外攻擊）
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

  // useSelf_item：依條件自動使用道具
  private async applyUseSelfItems(): Promise<void> {
    for (const rule of this.cfg.useSelfItems) {
      const item = this.itemByName(rule.item);
      if (!item) continue;
      const cur = rule.stat === 'hp' ? this.char.hp : this.char.sp;
      const max = rule.stat === 'hp' ? this.char.derived.maxHp : this.char.derived.maxSp;
      const threshold = rule.isPercent ? (rule.value / 100) * max : rule.value;
      const met = rule.op === '<' ? cur < threshold : cur > threshold;
      if (!met) continue;
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

    // 經驗值（等級差 > 5 不給）
    const diff = Math.abs(this.char.level - monDef.level);
    let gained = 0;
    if (diff > LEVEL_DIFF_LIMIT) {
      await this.log.log('combat', `擊倒 ${monDef.name}！但等級差 ${diff} > ${LEVEL_DIFF_LIMIT}，未獲得經驗值。`);
    } else {
      gained = monDef.exp;
      this.stats.expGained += gained;
      const ups = this.char.gainExp(gained);
      await this.log.log('combat', `擊倒 ${monDef.name}！獲得經驗 +${gained}（${this.char.exp}/${this.char.level >= MAX_LEVEL ? '--' : this.expToNextStr()}）`);
      if (ups > 0) {
        await this.log.log('level', `*** 升級！ LV${this.char.level}  最大HP ${this.char.derived.maxHp} / 最大SP ${this.char.derived.maxSp} / ATK ${this.char.derived.atk} / DEF ${this.char.derived.def} ***`);
      }
    }

    // 金錢
    const money = monDef.money + this.rng.int(0, Math.ceil(monDef.money * 0.3));
    this.char.money += money;
    this.stats.moneyEarned += money;
    await this.log.log('item', `  拾獲 ${money}z`);

    // 掉落物
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

    // 自動賣出戰利品
    if (this.cfg.sellAuto === 1) {
      await this.sellLoot();
    }
  }

  private expToNextStr(): string {
    return String(expToNext(this.char.level));
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

  private async runBuyAuto(): Promise<void> {
    for (const rule of this.cfg.buyAuto) {
      if (rule.disabled || !rule.item) continue;
      const it = this.itemByName(rule.item);
      if (!it || it.buyPrice <= 0) continue;
      const have = this.char.itemCount(it.itemId);
      if (have >= rule.minAmount) continue;

      // 補到 maxAmount，受所持金限制
      let want = Math.max(0, rule.maxAmount - have);
      const affordable = Math.floor(this.char.money / it.buyPrice);
      const buy = Math.min(want, affordable);
      if (buy <= 0) {
        await this.log.log('shop', `  想購買 ${it.name} 但金錢不足（所持金 ${this.char.money}z）`);
        continue;
      }
      const cost = buy * it.buyPrice;
      this.char.money -= cost;
      this.char.addItem(it.itemId, buy);
      this.stats.moneySpent += cost;
      await this.log.log('shop', `  前往 ${rule.npc} 的 NPC 購買 ${it.name} ×${buy}（-${cost}z，剩 ${this.char.money}z，庫存 ${this.char.itemCount(it.itemId)}）`);
    }
  }

  // 死亡懲罰（GDD 4.6）：失去經驗與金錢，回到存檔點
  private async handleDeath(monDef: Monster): Promise<void> {
    this.stats.deaths++;
    const lostExp = this.char.exp; // 失去本級累積經驗
    const lostMoney = Math.floor(this.char.money * 0.1); // 失去 10% 金錢
    this.char.exp = 0;
    this.char.money -= lostMoney;
    await this.log.log('death', `你被 ${monDef.name} 擊倒了！失去經驗 ${lostExp}、金錢 ${lostMoney}z。`);

    const saveMap = this.data.maps.get(this.cfg.saveMap);
    this.currentMap = this.cfg.saveMap;
    await this.log.log('death', `回到存檔點 ${saveMap ? saveMap.name : this.cfg.saveMap}，原地復活。`);
    // 復活回滿
    this.char.hp = this.char.derived.maxHp;
    this.char.sp = this.char.derived.maxSp;
    // 自動走回練功圖
    await this.log.log('move', `自動移動回練功地圖 ${this.cfg.map}…`);
    this.currentMap = this.cfg.map;
  }

  private finish(): RunStats {
    this.stats.endMoney = this.char.money;
    this.stats.endLevel = this.char.level;
    return this.stats;
  }
}
