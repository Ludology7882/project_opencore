// config.txt 解析器 — 模仿 OpenKore config 風格。
// 支援：
//   key value                          單行設定（如 map B、sitAuto_hp_lower 40）
//   區塊指令 { ... }：useSelf_item / buyAuto / mon_control / attackSkillSlot
// 區塊規則：
//   - 括號必須成對；支援單行 `{ a, b }`、多行、逗號或換行分隔欄位
//   - 名稱（物品/怪物/技能）沒填 → 該區塊關閉

import {
  GameConfig,
  DEFAULT_CONFIG,
  AttackMode,
  ItemsTakeAuto,
  SellAuto,
  UseSelfItemRule,
  BuyAutoRule,
  MonControlRule,
  AttackSkillRule,
  Condition,
  Stat,
  Op,
} from './types';

export class ConfigError extends Error {}

const BLOCK_DIRECTIVES = ['useself_item', 'buyauto', 'mon_control', 'attackskillslot'];

// 解析單行條件 "hp < 75%" / "sp > 20"
function matchCondition(line: string): Condition | null {
  const m = line.match(/^(hp|sp)\s*([<>])\s*(\d+)\s*(%?)$/i);
  if (!m) return null;
  return {
    stat: m[1].toLowerCase() as Stat,
    op: m[2] as Op,
    value: Number(m[3]),
    isPercent: m[4] === '%',
  };
}

// 解析數值或百分比欄位 "50%" / "50" → 回傳 { value, isPercent }
function parseAmount(val: string): { value: number; isPercent: boolean } {
  const m = val.match(/(\d+)\s*(%?)/);
  return { value: m ? Number(m[1]) : 0, isPercent: !!(m && m[2]) };
}

function parseUseSelfItem(item: string, body: string[], lineNo: number): UseSelfItemRule {
  for (const line of body) {
    const c = matchCondition(line);
    if (c) return { item, ...c };
  }
  throw new ConfigError(`第 ${lineNo} 行附近的 useSelf_item 區塊缺少條件（如 hp < 75%）`);
}

function parseBuyAuto(item: string, body: string[]): BuyAutoRule {
  const rule: BuyAutoRule = { item, npc: '', minAmount: 0, maxAmount: 0, disabled: false };
  for (const line of body) {
    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();
    switch (key.toLowerCase()) {
      case 'npc': rule.npc = val; break;
      case 'minamount': rule.minAmount = Number(val) || 0; break;
      case 'maxamount': rule.maxAmount = Number(val) || 0; break;
      case 'disabled': rule.disabled = Number(val) === 1; break;
    }
  }
  return rule;
}

function parseMonControl(monster: string, body: string[]): MonControlRule {
  const rule: MonControlRule = {
    monster,
    attack: 1,
    minHpPercent: 0,
    minSpPercent: 0,
    minLevel: 0,
    teleport: false,
  };
  for (const line of body) {
    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();
    switch (key.toLowerCase()) {
      case 'attack': rule.attack = Number(val); break;
      case 'minhp': rule.minHpPercent = parseAmount(val).value; break;
      case 'minsp': rule.minSpPercent = parseAmount(val).value; break;
      case 'minlevel': rule.minLevel = Number(val) || 0; break;
      case 'teleport': rule.teleport = Number(val) === 1; break;
    }
  }
  return rule;
}

function parseAttackSkill(skill: string, body: string[]): AttackSkillRule {
  const rule: AttackSkillRule = {
    skill,
    monsters: [],
    notMonsters: [],
    disabled: false,
  };
  for (const line of body) {
    const c = matchCondition(line);
    if (c) {
      if (c.stat === 'hp') rule.hp = c;
      else rule.sp = c;
      continue;
    }
    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();
    const list = () => val.split(/[;\s]+/).map((s) => s.trim()).filter(Boolean);
    switch (key.toLowerCase()) {
      case 'monsters': rule.monsters = list(); break;
      case 'notmonsters': rule.notMonsters = list(); break;
      case 'disabled': rule.disabled = Number(val) === 1; break;
    }
  }
  return rule;
}

export function parseConfig(text: string): GameConfig {
  const cfg: GameConfig = {
    ...DEFAULT_CONFIG,
    useSelfItems: [],
    buyAuto: [],
    monControl: [],
    attackSkills: [],
    sitAuto: { ...DEFAULT_CONFIG.sitAuto },
  };

  const rawLines = text.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].replace(/#.*$/, '').trim();
    if (!line) continue;

    // 區塊指令
    const blockMatch = line.match(
      /^(useSelf_item|buyAuto|mon_control|attackSkillSlot)\b\s*([^{]*)(\{?.*)$/i,
    );
    if (blockMatch && BLOCK_DIRECTIVES.includes(blockMatch[1].toLowerCase())) {
      const directive = blockMatch[1].toLowerCase();
      const name = blockMatch[2].trim();
      const startLine = i + 1;

      // 蒐集 { 與 } 之間的內容（可跨行）
      let buffer = '';
      let opened = false;
      let closed = false;
      const consume = (t0: string): boolean => {
        let t = t0;
        if (!opened) {
          const oi = t.indexOf('{');
          if (oi === -1) return false;
          opened = true;
          t = t.slice(oi + 1);
        }
        const ci = t.indexOf('}');
        if (ci === -1) {
          buffer += t + '\n';
          return false;
        }
        buffer += t.slice(0, ci);
        return true;
      };

      closed = consume(blockMatch[3]);
      while (!closed && ++i < rawLines.length) {
        closed = consume(rawLines[i].replace(/#.*$/, ''));
      }
      if (!opened) throw new ConfigError(`第 ${startLine} 行的 ${directive} 區塊缺少 '{'`);
      if (!closed) {
        throw new ConfigError(`第 ${startLine} 行的 ${directive} 區塊缺少結尾 '}'（括號必須成對）`);
      }

      const body = buffer
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!name) continue; // 名稱留空 = 關閉該區塊

      switch (directive) {
        case 'useself_item':
          cfg.useSelfItems.push(parseUseSelfItem(name, body, startLine));
          break;
        case 'buyauto':
          cfg.buyAuto.push(parseBuyAuto(name, body));
          break;
        case 'mon_control':
          cfg.monControl.push(parseMonControl(name, body));
          break;
        case 'attackskillslot':
          cfg.attackSkills.push(parseAttackSkill(name, body));
          break;
      }
      continue;
    }

    // 單行 key value
    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();
    switch (key.toLowerCase()) {
      case 'map': cfg.map = val; break;
      case 'savemap': cfg.saveMap = val; break;
      case 'attackmode': cfg.attackMode = (Number(val) as AttackMode) ?? 2; break;
      case 'itemstakeauto': cfg.itemsTakeAuto = (Number(val) as ItemsTakeAuto) ?? 1; break;
      case 'sellauto': cfg.sellAuto = (Number(val) as SellAuto) ?? 0; break;
      case 'sitauto_hp_lower': cfg.sitAuto.hpLower = Number(val) || 0; break;
      case 'sitauto_hp_upper': cfg.sitAuto.hpUpper = Number(val) || 100; break;
      case 'sitauto_sp_lower': cfg.sitAuto.spLower = Number(val) || 0; break;
      case 'sitauto_sp_upper': cfg.sitAuto.spUpper = Number(val) || 100; break;
      case 'teleportauto_hp': cfg.teleportAutoHp = Number(val) || 0; break;
      case 'teleportauto_sp': cfg.teleportAutoSp = Number(val) || 0; break;
      default: break; // 未知 key 忽略
    }
  }

  return cfg;
}
