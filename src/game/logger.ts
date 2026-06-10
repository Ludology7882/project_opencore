// 日誌輸出 — 模擬外掛掛機時的訊息滾動（GDD 1.2 / 4.4）。
// 與平台無關：實際輸出交給注入的 sink（CLI 用 stdout，網頁用 DOM）。
// delayMs > 0 時逐行延遲，營造即時滾動感；0 則即時輸出。

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type LogChannel = 'system' | 'move' | 'combat' | 'item' | 'level' | 'death' | 'shop';

// 輸出端：拿到頻道、訊息、目前 tick，自行決定如何呈現
export type LogSink = (channel: LogChannel, message: string, tick: number) => void;

export class Logger {
  private sink: LogSink;
  private delayMs: number;
  private tick = 0;

  constructor(sink: LogSink, delayMs = 0) {
    this.sink = sink;
    this.delayMs = delayMs;
  }

  setTick(t: number): void {
    this.tick = t;
  }

  // 即時調整每行延遲（網頁版速度控制用）
  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  async log(channel: LogChannel, message: string): Promise<void> {
    this.sink(channel, message, this.tick);
    if (this.delayMs > 0) await sleep(this.delayMs);
  }
}
