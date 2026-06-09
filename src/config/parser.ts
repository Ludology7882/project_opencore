// config.txt 解析器 — 模仿 OpenKore config 風格。
// 支援：
//   key value            （單行設定，如 map B）
//   區塊指令 useSelf_item / buyAuto，後接 { ... } 區塊
// 規則（依 GDD）：
//   - 一個區塊只能使用一件物品
//   - 區塊括號必須成對，有頭必須有尾
//   - 物品名稱沒填 → 該區塊功能關閉

import {
  GameConfig,
  DEFAULT_CONFIG,
  AttackMode,
  ItemsTakeAuto,
  SellAuto,
  UseSelfItemRule,
  BuyAutoRule,
  Stat,
  Op,
} from './types';

export class ConfigError extends Error {}

function parseCondition(body: string[], lineNo: number): Omit<UseSelfItemRule, 'item'> {
  // 在區塊內找出形如 "hp < 75%" 或 "sp > 10" 的條件
  const condLine = body.find((l) => /(hp|sp)\s*[<>]/i.test(l));
  if (!condLine) {
    throw new ConfigError(`第 ${lineNo} 行附近的 useSelf_item 區塊缺少條件（如 hp < 75%）`);
  }
  const m = condLine.match(/(hp|sp)\s*([<>])\s*(\d+)\s*(%?)/i);
  if (!m) {
    throw new ConfigError(`無法解析條件：「${condLine}」，正確格式如 hp < 75%`);
  }
  return {
    stat: m[1].toLowerCase() as Stat,
    op: m[2] as Op,
    value: Number(m[3]),
    isPercent: m[4] === '%',
  };
}

function parseBuyAuto(item: string, body: string[]): BuyAutoRule {
  const rule: BuyAutoRule = {
    item,
    npc: '',
    minAmount: 0,
    maxAmount: 0,
    disabled: false,
  };
  for (const line of body) {
    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();
    switch (key.toLowerCase()) {
      case 'npc':
        rule.npc = val;
        break;
      case 'minamount':
        rule.minAmount = Number(val) || 0;
        break;
      case 'maxamount':
        rule.maxAmount = Number(val) || 0;
        break;
      case 'disabled':
        rule.disabled = Number(val) === 1;
        break;
    }
  }
  return rule;
}

export function parseConfig(text: string): GameConfig {
  const cfg: GameConfig = {
    ...DEFAULT_CONFIG,
    useSelfItems: [],
    buyAuto: [],
  };

  const rawLines = text.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    // 去除註解（# 之後）與前後空白
    let line = rawLines[i].replace(/#.*$/, '').trim();
    if (!line) continue;

    // 區塊指令：useSelf_item / buyAuto，後接 { ... }
    // 支援單行 `... { a, b }`、多行區塊、以及逗號或換行分隔的欄位。
    const blockMatch = line.match(/^(useSelf_item|buyAuto)\b\s*([^{]*)(\{?.*)$/i);
    if (blockMatch) {
      const directive = blockMatch[1].toLowerCase();
      const itemName = blockMatch[2].trim();
      const startLine = i + 1;

      // 從第一個 '{' 之後，蒐集內容直到對應的 '}'（可跨行）
      let buffer = '';
      let opened = false;
      let closed = false;
      const consume = (text: string): boolean => {
        let t = text;
        if (!opened) {
          const oi = t.indexOf('{');
          if (oi === -1) return false; // 尚未遇到 '{'
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
      if (!opened) {
        throw new ConfigError(`第 ${startLine} 行的 ${directive} 區塊缺少 '{'`);
      }
      if (!closed) {
        throw new ConfigError(`第 ${startLine} 行的 ${directive} 區塊缺少結尾 '}'（括號必須成對）`);
      }

      // 以換行或逗號切成各條敘述
      const body = buffer
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      // 物品名稱未填 → 關閉該區塊，略過
      if (!itemName) continue;

      if (directive === 'useself_item') {
        cfg.useSelfItems.push({ item: itemName, ...parseCondition(body, startLine) });
      } else {
        cfg.buyAuto.push(parseBuyAuto(itemName, body));
      }
      continue;
    }

    // 單行 key value
    const [key, ...rest] = line.split(/\s+/);
    const val = rest.join(' ').trim();
    switch (key.toLowerCase()) {
      case 'map':
        cfg.map = val;
        break;
      case 'savemap':
        cfg.saveMap = val;
        break;
      case 'attackmode':
        cfg.attackMode = (Number(val) as AttackMode) ?? 2;
        break;
      case 'itemstakeauto':
        cfg.itemsTakeAuto = (Number(val) as ItemsTakeAuto) ?? 1;
        break;
      case 'sellauto':
        cfg.sellAuto = (Number(val) as SellAuto) ?? 0;
        break;
      default:
        // 未知 key 忽略（保持與外掛 config 寬鬆相容）
        break;
    }
  }

  return cfg;
}
