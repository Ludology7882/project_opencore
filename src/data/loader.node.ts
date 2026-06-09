// 檔案系統載入器（僅 Node/CLI 使用，瀏覽器版不會引入，避免打包到 fs/path）
import * as fs from 'fs';
import * as path from 'path';
import { buildGameData } from './loader';
import { GameData } from '../types';

export function loadGameData(dataDir: string): GameData {
  const read = (file: string) => fs.readFileSync(path.join(dataDir, file), 'utf8');
  return buildGameData({
    jobs: read('jobs.csv'),
    maps: read('maps.csv'),
    monsters: read('monsters.csv'),
    items: read('items.csv'),
    drops: read('drops.csv'),
    skills: read('skills.csv'),
  });
}
