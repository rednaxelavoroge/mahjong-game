import { RawTilePos, LevelConfig } from './layouts';

function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAPTER_NAMES = [
  'Бамбуковая Долина',
  'Нефритовый Павильон',
  'Храм Белого Лотоса',
  'Золотой Дворец',
  'Пик Дракона',
  'Сад Цветущей Сакуры',
  'Обитель Горного Ветра',
  'Янтарные Чертоги',
  'Врата Небесного Озера',
  'Императорская Сокровищница',
  'Лунная Терраса',
  'Оазис Спокойствия',
  'Гряда Феникса',
  'Заповедный Лес',
  'Заоблачный Предел',
];

const ARCHETYPE_NAMES = [
  'Черепаха',
  'Пирамида',
  'Крест Стихий',
  'Крепость',
  'Цветок Лотоса',
  'Хребет Дракона',
  'Врата Храма',
  'Звезда Востока',
];

/**
 * Procedural Infinite Level Generator (Supports Level 1 to 10,000+)
 */
export class InfiniteLevelGenerator {
  public static getLevelConfig(levelNum: number): LevelConfig {
    const prng = mulberry32(levelNum * 7919 + 1337);

    const chapterIndex = Math.floor((levelNum - 1) / 10);
    const chapterName = CHAPTER_NAMES[chapterIndex % CHAPTER_NAMES.length];
    const levelInChapter = ((levelNum - 1) % 10) + 1;

    const archetypeIndex = Math.floor(prng() * ARCHETYPE_NAMES.length);
    const archetypeName = ARCHETYPE_NAMES[archetypeIndex];

    // Spacing between tiles
    const stepX = 42;
    const stepY = 46;

    // Time limit scales smoothly
    const timeLimit = Math.min(360, 120 + Math.floor(levelNum / 5) * 15);

    return {
      id: levelNum,
      name: archetypeName.toUpperCase(),
      subname: `Уровень ${levelNum} • Глава ${chapterIndex + 1}: ${chapterName} (${levelInChapter}/10)`,
      stepX,
      stepY,
      timeLimit,
      build: () => this.buildProceduralLayout(levelNum, archetypeIndex, prng, stepX, stepY),
    };
  }

  private static buildProceduralLayout(
    levelNum: number,
    archetypeIndex: number,
    prng: () => number,
    stepX: number,
    stepY: number
  ): RawTilePos[] {
    const list: RawTilePos[] = [];

    // Target tile count (always even, between 32 and 68 tiles)
    let targetPairs = 16; // 32 tiles base
    if (levelNum > 2) targetPairs = 20; // 40 tiles
    if (levelNum > 5) targetPairs = 24; // 48 tiles
    if (levelNum > 12) targetPairs = 28; // 56 tiles
    if (levelNum > 25) targetPairs = 30 + Math.floor(prng() * 4); // 60-66 tiles

    const totalTiles = targetPairs * 2;

    switch (archetypeIndex) {
      // 0: Черепаха (Turtle)
      case 0: {
        const baseCols = 7;
        const baseRows = 4;
        for (let r = 0; r < baseRows; r++) {
          for (let c = 0; c < baseCols; c++) {
            list.push({ x: (c - (baseCols - 1) / 2) * stepX, y: (r - (baseRows - 1) / 2) * stepY, z: 0 });
          }
        }
        // Wings
        list.push({ x: -3.5 * stepX, y: 0, z: 0 });
        list.push({ x: 3.5 * stepX, y: 0, z: 0 });

        // Mid layer
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            list.push({ x: (c - 1.5) * stepX, y: (r - 0.5) * stepY, z: 1 });
          }
        }
        // Top crown
        list.push({ x: -0.5 * stepX, y: 0, z: 2 });
        list.push({ x: 0.5 * stepX, y: 0, z: 2 });
        break;
      }

      // 1: Пирамида (Pyramid)
      case 1: {
        // Step 0: 6x4 = 24
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 6; c++) {
            list.push({ x: (c - 2.5) * stepX, y: (r - 1.5) * stepY, z: 0 });
          }
        }
        // Step 1: 4x2 = 8
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            list.push({ x: (c - 1.5) * stepX, y: (r - 0.5) * stepY, z: 1 });
          }
        }
        // Step 2: 2x2 = 4
        list.push({ x: -0.5 * stepX, y: -0.5 * stepY, z: 2 });
        list.push({ x: 0.5 * stepX, y: -0.5 * stepY, z: 2 });
        list.push({ x: -0.5 * stepX, y: 0.5 * stepY, z: 2 });
        list.push({ x: 0.5 * stepX, y: 0.5 * stepY, z: 2 });

        // Extra wings if higher level
        if (totalTiles > 36) {
          list.push({ x: -3.5 * stepX, y: -0.5 * stepY, z: 0 });
          list.push({ x: 3.5 * stepX, y: -0.5 * stepY, z: 0 });
          list.push({ x: -3.5 * stepX, y: 0.5 * stepY, z: 0 });
          list.push({ x: 3.5 * stepX, y: 0.5 * stepY, z: 0 });
        }
        break;
      }

      // 2: Крест Стихий (Cross)
      case 2: {
        // Vertical stem
        for (let r = -3; r <= 3; r++) {
          list.push({ x: -0.5 * stepX, y: r * stepY, z: 0 });
          list.push({ x: 0.5 * stepX, y: r * stepY, z: 0 });
        }
        // Horizontal bar
        for (let c = -3; c <= 3; c++) {
          if (c !== 0 && c !== -1) {
            list.push({ x: c * stepX, y: -0.5 * stepY, z: 0 });
            list.push({ x: c * stepX, y: 0.5 * stepY, z: 0 });
          }
        }
        // Elevated center 2x2
        list.push({ x: -0.5 * stepX, y: -0.5 * stepY, z: 1 });
        list.push({ x: 0.5 * stepX, y: -0.5 * stepY, z: 1 });
        list.push({ x: -0.5 * stepX, y: 0.5 * stepY, z: 1 });
        list.push({ x: 0.5 * stepX, y: 0.5 * stepY, z: 1 });
        // Peak
        list.push({ x: 0, y: 0, z: 2 });
        list.push({ x: 0, y: 0, z: 3 });
        break;
      }

      // 3: Крепость (Fortress)
      case 3: {
        for (let r = -2; r <= 2; r++) {
          for (let c = -3; c <= 3; c++) {
            if (Math.abs(r) === 2 && Math.abs(c) === 3) continue; // notched corners
            list.push({ x: c * stepX, y: r * stepY, z: 0 });
          }
        }
        // 4 corner towers on layer 1
        const towers = [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]];
        for (const [tx, ty] of towers) {
          list.push({ x: tx * stepX, y: ty * stepY, z: 1 });
        }
        // Central keep
        list.push({ x: -0.5 * stepX, y: 0, z: 1 });
        list.push({ x: 0.5 * stepX, y: 0, z: 1 });
        list.push({ x: 0, y: 0, z: 2 });
        list.push({ x: 0, y: 0, z: 3 });
        break;
      }

      // Default & Other archetypes: Stepped Garden / Temple
      default: {
        const rows = 4;
        const cols = 6;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            list.push({ x: (c - (cols - 1) / 2) * stepX, y: (r - (rows - 1) / 2) * stepY, z: 0 });
          }
        }
        // Secondary layer
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 4; c++) {
            list.push({ x: (c - 1.5) * stepX, y: (r - 0.5) * stepY, z: 1 });
          }
        }
        // Top 2
        list.push({ x: -0.5 * stepX, y: 0, z: 2 });
        list.push({ x: 0.5 * stepX, y: 0, z: 2 });
        break;
      }
    }

    // Ensure total count is strictly EVEN (required for pairing)
    if (list.length % 2 !== 0) {
      list.pop();
    }

    // Adjust count to match desired scale by trimming or mirroring pairs
    while (list.length > totalTiles && list.length >= 32) {
      list.pop();
      list.pop();
    }

    return list;
  }
}
