// 網頁版進入點 — 把遊戲引擎接上瀏覽器介面（複古終端機風）。
// 遊戲資料與預設 config 由打包工具（esbuild）以文字內嵌，故 file:// 雙擊也能跑。
import { buildGameData } from '../data/loader';
import { parseConfig } from '../config/parser';
import { Character } from '../game/character';
import { Engine, RunStats } from '../game/engine';
import { Logger, LogChannel } from '../game/logger';
import { Rng } from '../util/rng';
import { expToNext } from '../game/stats';

// 由 esbuild 的 text loader 內嵌（見 package.json 的 build:web）
import jobsCsv from '../../data/jobs.csv';
import mapsCsv from '../../data/maps.csv';
import monstersCsv from '../../data/monsters.csv';
import itemsCsv from '../../data/items.csv';
import dropsCsv from '../../data/drops.csv';
import skillsCsv from '../../data/skills.csv';
import defaultConfigText from '../../config.txt';

const data = buildGameData({
  jobs: jobsCsv,
  maps: mapsCsv,
  monsters: monstersCsv,
  items: itemsCsv,
  drops: dropsCsv,
  skills: skillsCsv,
});

const $ = (id: string) => document.getElementById(id)!;
const logEl = $('log');
const cfgEl = $('config') as HTMLTextAreaElement;
const runBtn = $('run') as HTMLButtonElement;
const ticksEl = $('ticks') as HTMLInputElement;
const seedEl = $('seed') as HTMLInputElement;
const speedEl = $('speed') as HTMLSelectElement;
const jobEl = $('job') as HTMLSelectElement;
const summaryEl = $('summary');

// 帶入預設 config 與職業清單
cfgEl.value = defaultConfigText;
for (const job of data.jobs.values()) {
  const opt = document.createElement('option');
  opt.value = job.jobId;
  opt.textContent = job.name;
  jobEl.appendChild(opt);
}

let running = false;

function appendLine(channel: LogChannel, message: string, tick: number): void {
  const div = document.createElement('div');
  div.className = 'line ' + channel;
  div.textContent = `[${String(tick).padStart(4, '0')}] ${message}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

async function run(): Promise<void> {
  if (running) return;
  running = true;
  runBtn.disabled = true;
  runBtn.textContent = '掛機中…';
  logEl.innerHTML = '';
  summaryEl.innerHTML = '';

  let cfg;
  try {
    cfg = parseConfig(cfgEl.value);
  } catch (e) {
    appendLine('death', 'config 解析失敗：' + (e instanceof Error ? e.message : String(e)), 0);
    finishRun();
    return;
  }

  const job = data.jobs.get(jobEl.value) ?? data.jobs.values().next().value;
  if (!job) {
    appendLine('death', '找不到職業資料', 0);
    finishRun();
    return;
  }

  const ticks = Math.max(1, Number(ticksEl.value) || 80);
  const seed = Number(seedEl.value) || 1;
  const delay = Number(speedEl.value) || 0;

  const char = new Character(job, 1, 200);
  const logger = new Logger(appendLine, delay);
  const rng = new Rng(seed);
  const engine = new Engine(data, cfg, char, logger, rng);

  try {
    const stats = await engine.run(ticks);
    renderSummary(stats, char);
  } catch (e) {
    appendLine('death', '執行錯誤：' + (e instanceof Error ? e.message : String(e)), 0);
  }
  finishRun();
}

function finishRun(): void {
  running = false;
  runBtn.disabled = false;
  runBtn.textContent = '▶ 開始掛機';
}

function renderSummary(stats: RunStats, char: Character): void {
  const net = stats.endMoney - stats.startMoney;
  const expPerTick = stats.ticks ? (stats.expGained / stats.ticks).toFixed(2) : '0';
  const moneyPerTick = stats.ticks ? (net / stats.ticks).toFixed(2) : '0';
  const expNow = char.level >= 10 ? '滿' : String(expToNext(char.level));
  summaryEl.innerHTML =
    `<b>掛機結算</b>　回合 ${stats.ticks}｜擊殺 ${stats.kills}｜死亡 ${stats.deaths}｜逃跑 ${stats.escapes}<br>` +
    `休息耗時 ${stats.sitTicks}｜移動耗時 ${stats.travelTicks}｜LV ${stats.startLevel}→${stats.endLevel}（exp ${char.exp}/${expNow}）<br>` +
    `收入 ${stats.moneyEarned}z｜支出 ${stats.moneySpent}z｜所持金 ${stats.startMoney}→${stats.endMoney}z（淨 ${net >= 0 ? '+' : ''}${net}z）<br>` +
    `<span class="hi">效率：經驗/回合 ${expPerTick}　淨金錢/回合 ${moneyPerTick}z</span>`;
}

runBtn.addEventListener('click', run);
