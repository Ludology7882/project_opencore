import { parseCsv } from './csv';
import { GameData, Job, GameMap, Monster, Item, Drop, ItemType, Skill } from '../types';

const num = (v: string, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// 各資料表的原始 CSV 文字（供瀏覽器內嵌使用）
export interface RawCsvData {
  jobs: string;
  maps: string;
  monsters: string;
  items: string;
  drops: string;
  skills: string;
}

// 從原始 CSV 文字建立遊戲資料（平台無關，CLI 與網頁共用，不依賴 Node API）
export function buildGameData(raw: RawCsvData): GameData {
  const read = (text: string) => parseCsv(text);

  const jobs = new Map<string, Job>();
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
      lukGrowth: num(r.lukGrowth),
    });
  }

  const maps = new Map<string, GameMap>();
  for (const r of read(raw.maps)) {
    maps.set(r.mapId, {
      mapId: r.mapId,
      name: r.name,
      monsters: r.monsters ? r.monsters.split(';').map((s) => s.trim()).filter(Boolean) : [],
      connections: r.connections ? r.connections.split(';').map((s) => s.trim()).filter(Boolean) : [],
      isTown: num(r.isTown) === 1,
    });
  }

  const monsters = new Map<string, Monster>();
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
      money: num(r.money),
    });
  }

  const items = new Map<string, Item>();
  const itemIdByName = new Map<string, string>();
  for (const r of read(raw.items)) {
    const item: Item = {
      itemId: r.itemId,
      name: r.name,
      type: r.type as ItemType,
      effectValue: num(r.effectValue),
      buyPrice: num(r.buyPrice),
      sellPrice: num(r.sellPrice),
    };
    items.set(item.itemId, item);
    itemIdByName.set(item.name, item.itemId);
  }

  const dropsByMonster = new Map<string, Drop[]>();
  for (const r of read(raw.drops)) {
    const d: Drop = { monsterId: r.monsterId, itemId: r.itemId, rate: num(r.rate) };
    const arr = dropsByMonster.get(d.monsterId) ?? [];
    arr.push(d);
    dropsByMonster.set(d.monsterId, arr);
  }

  const skills = new Map<string, Skill>();
  const skillIdByName = new Map<string, string>();
  for (const r of read(raw.skills)) {
    const skill: Skill = {
      skillId: r.skillId,
      name: r.name,
      job: r.job,
      spCost: num(r.spCost),
      powerPct: num(r.powerPct, 100),
      reqLevel: num(r.reqLevel, 1),
    };
    skills.set(skill.skillId, skill);
    skillIdByName.set(skill.name, skill.skillId);
  }

  return { jobs, maps, monsters, items, dropsByMonster, skills, itemIdByName, skillIdByName };
}
