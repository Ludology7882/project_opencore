// 日誌輸出 — 模擬外掛掛機時的訊息滾動（GDD 1.2 / 4.4）。
// delayMs > 0 時逐行延遲輸出，營造即時滾動感；0 則即時輸出。

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type LogChannel = 'system' | 'move' | 'combat' | 'item' | 'level' | 'death' | 'shop';

const COLORS: Record<LogChannel, string> = {
  system: '\x1b[90m', // 灰
  move: '\x1b[36m', // 青
  combat: '\x1b[37m', // 白
  item: '\x1b[33m', // 黃
  level: '\x1b[32m', // 綠
  death: '\x1b[31m', // 紅
  shop: '\x1b[35m', // 紫
};
const RESET = '\x1b[0m';

export class Logger {
  private delayMs: number;
  private useColor: boolean;
  private tick = 0;

  constructor(delayMs = 0, useColor = true) {
    this.delayMs = delayMs;
    this.useColor = useColor && process.stdout.isTTY === true;
  }

  setTick(t: number): void {
    this.tick = t;
  }

  async log(channel: LogChannel, message: string): Promise<void> {
    const stamp = `[${String(this.tick).padStart(4, '0')}]`;
    const line = this.useColor
      ? `${COLORS[channel]}${stamp} ${message}${RESET}`
      : `${stamp} ${message}`;
    process.stdout.write(line + '\n');
    if (this.delayMs > 0) await sleep(this.delayMs);
  }
}
