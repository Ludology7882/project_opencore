"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/data/csv.ts
  function splitLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }
  function parseCsv(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0 && !l.trimStart().startsWith("#"));
    if (lines.length === 0) return [];
    const header = splitLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitLine(lines[i]);
      const row = {};
      header.forEach((h, idx) => {
        row[h] = cells[idx] ?? "";
      });
      rows.push(row);
    }
    return rows;
  }
  var init_csv = __esm({
    "src/data/csv.ts"() {
      "use strict";
    }
  });

  // src/data/loader.ts
  function buildGameData(raw) {
    const read = (text) => parseCsv(text);
    const jobs = /* @__PURE__ */ new Map();
    for (const r of read(raw.jobs)) {
      jobs.set(r.jobId, {
        jobId: r.jobId,
        name: r.name,
        baseHp: num(r.baseHp),
        baseSp: num(r.baseSp),
        baseAtk: num(r.baseAtk),
        baseDef: num(r.baseDef),
        str: num(r.str),
        agi: num(r.agi),
        vit: num(r.vit),
        dex: num(r.dex),
        int: num(r.int),
        luk: num(r.luk),
        strGrowth: num(r.strGrowth),
        agiGrowth: num(r.agiGrowth),
        vitGrowth: num(r.vitGrowth),
        dexGrowth: num(r.dexGrowth),
        intGrowth: num(r.intGrowth),
        lukGrowth: num(r.lukGrowth)
      });
    }
    const maps = /* @__PURE__ */ new Map();
    for (const r of read(raw.maps)) {
      maps.set(r.mapId, {
        mapId: r.mapId,
        name: r.name,
        monsters: r.monsters ? r.monsters.split(";").map((s) => s.trim()).filter(Boolean) : [],
        connections: r.connections ? r.connections.split(";").map((s) => s.trim()).filter(Boolean) : [],
        isTown: num(r.isTown) === 1
      });
    }
    const monsters = /* @__PURE__ */ new Map();
    for (const r of read(raw.monsters)) {
      monsters.set(r.monsterId, {
        monsterId: r.monsterId,
        name: r.name,
        level: num(r.level),
        hp: num(r.hp),
        atk: num(r.atk),
        def: num(r.def),
        hit: num(r.hit),
        flee: num(r.flee),
        exp: num(r.exp),
        money: num(r.money)
      });
    }
    const items = /* @__PURE__ */ new Map();
    const itemIdByName = /* @__PURE__ */ new Map();
    for (const r of read(raw.items)) {
      const item = {
        itemId: r.itemId,
        name: r.name,
        type: r.type,
        effectValue: num(r.effectValue),
        buyPrice: num(r.buyPrice),
        sellPrice: num(r.sellPrice)
      };
      items.set(item.itemId, item);
      itemIdByName.set(item.name, item.itemId);
    }
    const dropsByMonster = /* @__PURE__ */ new Map();
    for (const r of read(raw.drops)) {
      const d = { monsterId: r.monsterId, itemId: r.itemId, rate: num(r.rate) };
      const arr = dropsByMonster.get(d.monsterId) ?? [];
      arr.push(d);
      dropsByMonster.set(d.monsterId, arr);
    }
    const skills = /* @__PURE__ */ new Map();
    const skillIdByName = /* @__PURE__ */ new Map();
    for (const r of read(raw.skills)) {
      const skill = {
        skillId: r.skillId,
        name: r.name,
        job: r.job,
        spCost: num(r.spCost),
        powerPct: num(r.powerPct, 100),
        reqLevel: num(r.reqLevel, 1)
      };
      skills.set(skill.skillId, skill);
      skillIdByName.set(skill.name, skill.skillId);
    }
    return { jobs, maps, monsters, items, dropsByMonster, skills, itemIdByName, skillIdByName };
  }
  var num;
  var init_loader = __esm({
    "src/data/loader.ts"() {
      "use strict";
      init_csv();
      num = (v, def = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
      };
    }
  });

  // src/config/types.ts
  var DEFAULT_CONFIG;
  var init_types = __esm({
    "src/config/types.ts"() {
      "use strict";
      DEFAULT_CONFIG = {
        map: "A",
        saveMap: "A",
        attackMode: 2,
        itemsTakeAuto: 1,
        sellAuto: 1,
        useSelfItems: [],
        buyAuto: [],
        monControl: [],
        attackSkills: [],
        sitAuto: { hpLower: 0, hpUpper: 100, spLower: 0, spUpper: 100 },
        teleportAutoHp: 0,
        teleportAutoSp: 0
      };
    }
  });

  // src/config/parser.ts
  function matchCondition(line) {
    const m = line.match(/^(hp|sp)\s*([<>])\s*(\d+)\s*(%?)$/i);
    if (!m) return null;
    return {
      stat: m[1].toLowerCase(),
      op: m[2],
      value: Number(m[3]),
      isPercent: m[4] === "%"
    };
  }
  function parseAmount(val) {
    const m = val.match(/(\d+)\s*(%?)/);
    return { value: m ? Number(m[1]) : 0, isPercent: !!(m && m[2]) };
  }
  function parseUseSelfItem(item, body, lineNo) {
    for (const line of body) {
      const c = matchCondition(line);
      if (c) return { item, ...c };
    }
    throw new ConfigError(`\u7B2C ${lineNo} \u884C\u9644\u8FD1\u7684 useSelf_item \u5340\u584A\u7F3A\u5C11\u689D\u4EF6\uFF08\u5982 hp < 75%\uFF09`);
  }
  function parseBuyAuto(item, body) {
    const rule = { item, npc: "", minAmount: 0, maxAmount: 0, disabled: false };
    for (const line of body) {
      const [key, ...rest] = line.split(/\s+/);
      const val = rest.join(" ").trim();
      switch (key.toLowerCase()) {
        case "npc":
          rule.npc = val;
          break;
        case "minamount":
          rule.minAmount = Number(val) || 0;
          break;
        case "maxamount":
          rule.maxAmount = Number(val) || 0;
          break;
        case "disabled":
          rule.disabled = Number(val) === 1;
          break;
      }
    }
    return rule;
  }
  function parseMonControl(monster, body) {
    const rule = {
      monster,
      attack: 1,
      minHpPercent: 0,
      minSpPercent: 0,
      minLevel: 0,
      teleport: false
    };
    for (const line of body) {
      const [key, ...rest] = line.split(/\s+/);
      const val = rest.join(" ").trim();
      switch (key.toLowerCase()) {
        case "attack":
          rule.attack = Number(val);
          break;
        case "minhp":
          rule.minHpPercent = parseAmount(val).value;
          break;
        case "minsp":
          rule.minSpPercent = parseAmount(val).value;
          break;
        case "minlevel":
          rule.minLevel = Number(val) || 0;
          break;
        case "teleport":
          rule.teleport = Number(val) === 1;
          break;
      }
    }
    return rule;
  }
  function parseAttackSkill(skill, body) {
    const rule = {
      skill,
      monsters: [],
      notMonsters: [],
      disabled: false
    };
    for (const line of body) {
      const c = matchCondition(line);
      if (c) {
        if (c.stat === "hp") rule.hp = c;
        else rule.sp = c;
        continue;
      }
      const [key, ...rest] = line.split(/\s+/);
      const val = rest.join(" ").trim();
      const list = () => val.split(/[;\s]+/).map((s) => s.trim()).filter(Boolean);
      switch (key.toLowerCase()) {
        case "monsters":
          rule.monsters = list();
          break;
        case "notmonsters":
          rule.notMonsters = list();
          break;
        case "disabled":
          rule.disabled = Number(val) === 1;
          break;
      }
    }
    return rule;
  }
  function parseConfig(text) {
    const cfg = {
      ...DEFAULT_CONFIG,
      useSelfItems: [],
      buyAuto: [],
      monControl: [],
      attackSkills: [],
      sitAuto: { ...DEFAULT_CONFIG.sitAuto }
    };
    const rawLines = text.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].replace(/#.*$/, "").trim();
      if (!line) continue;
      const blockMatch = line.match(
        /^(useSelf_item|buyAuto|mon_control|attackSkillSlot)\b\s*([^{]*)(\{?.*)$/i
      );
      if (blockMatch && BLOCK_DIRECTIVES.includes(blockMatch[1].toLowerCase())) {
        const directive = blockMatch[1].toLowerCase();
        const name = blockMatch[2].trim();
        const startLine = i + 1;
        let buffer = "";
        let opened = false;
        let closed = false;
        const consume = (t0) => {
          let t = t0;
          if (!opened) {
            const oi = t.indexOf("{");
            if (oi === -1) return false;
            opened = true;
            t = t.slice(oi + 1);
          }
          const ci = t.indexOf("}");
          if (ci === -1) {
            buffer += t + "\n";
            return false;
          }
          buffer += t.slice(0, ci);
          return true;
        };
        closed = consume(blockMatch[3]);
        while (!closed && ++i < rawLines.length) {
          closed = consume(rawLines[i].replace(/#.*$/, ""));
        }
        if (!opened) throw new ConfigError(`\u7B2C ${startLine} \u884C\u7684 ${directive} \u5340\u584A\u7F3A\u5C11 '{'`);
        if (!closed) {
          throw new ConfigError(`\u7B2C ${startLine} \u884C\u7684 ${directive} \u5340\u584A\u7F3A\u5C11\u7D50\u5C3E '}'\uFF08\u62EC\u865F\u5FC5\u9808\u6210\u5C0D\uFF09`);
        }
        const body = buffer.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        if (!name) continue;
        switch (directive) {
          case "useself_item":
            cfg.useSelfItems.push(parseUseSelfItem(name, body, startLine));
            break;
          case "buyauto":
            cfg.buyAuto.push(parseBuyAuto(name, body));
            break;
          case "mon_control":
            cfg.monControl.push(parseMonControl(name, body));
            break;
          case "attackskillslot":
            cfg.attackSkills.push(parseAttackSkill(name, body));
            break;
        }
        continue;
      }
      const [key, ...rest] = line.split(/\s+/);
      const val = rest.join(" ").trim();
      switch (key.toLowerCase()) {
        case "map":
          cfg.map = val;
          break;
        case "savemap":
          cfg.saveMap = val;
          break;
        case "attackmode":
          cfg.attackMode = Number(val) ?? 2;
          break;
        case "itemstakeauto":
          cfg.itemsTakeAuto = Number(val) ?? 1;
          break;
        case "sellauto":
          cfg.sellAuto = Number(val) ?? 0;
          break;
        case "sitauto_hp_lower":
          cfg.sitAuto.hpLower = Number(val) || 0;
          break;
        case "sitauto_hp_upper":
          cfg.sitAuto.hpUpper = Number(val) || 100;
          break;
        case "sitauto_sp_lower":
          cfg.sitAuto.spLower = Number(val) || 0;
          break;
        case "sitauto_sp_upper":
          cfg.sitAuto.spUpper = Number(val) || 100;
          break;
        case "teleportauto_hp":
          cfg.teleportAutoHp = Number(val) || 0;
          break;
        case "teleportauto_sp":
          cfg.teleportAutoSp = Number(val) || 0;
          break;
        default:
          break;
      }
    }
    return cfg;
  }
  var ConfigError, BLOCK_DIRECTIVES;
  var init_parser = __esm({
    "src/config/parser.ts"() {
      "use strict";
      init_types();
      ConfigError = class extends Error {
      };
      BLOCK_DIRECTIVES = ["useself_item", "buyauto", "mon_control", "attackskillslot"];
    }
  });

  // src/game/stats.ts
  function attributesAt(job, level) {
    const ups = Math.max(0, level - 1);
    return {
      str: job.str + job.strGrowth * ups,
      agi: job.agi + job.agiGrowth * ups,
      vit: job.vit + job.vitGrowth * ups,
      dex: job.dex + job.dexGrowth * ups,
      int: job.int + job.intGrowth * ups,
      luk: job.luk + job.lukGrowth * ups
    };
  }
  function computeDerived(job, level) {
    const ups = Math.max(0, level - 1);
    const a = attributesAt(job, level);
    let maxHp = job.baseHp + 50 * ups;
    let maxSp = job.baseSp + 20 * ups;
    let atk = job.baseAtk + Math.floor(ups / 2);
    let def = job.baseDef + Math.floor(ups / 2);
    let hit = Math.floor(ups / 5);
    let flee = Math.floor(ups / 5);
    let crit = Math.floor(ups / 5);
    let aspd = 0;
    let hpRegen = 0;
    let spRegen = 0;
    atk += a.str + Math.floor(a.str / 5) * 3;
    flee += a.agi;
    aspd += Math.floor(a.agi / 5);
    maxHp += Math.floor(maxHp * (a.vit / 100));
    def += Math.floor(a.vit / 2);
    hpRegen += Math.floor(a.vit / 5) * 10;
    hit += a.dex;
    aspd += Math.floor(a.dex / 5);
    maxSp += Math.floor(maxSp * (a.int / 100));
    spRegen += Math.floor(a.int / 3) * 2;
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
      spRegen
    };
  }
  function expToNext(level) {
    if (level >= MAX_LEVEL) return Infinity;
    return EXP_TABLE[level - 1] ?? Infinity;
  }
  var EXP_TABLE, MAX_LEVEL;
  var init_stats = __esm({
    "src/game/stats.ts"() {
      "use strict";
      EXP_TABLE = [2, 3, 5, 8, 13, 21, 34, 55, 89];
      MAX_LEVEL = 10;
    }
  });

  // src/game/character.ts
  var Character;
  var init_character = __esm({
    "src/game/character.ts"() {
      "use strict";
      init_stats();
      Character = class {
        constructor(job, level = 1, money = 0) {
          this.inventory = /* @__PURE__ */ new Map();
          this.job = job;
          this.level = level;
          this.exp = 0;
          this.money = money;
          this.derived = computeDerived(job, level);
          this.hp = this.derived.maxHp;
          this.sp = this.derived.maxSp;
        }
        get attributes() {
          return attributesAt(this.job, this.level);
        }
        get alive() {
          return this.hp > 0;
        }
        recompute() {
          const prevMaxHp = this.derived.maxHp;
          const prevMaxSp = this.derived.maxSp;
          this.derived = computeDerived(this.job, this.level);
          this.hp += this.derived.maxHp - prevMaxHp;
          this.sp += this.derived.maxSp - prevMaxSp;
          this.clamp();
        }
        clamp() {
          this.hp = Math.max(0, Math.min(this.hp, this.derived.maxHp));
          this.sp = Math.max(0, Math.min(this.sp, this.derived.maxSp));
        }
        // 取得經驗，回傳升級次數（供日誌使用）
        gainExp(amount) {
          let levelUps = 0;
          this.exp += amount;
          while (this.level < MAX_LEVEL && this.exp >= expToNext(this.level)) {
            this.exp -= expToNext(this.level);
            this.level++;
            levelUps++;
            this.recompute();
            this.hp = this.derived.maxHp;
            this.sp = this.derived.maxSp;
          }
          if (this.level >= MAX_LEVEL) this.exp = 0;
          return levelUps;
        }
        addItem(itemId, count = 1) {
          this.inventory.set(itemId, (this.inventory.get(itemId) ?? 0) + count);
        }
        itemCount(itemId) {
          return this.inventory.get(itemId) ?? 0;
        }
        // 消耗一件道具，成功回傳 true
        consumeItem(itemId) {
          const n = this.inventory.get(itemId) ?? 0;
          if (n <= 0) return false;
          if (n === 1) this.inventory.delete(itemId);
          else this.inventory.set(itemId, n - 1);
          return true;
        }
      };
    }
  });

  // src/game/combat.ts
  function resolveAttack(attacker, defender, rng) {
    const hitChance = Math.max(5, Math.min(99, BASE_HIT + attacker.hit - defender.flee));
    if (rng.percent() >= hitChance) {
      return { hit: false, crit: false, damage: 0 };
    }
    const crit = rng.percent() < attacker.crit;
    let damage = crit ? attacker.atk : Math.max(1, attacker.atk - defender.def);
    if (crit) damage = Math.floor(damage * 1.5);
    damage = Math.max(1, damage);
    return { hit: true, crit, damage };
  }
  function toCombatant(name, d) {
    return { name, atk: d.atk, def: d.def, hit: d.hit, flee: d.flee, crit: d.crit };
  }
  var BASE_HIT;
  var init_combat = __esm({
    "src/game/combat.ts"() {
      "use strict";
      BASE_HIT = 80;
    }
  });

  // src/game/engine.ts
  var LEVEL_DIFF_LIMIT, MOVE_COST_PER_HOP, FLY_WING, BUTTERFLY_WING, Engine;
  var init_engine = __esm({
    "src/game/engine.ts"() {
      "use strict";
      init_combat();
      init_stats();
      LEVEL_DIFF_LIMIT = 5;
      MOVE_COST_PER_HOP = 2;
      FLY_WING = "fly_wing";
      BUTTERFLY_WING = "butterfly_wing";
      Engine = class {
        constructor(data, cfg, char, log, rng) {
          this.adjacency = /* @__PURE__ */ new Map();
          this.time = 0;
          this.started = false;
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
            endLevel: char.level
          };
        }
        buildAdjacency() {
          for (const m of this.data.maps.values()) {
            if (!this.adjacency.has(m.mapId)) this.adjacency.set(m.mapId, /* @__PURE__ */ new Set());
            for (const c of m.connections) {
              this.adjacency.get(m.mapId).add(c);
              if (!this.adjacency.has(c)) this.adjacency.set(c, /* @__PURE__ */ new Set());
              this.adjacency.get(c).add(m.mapId);
            }
          }
        }
        // 兩張地圖之間的步數（BFS）。同圖回 0，無法連通回 2（保底）。
        mapHops(from, to) {
          if (from === to) return 0;
          const seen = /* @__PURE__ */ new Set([from]);
          let frontier = [from];
          let dist = 0;
          while (frontier.length) {
            dist++;
            const next = [];
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
        item(itemId) {
          return this.data.items.get(itemId);
        }
        itemByName(name) {
          const id = this.data.itemIdByName.get(name);
          return id ? this.data.items.get(id) : void 0;
        }
        hpPct() {
          return this.char.hp / this.char.derived.maxHp * 100;
        }
        spPct() {
          return this.char.sp / this.char.derived.maxSp * 100;
        }
        condMet(c) {
          const cur = c.stat === "hp" ? this.char.hp : this.char.sp;
          const max = c.stat === "hp" ? this.char.derived.maxHp : this.char.derived.maxSp;
          const threshold = c.isPercent ? c.value / 100 * max : c.value;
          return c.op === "<" ? cur < threshold : cur > threshold;
        }
        mapName(id) {
          return this.data.maps.get(id)?.name ?? id;
        }
        // 開場（只執行一次）：印出起始狀態並移動到練功地圖
        async begin() {
          if (this.started) return;
          this.started = true;
          await this.log.log("system", `===== \u5916\u639B\u6A21\u64EC\u5668 \u555F\u52D5 =====`);
          await this.log.log(
            "system",
            `\u89D2\u8272\uFF1A${this.char.job.name}  LV${this.char.level}  HP${this.char.hp}/${this.char.derived.maxHp}  SP${this.char.sp}/${this.char.derived.maxSp}  \u6240\u6301\u91D1 ${this.char.money}z`
          );
          const map = this.data.maps.get(this.cfg.map);
          if (!map) {
            await this.log.log("death", `\u8A2D\u5B9A\u932F\u8AA4\uFF1A\u627E\u4E0D\u5230\u5730\u5716\u300C${this.cfg.map}\u300D`);
            return;
          }
          await this.log.log("move", `\u79FB\u52D5\u5230\u7DF4\u529F\u5730\u5716\uFF1A${map.name}(${map.mapId})  \u653B\u64CA\u6A21\u5F0F ${this.cfg.attackMode}`);
        }
        // 即時套用新設定（角色狀態保留，可中途換圖／改策略）
        async applyConfig(cfg) {
          const oldMap = this.cfg.map;
          this.cfg = cfg;
          if (cfg.map !== oldMap) {
            this.currentMap = cfg.map;
            await this.log.log("move", `\u2605 \u5957\u7528\u65B0\u8A2D\u5B9A\uFF1A\u6539\u5F80 ${this.mapName(cfg.map)}(${cfg.map}) \u7DF4\u529F`);
          } else {
            await this.log.log("system", `\u2605 \u5DF2\u5957\u7528\u65B0\u8A2D\u5B9A`);
          }
        }
        // 推進一個時間單位的決策循環（補貨 → 休息 → 戰鬥/待機）。
        // remaining 用於限制休息/移動不超過剩餘時間（即時模式給很大值）。
        async tick(remaining = Number.MAX_SAFE_INTEGER) {
          const map = this.data.maps.get(this.cfg.map);
          this.log.setTick(this.time + 1);
          if (!map) {
            await this.log.log("death", `\u8A2D\u5B9A\u932F\u8AA4\uFF1A\u627E\u4E0D\u5230\u5730\u5716\u300C${this.cfg.map}\u300D\uFF0C\u5F85\u6A5F\u4E2D\u3002`);
            this.time++;
            return;
          }
          const travel = await this.maybeRestock(remaining);
          this.time += travel;
          if (travel >= remaining) return;
          const sat = await this.maybeSit(remaining - travel);
          this.time += sat;
          if (travel + sat >= remaining) return;
          if (this.cfg.attackMode === 0 || map.monsters.length === 0) {
            await this.log.log("system", `\u5F85\u6A5F\u4E2D\u2026\uFF08attackMode 0 \u6216\u672C\u5716\u7121\u602A\uFF09`);
            this.regen();
            this.time++;
            return;
          }
          const mon = this.chooseMonster(map.monsters);
          if (!mon) {
            await this.log.log("system", `\u6C92\u6709\u7B26\u5408\u689D\u4EF6\u53EF\u6253\u7684\u602A\uFF08mon_control \u904E\u6FFE\uFF09\uFF0C\u5F85\u6A5F\u56DE\u5FA9\u3002`);
            this.regen();
            this.time++;
            return;
          }
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
            stats: { ...this.stats, endMoney: this.char.money, endLevel: this.char.level }
          };
        }
        // CLI：跑固定回合數後回傳結算（達最高等級即停）
        async run(maxTicks) {
          await this.begin();
          if (!this.data.maps.get(this.cfg.map)) return this.finish();
          while (this.time < maxTicks && this.char.level < MAX_LEVEL) {
            await this.tick(maxTicks - this.time);
          }
          if (this.char.level >= MAX_LEVEL) {
            this.log.setTick(this.time);
            await this.log.log("level", `\u5DF2\u9054\u6700\u9AD8\u7B49\u7D1A LV${MAX_LEVEL}\uFF0C\u505C\u6B62\u7DF4\u529F\u3002`);
          }
          this.stats.ticks = Math.min(this.time, maxTicks);
          return this.finish();
        }
        // 站立時的微量自然回復
        regen() {
          this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + this.char.derived.hpRegen);
          this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + this.char.derived.spRegen);
        }
        // ---- mon_control：挑選要打的怪 ----
        monControlFor(monsterName) {
          const exact = this.cfg.monControl.find((r) => r.monster === monsterName);
          if (exact) return exact;
          const all = this.cfg.monControl.find((r) => r.monster.toLowerCase() === "all");
          if (all) return all;
          return { monster: monsterName, attack: 1, minHpPercent: 0, minSpPercent: 0, minLevel: 0, teleport: false };
        }
        chooseMonster(monsterIds) {
          const candidates = [];
          for (const id of monsterIds) {
            const mon = this.data.monsters.get(id);
            if (!mon) continue;
            const rule = this.monControlFor(mon.name);
            if (rule.attack < 1 || rule.teleport) continue;
            if (this.char.level < rule.minLevel) continue;
            if (rule.minHpPercent > 0 && this.hpPct() < rule.minHpPercent) continue;
            if (rule.minSpPercent > 0 && this.spPct() < rule.minSpPercent) continue;
            candidates.push(mon);
          }
          if (candidates.length === 0) return void 0;
          return candidates[this.rng.int(0, candidates.length - 1)];
        }
        // ---- 坐下休息 ----
        async maybeSit(remaining) {
          const s = this.cfg.sitAuto;
          const needHp = s.hpLower > 0 && this.hpPct() < s.hpLower;
          const needSp = s.spLower > 0 && this.spPct() < s.spLower;
          if (!needHp && !needSp || remaining <= 0) return 0;
          const sitHp = Math.max(this.char.derived.hpRegen * 2, Math.ceil(this.char.derived.maxHp * 0.12));
          const sitSp = Math.max(this.char.derived.spRegen * 2, Math.ceil(this.char.derived.maxSp * 0.12));
          await this.log.log("system", `\u5750\u4E0B\u4F11\u606F\u2026\uFF08HP ${this.char.hp}/${this.char.derived.maxHp} SP ${this.char.sp}/${this.char.derived.maxSp}\uFF09`);
          let rounds = 0;
          const cap = Math.min(remaining, 2e3);
          while (rounds < cap) {
            const hpDone = s.hpLower <= 0 || this.char.hp >= this.char.derived.maxHp || this.hpPct() >= s.hpUpper;
            const spDone = s.spLower <= 0 || this.char.sp >= this.char.derived.maxSp || this.spPct() >= s.spUpper;
            if (hpDone && spDone) break;
            this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + sitHp);
            this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + sitSp);
            rounds++;
          }
          this.stats.sitTicks += rounds;
          await this.log.log("system", `\u4F11\u606F\u7D50\u675F\uFF08\u8017\u6642 ${rounds}\uFF09\u2192 HP ${this.char.hp}/${this.char.derived.maxHp} SP ${this.char.sp}/${this.char.derived.maxSp}`);
          return rounds;
        }
        // ---- 戰鬥 ----
        async fight(monDef) {
          let monHp = monDef.hp;
          const player = toCombatant(this.char.job.name, this.char.derived);
          const monster = {
            name: monDef.name,
            atk: monDef.atk,
            def: monDef.def,
            hit: monDef.hit,
            flee: monDef.flee,
            crit: 0
          };
          await this.log.log("combat", `\u906D\u9047 ${monDef.name}(LV${monDef.level}) HP${monDef.hp}`);
          const playerFirst = this.cfg.attackMode === 2;
          let round = 0;
          while (monHp > 0 && this.char.alive && round < 100) {
            round++;
            await this.applyUseSelfItems();
            if (playerFirst) {
              monHp = await this.playerAction(player, monster, monHp, monDef);
              if (monHp <= 0) break;
            }
            const mr = resolveAttack(monster, player, this.rng);
            if (mr.hit) {
              this.char.hp -= mr.damage;
              await this.log.log("combat", `  ${monDef.name} \u653B\u64CA\uFF0C\u9020\u6210 ${mr.damage} \u50B7\u5BB3 \u2192 HP ${Math.max(0, this.char.hp)}/${this.char.derived.maxHp}`);
            } else {
              await this.log.log("combat", `  ${monDef.name} \u7684\u653B\u64CA\u88AB\u9583\u907F`);
            }
            this.char.clamp();
            if (await this.tryTeleportEscape(monDef)) {
              return "escaped";
            }
            if (!this.char.alive) break;
            await this.applyUseSelfItems();
            if (!playerFirst) {
              monHp = await this.playerAction(player, monster, monHp, monDef);
            }
          }
          if (!this.char.alive) {
            await this.handleDeath(monDef);
            return "died";
          }
          if (monHp <= 0) {
            await this.onKill(monDef);
            return "killed";
          }
          return "escaped";
        }
        // 玩家行動：優先施放符合條件的攻擊技能，否則普通攻擊
        async playerAction(player, monster, monHp, monDef) {
          const skill = this.chooseSkill(monDef);
          if (skill) {
            this.char.sp = Math.max(0, this.char.sp - skill.spCost);
            const scaled = { ...player, atk: Math.floor(player.atk * skill.powerPct / 100) };
            const r = resolveAttack(scaled, monster, this.rng);
            if (r.hit) {
              monHp -= r.damage;
              const tag = r.crit ? "\u3010\u7206\u64CA\u3011" : "";
              await this.log.log("combat", `  ${tag}\u65BD\u653E\u300C${skill.name}\u300D(SP-${skill.spCost})\uFF0C\u9020\u6210 ${r.damage} \u50B7\u5BB3 \u2192 \u6575HP ${Math.max(0, monHp)}`);
            } else {
              await this.log.log("combat", `  \u65BD\u653E\u300C${skill.name}\u300D\u5931\u8AA4\uFF08\u88AB\u9583\u907F\uFF09`);
            }
            return monHp;
          }
          return this.playerStrike(player, monster, monHp);
        }
        chooseSkill(monDef) {
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
          return void 0;
        }
        // 普通攻擊（含攻速 ASPD 額外攻擊）
        async playerStrike(player, monster, monHp) {
          const aspd = this.char.derived.aspd;
          const extraAttacks = Math.floor(aspd / 100) + (this.rng.percent() < aspd % 100 ? 1 : 0);
          const attacks = 1 + extraAttacks;
          for (let i = 0; i < attacks && monHp > 0; i++) {
            const r = resolveAttack(player, monster, this.rng);
            if (r.hit) {
              monHp -= r.damage;
              const tag = r.crit ? "\u3010\u7206\u64CA\u3011" : "";
              await this.log.log("combat", `  ${tag}\u653B\u64CA ${monster.name}\uFF0C\u9020\u6210 ${r.damage} \u50B7\u5BB3 \u2192 \u6575HP ${Math.max(0, monHp)}`);
            } else {
              await this.log.log("combat", `  \u653B\u64CA ${monster.name} \u5931\u8AA4\uFF08\u88AB\u9583\u907F\uFF09`);
            }
          }
          return monHp;
        }
        // teleportAuto：HP/SP 過低時用蒼蠅之翼逃離
        async tryTeleportEscape(monDef) {
          const hpTrig = this.cfg.teleportAutoHp > 0 && this.hpPct() < this.cfg.teleportAutoHp;
          const spTrig = this.cfg.teleportAutoSp > 0 && this.spPct() < this.cfg.teleportAutoSp;
          if (!hpTrig && !spTrig) return false;
          if (this.char.itemCount(FLY_WING) <= 0) return false;
          this.char.consumeItem(FLY_WING);
          this.stats.escapes++;
          await this.log.log("item", `  \u26A1 \u5371\u6025\uFF01\u4F7F\u7528\u84BC\u8805\u4E4B\u7FFC\u9003\u96E2 ${monDef.name}\uFF08\u5269 ${this.char.itemCount(FLY_WING)} \u7FFC\uFF09`);
          return true;
        }
        // useSelf_item：依條件自動使用道具
        async applyUseSelfItems() {
          for (const rule of this.cfg.useSelfItems) {
            const item = this.itemByName(rule.item);
            if (!item) continue;
            if (!this.condMet({ stat: rule.stat, op: rule.op, value: rule.value, isPercent: rule.isPercent })) continue;
            if (this.char.itemCount(item.itemId) <= 0) continue;
            this.char.consumeItem(item.itemId);
            if (item.type === "heal_hp") {
              this.char.hp = Math.min(this.char.derived.maxHp, this.char.hp + item.effectValue);
            } else if (item.type === "heal_sp") {
              this.char.sp = Math.min(this.char.derived.maxSp, this.char.sp + item.effectValue);
            }
            await this.log.log("item", `  \u4F7F\u7528 ${item.name}\uFF08${rule.stat.toUpperCase()} ${rule.op} ${rule.value}${rule.isPercent ? "%" : ""}\uFF09\u2192 HP ${this.char.hp}/${this.char.derived.maxHp} SP ${this.char.sp}/${this.char.derived.maxSp}\uFF08\u5269 ${this.char.itemCount(item.itemId)}\uFF09`);
          }
        }
        async onKill(monDef) {
          this.stats.kills++;
          const diff = Math.abs(this.char.level - monDef.level);
          if (diff > LEVEL_DIFF_LIMIT) {
            await this.log.log("combat", `\u64CA\u5012 ${monDef.name}\uFF01\u4F46\u7B49\u7D1A\u5DEE ${diff} > ${LEVEL_DIFF_LIMIT}\uFF0C\u672A\u7372\u5F97\u7D93\u9A57\u503C\u3002`);
          } else {
            const gained = monDef.exp;
            this.stats.expGained += gained;
            const ups = this.char.gainExp(gained);
            await this.log.log("combat", `\u64CA\u5012 ${monDef.name}\uFF01\u7372\u5F97\u7D93\u9A57 +${gained}\uFF08${this.char.exp}/${this.char.level >= MAX_LEVEL ? "--" : expToNext(this.char.level)}\uFF09`);
            if (ups > 0) {
              await this.log.log("level", `*** \u5347\u7D1A\uFF01 LV${this.char.level}  \u6700\u5927HP ${this.char.derived.maxHp} / \u6700\u5927SP ${this.char.derived.maxSp} / ATK ${this.char.derived.atk} / DEF ${this.char.derived.def} ***`);
            }
          }
          const money = monDef.money + this.rng.int(0, Math.ceil(monDef.money * 0.3));
          this.char.money += money;
          this.stats.moneyEarned += money;
          await this.log.log("item", `  \u62FE\u7372 ${money}z`);
          if (this.cfg.itemsTakeAuto !== 0) {
            const drops = this.data.dropsByMonster.get(monDef.monsterId) ?? [];
            for (const d of drops) {
              if (this.rng.chance(d.rate)) {
                const it = this.item(d.itemId);
                if (!it) continue;
                this.char.addItem(it.itemId, 1);
                await this.log.log("item", `  \u64BF\u53D6 ${it.name} \xD71`);
              }
            }
          }
          if (this.cfg.sellAuto === 1) await this.sellLoot();
        }
        async sellLoot() {
          let total = 0;
          for (const [itemId, count] of Array.from(this.char.inventory.entries())) {
            const it = this.item(itemId);
            if (!it || it.type !== "loot") continue;
            total += it.sellPrice * count;
            this.char.inventory.delete(itemId);
          }
          if (total > 0) {
            this.char.money += total;
            this.stats.moneyEarned += total;
            await this.log.log("shop", `  \u81EA\u52D5\u8CE3\u51FA\u6230\u5229\u54C1\uFF0C\u7372\u5F97 ${total}z\uFF08\u6240\u6301\u91D1 ${this.char.money}z\uFF09`);
          }
        }
        // 補貨 + 移動成本。回傳本次花費的時間單位。
        async maybeRestock(remaining) {
          const needsBuy = (item, minAmount) => this.char.itemCount(item.itemId) < minAmount && Math.floor(this.char.money / Math.max(1, item.buyPrice)) > 0;
          const active = this.cfg.buyAuto.filter((r) => {
            if (r.disabled || !r.item) return false;
            const it = this.itemByName(r.item);
            return !!it && it.buyPrice > 0 && needsBuy(it, r.minAmount);
          });
          if (active.length === 0 || remaining <= 0) return 0;
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
        async travelCost(dest) {
          const hops = this.mapHops(this.currentMap, dest);
          if (hops === 0) return 1;
          let cost = 2 * hops * MOVE_COST_PER_HOP;
          if (dest === this.cfg.saveMap && this.char.itemCount(BUTTERFLY_WING) > 0) {
            this.char.consumeItem(BUTTERFLY_WING);
            cost = hops * MOVE_COST_PER_HOP + 1;
            await this.log.log("move", `  \u4F7F\u7528\u8774\u8776\u4E4B\u7FFC\u77AC\u79FB\u56DE ${dest} \u88DC\u8CA8\uFF08\u5269 ${this.char.itemCount(BUTTERFLY_WING)} \u7FFC\uFF09`);
          } else {
            await this.log.log("move", `  \u6B65\u884C\u524D\u5F80 ${dest} \u88DC\u8CA8\uFF08\u4F86\u56DE\u7D04 ${cost} \u6642\u9593\uFF09`);
          }
          return cost;
        }
        async buyOne(itemName, minAmount, maxAmount, dest) {
          const it = this.itemByName(itemName);
          if (!it || it.buyPrice <= 0) return;
          const have = this.char.itemCount(it.itemId);
          if (have >= minAmount) return;
          const want = Math.max(0, maxAmount - have);
          const affordable = Math.floor(this.char.money / it.buyPrice);
          const buy = Math.min(want, affordable);
          if (buy <= 0) {
            await this.log.log("shop", `  \u60F3\u8CFC\u8CB7 ${it.name} \u4F46\u91D1\u9322\u4E0D\u8DB3\uFF08\u6240\u6301\u91D1 ${this.char.money}z\uFF09`);
            return;
          }
          const cost = buy * it.buyPrice;
          this.char.money -= cost;
          this.char.addItem(it.itemId, buy);
          this.stats.moneySpent += cost;
          await this.log.log("shop", `  \u5728 ${dest} \u8CFC\u8CB7 ${it.name} \xD7${buy}\uFF08-${cost}z\uFF0C\u5269 ${this.char.money}z\uFF0C\u5EAB\u5B58 ${this.char.itemCount(it.itemId)}\uFF09`);
        }
        // 死亡懲罰（GDD 4.6）
        async handleDeath(monDef) {
          this.stats.deaths++;
          const lostExp = this.char.exp;
          const lostMoney = Math.floor(this.char.money * 0.1);
          this.char.exp = 0;
          this.char.money -= lostMoney;
          await this.log.log("death", `\u4F60\u88AB ${monDef.name} \u64CA\u5012\u4E86\uFF01\u5931\u53BB\u7D93\u9A57 ${lostExp}\u3001\u91D1\u9322 ${lostMoney}z\u3002`);
          const saveMap = this.data.maps.get(this.cfg.saveMap);
          await this.log.log("death", `\u56DE\u5230\u5B58\u6A94\u9EDE ${saveMap ? saveMap.name : this.cfg.saveMap}\uFF0C\u539F\u5730\u5FA9\u6D3B\u3002`);
          this.char.hp = this.char.derived.maxHp;
          this.char.sp = this.char.derived.maxSp;
          this.currentMap = this.cfg.map;
        }
        finish() {
          this.stats.endMoney = this.char.money;
          this.stats.endLevel = this.char.level;
          return this.stats;
        }
      };
    }
  });

  // src/game/logger.ts
  var sleep, Logger;
  var init_logger = __esm({
    "src/game/logger.ts"() {
      "use strict";
      sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      Logger = class {
        constructor(sink, delayMs = 0) {
          this.tick = 0;
          this.sink = sink;
          this.delayMs = delayMs;
        }
        setTick(t) {
          this.tick = t;
        }
        // 即時調整每行延遲（網頁版速度控制用）
        setDelay(ms) {
          this.delayMs = ms;
        }
        async log(channel, message) {
          this.sink(channel, message, this.tick);
          if (this.delayMs > 0) await sleep(this.delayMs);
        }
      };
    }
  });

  // src/util/rng.ts
  var Rng;
  var init_rng = __esm({
    "src/util/rng.ts"() {
      "use strict";
      Rng = class {
        constructor(seed) {
          this.state = seed >>> 0;
        }
        // 回傳 [0,1)
        next() {
          this.state |= 0;
          this.state = this.state + 1831565813 | 0;
          let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
        // [0,100)
        percent() {
          return this.next() * 100;
        }
        // 整數 [min,max]
        int(min, max) {
          return Math.floor(this.next() * (max - min + 1)) + min;
        }
        chance(rate) {
          return this.next() < rate;
        }
      };
    }
  });

  // data/jobs.csv
  var jobs_default;
  var init_jobs = __esm({
    "data/jobs.csv"() {
      jobs_default = "jobId,name,baseHp,baseSp,baseAtk,baseDef,str,agi,vit,dex,int,luk,strGrowth,agiGrowth,vitGrowth,dexGrowth,intGrowth,lukGrowth\nswordsman,\u528D\u58EB,100,30,5,3,6,4,5,4,2,3,1,1,1,1,0,0\n";
    }
  });

  // data/maps.csv
  var maps_default;
  var init_maps = __esm({
    "data/maps.csv"() {
      maps_default = "mapId,name,monsters,connections,isTown\nA,\u65B0\u624B\u8349\u539F,poring;sheep,B,1\nB,\u54E5\u5E03\u6797\u68EE\u6797,mushroom;goblin,A;C,0\nC,\u534A\u7378\u4EBA\u8C37\u5730,orc_archer;orc,B,0\n";
    }
  });

  // data/monsters.csv
  var monsters_default;
  var init_monsters = __esm({
    "data/monsters.csv"() {
      monsters_default = "monsterId,name,level,hp,atk,def,hit,flee,exp,money\nporing,\u6CE2\u5229,1,30,6,1,80,5,2,3\nsheep,\u7DBF\u7F8A,2,50,9,2,82,8,3,5\nmushroom,\u8611\u83C7\u602A,3,80,13,4,85,10,5,8\ngoblin,\u54E5\u5E03\u6797,4,120,18,6,88,14,8,14\norc_archer,\u7378\u4EBA\u5F13\u624B,6,180,26,8,92,18,14,24\norc,\u534A\u7378\u4EBA,7,260,34,12,95,16,21,38\n";
    }
  });

  // data/items.csv
  var items_default;
  var init_items = __esm({
    "data/items.csv"() {
      items_default = "itemId,name,type,effectValue,buyPrice,sellPrice\nhp_potion,\u88DC\u8840\u85E5\u6C34,heal_hp,50,10,4\nsp_potion,\u88DC\u9B54\u85E5\u6C34,heal_sp,30,12,5\nfly_wing,\u84BC\u8805\u4E4B\u7FFC,wing_escape,0,8,1\nbutterfly_wing,\u8774\u8776\u4E4B\u7FFC,wing_return,0,30,3\napple_jelly,\u860B\u679C\u679C\u51CD,loot,0,0,8\nfluff,\u68C9\u7D6E,loot,0,0,6\nwool,\u7F8A\u6BDB,loot,0,0,15\nmushroom_spore,\u8611\u83C7\u5B62\u5B50,loot,0,0,12\ngoblin_tooth,\u54E5\u5E03\u6797\u4E4B\u7259,loot,0,0,25\narrow_bundle,\u7378\u4EBA\u4E4B\u7BAD,loot,0,0,30\norc_tusk,\u7378\u7259,loot,0,0,40\n";
    }
  });

  // data/drops.csv
  var drops_default;
  var init_drops = __esm({
    "data/drops.csv"() {
      drops_default = "monsterId,itemId,rate\nporing,apple_jelly,0.5\nporing,hp_potion,0.05\nsheep,fluff,0.6\nsheep,wool,0.25\nmushroom,mushroom_spore,0.55\nmushroom,hp_potion,0.08\ngoblin,goblin_tooth,0.4\ngoblin,sp_potion,0.1\norc_archer,arrow_bundle,0.45\norc_archer,hp_potion,0.12\norc,orc_tusk,0.35\norc,hp_potion,0.15\n";
    }
  });

  // data/skills.csv
  var skills_default;
  var init_skills = __esm({
    "data/skills.csv"() {
      skills_default = "skillId,name,job,spCost,powerPct,reqLevel\nbash,\u91CD\u65AC,swordsman,8,180,1\nbowling,\u885D\u649E,swordsman,18,260,5\n";
    }
  });

  // config.txt
  var config_default;
  var init_config = __esm({
    "config.txt"() {
      config_default = "# ================================================\n#  \u5916\u639B\u6A21\u64EC\u5668 \u8A2D\u5B9A\u6A94 (config.txt)\n#  \u4FEE\u6539\u53C3\u6578\uFF0C\u5B58\u6A94\u5F8C\u91CD\u65B0\u57F7\u884C npm start\uFF0C\u89C0\u5BDF\u65E5\u8A8C\u8207\u7D50\u7B97\u6548\u7387\u3002\n#  \u4E95\u5B57\u865F # \u4E4B\u5F8C\u70BA\u8A3B\u89E3\u3002\n# ================================================\n\n# --- \u7DF4\u529F\u5730\u9EDE ---\nmap B               # A \u65B0\u624B\u8349\u539F / B \u54E5\u5E03\u6797\u68EE\u6797 / C \u534A\u7378\u4EBA\u8C37\u5730\nsaveMap A           # \u5B58\u6A94\u9EDE\uFF08\u6B7B\u4EA1\u5FA9\u6D3B\u8655 / \u8774\u8776\u4E4B\u7FFC\u56DE\u53BB\u7684\u5730\u65B9\uFF09\n\n# --- \u884C\u70BA\u6A21\u5F0F ---\nattackMode 2        # 0 \u4E0D\u653B\u64CA / 1 \u88AB\u52D5 / 2 \u4E3B\u52D5\nitemsTakeAuto 1     # 0 \u4E0D\u64BF / 1 \u812B\u6230\u624D\u64BF / 2 \u770B\u5230\u5C31\u64BF\nsellAuto 1          # 0 \u4E0D\u8CE3 / 1 \u6230\u5229\u54C1\u5168\u8CE3\n\n# --- \u5750\u4E0B\u4F11\u606F\uFF08HP/SP \u4F4E\u65BC lower% \u5C31\u5750\u4E0B\u56DE\u5FA9\uFF0C\u56DE\u5230 upper% \u8D77\u8EAB\uFF09---\n# \u5750\u8457\u56DE\u5FA9\u4E0D\u82B1\u9322\uFF0C\u4F46\u8981\u82B1\u6642\u9593\uFF08\u72A7\u7272\u7DF4\u529F\u6548\u7387\uFF09\u3002\nsitAuto_hp_lower 30\nsitAuto_hp_upper 80\nsitAuto_sp_lower 15\nsitAuto_sp_upper 70\n\n# --- \u7DCA\u6025\u9003\u812B\uFF08HP/SP \u4F4E\u65BC % \u7528\u84BC\u8805\u4E4B\u7FFC\u9003\u8DD1\uFF0C\u9700\u5148\u5099\u7FFC\uFF09---\nteleportAuto_hp 15\nteleportAuto_sp 0\n\n# --- \u9010\u602A\u63A7\u5236 mon_control [\u602A\u540D|all] ---\n# attack: -1 \u5B8C\u5168\u4E0D\u6253 / 0 \u88AB\u52D5 / 1 \u4E3B\u52D5\n# minHp/minSp: \u81EA\u8EAB\u767E\u5206\u6BD4\u9AD8\u65BC\u6B64\u624D\u4E3B\u52D5\u958B\u6253   minLevel: \u7B49\u7D1A\u5920\u624D\u6253   teleport: 1=\u770B\u5230\u5C31\u907F\u958B\nmon_control all {\n    attack 1\n}\n# \u7BC4\u4F8B\uFF1A\u7B49\u7D1A\u5230 5 \u518D\u6253\u54E5\u5E03\u6797\uFF1BHP \u6C92\u904E\u534A\u4E0D\u4E3B\u52D5\u627E\nmon_control \u54E5\u5E03\u6797 {\n    attack 1\n    minLevel 1\n    minHp 40%\n}\n\n# --- \u653B\u64CA\u6280\u80FD attackSkillSlot [\u6280\u80FD\u540D] ---\n# SP \u8DB3\u5920\u4E14\u689D\u4EF6\u9054\u6210\u6642\u6539\u7528\u6280\u80FD\uFF08\u6BD4\u5E73\u780D\u5F37\u4F46\u8017 SP\uFF09\u3002\nattackSkillSlot \u91CD\u65AC {\n    sp > 8\n}\n\n# --- \u81EA\u52D5\u4F7F\u7528\u7269\u54C1 useSelf_item [\u7269\u54C1\u540D] { \u689D\u4EF6 } ---\nuseSelf_item \u88DC\u8840\u85E5\u6C34 {\n    hp < 50%\n}\n\n# --- \u81EA\u52D5\u8CFC\u8CB7 buyAuto [\u7269\u54C1\u540D] { npc \u57CE\u93AE, minAmount, maxAmount, disabled } ---\n# \u88DC\u8CA8\u8981\u8D70\u56DE\u57CE\u93AE\uFF08\u82B1\u6642\u9593\uFF09\uFF1B\u5099\u8774\u8776\u4E4B\u7FFC\u53EF\u7701\u53BB\u7A0B\u3002\nbuyAuto \u88DC\u8840\u85E5\u6C34 {\n    npc A\n    minAmount 5\n    maxAmount 20\n    disabled 0\n}\nbuyAuto \u84BC\u8805\u4E4B\u7FFC {\n    npc A\n    minAmount 3\n    maxAmount 10\n    disabled 0\n}\n";
    }
  });

  // src/web/main.ts
  var require_main = __commonJS({
    "src/web/main.ts"() {
      init_loader();
      init_parser();
      init_character();
      init_engine();
      init_logger();
      init_rng();
      init_jobs();
      init_maps();
      init_monsters();
      init_items();
      init_drops();
      init_skills();
      init_config();
      var data = buildGameData({
        jobs: jobs_default,
        maps: maps_default,
        monsters: monsters_default,
        items: items_default,
        drops: drops_default,
        skills: skills_default
      });
      var $ = (id) => document.getElementById(id);
      var logEl = $("log");
      var cfgEl = $("config");
      var runBtn = $("run");
      var applyBtn = $("apply");
      var resetBtn = $("reset");
      var seedEl = $("seed");
      var speedEl = $("speed");
      var jobEl = $("job");
      var statusEl = $("status");
      var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
      cfgEl.value = config_default;
      for (const job of data.jobs.values()) {
        const opt = document.createElement("option");
        opt.value = job.jobId;
        opt.textContent = job.name;
        jobEl.appendChild(opt);
      }
      var engine = null;
      var curLogger = null;
      var running = false;
      var stopFlag = false;
      var gen = 0;
      function appendLine(channel, message, tick) {
        const div = document.createElement("div");
        div.className = "line " + channel;
        div.textContent = `[${String(tick).padStart(4, "0")}] ${message}`;
        logEl.appendChild(div);
        while (logEl.childElementCount > 800) logEl.removeChild(logEl.firstChild);
        logEl.scrollTop = logEl.scrollHeight;
        if (engine) updateStatus();
      }
      function initGame() {
        let cfg;
        try {
          cfg = parseConfig(cfgEl.value);
        } catch (e) {
          appendLine("death", "config \u89E3\u6790\u5931\u6557\uFF1A" + (e instanceof Error ? e.message : String(e)), 0);
          return false;
        }
        const job = data.jobs.get(jobEl.value) ?? data.jobs.values().next().value;
        if (!job) {
          appendLine("death", "\u627E\u4E0D\u5230\u8077\u696D\u8CC7\u6599", 0);
          return false;
        }
        const char = new Character(job, 1, 200);
        curLogger = new Logger(appendLine, Number(speedEl.value) || 0);
        engine = new Engine(data, cfg, char, curLogger, new Rng(Number(seedEl.value) || 1));
        return true;
      }
      async function loop() {
        if (running) return;
        if (!engine && !initGame()) return;
        running = true;
        stopFlag = false;
        const myGen = gen;
        refreshButtons();
        await engine.begin();
        while (!stopFlag && myGen === gen) {
          await engine.tick();
          updateStatus();
          await sleep2(0);
        }
        running = false;
        refreshButtons();
      }
      function pause() {
        stopFlag = true;
      }
      async function applyConfig() {
        let cfg;
        try {
          cfg = parseConfig(cfgEl.value);
        } catch (e) {
          appendLine("death", "config \u89E3\u6790\u5931\u6557\uFF1A" + (e instanceof Error ? e.message : String(e)), 0);
          return;
        }
        if (!engine) {
          initGame();
          updateStatus();
          return;
        }
        await engine.applyConfig(cfg);
        updateStatus();
      }
      function reset() {
        gen++;
        stopFlag = true;
        running = false;
        engine = null;
        curLogger = null;
        logEl.innerHTML = "";
        statusEl.innerHTML = "\u5F85\u6A5F\u4E2D \u2014 \u6309\u300C\u958B\u59CB\u639B\u6A5F\u300D\u555F\u52D5";
        if (initGame()) updateStatus();
        refreshButtons();
      }
      function refreshButtons() {
        runBtn.textContent = running ? "\u23F8 \u66AB\u505C" : engine && engine.getState().time > 0 ? "\u25B6 \u7E7C\u7E8C" : "\u25B6 \u958B\u59CB\u639B\u6A5F";
      }
      function updateStatus() {
        if (!engine) return;
        const s = engine.getState();
        const net = s.stats.endMoney - s.stats.startMoney;
        const expPerTick = s.time ? (s.stats.expGained / s.time).toFixed(2) : "0";
        const moneyPerTick = s.time ? (net / s.time).toFixed(2) : "0";
        const lvTxt = s.maxLevel ? `LV${s.level}\uFF08\u6EFF\u7D1A\u30FB\u7E8C\u8CFA\uFF09` : `LV${s.level}\uFF08${s.exp}/${s.expNext}\uFF09`;
        statusEl.innerHTML = `<b>${lvTxt}</b>\u3000HP ${s.hp}/${s.maxHp}\u3000SP ${s.sp}/${s.maxSp}\u3000\u6240\u6301\u91D1 ${s.money}z\u3000@${s.mapName}<br>\u56DE\u5408 ${s.time}\uFF5C\u64CA\u6BBA ${s.stats.kills}\uFF5C\u6B7B\u4EA1 ${s.stats.deaths}\uFF5C\u9003\u8DD1 ${s.stats.escapes}\uFF5C\u4F11\u606F ${s.stats.sitTicks}\uFF5C\u79FB\u52D5 ${s.stats.travelTicks}\u3000<span class="hi">\u7D93\u9A57/\u56DE\u5408 ${expPerTick}\u3000\u6DE8\u91D1\u9322/\u56DE\u5408 ${moneyPerTick}z</span>`;
      }
      runBtn.addEventListener("click", () => running ? pause() : loop());
      applyBtn.addEventListener("click", applyConfig);
      resetBtn.addEventListener("click", reset);
      speedEl.addEventListener("change", () => curLogger?.setDelay(Number(speedEl.value) || 0));
      reset();
    }
  });
  require_main();
})();
