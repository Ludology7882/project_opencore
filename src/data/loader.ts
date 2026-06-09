import * as fs from 'fs';
import * as path from 'path';
import { parseCsv } from './csv';
import { GameData, Job, GameMap, Monster, Item, Drop, ItemType } from '../types';

const num = (v: string, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export function loadGameData(dataDir: string): GameData {
  const read = (file: string) =>
    parseCsv(fs.readFileSync(path.join(dataDir, file), 'utf8'));

  const jobs = new Map<string, Job>();
  for (const r of read('jobs.csv')) {
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
  for (const r of read('maps.csv')) {
    maps.set(r.mapId, {
      mapId: r.mapId,
      name: r.name,
      monsters: r.monsters ? r.monsters.split(';').map((s) => s.trim()).filter(Boolean) : [],
      connections: r.connections ? r.connections.split(';').map((s) => s.trim()).filter(Boolean) : [],
      isTown: num(r.isTown) === 1,
    });
  }

  const monsters = new Map<string, Monster>();
  for (const r of read('monsters.csv')) {
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
  for (const r of read('items.csv')) {
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
  for (const r of read('drops.csv')) {
    const d: Drop = { monsterId: r.monsterId, itemId: r.itemId, rate: num(r.rate) };
    const arr = dropsByMonster.get(d.monsterId) ?? [];
    arr.push(d);
    dropsByMonster.set(d.monsterId, arr);
  }

  return { jobs, maps, monsters, items, dropsByMonster, itemIdByName };
}
