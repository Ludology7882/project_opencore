#!/usr/bin/env node
// 外掛模擬器 v1.0 — CLI 進入點
import * as fs from 'fs';
import * as path from 'path';
import { loadGameData } from './data/loader';
import { parseConfig, ConfigError } from './config/parser';
import { Character } from './game/character';
import { Engine } from './game/engine';
import { Logger } from './game/logger';
import { Rng } from './util/rng';
import { expToNext } from './game/stats';

interface CliArgs {
  config: string;
  data: string;
  ticks: number;
  seed: number;
  delay: number;
  job: string;
  noColor: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const root = path.resolve(__dirname, '..');
  const args: CliArgs = {
    config: path.join(root, 'config.txt'),
    data: path.join(root, 'data'),
    ticks: 80,
    seed: 1,
    delay: 0,
    job: 'swordsman',
    noColor: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--config': args.config = path.resolve(next()); break;
      case '--data': args.data = path.resolve(next()); break;
      case '--ticks': args.ticks = Number(next()); break;
      case '--seed': args.seed = Number(next()); break;
      case '--delay': args.delay = Number(next()); break;
      case '--job': args.job = next(); break;
      case '--no-color': args.noColor = true; break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`外掛模擬器 v1.0

用法：
  npm start -- [選項]

選項：
  --config <檔案>   config 檔路徑（預設 ./config.txt）
  --data <資料夾>   資料表資料夾（預設 ./data）
  --ticks <n>       模擬回合數（預設 80）
  --seed <n>        亂數種子，固定可重現（預設 1）
  --delay <ms>      每行日誌延遲毫秒，營造滾動感（預設 0）
  --job <id>        起始職業 id（預設 swordsman）
  --no-color        關閉顏色輸出
  -h, --help        顯示說明
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const data = loadGameData(args.data);

  const job = data.jobs.get(args.job);
  if (!job) {
    console.error(`找不到職業 id：${args.job}（可用：${Array.from(data.jobs.keys()).join(', ')}）`);
    process.exit(1);
  }

  let cfg;
  try {
    const text = fs.readFileSync(args.config, 'utf8');
    cfg = parseConfig(text);
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`config 解析失敗：${e.message}`);
    } else {
      console.error(`無法讀取 config（${args.config}）：${(e as Error).message}`);
    }
    process.exit(1);
  }

  // 起始給予一些初始金錢，方便 buyAuto 測試
  const char = new Character(job, 1, 200);
  const logger = new Logger(args.delay, !args.noColor);
  const rng = new Rng(args.seed);
  const engine = new Engine(data, cfg, char, logger, rng);

  const stats = await engine.run(args.ticks);

  // ===== 結算 =====
  const net = stats.endMoney - stats.startMoney;
  const expPerTick = stats.ticks ? (stats.expGained / stats.ticks).toFixed(2) : '0';
  const moneyPerTick = stats.ticks ? (net / stats.ticks).toFixed(2) : '0';
  console.log('');
  console.log('========== 掛機結算 ==========');
  console.log(`回合數        ：${stats.ticks}`);
  console.log(`擊殺數        ：${stats.kills}`);
  console.log(`死亡次數      ：${stats.deaths}`);
  console.log(`逃跑次數      ：${stats.escapes}（用蒼蠅之翼）`);
  console.log(`休息耗時      ：${stats.sitTicks}`);
  console.log(`移動耗時      ：${stats.travelTicks}（補貨往返）`);
  console.log(`等級          ：LV${stats.startLevel} → LV${stats.endLevel}（目前 ${char.exp}/${char.level >= 10 ? '滿' : expToNext(char.level)} exp）`);
  console.log(`累計獲得經驗  ：${stats.expGained}`);
  console.log(`收入(打怪+賣) ：${stats.moneyEarned}z`);
  console.log(`支出(購買)    ：${stats.moneySpent}z`);
  console.log(`所持金        ：${stats.startMoney}z → ${stats.endMoney}z（淨 ${net >= 0 ? '+' : ''}${net}z）`);
  console.log('------ 效率指標 ------');
  console.log(`經驗/回合     ：${expPerTick}`);
  console.log(`淨金錢/回合   ：${moneyPerTick}z`);
  console.log('==============================');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
