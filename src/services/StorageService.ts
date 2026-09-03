/**
 * Persistent Storage Service using localStorage
 */
export interface LevelRecord {
  completed: boolean;
  stars: number; // 0-3
  highScore: number;
  bestTime: number; // in seconds
}

export class StorageService {
  private static instance: StorageService;
  private static PREFIX = 'leaf_mahjong_';

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public getUnlockedLevel(): number {
    const val = localStorage.getItem(StorageService.PREFIX + 'unlocked_level');
    return val ? parseInt(val, 10) : 1;
  }

  public unlockNextLevel(currentLevel: number) {
    const currentMax = this.getUnlockedLevel();
    if (currentLevel + 1 > currentMax) {
      localStorage.setItem(StorageService.PREFIX + 'unlocked_level', String(currentLevel + 1));
    }
  }

  public getLevelRecord(level: number): LevelRecord {
    const val = localStorage.getItem(StorageService.PREFIX + `lvl_${level}`);
    if (val) {
      try {
        return JSON.parse(val);
      } catch {
        // fallback
      }
    }
    return { completed: false, stars: 0, highScore: 0, bestTime: 0 };
  }

  public saveLevelRecord(level: number, score: number, time: number, stars: number) {
    const existing = this.getLevelRecord(level);
    const updated: LevelRecord = {
      completed: true,
      stars: Math.max(existing.stars, stars),
      highScore: Math.max(existing.highScore, score),
      bestTime: existing.bestTime === 0 ? time : Math.min(existing.bestTime, time),
    };
    localStorage.setItem(StorageService.PREFIX + `lvl_${level}`, JSON.stringify(updated));
    this.unlockNextLevel(level);

    // Also update total tournament score
    this.addTournamentScore(score);
  }

  public getCoins(): number {
    const val = localStorage.getItem(StorageService.PREFIX + 'coins');
    return val ? parseInt(val, 10) : 50; // starting bonus
  }

  public addCoins(amount: number): number {
    const current = this.getCoins();
    const updated = Math.max(0, current + amount);
    localStorage.setItem(StorageService.PREFIX + 'coins', String(updated));
    return updated;
  }

  public getTournamentScore(): number {
    const val = localStorage.getItem(StorageService.PREFIX + 'tourney_score');
    return val ? parseInt(val, 10) : 0;
  }

  public addTournamentScore(amount: number): number {
    const current = this.getTournamentScore();
    const updated = current + amount;
    localStorage.setItem(StorageService.PREFIX + 'tourney_score', String(updated));
    return updated;
  }
}
