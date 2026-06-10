// 網頁版進入點 — 即時放置玩法：角色持續存在，訊息逐條冒出，
// 可隨時編輯 config 按「套用」中途換圖／改策略，並可暫停／繼續／重置。
import { buildGameData } from '../data/loader';
import { parseConfig } from '../config/parser';
import { Character } from '../game/character';
import { Engine } from '../game/engine';
import { Logger, LogChannel } from '../game/logger';
import { Rng } from '../util/rng';

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
const applyBtn = $('apply') as HTMLButtonElement;
const resetBtn = $('reset') as HTMLButtonElement;
const seedEl = $('seed') as HTMLInputElement;
const speedEl = $('speed') as HTMLSelectElement;
const jobEl = $('job') as HTMLSelectElement;
const statusEl = $('status');

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

cfgEl.value = defaultConfigText;
for (const job of data.jobs.values()) {
  const opt = document.createElement('option');
  opt.value = job.jobId;
  opt.textContent = job.name;
  jobEl.appendChild(opt);
}

let engine: Engine | null = null;
let curLogger: Logger | null = null;
let running = false;
let stopFlag = false;
let gen = 0;

function appendLine(channel: LogChannel, message: string, tick: number): void {
  const div = document.createElement('div');
  div.className = 'line ' + channel;
  div.textContent = `[${String(tick).padStart(4, '0')}] ${message}`;
  logEl.appendChild(div);
  // 長時間掛機時限制 DOM 行數，避免記憶體膨脹
  while (logEl.childElementCount > 800) logEl.removeChild(logEl.firstChild!);
  logEl.scrollTop = logEl.scrollHeight;
  if (engine) updateStatus(); // 每行同步更新狀態列，戰鬥中 HP/SP 即時跳動
}

// 建立全新一局（角色 LV1）。config 無效時回傳 false。
function initGame(): boolean {
  let cfg;
  try {
    cfg = parseConfig(cfgEl.value);
  } catch (e) {
    appendLine('death', 'config 解析失敗：' + (e instanceof Error ? e.message : String(e)), 0);
    return false;
  }
  const job = data.jobs.get(jobEl.value) ?? data.jobs.values().next().value;
  if (!job) {
    appendLine('death', '找不到職業資料', 0);
    return false;
  }
  const char = new Character(job, 1, 200);
  curLogger = new Logger(appendLine, Number(speedEl.value) || 0);
  engine = new Engine(data, cfg, char, curLogger, new Rng(Number(seedEl.value) || 1));
  return true;
}

async function loop(): Promise<void> {
  if (running) return;
  if (!engine && !initGame()) return;
  running = true;
  stopFlag = false;
  const myGen = gen;
  refreshButtons();
  await engine!.begin();
  while (!stopFlag && myGen === gen) {
    await engine!.tick();
    updateStatus();
    await sleep(0); // 讓出事件迴圈，確保暫停/套用按鈕即時反應
  }
  running = false;
  refreshButtons();
}

function pause(): void {
  stopFlag = true;
}

async function applyConfig(): Promise<void> {
  let cfg;
  try {
    cfg = parseConfig(cfgEl.value);
  } catch (e) {
    appendLine('death', 'config 解析失敗：' + (e instanceof Error ? e.message : String(e)), 0);
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

function reset(): void {
  gen++; // 讓進行中的迴圈停止
  stopFlag = true;
  running = false;
  engine = null;
  curLogger = null;
  logEl.innerHTML = '';
  statusEl.innerHTML = '待機中 — 按「開始掛機」啟動';
  if (initGame()) updateStatus();
  refreshButtons();
}

function refreshButtons(): void {
  runBtn.textContent = running ? '⏸ 暫停' : engine && engine.getState().time > 0 ? '▶ 繼續' : '▶ 開始掛機';
}

function updateStatus(): void {
  if (!engine) return;
  const s = engine.getState();
  const net = s.stats.endMoney - s.stats.startMoney;
  const expPerTick = s.time ? (s.stats.expGained / s.time).toFixed(2) : '0';
  const moneyPerTick = s.time ? (net / s.time).toFixed(2) : '0';
  const lvTxt = s.maxLevel ? `LV${s.level}（滿級・續賺）` : `LV${s.level}（${s.exp}/${s.expNext}）`;
  statusEl.innerHTML =
    `<b>${lvTxt}</b>　HP ${s.hp}/${s.maxHp}　SP ${s.sp}/${s.maxSp}　所持金 ${s.money}z　@${s.mapName}<br>` +
    `回合 ${s.time}｜擊殺 ${s.stats.kills}｜死亡 ${s.stats.deaths}｜逃跑 ${s.stats.escapes}｜休息 ${s.stats.sitTicks}｜移動 ${s.stats.travelTicks}　` +
    `<span class="hi">經驗/回合 ${expPerTick}　淨金錢/回合 ${moneyPerTick}z</span>`;
}

runBtn.addEventListener('click', () => (running ? pause() : loop()));
applyBtn.addEventListener('click', applyConfig);
resetBtn.addEventListener('click', reset);
speedEl.addEventListener('change', () => curLogger?.setDelay(Number(speedEl.value) || 0));

// 初始：預先建立一局，狀態列顯示 LV1
reset();
